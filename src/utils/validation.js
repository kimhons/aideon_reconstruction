/**
 * @fileoverview Validation utilities for Aideon components.
 * Provides common validation functions used across the system.
 * 
 * @author Aideon AI Team
 * @version 1.0.0
 */

/**
 * Validates that a value is defined (not undefined or null).
 * @param {*} value - The value to validate
 * @param {string} [name] - Optional name for error message
 * @throws {Error} If the value is undefined or null
 * @returns {*} The original value if valid
 */
function validateDefined(value, name = 'Value') {
  if (value === undefined || value === null) {
    throw new Error(`${name} is required and cannot be undefined or null`);
  }
  return value;
}

/**
 * Validates that a value is of a specific type.
 * @param {*} value - The value to validate
 * @param {string} type - Expected type ('string', 'number', 'boolean', 'object', 'function', 'array')
 * @param {string} [name] - Optional name for error message
 * @throws {Error} If the value is not of the expected type
 * @returns {*} The original value if valid
 */
function validateType(value, type, name = 'Value') {
  if (value === undefined || value === null) {
    throw new Error(`${name} is required and cannot be undefined or null`);
  }
  
  if (type === 'array') {
    if (!Array.isArray(value)) {
      throw new Error(`${name} must be an array`);
    }
  } else if (type === 'object') {
    if (typeof value !== 'object' || Array.isArray(value) || value === null) {
      throw new Error(`${name} must be an object`);
    }
  } else if (typeof value !== type) {
    throw new Error(`${name} must be a ${type}`);
  }
  
  return value;
}

/**
 * Validates that a string is not empty.
 * @param {string} value - The string to validate
 * @param {string} [name] - Optional name for error message
 * @throws {Error} If the string is empty
 * @returns {string} The original string if valid
 */
function validateNonEmptyString(value, name = 'String') {
  validateType(value, 'string', name);
  
  if (value.trim() === '') {
    throw new Error(`${name} cannot be empty`);
  }
  
  return value;
}

/**
 * Validates that a number is within a specified range.
 * @param {number} value - The number to validate
 * @param {number} [min] - Optional minimum value (inclusive)
 * @param {number} [max] - Optional maximum value (inclusive)
 * @param {string} [name] - Optional name for error message
 * @throws {Error} If the number is outside the specified range
 * @returns {number} The original number if valid
 */
function validateNumberInRange(value, min = null, max = null, name = 'Number') {
  validateType(value, 'number', name);
  
  if (min !== null && value < min) {
    throw new Error(`${name} must be greater than or equal to ${min}`);
  }
  
  if (max !== null && value > max) {
    throw new Error(`${name} must be less than or equal to ${max}`);
  }
  
  return value;
}

/**
 * Validates that an array has a minimum length.
 * @param {Array} array - The array to validate
 * @param {number} minLength - Minimum required length
 * @param {string} [name] - Optional name for error message
 * @throws {Error} If the array length is less than the minimum
 * @returns {Array} The original array if valid
 */
function validateArrayMinLength(array, minLength, name = 'Array') {
  validateType(array, 'array', name);
  
  if (array.length < minLength) {
    throw new Error(`${name} must have at least ${minLength} element${minLength === 1 ? '' : 's'}`);
  }
  
  return array;
}

/**
 * Validates that an array has a maximum length.
 * @param {Array} array - The array to validate
 * @param {number} maxLength - Maximum allowed length
 * @param {string} [name] - Optional name for error message
 * @throws {Error} If the array length is greater than the maximum
 * @returns {Array} The original array if valid
 */
function validateArrayMaxLength(array, maxLength, name = 'Array') {
  validateType(array, 'array', name);
  
  if (array.length > maxLength) {
    throw new Error(`${name} must have at most ${maxLength} element${maxLength === 1 ? '' : 's'}`);
  }
  
  return array;
}

/**
 * Validates that an object has required properties.
 * @param {Object} obj - The object to validate
 * @param {Array<string>} requiredProps - Array of required property names
 * @param {string} [name] - Optional name for error message
 * @throws {Error} If any required property is missing
 * @returns {Object} The original object if valid
 */
function validateRequiredProperties(obj, requiredProps, name = 'Object') {
  validateType(obj, 'object', name);
  validateType(requiredProps, 'array', 'requiredProps');
  
  for (const prop of requiredProps) {
    if (!(prop in obj)) {
      throw new Error(`${name} is missing required property: ${prop}`);
    }
  }
  
  return obj;
}

/**
 * Validates that a value is one of a set of allowed values.
 * @param {*} value - The value to validate
 * @param {Array} allowedValues - Array of allowed values
 * @param {string} [name] - Optional name for error message
 * @throws {Error} If the value is not in the allowed set
 * @returns {*} The original value if valid
 */
