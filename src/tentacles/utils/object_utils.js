/**
 * @fileoverview Object utility functions for the Contextual Intelligence Tentacle.
 * Provides utility functions for deep cloning, deep merging, and path manipulation.
 * 
 * @author Aideon AI Team
 * @version 1.0.0
 */

/**
 * Creates a deep clone of an object.
 * @param {*} obj - The object to clone
 * @returns {*} - A deep clone of the object
 */
function deepClone(obj) {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }

  // Handle Date
  if (obj instanceof Date) {
    return new Date(obj.getTime());
  }

  // Handle Array
  if (Array.isArray(obj)) {
    return obj.map(item => deepClone(item));
  }

  // Handle Object
  const clone = {};
  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      clone[key] = deepClone(obj[key]);
    }
  }

  return clone;
}

/**
 * Performs a deep merge of two objects.
 * @param {Object} target - The target object
 * @param {Object} source - The source object
 * @returns {Object} - The merged object
 */
function deepMerge(target, source) {
  if (target === null || typeof target !== 'object') {
    target = {};
  }

  if (source === null || typeof source !== 'object') {
    return target;
  }

  const result = { ...target };

  for (const key in source) {
    if (Object.prototype.hasOwnProperty.call(source, key)) {
      if (source[key] instanceof Date) {
        result[key] = new Date(source[key].getTime());
      } else if (Array.isArray(source[key])) {
        result[key] = [...source[key]];
      } else if (typeof source[key] === 'object' && source[key] !== null) {
        if (typeof result[key] === 'object' && result[key] !== null) {
          result[key] = deepMerge(result[key], source[key]);
        } else {
          result[key] = deepClone(source[key]);
        }
      } else {
        result[key] = source[key];
      }
    }
  }

  return result;
}

/**
 * Converts a path string to an array of path parts.
 * @param {string} path - The path string
 * @param {string} [separator='.'] - The path separator
 * @returns {Array<string>} - Array of path parts
 */
function pathToArray(path, separator = '.') {
  if (!path || typeof path !== 'string') {
    return [];
  }
  return path.split(separator);
}

/**
 * Converts an array of path parts to a path string.
 * @param {Array<string>} pathArray - Array of path parts
 * @param {string} [separator='.'] - The path separator
 * @returns {string} - The path string
 */
function arrayToPath(pathArray, separator = '.') {
  if (!Array.isArray(pathArray)) {
    return '';
  }
  return pathArray.join(separator);
}

module.exports = {
  deepClone,
  deepMerge,
  pathToArray,
  arrayToPath
};
