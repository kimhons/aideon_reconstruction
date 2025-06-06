/**
 * @fileoverview Configuration Schema for Aideon
 * 
 * The ConfigurationSchema provides JSON Schema validation, versioning,
 * and migration capabilities for the Enhanced Configuration System.
 * 
 * This component is part of the Enhanced Configuration System designed
 * to improve Aideon's GAIA Score by enhancing reliability and adaptability.
 */

'use strict';

/**
 * Configuration Schema class
 * 
 * Provides JSON Schema validation, versioning, and migration capabilities
 * for configuration values.
 */
class ConfigurationSchema {
  /**
   * Creates a new ConfigurationSchema instance
   * 
   * @param {Object} options - Schema options
   * @param {string} options.id - Schema identifier
   * @param {string} options.version - Schema version
   * @param {Object} options.schema - JSON Schema definition
   * @param {Function} options.migrationFunction - Function to migrate from previous version
   */
  constructor(options = {}) {
    this.id = options.id || '';
    this.version = options.version || '1.0.0';
    this.schema = options.schema || {};
    this.migrationFunction = options.migrationFunction || null;
    this.description = options.description || '';
    this.previousVersions = options.previousVersions || [];
    this.created = options.created || new Date().toISOString();
    this.updated = options.updated || new Date().toISOString();
    this.deprecated = options.deprecated || false;
    this.documentationUrl = options.documentationUrl || '';
  }

  /**
   * Validates a value against the schema
   * 
   * @param {*} value - Value to validate
   * @returns {Object} Validation result with isValid and errors properties
   */
  validate(value) {
    const result = {
      isValid: true,
      errors: []
    };

    // Check type
    if (this.schema.type) {
      const typeValid = this.validateType(value, this.schema.type);
      if (!typeValid) {
        result.isValid = false;
        result.errors.push({
          path: '',
          message: `Expected type ${this.schema.type}, got ${typeof value}`
        });
      }
    }

    // Check required properties
    if (this.schema.type === 'object' && this.schema.required && Array.isArray(this.schema.required)) {
      for (const requiredProp of this.schema.required) {
        if (value === null || value === undefined || !(requiredProp in value)) {
          result.isValid = false;
          result.errors.push({
            path: requiredProp,
            message: `Missing required property: ${requiredProp}`
          });
        }
      }
    }

    // Validate properties
    if (this.schema.type === 'object' && this.schema.properties && typeof value === 'object' && value !== null) {
      for (const [propName, propSchema] of Object.entries(this.schema.properties)) {
        if (propName in value) {
          const propValue = value[propName];
          const propResult = this.validateProperty(propValue, propSchema, propName);
          if (!propResult.isValid) {
            result.isValid = false;
            result.errors.push(...propResult.errors);
          }
        }
      }
    }

    // Validate items in array
    if (this.schema.type === 'array' && this.schema.items && Array.isArray(value)) {
      for (let i = 0; i < value.length; i++) {
        const itemValue = value[i];
        const itemResult = this.validateProperty(itemValue, this.schema.items, `[${i}]`);
        if (!itemResult.isValid) {
          result.isValid = false;
          result.errors.push(...itemResult.errors);
        }
      }
    }

    // Validate enum
    if (this.schema.enum && Array.isArray(this.schema.enum)) {
      if (!this.schema.enum.includes(value)) {
        result.isValid = false;
        result.errors.push({
          path: '',
          message: `Value must be one of: ${this.schema.enum.join(', ')}`
        });
      }
    }

    // Validate string constraints
    if (this.schema.type === 'string' && typeof value === 'string') {
      // Check minLength
      if (this.schema.minLength !== undefined && value.length < this.schema.minLength) {
        result.isValid = false;
        result.errors.push({
          path: '',
          message: `String length must be at least ${this.schema.minLength}`
        });
      }

      // Check maxLength
      if (this.schema.maxLength !== undefined && value.length > this.schema.maxLength) {
        result.isValid = false;
        result.errors.push({
          path: '',
          message: `String length must be at most ${this.schema.maxLength}`
        });
      }

      // Check pattern
      if (this.schema.pattern) {
        const regex = new RegExp(this.schema.pattern);
        if (!regex.test(value)) {
          result.isValid = false;
          result.errors.push({
            path: '',
            message: `String must match pattern: ${this.schema.pattern}`
          });
        }
      }
    }

    // Validate number constraints
    if ((this.schema.type === 'number' || this.schema.type === 'integer') && typeof value === 'number') {
      // Check minimum
      if (this.schema.minimum !== undefined && value < this.schema.minimum) {
        result.isValid = false;
        result.errors.push({
          path: '',
          message: `Value must be at least ${this.schema.minimum}`
        });
      }

      // Check maximum
      if (this.schema.maximum !== undefined && value > this.schema.maximum) {
        result.isValid = false;
        result.errors.push({
          path: '',
          message: `Value must be at most ${this.schema.maximum}`
        });
      }

      // Check multipleOf
      if (this.schema.multipleOf !== undefined && value % this.schema.multipleOf !== 0) {
        result.isValid = false;
        result.errors.push({
          path: '',
          message: `Value must be a multiple of ${this.schema.multipleOf}`
        });
      }

      // Check integer
      if (this.schema.type === 'integer' && !Number.isInteger(value)) {
        result.isValid = false;
        result.errors.push({
          path: '',
          message: 'Value must be an integer'
        });
      }
    }

    // Validate array constraints
    if (this.schema.type === 'array' && Array.isArray(value)) {
      // Check minItems
      if (this.schema.minItems !== undefined && value.length < this.schema.minItems) {
        result.isValid = false;
        result.errors.push({
          path: '',
          message: `Array must contain at least ${this.schema.minItems} items`
        });
      }

      // Check maxItems
      if (this.schema.maxItems !== undefined && value.length > this.schema.maxItems) {
        result.isValid = false;
        result.errors.push({
          path: '',
          message: `Array must contain at most ${this.schema.maxItems} items`
        });
      }

      // Check uniqueItems
      if (this.schema.uniqueItems === true) {
        const uniqueValues = new Set(value.map(v => JSON.stringify(v)));
        if (uniqueValues.size !== value.length) {
          result.isValid = false;
          result.errors.push({
            path: '',
            message: 'Array items must be unique'
          });
        }
      }
    }

    return result;
  }

