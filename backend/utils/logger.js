/**
 * Logger configuration for AI Meeting Summarizer
 * 
 * Provides structured logging with different levels and formats
 * for development and production environments.
 */

const winston = require('winston');
const path = require('path');
const fs = require('fs');

// Ensure logs directory exists
const logsDir = path.join(__dirname, '../logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// Define log formats
const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.printf(
    info => `${info.timestamp} ${info.level}: ${info.message}${info.splat !== undefined ? `${info.splat}` : ''}`
  )
);

const fileFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.json()
);

// Create the logger with different transports
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  defaultMeta: { service: 'ai-meeting-summarizer' },
  transports: [
    // Write all logs to console
    new winston.transports.Console({ format: consoleFormat }),

    // Write error logs to a file
    new winston.transports.File({
      filename: path.join(logsDir, 'error.log'),
      level: 'error',
      format: fileFormat,
      maxsize: 5242880, // 5MB
      maxFiles: 5
    }),
    
    // Write all logs to a combined file
    new winston.transports.File({
      filename: path.join(logsDir, 'combined.log'),
      format: fileFormat,
      maxsize: 5242880, // 5MB
      maxFiles: 5
    })
  ],
  exitOnError: false
});

/**
 * Creates a middleware function for logging HTTP requests
 */
logger.middleware = function() {
  // Skip logging for specific endpoints like health checks
  const skipEndpoints = ['/api/health'];
  
  return function(req, res, next) {
    // Skip logging for excluded endpoints
    if (skipEndpoints.includes(req.path)) {
      return next();
    }
    
    const start = Date.now();
    
    // Log when the response finishes
    res.on('finish', () => {
      const duration = Date.now() - start;
      const message = `${req.method} ${req.path} ${res.statusCode} ${duration}ms`;
      
      // Log at appropriate level based on status code
      if (res.statusCode >= 500) {
        logger.error(message, { ip: req.ip, duration, body: sanitizeBody(req.body) });
      } else if (res.statusCode >= 400) {
        logger.warn(message, { ip: req.ip, duration });
      } else {
        logger.info(message, { ip: req.ip, duration });
      }
    });
    
    next();
  };
};

/**
 * Sanitizes request body for logging by removing sensitive fields
 * @param {Object} body - Request body to sanitize
 * @returns {Object} Sanitized body
 */
function sanitizeBody(body) {
  if (!body) return {};
  
  // Create a shallow copy
  const sanitized = { ...body };
  
  // Remove sensitive fields
  const sensitiveFields = ['password', 'token', 'apiKey', 'api_key', 'secret'];
  
  sensitiveFields.forEach(field => {
    if (field in sanitized) {
      sanitized[field] = '[REDACTED]';
    }
  });
  
  return sanitized;
}

module.exports = logger;
