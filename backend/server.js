/**
 * AI Meeting Summarizer - Backend Server
 * 
 * Professional-grade backend service for generating and sharing
 * meeting summaries using Groq AI and email delivery.
 * 
 * Features:
 * - Structured logging and monitoring
 * - Enhanced error handling with proper status codes
 * - Performance optimization with caching
 * - Security hardening with helmet middleware
 * - Rate limiting to prevent abuse
 * - Graceful shutdown handling
 */

// Load environment variables
require('dotenv').config();

// Core dependencies
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const responseTime = require('response-time');
const path = require('path');
const multer = require('multer');
const fs = require('fs');

// Custom utilities
const logger = require('./utils/logger');
const { cache, getCacheStats, clearCache } = require('./utils/cache');
const AIService = require('./utils/ai-service');
const EmailService = require('./utils/email-service');
const fileProcessing = require('./utils/file-processing');

// Initialize Express application
const app = express();
const PORT = process.env.PORT || 5001; // Changed to port 5001 to avoid conflicts

// =======================================================
// Configure middleware
// =======================================================

// Security enhancements
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      connectSrc: ["'self'"],
      frameSrc: ["'self'"],
      childSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      fontSrc: ["'self'", 'data:'],
      imgSrc: ["'self'", 'data:'],
      baseUri: ["'self'"]
    }
  },
  referrerPolicy: { policy: 'no-referrer-when-downgrade' }
}));

// CORS configuration
app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  credentials: true,
  maxAge: 86400 // CORS preflight request cache time (24 hours)
}));

// Performance optimizations
app.use(compression()); // Compress responses
app.use(express.json({ limit: '10mb' }));

// Configure multer for file uploads
const uploadDir = path.join(__dirname, 'uploads');
// Create upload directory if it doesn't exist
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const upload = multer({
  dest: uploadDir,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    // Check allowed file types
    const allowedTypes = ['.txt', '.md', '.json', '.csv', '.html'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowedTypes.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error(`File type ${ext} is not supported. Allowed types: ${allowedTypes.join(', ')}`));
    }
  }
}); // Parse JSON with increased limit for transcripts
app.use(responseTime()); // Track response time

// Logging middleware
app.use(logger.middleware());

// Rate limiting configuration
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    logger.warn(`Rate limit exceeded for ${req.ip}`);
    res.status(429).json({
      error: 'Too many requests',
      message: 'Please try again after 15 minutes',
      timestamp: new Date().toISOString()
    });
  }
});

const summarizeLimiter = rateLimit({
  windowMs: 2 * 60 * 1000, // 2 minutes
  max: 5, // Limit each IP to 5 summary generations per windowMs
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    logger.warn(`Summary generation rate limit exceeded for ${req.ip}`);
    res.status(429).json({
      error: 'Too many summary requests',
      message: 'Please try again after 2 minutes',
      timestamp: new Date().toISOString()
    });
  }
});

const emailLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 20, // Limit each IP to 20 email sends per windowMs
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    logger.warn(`Email rate limit exceeded for ${req.ip}`);
    res.status(429).json({
      error: 'Too many email requests',
      message: 'Please try again after 1 hour',
      timestamp: new Date().toISOString()
    });
  }
});

// Apply base rate limiting
app.use('/api/', apiLimiter);

// =======================================================
// Metrics tracking
// =======================================================

// Define rate limit constants for metrics
const SUMMARY_RATE_LIMIT_WINDOW = 2 * 60 * 1000; // 2 minutes
const SUMMARY_RATE_LIMIT_MAX = 5;
const EMAIL_RATE_LIMIT_WINDOW = 15 * 60 * 1000; // 15 minutes
const EMAIL_RATE_LIMIT_MAX = 10;

// Performance metrics tracking
let requestCount = 0;
let summaryRequestCount = 0;
let emailRequestCount = 0;
let errorCount = 0;
let rateLimitCount = 0;
let totalSummaryTime = 0;
let totalEmailTime = 0;
let totalTokensUsed = 0;
let aiErrorCount = 0;

// Store last 100 response times for percentile calculations
const lastSummaryTimes = [];
const lastEmailTimes = [];
const MAX_TIMES_STORED = 100;

