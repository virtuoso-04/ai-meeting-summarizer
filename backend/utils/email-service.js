/**
 * Email Service for Meeting Summarizer
 * 
 * Handles email sending functionality with retries,
 * template support, and robust error handling.
 */

const nodemailer = require('nodemailer');
const logger = require('./logger');

class EmailService {
  /**
   * Initialize email service
   * @param {Object} config - Email configuration
   * @param {string} config.host - SMTP host
   * @param {number} config.port - SMTP port
   * @param {string} config.user - SMTP username
   * @param {string} config.pass - SMTP password
   * @param {boolean} config.secure - Use secure connection (default based on port)
   * @param {number} config.maxRetries - Max retries for failed emails (default: 2)
   */
  constructor(config) {
    this.config = config;
    
    // Initialize transporter
    try {
      this.transporter = nodemailer.createTransport({
        host: config.host,
        port: parseInt(config.port, 10),
        secure: config.secure !== undefined ? config.secure : parseInt(config.port, 10) === 465,
        auth: {
          user: config.user,
          pass: config.pass,
        },
        // Add TLS options for security
        tls: {
          rejectUnauthorized: true,
          minVersion: 'TLSv1.2'
        }
      });
      
      logger.info('Email service initialized');
    } catch (error) {
      logger.error('Failed to initialize email transporter:', error);
      throw new Error('Email service initialization failed: ' + error.message);
    }
    
    // Track metrics
    this.metrics = {
      emailsSent: 0,
      emailsFailed: 0,
      lastEmailSent: null,
    };
    
    // Retry configuration
    this.maxRetries = config.maxRetries || 2;
  }
  
  /**
   * Verify SMTP connection
   * @returns {Promise<boolean>} True if connection is successful
   */
  async verifyConnection() {
    try {
      await this.transporter.verify();
      logger.info('Email connection verified successfully');
      return true;
    } catch (error) {
      logger.error('Email connection verification failed:', error);
      return false;
    }
  }
  
