
const fs = require('fs').promises;
const path = require('path');
const logger = require('./logger');

const SUPPORTED_TYPES = {
  '.txt': 'text/plain',
  '.md': 'text/markdown',
  '.json': 'application/json',
  '.csv': 'text/csv',
  '.html': 'text/html',
};

/**
 * Process a text file and extract its content
 * 
 * @param {Buffer|string} fileBuffer - File content as buffer or file path
 * @param {string} fileName - Original file name with extension
 * @param {Object} options - Processing options
 * @returns {Promise<string>} Extracted text content
 */
async function extractTextFromFile(fileBuffer, fileName, options = {}) {
  try {
    const fileExtension = path.extname(fileName).toLowerCase();
    let content;
    
    // Handle buffers or file paths
    if (typeof fileBuffer === 'string') {
      // It's a path, read the file
      fileBuffer = await fs.readFile(fileBuffer);
    }
    
    // Check if we support this file type
    if (!SUPPORTED_TYPES[fileExtension]) {
      logger.warn(`Unsupported file type: ${fileExtension}`);
      throw new Error(`Unsupported file type: ${fileExtension}`);
    }
    
    // Process based on file type
    switch (fileExtension) {
      case '.txt':
      case '.md':
        content = fileBuffer.toString('utf8');
        break;
        
      case '.json':
        const jsonData = JSON.parse(fileBuffer.toString('utf8'));
        // Extract text field or stringify the whole object
        content = jsonData.text || jsonData.transcript || JSON.stringify(jsonData, null, 2);
        break;
        
      case '.csv':
        // Simple CSV to text conversion
        content = fileBuffer.toString('utf8')
          .split('\n')
          .map(line => line.split(',').join(' | '))
          .join('\n');
        break;
        
      case '.html':
        // Very simple HTML tag removal
        content = fileBuffer.toString('utf8')
          .replace(/<[^>]*>?/gm, ' ')
          .replace(/\s+/g, ' ')
          .trim();
        break;
        
      default:
        content = fileBuffer.toString('utf8');
    }
    
    // Apply text transformations if specified
    if (options.trim !== false) {
      content = content.trim();
    }
    
    if (options.maxLength && content.length > options.maxLength) {
      content = content.substring(0, options.maxLength);
      logger.info(`Content truncated to ${options.maxLength} characters`);
    }
    
    return content;
  } catch (error) {
    logger.error(`Error processing file ${fileName}: ${error.message}`);
    throw new Error(`Failed to process file: ${error.message}`);
  }
}

/**
 * Sanitize a filename to be safe for saving
 * 
 * @param {string} filename - Original filename
 * @returns {string} Sanitized filename
 */
function sanitizeFilename(filename) {
  // Replace unsafe chars with underscores
  return filename
    .replace(/[/\\?%*:|"<>]/g, '_')
    .replace(/\s+/g, '_');
}

/**
 * Save content to a file
 * 
 * @param {string} content - Content to save
 * @param {string} filename - Target filename
 * @param {string} directory - Target directory (default: 'temp')
 * @returns {Promise<string>} Path to the saved file
 */
async function saveToFile(content, filename, directory = 'temp') {
  try {
    // Create directory if it doesn't exist
    const dirPath = path.resolve(process.cwd(), directory);
    
    try {
      await fs.mkdir(dirPath, { recursive: true });
    } catch (err) {
      if (err.code !== 'EEXIST') {
        throw err;
      }
    }
    
    // Sanitize filename and save
    const sanitized = sanitizeFilename(filename);
    const filePath = path.join(dirPath, sanitized);
    
    await fs.writeFile(filePath, content, 'utf8');
    logger.info(`File saved successfully: ${filePath}`);
    
    return filePath;
  } catch (error) {
    logger.error(`Error saving file ${filename}: ${error.message}`);
    throw new Error(`Failed to save file: ${error.message}`);
  }
}

/**
 * Create a downloadable markdown file from summary content
 * 
 * @param {string} summary - Summary content
 * @param {string} title - Summary title
 * @returns {Promise<string>} Path to the markdown file
 */
async function createMarkdownSummary(summary, title = 'Meeting Summary') {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `${title.toLowerCase().replace(/\s+/g, '_')}_${timestamp}.md`;
  
  // Format content as markdown
  const markdownContent = `# ${title}\n\n${summary}\n\n---\n*Generated on ${new Date().toLocaleString()}*`;
  
  return await saveToFile(markdownContent, filename, 'summaries');
}

module.exports = {
  extractTextFromFile,
  sanitizeFilename,
  saveToFile,
  createMarkdownSummary,
  SUPPORTED_TYPES
};
