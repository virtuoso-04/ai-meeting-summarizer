# AI Meeting Summarizer

A professional-grade application for automatically generating summaries from meeting transcripts using AI, with support for email delivery of results.

## Features

- **AI-Powered Summarization**: Leverages Groq's state-of-the-art LLM (Llama3-70b) for high-quality meeting summaries
- **Email Integration**: Send summaries directly via email with professional HTML templates
- **Enterprise-Ready Backend**:
  - Structured logging with Winston
  - Intelligent caching system
  - Rate limiting and security protections
  - Comprehensive error handling
  - Performance monitoring and metrics
- **Clean React Frontend**: Modern, responsive UI built with React and Vite

## Project Structure

```
ai-meeting-summarizer/
│
├── backend/                   # Express.js backend
│   ├── server.js              # Main server file
│   ├── package.json           # Backend dependencies
│   ├── .env                   # Backend environment variables
│   └── utils/                 # Utility modules
│       ├── ai-service.js      # AI service with retry logic
│       ├── cache.js           # Caching utility
│       ├── email-service.js   # Email service with templates
│       └── logger.js          # Structured logging system
│
├── frontend/                  # React frontend
│   ├── index.html             # HTML entry point
│   ├── src/                   # Source code
│   │   ├── App.jsx            # Main application component
│   │   ├── App.css            # Component styles
│   │   ├── main.jsx           # Application entry point
│   │   ├── index.css          # Global styles
│   │   └── assets/            # Static assets
│   ├── public/                # Public assets
│   ├── package.json           # Frontend dependencies
│   └── .env.local             # Frontend environment variables
│
└── package.json               # Root package.json with scripts
```

## Prerequisites

- Node.js (v18+ recommended)
- npm or yarn
- An API key from Groq
- Email account for sending emails

## Setup Instructions

### 1. Clone the repository

```bash
git clone <repository-url>
cd ai-meeting-summarizer
```

### 2. Install dependencies

```bash
npm run install-all
```

### 3. Configure environment variables

#### Backend (.env)

Create a `.env` file in the backend directory with the following variables:

```
# Server Configuration
PORT=5001
NODE_ENV=development

# API Keys
GROQ_API_KEY=your_groq_api_key
ADMIN_API_KEY=your_admin_api_key
METRICS_API_KEY=your_metrics_api_key

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
CACHE_TTL=3600000
RATE_LIMIT_WINDOW=900000
RATE_LIMIT_MAX=100
```

#### Frontend (.env.local)

The frontend/.env.local file should have:

```
VITE_API_BASE_URL=http://localhost:5001
```

### 4. Start the development server

```bash
npm run dev
```

This will start both the backend (http://localhost:5001) and frontend (http://localhost:5173) in development mode.

## Usage

1. **Upload a Transcript:**
   - Paste text directly into the transcript input area
   - Or upload a transcript file (.txt, .md, .doc, .docx, .pdf)
   - System validates file formats and size (10MB limit)

2. **Add Custom Instructions (Optional):**
   - Provide specific instructions for the AI summarization
   - Examples: "Summarize in bullet points for executives" or "Highlight action items only"
   - Custom instructions are limited to 500 characters

3. **Generate Summary:**
   - Click on "Generate Summary" to start the AI summarization process
   - A loading spinner appears while the summary is being generated
   - The system handles timeouts and errors gracefully

4. **Edit Summary:**
   - The generated summary appears in an editable text area
   - Make any necessary adjustments or refinements
   - The summary is validated to prevent empty submissions

5. **Share via Email:**
   - Click "Share via Email"
   - Enter recipient email addresses (comma separated)
   - Customize the email subject and sender name
   - System validates email addresses and provides feedback
   - Click "Send Email" to distribute your summary
   - The form resets after successful submission

## API Endpoints

### Main Endpoints

- **POST /api/generate-summary**
  - Generates a summary from meeting transcript
  - Request body: `{ transcript: string, customPrompt?: string }`
  - Rate limited to 5 requests per 2 minutes
  - Response: `{ summary: string, metadata: object }`

- **POST /api/send-email**
  - Sends summary via email
  - Request body: `{ recipient: string, subject: string, summary: string }`
  - Rate limited to 10 requests per 15 minutes
  - Response: `{ success: boolean, message: string, messageId: string }`

### System Endpoints

- **GET /api/health**
  - System health check with service status
  - Returns uptime, service status, and environment information

- **GET /api/metrics** (Requires authentication)
  - Detailed system metrics
  - Returns performance statistics, request counts, and resource usage

- **POST /api/admin/cache** (Requires authentication)
  - Cache management
  - Actions: `clear`, `stats`

## Building for Production

```bash
npm run build
```

This will create optimized production builds of the frontend in the frontend/dist directory.

## Technologies Used

- **Backend:**
  - Express.js - Web server
  - Groq API - AI summarization (llama3-70b-8192 model)
  - Winston - Structured logging
  - Nodemailer - Email functionality
  - Express Rate Limit - API protection
  - Helmet - Security middleware
  - Compression - Response optimization
  - Memory-Cache - Performance caching
  - Response-Time - Performance monitoring
  - Dotenv - Environment variable management

- **Frontend:**
  - React - UI library
  - Vite - Build tool
  - Modern CSS with variables - Styling
  - Fetch API - HTTP requests

## Performance Optimizations

- **Intelligent Caching**: Similar transcripts use cached results to reduce API calls and improve response times
- **Retry Logic**: Built-in retry mechanism with exponential backoff for API failures
- **Response Compression**: Reduces bandwidth usage and improves response times
- **Memory Management**: Careful resource tracking and garbage collection

## Security Features

- **Helmet Integration**: Sets secure HTTP headers to protect against common web vulnerabilities
- **Rate Limiting**: Tiered rate limits to prevent abuse:
  - General API rate limiting (100 requests per 15 minutes)
  - Summary generation limited to 5 requests per 2 minutes
  - Email sending limited to 10 requests per 15 minutes
  
- **Input Validation:**
  - Thorough validation of all inputs with descriptive error messages
  - Sanitization to prevent XSS attacks
  - Parameter length limits and type checking

- **Error Handling:**
  - Status-code appropriate error responses
  - Detailed logging with redacted sensitive information
  - Timeout handling with graceful degradation
  
- **Data Protection:**
  - No API keys exposed to the frontend
  - TLS for email transmission
  - HTML content sanitization
  - Authentication for admin endpoints

## Monitoring and Logging

- **Structured Logging**: Winston-based logging with levels and metadata
- **Performance Metrics**: Response time tracking and percentile calculations
- **Health Checks**: Comprehensive system status monitoring
- **Error Tracking**: Detailed error logging with stack traces in development

## License

ISC