// Add response time tracking middleware
app.use(responseTime((req, res, time) => {
  requestCount++;
  
  // Track request type
  if (req.path === '/api/generate-summary') {
    summaryRequestCount++;
    totalSummaryTime += time;
    lastSummaryTimes.push(time);
    if (lastSummaryTimes.length > MAX_TIMES_STORED) {
      lastSummaryTimes.shift(); // Remove oldest time
    }
  } else if (req.path === '/api/send-email') {
    emailRequestCount++;
    totalEmailTime += time;
    lastEmailTimes.push(time);
    if (lastEmailTimes.length > MAX_TIMES_STORED) {
      lastEmailTimes.shift(); // Remove oldest time
    }
  }
  
  // Track errors
  if (res.statusCode >= 400) {
    errorCount++;
    if (res.statusCode === 429) {
      rateLimitCount++;
    }
  }
}));

// =======================================================
// Initialize services
// =======================================================

// Initialize AI service
let aiService = null;
try {
  if (process.env.GROQ_API_KEY && process.env.GROQ_API_KEY !== 'your_groq_api_key_here') {
    aiService = new AIService({
      apiKey: process.env.GROQ_API_KEY,
      defaultModel: process.env.GROQ_MODEL || 'llama3-70b-8192',
      maxRetries: process.env.AI_MAX_RETRIES ? parseInt(process.env.AI_MAX_RETRIES, 10) : 2,
      timeout: process.env.AI_TIMEOUT ? parseInt(process.env.AI_TIMEOUT, 10) : 30000
    });
    logger.info('AI Service initialized successfully');
  } else {
    logger.warn('AI Service not configured - missing or invalid API key');
  }
} catch (error) {
  logger.error('Failed to initialize AI Service:', error);
}

// Initialize Email service
let emailService = null;
try {
  if (
    process.env.EMAIL_HOST &&
    process.env.EMAIL_PORT &&
    process.env.EMAIL_USER &&
    process.env.EMAIL_PASS &&
    process.env.EMAIL_HOST !== 'smtp.example.com'
  ) {
    emailService = new EmailService({
      host: process.env.EMAIL_HOST,
      port: process.env.EMAIL_PORT,
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
      secure: process.env.EMAIL_SECURE === 'true',
      maxRetries: process.env.EMAIL_MAX_RETRIES ? parseInt(process.env.EMAIL_MAX_RETRIES, 10) : 2
    });
    logger.info('Email Service initialized successfully');
  } else {
    logger.warn('Email Service not configured - missing or invalid settings');
  }
} catch (error) {
  logger.error('Failed to initialize Email Service:', error);
}

// =======================================================
// API routes
// =======================================================

/**
 * Generate Summary Endpoint
 * Generates a meeting summary from a transcript using AI
 */
