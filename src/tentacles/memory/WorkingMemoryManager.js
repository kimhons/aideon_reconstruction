/**
 * WorkingMemoryManager.js
 * 
 * Manages the working memory system for the Enhanced Memory Tentacle.
 * Provides temporary storage for active task contexts and current processing.
 * 
 * @module tentacles/memory/components/WorkingMemoryManager
 */

const fs = require('fs').promises;
const path = require('path');
const { EventEmitter } = require('events');
const { Logger } = require('../../../utils/Logger');

/**
 * Working Memory Manager implementation
 * @class WorkingMemoryManager
 * @extends EventEmitter
 */
class WorkingMemoryManager extends EventEmitter {
  /**
   * Create a new Working Memory Manager
   * @constructor
   * @param {Object} options - Configuration options
   */
  constructor(options = {}) {
    super();
    
    this.logger = new Logger('WorkingMemoryManager');
    
    this.options = {
      capacity: options.capacity || 10, // Number of active contexts
      retentionTime: options.retentionTime || 1000 * 60 * 60, // 1 hour in milliseconds
      dataPath: options.dataPath || 'data/test/memory/working/working_memory.json',
      persistData: options.persistData !== false,
      capacityLimit: options.capacityLimit || 100,
      ...options
    };
    
    // Working memory structure
    this.workingMemory = {
      activeContexts: [],
      focusedContext: null,
      temporaryStorage: {},
      lastAccessed: {}
    };
    
    // Initialize items array for working memory items
    this.items = [];
    
    // Memory decay interval
    this.decayInterval = null;
    
    this.logger.info('Working Memory Manager initialized');
  }

  /**
   * Initialize the Working Memory Manager
   * @async
   * @returns {Promise<boolean>} Initialization success
   */
  async initialize() {
    this.logger.info('Initializing Working Memory Manager');
    
    try {
      // Load working memory data if persistence is enabled
      if (this.options.persistData) {
        await this.loadWorkingMemoryData();
      }
      
      // Start memory decay process
      this.startMemoryDecay();
      
      this.logger.info('Working Memory Manager initialized successfully');
      return true;
    } catch (error) {
      this.logger.error('Failed to initialize Working Memory Manager', error);
      throw error;
    }
  }

  /**
   * Load working memory data from persistent storage
   * @async
   * @returns {Promise<boolean>} Load success
   */
  async loadWorkingMemoryData() {
    try {
      // Ensure directory exists before attempting to read/write
      const dirPath = path.dirname(this.options.dataPath);
      await fs.mkdir(dirPath, { recursive: true });
      
      try {
        const data = await fs.readFile(this.options.dataPath, 'utf8');
        this.workingMemory = JSON.parse(data);
        this.logger.debug('Working memory data loaded');
      } catch (readError) {
        if (readError.code === 'ENOENT') {
          // File doesn't exist yet, create it with default structure
          await this.saveWorkingMemoryData();
          this.logger.debug('Created new working memory data file');
        } else {
          throw readError;
        }
      }
      
      return true;
    } catch (error) {
      this.logger.error('Failed to load working memory data', error);
      throw error;
    }
  }

  /**
   * Save working memory data to persistent storage
   * @async
   * @returns {Promise<boolean>} Save success
   */
  async saveWorkingMemoryData() {
    try {
      // Ensure directory exists before writing file
      const dirPath = path.dirname(this.options.dataPath);
      await fs.mkdir(dirPath, { recursive: true });
      
      await fs.writeFile(
        this.options.dataPath,
        JSON.stringify(this.workingMemory, null, 2)
      );
      this.logger.debug('Working memory data saved');
      return true;
    } catch (error) {
      this.logger.error('Failed to save working memory data', error);
      throw error;
    }
  }

  /**
   * Start memory decay process
   * @private
   */
  startMemoryDecay() {
    if (this.decayInterval) {
      clearInterval(this.decayInterval);
    }
    
    // Check for memory decay every minute
    this.decayInterval = setInterval(() => {
      this.decayMemory();
    }, 60000);
    
    this.logger.debug('Memory decay process started');
  }

