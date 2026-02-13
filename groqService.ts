// groqService.ts
// Dynamic import for CommonJS module in ESM
let Groq: any;
let groq: any;

async function getGroqClient() {
  if (!Groq) {
    const groqModule = await import('groq-sdk');
    Groq = groqModule.default || groqModule.Groq || groqModule;
  }
  if (!groq && process.env.GROQ_API_KEY) {
    groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
  }
  return groq;
}

const DEFAULT_MODEL = 'llama-3.1-8b-instant'; // Fast free model
const MAX_CV_LENGTH = 1000;
const MAX_JOB_DESC_LENGTH = 800;

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

export async function generateCoverLetter(
  cvText: string,
  jobDescription: string,
  model: string = DEFAULT_MODEL
): Promise<string> {
  // Extract only key information
  const shortCV = extractKeyInfo(cvText, MAX_CV_LENGTH);
  const shortJobDesc = extractKeyInfo(jobDescription, MAX_JOB_DESC_LENGTH);
  
  const systemPrompt = 'You are a professional cover letter writer. Write ONLY the cover letter body text starting directly with the greeting. Do NOT include any addresses, dates, headers, sender information, or placeholders. Start immediately with "Dear Hiring Manager," and end with the candidate\'s signature. Use the candidate\'s actual name from the CV provided.';
  
  const userPrompt = `Write a professional cover letter for this job position. 

CRITICAL REQUIREMENTS:
- Start IMMEDIATELY with "Dear Hiring Manager," (no addresses, dates, or headers above)
- Use the candidate's actual name from the CV: ${shortCV.split('\n')[0] || 'the candidate'}
- Do NOT include sender address, recipient address, date, or any header information
- Do NOT use placeholders like [Your Name], [Company Name], [Date], [Address]
- Write 3-4 paragraphs of content
- End with "Best regards," or "Sincerely," followed by the candidate's name
- Output ONLY the letter body from greeting to signature

Job Description:
${shortJobDesc}

Candidate Background:
${shortCV}

Cover Letter (greeting to signature only, no addresses or dates):`;

  console.log(`[Groq] Generating cover letter with model: ${model} (CV: ${shortCV.length} chars, Job: ${shortJobDesc.length} chars)`);

  try {
    if (!process.env.GROQ_API_KEY) {
      throw new Error('GROQ_API_KEY is not set in environment variables');
    }

    // Get Groq client (will initialize if needed)
    const client = await getGroqClient();
    if (!client) {
      throw new Error('Failed to initialize Groq client');
    }

    const chatCompletion = await client.chat.completions.create({
      messages: [
        {
          role: 'system',
          content: systemPrompt
        },
        {
          role: 'user',
          content: userPrompt
        }
      ],
      model: model,
      temperature: 0.7,
      max_tokens: 500, // Limit response length
    });

    const coverLetter = chatCompletion.choices[0]?.message?.content || '';
    
    if (!coverLetter || coverLetter.trim().length < 50) {
      throw new Error('Empty or too short response from Groq');
    }

    // Clean up the response - extract only the letter body from greeting to signature
    let cleaned = coverLetter.trim();
    
    // Remove introductory phrases
    cleaned = cleaned.replace(/^Here is.*?:\s*/i, '');
    cleaned = cleaned.replace(/^Cover letter:\s*/i, '');
    
    // Find where the actual letter starts (look for "Dear")
    const dearMatch = cleaned.match(/(Dear\s+[^,\n]+(?:,|$))/i);
    if (dearMatch) {
      const startIndex = cleaned.indexOf(dearMatch[0]);
      cleaned = cleaned.substring(startIndex);
    } else if (!cleaned.match(/^Dear\s+/i)) {
      // If no "Dear" found, try to find the first paragraph
      const firstPara = cleaned.match(/([A-Z][^.!?]*[.!?])/);
      if (firstPara && firstPara.index !== undefined) {
        cleaned = 'Dear Hiring Manager,\n\n' + cleaned.substring(firstPara.index);
      } else {
        cleaned = 'Dear Hiring Manager,\n\n' + cleaned;
      }
    }
    
    // Remove all placeholder patterns
    const placeholderPatterns = [
      /\[Your Name\]/gi, /\[Name\]/gi,
      /\[Your Address\]/gi, /\[Address\]/gi,
      /\[City, State ZIP Code\]/gi, /\[City.*?\]/gi,
      /\[Date\]/gi,
      /\[Hiring Manager's Name\]/gi, /\[Hiring Manager\]/gi,
      /\[Company Name\]/gi, /\[Company\]/gi,
      /\[Company Address\]/gi,
    ];
    
    placeholderPatterns.forEach(pattern => {
      cleaned = cleaned.replace(pattern, '');
    });
    
    // Remove lines that are addresses, dates, or headers (before "Dear")
    const lines = cleaned.split('\n');
    let startIndex = 0;
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      // If we find "Dear", start from here
      if (/^Dear\s+/i.test(line)) {
        startIndex = i;
        break;
      }
      // Skip address-like lines
      if (/^\d+\s+[A-Z]|^[A-Z][a-z]+\s+(Street|Avenue|Road|Drive|Lane|Boulevard)|^P\.O\.\s+Box/i.test(line)) {
        continue;
      }
      // Skip date-only lines
      if (/^(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},?\s+\d{4}$/i.test(line)) {
        continue;
      }
      // Skip empty lines at the start
      if (line === '') {
        continue;
      }
    }
    
    cleaned = lines.slice(startIndex).join('\n');
    
    // Remove multiple consecutive empty lines
    cleaned = cleaned.replace(/\n\s*\n\s*\n+/g, '\n\n');
    
    cleaned = cleaned.trim();

    console.log(`[Groq] ✓ Cover letter generated (${cleaned.length} chars)`);
    return cleaned;
  } catch (error: any) {
    console.error(`[Groq] ✗ Error: ${error.message}`);
    
    // Return a fallback cover letter
    const skills = shortCV.match(/(?:React|Next\.js|Node\.js|Python|FastAPI|JavaScript|TypeScript|Full Stack|Backend|Frontend)/gi)?.slice(0, 3).join(', ') || 'web development';
    
    const fallbackCoverLetter = `Dear Hiring Manager,

I am writing to express my interest in this position. With my experience in ${skills}, I believe I would be a great fit for your team.

${shortCV.substring(0, 200)}...

I am excited about the opportunity to contribute to your organization and would welcome the chance to discuss how my background can benefit your team.

Best regards,
Jima Dube Nuture`;

    console.log('[Groq] Using fallback cover letter');
    return fallbackCoverLetter;
  }
}

