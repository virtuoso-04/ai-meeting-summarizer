#!/usr/bin/env node
/**
 * Pre-startup script to check for required dependencies and environment variables
 */

const fs = require('fs');
const path = require('path');
const chalk = require('chalk'); // For colorful terminal output

// Define paths
const rootDir = path.resolve(__dirname, '..');
const backendEnvPath = path.join(rootDir, 'backend', '.env');
const frontendEnvPath = path.join(rootDir, 'frontend', '.env.local');

console.log(chalk.cyan('=== AI Meeting Summarizer Pre-startup Check ==='));

// Check backend .env
console.log(chalk.yellow('\nChecking backend configuration:'));
try {
  if (fs.existsSync(backendEnvPath)) {
    const backendEnvContent = fs.readFileSync(backendEnvPath, 'utf8');
    
    // Check for required keys
    const requiredKeys = [
      { key: 'GROQ_API_KEY', default: 'your_groq_api_key_here' },
      { key: 'EMAIL_HOST', default: 'smtp.example.com' },
      { key: 'EMAIL_PORT', default: '' },
      { key: 'EMAIL_USER', default: 'your_email@example.com' },
      { key: 'EMAIL_PASS', default: 'your_email_password' }
    ];
    
    let missingKeys = [];
    let defaultKeys = [];
    
    requiredKeys.forEach(({ key, default: defaultValue }) => {
      const keyRegex = new RegExp(`${key}=(.+)(?:\\r?\\n|$)`);
      const match = backendEnvContent.match(keyRegex);
      
      if (!match) {
        missingKeys.push(key);
      } else if (match[1] === defaultValue) {
        defaultKeys.push(key);
      }
    });
    
    // Report findings
    if (missingKeys.length > 0) {
      console.log(chalk.red(`✗ Missing required keys: ${missingKeys.join(', ')}`));
    }
    
    if (defaultKeys.length > 0) {
      console.log(chalk.yellow(`⚠ Using default values for: ${defaultKeys.join(', ')}`));
    }
    
    // Check if Groq API key is valid
    if (!defaultKeys.includes('GROQ_API_KEY')) {
      console.log(chalk.green('✓ Groq API key appears to be set'));
    } else {
      console.log(chalk.red('✗ No valid Groq API key found. Set GROQ_API_KEY in .env file'));
    }
    
    // Check email settings
    if (!defaultKeys.includes('EMAIL_HOST') && !defaultKeys.includes('EMAIL_USER') && !defaultKeys.includes('EMAIL_PASS')) {
      console.log(chalk.green('✓ Email configuration appears to be set'));
    } else {
      console.log(chalk.yellow('⚠ Email configuration not properly set. Email sharing will not work.'));
    }
  } else {
    console.log(chalk.red(`✗ Backend .env file not found at ${backendEnvPath}`));
  }
} catch (error) {
  console.log(chalk.red(`✗ Error reading backend .env: ${error.message}`));
}

// Check frontend .env.local
console.log(chalk.yellow('\nChecking frontend configuration:'));
try {
  if (fs.existsSync(frontendEnvPath)) {
    const frontendEnvContent = fs.readFileSync(frontendEnvPath, 'utf8');
    
    // Check for API_BASE_URL
    const apiBaseUrlRegex = /VITE_API_BASE_URL=(.+)(?:\r?\n|$)/;
    const match = frontendEnvContent.match(apiBaseUrlRegex);
    
    if (match) {
      console.log(chalk.green(`✓ API base URL is set to: ${match[1]}`));
    } else {
      console.log(chalk.red('✗ VITE_API_BASE_URL is missing in frontend .env.local'));
    }
  } else {
    console.log(chalk.red(`✗ Frontend .env.local file not found at ${frontendEnvPath}`));
  }
} catch (error) {
  console.log(chalk.red(`✗ Error reading frontend .env.local: ${error.message}`));
}

// Check package dependencies
console.log(chalk.yellow('\nChecking required dependencies:'));
try {
  const packageLockPath = path.join(rootDir, 'package-lock.json');
  const backendPackageJsonPath = path.join(rootDir, 'backend', 'package.json');
  const frontendPackageJsonPath = path.join(rootDir, 'frontend', 'package.json');
  
  if (!fs.existsSync(packageLockPath)) {
    console.log(chalk.yellow('⚠ package-lock.json not found. Dependencies may not be installed.'));
    console.log(chalk.yellow('  Run "npm run install-all" to install dependencies.'));
  } else {
    console.log(chalk.green('✓ Dependencies appear to be installed'));
  }
  
  // Check for backend package.json
  if (fs.existsSync(backendPackageJsonPath)) {
    const backendPackageJson = require(backendPackageJsonPath);
    const requiredBackendDeps = ['express', 'cors', 'nodemailer', 'groq-sdk'];
    
    const missingBackendDeps = requiredBackendDeps.filter(dep => !backendPackageJson.dependencies[dep]);
    
    if (missingBackendDeps.length > 0) {
      console.log(chalk.red(`✗ Missing backend dependencies: ${missingBackendDeps.join(', ')}`));
    } else {
      console.log(chalk.green('✓ All required backend dependencies are installed'));
    }
  } else {
    console.log(chalk.red('✗ Backend package.json not found'));
  }
  
  // Check for frontend package.json
  if (fs.existsSync(frontendPackageJsonPath)) {
    const frontendPackageJson = require(frontendPackageJsonPath);
    const requiredFrontendDeps = ['react', 'react-dom'];
    
    const missingFrontendDeps = requiredFrontendDeps.filter(dep => !frontendPackageJson.dependencies[dep]);
    
    if (missingFrontendDeps.length > 0) {
      console.log(chalk.red(`✗ Missing frontend dependencies: ${missingFrontendDeps.join(', ')}`));
    } else {
      console.log(chalk.green('✓ All required frontend dependencies are installed'));
    }
  } else {
    console.log(chalk.red('✗ Frontend package.json not found'));
  }
} catch (error) {
  console.log(chalk.red(`✗ Error checking dependencies: ${error.message}`));
}

console.log(chalk.cyan('\n=== Check Complete ==='));
