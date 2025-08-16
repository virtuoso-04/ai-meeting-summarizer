require('dotenv').config();
const express = require('express');
const cors = require('cors');
const nodemailer = require('nodemailer');
const Groq = require('groq-sdk');
// OpenAI functionality removed

const app = express();
const PORT = process.env.PORT || 5001; // Changed to port 5001 to avoid conflicts

// Middleware
app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',  // Default to all origins if not specified
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Increase JSON payload limit for larger transcripts
app.use(express.json({ limit: '25mb' }));

// Initialize Groq AI client
let groq = null;

if (process.env.GROQ_API_KEY && process.env.GROQ_API_KEY !== 'your_groq_api_key_here') {
  try {
    groq = new Groq({
      apiKey: process.env.GROQ_API_KEY,
    });
    console.log('GROQ API client initialized successfully');
  } catch (error) {
    console.error('Failed to initialize GROQ client:', error.message);
  }
}

// Email transporter setup with validation
let transporter = null;
try {
  if (
    process.env.EMAIL_HOST &&
    process.env.EMAIL_PORT &&
    process.env.EMAIL_USER &&
    process.env.EMAIL_PASS &&
    process.env.EMAIL_HOST !== 'smtp.example.com'
  ) {
    transporter = nodemailer.createTransport({
      host: process.env.EMAIL_HOST,
      port: parseInt(process.env.EMAIL_PORT, 10),
      secure: parseInt(process.env.EMAIL_PORT, 10) === 465,
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
      // Add TLS options for security
      tls: {
        rejectUnauthorized: true,
        minVersion: 'TLSv1.2'
      }
    });
    console.log('Email transporter initialized successfully');
  } else {
    console.warn('Email configuration incomplete or invalid');
  }
} catch (error) {
  console.error('Failed to initialize email transporter:', error.message);
}

