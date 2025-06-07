/**
 * @fileoverview Validation utilities for the Aideon SDK.
 * Provides schema validation and data validation functions.
 * 
 * @author Aideon AI Team
 * @version 1.0.0
 */

const { ValidationError } = require('./errorHandling');

/**
 * Validates data against a JSON Schema.
 * @param {*} data - The data to validate
 * @param {Object} schema - The JSON Schema
 * @returns {Object} The validation result
 */
function validateSchema(data, schema) {
  // This is a simplified implementation
  // In a real implementation, this would use a library like Ajv
  
  try {
    const errors = [];
    
    // Check type
    if (schema.type) {
      const dataType = Array.isArray(data) ? 'array' : typeof data;
      
      if (schema.type !== dataType) {
        errors.push({
          path: '',
          message: `Expected type ${schema.type}, got ${dataType}`
        });
      }
    }
    
    // Check properties
    if (schema.type === 'object' && schema.properties) {
      for (const [key, propSchema] of Object.entries(schema.properties)) {
        if (data[key] !== undefined) {
          const propResult = validateSchema(data[key], propSchema);
          
          if (!propResult.valid) {
            for (const error of propResult.errors) {
              errors.push({
                path: key + (error.path ? `.${error.path}` : ''),
                message: error.message
              });
            }
          }
        } else if (schema.required && schema.required.includes(key)) {
          errors.push({
            path: key,
            message: 'Required property is missing'
          });
        }
      }
    }
    
    // Check items
    if (schema.type === 'array' && schema.items) {
      for (let i = 0; i < data.length; i++) {
        const itemResult = validateSchema(data[i], schema.items);
        
        if (!itemResult.valid) {
          for (const error of itemResult.errors) {
            errors.push({
              path: `[${i}]${error.path ? `.${error.path}` : ''}`,
              message: error.message
            });
          }
        }
      }
    }
    
    // Check enum
    if (schema.enum) {
      if (!schema.enum.includes(data)) {
        errors.push({
          path: '',
          message: `Value must be one of: ${schema.enum.join(', ')}`
        });
      }
    }
    
    // Check minimum and maximum
    if (schema.type === 'number' || schema.type === 'integer') {
      if (schema.minimum !== undefined && data < schema.minimum) {
        errors.push({
          path: '',
          message: `Value must be >= ${schema.minimum}`
        });
      }
      
      if (schema.maximum !== undefined && data > schema.maximum) {
        errors.push({
          path: '',
          message: `Value must be <= ${schema.maximum}`
        });
      }
    }
    
    // Check minLength and maxLength
    if (schema.type === 'string') {
      if (schema.minLength !== undefined && data.length < schema.minLength) {
        errors.push({
          path: '',
          message: `String length must be >= ${schema.minLength}`
        });
      }
      
      if (schema.maxLength !== undefined && data.length > schema.maxLength) {
        errors.push({
          path: '',
          message: `String length must be <= ${schema.maxLength}`
        });
      }
      
      // Check pattern
      if (schema.pattern) {
        const regex = new RegExp(schema.pattern);
        
        if (!regex.test(data)) {
          errors.push({
            path: '',
            message: `String must match pattern: ${schema.pattern}`
          });
        }
      }
    }
    
    return {
      valid: errors.length === 0,
      errors
    };
  } catch (error) {
    return {
      valid: false,
      errors: [{
        path: '',
        message: `Validation error: ${error.message}`
      }]
    };
  }
}

/**
 * Validates data and throws an error if invalid.
 * @param {*} data - The data to validate
 * @param {Object} schema - The JSON Schema
 * @throws {ValidationError} If validation fails
 */
function validateOrThrow(data, schema) {
  const result = validateSchema(data, schema);
  
  if (!result.valid) {
    throw new ValidationError('Validation failed', 'VALIDATION_ERROR', result.errors);
  }
}

/**
 * Validates an object's properties.
 * @param {Object} obj - The object to validate
 * @param {Object} validators - The property validators
 * @returns {Object} The validation result
 */
