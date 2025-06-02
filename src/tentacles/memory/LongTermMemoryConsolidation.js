/**
 * LongTermMemoryConsolidation.js
 * 
 * Manages the long-term memory consolidation process for the Enhanced Memory Tentacle.
 * Provides selective retention, compression, and organization of important memories.
 * 
 * @module tentacles/memory/components/LongTermMemoryConsolidation
 */

const fs = require('fs').promises;
const path = require('path');
const { EventEmitter } = require('events');
const { Logger } = require('../../../utils/Logger');

/**
 * Long Term Memory Consolidation implementation
 * @class LongTermMemoryConsolidation
 * @extends EventEmitter
 */
class LongTermMemoryConsolidation extends EventEmitter {
  /**
   * Create a new Long Term Memory Consolidation
   * @constructor
   * @param {Object} options - Configuration options
   */
  constructor(options = {}) {
    super();
    
    this.logger = new Logger('LongTermMemoryConsolidation');
    
    this.options = {
      dataPath: options.dataPath || 'data/test/memory/consolidation/consolidation_state.json',
      persistData: options.persistData !== false,
      consolidationInterval: options.consolidationInterval || 1000 * 60 * 60 * 24, // 24 hours in milliseconds
      importanceThreshold: options.importanceThreshold || 0.7,
      compressionRatio: options.compressionRatio || 0.5,
      ...options
    };
    
    // Consolidation state
    this.consolidationState = {
      lastConsolidation: null,
      consolidationHistory: [],
      retentionPolicies: {},
      compressionSettings: {},
      consolidatedMemories: {}
    };
    
    // Consolidation interval
    this.consolidationIntervalId = null;
    
    // Consolidation results
    this.consolidationResults = null;
    
    this.logger.info('Long Term Memory Consolidation initialized');
  }

  /**
   * Initialize the Long Term Memory Consolidation
   * @async
   * @returns {Promise<boolean>} Initialization success
   */
  async initialize() {
    this.logger.info('Initializing Long Term Memory Consolidation');
    
    try {
      // Load consolidation state if persistence is enabled
      if (this.options.persistData) {
        await this.loadConsolidationState();
      }
      
      // Start consolidation process
      this.startConsolidationProcess();
      
      this.logger.info('Long Term Memory Consolidation initialized successfully');
      return true;
    } catch (error) {
      this.logger.error('Failed to initialize Long Term Memory Consolidation', error);
      throw error;
    }
  }

  /**
   * Load consolidation state from persistent storage
   * @async
   * @returns {Promise<boolean>} Load success
   */
  async loadConsolidationState() {
    try {
      // Ensure directory exists before attempting to read/write
      const dirPath = path.dirname(this.options.dataPath);
      await fs.mkdir(dirPath, { recursive: true });
      
      try {
        const data = await fs.readFile(this.options.dataPath, 'utf8');
        this.consolidationState = JSON.parse(data);
        this.logger.debug('Consolidation state loaded');
      } catch (readError) {
        if (readError.code === 'ENOENT') {
          // File doesn't exist yet, create it with default structure
          await this.saveConsolidationState();
          this.logger.debug('Created new consolidation state file');
        } else {
          throw readError;
        }
      }
      
      return true;
    } catch (error) {
      this.logger.error('Failed to load consolidation state', error);
      throw error;
    }
  }

  /**
   * Save consolidation state to persistent storage
   * @async
   * @returns {Promise<boolean>} Save success
   */
  async saveConsolidationState() {
    try {
      // Ensure directory exists before writing file
      const dirPath = path.dirname(this.options.dataPath);
      await fs.mkdir(dirPath, { recursive: true });
      
      await fs.writeFile(
        this.options.dataPath,
        JSON.stringify(this.consolidationState, null, 2)
      );
      this.logger.debug('Consolidation state saved');
      return true;
    } catch (error) {
      this.logger.error('Failed to save consolidation state', error);
      throw error;
    }
  }

  /**
   * Start consolidation process
   * @private
   */
  startConsolidationProcess() {
    if (this.consolidationIntervalId) {
      clearInterval(this.consolidationIntervalId);
    }
    
    // Check for consolidation based on interval
    this.consolidationIntervalId = setInterval(() => {
      this.checkAndConsolidate();
    }, 60000); // Check every minute
    
    this.logger.debug('Consolidation process started');
  }

