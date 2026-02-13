// ollamaService.ts
// @ts-ignore
import fetch from 'node-fetch';

const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
const DEFAULT_MODEL = 'qwen2:7b';
const TIMEOUT_MS = Number.parseInt(process.env.OLLAMA_TIMEOUT || '20000', 10); // 20 seconds default - fail fast
const MAX_CV_LENGTH = 800; // Much shorter CV extract
const MAX_JOB_DESC_LENGTH = 600; // Much shorter job description

// Helper function to extract key information from text
function extractKeyInfo(text: string, maxLength: number): string {
  if (!text || text.length === 0) return '';
  
  // Remove HTML tags if present
  const cleanText = text.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  
  // Take first few sentences or first N characters
  if (cleanText.length <= maxLength) return cleanText;
  
  // Try to break at sentence boundary
  const truncated = cleanText.substring(0, maxLength);
  const lastPeriod = truncated.lastIndexOf('.');
  const lastNewline = truncated.lastIndexOf('\n');
  const breakPoint = Math.max(lastPeriod, lastNewline);
  
  if (breakPoint > maxLength * 0.7) {
    return truncated.substring(0, breakPoint + 1);
  }
  
  return truncated + '...';
}

// Helper function to create a timeout promise
function createTimeout(timeoutMs: number): Promise<never> {
  return new Promise((_, reject) => {
    setTimeout(() => reject(new Error(`Ollama request timed out after ${timeoutMs}ms`)), timeoutMs);
  });
}

// Check if Ollama is responsive
async function checkOllamaHealth(): Promise<boolean> {
  try {
    const response = await Promise.race([
      fetch(`${OLLAMA_BASE_URL}/api/tags`, { method: 'GET' }),
      createTimeout(5000) // 5 second health check timeout
    ]);
    return response.ok;
  } catch {
    return false;
  }
}

export async function generateCoverLetter(
  cvText: string,
  jobDescription: string,
  model: string = DEFAULT_MODEL
): Promise<string> {
  // Extract only key information - much shorter
  const shortCV = extractKeyInfo(cvText, MAX_CV_LENGTH);
  const shortJobDesc = extractKeyInfo(jobDescription, MAX_JOB_DESC_LENGTH);
  
  // Much simpler, shorter prompt
  const prompt = `Write a brief professional cover letter (3-4 paragraphs max) for this job:\n\nJob: ${shortJobDesc}\n\nMy background: ${shortCV}\n\nCover letter:`;

  console.log(`[Ollama] Generating cover letter (CV: ${shortCV.length} chars, Job: ${shortJobDesc.length} chars, timeout: ${TIMEOUT_MS}ms)`);

  // Quick health check first - if Ollama is not responsive, skip it immediately
  const isHealthy = await checkOllamaHealth();
  if (!isHealthy) {
    console.warn('[Ollama] Health check failed - skipping Ollama, using fallback');
    throw new Error('Ollama not responsive');
  }

  try {
    // Create a race between the fetch and timeout
    const fetchPromise = fetch(`${OLLAMA_BASE_URL}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: model,
        prompt: prompt,
        stream: false,
        options: {
          num_predict: 250, // Even shorter for faster generation
          temperature: 0.7,
          top_p: 0.9,
          top_k: 40,
          repeat_penalty: 1.1
        }
      })
    });

    const response = await Promise.race([
      fetchPromise,
      createTimeout(TIMEOUT_MS)
    ]);

    if (!response.ok) {
      throw new Error(`Ollama API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    const duration = data.total_duration ? (data.total_duration / 1000000000).toFixed(2) : 'unknown';
    console.log(`[Ollama] ✓ Response received (${duration}s)`);
    
    // Ollama returns the generated text in the 'response' field
    let coverLetter = data.response?.trim() || '';
    
    // Clean up the response - remove any extra formatting
    coverLetter = coverLetter.replace(/^Here is.*?:\s*/i, '').replace(/^Cover letter:\s*/i, '').trim();
    
    if (!coverLetter || coverLetter.length < 50) {
      throw new Error('Empty or too short response from Ollama');
    }
    
    return coverLetter;
  } catch (error: any) {
    console.error(`[Ollama] ✗ Error: ${error.message}`);
    
    // Return a better fallback cover letter
    const skills = shortCV.match(/(?:React|Next\.js|Node\.js|Python|FastAPI|JavaScript|TypeScript|Full Stack|Backend|Frontend)/gi)?.slice(0, 3).join(', ') || 'web development';
    
    const fallbackCoverLetter = `Dear Hiring Manager,

I am writing to express my interest in this position. With my experience in ${skills}, I believe I would be a great fit for your team.

${shortCV.substring(0, 150)}...

I am excited about the opportunity to contribute to your organization and would welcome the chance to discuss how my background can benefit your team.

Best regards,
Jima Dube Nuture`;

    console.log('[Ollama] Using fallback cover letter');
    return fallbackCoverLetter;
  }
}

