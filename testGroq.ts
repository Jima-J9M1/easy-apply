// testGroq.ts
import 'dotenv/config';
import { generateCoverLetter } from './groqService.js';

async function testGroq() {
  console.log('Testing Groq connection...\n');
  
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
    
    if (!process.env.GROQ_API_KEY) {
      throw new Error('GROQ_API_KEY is not set in environment variables');
    }
    
    const model = process.env.GROQ_MODEL || 'llama-3.1-8b-instant';
    console.log(`Using model: ${model}`);
    console.log(`Groq API Key: ${process.env.GROQ_API_KEY.substring(0, 10)}...\n`);
    
    const coverLetter = await generateCoverLetter(testCV, testJobDescription, model);
    
    console.log('='.repeat(60));
    console.log('SUCCESS! Cover Letter Generated:');
    console.log('='.repeat(60));
    console.log(coverLetter);
    console.log('='.repeat(60));
    
  } catch (error: any) {
    console.error('\n❌ ERROR: Groq test failed!');
    console.error('Error details:', error.message);
    console.error('\nTroubleshooting tips:');
    console.error('1. Make sure GROQ_API_KEY is set in your .env file');
    console.error('2. Get your API key from: https://console.groq.com/');
    console.error('3. Check if the model name is correct');
    process.exit(1);
  }
}

testGroq();