  /**
   * Validates a property against a schema
   * 
   * @param {*} value - Value to validate
   * @param {Object} schema - Schema to validate against
   * @param {string} path - Property path
   * @returns {Object} Validation result with isValid and errors properties
   * @private
   */
  validateProperty(value, schema, path) {
    const result = {
      isValid: true,
      errors: []
    };

    // Check type
    if (schema.type) {
      const typeValid = this.validateType(value, schema.type);
      if (!typeValid) {
        result.isValid = false;
        result.errors.push({
          path,
          message: `Expected type ${schema.type}, got ${typeof value}`
        });
        return result; // Stop validation if type is wrong
      }
    }

    // Check required properties
    if (schema.type === 'object' && schema.required && Array.isArray(schema.required) && typeof value === 'object' && value !== null) {
      for (const requiredProp of schema.required) {
        if (!(requiredProp in value)) {
          result.isValid = false;
          result.errors.push({
            path: `${path}.${requiredProp}`,
            message: `Missing required property: ${requiredProp}`
          });
        }
      }
    }

    // Validate properties
    if (schema.type === 'object' && schema.properties && typeof value === 'object' && value !== null) {
      for (const [propName, propSchema] of Object.entries(schema.properties)) {
        if (propName in value) {
          const propValue = value[propName];
          const propResult = this.validateProperty(propValue, propSchema, `${path}.${propName}`);
          if (!propResult.isValid) {
            result.isValid = false;
            result.errors.push(...propResult.errors);
          }
        }
      }
    }

    // Validate items in array
    if (schema.type === 'array' && schema.items && Array.isArray(value)) {
      for (let i = 0; i < value.length; i++) {
        const itemValue = value[i];
        const itemResult = this.validateProperty(itemValue, schema.items, `${path}[${i}]`);
        if (!itemResult.isValid) {
          result.isValid = false;
          result.errors.push(...itemResult.errors);
        }
      }
    }

    // Validate enum
    if (schema.enum && Array.isArray(schema.enum)) {
      if (!schema.enum.includes(value)) {
        result.isValid = false;
        result.errors.push({
          path,
          message: `Value must be one of: ${schema.enum.join(', ')}`
        });
      }
    }

    // Validate string constraints
    if (schema.type === 'string' && typeof value === 'string') {
      // Check minLength
      if (schema.minLength !== undefined && value.length < schema.minLength) {
        result.isValid = false;
        result.errors.push({
          path,
          message: `String length must be at least ${schema.minLength}`
        });
      }

      // Check maxLength
      if (schema.maxLength !== undefined && value.length > schema.maxLength) {
        result.isValid = false;
        result.errors.push({
          path,
          message: `String length must be at most ${schema.maxLength}`
        });
      }

      // Check pattern
      if (schema.pattern) {
        const regex = new RegExp(schema.pattern);
        if (!regex.test(value)) {
          result.isValid = false;
          result.errors.push({
            path,
            message: `String must match pattern: ${schema.pattern}`
          });
        }
      }
    }

    // Validate number constraints
    if ((schema.type === 'number' || schema.type === 'integer') && typeof value === 'number') {
      // Check minimum
      if (schema.minimum !== undefined && value < schema.minimum) {
        result.isValid = false;
        result.errors.push({
          path,
          message: `Value must be at least ${schema.minimum}`
        });
      }

      // Check maximum
      if (schema.maximum !== undefined && value > schema.maximum) {
        result.isValid = false;
        result.errors.push({
          path,
          message: `Value must be at most ${schema.maximum}`
        });
      }

      // Check multipleOf
      if (schema.multipleOf !== undefined && value % schema.multipleOf !== 0) {
        result.isValid = false;
        result.errors.push({
          path,
          message: `Value must be a multiple of ${schema.multipleOf}`
        });
      }

      // Check integer
      if (schema.type === 'integer' && !Number.isInteger(value)) {
        result.isValid = false;
        result.errors.push({
          path,
          message: 'Value must be an integer'
        });
      }
    }

    // Validate array constraints
    if (schema.type === 'array' && Array.isArray(value)) {
      // Check minItems
      if (schema.minItems !== undefined && value.length < schema.minItems) {
        result.isValid = false;
        result.errors.push({
          path,
          message: `Array must contain at least ${schema.minItems} items`
        });
      }

      // Check maxItems
      if (schema.maxItems !== undefined && value.length > schema.maxItems) {
        result.isValid = false;
        result.errors.push({
          path,
          message: `Array must contain at most ${schema.maxItems} items`
        });
      }

      // Check uniqueItems
      if (schema.uniqueItems === true) {
        const uniqueValues = new Set(value.map(v => JSON.stringify(v)));
        if (uniqueValues.size !== value.length) {
          result.isValid = false;
          result.errors.push({
            path,
            message: 'Array items must be unique'
          });
        }
      }
    }

    return result;
  }

