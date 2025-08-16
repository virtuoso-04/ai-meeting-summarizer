# AI Meeting Summarizer

An AI-powered application to summarize meeting transcripts and share them via email.

## Features

- Upload text transcripts (meeting notes, call transcripts, etc.)
- Add custom instructions for the AI summarization
- Generate structured summaries based on your preferences
- Edit the generated summaries
- Share summaries via email

## Project Structure

```
ai-meeting-summarizer/
├── backend/                # Express.js backend
│   ├── server.js           # Main server file
│   ├── package.json
│   └── .env                # Backend environment variables
├── frontend/               # React.js frontend
│   ├── src/
│   │   ├── App.jsx         # Main React component
│   │   ├── App.css         # Styles
│   │   ├── main.jsx        # React entry point
│   │   └── index.css       # Global styles
│   ├── package.json
│   └── .env.local          # Frontend environment variables
└── package.json            # Root package.json with scripts
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

Update the backend/.env file:

```
GROQ_API_KEY=your_groq_api_key_here

EMAIL_HOST=smtp.example.com
EMAIL_PORT=587
EMAIL_USER=your_email@example.com
EMAIL_PASS=your_email_password
```

#### Frontend (.env.local)

The frontend/.env.local file should have:

```
VITE_API_BASE_URL=http://localhost:5000
```

### 4. Start the development server

```bash
npm run dev
```

This will start both the backend (http://localhost:5000) and frontend (http://localhost:5173) in development mode.

## Usage

1. **Upload a Transcript:**
   - Paste text directly into the transcript input area
   - Or upload a transcript file (.txt, .md, .doc, .docx, .pdf)

2. **Add Custom Instructions (Optional):**
   - Provide specific instructions for the AI summarization
   - Examples: "Summarize in bullet points for executives" or "Highlight action items only"

3. **Generate Summary:**
   - Click on "Generate Summary" to start the AI summarization process

4. **Edit Summary:**
   - The generated summary appears in an editable text area
   - Make any necessary adjustments or refinements

5. **Share via Email:**
   - Click "Share via Email"
   - Enter recipient email addresses (comma separated)
   - Customize the email subject and sender name if needed
   - Click "Send Email"

## Building for Production

```bash
npm run build
```

This will create optimized production builds of the frontend in the frontend/dist directory.

## Technologies Used

- **Backend:**
  - Express.js - Web server
  - Groq API - AI summarization
  - Nodemailer - Email functionality

- **Frontend:**
  - React - UI library
  - Vite - Build tool
  - Axios - HTTP client

## License

ISC