  /**
   * Check if consolidation is needed and perform if necessary
   * @async
   * @private
   */
  async checkAndConsolidate() {
    const now = Date.now();
    const lastConsolidation = this.consolidationState.lastConsolidation || 0;
    
    // Check if consolidation interval has passed
    if (now - lastConsolidation >= this.options.consolidationInterval) {
      this.logger.info('Starting memory consolidation process');
      
      try {
        await this.consolidate();
      } catch (error) {
        this.logger.error('Error during memory consolidation', error);
      }
    }
  }

  /**
   * Consolidate memories
   * @async
   * @param {Object} options - Consolidation options
   * @returns {Promise<Object>} Consolidation results
   */
  async consolidate(options = {}) {
    this.logger.info('Starting memory consolidation');
    
    try {
      // Get memories to consolidate
      const memories = await this.getMemoriesToConsolidate(options);
      
      // Process each memory
      const processed = [];
      const retained = [];
      const compressed = [];
      
      for (const memory of memories) {
        processed.push(memory.id);
        
        // Determine if memory should be retained
        const importance = memory.metadata?.importance || 0.5;
        const shouldRetain = importance >= this.options.importanceThreshold || options.retainAll;
        
        if (shouldRetain) {
          // Retain memory
          retained.push(memory.id);
          
          // Check if memory should be compressed
          if (this.shouldCompressMemory(memory)) {
            const compressedMemory = await this.compressMemory(memory);
            compressed.push(compressedMemory.id);
          }
        } else {
          // Mark for forgetting
          await this.forgetMemory(memory.id);
        }
      }
      
      // Record consolidation results
      const results = {
        timestamp: Date.now(),
        memoriesProcessed: processed.length,
        memoriesRetained: retained.length,
        memoriesCompressed: compressed.length,
        compressionRatio: compressed.length > 0 ? compressed.length / retained.length : 0.5,
        status: 'completed',
        completed: true
      };
      
      // Save consolidation results
      this.consolidationResults = results;
      
      // Emit consolidation completed event
      this.emit('consolidation-completed', results);
      
      this.logger.info('Memory consolidation completed');
      console.log(JSON.stringify(results, null, 2));
      
      return results;
    } catch (error) {
      this.logger.error('Error during memory consolidation', error);
      throw error;
    }
  }
  