  /**
   * Validates a value against a type
   * 
   * @param {*} value - Value to validate
   * @param {string} type - Type to validate against
   * @returns {boolean} Whether the value matches the type
   * @private
   */
  validateType(value, type) {
    switch (type) {
      case 'string':
        return typeof value === 'string';
      case 'number':
        return typeof value === 'number' && !isNaN(value);
      case 'integer':
        return typeof value === 'number' && !isNaN(value) && Number.isInteger(value);
      case 'boolean':
        return typeof value === 'boolean';
      case 'object':
        return typeof value === 'object' && value !== null && !Array.isArray(value);
      case 'array':
        return Array.isArray(value);
      case 'null':
        return value === null;
      default:
        return true; // Unknown type, assume valid
    }
  }

  /**
   * Migrates a value from a previous schema version
   * 
   * @param {*} value - Value to migrate
   * @param {string} fromVersion - Source version
   * @returns {*} Migrated value
   */
  migrate(value, fromVersion) {
    if (!this.migrationFunction) {
      return value; // No migration function, return as is
    }

    return this.migrationFunction(value, fromVersion, this.version);
  }

  /**
   * Gets the default value for the schema
   * 
   * @returns {*} Default value
   */
  getDefaultValue() {
    if (this.schema.default !== undefined) {
      return this.schema.default;
    }

    // Create default based on type
    switch (this.schema.type) {
      case 'string':
        return '';
      case 'number':
      case 'integer':
        return 0;
      case 'boolean':
        return false;
      case 'object':
        if (this.schema.properties) {
          const defaultObj = {};
          for (const [propName, propSchema] of Object.entries(this.schema.properties)) {
            if (propSchema.default !== undefined) {
              defaultObj[propName] = propSchema.default;
            }
          }
          return defaultObj;
        }
        return {};
      case 'array':
        return [];
      default:
        return null;
    }
  }