  /**
   * Send meeting summary via email
   * @param {Object} emailData - Email data
   * @param {string[]} emailData.recipients - Array of recipient email addresses
   * @param {string} emailData.subject - Email subject
   * @param {string} emailData.summary - Summary content
   * @param {string} emailData.senderName - Name of sender
   * @param {Object} options - Additional options
   * @returns {Promise<Object>} Send result with messageId
   */
  async sendSummaryEmail(emailData, options = {}) {
    const { recipients, subject, summary, senderName } = emailData;
    
    // Input validation
    if (!Array.isArray(recipients) || recipients.length === 0) {
      throw new Error('Recipients must be a non-empty array');
    }
    
    if (!summary) {
      throw new Error('Summary content is required');
    }
    
    const sanitizedSubject = (subject || 'Meeting Summary').trim().substring(0, 100);
    const sanitizedSenderName = (senderName || 'Meeting Summarizer').trim().substring(0, 50);
    
    // Create sanitized HTML content with enhanced styling
    const sanitizedSummary = this._sanitizeHtml(summary);
    const htmlContent = this._createEmailHtml(sanitizedSummary, sanitizedSubject, sanitizedSenderName);
    
    // Create plain text version
    const textContent = this._createEmailText(summary, sanitizedSubject);
    
    // Create mail options
    const mailOptions = {
      from: `"${sanitizedSenderName}" <${this.config.user}>`,
      to: recipients.join(', '),
      subject: sanitizedSubject,
      html: htmlContent,
      text: textContent,
      // Add headers for better deliverability and tracking
      headers: {
        'X-Priority': '1',
        'X-MSMail-Priority': 'High',
        'X-Mailer': 'AI-Meeting-Summarizer',
      }
    };
    
    // Add optional parameters
    if (options.cc) mailOptions.cc = options.cc;
    if (options.bcc) mailOptions.bcc = options.bcc;
    if (options.replyTo) mailOptions.replyTo = options.replyTo;
    
    // Send email with retries
    try {
      const result = await this._sendWithRetry(mailOptions);
      
      // Update metrics
      this.metrics.emailsSent++;
      this.metrics.lastEmailSent = new Date().toISOString();
      
      logger.info(`Email sent successfully to ${recipients.length} recipient(s)`);
      return {
        success: true,
        messageId: result.messageId,
        recipients: recipients.length,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      // Update metrics
      this.metrics.emailsFailed++;
      
      logger.error(`Failed to send email: ${error.message}`);
      throw new Error(`Email sending failed: ${error.message}`);
    }
  }
  
  /**
   * Send email with retry logic
   * @param {Object} mailOptions - Nodemailer mail options
   * @returns {Promise<Object>} Nodemailer send result
   * @private
   */
  async _sendWithRetry(mailOptions) {
    let lastError;
    
    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        if (attempt > 0) {
          // Add exponential backoff
          const delay = Math.pow(2, attempt) * 1000; // 2s, 4s, 8s
          logger.info(`Retry email sending attempt ${attempt}/${this.maxRetries} after ${delay}ms`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
        
        // Set timeout for send operation
        return await new Promise((resolve, reject) => {
          const timeout = setTimeout(() => {
            reject(new Error('Email sending operation timed out'));
          }, 30000); // 30 second timeout
          
          this.transporter.sendMail(mailOptions)
            .then(info => {
              clearTimeout(timeout);
              resolve(info);
            })
            .catch(err => {
              clearTimeout(timeout);
              reject(err);
            });
        });
      } catch (error) {
        lastError = error;
        
        // Check if error is retryable
        if (this._isRetryableEmailError(error) && attempt < this.maxRetries) {
          logger.warn(`Email send attempt ${attempt + 1} failed: ${error.message}`);
          continue;
        }
        
        break;
      }
    }
    
    throw lastError;
  }
  
  /**
   * Check if email error is retryable
   * @param {Error} error - Error to check
   * @returns {boolean} True if error is retryable
   * @private
   */
  _isRetryableEmailError(error) {
    // Network errors, connection timeouts, greylisting are retryable
    const retryableErrorCodes = [
      'ECONNREFUSED', 'ETIMEDOUT', 'ECONNRESET', 'ESOCKET',
      'EENVELOPE', 'EMESSAGE', '421', '450', '451', '452'
    ];
    
    // Check error code
    if (error.code && retryableErrorCodes.includes(error.code)) {
      return true;
    }
    
    // Check error message for timeout
    if (error.message && error.message.includes('timed out')) {
      return true;
    }
    
    return false;
  }
  
  /**
   * Sanitize HTML to prevent XSS
   * @param {string} html - HTML content to sanitize
   * @returns {string} Sanitized HTML
   * @private
   */
  _sanitizeHtml(html) {
    return String(html)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
  
  /**
   * Create HTML email content with modern styling
   * @param {string} summary - Sanitized summary content
   * @param {string} subject - Email subject
   * @param {string} senderName - Sender name
   * @returns {string} HTML email content
   * @private
   */
  _createEmailHtml(summary, subject, senderName) {
    const date = new Date().toLocaleDateString(undefined, { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
    
    // Convert Markdown to HTML using a simple converter
    const markdownToHtml = (markdown) => {
      if (!markdown) return '';
      
      return markdown
        // Handle headings - h1 to h3
        .replace(/^# (.+)$/gm, '<h1>$1</h1>')
        .replace(/^## (.+)$/gm, '<h2>$1</h2>')
        .replace(/^### (.+)$/gm, '<h3>$1</h3>')
        .replace(/^#### (.+)$/gm, '<h4>$1</h4>')
        
        // Handle bold and italic
        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.+?)\*/g, '<em>$1</em>')
        .replace(/_(.+?)_/g, '<em>$1</em>')
        
        // Handle code blocks
        .replace(/```([^`]+)```/g, '<pre><code>$1</code></pre>')
        .replace(/`([^`]+)`/g, '<code>$1</code>')
        
        // Handle blockquotes
        .replace(/^> (.+)$/gm, '<blockquote>$1</blockquote>')
        
        // Handle lists - unordered
        .replace(/^\s*[\-\*] (.+)$/gm, '<li>$1</li>')
        .replace(/(<li>.+<\/li>\n)+/g, '<ul>$&</ul>')
        
        // Handle lists - ordered
        .replace(/^\s*\d+\. (.+)$/gm, '<li>$1</li>')
        .replace(/(<li>.+<\/li>\n)+/g, '<ol>$&</ol>')
        
        // Handle horizontal rule
        .replace(/^---+$/gm, '<hr>')
        
        // Handle links
        .replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2">$1</a>')
        
        // Handle paragraphs - needs to come after blockquotes and lists
        .replace(/^(?!<[hou]).+$/gm, '<p>$&</p>')
        
        // Handle line breaks (only needed for content not already in paragraph tags)
        .replace(/\n(?!<)/g, '<br>');
    };
    
    const htmlSummary = markdownToHtml(summary);
    
    return `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${subject}</title>
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
            line-height: 1.6;
            color: #333333;
            padding: 0;
            margin: 0;
            background-color: #f9f9f9;
          }
          .container {
            max-width: 700px;
            margin: 0 auto;
            background-color: #ffffff;
            border-radius: 8px;
            overflow: hidden;
            box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
          }
          .header {
            background-color: #3a86ff;
            color: white;
            padding: 24px;
            text-align: center;
          }
          .content {
            padding: 24px;
            background-color: #ffffff;
          }
          .summary {
            line-height: 1.6;
            background-color: #f9f9f9;
            padding: 16px;
            border-radius: 6px;
            border-left: 4px solid #3a86ff;
          }
          .summary h1 {
            color: #333;
            font-size: 24px;
            margin-top: 0;
          }
          .summary h2 {
            color: #444;
            font-size: 20px;
            margin-top: 20px;
            border-bottom: 1px solid #ddd;
            padding-bottom: 5px;
          }
          .summary h3 {
            color: #555;
            font-size: 18px;
          }
          .summary h4 {
            color: #666;
            font-size: 16px;
          }
          .summary ul, .summary ol {
            padding-left: 20px;
          }
          .summary li {
            margin-bottom: 5px;
          }
          .summary blockquote {
            border-left: 3px solid #3a86ff;
            padding-left: 10px;
            margin-left: 10px;
            color: #555;
            font-style: italic;
          }
          .summary code {
            background-color: #f0f0f0;
            padding: 2px 4px;
            border-radius: 3px;
            font-family: 'Courier New', monospace;
            font-size: 90%;
          }
          .summary pre {
            background-color: #f0f0f0;
            padding: 10px;
            border-radius: 3px;
            overflow-x: auto;
          }
          .summary table {
            border-collapse: collapse;
            width: 100%;
            margin: 15px 0;
          }
          .summary th, .summary td {
            border: 1px solid #ddd;
            padding: 8px;
            text-align: left;
          }
          .summary th {
            background-color: #f2f2f2;
          }
          .summary hr {
            border: 0;
            height: 1px;
            background-color: #ddd;
            margin: 20px 0;
          }
          .footer {
            color: #666666;
            font-size: 12px;
            text-align: center;
            padding: 16px;
            border-top: 1px solid #eeeeee;
            background-color: #f9f9f9;
          }
          h1 {
            margin: 0;
            font-size: 24px;
            font-weight: 600;
          }
          .info {
            margin: 8px 0 16px;
            color: #666666;
          }
          @media only screen and (max-width: 480px) {
            .container {
              width: 100%;
              border-radius: 0;
            }
            .header {
              padding: 16px;
            }
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>${subject}</h1>
          </div>
          <div class="content">
            <p class="info">Generated by ${senderName} on ${date}</p>
            <div class="summary">${htmlSummary}</div>
          </div>
          <div class="footer">
            <p>This summary was generated with AI Meeting Summarizer</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }
  
  /**
   * Create plain text email content for clients without HTML support
   * @param {string} summary - Summary content
   * @param {string} subject - Email subject
   * @returns {string} Plain text email content
   * @private
   */
  _createEmailText(summary, subject) {
    const date = new Date().toLocaleDateString();
    
    return `
${subject}
${'-'.repeat(subject.length)}

Meeting Summary (Generated on ${date})

${summary}

---
This summary was generated with AI Meeting Summarizer
`.trim();
  }
  
  /**
   * Get current service metrics
   * @returns {Object} Current metrics
   */
  getMetrics() {
    return {
      ...this.metrics,
      timestamp: new Date().toISOString()
    };
  }
}

module.exports = EmailService;
