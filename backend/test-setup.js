require('dotenv').config();
const Groq = require('groq-sdk');

// Test GROQ setup
const testGroq = async () => {
  try {
    if (!process.env.GROQ_API_KEY || process.env.GROQ_API_KEY === 'your_groq_api_key_here') {
      console.log('⚠️  GROQ API Key not configured in .env file');
      return;
    }

    console.log('Testing GROQ connection...');
    const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
    const response = await groq.chat.completions.create({
      messages: [{ role: 'user', content: 'Hello, are you working correctly?' }],
      model: 'llama3-70b-8192',
    });

    console.log('✅ GROQ API connected successfully!');
    console.log(`GROQ Response: ${response.choices[0]?.message?.content.slice(0, 50)}...`);
  } catch (error) {
    console.error('❌ GROQ API Error:', error.message);
    console.error('This might be due to an invalid API key or network issues.');
  }
};

// Test Email setup
const testEmail = () => {
  const { EMAIL_HOST, EMAIL_PORT, EMAIL_USER, EMAIL_PASS } = process.env;
  
  if (!EMAIL_HOST || EMAIL_HOST === 'smtp.example.com') {
    console.log('⚠️  Email configuration not set in .env file');
    return;
  }

  console.log('Email Configuration:');
  console.log(`- Host: ${EMAIL_HOST}`);
  console.log(`- Port: ${EMAIL_PORT}`);
  console.log(`- User: ${EMAIL_USER}`);
  console.log(`- Password: ${EMAIL_PASS ? '✅ Configured' : '❌ Missing'}`);
};

// Run tests
const runTests = async () => {
  console.log('🔍 Testing backend configuration...');
  console.log('=================================');
  
  await testGroq();
  console.log('---------------------------------');
  
  testEmail();
  console.log('=================================');
  console.log('ℹ️  Remember to update your .env file with proper Groq API key and email settings');
};

runTests();
