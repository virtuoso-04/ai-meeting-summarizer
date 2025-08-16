# AI Meeting Summarizer

[![Node.js Version](https://img.shields.io/badge/node-%3E%3D%2018.0.0-brightgreen.svg)](https://nodejs.org/)
[![License: ISC](https://img.shields.io/badge/License-ISC-blue.svg)](https://opensource.org/licenses/ISC)

A professional-grade application for automatically generating Markdown-formatted summaries from meeting transcripts using AI, with support for customizable outputs and email delivery capabilities.

![AI Meeting Summarizer Screenshot](https://via.placeholder.com/800x450?text=AI+Meeting+Summarizer+Screenshot)

## ✨ Features

- **AI-Powered Summarization**
  - Leverages Groq's state-of-the-art LLM (Llama3-70b) for high-quality meeting summaries
  - Custom instructions to tailor summary format and content to your needs
  - Markdown-formatted output with proper structure and formatting

- **Document Processing**
  - Support for multiple file formats (.txt, .md, .json, .csv, .html)
  - Intelligent text extraction and preprocessing
  - File size validation and secure upload handling

- **Modern User Experience**
  - Clean React frontend with responsive design
  - Real-time Markdown preview with syntax highlighting
  - Edit/Preview toggle for summary refinement
  - Seamless file uploads with drag-and-drop support

- **Distribution Options**
  - Email sharing with professional HTML templates
  - Download summaries as Markdown files
  - Copy to clipboard functionality

- **Enterprise-Ready Backend**
  - Structured logging with Winston
  - Intelligent caching system
  - Rate limiting and security protections
  - Comprehensive error handling
  - Performance monitoring and metrics

## 🚀 Quick Start

### Prerequisites

- Node.js (v18+ recommended)
- npm or yarn
- Groq API key
- SMTP email account (for email functionality)

### Installation

1. **Clone the repository**

```bash
git clone https://github.com/virtuoso-04/ai-meeting-summarizer.git
cd ai-meeting-summarizer
```

2. **Install dependencies**

```bash
# Install both frontend and backend dependencies
npm run install-all

# Or install them separately
cd backend && npm install
cd ../frontend && npm install
```

## 🏗️ Project Structure

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
│       ├── file-processing.js # File handling utilities
│       └── logger.js          # Structured logging system
│
├── frontend/                  # React frontend
│   ├── index.html             # HTML entry point
│   ├── src/                   # Source code
│   │   ├── App.jsx            # Main application component
│   │   ├── App.css            # Component styles
│   │   ├── main.jsx           # Application entry point
│   │   ├── index.css          # Global styles
│   │   ├── utils.js           # Frontend utility functions
│   │   └── assets/            # Static assets
│   ├── public/                # Public assets
│   ├── package.json           # Frontend dependencies
│   └── .env.local             # Frontend environment variables
│
└── package.json               # Root package.json with scripts
```

## 🔧 Configuration

### 3. Configure environment variables

#### Backend (.env)

Create a `.env` file in the backend directory with the following variables:

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

#### Frontend (.env.local)

Create a `.env.local` file in the frontend directory:

```
VITE_API_BASE_URL=http://localhost:5001
```

### 4. Start the development server

```bash
# Start both frontend and backend
npm run dev

# Or start them separately
cd backend && npm run dev
cd ../frontend && npm run dev
```

This will start both the backend (http://localhost:5001) and frontend (http://localhost:5173) in development mode.

## 📋 Usage

1. **Upload a Transcript**
   - Paste text directly into the transcript input area
   - Or upload a transcript file (.txt, .md, .json, .csv, .html)
   - System validates file formats and size (10MB limit)

2. **Add Custom Instructions (Optional)**
   - Provide specific instructions for the AI summarization
   - Examples: "Summarize in bullet points for executives" or "Highlight action items only"
   - Customize the output format to match your exact needs

3. **Generate Summary**
   - Click on "Generate Summary" to start the AI summarization process
   - A loading spinner appears while the summary is being generated
   - The system handles timeouts and errors gracefully with appropriate feedback

4. **Edit and Preview**
   - Toggle between Edit and Preview modes to see the final Markdown rendering
   - Make any necessary adjustments or refinements to the summary
   - Markdown syntax is rendered with syntax highlighting for code blocks

5. **Share or Download**
   - Share via Email: Send to multiple recipients with custom subject and sender name
   - Download as Markdown: Save the summary as a .md file for future reference
   - All operations include validation and user feedback for smooth experience

## 🔌 API Reference

### Summary Generation

```http
POST /api/generate-summary
Content-Type: application/json

{
  "transcript": "Meeting transcript text...",
  "customPrompt": "Optional custom instructions"
}
```

Response:

```json
{
  "summary": "# Meeting Summary\n\n## Key Points\n\n- First point...",
  "metadata": {
    "service": "Groq",
    "model": "llama3-70b-8192",
    "timestamp": "2025-08-16T12:34:56.789Z",
    "transcriptLength": 1500,
    "summaryLength": 500,
    "processingTimeMs": 2345
  }
}
```

### File Upload

```http
POST /api/upload-transcript
Content-Type: multipart/form-data

file: [File Object]
```

Response:

```json
{
  "text": "Extracted transcript text...",
  "charCount": 1500,
  "fileName": "meeting-2025-08-16.txt"
}
```

### Email Sharing

```http
POST /api/send-email
Content-Type: application/json

{
  "recipients": ["user@example.com"],
  "subject": "Meeting Summary",
  "summary": "# Meeting Summary\n\n## Key Points...",
  "senderName": "Meeting Summarizer"
}
```

Response:

```json
{
  "success": true,
  "message": "Email sent successfully",
  "messageId": "<abc123@example.com>"
}
```

### System Endpoints

- **GET /api/health**
  - System health check with service status
  - Returns uptime, service status, and environment information

- **GET /api/metrics**
  - Detailed system metrics
  - Returns performance statistics, request counts, and resource usage

## 🚀 Building for Production

```bash
# Build frontend
cd frontend && npm run build

# Start production server
cd backend && npm start
```

This will create optimized production builds of the frontend in the `frontend/dist` directory and start the server in production mode.

## 🛠️ Technologies Used

- **Backend:**
  - **Express.js** - Fast, unopinionated web framework
  - **Groq API** - High-performance AI summarization (llama3-70b-8192 model)
  - **Winston** - Structured logging with multiple transports
  - **Nodemailer** - Email composition and delivery
  - **Express Rate Limit** - API protection against abuse
  - **Helmet** - Security middleware for HTTP headers
  - **Compression** - Response optimization for faster delivery
  - **Memory-Cache** - Performance caching layer
  - **Response-Time** - Performance monitoring for requests
  - **Dotenv** - Environment variable management
  - **Multer** - File upload handling and processing

- **Frontend:**
  - **React** - Component-based UI library
  - **Vite** - Next-generation frontend build tool
  - **React-Markdown** - Markdown rendering with plugins
  - **Remark-GFM** - GitHub Flavored Markdown support
  - **React-Syntax-Highlighter** - Code block highlighting
  - **Modern CSS** - CSS variables and responsive design
  - **Fetch API** - Promise-based HTTP client

## ⚡ Performance Optimizations

- **Intelligent Caching System**
  - Similar transcripts use cached results to reduce API calls
  - Configurable TTL for different content types
  - Memory-efficient storage with LRU eviction policy

- **AI Service Optimizations**
  - Built-in retry mechanism with exponential backoff for API failures
  - Automatic timeout handling for long-running requests
  - Streaming responses for better user experience with large outputs

- **Network and Delivery Optimizations**
  - Response compression to reduce bandwidth usage
  - Conditional requests with ETag support
  - Optimized asset delivery with appropriate caching headers

## 🔒 Security Features

- **API Protection**
  - Helmet integration for secure HTTP headers
  - Tiered rate limiting to prevent abuse:
    - General API: 100 requests per 15 minutes
    - Summary generation: 5 requests per 2 minutes
    - Email sending: 10 requests per 15 minutes
  
- **Data Validation**
  - Comprehensive input validation with descriptive error messages
  - Content sanitization to prevent XSS attacks
  - Parameter length limits and type checking for all inputs
  
- **Error Handling & Logging**
  - Status-appropriate error responses
  - Detailed logging with sensitive information redaction
  - Graceful degradation with helpful user feedback
  
- **Privacy & Data Protection**
  - No API keys exposed to the client
  - Secure email transmission with TLS
  - HTML content sanitization for email templates

## 📊 Monitoring & Logging

- **Structured Logging**
  - Winston-based logging system with multiple transports
  - Log levels (debug, info, warn, error) for appropriate filtering
  - Request correlation IDs for tracing complete request flows
  
- **Performance Metrics**
  - Response time tracking with percentiles
  - AI service performance monitoring
  - Resource utilization tracking
  
- **System Health**
  - Comprehensive health check endpoint
  - Real-time service status monitoring
  - Automatic error reporting and notification

## 📝 License

This project is licensed under the [ISC License](LICENSE).

---

## 👥 Contributors

- [Virtuoso-04](https://github.com/virtuoso-04) - Project Lead & Developer

## 📞 Support

For support or questions, please [open an issue](https://github.com/virtuoso-04/ai-meeting-summarizer/issues) on our GitHub repository.

---

*Last Updated: August 16, 2025*