app.post('/api/generate-summary', summarizeLimiter, async (req, res) => {
  const startTime = Date.now();
  logger.info('Summary generation request received');
  
  try {
    const { transcript, customPrompt } = req.body;
    
    // Validate input
    if (!transcript) {
      logger.warn('Missing transcript in request');
      return res.status(400).json({ 
        error: 'Transcript is required',
        timestamp: new Date().toISOString()
      });
    }
    
    // Check transcript length
    if (transcript.length > 100000) {
      logger.warn(`Transcript too long: ${transcript.length} characters`);
      return res.status(400).json({ 
        error: 'Transcript is too long. Please limit to 100,000 characters.',
        timestamp: new Date().toISOString()
      });
    }

    if (transcript.length < 10) {
      logger.warn('Transcript too short');
      return res.status(400).json({ 
        error: 'Transcript is too short. Please provide more content to summarize.',
        timestamp: new Date().toISOString()
      });
    }

    // Check if AI service is available
    if (!aiService) {
      logger.error('AI service not configured for summary generation');
      return res.status(503).json({ 
        error: 'AI service not available. Please check server configuration.',
        timestamp: new Date().toISOString()
      });
    }
    
    // Generate the summary
    const summary = await aiService.generateSummary(transcript, customPrompt);
    
    // Return the summary with metadata
    const processingTime = Date.now() - startTime;
    logger.info(`Summary generated successfully in ${processingTime}ms`);
    
    res.json({ 
      summary,
      metadata: {
        service: 'Groq',
        model: process.env.GROQ_MODEL || 'llama3-70b-8192',
        timestamp: new Date().toISOString(),
        transcriptLength: transcript.length,
        summaryLength: summary.length,
        processingTimeMs: processingTime
      }
    });
  } catch (error) {
    const errorTime = Date.now() - startTime;
    logger.error(`Error generating summary (${errorTime}ms): ${error.message}`);
    
    // Determine appropriate status code based on the error
    let statusCode = 500;
    if (error.message.includes('rate limit') || error.message.includes('quota')) {
      statusCode = 429;
    } else if (error.message.includes('timed out')) {
      statusCode = 504;
    }
    
    res.status(statusCode).json({ 
      error: 'Failed to generate summary', 
      details: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * File Upload Endpoint
 * Accepts transcript files and returns the text content
 */
app.post('/api/upload-transcript', upload.single('file'), async (req, res) => {
  const startTime = Date.now();
  
  try {
    // Check if file was uploaded
    if (!req.file) {
      return res.status(400).json({
        error: 'No file uploaded',
        timestamp: new Date().toISOString()
      });
    }
    
    logger.info(`File uploaded: ${req.file.originalname} (${req.file.size} bytes)`);
    
    // Extract text from the uploaded file
    const text = await fileProcessing.extractTextFromFile(
      req.file.path, 
      req.file.originalname,
      { maxLength: 100000 }
    );
    
    // Clean up the uploaded file
    fs.unlink(req.file.path, (err) => {
      if (err) {
        logger.warn(`Failed to delete temporary file: ${req.file.path}`, err);
      }
    });
    
    const processingTime = Date.now() - startTime;
    logger.info(`File processed successfully in ${processingTime}ms: ${text.length} characters`);
    
    // Return the extracted text
    res.json({
      text,
      fileName: req.file.originalname,
      charCount: text.length,
      processingTimeMs: processingTime
    });
  } catch (error) {
    // Clean up the uploaded file if it exists
    if (req.file?.path) {
      fs.unlink(req.file.path, () => {});
    }
    
    logger.error(`Error processing uploaded file: ${error.message}`);
    
    res.status(400).json({
      error: 'Failed to process file',
      details: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * Send Email Endpoint
 * Sends an email with the meeting summary
 */
app.post('/api/send-email', emailLimiter, async (req, res) => {
  const startTime = Date.now();
  logger.info('Email request received');
  
  try {
    const { recipients, subject, summary, senderName } = req.body;

    // Validate inputs
    if (!recipients || !subject || !summary) {
      logger.warn('Missing required email fields', { 
        recipients: !!recipients, 
        subject: !!subject, 
        summary: !!summary 
      });
      return res.status(400).json({ 
        error: 'Missing required fields: recipients, subject, and summary are required',
        timestamp: new Date().toISOString()
      });
    }

    // Check if email service is available
    if (!emailService) {
      logger.error('Email service not configured');
      return res.status(503).json({ 
        error: 'Email service not available. Please check server configuration.',
        timestamp: new Date().toISOString()
      });
    }

    // Validate recipients array
    let recipientList;
    if (Array.isArray(recipients)) {
      recipientList = recipients;
    } else if (typeof recipients === 'string') {
      // Handle case where a single string is sent
      recipientList = [recipients];
    } else {
      return res.status(400).json({ 
        error: 'Recipients must be an array of email addresses or a single email address',
        timestamp: new Date().toISOString()
      });
    }

    // Validate email formats
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const invalidEmails = recipientList.filter(email => !emailRegex.test(email));
    if (invalidEmails.length > 0) {
      logger.warn(`Invalid email format in recipients: ${invalidEmails.join(', ')}`);
      return res.status(400).json({ 
        error: `Invalid email format: ${invalidEmails.join(', ')}`,
        timestamp: new Date().toISOString() 
      });
    }

    // Send the email using our email service
    const emailResult = await emailService.sendSummaryEmail({
      recipients: recipientList,
      subject,
      summary,
      senderName: senderName || 'Meeting Summarizer'
    });
    
    // Return success response with metadata
    const processingTime = Date.now() - startTime;
    logger.info(`Email sent successfully in ${processingTime}ms`, { 
      recipients: recipientList, 
      count: recipientList.length 
    });
    
    res.json({ 
      success: true, 
      message: 'Email sent successfully',
      messageId: emailResult.messageId,
      recipientCount: recipientList.length,
      timestamp: new Date().toISOString(),
      processingTimeMs: processingTime
    });
  } catch (error) {
    const errorTime = Date.now() - startTime;
    logger.error(`Error sending email (${errorTime}ms): ${error.message}`);
    
    // Determine appropriate status code based on the error
    let statusCode = 500;
    if (error.message.includes('connection refused') || error.message.includes('no server found')) {
      statusCode = 503;
    } else if (error.message.includes('timed out')) {
      statusCode = 504;
    } else if (error.message.includes('rate limit')) {
      statusCode = 429;
    }
    
    res.status(statusCode).json({ 
      error: 'Failed to send email', 
      details: error.message,
      timestamp: new Date().toISOString() 
    });
  }
});

/**
 * Health Check Endpoint
 * Provides system health status and diagnostics
 */
app.get('/api/health', (req, res) => {
  const uptimeSeconds = Math.floor(process.uptime());
  const memoryUsage = process.memoryUsage();
  const healthStatus = {
    status: 'ok',
    service: 'ai-meeting-summarizer',
    version: process.env.npm_package_version || require('./package.json').version,
    timestamp: new Date().toISOString(),
    uptime: {
      seconds: uptimeSeconds,
      formatted: formatUptime(uptimeSeconds)
    },
    services: {
      ai: {
        name: 'Groq',
        status: aiService ? 'available' : 'unavailable',
        model: process.env.GROQ_MODEL || 'llama3-70b-8192'
      },
      email: {
        status: emailService ? 'available' : 'unavailable',
        host: process.env.EMAIL_HOST || 'not configured'
      }
    },
    rateLimit: {
      summary: {
        windowMs: SUMMARY_RATE_LIMIT_WINDOW,
        maxRequests: SUMMARY_RATE_LIMIT_MAX
      },
      email: {
        windowMs: EMAIL_RATE_LIMIT_WINDOW,
        maxRequests: EMAIL_RATE_LIMIT_MAX
      }
    },
    environment: {
      nodeEnv: process.env.NODE_ENV || 'development',
      platform: process.platform,
      nodeVersion: process.version
    },
    memory: {
      rss: `${Math.round(memoryUsage.rss / 1024 / 1024)} MB`,
      heapTotal: `${Math.round(memoryUsage.heapTotal / 1024 / 1024)} MB`, 
      heapUsed: `${Math.round(memoryUsage.heapUsed / 1024 / 1024)} MB`
    }
  };

  // Add cache metrics if available
  if (cache) {
    healthStatus.cache = {
      size: cache.size,
      hits: cache.hits,
      misses: cache.misses,
      hitRatio: cache.hits + cache.misses > 0 
        ? (cache.hits / (cache.hits + cache.misses) * 100).toFixed(2) + '%' 
        : 'N/A'
    };
  }

  res.json(healthStatus);
});

// Helper function to format uptime
function formatUptime(uptimeSeconds) {
  const days = Math.floor(uptimeSeconds / (24 * 60 * 60));
  const hours = Math.floor((uptimeSeconds % (24 * 60 * 60)) / (60 * 60));
  const minutes = Math.floor((uptimeSeconds % (60 * 60)) / 60);
  const seconds = Math.floor(uptimeSeconds % 60);
  
  return `${days}d ${hours}h ${minutes}m ${seconds}s`;
}

/**
 * Cache Management Endpoint (Admin only)
 * Allows clearing the cache or getting cache statistics
 */
app.post('/api/admin/cache', (req, res) => {
  // Basic authentication for admin endpoints
  const authHeader = req.headers.authorization;
  if (!authHeader || authHeader !== `Bearer ${process.env.ADMIN_API_KEY}`) {
    logger.warn('Unauthorized access attempt to admin cache endpoint', { ip: req.ip });
    return res.status(401).json({ error: 'Unauthorized access to admin functionality' });
  }
  
  const { action } = req.body;
  
  if (!cache) {
    return res.status(404).json({ error: 'Cache not configured' });
  }
  
  if (action === 'clear') {
    const stats = getCacheStats();
    clearCache();
    logger.info('Cache cleared via admin endpoint', { previousStats: stats });
    return res.json({ 
      success: true, 
      message: 'Cache cleared successfully',
      previousStats: stats
    });
  } else if (action === 'stats') {
    return res.json(getCacheStats());
  } else {
    return res.status(400).json({ 
      error: 'Invalid action',
      validActions: ['clear', 'stats']
    });
  }
});

/**
 * Metrics Endpoint (Admin/Monitoring Only)
 * Provides detailed performance metrics and system statistics
 */
app.get('/api/metrics', (req, res) => {
  // Basic authentication for metrics endpoint (admin only)
  const authHeader = req.headers.authorization;
  if (!authHeader || authHeader !== `Bearer ${process.env.METRICS_API_KEY}`) {
    return res.status(401).json({ error: 'Unauthorized access to metrics' });
  }
  
  // Collect detailed metrics
  const metrics = {
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    cpu: process.cpuUsage(),
    resourceUsage: process.resourceUsage(),
    eventLoopDelay: process.eventLoopUtilization(),
    requests: {
      total: requestCount,
      summaryRequests: summaryRequestCount,
      emailRequests: emailRequestCount,
      errors: errorCount,
      rateLimited: rateLimitCount
    },
    performance: {
      averageSummaryTime: summaryRequestCount > 0 ? 
        Math.round(totalSummaryTime / summaryRequestCount) : 0,
      averageEmailTime: emailRequestCount > 0 ? 
        Math.round(totalEmailTime / emailRequestCount) : 0,
      p95SummaryTime: lastSummaryTimes.length > 0 ?
        calculatePercentile(lastSummaryTimes, 95) : 0,
      p95EmailTime: lastEmailTimes.length > 0 ?
        calculatePercentile(lastEmailTimes, 95) : 0
    },
    ai: {
      totalTokens: totalTokensUsed,
      averageTokensPerRequest: summaryRequestCount > 0 ? 
        Math.round(totalTokensUsed / summaryRequestCount) : 0,
      errorRate: summaryRequestCount > 0 ?
        ((aiErrorCount / summaryRequestCount) * 100).toFixed(2) + '%' : '0%'
    },
    cache: cache ? {
      size: cache.size,
      hits: cache.hits,
      misses: cache.misses,
      hitRatio: cache.hits + cache.misses > 0 ?
        ((cache.hits / (cache.hits + cache.misses)) * 100).toFixed(2) + '%' : 'N/A',
      averageTtl: cache.averageTtl || 'N/A',
      oldestItem: cache.oldestItem || 'N/A'
    } : 'not configured'
  };
  
  res.json(metrics);
});

// Helper function to calculate percentile
function calculatePercentile(array, percentile) {
  if (array.length === 0) return 0;
  
  // Sort the array
  const sorted = [...array].sort((a, b) => a - b);
  
  // Calculate the index
  const index = Math.ceil((percentile / 100) * sorted.length) - 1;
  return sorted[index];
}

// =======================================================
// Error handling
// =======================================================

// Handle 404 errors
app.use((req, res) => {
  logger.warn(`404 Not Found: ${req.method} ${req.path}`);
  res.status(404).json({ 
    error: 'Not found', 
    path: req.path,
    timestamp: new Date().toISOString() 
  });
});

// Global error handler with structured logging
app.use((err, req, res, next) => {
  const statusCode = err.statusCode || 500;
  
  // Log error with appropriate level based on status code
  if (statusCode >= 500) {
    logger.error(`Server error: ${err.message}`, { 
      stack: err.stack,
      path: req.path,
      method: req.method,
      statusCode
    });
  } else if (statusCode >= 400) {
    logger.warn(`Client error: ${err.message}`, {
      path: req.path,
      method: req.method,
      statusCode
    });
  }
  
  // Avoid exposing internal error details in production
  const errorDetails = process.env.NODE_ENV === 'production' && statusCode >= 500
    ? 'An unexpected error occurred'
    : err.message || 'Unknown error occurred';
    
  res.status(statusCode).json({
    error: statusCode >= 500 ? 'Internal server error' : err.name || 'Request error',
    message: errorDetails,
    requestId: req.id,
    timestamp: new Date().toISOString()
  });
});

// =======================================================
// Server startup
// =======================================================

// Start the server with enhanced error handling
const server = app.listen(PORT, () => {
  logger.info(`✅ Server running on port ${PORT}`, {
    port: PORT,
    env: process.env.NODE_ENV || 'development',
    nodeVersion: process.version
  });
  
  // Log available routes for easier debugging during development
  if (process.env.NODE_ENV !== 'production') {
    try {
      if (app._router && app._router.stack) {
        const routes = app._router.stack
          .filter(r => r.route)
          .map(r => ({
            path: r.route.path,
            methods: Object.keys(r.route.methods).join(', ').toUpperCase()
          }));
        logger.info('Available API routes:', { routes });
      } else {
        logger.info('No routes to display');
      }
    } catch (error) {
      logger.warn('Could not log routes', { error: error.message });
    }
  }
})
.on('error', (err) => {
  logger.error(`Failed to start server: ${err.message}`, { stack: err.stack });
  process.exit(1);
});

// Graceful shutdown handling
const gracefulShutdown = (signal) => {
  logger.info(`${signal} received, shutting down gracefully`);
  
  // Close server with timeout
  const shutdownTimeout = setTimeout(() => {
    logger.error('Server shutdown timed out, forcing exit');
    process.exit(1);
  }, 10000);
  
  server.close(() => {
    logger.info('Server closed successfully');
    clearTimeout(shutdownTimeout);
    process.exit(0);
  });
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Log unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled promise rejection:', { reason, stack: reason?.stack });
});
