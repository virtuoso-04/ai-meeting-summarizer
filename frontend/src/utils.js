/**
 * Utility functions for validation and data handling
 */

// Email validation regex
export const isValidEmail = (email) => {
  const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return regex.test(email);
};

// Safely format errors from API responses
export const formatErrorMessage = (error) => {
  if (!error) return 'An unknown error occurred';
  
  if (typeof error === 'string') return error;
  
  if (error.message) return error.message;
  
  if (error.error) {
    if (error.details) return `${error.error}: ${error.details}`;
    return error.error;
  }
  
  return 'An unknown error occurred';
};

// Truncate text to a specific length with ellipsis
export const truncateText = (text, maxLength = 100) => {
  if (!text) return '';
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + '...';
};

// Format byte sizes to human readable format
export const formatBytes = (bytes, decimals = 2) => {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(decimals)) + ' ' + sizes[i];
};

// Extract file extension
export const getFileExtension = (filename) => {
  if (!filename) return '';
  return '.' + filename.split('.').pop().toLowerCase();
};

// Check if the file type is supported
export const isSupportedFileType = (filename, supportedTypes = ['.txt', '.md', '.doc', '.docx', '.pdf']) => {
  const extension = getFileExtension(filename);
  return supportedTypes.includes(extension);
};

// Handle API timeouts
export const fetchWithTimeout = async (url, options = {}, timeoutMs = 30000) => {
  const controller = new AbortController();
  const { signal } = controller;
  
  const timeout = setTimeout(() => {
    controller.abort();
  }, timeoutMs);
  
  try {
    const response = await fetch(url, { ...options, signal });
    clearTimeout(timeout);
    return response;
  } catch (error) {
    clearTimeout(timeout);
    if (error.name === 'AbortError') {
      throw new Error('Request timed out');
    }
    throw error;
  }
};

// Detect network connectivity issues
export const isOnline = () => {
  return navigator.onLine;
};

// Safe JSON parsing
export const safeJsonParse = (json) => {
  try {
    return JSON.parse(json);
  } catch (error) {
    console.error('JSON parse error:', error);
    return null;
  }
};