  /**
   * Decay memory items based on retention time
   * @private
   */
  decayMemory() {
    const now = Date.now();
    const retentionThreshold = now - this.options.retentionTime;
    
    // Decay active contexts
    this.workingMemory.activeContexts = this.workingMemory.activeContexts.filter(context => {
      const lastAccessed = this.workingMemory.lastAccessed[context.id] || 0;
      return lastAccessed > retentionThreshold;
    });
    
    // Decay temporary storage
    for (const key in this.workingMemory.temporaryStorage) {
      const item = this.workingMemory.temporaryStorage[key];
      const lastAccessed = this.workingMemory.lastAccessed[key] || 0;
      
      if (lastAccessed <= retentionThreshold) {
        delete this.workingMemory.temporaryStorage[key];
        delete this.workingMemory.lastAccessed[key];
      }
    }
    
    // Persist changes if enabled
    if (this.options.persistData) {
      this.saveWorkingMemoryData().catch(error => {
        this.logger.error('Failed to save working memory after decay', error);
      });
    }
    
    this.logger.debug('Memory decay completed');
  }
  /**
   * Add an item to working memory
   * @async
   * @param {Object} item - Item to add
   * @returns {Promise<Object>} Added item
   */
  async addItem(item) {
    // Generate item ID if not provided
    if (!item.id) {
      item.id = `wm-item-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }
    
    // Set timestamp if not provided
    if (!item.timestamp) {
      item.timestamp = Date.now();
    }
    
    // Set initial attention value if not provided
    if (item.attention === undefined) {
      item.attention = 1.0;
    }
    
    // Add item to working memory
    this.items.push(item);
    
    // Check if we need to evict items
    if (this.items.length > this.options.capacityLimit) {
      this.evictItems();
    }
    
    // Persist changes if enabled
    if (this.options.persistData) {
      await this.saveWorkingMemoryData();
    }
    
    // Emit item added event
    this.emit('item-added', item);
    
    this.logger.debug(`Added item to working memory: ${item.id}`);
    
    return item;
  }
  
  /**
   * Clear all items from working memory
   * @async
   * @returns {Promise<boolean>} Success
   */
  async clear() {
    this.items = [];
    
    // Persist changes if enabled
    if (this.options.persistData) {
      await this.saveWorkingMemoryData();
    }
    
    // Emit cleared event
    this.emit('memory-cleared');
    
    this.logger.debug('Cleared working memory');
    
    return true;
  }
  
  /**
   * Get all items in working memory
   * @returns {Array<Object>} All working memory items
   */
  async getAllItems() {
    // Initialize items array if it doesn't exist
    if (!this.items) {
      this.items = [];
    }
    return [...this.items];
  }
  
  /**
   * Add a context to working memory
   * @async
   * @param {Object} context - Context to add
   * @returns {Promise<Object>} Added context
   */
  async addContext(context) {
    if (!context.id) {
      context.id = `context-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }
    
    // Update last accessed time
    this.workingMemory.lastAccessed[context.id] = Date.now();
    
    // Check if context already exists
    const existingIndex = this.workingMemory.activeContexts.findIndex(c => c.id === context.id);
    
    if (existingIndex >= 0) {
      // Update existing context
      this.workingMemory.activeContexts[existingIndex] = {
        ...this.workingMemory.activeContexts[existingIndex],
        ...context
      };
      
      this.logger.debug(`Updated context: ${context.id}`);
    } else {
      // Add new context
      this.workingMemory.activeContexts.push(context);
      
      // If we exceed capacity, remove oldest context
      if (this.workingMemory.activeContexts.length > this.options.capacity) {
        // Find oldest context by last accessed time
        let oldestContext = this.workingMemory.activeContexts[0];
        let oldestTime = this.workingMemory.lastAccessed[oldestContext.id] || 0;
        
        for (let i = 1; i < this.workingMemory.activeContexts.length; i++) {
          const currentContext = this.workingMemory.activeContexts[i];
          const currentTime = this.workingMemory.lastAccessed[currentContext.id] || 0;
          
          if (currentTime < oldestTime) {
            oldestContext = currentContext;
            oldestTime = currentTime;
          }
        }
        
        // Remove oldest context
        this.workingMemory.activeContexts = this.workingMemory.activeContexts.filter(c => c.id !== oldestContext.id);
        
        // Emit context removed event
        this.emit('context-removed', oldestContext);
        
        this.logger.debug(`Removed oldest context: ${oldestContext.id}`);
      }
      
      this.logger.debug(`Added context: ${context.id}`);
    }
    
    // Emit context added/updated event
    this.emit('context-updated', context);
    
    // Persist changes if enabled
    if (this.options.persistData) {
      await this.saveWorkingMemoryData();
    }
    
    return context;
  }

