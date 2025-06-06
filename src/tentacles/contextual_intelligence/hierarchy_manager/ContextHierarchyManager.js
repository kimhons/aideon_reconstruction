/**
 * @fileoverview Context Hierarchy Manager for the Contextual Intelligence Tentacle.
 * Manages the hierarchical structure of contexts, from global system context down to specific task contexts.
 * 
 * @author Aideon AI Team
 * @version 1.0.0
 */

const EventEmitter = require('events');
const { deepClone, deepMerge, pathToArray, arrayToPath } = require('../../utils/object_utils');

/**
 * Manages the hierarchical structure of contexts in Aideon.
 */
class ContextHierarchyManager {
  /**
   * Creates a new ContextHierarchyManager instance.
   * @param {Object} options - Configuration options
   * @param {Object} options.initialHierarchy - Initial hierarchy structure
   * @param {EventEmitter} options.eventEmitter - Event emitter for hierarchy changes
   */
  constructor(options = {}) {
    this.contextHierarchy = options.initialHierarchy || {
      global: {
        user: {
          profile: {},
          session: {
            goals: [],
            currentFocus: {},
            interactionHistory: []
          }
        },
        system: {
          state: {},
          resources: {},
          capabilities: {}
        },
        domains: {}
      },
      tasks: {}
    };
    
    this.eventEmitter = options.eventEmitter || new EventEmitter();
    this.pathSeparator = '.';
    this.schemas = new Map();
    this.validators = new Map();
    this.contextRelationships = new Map();
  }

  /**
   * Registers a new context in the hierarchy.
   * @param {string} path - The path where the context should be registered
   * @param {Object} contextDefinition - The context definition
   * @param {string} contextDefinition.type - The type of context (e.g., 'task', 'domain')
   * @param {string} [contextDefinition.parent] - The parent context path
   * @param {Object} [contextDefinition.initialState] - The initial state of the context
   * @param {Object} [contextDefinition.schema] - The schema for validating the context
   * @param {Object} [contextDefinition.relationships] - Relationships to other contexts
   * @returns {boolean} - True if registration was successful
   */
  registerContext(path, contextDefinition) {
    try {
      // Validate the path
      if (!path || typeof path !== 'string') {
        throw new Error('Context path must be a non-empty string');
      }

      // Validate the context definition
      if (!contextDefinition || typeof contextDefinition !== 'object') {
        throw new Error('Context definition must be an object');
      }

      if (!contextDefinition.type) {
        throw new Error('Context definition must include a type');
      }

      // Create the context at the specified path
      const pathParts = pathToArray(path, this.pathSeparator);
      let currentLevel = this.contextHierarchy;
      
      // Create parent paths if they don't exist
      for (let i = 0; i < pathParts.length - 1; i++) {
        const part = pathParts[i];
        if (!currentLevel[part]) {
          currentLevel[part] = {};
        }
        currentLevel = currentLevel[part];
      }

      // Set the context at the final path
      const finalPart = pathParts[pathParts.length - 1];
      
      // Don't overwrite existing context unless forced
      if (currentLevel[finalPart] && !contextDefinition.force) {
        throw new Error(`Context already exists at path: ${path}`);
      }

      // Initialize the context with the provided initial state
      currentLevel[finalPart] = contextDefinition.initialState || {};

      // Store the schema if provided
      if (contextDefinition.schema) {
        this.schemas.set(path, contextDefinition.schema);
      }

      // Store relationships if provided
      if (contextDefinition.relationships) {
        this.contextRelationships.set(path, contextDefinition.relationships);
      }

      // Emit context registered event
      this.eventEmitter.emit('context:registered', {
        path,
        type: contextDefinition.type,
        parent: contextDefinition.parent
      });

      return true;
    } catch (error) {
      this.eventEmitter.emit('context:error', {
        operation: 'registerContext',
        path,
        error: error.message
      });
      return false;
    }
  }

  /**
   * Gets a context from the hierarchy.
   * @param {string} path - The path to the context
   * @returns {Object|null} - The context or null if not found
   */
  getContext(path) {
    try {
      const pathParts = pathToArray(path, this.pathSeparator);
      let currentLevel = this.contextHierarchy;
      
      // Navigate to the specified path
      for (const part of pathParts) {
        if (!currentLevel[part]) {
          return null;
        }
        currentLevel = currentLevel[part];
      }

      // Return a deep clone to prevent direct modification
      return deepClone(currentLevel);
    } catch (error) {
      this.eventEmitter.emit('context:error', {
        operation: 'getContext',
        path,
        error: error.message
      });
      return null;
    }
  }