function validateAllowedValues(value, allowedValues, name = 'Value') {
  validateDefined(value, name);
  validateType(allowedValues, 'array', 'allowedValues');
  
  if (!allowedValues.includes(value)) {
    throw new Error(`${name} must be one of: ${allowedValues.join(', ')}`);
  }
  
  return value;
}

/**
 * Validates a URL string.
 * @param {string} url - The URL to validate
 * @param {string} [name] - Optional name for error message
 * @throws {Error} If the URL is invalid
 * @returns {string} The original URL if valid
 */
function validateUrl(url, name = 'URL') {
  validateNonEmptyString(url, name);
  
  try {
    new URL(url);
  } catch (error) {
    throw new Error(`${name} is not a valid URL`);
  }
  
  return url;
}

/**
 * Validates an email address.
 * @param {string} email - The email to validate
 * @param {string} [name] - Optional name for error message
 * @throws {Error} If the email is invalid
 * @returns {string} The original email if valid
 */
function validateEmail(email, name = 'Email') {
  validateNonEmptyString(email, name);
  
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    throw new Error(`${name} is not a valid email address`);
  }
  
  return email;
}

/**
 * Validates that a function doesn't throw an error.
 * @param {Function} fn - The function to validate
 * @param {Array} [args] - Optional arguments to pass to the function
 * @param {string} [name] - Optional name for error message
 * @throws {Error} If the function throws an error
 * @returns {*} The result of the function call
 */
function validateNoThrow(fn, args = [], name = 'Function') {
  validateType(fn, 'function', name);
  validateType(args, 'array', 'args');
  
  try {
    return fn(...args);
  } catch (error) {
    throw new Error(`${name} threw an error: ${error.message}`);
  }
}

/**
 * Validates that a value is a valid JSON string.
 * @param {string} json - The JSON string to validate
 * @param {string} [name] - Optional name for error message
 * @throws {Error} If the JSON is invalid
 * @returns {Object} The parsed JSON object
 */
function validateJson(json, name = 'JSON') {
  validateNonEmptyString(json, name);
  
  try {
    return JSON.parse(json);
  } catch (error) {
    throw new Error(`${name} is not valid JSON: ${error.message}`);
  }
}

/**
 * Validates that a date string is valid.
 * @param {string} dateStr - The date string to validate
 * @param {string} [name] - Optional name for error message
 * @throws {Error} If the date is invalid
 * @returns {Date} The parsed Date object
 */
function validateDate(dateStr, name = 'Date') {
  validateNonEmptyString(dateStr, name);
  
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) {
    throw new Error(`${name} is not a valid date`);
  }
  
  return date;
}

/**
 * Validates that a value is a valid regular expression.
 * @param {string|RegExp} regex - The regex to validate
 * @param {string} [name] - Optional name for error message
 * @throws {Error} If the regex is invalid
 * @returns {RegExp} The compiled RegExp object
 */
function validateRegex(regex, name = 'RegExp') {
  if (regex instanceof RegExp) {
    return regex;
  }
  
  validateNonEmptyString(regex, name);
  
  try {
    return new RegExp(regex);
  } catch (error) {
    throw new Error(`${name} is not a valid regular expression: ${error.message}`);
  }
}

/**
 * Validates that a value is a valid file path.
 * @param {string} path - The file path to validate
 * @param {string} [name] - Optional name for error message
 * @throws {Error} If the path is invalid
 * @returns {string} The original path if valid
 */
function validateFilePath(path, name = 'File path') {
  validateNonEmptyString(path, name);
  
  // Basic path validation (no illegal characters)
  const illegalChars = /[<>:"|?*\x00-\x1F]/g;
  if (illegalChars.test(path)) {
    throw new Error(`${name} contains illegal characters`);
  }
  
  return path;
}

/**
 * Validates that a value is a valid MIME type.
 * @param {string} mimeType - The MIME type to validate
 * @param {string} [name] - Optional name for error message
 * @throws {Error} If the MIME type is invalid
 * @returns {string} The original MIME type if valid
 */
function validateMimeType(mimeType, name = 'MIME type') {
  validateNonEmptyString(mimeType, name);
  
  const mimeTypeRegex = /^[a-z]+\/[a-z0-9.+-]+$/i;
  if (!mimeTypeRegex.test(mimeType)) {
    throw new Error(`${name} is not a valid MIME type`);
  }
  
  return mimeType;
}

module.exports = {
  validateDefined,
  validateType,
  validateNonEmptyString,
  validateNumberInRange,
  validateArrayMinLength,
  validateArrayMaxLength,
  validateRequiredProperties,
  validateAllowedValues,
  validateUrl,
  validateEmail,
  validateNoThrow,
  validateJson,
  validateDate,
  validateRegex,
  validateFilePath,
  validateMimeType
};
