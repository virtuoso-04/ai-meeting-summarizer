# AI Meeting Summarizer - Frontend

This directory contains the React frontend for the AI Meeting Summarizer application, built with Vite for optimal development experience and performance.

## 📋 Overview

The frontend provides a responsive user interface for:
- Uploading and editing meeting transcripts
- Adding custom instructions for AI summarization
- Viewing and editing Markdown-formatted summaries
- Sharing summaries via email
- Downloading summaries as Markdown files

## 🛠️ Technology Stack

- **React** - Component-based UI library
- **Vite** - Fast build tool with HMR support
- **React-Markdown** - Markdown rendering with plugins
- **Remark-GFM** - GitHub Flavored Markdown support
- **React-Syntax-Highlighter** - Code block syntax highlighting
- **CSS Variables** - For theming and responsive design
- **Fetch API** - For backend communication

## 📁 Directory Structure

```
src/
├── App.jsx        # Main application component
├── App.css        # Component-specific styles
├── main.jsx       # Application entry point
├── index.css      # Global styles
├── utils.js       # Utility functions
└── assets/        # Static assets like images
```

## 🚀 Development

### Environment Setup

Create a `.env.local` file with:
```
VITE_API_BASE_URL=http://localhost:5001
```

### Available Scripts

```bash
# Start development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview

# Run linting
npm run lint
```

### Key Features

1. **Responsive Design**
   - Mobile-friendly layout with adaptive components
   - Accessible form controls and error states

2. **Markdown Integration**
   - Live preview with syntax highlighting
   - GitHub-flavored Markdown support
   - Edit/Preview toggle functionality

3. **Form Validation**
   - Input validation with helpful error messages
   - File type and size validation
   - Email format verification

4. **Error Handling**
   - User-friendly error messages
   - Request timeout detection
   - Offline mode detection

## 🧪 Utility Functions

The `utils.js` file provides helper functions for:
- Email validation
- Error formatting
- Text truncation
- File size formatting
- File type validation
- Enhanced fetch with timeout
- Network connectivity detection
- Safe JSON parsing

## 🔗 Backend Integration

The frontend communicates with the backend API for:
1. Uploading transcript files
2. Generating AI summaries
3. Sending email summaries

All API requests include proper error handling and loading states.

---

For more information about the complete project, see the [main README](../README.md).
