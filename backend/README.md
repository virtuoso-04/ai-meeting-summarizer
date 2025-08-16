# AI Meeting Summarizer - Backend

This directory contains the Express.js backend server for the AI Meeting Summarizer application, providing AI integration, file processing, and email delivery services.

## 📋 Overview

The backend handles:
- Processing meeting transcript files and text
- Interacting with the Groq AI API for summarization
- Sending formatted emails with summary content
- Providing metrics and health monitoring
- Implementing security and rate limiting

## 🛠️ Technology Stack

- **Express.js** - Web server framework
- **Groq API** - AI service for generating summaries
- **Winston** - Structured logging system
- **Nodemailer** - Email composition and delivery
- **Multer** - File upload handling
- **Express Rate Limit** - API protection
- **Helmet** - Security middleware
- **Compression** - Response optimization

## 📁 Directory Structure

```
backend/
├── server.js            # Main application server
├── package.json         # Dependencies and scripts
└── utils/               # Utility modules
    ├── ai-service.js    # AI service integration
    ├── file-processing.js # File handling utilities
    ├── email-service.js # Email delivery service
    ├── cache.js         # Caching implementation
    └── logger.js        # Logging configuration
```

## 🚀 Development

### Environment Setup

Create a `.env` file with:
```
# Server Configuration
PORT=5001
NODE_ENV=development

# API Keys
GROQ_API_KEY=your_groq_api_key

# AI Configuration
GROQ_MODEL=llama3-70b-8192
AI_MAX_RETRIES=2
AI_TIMEOUT=30000

# Email Configuration
EMAIL_HOST=smtp.example.com
EMAIL_PORT=587
EMAIL_USER=your_email_user
EMAIL_PASS=your_email_password
EMAIL_FROM=ai-summarizer@example.com

# Security and Performance
RATE_LIMIT_WINDOW=900000
RATE_LIMIT_MAX=100
```

### Available Scripts

```bash
# Start development server
npm run dev

# Start production server
npm start

# Run tests
npm test
```

## 📊 API Endpoints

### Summary Generation
`POST /api/generate-summary`
- Generates an AI summary from meeting transcript
- Rate limited to protect the API

### File Upload
`POST /api/upload-transcript`
- Processes uploaded transcript files
- Extracts text content for summarization

### Email Sending
`POST /api/send-email`
- Distributes summaries via email
- Validates recipients and applies rate limits

### System Management
`GET /api/health`
- System health and status information

`GET /api/metrics`
- Detailed performance metrics

## ⚙️ Core Components

### AI Service (`ai-service.js`)
- Interacts with Groq API for AI summarization
- Implements retry logic with exponential backoff
- Constructs optimized prompts for high-quality summaries
- Manages model parameters and API timeouts

### File Processing (`file-processing.js`)
- Handles uploaded transcript files
- Supports multiple file formats (.txt, .md, .json, .csv, .html)
- Implements secure filename handling
- Provides text extraction and sanitization

### Email Service (`email-service.js`)
- Sends professional HTML emails with summary content
- Validates recipient addresses
- Implements templating for consistent formatting
- Handles email delivery errors

### Logging System (`logger.js`)
- Configures Winston for structured logging
- Implements different log levels (debug, info, warn, error)
- Formats log output for readability and analysis

## 🔒 Security Features

- **Rate Limiting** - Prevents API abuse
- **Input Validation** - Validates and sanitizes all inputs
- **Error Handling** - Secure error messages
- **File Validation** - Size limits and type checking

---

For more information about the complete project, see the [main README](../README.md).