  /**
   * Generates documentation for the schema
   * 
   * @param {string} format - Documentation format ('markdown', 'html', 'json')
   * @returns {string} Generated documentation
   */
  generateDocumentation(format = 'markdown') {
    switch (format.toLowerCase()) {
      case 'markdown':
        return this.generateMarkdownDocumentation();
      case 'html':
        return this.generateHtmlDocumentation();
      case 'json':
        return JSON.stringify(this.generateJsonDocumentation(), null, 2);
      default:
        throw new Error(`Unsupported documentation format: ${format}`);
    }
  }

  /**
   * Generates Markdown documentation for the schema
   * 
   * @returns {string} Markdown documentation
   * @private
   */
  generateMarkdownDocumentation() {
    let doc = `# ${this.id}\n\n`;
    
    if (this.description) {
      doc += `${this.description}\n\n`;
    }
    
    doc += `**Version:** ${this.version}\n`;
    doc += `**Created:** ${this.created}\n`;
    doc += `**Updated:** ${this.updated}\n`;
    
    if (this.deprecated) {
      doc += `\n> **DEPRECATED**\n`;
    }
    
    if (this.documentationUrl) {
      doc += `\n[Additional Documentation](${this.documentationUrl})\n`;
    }
    
    doc += '\n## Schema\n\n';
    doc += this.generateMarkdownSchemaDoc(this.schema);
    
    if (this.previousVersions && this.previousVersions.length > 0) {
      doc += '\n## Previous Versions\n\n';
      for (const prevVersion of this.previousVersions) {
        doc += `- ${prevVersion}\n`;
      }
    }
    
    return doc;
  }

