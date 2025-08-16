/**
 * Cache utility for AI Meeting Summarizer
 * 
 * Provides in-memory caching to improve performance for
 * expensive operations like AI requests.
 */

const mcache = require('memory-cache');
const logger = require('./logger');

/**
 * Cache middleware factory function
 * Creates middleware that caches responses by key
 * 
 * @param {number} duration - Cache duration in seconds
 * @param {Function} keyGenerator - Optional function to generate cache key
 * @returns {Function} Express middleware function
 */
function cache(duration, keyGenerator) {
  return (req, res, next) => {
    // Skip caching for non-GET requests or when explicitly marked
    if (req.method !== 'GET' || req.skipCache === true) {
      return next();
    }
    
    // Generate cache key
    const key = keyGenerator ? 
      keyGenerator(req) : 
      `__express__${req.originalUrl || req.url}`;
    
    // Check if we have a cached response
    const cachedBody = mcache.get(key);
    
    if (cachedBody) {
      // Return cached response
      logger.debug(`Cache hit for ${key}`);
      
      // Set header to indicate cache was used
      res.setHeader('X-Cache', 'HIT');
      
      // If cached response is an error, return it with the original status
      if (cachedBody.isError) {
        return res.status(cachedBody.status).json(cachedBody.body);
      }
      
      return res.json(cachedBody);
    }

    // Cache miss - capture the response to cache it
    logger.debug(`Cache miss for ${key}`);
    res.setHeader('X-Cache', 'MISS');
    
    // Intercept the response to cache it
    const originalSend = res.json;
    
    res.json = function(body) {
      // Don't cache errors by default
      const shouldCache = res.statusCode >= 200 && res.statusCode < 400;
      
      if (shouldCache) {
        mcache.put(key, body, duration * 1000);
        logger.debug(`Cached response for ${key} (${duration}s)`);
      }
      
      // For error responses, we might want to cache them too in some cases
      // to prevent repeated expensive calls that we know will fail
      if (!shouldCache && req.cacheEvenErrors) {
        mcache.put(key, {
          isError: true,
          status: res.statusCode,
          body: body
        }, duration * 1000);
        logger.debug(`Cached error response for ${key} (${duration}s)`);
      }
      
      originalSend.call(this, body);
      return res;
    };
    
    next();
  };
}

/**
 * Invalidate a specific cache entry
 * @param {string} key - Cache key to invalidate
 */
function invalidateCache(key) {
  mcache.del(key);
  logger.debug(`Invalidated cache for ${key}`);
}

/**
 * Clear the entire cache
 */
function clearCache() {
  mcache.clear();
  logger.info('Cache cleared');
}

/**
 * Get cache stats
 * @returns {Object} Cache statistics
 */
function getCacheStats() {
  return {
    size: mcache.size(),
    hits: mcache.hits(),
    misses: mcache.misses(),
    keys: mcache.keys()
  };
}

module.exports = {
  cache,
  invalidateCache,
  clearCache,
  getCacheStats
};
