/**
 * @fileoverview Cross-Domain Context Manager for the Contextual Intelligence Tentacle.
 * Handles context translation and preservation across different domains and applications.
 * 
 * @author Aideon AI Team
 * @version 1.0.0
 */

const EventEmitter = require('events');
const { deepClone, deepMerge } = require('../../utils/object_utils');

/**
 * Manages context translation and preservation across different domains and applications.
 */
class CrossDomainContextManager {
  /**
   * Creates a new CrossDomainContextManager instance.
   * @param {Object} options - Configuration options
   * @param {Map} options.domainMappings - Initial domain mappings
   * @param {Map} options.contextTranslators - Initial context translators
   * @param {EventEmitter} options.eventEmitter - Event emitter for cross-domain events
   */
  constructor(options = {}) {
    this.domainMappings = options.domainMappings || new Map();
    this.contextTranslators = options.contextTranslators || new Map();
    this.eventEmitter = options.eventEmitter || new EventEmitter();
    this.translationCache = new Map();
    this.domainRelationships = new Map();
    this.translationHistory = [];
    this.maxHistoryLength = options.maxHistoryLength || 100;
  }

  /**
   * Registers a mapping between two domains.
   * @param {string} sourceDomain - The source domain path
   * @param {string} targetDomain - The target domain path
   * @param {Object} mapping - The mapping definition
   * @returns {boolean} - True if registration was successful
   */
  registerDomainMapping(sourceDomain, targetDomain, mapping) {
    try {
      if (!sourceDomain || !targetDomain) {
        throw new Error('Source and target domains must be specified');
      }

      if (!mapping || typeof mapping !== 'object') {
        throw new Error('Mapping must be an object');
      }

      const key = `${sourceDomain}:${targetDomain}`;
      this.domainMappings.set(key, mapping);

      // Register the domain relationship
      if (!this.domainRelationships.has(sourceDomain)) {
        this.domainRelationships.set(sourceDomain, new Set());
      }
      this.domainRelationships.get(sourceDomain).add(targetDomain);

      // Clear any cached translations for this mapping
      this.clearTranslationCache(sourceDomain, targetDomain);

      this.eventEmitter.emit('domain:mapping:registered', {
        sourceDomain,
        targetDomain,
        mapping
      });

      return true;
    } catch (error) {
      this.eventEmitter.emit('domain:error', {
        operation: 'registerDomainMapping',
        sourceDomain,
        targetDomain,
        error: error.message
      });
      return false;
    }
  }

  /**
   * Registers a custom translator function for context translation.
   * @param {string} sourceDomain - The source domain path
   * @param {string} targetDomain - The target domain path
   * @param {Function} translator - The translator function
   * @returns {boolean} - True if registration was successful
   */
  registerContextTranslator(sourceDomain, targetDomain, translator) {
    try {
      if (!sourceDomain || !targetDomain) {
        throw new Error('Source and target domains must be specified');
      }

      if (typeof translator !== 'function') {
        throw new Error('Translator must be a function');
      }

      const key = `${sourceDomain}:${targetDomain}`;
      this.contextTranslators.set(key, translator);

      // Clear any cached translations for this translator
      this.clearTranslationCache(sourceDomain, targetDomain);

      this.eventEmitter.emit('domain:translator:registered', {
        sourceDomain,
        targetDomain
      });

      return true;
    } catch (error) {
      this.eventEmitter.emit('domain:error', {
        operation: 'registerContextTranslator',
        sourceDomain,
        targetDomain,
        error: error.message
      });
      return false;
    }
  }

