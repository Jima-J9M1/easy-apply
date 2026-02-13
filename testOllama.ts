// testOllama.ts
import 'dotenv/config';
import { generateCoverLetter } from './ollamaService.js';

async function testOllama() {
  console.log('Testing Ollama connection...\n');
  
  const testCV = `Jima Dube Nuture
Software Engineer
Full Stack Developer with experience in Next.js, FastAPI, Node.js
• Developed scalable backend services
• Built PDF parsing systems with vector databases
• Integrated GraphQL APIs`;

  const testJobDescription = `We are looking for a Full Stack Developer with experience in React and Node.js. 
The ideal candidate should have experience building scalable web applications and working with modern JavaScript frameworks.`;

  try {
    console.log('CV:', testCV);
    console.log('\nJob Description:', testJobDescription);
    console.log('\nGenerating cover letter...\n');
    
    const model = process.env.OLLAMA_MODEL || 'qwen2:7b';
    console.log(`Using model: ${model}`);
    console.log(`Ollama URL: ${process.env.OLLAMA_BASE_URL || 'http://localhost:11434'}\n`);
    
    const coverLetter = await generateCoverLetter(testCV, testJobDescription, model);
    
    console.log('='.repeat(60));
    console.log('SUCCESS! Cover Letter Generated:');
    console.log('='.repeat(60));
    console.log(coverLetter);
    console.log('='.repeat(60));
    
  } catch (error: any) {
    console.error('\n❌ ERROR: Ollama test failed!');
    console.error('Error details:', error.message);
    console.error('\nTroubleshooting tips:');
    console.error('1. Make sure Ollama is running: ollama serve');
    console.error('2. Make sure llama3 model is installed: ollama pull llama3');
    console.error('3. Check if Ollama is accessible at http://localhost:11434');
    process.exit(1);
  }
}

testOllama();