  /**
   * Updates a context in the hierarchy.
   * @param {string} path - The path to the context
   * @param {Object} updates - The updates to apply
   * @param {boolean} [merge=true] - Whether to merge with existing context or replace
   * @returns {boolean} - True if update was successful
   */
  updateContext(path, updates, merge = true) {
    try {
      const pathParts = pathToArray(path, this.pathSeparator);
      let currentLevel = this.contextHierarchy;
      const pathLevels = [];
      
      // Navigate to the parent of the specified path
      for (let i = 0; i < pathParts.length - 1; i++) {
        const part = pathParts[i];
        if (!currentLevel[part]) {
          throw new Error(`Path not found: ${pathParts.slice(0, i + 1).join(this.pathSeparator)}`);
        }
        pathLevels.push(currentLevel);
        currentLevel = currentLevel[part];
      }

      // Get the final part of the path
      const finalPart = pathParts[pathParts.length - 1];
      
      // Check if the context exists
      if (!currentLevel[finalPart]) {
        throw new Error(`Context not found at path: ${path}`);
      }

      // Store the old value for the event
      const oldValue = deepClone(currentLevel[finalPart]);

      // Update the context
      if (merge) {
        currentLevel[finalPart] = deepMerge(currentLevel[finalPart], updates);
      } else {
        currentLevel[finalPart] = updates;
      }

      // Validate against schema if available
      if (this.schemas.has(path)) {
        const schema = this.schemas.get(path);
        const isValid = this.validateAgainstSchema(currentLevel[finalPart], schema);
        
        if (!isValid) {
          // Revert the change
          for (let i = 0; i < pathLevels.length; i++) {
            const level = pathLevels[i];
            const part = pathParts[i];
            if (i === pathLevels.length - 1) {
              level[part][finalPart] = oldValue;
            }
          }
          
          throw new Error(`Context update failed validation against schema: ${path}`);
        }
      }

      // Emit context updated event
      this.eventEmitter.emit('context:updated', {
        path,
        oldValue,
        newValue: deepClone(currentLevel[finalPart]),
        merged: merge
      });

      return true;
    } catch (error) {
      this.eventEmitter.emit('context:error', {
        operation: 'updateContext',
        path,
        error: error.message
      });
      return false;
    }
  }

  /**
   * Deletes a context from the hierarchy.
   * @param {string} path - The path to the context
   * @returns {boolean} - True if deletion was successful
   */
  deleteContext(path) {
    try {
      const pathParts = pathToArray(path, this.pathSeparator);
      let currentLevel = this.contextHierarchy;
      
      // Navigate to the parent of the specified path
      for (let i = 0; i < pathParts.length - 1; i++) {
        const part = pathParts[i];
        if (!currentLevel[part]) {
          throw new Error(`Path not found: ${pathParts.slice(0, i + 1).join(this.pathSeparator)}`);
        }
        currentLevel = currentLevel[part];
      }

      // Get the final part of the path
      const finalPart = pathParts[pathParts.length - 1];
      
      // Check if the context exists
      if (!currentLevel[finalPart]) {
        throw new Error(`Context not found at path: ${path}`);
      }

      // Store the old value for the event
      const oldValue = deepClone(currentLevel[finalPart]);

      // Delete the context
      delete currentLevel[finalPart];

      // Remove schema if it exists
      if (this.schemas.has(path)) {
        this.schemas.delete(path);
      }

      // Remove relationships if they exist
      if (this.contextRelationships.has(path)) {
        this.contextRelationships.delete(path);
      }

      // Emit context deleted event
      this.eventEmitter.emit('context:deleted', {
        path,
        oldValue
      });

      return true;
    } catch (error) {
      this.eventEmitter.emit('context:error', {
        operation: 'deleteContext',
        path,
        error: error.message
      });
      return false;
    }
  }

  /**
   * Lists all contexts in the hierarchy.
   * @param {string} [basePath=''] - The base path to start listing from
   * @param {boolean} [recursive=true] - Whether to list recursively
   * @returns {Array<string>} - Array of context paths
   */
  listContexts(basePath = '', recursive = true) {
    try {
      const results = [];
      const baseObj = basePath ? this.getContext(basePath) : this.contextHierarchy;
      
      if (!baseObj) {
        throw new Error(`Base path not found: ${basePath}`);
      }

      const addPaths = (obj, currentPath) => {
        for (const key in obj) {
          const newPath = currentPath ? `${currentPath}${this.pathSeparator}${key}` : key;
          results.push(newPath);
          
          if (recursive && typeof obj[key] === 'object' && obj[key] !== null) {
            addPaths(obj[key], newPath);
          }
        }
      };

      addPaths(baseObj, basePath);
      return results;
    } catch (error) {
      this.eventEmitter.emit('context:error', {
        operation: 'listContexts',
        basePath,
        error: error.message
      });
      return [];
    }
  }

  /**
   * Gets the parent context of a given context.
   * @param {string} path - The path to the context
   * @returns {Object|null} - The parent context or null if not found
   */
  getParentContext(path) {
    try {
      const pathParts = pathToArray(path, this.pathSeparator);
      
      if (pathParts.length <= 1) {
        return null; // No parent
      }

      const parentPath = arrayToPath(pathParts.slice(0, -1), this.pathSeparator);
      return this.getContext(parentPath);
    } catch (error) {
      this.eventEmitter.emit('context:error', {
        operation: 'getParentContext',
        path,
        error: error.message
      });
      return null;
    }
  }