function validateObject(obj, validators) {
  const errors = [];
  
  for (const [key, validator] of Object.entries(validators)) {
    try {
      if (obj[key] !== undefined) {
        validator(obj[key]);
      } else if (validator.required) {
        errors.push({
          path: key,
          message: 'Required property is missing'
        });
      }
    } catch (error) {
      errors.push({
        path: key,
        message: error.message
      });
    }
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Creates a validator function for a specific type.
 * @param {string} type - The expected type
 * @param {string} [message] - The error message
 * @returns {Function} The validator function
 */
function createTypeValidator(type, message) {
  return (value) => {
    const valueType = Array.isArray(value) ? 'array' : typeof value;
    
    if (valueType !== type) {
      throw new Error(message || `Expected type ${type}, got ${valueType}`);
    }
    
    return true;
  };
}

/**
 * Creates a validator function for a string.
 * @param {Object} [options] - Validation options
 * @param {number} [options.minLength] - Minimum length
 * @param {number} [options.maxLength] - Maximum length
 * @param {string} [options.pattern] - Regex pattern
 * @param {boolean} [options.required] - Whether the value is required
 * @returns {Function} The validator function
 */
function createStringValidator(options = {}) {
  const validator = (value) => {
    if (typeof value !== 'string') {
      throw new Error('Expected type string');
    }
    
    if (options.minLength !== undefined && value.length < options.minLength) {
      throw new Error(`String length must be >= ${options.minLength}`);
    }
    
    if (options.maxLength !== undefined && value.length > options.maxLength) {
      throw new Error(`String length must be <= ${options.maxLength}`);
    }
    
    if (options.pattern) {
      const regex = new RegExp(options.pattern);
      
      if (!regex.test(value)) {
        throw new Error(`String must match pattern: ${options.pattern}`);
      }
    }
    
    return true;
  };
  
  validator.required = options.required === true;
  
  return validator;
}

/**
 * Creates a validator function for a number.
 * @param {Object} [options] - Validation options
 * @param {number} [options.minimum] - Minimum value
 * @param {number} [options.maximum] - Maximum value
 * @param {boolean} [options.integer] - Whether the value must be an integer
 * @param {boolean} [options.required] - Whether the value is required
 * @returns {Function} The validator function
 */
function createNumberValidator(options = {}) {
  const validator = (value) => {
    if (typeof value !== 'number') {
      throw new Error('Expected type number');
    }
    
    if (options.integer && !Number.isInteger(value)) {
      throw new Error('Expected an integer');
    }
    
    if (options.minimum !== undefined && value < options.minimum) {
      throw new Error(`Value must be >= ${options.minimum}`);
    }
    
    if (options.maximum !== undefined && value > options.maximum) {
      throw new Error(`Value must be <= ${options.maximum}`);
    }
    
    return true;
  };
  
  validator.required = options.required === true;
  
  return validator;
}

/**
 * Creates a validator function for an array.
 * @param {Object} [options] - Validation options
 * @param {Function} [options.itemValidator] - Validator for array items
 * @param {number} [options.minItems] - Minimum number of items
 * @param {number} [options.maxItems] - Maximum number of items
 * @param {boolean} [options.required] - Whether the value is required
 * @returns {Function} The validator function
 */
function createArrayValidator(options = {}) {
  const validator = (value) => {
    if (!Array.isArray(value)) {
      throw new Error('Expected type array');
    }
    
    if (options.minItems !== undefined && value.length < options.minItems) {
      throw new Error(`Array length must be >= ${options.minItems}`);
    }
    
    if (options.maxItems !== undefined && value.length > options.maxItems) {
      throw new Error(`Array length must be <= ${options.maxItems}`);
    }
    
    if (options.itemValidator) {
      for (let i = 0; i < value.length; i++) {
        try {
          options.itemValidator(value[i]);
        } catch (error) {
          throw new Error(`Item at index ${i}: ${error.message}`);
        }
      }
    }
    
    return true;
  };
  
  validator.required = options.required === true;
  
  return validator;
}

/**
 * Creates a validator function for an enum.
 * @param {Array} values - The allowed values
 * @param {boolean} [required] - Whether the value is required
 * @returns {Function} The validator function
 */
function createEnumValidator(values, required = false) {
  const validator = (value) => {
    if (!values.includes(value)) {
      throw new Error(`Value must be one of: ${values.join(', ')}`);
    }
    
    return true;
  };
  
  validator.required = required;
  
  return validator;
}

// Export validation functions
module.exports = {
  validateSchema,
  validateOrThrow,
  validateObject,
  createTypeValidator,
  createStringValidator,
  createNumberValidator,
  createArrayValidator,
  createEnumValidator
};
