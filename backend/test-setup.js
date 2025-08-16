/**
 * AI Meeting Summarizer - Backend Configuration Test
 * 
 * This script tests the configuration and connectivity of backend services
 * including the Groq API and email service. It verifies that all components
 * are properly set up before the application starts.
 */

// Load environment variables
require('dotenv').config();
const Groq = require('groq-sdk');

// Color codes for terminal output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

/**
 * Test Groq API connectivity and configuration
 * Verifies the API key is valid and can make successful API calls
 * @returns {Promise<boolean>} True if connection successful, false otherwise
 */
const testGroq = async () => {
  try {
    if (!process.env.GROQ_API_KEY) {
      console.log(`${colors.yellow}⚠️  GROQ API Key not found in .env file${colors.reset}`);
      return false;
    }
    
    if (process.env.GROQ_API_KEY === 'your_groq_api_key_here') {
      console.log(`${colors.yellow}⚠️  GROQ API Key contains default placeholder value${colors.reset}`);
      return false;
    }

    console.log(`${colors.blue}Testing GROQ API connection...${colors.reset}`);
    const startTime = Date.now();
    
    // Create Groq client and make a test request
    const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
    const response = await groq.chat.completions.create({
      messages: [{ role: 'user', content: 'Hello, are you working correctly? Respond in one sentence.' }],
      model: 'llama3-70b-8192',
      max_tokens: 100,
    });
    
    const responseTime = Date.now() - startTime;
    
    if (!response || !response.choices || !response.choices[0]?.message) {
      throw new Error('Invalid response structure from Groq API');
    }
    
    console.log(`${colors.green}✅ GROQ API connected successfully! (${responseTime}ms)${colors.reset}`);
    console.log(`${colors.cyan}GROQ Response: ${response.choices[0]?.message?.content.slice(0, 60)}...${colors.reset}`);
    return true;
  } catch (error) {
    console.error(`${colors.red}❌ GROQ API Error: ${error.message}${colors.reset}`);
    console.error(`${colors.yellow}This might be due to:
- Invalid API key
- Network connectivity issues
- Rate limiting
- Groq service outage${colors.reset}`);
    return false;
  }
};

/**
 * Test email configuration
 * Verifies email credentials and optionally tests SMTP connection
 * @param {boolean} testConnection Whether to attempt a connection to the SMTP server
 * @returns {Promise<boolean>} True if configuration is valid, false otherwise
 */
const testEmail = async (testConnection = false) => {
  const { EMAIL_HOST, EMAIL_PORT, EMAIL_USER, EMAIL_PASS } = process.env;
  let isValid = true;
  
  // Check if email configuration exists
  if (!EMAIL_HOST || EMAIL_HOST === 'smtp.example.com') {
    console.log(`${colors.yellow}⚠️  Email host not properly configured in .env file${colors.reset}`);
    isValid = false;
  }
  
  if (!EMAIL_PORT) {
    console.log(`${colors.yellow}⚠️  Email port not set in .env file${colors.reset}`);
    isValid = false;
  } else if (isNaN(parseInt(EMAIL_PORT))) {
    console.log(`${colors.red}❌ Email port must be a number${colors.reset}`);
    isValid = false;
  }
  
  if (!EMAIL_USER || EMAIL_USER === 'your_email@example.com') {
    console.log(`${colors.yellow}⚠️  Email user not properly configured in .env file${colors.reset}`);
    isValid = false;
  }
  
  if (!EMAIL_PASS) {
    console.log(`${colors.yellow}⚠️  Email password not set in .env file${colors.reset}`);
    isValid = false;
  }

  // Display configuration status
  console.log(`${colors.blue}Email Configuration:${colors.reset}`);
  console.log(`- Host: ${EMAIL_HOST || 'Not configured'} ${!EMAIL_HOST ? colors.red + '❌' + colors.reset : ''}`);
  console.log(`- Port: ${EMAIL_PORT || 'Not configured'} ${!EMAIL_PORT ? colors.red + '❌' + colors.reset : ''}`);
  console.log(`- User: ${EMAIL_USER || 'Not configured'} ${!EMAIL_USER ? colors.red + '❌' + colors.reset : ''}`);
  console.log(`- Password: ${EMAIL_PASS ? colors.green + '✅ Configured' + colors.reset : colors.red + '❌ Missing' + colors.reset}`);
  
  // Test SMTP connection if requested and if basic config is valid
  if (testConnection && isValid) {
    try {
      const nodemailer = require('nodemailer');
      console.log(`${colors.blue}Testing SMTP connection...${colors.reset}`);
      
      const transporter = nodemailer.createTransport({
        host: EMAIL_HOST,
        port: parseInt(EMAIL_PORT, 10),
        secure: parseInt(EMAIL_PORT, 10) === 465,
        auth: {
          user: EMAIL_USER,
          pass: EMAIL_PASS,
        },
        tls: {
          rejectUnauthorized: true,
          minVersion: 'TLSv1.2'
        }
      });
      
      // Verify connection configuration
      await transporter.verify();
      console.log(`${colors.green}✅ SMTP server connection successful!${colors.reset}`);
      return true;
    } catch (error) {
      console.error(`${colors.red}❌ SMTP Connection Error: ${error.message}${colors.reset}`);
      console.error(`${colors.yellow}This might be due to:
- Incorrect credentials
- Firewall/network issues
- Incorrect port/security settings
- The email provider blocking programmatic access${colors.reset}`);
      return false;
    }
  }
  
  return isValid;
};