  /**
   * Get a context from working memory
   * @param {string} contextId - Context ID
   * @returns {Object} Context
   */
  getContext(contextId) {
    const context = this.workingMemory.activeContexts.find(c => c.id === contextId);
    
    if (context) {
      // Update last accessed time
      this.workingMemory.lastAccessed[contextId] = Date.now();
    }
    
    return context;
  }

  /**
   * Remove a context from working memory
   * @async
   * @param {string} contextId - Context ID
   * @returns {Promise<boolean>} Removal success
   */
  async removeContext(contextId) {
    const initialLength = this.workingMemory.activeContexts.length;
    
    // Remove context
    this.workingMemory.activeContexts = this.workingMemory.activeContexts.filter(c => c.id !== contextId);
    
    // Clear last accessed time
    delete this.workingMemory.lastAccessed[contextId];
    
    // If focused context is removed, clear it
    if (this.workingMemory.focusedContext === contextId) {
      this.workingMemory.focusedContext = null;
    }
    
    // Emit context removed event
    this.emit('context-removed', { id: contextId });
    
    // Persist changes if enabled
    if (this.options.persistData) {
      await this.saveWorkingMemoryData();
    }
    
    return initialLength > this.workingMemory.activeContexts.length;
  }

  /**
   * Set focused context
   * @async
   * @param {string} contextId - Context ID
   * @returns {Promise<Object>} Focused context
   */
  async setFocusedContext(contextId) {
    const context = this.getContext(contextId);
    
    if (!context) {
      throw new Error(`Context not found: ${contextId}`);
    }
    
    this.workingMemory.focusedContext = contextId;
    
    // Update last accessed time
    this.workingMemory.lastAccessed[contextId] = Date.now();
    
    // Emit focus changed event
    this.emit('focus-changed', context);
    
    // Persist changes if enabled
    if (this.options.persistData) {
      await this.saveWorkingMemoryData();
    }
    
    return context;
  }

  /**
   * Get focused context
   * @returns {Object} Focused context
   */
  getFocusedContext() {
    if (!this.workingMemory.focusedContext) {
      return null;
    }
    
    return this.getContext(this.workingMemory.focusedContext);
  }

  /**
   * Store item in temporary storage
   * @async
   * @param {string} key - Storage key
   * @param {*} value - Value to store
   * @returns {Promise<boolean>} Storage success
   */
  async storeTemporary(key, value) {
    this.workingMemory.temporaryStorage[key] = value;
    this.workingMemory.lastAccessed[key] = Date.now();
    
    // Persist changes if enabled
    if (this.options.persistData) {
      await this.saveWorkingMemoryData();
    }
    
    this.logger.debug(`Stored temporary item: ${key}`);
    return true;
  }

  /**
   * Retrieve item from temporary storage
   * @param {string} key - Storage key
   * @returns {*} Stored value
   */
  retrieveTemporary(key) {
    const value = this.workingMemory.temporaryStorage[key];
    
    if (value !== undefined) {
      // Update last accessed time
      this.workingMemory.lastAccessed[key] = Date.now();
    }
    
    return value;
  }

  /**
   * Remove item from temporary storage
   * @async
   * @param {string} key - Storage key
   * @returns {Promise<boolean>} Removal success
   */
  async removeTemporary(key) {
    const exists = this.workingMemory.temporaryStorage[key] !== undefined;
    
    if (exists) {
      delete this.workingMemory.temporaryStorage[key];
      delete this.workingMemory.lastAccessed[key];
      
      // Persist changes if enabled
      if (this.options.persistData) {
        await this.saveWorkingMemoryData();
      }
      
      this.logger.debug(`Removed temporary item: ${key}`);
    }
    
    return exists;
  }

  /**
   * Get all active contexts
   * @returns {Array<Object>} Active contexts
   */
  getAllContexts() {
    return [...this.workingMemory.activeContexts];
  }

  /**
   * Clean up resources
   * @async
   */
  async cleanup() {
    this.logger.info('Cleaning up Working Memory Manager');
    
    // Stop memory decay process
    if (this.decayInterval) {
      clearInterval(this.decayInterval);
      this.decayInterval = null;
    }
    
    // Persist final state if enabled
    if (this.options.persistData) {
      await this.saveWorkingMemoryData();
    }
    
    // Remove all listeners
    this.removeAllListeners();
    
    return true;
  }
}

module.exports = { WorkingMemoryManager };