  /**
   * Generates Markdown documentation for a schema object
   * 
   * @param {Object} schema - Schema object
   * @param {number} level - Nesting level
   * @returns {string} Markdown documentation
   * @private
   */
  generateMarkdownSchemaDoc(schema, level = 0) {
    let doc = '';
    const indent = '  '.repeat(level);
    
    if (schema.type) {
      doc += `${indent}**Type:** ${schema.type}\n`;
    }
    
    if (schema.description) {
      doc += `${indent}**Description:** ${schema.description}\n`;
    }
    
    if (schema.default !== undefined) {
      doc += `${indent}**Default:** \`${JSON.stringify(schema.default)}\`\n`;
    }
    
    if (schema.enum) {
      doc += `${indent}**Allowed Values:** ${schema.enum.map(v => `\`${v}\``).join(', ')}\n`;
    }
    
    if (schema.type === 'string') {
      if (schema.minLength !== undefined) {
        doc += `${indent}**Min Length:** ${schema.minLength}\n`;
      }
      if (schema.maxLength !== undefined) {
        doc += `${indent}**Max Length:** ${schema.maxLength}\n`;
      }
      if (schema.pattern) {
        doc += `${indent}**Pattern:** \`${schema.pattern}\`\n`;
      }
    }
    
    if (schema.type === 'number' || schema.type === 'integer') {
      if (schema.minimum !== undefined) {
        doc += `${indent}**Minimum:** ${schema.minimum}\n`;
      }
      if (schema.maximum !== undefined) {
        doc += `${indent}**Maximum:** ${schema.maximum}\n`;
      }
      if (schema.multipleOf !== undefined) {
        doc += `${indent}**Multiple Of:** ${schema.multipleOf}\n`;
      }
    }
    
    if (schema.type === 'array') {
      if (schema.minItems !== undefined) {
        doc += `${indent}**Min Items:** ${schema.minItems}\n`;
      }
      if (schema.maxItems !== undefined) {
        doc += `${indent}**Max Items:** ${schema.maxItems}\n`;
      }
      if (schema.uniqueItems) {
        doc += `${indent}**Unique Items:** Yes\n`;
      }
      
      if (schema.items) {
        doc += `${indent}**Items:**\n`;
        doc += this.generateMarkdownSchemaDoc(schema.items, level + 1);
      }
    }
    
    if (schema.type === 'object' && schema.properties) {
      if (schema.required && schema.required.length > 0) {
        doc += `${indent}**Required Properties:** ${schema.required.join(', ')}\n`;
      }
      
      doc += `${indent}**Properties:**\n`;
      
      for (const [propName, propSchema] of Object.entries(schema.properties)) {
        doc += `${indent}  **${propName}**:\n`;
        doc += this.generateMarkdownSchemaDoc(propSchema, level + 2);
      }
    }
    
    return doc;
  }

  /**
   * Generates HTML documentation for the schema
   * 
   * @returns {string} HTML documentation
   * @private
   */
  generateHtmlDocumentation() {
    let doc = `<!DOCTYPE html>
<html>
<head>
  <title>${this.id} Schema Documentation</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 20px; }
    h1 { color: #333; }
    .deprecated { color: #c00; font-weight: bold; }
    .property { margin-left: 20px; }
    .property-name { font-weight: bold; }
    .type { color: #060; }
    .constraints { color: #666; font-size: 0.9em; }
  </style>
</head>
<body>
  <h1>${this.id}</h1>`;
    
    if (this.description) {
      doc += `  <p>${this.description}</p>`;
    }
    
    doc += `  <p><strong>Version:</strong> ${this.version}</p>
  <p><strong>Created:</strong> ${this.created}</p>
  <p><strong>Updated:</strong> ${this.updated}</p>`;
    
    if (this.deprecated) {
      doc += `  <p class="deprecated">DEPRECATED</p>`;
    }
    
    if (this.documentationUrl) {
      doc += `  <p><a href="${this.documentationUrl}">Additional Documentation</a></p>`;
    }
    
    doc += `  <h2>Schema</h2>`;
    doc += this.generateHtmlSchemaDoc(this.schema);
    
    if (this.previousVersions && this.previousVersions.length > 0) {
      doc += `  <h2>Previous Versions</h2>
  <ul>`;
      for (const prevVersion of this.previousVersions) {
        doc += `    <li>${prevVersion}</li>`;
      }
      doc += `  </ul>`;
    }
    
    doc += `</body>
</html>`;
    
    return doc;
  }

  /**
   * Generates HTML documentation for a schema object
   * 
   * @param {Object} schema - Schema object
   * @param {string} path - Property path
   * @returns {string} HTML documentation
   * @private
   */
  generateHtmlSchemaDoc(schema, path = '') {
    let doc = `  <div class="schema-object">`;
    
    if (schema.type) {
      doc += `    <p><span class="type">${schema.type}</span>`;
      
      if (schema.description) {
        doc += ` - ${schema.description}`;
      }
      
      doc += `</p>`;
    }
    
    let constraints = [];
    
    if (schema.default !== undefined) {
      constraints.push(`Default: ${JSON.stringify(schema.default)}`);
    }
    
    if (schema.enum) {
      constraints.push(`Allowed Values: ${schema.enum.map(v => `${JSON.stringify(v)}`).join(', ')}`);
    }
    
    if (schema.type === 'string') {
      if (schema.minLength !== undefined) {
        constraints.push(`Min Length: ${schema.minLength}`);
      }
      if (schema.maxLength !== undefined) {
        constraints.push(`Max Length: ${schema.maxLength}`);
      }
      if (schema.pattern) {
        constraints.push(`Pattern: ${schema.pattern}`);
      }
    }
    
    if (schema.type === 'number' || schema.type === 'integer') {
      if (schema.minimum !== undefined) {
        constraints.push(`Minimum: ${schema.minimum}`);
      }
      if (schema.maximum !== undefined) {
        constraints.push(`Maximum: ${schema.maximum}`);
      }
      if (schema.multipleOf !== undefined) {
        constraints.push(`Multiple Of: ${schema.multipleOf}`);
      }
    }
    
    if (schema.type === 'array') {
      if (schema.minItems !== undefined) {
        constraints.push(`Min Items: ${schema.minItems}`);
      }
      if (schema.maxItems !== undefined) {
        constraints.push(`Max Items: ${schema.maxItems}`);
      }
      if (schema.uniqueItems) {
        constraints.push(`Unique Items: Yes`);
      }
    }
    
    if (constraints.length > 0) {
      doc += `    <p class="constraints">${constraints.join(', ')}</p>`;
    }
    
    if (schema.type === 'object' && schema.properties) {
      if (schema.required && schema.required.length > 0) {
        doc += `    <p>Required Properties: ${schema.required.join(', ')}</p>`;
      }
      
      doc += `    <div class="properties">`;
      
      for (const [propName, propSchema] of Object.entries(schema.properties)) {
        const propPath = path ? `${path}.${propName}` : propName;
        doc += `      <div class="property">
        <p class="property-name">${propName}</p>`;
        doc += this.generateHtmlSchemaDoc(propSchema, propPath);
        doc += `      </div>`;
      }
      
      doc += `    </div>`;
    }
    
    if (schema.type === 'array' && schema.items) {
      doc += `    <div class="items">
      <p>Items:</p>`;
      doc += this.generateHtmlSchemaDoc(schema.items, `${path}[]`);
      doc += `    </div>`;
    }
    
    doc += `  </div>`;
    
    return doc;
  }

  /**
   * Generates JSON documentation for the schema
   * 
   * @returns {Object} JSON documentation
   * @private
   */
  generateJsonDocumentation() {
    return {
      id: this.id,
      version: this.version,
      description: this.description,
      created: this.created,
      updated: this.updated,
      deprecated: this.deprecated,
      documentationUrl: this.documentationUrl,
      schema: this.schema,
      previousVersions: this.previousVersions
    };
  }

  /**
   * Creates a new schema version
   * 
   * @param {Object} options - New schema options
   * @param {string} options.version - New schema version
   * @param {Object} options.schema - New JSON Schema definition
   * @param {Function} options.migrationFunction - Function to migrate from previous version
   * @returns {ConfigurationSchema} New schema version
   */
  createNewVersion(options = {}) {
    if (!options.version) {
      throw new Error('New version is required');
    }

    const previousVersions = [...(this.previousVersions || [])];
    previousVersions.push(this.version);

    return new ConfigurationSchema({
      id: this.id,
      version: options.version,
      schema: options.schema || this.schema,
      migrationFunction: options.migrationFunction || this.migrationFunction,
      description: options.description || this.description,
      previousVersions,
      created: this.created,
      updated: new Date().toISOString(),
      deprecated: options.deprecated !== undefined ? options.deprecated : this.deprecated,
      documentationUrl: options.documentationUrl || this.documentationUrl
    });
  }

  /**
   * Serializes the schema to JSON
   * 
   * @returns {Object} Serialized schema
   */
  toJSON() {
    return {
      id: this.id,
      version: this.version,
      schema: this.schema,
      description: this.description,
      previousVersions: this.previousVersions,
      created: this.created,
      updated: this.updated,
      deprecated: this.deprecated,
      documentationUrl: this.documentationUrl
    };
  }

  /**
   * Creates a schema from JSON
   * 
   * @param {Object|string} json - JSON object or string
   * @param {Function} migrationFunction - Migration function
   * @returns {ConfigurationSchema} Created schema
   * @static
   */
  static fromJSON(json, migrationFunction = null) {
    const parsed = typeof json === 'string' ? JSON.parse(json) : json;
    
    return new ConfigurationSchema({
      id: parsed.id,
      version: parsed.version,
      schema: parsed.schema,
      migrationFunction,
      description: parsed.description,
      previousVersions: parsed.previousVersions,
      created: parsed.created,
      updated: parsed.updated,
      deprecated: parsed.deprecated,
      documentationUrl: parsed.documentationUrl
    });
  }
}

module.exports = ConfigurationSchema;