  /**
   * Translates context from one domain to another.
   * @param {string} sourceDomain - The source domain path
   * @param {string} targetDomain - The target domain path
   * @param {Object} sourceContext - The source context to translate
   * @param {Object} [options] - Translation options
   * @param {boolean} [options.useCache=true] - Whether to use cached translations
   * @param {boolean} [options.recordHistory=true] - Whether to record translation in history
   * @returns {Object|null} - The translated context or null if translation failed
   */
  translateContext(sourceDomain, targetDomain, sourceContext, options = {}) {
    const useCache = options.useCache !== undefined ? options.useCache : true;
    const recordHistory = options.recordHistory !== undefined ? options.recordHistory : true;
    
    try {
      if (!sourceDomain || !targetDomain) {
        throw new Error('Source and target domains must be specified');
      }

      if (!sourceContext || typeof sourceContext !== 'object') {
        throw new Error('Source context must be an object');
      }

      // Check if we have a cached translation
      const cacheKey = this.getCacheKey(sourceDomain, targetDomain, sourceContext);
      if (useCache && this.translationCache.has(cacheKey)) {
        return deepClone(this.translationCache.get(cacheKey));
      }

      // Try to use a custom translator first
      const translatorKey = `${sourceDomain}:${targetDomain}`;
      if (this.contextTranslators.has(translatorKey)) {
        const translator = this.contextTranslators.get(translatorKey);
        const translatedContext = translator(deepClone(sourceContext));
        
        // Cache the translation
        if (useCache) {
          this.translationCache.set(cacheKey, deepClone(translatedContext));
        }

        // Record in history
        if (recordHistory) {
          this.recordTranslation(sourceDomain, targetDomain, sourceContext, translatedContext);
        }

        return translatedContext;
      }

      // Fall back to using domain mapping
      if (this.domainMappings.has(translatorKey)) {
        const mapping = this.domainMappings.get(translatorKey);
        const translatedContext = this.applyMapping(sourceContext, mapping);
        
        // Cache the translation
        if (useCache) {
          this.translationCache.set(cacheKey, deepClone(translatedContext));
        }

        // Record in history
        if (recordHistory) {
          this.recordTranslation(sourceDomain, targetDomain, sourceContext, translatedContext);
        }

        return translatedContext;
      }

      // If no direct mapping exists, try to find a path through intermediate domains
      const translationPath = this.findTranslationPath(sourceDomain, targetDomain);
      if (translationPath && translationPath.length > 1) {
        let currentContext = deepClone(sourceContext);
        
        for (let i = 0; i < translationPath.length - 1; i++) {
          const currentDomain = translationPath[i];
          const nextDomain = translationPath[i + 1];
          
          currentContext = this.translateContext(
            currentDomain, 
            nextDomain, 
            currentContext, 
            { useCache, recordHistory: false }
          );
          
          if (!currentContext) {
            throw new Error(`Failed to translate from ${currentDomain} to ${nextDomain}`);
          }
        }
        
        // Record the full path translation in history
        if (recordHistory) {
          this.recordTranslation(sourceDomain, targetDomain, sourceContext, currentContext);
        }
        
        return currentContext;
      }

      throw new Error(`No translation path found from ${sourceDomain} to ${targetDomain}`);
    } catch (error) {
      this.eventEmitter.emit('domain:error', {
        operation: 'translateContext',
        sourceDomain,
        targetDomain,
        error: error.message
      });
      return null;
    }
  }

  /**
   * Applies a mapping to a source context.
   * @param {Object} sourceContext - The source context
   * @param {Object} mapping - The mapping to apply
   * @returns {Object} - The translated context
   * @private
   */
  applyMapping(sourceContext, mapping) {
    const result = {};

    // Process direct mappings
    for (const [targetKey, sourcePath] of Object.entries(mapping.direct || {})) {
      const value = this.getValueByPath(sourceContext, sourcePath);
      if (value !== undefined) {
        this.setValueByPath(result, targetKey, value);
      }
    }

    // Process transformations
    for (const [targetKey, transform] of Object.entries(mapping.transforms || {})) {
      const sourcePath = transform.source;
      const transformFn = transform.function;
      
      if (sourcePath && transformFn) {
        const value = this.getValueByPath(sourceContext, sourcePath);
        if (value !== undefined) {
          try {
            // Execute the transformation function
            const transformedValue = new Function('value', `return ${transformFn}`)(value);
            this.setValueByPath(result, targetKey, transformedValue);
          } catch (error) {
            this.eventEmitter.emit('domain:error', {
              operation: 'applyMapping:transform',
              targetKey,
              error: error.message
            });
          }
        }
      }
    }

    // Process defaults
    for (const [targetKey, defaultValue] of Object.entries(mapping.defaults || {})) {
      if (this.getValueByPath(result, targetKey) === undefined) {
        this.setValueByPath(result, targetKey, defaultValue);
      }
    }

    return result;
  }

  /**
   * Gets a value from an object by path.
   * @param {Object} obj - The object to get from
   * @param {string} path - The path to the value
   * @returns {*} - The value or undefined if not found
   * @private
   */
  getValueByPath(obj, path) {
    const parts = path.split('.');
    let current = obj;
    
    for (const part of parts) {
      if (current === null || current === undefined) {
        return undefined;
      }
      current = current[part];
    }
    
    return current;
  }

  /**
   * Sets a value in an object by path.
   * @param {Object} obj - The object to set in
   * @param {string} path - The path to set at
   * @param {*} value - The value to set
   * @private
   */
  setValueByPath(obj, path, value) {
    const parts = path.split('.');
    let current = obj;
    
    for (let i = 0; i < parts.length - 1; i++) {
      const part = parts[i];
      if (!(part in current)) {
        current[part] = {};
      }
      current = current[part];
    }
    
    current[parts[parts.length - 1]] = value;
  }

  /**
   * Finds a path for translating between domains.
   * @param {string} sourceDomain - The source domain
   * @param {string} targetDomain - The target domain
   * @returns {Array<string>|null} - Array of domains forming a path or null if no path found
   * @private
   */
  findTranslationPath(sourceDomain, targetDomain) {
    // Breadth-first search to find a path
    const visited = new Set();
    const queue = [[sourceDomain]];
    
    while (queue.length > 0) {
      const path = queue.shift();
      const currentDomain = path[path.length - 1];
      
      if (currentDomain === targetDomain) {
        return path;
      }
      
      if (!visited.has(currentDomain)) {
        visited.add(currentDomain);
        
        // Get all domains that can be reached from the current domain
        const relatedDomains = this.domainRelationships.get(currentDomain) || new Set();
        
        for (const nextDomain of relatedDomains) {
          if (!visited.has(nextDomain)) {
            queue.push([...path, nextDomain]);
          }
        }
      }
    }
    
    return null;
  }

