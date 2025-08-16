/**
 * AI Service for Meeting Summarizer
 * 
 * Handles interactions with AI providers (Groq) with
 * enhanced error handling, retries, and optimizations.
 */

const Groq = require('groq-sdk');
const logger = require('./logger');

class AIService {
  /**
   * Initialize the AI service
   * @param {Object} config - Configuration options
   * @param {string} config.apiKey - Groq API key
   * @param {string} config.defaultModel - Default model to use
   * @param {number} config.maxRetries - Maximum number of retries (default: 2)
   * @param {number} config.timeout - Timeout in ms (default: 30000)
   */
  constructor(config) {
    this.config = {
      defaultModel: 'llama3-70b-8192',
      maxRetries: 2,
      timeout: 30000,
      ...config
    };
    
    // Initialize Groq client
    try {
      this.client = new Groq({
        apiKey: this.config.apiKey,
      });
      logger.info('AI Service initialized with Groq');
    } catch (error) {
      logger.error('Failed to initialize Groq client:', error);
      throw new Error('Failed to initialize AI service: ' + error.message);
    }
    
    // Track usage metrics
    this.metrics = {
      requestCount: 0,
      successCount: 0,
      failureCount: 0,
      totalTokensUsed: 0,
      averageLatency: 0,
      requestsInProgress: 0,
    };
  }
  
  /**
   * Generate a meeting summary using AI
   * @param {string} transcript - Meeting transcript
   * @param {string} customPrompt - Custom instructions (optional)
   * @param {Object} options - Additional options
   * @returns {Promise<string>} Generated summary
   */
  async generateSummary(transcript, customPrompt = '', options = {}) {
    const start = Date.now();
    
    // Prepare parameters
    const model = options.model || this.config.defaultModel;
    const temperature = options.temperature || 0.7;
    const maxTokens = options.maxTokens || 4000;
    
    // Construct prompt
    const prompt = this._constructSummaryPrompt(transcript, customPrompt);
    
    // Track metrics
    this.metrics.requestCount++;
    this.metrics.requestsInProgress++;
    
    try {
      // Make API request with retry logic
      const response = await this._makeRequestWithRetry(async () => {
        return await this.client.chat.completions.create({
          messages: [{ role: 'user', content: prompt }],
          model,
          max_tokens: maxTokens,
          temperature,
        });
      });
      
      // Extract and validate summary
      const summary = response.choices[0]?.message?.content;
      
      if (!summary) {
        throw new Error('Empty response received from AI provider');
      }
      
      // Update success metrics
      this.metrics.successCount++;
      const tokensUsed = response.usage?.total_tokens || 0;
      this.metrics.totalTokensUsed += tokensUsed;
      
      // Calculate and update latency metrics
      const latency = Date.now() - start;
      this.metrics.averageLatency = 
        (this.metrics.averageLatency * (this.metrics.successCount - 1) + latency) / 
        this.metrics.successCount;
      
      logger.info(`Summary generated: ${tokensUsed} tokens, ${latency}ms`);
      
      return summary;
    } catch (error) {
      // Update failure metrics
      this.metrics.failureCount++;
      
      logger.error(`AI summary generation failed: ${error.message}`);
      throw new Error(`Failed to generate summary: ${error.message}`);
    } finally {
      this.metrics.requestsInProgress--;
    }
  }
  
  /**
   * Make an API request with automatic retries
   * @param {Function} requestFn - Function that makes the API request
   * @returns {Promise<Object>} API response
   * @private
   */
  async _makeRequestWithRetry(requestFn) {
    let lastError;
    
    for (let attempt = 0; attempt <= this.config.maxRetries; attempt++) {
      try {
        if (attempt > 0) {
          // Add exponential backoff delay
          const delay = Math.pow(2, attempt) * 500; // 1s, 2s, 4s, etc.
          logger.info(`Retry attempt ${attempt}/${this.config.maxRetries} after ${delay}ms delay`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
        
        // Create a timeout promise
        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => reject(new Error('API request timed out')), this.config.timeout);
        });
        
        // Race the request against the timeout
        return await Promise.race([requestFn(), timeoutPromise]);
      } catch (error) {
        lastError = error;
        
        // Check if we should retry this error
        const shouldRetry = this._isRetryableError(error) && attempt < this.config.maxRetries;
        
        if (!shouldRetry) {
          logger.error(`Request failed with non-retryable error: ${error.message}`);
          break;
        }
        
        logger.warn(`Request attempt ${attempt + 1} failed: ${error.message}`);
      }
    }
    
    throw lastError;
  }
  
  /**
   * Determine if an error is retryable
   * @param {Error} error - The error to check
   * @returns {boolean} True if the error is retryable
   * @private
   */
  _isRetryableError(error) {
    // Network errors, timeouts, and certain status codes are retryable
    const retryableStatusCodes = [408, 429, 500, 502, 503, 504];
    
    // Check for timeout
    if (error.message.includes('timed out')) {
      return true;
    }
    
    // Check for network errors
    if (error.code === 'ECONNRESET' || error.code === 'ECONNREFUSED') {
      return true;
    }
    
    // Check for rate limiting or server errors
    if (error.status && retryableStatusCodes.includes(error.status)) {
      return true;
    }
    
    return false;
  }
  
  /**
   * Construct a prompt for generating meeting summaries
   * @param {string} transcript - Meeting transcript
   * @param {string} customPrompt - Custom instructions
   * @returns {string} Formatted prompt
   * @private
   */
  _constructSummaryPrompt(transcript, customPrompt) {
    // Create a well-structured prompt optimized for markdown output
    const basePrompt = `
# Meeting Transcript Summary Task

## Context
You are a professional meeting summarizer who converts transcripts into clear, structured summaries formatted in Markdown. Your summaries are valued for their clarity, organization, and visual structure.

## Transcript to Summarize
${transcript}

## Instructions
${customPrompt ? `Custom Instructions: ${customPrompt}` : `
- Extract the key points, decisions, and action items
- Organize by topic in a logical structure 
- Use markdown formatting to enhance readability
- Highlight important decisions and assignments
- Keep the summary concise yet comprehensive`}

## Output Format
Please provide a well-organized meeting summary using proper Markdown formatting with:

1. # H1 heading for the meeting title
2. ## H2 headings for main sections
3. ### H3 headings for subsections
4. Bullet points (- ) for lists of key points
5. **Bold text** for important decisions
6. Use \`code blocks\` for technical terms or code mentioned
7. > Blockquotes for important quotes from participants
8. Create a table for action items with columns for Task, Owner, and Deadline
9. Use horizontal rules (---) to separate major sections

Example structure:
\`\`\`markdown
# Meeting Summary: [Project/Topic]

## Participants
- Person 1
- Person 2

## Key Discussion Points
### Topic 1
- Key point 1
- Key point 2
  - Sub-point A
  - Sub-point B

### Topic 2
- Discussion about X
- **Decision made**: We will proceed with option Y

## Action Items
| Task | Owner | Deadline |
|------|-------|----------|
| Complete feature X | Alice | 2023-09-15 |
| Review proposal | Bob | 2023-09-10 |

## Next Steps
- Schedule follow-up meeting
- Share documentation with the team
\`\`\`

Make sure your summary is structured, visually organized, and captures the essence of the meeting.
`.trim();

    return basePrompt;
  }
  
  /**
   * Get current service metrics
   * @returns {Object} Current metrics
   */
  getMetrics() {
    return {
      ...this.metrics,
      uptime: process.uptime(),
      timestamp: new Date().toISOString()
    };
  }
}

module.exports = AIService;
