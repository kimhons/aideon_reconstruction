/**
 * @fileoverview Object utilities for the Aideon SDK.
 * Provides deep cloning, merging, and other object manipulation functions.
 * 
 * @author Aideon AI Team
 * @version 1.0.0
 */

/**
 * Deep clones an object.
 * @param {*} obj - The object to clone
 * @returns {*} The cloned object
 */
function deepClone(obj) {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }
  
  if (obj instanceof Date) {
    return new Date(obj.getTime());
  }
  
  if (obj instanceof RegExp) {
    return new RegExp(obj);
  }
  
  if (obj instanceof Map) {
    const clone = new Map();
    
    for (const [key, value] of obj.entries()) {
      clone.set(deepClone(key), deepClone(value));
    }
    
    return clone;
  }
  
  if (obj instanceof Set) {
    const clone = new Set();
    
    for (const value of obj.values()) {
      clone.add(deepClone(value));
    }
    
    return clone;
  }
  
  if (Array.isArray(obj)) {
    return obj.map(item => deepClone(item));
  }
  
  const clone = {};
  
  for (const [key, value] of Object.entries(obj)) {
    clone[key] = deepClone(value);
  }
  
  return clone;
}

/**
 * Deep merges objects.
 * @param {Object} target - The target object
 * @param {...Object} sources - The source objects
 * @returns {Object} The merged object
 */
function deepMerge(target, ...sources) {
  if (!sources.length) {
    return target;
  }
  
  const source = sources.shift();
  
  if (source === undefined) {
    return target;
  }
  
  if (isObject(target) && isObject(source)) {
    for (const key in source) {
      if (isObject(source[key])) {
        if (!target[key]) {
          Object.assign(target, { [key]: {} });
        }
        
        deepMerge(target[key], source[key]);
      } else {
        Object.assign(target, { [key]: source[key] });
      }
    }
  }
  
  return deepMerge(target, ...sources);
}

/**
 * Checks if a value is an object.
 * @param {*} value - The value to check
 * @returns {boolean} True if the value is an object
 * @private
 */
function isObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value);
}

/**
 * Gets a value from an object by path.
 * @param {Object} obj - The object
 * @param {string} path - The path (dot notation)
 * @param {*} [defaultValue] - The default value if path not found
 * @returns {*} The value
 */
function getPath(obj, path, defaultValue) {
  if (!obj || !path) {
    return defaultValue;
  }
  
  const parts = path.split('.');
  let current = obj;
  
  for (const part of parts) {
    if (current === undefined || current === null) {
      return defaultValue;
    }
    
    current = current[part];
  }
  
  return current !== undefined ? current : defaultValue;
}

/**
 * Sets a value in an object by path.
 * @param {Object} obj - The object
 * @param {string} path - The path (dot notation)
 * @param {*} value - The value
 * @returns {Object} The updated object
 */
function setPath(obj, path, value) {
  if (!obj || !path) {
    return obj;
  }
  
  const parts = path.split('.');
  let current = obj;
  
  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i];
    
    if (current[part] === undefined) {
      current[part] = {};
    }
    
    current = current[part];
  }
  
  current[parts[parts.length - 1]] = value;
  
  return obj;
}

/**
 * Deletes a value from an object by path.
 * @param {Object} obj - The object
 * @param {string} path - The path (dot notation)
 * @returns {boolean} True if deletion was successful
 */
function deletePath(obj, path) {
  if (!obj || !path) {
    return false;
  }
  
  const parts = path.split('.');
  let current = obj;
  
  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i];
    
    if (current[part] === undefined) {
      return false;
    }
    
    current = current[part];
  }
  
  return delete current[parts[parts.length - 1]];
}

/**
 * Flattens an object.
 * @param {Object} obj - The object to flatten
 * @param {string} [prefix=''] - The prefix for keys
 * @param {Object} [result={}] - The result object
 * @returns {Object} The flattened object
 */
function flattenObject(obj, prefix = '', result = {}) {
  for (const [key, value] of Object.entries(obj)) {
    const newKey = prefix ? `${prefix}.${key}` : key;
    
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      flattenObject(value, newKey, result);
    } else {
      result[newKey] = value;
    }
  }
  
  return result;
}

/**
 * Unflatten an object.
 * @param {Object} obj - The flattened object
 * @returns {Object} The unflattened object
 */
function unflattenObject(obj) {
  const result = {};
  
  for (const [key, value] of Object.entries(obj)) {
    setPath(result, key, value);
  }
  
  return result;
}

/**
 * Picks properties from an object.
 * @param {Object} obj - The object
 * @param {Array<string>} keys - The keys to pick
 * @returns {Object} The new object with picked properties
 */
function pick(obj, keys) {
  const result = {};
  
  for (const key of keys) {
    if (obj.hasOwnProperty(key)) {
      result[key] = obj[key];
    }
  }
  
  return result;
}

/**
 * Omits properties from an object.
 * @param {Object} obj - The object
 * @param {Array<string>} keys - The keys to omit
 * @returns {Object} The new object without omitted properties
 */
function omit(obj, keys) {
  const result = { ...obj };
  
  for (const key of keys) {
    delete result[key];
  }
  
  return result;
}

// Export object utilities
module.exports = {
  deepClone,
  deepMerge,
  getPath,
  setPath,
  deletePath,
  flattenObject,
  unflattenObject,
  pick,
  omit
};