  /**
   * Gets the children contexts of a given context.
   * @param {string} path - The path to the context
   * @returns {Object|null} - Object with child contexts or null if not found
   */
  getChildContexts(path) {
    try {
      const context = this.getContext(path);
      
      if (!context) {
        throw new Error(`Context not found at path: ${path}`);
      }

      const children = {};
      
      for (const key in context) {
        if (typeof context[key] === 'object' && context[key] !== null) {
          children[key] = deepClone(context[key]);
        }
      }

      return children;
    } catch (error) {
      this.eventEmitter.emit('context:error', {
        operation: 'getChildContexts',
        path,
        error: error.message
      });
      return null;
    }
  }

  /**
   * Gets related contexts based on defined relationships.
   * @param {string} path - The path to the context
   * @returns {Object|null} - Object with related contexts or null if not found
   */
  getRelatedContexts(path) {
    try {
      if (!this.contextRelationships.has(path)) {
        return {};
      }

      const relationships = this.contextRelationships.get(path);
      const related = {};

      for (const [relationshipType, relatedPaths] of Object.entries(relationships)) {
        related[relationshipType] = {};
        
        for (const relatedPath of relatedPaths) {
          const relatedContext = this.getContext(relatedPath);
          if (relatedContext) {
            related[relationshipType][relatedPath] = relatedContext;
          }
        }
      }

      return related;
    } catch (error) {
      this.eventEmitter.emit('context:error', {
        operation: 'getRelatedContexts',
        path,
        error: error.message
      });
      return null;
    }
  }

  /**
   * Validates a context against its schema.
   * @param {Object} context - The context to validate
   * @param {Object} schema - The schema to validate against
   * @returns {boolean} - True if valid
   * @private
   */
  validateAgainstSchema(context, schema) {
    // Basic implementation - in production, use a proper schema validator
    try {
      // For each property in the schema
      for (const [key, definition] of Object.entries(schema.properties || {})) {
        // Check if required property is missing
        if (schema.required && schema.required.includes(key) && !(key in context)) {
          return false;
        }

        // Skip validation if property doesn't exist in context
        if (!(key in context)) {
          continue;
        }

        const value = context[key];

        // Type validation
        if (definition.type) {
          if (definition.type === 'string' && typeof value !== 'string') {
            return false;
          } else if (definition.type === 'number' && typeof value !== 'number') {
            return false;
          } else if (definition.type === 'boolean' && typeof value !== 'boolean') {
            return false;
          } else if (definition.type === 'array' && !Array.isArray(value)) {
            return false;
          } else if (definition.type === 'object' && (typeof value !== 'object' || value === null || Array.isArray(value))) {
            return false;
          }
        }

        // Array validation
        if (Array.isArray(value) && definition.items) {
          for (const item of value) {
            if (definition.items.type === 'string' && typeof item !== 'string') {
              return false;
            } else if (definition.items.type === 'number' && typeof item !== 'number') {
              return false;
            } else if (definition.items.type === 'boolean' && typeof item !== 'boolean') {
              return false;
            } else if (definition.items.type === 'object' && (typeof item !== 'object' || item === null || Array.isArray(item))) {
              return false;
            }
          }
        }

        // Object validation
        if (typeof value === 'object' && value !== null && !Array.isArray(value) && definition.properties) {
          if (!this.validateAgainstSchema(value, definition)) {
            return false;
          }
        }
      }

      return true;
    } catch (error) {
      this.eventEmitter.emit('context:error', {
        operation: 'validateAgainstSchema',
        error: error.message
      });
      return false;
    }
  }

  /**
   * Watches for changes to a specific context.
   * @param {string} path - The path to the context
   * @param {Function} callback - The callback to call when the context changes
   * @returns {Function} - Function to stop watching
   */
  watchContext(path, callback) {
    const handler = (event) => {
      if (event.path === path) {
        callback(event.newValue, event.oldValue, event.path);
      }
    };

    this.eventEmitter.on('context:updated', handler);

    // Return a function to stop watching
    return () => {
      this.eventEmitter.removeListener('context:updated', handler);
    };
  }

  /**
   * Gets the entire context hierarchy.
   * @returns {Object} - Deep clone of the context hierarchy
   */
  getEntireHierarchy() {
    return deepClone(this.contextHierarchy);
  }

  /**
   * Resets the context hierarchy to its initial state.
   * @param {Object} [newHierarchy] - New hierarchy to set (optional)
   */
  resetHierarchy(newHierarchy = null) {
    const oldHierarchy = deepClone(this.contextHierarchy);
    
    this.contextHierarchy = newHierarchy || {
      global: {
        user: {
          profile: {},
          session: {
            goals: [],
            currentFocus: {},
            interactionHistory: []
          }
        },
        system: {
          state: {},
          resources: {},
          capabilities: {}
        },
        domains: {}
      },
      tasks: {}
    };

    this.schemas.clear();
    this.contextRelationships.clear();

    this.eventEmitter.emit('context:hierarchy:reset', {
      oldHierarchy,
      newHierarchy: deepClone(this.contextHierarchy)
    });
  }
}

module.exports = ContextHierarchyManager;