  /**
   * Gets a cache key for a translation.
   * @param {string} sourceDomain - The source domain
   * @param {string} targetDomain - The target domain
   * @param {Object} sourceContext - The source context
   * @returns {string} - The cache key
   * @private
   */
  getCacheKey(sourceDomain, targetDomain, sourceContext) {
    // Simple implementation - in production, use a more robust hashing mechanism
    return `${sourceDomain}:${targetDomain}:${JSON.stringify(sourceContext)}`;
  }

  /**
   * Clears the translation cache for a specific domain pair.
   * @param {string} sourceDomain - The source domain
   * @param {string} targetDomain - The target domain
   * @private
   */
  clearTranslationCache(sourceDomain, targetDomain) {
    const prefix = `${sourceDomain}:${targetDomain}:`;
    
    for (const key of this.translationCache.keys()) {
      if (key.startsWith(prefix)) {
        this.translationCache.delete(key);
      }
    }
  }

  /**
   * Records a translation in the history.
   * @param {string} sourceDomain - The source domain
   * @param {string} targetDomain - The target domain
   * @param {Object} sourceContext - The source context
   * @param {Object} targetContext - The translated context
   * @private
   */
  recordTranslation(sourceDomain, targetDomain, sourceContext, targetContext) {
    const translation = {
      timestamp: Date.now(),
      sourceDomain,
      targetDomain,
      sourceContext: deepClone(sourceContext),
      targetContext: deepClone(targetContext)
    };
    
    this.translationHistory.unshift(translation);
    
    // Trim history if it exceeds the maximum length
    if (this.translationHistory.length > this.maxHistoryLength) {
      this.translationHistory = this.translationHistory.slice(0, this.maxHistoryLength);
    }
  }

  /**
   * Gets the translation history.
   * @param {number} [limit] - Maximum number of history items to return
   * @returns {Array<Object>} - The translation history
   */
  getTranslationHistory(limit) {
    if (limit && limit > 0) {
      return deepClone(this.translationHistory.slice(0, limit));
    }
    return deepClone(this.translationHistory);
  }

  /**
   * Gets all domains that can be translated to from a source domain.
   * @param {string} sourceDomain - The source domain
   * @returns {Array<string>} - Array of target domains
   */
  getTranslatableTargetDomains(sourceDomain) {
    const directTargets = Array.from(this.domainRelationships.get(sourceDomain) || []);
    const result = new Set(directTargets);
    
    // Also find indirect targets (reachable through a path)
    for (const directTarget of directTargets) {
      const indirectTargets = this.getTranslatableTargetDomains(directTarget);
      for (const indirectTarget of indirectTargets) {
        result.add(indirectTarget);
      }
    }
    
    return Array.from(result);
  }

  /**
   * Gets all domains that can be translated from to a target domain.
   * @param {string} targetDomain - The target domain
   * @returns {Array<string>} - Array of source domains
   */
  getTranslatableSourceDomains(targetDomain) {
    const result = new Set();
    
    // Find all domains that have the target domain in their relationships
    for (const [sourceDomain, targets] of this.domainRelationships.entries()) {
      if (targets.has(targetDomain)) {
        result.add(sourceDomain);
        
        // Also find indirect sources
        const indirectSources = this.getTranslatableSourceDomains(sourceDomain);
        for (const indirectSource of indirectSources) {
          result.add(indirectSource);
        }
      }
    }
    
    return Array.from(result);
  }

  /**
   * Checks if a translation is possible between two domains.
   * @param {string} sourceDomain - The source domain
   * @param {string} targetDomain - The target domain
   * @returns {boolean} - True if translation is possible
   */
  canTranslate(sourceDomain, targetDomain) {
    // Direct translation
    const directKey = `${sourceDomain}:${targetDomain}`;
    if (this.contextTranslators.has(directKey) || this.domainMappings.has(directKey)) {
      return true;
    }
    
    // Path-based translation
    return this.findTranslationPath(sourceDomain, targetDomain) !== null;
  }

  /**
   * Gets all registered domain mappings.
   * @returns {Object} - Object with all domain mappings
   */
  getAllDomainMappings() {
    const result = {};
    
    for (const [key, mapping] of this.domainMappings.entries()) {
      result[key] = deepClone(mapping);
    }
    
    return result;
  }

  /**
   * Resets the cross-domain manager to its initial state.
   */
  reset() {
    this.domainMappings.clear();
    this.contextTranslators.clear();
    this.translationCache.clear();
    this.domainRelationships.clear();
    this.translationHistory = [];
    
    this.eventEmitter.emit('domain:reset');
  }
}

module.exports = CrossDomainContextManager;