  /**
   * Get memories to consolidate
   * @async
   * @param {Object} options - Options for memory selection
   * @returns {Promise<Array<Object>>} Memories to consolidate
   */
  async getMemoriesToConsolidate(options = {}) {
    // In a real implementation, this would query the episodic memory system
    // For now, return a mock array of memories
    return [
      {
        id: `memory-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        content: 'Sample memory content 1',
        metadata: {
          importance: 0.8,
          timestamp: Date.now() - 86400000 // 1 day ago
        }
      },
      {
        id: `memory-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        content: 'Sample memory content 2',
        metadata: {
          importance: 0.4,
          timestamp: Date.now() - 172800000 // 2 days ago
        }
      },
      {
        id: `memory-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        content: 'Sample memory content 3',
        metadata: {
          importance: 0.9,
          timestamp: Date.now() - 259200000 // 3 days ago
        }
      }
    ];
  }
  
  /**
   * Check if memory should be compressed
   * @param {Object} memory - Memory to check
   * @returns {boolean} Whether memory should be compressed
   */
  shouldCompressMemory(memory) {
    // In a real implementation, this would use more sophisticated logic
    // For now, use a simple random decision
    return Math.random() > 0.5;
  }
  
  /**
   * Compress memory
   * @async
   * @param {Object} memory - Memory to compress
   * @returns {Promise<Object>} Compressed memory
   */
  async compressMemory(memory) {
    // In a real implementation, this would use AI to compress the memory
    // For now, return a simplified version
    return {
      id: memory.id,
      content: memory.content.substring(0, memory.content.length / 2) + '...',
      metadata: {
        ...memory.metadata,
        compressed: true,
        originalLength: memory.content.length,
        compressedLength: memory.content.length / 2
      }
    };
  }
  
  /**
   * Forget memory
   * @async
   * @param {string} memoryId - ID of memory to forget
   * @returns {Promise<boolean>} Success
   */
  async forgetMemory(memoryId) {
    // In a real implementation, this would mark the memory as forgotten
    // For now, just return success
    return true;
  }

  /**
   * Perform memory consolidation
   * @async
   * @param {Object} options - Consolidation options
   * @returns {Promise<Object>} Consolidation results
   */
  async performConsolidation(options = {}) {
    return this.consolidate(options);
  }
  
  /**
   * Consolidate memories (original implementation)
   * @async
   * @returns {Promise<Object>} Consolidation results
   */
  async consolidateMemories() {
    return this.consolidate();
  }

  /**
   * Set retention policy
   * @async
   * @param {string} policyId - Policy ID
   * @param {Object} policy - Retention policy
   * @returns {Promise<Object>} Updated policy
   */
  async setRetentionPolicy(policyId, policy) {
    this.consolidationState.retentionPolicies[policyId] = {
      ...policy,
      lastUpdated: Date.now()
    };
    
    // Persist changes if enabled
    if (this.options.persistData) {
      await this.saveConsolidationState();
    }
    
    this.logger.debug(`Retention policy set: ${policyId}`);
    
    return this.consolidationState.retentionPolicies[policyId];
  }

  /**
   * Get retention policy
   * @param {string} policyId - Policy ID
   * @returns {Object} Retention policy
   */
  getRetentionPolicy(policyId) {
    return this.consolidationState.retentionPolicies[policyId] || null;
  }

  /**
   * Set compression settings
   * @async
   * @param {string} settingsId - Settings ID
   * @param {Object} settings - Compression settings
   * @returns {Promise<Object>} Updated settings
   */
  async setCompressionSettings(settingsId, settings) {
    this.consolidationState.compressionSettings[settingsId] = {
      ...settings,
      lastUpdated: Date.now()
    };
    
    // Persist changes if enabled
    if (this.options.persistData) {
      await this.saveConsolidationState();
    }
    
    this.logger.debug(`Compression settings set: ${settingsId}`);
    
    return this.consolidationState.compressionSettings[settingsId];
  }

  /**
   * Get compression settings
   * @param {string} settingsId - Settings ID
   * @returns {Object} Compression settings
   */
  getCompressionSettings(settingsId) {
    return this.consolidationState.compressionSettings[settingsId] || null;
  }

  /**
   * Get consolidated memory
   * @param {string} memoryId - Memory ID
   * @returns {Object} Consolidated memory
   */
  getConsolidatedMemory(memoryId) {
    return this.consolidationState.consolidatedMemories[memoryId] || null;
  }

  /**
   * Get all consolidated memories
   * @returns {Object} Consolidated memories
   */
  getAllConsolidatedMemories() {
    return { ...this.consolidationState.consolidatedMemories };
  }

  /**
   * Get consolidation history
   * @returns {Array<Object>} Consolidation history
   */
  getConsolidationHistory() {
    return [...this.consolidationState.consolidationHistory];
  }
  
  /**
   * Get consolidation statistics
   * @returns {Object} Consolidation statistics
   */
  getConsolidationStats() {
    return {
      lastConsolidation: this.consolidationState.lastConsolidation,
      consolidationCount: this.consolidationState.consolidationHistory.length,
      consolidatedCount: Object.keys(this.consolidationState.consolidatedMemories).length,
      averageCompressionRatio: this.options.compressionRatio
    };
  }

  /**
   * Clean up resources
   * @async
   */
  async cleanup() {
    this.logger.info('Cleaning up Long Term Memory Consolidation');
    
    // Stop consolidation process
    if (this.consolidationIntervalId) {
      clearInterval(this.consolidationIntervalId);
      this.consolidationIntervalId = null;
    }
    
    // Persist final state if enabled
    if (this.options.persistData) {
      await this.saveConsolidationState();
    }
    
    // Remove all listeners
    this.removeAllListeners();
    
    return true;
  }
}

module.exports = { LongTermMemoryConsolidation };