// API endpoint to generate summary
app.post('/api/generate-summary', async (req, res) => {
  try {
    const { transcript, customPrompt } = req.body;
    
    // Validate input
    if (!transcript) {
      return res.status(400).json({ error: 'Transcript is required' });
    }
    
    // Check transcript length
    if (transcript.length > 100000) {
      return res.status(400).json({ 
        error: 'Transcript is too long. Please limit to 100,000 characters.' 
      });
    }

    if (transcript.length < 10) {
      return res.status(400).json({ 
        error: 'Transcript is too short. Please provide more content to summarize.' 
      });
    }

    // Check if Groq API is available
    if (!groq) {
      return res.status(500).json({ 
        error: 'Groq API not configured. Please set up GROQ_API_KEY in .env file' 
      });
    }

    // Sanitize custom prompt
    const sanitizedPrompt = customPrompt ? customPrompt.trim().substring(0, 500) : '';

    const prompt = `
      I need you to summarize the following meeting transcript:

      ${transcript}
      
      ${sanitizedPrompt ? `Special instructions: ${sanitizedPrompt}` : 'Provide a clear, structured summary highlighting key points, decisions, and action items.'}
      
      Format the summary in a clear, readable structure with appropriate sections and bullet points where needed.
    `;

    let summary = '';
    let usedService = 'Groq';
    
    // Use Groq for summarization
    try {
      // Set a timeout for the API call
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('API request timed out')), 30000);
      });

      const apiPromise = groq.chat.completions.create({
        messages: [{ role: 'user', content: prompt }],
        model: 'llama3-70b-8192',
        max_tokens: 4000,
        temperature: 0.7,
      });

      const completion = await Promise.race([apiPromise, timeoutPromise]);
      summary = completion.choices[0]?.message?.content || '';
      
      if (!summary) {
        throw new Error('Empty response received from Groq API');
      }
      
    } catch (groqError) {
      console.error('Error with Groq API:', groqError.message);
      throw groqError;
    }

    if (!summary) {
      return res.status(500).json({ error: 'Failed to generate summary - empty response received' });
    }

    // Return the summary along with metadata
    res.json({ 
      summary,
      metadata: {
        service: usedService,
        timestamp: new Date().toISOString(),
        transcriptLength: transcript.length,
        summaryLength: summary.length
      }
    });
  } catch (error) {
    console.error('Error generating summary:', error);
    res.status(500).json({ 
      error: 'Failed to generate summary', 
      details: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// API endpoint to send email
app.post('/api/send-email', async (req, res) => {
  try {
    const { recipients, subject, summary, senderName } = req.body;
    
    // Check if email is configured
    if (!transporter) {
      return res.status(500).json({ 
        error: 'Email service not configured. Please check server settings.'
      });
    }
    
    // Validate recipients
    if (!recipients || !Array.isArray(recipients) || recipients.length === 0) {
      return res.status(400).json({ error: 'Recipients are required' });
    }
    
    // Limit number of recipients
    if (recipients.length > 20) {
      return res.status(400).json({ 
        error: 'Too many recipients. Please limit to 20 email addresses.'
      });
    }
    
    // Validate email addresses
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const invalidEmails = recipients.filter(email => !emailRegex.test(email));
    if (invalidEmails.length > 0) {
      return res.status(400).json({ 
        error: 'Invalid email address format detected',
        invalidEmails
      });
    }

    // Validate summary
    if (!summary) {
      return res.status(400).json({ error: 'Summary content is required' });
    }
    
    // Check summary length
    if (summary.length > 100000) {
      return res.status(400).json({ 
        error: 'Summary is too long. Please limit to 100,000 characters.'
      });
    }

    // Sanitize input
    const sanitizedSubject = (subject || 'Meeting Summary').trim().substring(0, 100);
    const sanitizedSenderName = (senderName || 'Meeting Summarizer').trim().substring(0, 50);
    
    // Create email content with sanitized HTML
    const sanitizedSummary = summary
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
    
    // Send email to all recipients at once
    const mailOptions = {
      from: `"${sanitizedSenderName}" <${process.env.EMAIL_USER}>`,
      to: recipients.join(', '),
      subject: sanitizedSubject,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>${sanitizedSubject}</h2>
          <div style="white-space: pre-wrap; line-height: 1.5;">${sanitizedSummary}</div>
          <p style="color: #666; margin-top: 30px; font-size: 12px; border-top: 1px solid #eee; padding-top: 10px;">
            This summary was generated with AI Meeting Summarizer on ${new Date().toLocaleDateString()}
          </p>
        </div>
      `,
      // Also provide plain text version as fallback
      text: `${sanitizedSubject}\n\n${summary}\n\nThis summary was generated with AI Meeting Summarizer on ${new Date().toLocaleDateString()}`,
    };

    // Set a timeout for the email send operation
    const sendEmailWithTimeout = async () => {
      return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Email sending operation timed out'));
        }, 30000); // 30 second timeout
        
        transporter.sendMail(mailOptions)
          .then(info => {
            clearTimeout(timeout);
            resolve(info);
          })
          .catch(err => {
            clearTimeout(timeout);
            reject(err);
          });
      });
    };

    const info = await sendEmailWithTimeout();
    
    res.json({ 
      success: true, 
      message: 'Email sent successfully',
      messageId: info.messageId,
      recipients: recipients.length
    });
  } catch (error) {
    console.error('Error sending email:', error);
    res.status(500).json({ 
      error: 'Failed to send email', 
      details: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Health check endpoint with service status
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    services: {
      groq: groq ? 'configured' : 'not configured',
      email: transporter ? 'configured' : 'not configured'
    },
    environment: {
      node: process.version,
      platform: process.platform
    }
  });
});

// Handle 404 errors
app.use((req, res) => {
  res.status(404).json({ error: 'Not found', path: req.path });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: err.message || 'Unknown error occurred',
    timestamp: new Date().toISOString()
  });
});

// Start the server with error handling
const server = app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
})
.on('error', (err) => {
  console.error(`Server failed to start: ${err.message}`);
  process.exit(1);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});