/**
 * Test the application's environment variables and network connectivity
 * @param {Object} options - Test options
 * @param {boolean} options.testEmailConnection - Whether to test SMTP connection
 * @returns {Promise<Object>} Test results object
 */
const runTests = async (options = { testEmailConnection: false }) => {
  const results = {
    groqApi: false,
    email: false,
    systemInfo: {
      nodeVersion: process.version,
      platform: process.platform,
      arch: process.arch,
      memoryUsage: process.memoryUsage().heapUsed / 1024 / 1024
    }
  };
  
  // Display header
  const now = new Date();
  console.log(`\n${colors.bright}${colors.cyan}=====================================================${colors.reset}`);
  console.log(`${colors.bright}${colors.cyan}🔍 AI Meeting Summarizer - Backend Configuration Test${colors.reset}`);
  console.log(`${colors.cyan}=====================================================`);
  console.log(`${colors.yellow}Date: ${now.toLocaleDateString()} ${now.toLocaleTimeString()}${colors.reset}`);
  console.log(`${colors.yellow}Node: ${process.version} | ${process.platform} | ${process.arch}${colors.reset}\n`);
  
  // Test Groq API
  console.log(`${colors.bright}${colors.magenta}[1/2] Testing Groq API Configuration${colors.reset}`);
  results.groqApi = await testGroq();
  
  console.log(`\n${colors.cyan}-------------------------------------------------${colors.reset}\n`);
  
  // Test Email
  console.log(`${colors.bright}${colors.magenta}[2/2] Testing Email Configuration${colors.reset}`);
  results.email = await testEmail(options.testEmailConnection);
  
  // Summary
  console.log(`\n${colors.bright}${colors.cyan}=====================================================`);
  console.log(`${colors.bright}${colors.cyan}🧪 Test Results${colors.reset}`);
  console.log(`${colors.cyan}=====================================================`);
  console.log(`${colors.bright}Groq API: ${results.groqApi ? colors.green + '✅ PASS' : colors.red + '❌ FAIL'}${colors.reset}`);
  console.log(`${colors.bright}Email Config: ${results.email ? colors.green + '✅ PASS' : colors.red + '❌ FAIL'}${colors.reset}`);
  console.log(`${colors.cyan}=====================================================\n`);
  
  // Show advice if any tests failed
  if (!results.groqApi || !results.email) {
    console.log(`${colors.yellow}ℹ️  Action Required:${colors.reset}`);
    
    if (!results.groqApi) {
      console.log(`${colors.yellow}- Set GROQ_API_KEY in .env file with your API key from https://console.groq.com${colors.reset}`);
    }
    
    if (!results.email) {
      console.log(`${colors.yellow}- Update email settings in .env file with your SMTP credentials${colors.reset}`);
      console.log(`${colors.yellow}- For Gmail, you may need to create an App Password: https://myaccount.google.com/apppasswords${colors.reset}`);
    }
    
    console.log();
  }
  
  return results;
};

// Handle command-line arguments
const args = process.argv.slice(2);
const testEmailConn = args.includes('--test-email-conn');

// Run tests and handle exit code
runTests({ testEmailConnection: testEmailConn })
  .then(results => {
    // Exit with error code if any critical tests fail
    if (!results.groqApi) {
      console.log(`${colors.yellow}Warning: Exiting with code 1 due to failed tests${colors.reset}\n`);
      process.exit(1);
    }
    // Email config might be optional, so don't fail the process for it
  })
  .catch(error => {
    console.error(`${colors.red}Unexpected error during tests: ${error.message}${colors.reset}`);
    process.exit(1);
  });
