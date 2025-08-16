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
    // Create a well-structured prompt optimized for markdown output and Groq model
    const basePrompt = `
# Meeting Transcript Summary Task

## Context
You are an expert meeting summarizer who transforms transcripts into highly structured, professional summaries using Markdown. Your summaries are valued for their clarity, precise organization, and actionable insights. You're using the llama3-70b-8192 model from Groq, which excels at structured content generation.

## Transcript to Summarize
${transcript}

## Instructions
${customPrompt ? `Custom Instructions: ${customPrompt}` : `
- Extract all key points, decisions, and action items
- Organize content by topic in a logical structure 
- Use comprehensive markdown formatting to enhance readability
- Clearly highlight important decisions and assignments in bold
- Ensure all action items are captured with owners and deadlines
- Keep the summary concise yet comprehensive`}

## Required Output Structure
Your summary MUST follow this exact structure:

1. **Meeting Title (H1 heading)** - Create a descriptive title for the meeting
2. **Meeting Overview (H2 heading)** - Brief 2-3 sentence overview of the meeting purpose and outcome
3. **Participants (H2 heading)** - List of participants identified from the transcript
4. **Key Discussion Points (H2 heading)** - Organize by topics as H3 headings
   - Include bullet points for specific details
   - Use sub-bullets for supporting information
   - Use **bold text** to highlight important decisions
5. **Action Items (H2 heading)** - Create a table with these exact columns:
   | Task | Owner | Deadline | Priority |
   |------|-------|----------|----------|
6. **Next Steps (H2 heading)** - List upcoming actions and follow-ups
7. **Conclusion (H2 heading)** - Brief summary of meeting outcome

## Markdown Formatting Requirements
- Use # for main heading (title)
- Use ## for section headings
- Use ### for topic subheadings
- Use - for bullet points and nested bullets
- Use **bold** for emphasis and important decisions
- Use \`code\` for technical terms or specific references
- Use > for important quotes from participants
- Use --- for section separators where appropriate
- Use properly formatted tables with aligned columns for action items

Example structure to follow precisely:
\`\`\`markdown
# Q3 Product Roadmap Meeting

## Meeting Overview
This meeting focused on finalizing the Q3 product roadmap. The team reviewed current progress, prioritized features, and assigned responsibilities for upcoming deliverables.

## Participants
- Jane Smith (Product Manager)
- Michael Chen (Engineering Lead)
- Priya Patel (UX Designer)
- Robert Johnson (QA Manager)
- Sarah Williams (Marketing Director)

## Key Discussion Points
### Current Sprint Status
- Sprint 27 is currently at 85% completion
  - 7 user stories completed
  - 2 stories at risk due to API integration issues
- **Decision made**: Team will extend current sprint by 2 days to complete all stories
- QA team reported 20% reduction in regression bugs after implementing new test framework

### Q3 Feature Prioritization
- Customer feedback analysis shows high demand for mobile payment integration
- **Decision made**: Mobile payments will be the top priority feature for Q3
- Security team requirements must be addressed before development starts
- > "We should involve the security team from day one" - Michael Chen

### Resource Allocation
- Backend team needs an additional developer for API work
- UX team will complete designs by June 15th
- **Decision made**: Marketing launch will be scheduled for August 30th

---

## Action Items
| Task | Owner | Deadline | Priority |
|------|-------|----------|----------|
| Create mobile payment security spec | Michael | 2025-06-10 | High |
| Complete API documentation | Robert | 2025-06-15 | Medium |
| Finalize UX designs | Priya | 2025-06-15 | High |
| Schedule user testing sessions | Sarah | 2025-07-05 | Medium |
| Update project timeline | Jane | 2025-06-05 | High |

## Next Steps
- Schedule follow-up meeting for June 20th
- Distribute updated roadmap to all stakeholders
- Begin security planning sessions with external consultant

## Conclusion
The Q3 roadmap was successfully finalized with clear priorities and ownership. Mobile payments will be the flagship feature, with a target launch date of August 30th. All team members are aligned on priorities and deadlines.
\`\`\`

Make sure your summary is highly structured, visually organized, and captures all important aspects of the meeting. The Groq model excels at this type of structured output.
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
