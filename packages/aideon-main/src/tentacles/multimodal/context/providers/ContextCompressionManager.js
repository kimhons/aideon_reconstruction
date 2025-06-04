/**
 * @fileoverview ContextCompressionManager for efficient context storage and retrieval.
 * 
 * This module provides functionality for compressing and decompressing context data
 * to minimize storage requirements while maintaining accessibility and usability.
 * 
 * @author Aideon AI Team
 * @version 1.0.0
 */

const { EventEmitter } = require('events');
const { EnhancedAsyncLockAdapter } = require('../../../input/utils/EnhancedAsyncLockAdapter');
const zlib = require('zlib');
const util = require('util');

// Promisify zlib functions
const deflateAsync = util.promisify(zlib.deflate);
const inflateAsync = util.promisify(zlib.inflate);
const gzipAsync = util.promisify(zlib.gzip);
const gunzipAsync = util.promisify(zlib.gunzip);
const brotliCompressAsync = util.promisify(zlib.brotliCompress);
const brotliDecompressAsync = util.promisify(zlib.brotliDecompress);

/**
 * ContextCompressionManager handles efficient storage and retrieval of context data.
 */
class ContextCompressionManager extends EventEmitter {
  /**
   * Constructor for ContextCompressionManager.
   * @param {Object} options Configuration options
   * @param {Object} options.logger Logger instance
   * @param {Object} options.configService Configuration service
   * @param {Object} options.performanceMonitor Performance monitoring service
   * @param {Object} options.securityManager Security manager for access control
   * @param {Object} options.mcpContextManager MCP Context Manager instance
   * @param {Object} options.contextPrioritizationSystem Context Prioritization System instance
   */
  constructor(options = {}) {
    super();
    
    // Validate required dependencies
    if (!options) throw new Error('Options are required for ContextCompressionManager');
    if (!options.logger) throw new Error('Logger is required for ContextCompressionManager');
    if (!options.configService) throw new Error('ConfigService is required for ContextCompressionManager');
    if (!options.performanceMonitor) throw new Error('PerformanceMonitor is required for ContextCompressionManager');
    if (!options.securityManager) throw new Error('SecurityManager is required for ContextCompressionManager');
    if (!options.mcpContextManager) throw new Error('MCPContextManager is required for ContextCompressionManager');
    if (!options.contextPrioritizationSystem) throw new Error('ContextPrioritizationSystem is required for ContextCompressionManager');
    
    // Initialize properties
    this.logger = options.logger;
    this.configService = options.configService;
    this.performanceMonitor = options.performanceMonitor;
    this.securityManager = options.securityManager;
    this.mcpContextManager = options.mcpContextManager;
    this.contextPrioritizationSystem = options.contextPrioritizationSystem;
    
    // Initialize state
    this.initialized = false;
    this.compressedContextData = new Map();
    this.compressionMetadata = new Map();
    this.compressionStrategies = new Map();
    this.compressionLevels = new Map();
    this.summaries = new Map();
    
    // Default configuration
    this.config = {
      defaultCompressionLevel: 'medium',
      compressionLevels: {
        none: 0,      // No compression
        low: 1,       // Light compression
        medium: 6,    // Balanced compression
        high: 9       // Maximum compression
      },
      compressionThresholds: {
        size: 1024,   // Minimum size in bytes for compression
        priority: 0.5 // Priority threshold for lossy compression
      },
      defaultAlgorithm: 'brotli',
      summaryMaxLength: 200,
      incrementalUpdateThreshold: 0.3 // Percentage change threshold for incremental updates
    };
    
    // Create lock adapter for thread safety
    this.lockAdapter = new EnhancedAsyncLockAdapter();
    
    // Initialize locks with bound function wrappers
    this.locks = {
      compression: (name, fn) => this.lockAdapter.withLock(name, fn),
      decompression: (name, fn) => this.lockAdapter.withLock(name, fn),
      update: (name, fn) => this.lockAdapter.withLock(name, fn),
      summary: (name, fn) => this.lockAdapter.withLock(name, fn)
    };
    
    this.logger.info('ContextCompressionManager created');
  }
  
  /**
   * Initialize the context compression manager.
   * @param {Object} options Initialization options
   * @returns {Promise<boolean>} True if initialization was successful
   */
  async initialize(options = {}) {
    try {
      this.logger.info('Initializing ContextCompressionManager');
      
      // Apply custom configuration if provided
      if (options.config) {
        this.config = { ...this.config, ...options.config };
      }
      
      // Load configuration from config service
      const configuredCompressionLevels = this.configService.get('context.compression.levels');
      if (configuredCompressionLevels) {
        this.config.compressionLevels = { ...this.config.compressionLevels, ...configuredCompressionLevels };
      }
      
      // Register compression strategies
      this._registerCompressionStrategies();
      
      // Set up event listeners
      this._setupEventListeners();
      
      // Register with MCP Context Manager
      await this.mcpContextManager.registerContextProvider('compression.metadata', this);
      
      this.initialized = true;
      this.logger.info('ContextCompressionManager initialized successfully');
      
      return true;
    } catch (error) {
      this.logger.error(`Failed to initialize ContextCompressionManager: ${error.message}`, { error });
      this.initialized = false;
      
      // Emit initialization error event
      this.emit('error', {
        type: 'initialization',
        message: error.message,
        error
      });
      
      return false;
    }
  }
  
  /**
   * Register compression strategies.
   * @private
   */
  _registerCompressionStrategies() {
    try {
      this.logger.debug('Registering compression strategies');
      
      // Register lossless compression strategies
      this.compressionStrategies.set('deflate', {
        compress: this._compressWithDeflate.bind(this),
        decompress: this._decompressWithDeflate.bind(this),
        lossless: true
      });
      
      this.compressionStrategies.set('gzip', {
        compress: this._compressWithGzip.bind(this),
        decompress: this._decompressWithGzip.bind(this),
        lossless: true
      });
      
      this.compressionStrategies.set('brotli', {
        compress: this._compressWithBrotli.bind(this),
        decompress: this._decompressWithBrotli.bind(this),
        lossless: true
      });
      
      // Register lossy compression strategies
      this.compressionStrategies.set('summary', {
        compress: this._compressWithSummary.bind(this),
        decompress: this._decompressWithSummary.bind(this),
        lossless: false
      });
      
      this.compressionStrategies.set('keypoints', {
        compress: this._compressWithKeypoints.bind(this),
        decompress: this._decompressWithKeypoints.bind(this),
        lossless: false
      });
      
      this.compressionStrategies.set('hierarchical', {
        compress: this._compressWithHierarchy.bind(this),
        decompress: this._decompressWithHierarchy.bind(this),
        lossless: false
      });
      
      this.logger.debug('Compression strategies registered successfully');
    } catch (error) {
      this.logger.error(`Failed to register compression strategies: ${error.message}`, { error });
      throw error;
    }
  }
  
  /**
   * Set up event listeners for context updates.
   * @private
   */
  _setupEventListeners() {
    try {
      this.logger.debug('Setting up event listeners for context updates');
      
      // Listen for context update events from MCP Context Manager
      this.mcpContextManager.on('contextUpdated', this._handleContextUpdate.bind(this));
      
      // Listen for context request events from MCP Context Manager
      this.mcpContextManager.on('contextRequested', this._handleContextRequest.bind(this));
      
      // Listen for priority update events from Context Prioritization System
      this.contextPrioritizationSystem.on('priorityUpdated', this._handlePriorityUpdate.bind(this));
      
      this.logger.debug('Event listeners set up successfully');
    } catch (error) {
      this.logger.error(`Failed to set up event listeners: ${error.message}`, { error });
      throw error;
    }
  }
  
  /**
   * Handle context update events from MCP Context Manager.
   * @private
   * @param {Object} event Context update event
   */
  async _handleContextUpdate(event) {
    try {
      // Skip compression metadata updates to avoid recursion
      if (event.contextType === 'compression.metadata') {
        return;
      }
      
      this.logger.debug(`Handling context update for type: ${event.contextType}`);
      
      // Check if context should be compressed
      if (await this._shouldCompressContext(event.contextType, event.contextData)) {
        // Compress context data
        await this.compressContext(event.contextType, event.contextData);
      }
    } catch (error) {
      this.logger.error(`Failed to handle context update: ${error.message}`, { error, event });
    }
  }
  
  /**
   * Handle context request events from MCP Context Manager.
   * @private
   * @param {Object} event Context request event
   */
  async _handleContextRequest(event) {
    try {
      // Check if this is a request for compressed context or metadata
      if (event.contextType === 'compression.metadata' || event.contextType.startsWith('compression.')) {
        this.logger.debug(`Handling context request for type: ${event.contextType}`);
        
        // Process context request
        await this._processContextRequest(event.contextType, event.requestId, event.source);
      } else {
        // Check if we have compressed data for this context type
        if (this.compressedContextData.has(event.contextType)) {
          this.logger.debug(`Handling decompression request for type: ${event.contextType}`);
          
          // Decompress and respond
          await this._processDecompressionRequest(event.contextType, event.requestId, event.source);
        }
      }
    } catch (error) {
      this.logger.error(`Failed to handle context request: ${error.message}`, { error, event });
    }
  }
  
  /**
   * Handle priority update events from Context Prioritization System.
   * @private
   * @param {Object} event Priority update event
   */
  async _handlePriorityUpdate(event) {
    try {
      this.logger.debug(`Handling priority update for type: ${event.contextType}`);
      
      // Check if we have compressed data for this context type
      if (this.compressedContextData.has(event.contextType)) {
        // Get current compression level
        const metadata = this.compressionMetadata.get(event.contextType);
        
        // Determine if compression level should change based on new priority
        const newLevel = this._determineCompressionLevel(event.contextType, event.priorityScore);
        
        if (metadata && metadata.compressionLevel !== newLevel) {
          this.logger.debug(`Updating compression level for ${event.contextType} from ${metadata.compressionLevel} to ${newLevel}`);
          
          // Get original context data
          const contextData = await this.decompressContext(event.contextType);
          
          // Recompress with new level
          if (contextData) {
            await this.compressContext(event.contextType, contextData, { compressionLevel: newLevel });
          }
        }
      }
    } catch (error) {
      this.logger.error(`Failed to handle priority update: ${error.message}`, { error, event });
    }
  }
  
  /**
   * Process context request.
   * @private
   * @param {string} contextType Context type
   * @param {string} requestId Request ID
   * @param {string} source Source of the request
   */
  async _processContextRequest(contextType, requestId, source) {
    try {
      // Use lock to ensure thread safety
      await this.locks.decompression('processContextRequest', async () => {
        this.logger.debug(`Processing context request for type: ${contextType}`);
        
        let contextData = null;
        
        if (contextType === 'compression.metadata') {
          // Return all compression metadata
          contextData = Object.fromEntries(
            Array.from(this.compressionMetadata.entries()).map(([type, metadata]) => [
              type,
              {
                algorithm: metadata.algorithm,
                compressionLevel: metadata.compressionLevel,
                originalSize: metadata.originalSize,
                compressedSize: metadata.compressedSize,
                compressionRatio: metadata.compressionRatio,
                lossless: metadata.lossless,
                timestamp: metadata.timestamp
              }
            ])
          );
        } else if (contextType.startsWith('compression.')) {
          // Extract the specific context type
          const specificType = contextType.substring(12); // Remove 'compression.' prefix
          const metadata = this.compressionMetadata.get(specificType);
          
          if (metadata) {
            contextData = {
              algorithm: metadata.algorithm,
              compressionLevel: metadata.compressionLevel,
              originalSize: metadata.originalSize,
              compressedSize: metadata.compressedSize,
              compressionRatio: metadata.compressionRatio,
              lossless: metadata.lossless,
              timestamp: metadata.timestamp
            };
          }
        }
        
        // Respond to request
        await this.mcpContextManager.respondToContextRequest(requestId, {
          contextType,
          contextData,
          timestamp: Date.now(),
          source: 'ContextCompressionManager'
        });
        
        this.logger.debug(`Context request processed for type: ${contextType}`);
      });
    } catch (error) {
      this.logger.error(`Failed to process context request: ${error.message}`, { error, contextType });
      throw error;
    }
  }
  
  /**
   * Process decompression request.
   * @private
   * @param {string} contextType Context type
   * @param {string} requestId Request ID
   * @param {string} source Source of the request
   */
  async _processDecompressionRequest(contextType, requestId, source) {
    try {
      // Use lock to ensure thread safety
      await this.locks.decompression('processDecompressionRequest', async () => {
        this.logger.debug(`Processing decompression request for type: ${contextType}`);
        
        // Decompress context data
        const contextData = await this.decompressContext(contextType);
        
        if (contextData) {
          // Respond to request
          await this.mcpContextManager.respondToContextRequest(requestId, {
            contextType,
            contextData,
            timestamp: Date.now(),
            source: 'ContextCompressionManager'
          });
          
          this.logger.debug(`Decompression request processed for type: ${contextType}`);
        }
      });
    } catch (error) {
      this.logger.error(`Failed to process decompression request: ${error.message}`, { error, contextType });
      throw error;
    }
  }
  
  /**
   * Check if context should be compressed.
   * @private
   * @param {string} contextType Context type
   * @param {Object} contextData Context data
   * @returns {Promise<boolean>} True if context should be compressed
   */
  async _shouldCompressContext(contextType, contextData) {
    try {
      // Skip compression for null or undefined data
      if (contextData === null || contextData === undefined) {
        return false;
      }
      
      // Convert to string if not already
      const dataString = typeof contextData === 'string' 
        ? contextData 
        : JSON.stringify(contextData);
      
      // Check size threshold
      if (dataString.length < this.config.compressionThresholds.size) {
        return false;
      }
      
      // Check if already compressed
      if (this.compressedContextData.has(contextType)) {
        // Check if data has changed significantly
        const metadata = this.compressionMetadata.get(contextType);
        if (metadata && metadata.originalSize) {
          const sizeChange = Math.abs(dataString.length - metadata.originalSize) / metadata.originalSize;
          if (sizeChange < this.config.incrementalUpdateThreshold) {
            return false;
          }
        }
      }
      
      return true;
    } catch (error) {
      this.logger.error(`Failed to check if context should be compressed: ${error.message}`, { error, contextType });
      return false;
    }
  }
  
  /**
   * Determine compression level based on context type and priority.
   * @private
   * @param {string} contextType Context type
   * @param {number} priorityScore Priority score
   * @returns {string} Compression level
   */
  _determineCompressionLevel(contextType, priorityScore) {
    try {
      // Get priority score if not provided
      if (priorityScore === undefined) {
        priorityScore = this.contextPrioritizationSystem.getPriorityScore(contextType);
      }
      
      // Determine compression level based on priority
      if (priorityScore >= 0.8) {
        return 'low'; // High priority data gets light compression
      } else if (priorityScore >= 0.5) {
        return 'medium'; // Medium priority data gets balanced compression
      } else {
        return 'high'; // Low priority data gets maximum compression
      }
    } catch (error) {
      this.logger.error(`Failed to determine compression level: ${error.message}`, { error, contextType });
      return this.config.defaultCompressionLevel;
    }
  }
  
  /**
   * Determine compression algorithm based on context type and data.
   * @private
   * @param {string} contextType Context type
   * @param {Object} contextData Context data
   * @param {number} priorityScore Priority score
   * @returns {string} Compression algorithm
   */
  _determineCompressionAlgorithm(contextType, contextData, priorityScore) {
    try {
      // Get priority score if not provided
      if (priorityScore === undefined) {
        priorityScore = this.contextPrioritizationSystem.getPriorityScore(contextType);
      }
      
      // For high priority data, always use lossless compression
      if (priorityScore >= this.config.compressionThresholds.priority) {
        return this.config.defaultAlgorithm;
      }
      
      // For text data, use brotli
      if (typeof contextData === 'string' || 
          (contextData && typeof contextData.text === 'string')) {
        return 'brotli';
      }
      
      // For structured data, use hierarchical compression
      if (typeof contextData === 'object' && contextData !== null) {
        return 'hierarchical';
      }
      
      // Default algorithm
      return this.config.defaultAlgorithm;
    } catch (error) {
      this.logger.error(`Failed to determine compression algorithm: ${error.message}`, { error, contextType });
      return this.config.defaultAlgorithm;
    }
  }
  
  /**
   * Compress context data.
   * @param {string} contextType Context type
   * @param {Object} contextData Context data
   * @param {Object} options Compression options
   * @param {string} options.algorithm Compression algorithm
   * @param {string} options.compressionLevel Compression level
   * @returns {Promise<boolean>} True if compression was successful
   */
  async compressContext(contextType, contextData, options = {}) {
    try {
      this.logger.debug(`Compressing context data for type: ${contextType}`);
      
      // Start performance monitoring
      const perfTimer = this.performanceMonitor.startTimer('contextCompression');
      
      // Use lock to ensure thread safety
      return await this.locks.compression('compressContext', async () => {
        // Determine compression algorithm
        const algorithm = options.algorithm || 
          this._determineCompressionAlgorithm(contextType, contextData);
        
        // Determine compression level
        const compressionLevel = options.compressionLevel || 
          this._determineCompressionLevel(contextType);
        
        // Get compression strategy
        const strategy = this.compressionStrategies.get(algorithm);
        if (!strategy) {
          throw new Error(`Compression algorithm not supported: ${algorithm}`);
        }
        
        // Convert to string if not already
        const originalData = typeof contextData === 'string' 
          ? contextData 
          : JSON.stringify(contextData);
        
        // Compress data
        const compressedData = await strategy.compress(originalData, {
          level: this.config.compressionLevels[compressionLevel]
        });
        
        // Calculate compression ratio
        const originalSize = originalData.length;
        const compressedSize = compressedData.length;
        const compressionRatio = originalSize / compressedSize;
        
        // Store compressed data
        this.compressedContextData.set(contextType, compressedData);
        
        // Store compression metadata
        const metadata = {
          algorithm,
          compressionLevel,
          originalSize,
          compressedSize,
          compressionRatio,
          lossless: strategy.lossless,
          timestamp: Date.now()
        };
        
        this.compressionMetadata.set(contextType, metadata);
        
        // Generate summary if needed
        if (!strategy.lossless) {
          await this._generateSummary(contextType, contextData);
        }
        
        // End performance monitoring
        this.performanceMonitor.endTimer(perfTimer);
        
        // Emit event
        this.emit('contextCompressed', {
          contextType,
          metadata,
          timestamp: Date.now()
        });
        
        // Publish compression metadata
        await this.mcpContextManager.publishContext(`compression.${contextType}`, {
          algorithm: metadata.algorithm,
          compressionLevel: metadata.compressionLevel,
          originalSize: metadata.originalSize,
          compressedSize: metadata.compressedSize,
          compressionRatio: metadata.compressionRatio,
          lossless: metadata.lossless,
          timestamp: metadata.timestamp
        });
        
        this.logger.debug(`Context data compressed for type: ${contextType}, ratio: ${compressionRatio.toFixed(2)}`);
        
        return true;
      });
    } catch (error) {
      this.logger.error(`Failed to compress context data: ${error.message}`, { error, contextType });
      throw error;
    }
  }
  
  /**
   * Decompress context data.
   * @param {string} contextType Context type
   * @returns {Promise<Object>} Decompressed context data
   */
  async decompressContext(contextType) {
    try {
      this.logger.debug(`Decompressing context data for type: ${contextType}`);
      
      // Start performance monitoring
      const perfTimer = this.performanceMonitor.startTimer('contextDecompression');
      
      // Use lock to ensure thread safety
      return await this.locks.decompression('decompressContext', async () => {
        // Check if we have compressed data
        if (!this.compressedContextData.has(contextType)) {
          this.logger.warn(`No compressed data found for context type: ${contextType}`);
          return null;
        }
        
        // Get compressed data
        const compressedData = this.compressedContextData.get(contextType);
        
        // Get compression metadata
        const metadata = this.compressionMetadata.get(contextType);
        if (!metadata) {
          this.logger.warn(`No compression metadata found for context type: ${contextType}`);
          return null;
        }
        
        // Get compression strategy
        const strategy = this.compressionStrategies.get(metadata.algorithm);
        if (!strategy) {
          throw new Error(`Compression algorithm not supported: ${metadata.algorithm}`);
        }
        
        // Decompress data
        const decompressedData = await strategy.decompress(compressedData);
        
        // Parse JSON if needed
        let result;
        try {
          result = JSON.parse(decompressedData);
        } catch (e) {
          // If not valid JSON, return as string
          result = decompressedData;
        }
        
        // End performance monitoring
        this.performanceMonitor.endTimer(perfTimer);
        
        // Emit event
        this.emit('contextDecompressed', {
          contextType,
          timestamp: Date.now()
        });
        
        this.logger.debug(`Context data decompressed for type: ${contextType}`);
        
        return result;
      });
    } catch (error) {
      this.logger.error(`Failed to decompress context data: ${error.message}`, { error, contextType });
      throw error;
    }
  }
  
  /**
   * Generate summary for context data.
   * @private
   * @param {string} contextType Context type
   * @param {Object} contextData Context data
   * @returns {Promise<string>} Summary
   */
  async _generateSummary(contextType, contextData) {
    try {
      // Use lock to ensure thread safety
      return await this.locks.summary('generateSummary', async () => {
        this.logger.debug(`Generating summary for context type: ${contextType}`);
        
        // Convert to string if not already
        const dataString = typeof contextData === 'string' 
          ? contextData 
          : JSON.stringify(contextData);
        
        // Generate simple summary
        let summary;
        if (dataString.length <= this.config.summaryMaxLength) {
          summary = dataString;
        } else {
          summary = dataString.substring(0, this.config.summaryMaxLength) + '...';
        }
        
        // Store summary
        this.summaries.set(contextType, summary);
        
        this.logger.debug(`Summary generated for context type: ${contextType}`);
        
        return summary;
      });
    } catch (error) {
      this.logger.error(`Failed to generate summary: ${error.message}`, { error, contextType });
      throw error;
    }
  }
  
  /**
   * Get summary for context data.
   * @param {string} contextType Context type
   * @returns {string} Summary
   */
  getSummary(contextType) {
    try {
      this.logger.debug(`Getting summary for context type: ${contextType}`);
      
      // Get summary
      const summary = this.summaries.get(contextType);
      
      return summary || '';
    } catch (error) {
      this.logger.error(`Failed to get summary: ${error.message}`, { error, contextType });
      return '';
    }
  }
  
  /**
   * Get compression metadata.
   * @param {string} contextType Context type
   * @returns {Object} Compression metadata
   */
  getCompressionMetadata(contextType) {
    try {
      this.logger.debug(`Getting compression metadata for context type: ${contextType}`);
      
      // Get metadata
      const metadata = this.compressionMetadata.get(contextType);
      
      return metadata || null;
    } catch (error) {
      this.logger.error(`Failed to get compression metadata: ${error.message}`, { error, contextType });
      return null;
    }
  }
  
  /**
   * Get all compression metadata.
   * @returns {Object} All compression metadata
   */
  getAllCompressionMetadata() {
    try {
      this.logger.debug('Getting all compression metadata');
      
      // Convert metadata map to object
      return Object.fromEntries(
        Array.from(this.compressionMetadata.entries()).map(([type, metadata]) => [
          type,
          {
            algorithm: metadata.algorithm,
            compressionLevel: metadata.compressionLevel,
            originalSize: metadata.originalSize,
            compressedSize: metadata.compressedSize,
            compressionRatio: metadata.compressionRatio,
            lossless: metadata.lossless,
            timestamp: metadata.timestamp
          }
        ])
      );
    } catch (error) {
      this.logger.error(`Failed to get all compression metadata: ${error.message}`, { error });
      return {};
    }
  }
  
  /**
   * Compress data with deflate algorithm.
   * @private
   * @param {string} data Data to compress
   * @param {Object} options Compression options
   * @returns {Promise<Buffer>} Compressed data
   */
  async _compressWithDeflate(data, options = {}) {
    try {
      return await deflateAsync(Buffer.from(data), {
        level: options.level || this.config.compressionLevels.medium
      });
    } catch (error) {
      this.logger.error(`Failed to compress with deflate: ${error.message}`, { error });
      throw error;
    }
  }
  
  /**
   * Decompress data with deflate algorithm.
   * @private
   * @param {Buffer} data Data to decompress
   * @returns {Promise<string>} Decompressed data
   */
  async _decompressWithDeflate(data) {
    try {
      const result = await inflateAsync(data);
      return result.toString();
    } catch (error) {
      this.logger.error(`Failed to decompress with deflate: ${error.message}`, { error });
      throw error;
    }
  }
  
  /**
   * Compress data with gzip algorithm.
   * @private
   * @param {string} data Data to compress
   * @param {Object} options Compression options
   * @returns {Promise<Buffer>} Compressed data
   */
  async _compressWithGzip(data, options = {}) {
    try {
      return await gzipAsync(Buffer.from(data), {
        level: options.level || this.config.compressionLevels.medium
      });
    } catch (error) {
      this.logger.error(`Failed to compress with gzip: ${error.message}`, { error });
      throw error;
    }
  }
  
  /**
   * Decompress data with gzip algorithm.
   * @private
   * @param {Buffer} data Data to decompress
   * @returns {Promise<string>} Decompressed data
   */
  async _decompressWithGzip(data) {
    try {
      const result = await gunzipAsync(data);
      return result.toString();
    } catch (error) {
      this.logger.error(`Failed to decompress with gzip: ${error.message}`, { error });
      throw error;
    }
  }
  
  /**
   * Compress data with brotli algorithm.
   * @private
   * @param {string} data Data to compress
   * @param {Object} options Compression options
   * @returns {Promise<Buffer>} Compressed data
   */
  async _compressWithBrotli(data, options = {}) {
    try {
      return await brotliCompressAsync(Buffer.from(data), {
        params: {
          [zlib.constants.BROTLI_PARAM_QUALITY]: options.level || this.config.compressionLevels.medium
        }
      });
    } catch (error) {
      this.logger.error(`Failed to compress with brotli: ${error.message}`, { error });
      throw error;
    }
  }
  
  /**
   * Decompress data with brotli algorithm.
   * @private
   * @param {Buffer} data Data to decompress
   * @returns {Promise<string>} Decompressed data
   */
  async _decompressWithBrotli(data) {
    try {
      const result = await brotliDecompressAsync(data);
      return result.toString();
    } catch (error) {
      this.logger.error(`Failed to decompress with brotli: ${error.message}`, { error });
      throw error;
    }
  }
  
  /**
   * Compress data with summary algorithm (lossy).
   * @private
   * @param {string} data Data to compress
   * @param {Object} options Compression options
   * @returns {Promise<Buffer>} Compressed data
   */
  async _compressWithSummary(data, options = {}) {
    try {
      // Parse data if JSON
      let parsedData;
      try {
        parsedData = JSON.parse(data);
      } catch (e) {
        parsedData = data;
      }
      
      // Generate summary
      let summary;
      if (typeof parsedData === 'string') {
        // For text, take first N characters
        const maxLength = options.maxLength || this.config.summaryMaxLength;
        summary = parsedData.length <= maxLength 
          ? parsedData 
          : parsedData.substring(0, maxLength) + '...';
      } else if (typeof parsedData === 'object' && parsedData !== null) {
        // For objects, take key properties
        summary = {};
        const keys = Object.keys(parsedData);
        const maxKeys = 10;
        
        for (let i = 0; i < Math.min(keys.length, maxKeys); i++) {
          const key = keys[i];
          const value = parsedData[key];
          
          if (typeof value === 'string') {
            summary[key] = value.length <= 50 ? value : value.substring(0, 50) + '...';
          } else if (typeof value === 'number' || typeof value === 'boolean') {
            summary[key] = value;
          } else if (Array.isArray(value)) {
            summary[key] = `Array(${value.length})`;
          } else if (typeof value === 'object' && value !== null) {
            summary[key] = `Object(${Object.keys(value).length} keys)`;
          } else {
            summary[key] = String(value);
          }
        }
        
        if (keys.length > maxKeys) {
          summary._additional = `${keys.length - maxKeys} more keys`;
        }
      } else {
        // For other types, convert to string
        summary = String(parsedData);
      }
      
      // Store original data in metadata
      const metadata = {
        originalData: data,
        summaryType: typeof parsedData === 'object' ? 'object' : 'text'
      };
      
      // Combine summary and metadata
      const result = {
        summary,
        metadata
      };
      
      return Buffer.from(JSON.stringify(result));
    } catch (error) {
      this.logger.error(`Failed to compress with summary: ${error.message}`, { error });
      throw error;
    }
  }
  
  /**
   * Decompress data with summary algorithm (lossy).
   * @private
   * @param {Buffer} data Data to decompress
   * @returns {Promise<string>} Decompressed data
   */
  async _decompressWithSummary(data) {
    try {
      // Parse compressed data
      const parsed = JSON.parse(data.toString());
      
      // Return original data if available
      if (parsed.metadata && parsed.metadata.originalData) {
        return parsed.metadata.originalData;
      }
      
      // Otherwise return summary
      return JSON.stringify(parsed.summary);
    } catch (error) {
      this.logger.error(`Failed to decompress with summary: ${error.message}`, { error });
      throw error;
    }
  }
  
  /**
   * Compress data with keypoints algorithm (lossy).
   * @private
   * @param {string} data Data to compress
   * @param {Object} options Compression options
   * @returns {Promise<Buffer>} Compressed data
   */
  async _compressWithKeypoints(data, options = {}) {
    try {
      // Parse data if JSON
      let parsedData;
      try {
        parsedData = JSON.parse(data);
      } catch (e) {
        parsedData = data;
      }
      
      // Extract keypoints
      let keypoints;
      if (typeof parsedData === 'string') {
        // For text, extract sentences
        const sentences = parsedData.match(/[^.!?]+[.!?]+/g) || [];
        const maxSentences = options.maxSentences || 5;
        keypoints = sentences.slice(0, maxSentences);
      } else if (typeof parsedData === 'object' && parsedData !== null) {
        // For objects, extract important keys
        keypoints = {};
        const importantKeys = ['id', 'name', 'title', 'description', 'summary', 'type', 'status', 'priority'];
        
        for (const key of importantKeys) {
          if (key in parsedData) {
            keypoints[key] = parsedData[key];
          }
        }
        
        // Add a few more keys if not enough
        if (Object.keys(keypoints).length < 3) {
          const remainingKeys = Object.keys(parsedData).filter(key => !(key in keypoints));
          for (let i = 0; i < Math.min(remainingKeys.length, 3 - Object.keys(keypoints).length); i++) {
            keypoints[remainingKeys[i]] = parsedData[remainingKeys[i]];
          }
        }
      } else {
        // For other types, use as is
        keypoints = parsedData;
      }
      
      // Store original data in metadata
      const metadata = {
        originalData: data,
        keypointsType: typeof parsedData === 'object' ? 'object' : 'text'
      };
      
      // Combine keypoints and metadata
      const result = {
        keypoints,
        metadata
      };
      
      return Buffer.from(JSON.stringify(result));
    } catch (error) {
      this.logger.error(`Failed to compress with keypoints: ${error.message}`, { error });
      throw error;
    }
  }
  
  /**
   * Decompress data with keypoints algorithm (lossy).
   * @private
   * @param {Buffer} data Data to decompress
   * @returns {Promise<string>} Decompressed data
   */
  async _decompressWithKeypoints(data) {
    try {
      // Parse compressed data
      const parsed = JSON.parse(data.toString());
      
      // Return original data if available
      if (parsed.metadata && parsed.metadata.originalData) {
        return parsed.metadata.originalData;
      }
      
      // Otherwise return keypoints
      return JSON.stringify(parsed.keypoints);
    } catch (error) {
      this.logger.error(`Failed to decompress with keypoints: ${error.message}`, { error });
      throw error;
    }
  }
  
  /**
   * Compress data with hierarchical algorithm (lossy).
   * @private
   * @param {string} data Data to compress
   * @param {Object} options Compression options
   * @returns {Promise<Buffer>} Compressed data
   */
  async _compressWithHierarchy(data, options = {}) {
    try {
      // Parse data if JSON
      let parsedData;
      try {
        parsedData = JSON.parse(data);
      } catch (e) {
        // If not JSON, use deflate
        return this._compressWithDeflate(data, options);
      }
      
      // Only apply to objects
      if (typeof parsedData !== 'object' || parsedData === null) {
        return this._compressWithDeflate(data, options);
      }
      
      // Create hierarchical representation
      const hierarchy = this._createHierarchy(parsedData, options.maxDepth || 3);
      
      // Store original data in metadata
      const metadata = {
        originalData: data
      };
      
      // Combine hierarchy and metadata
      const result = {
        hierarchy,
        metadata
      };
      
      return Buffer.from(JSON.stringify(result));
    } catch (error) {
      this.logger.error(`Failed to compress with hierarchy: ${error.message}`, { error });
      throw error;
    }
  }
  
  /**
   * Decompress data with hierarchical algorithm (lossy).
   * @private
   * @param {Buffer} data Data to decompress
   * @returns {Promise<string>} Decompressed data
   */
  async _decompressWithHierarchy(data) {
    try {
      // Parse compressed data
      const parsed = JSON.parse(data.toString());
      
      // Return original data if available
      if (parsed.metadata && parsed.metadata.originalData) {
        return parsed.metadata.originalData;
      }
      
      // Otherwise return hierarchy
      return JSON.stringify(parsed.hierarchy);
    } catch (error) {
      this.logger.error(`Failed to decompress with hierarchy: ${error.message}`, { error });
      throw error;
    }
  }
  
  /**
   * Create hierarchical representation of object.
   * @private
   * @param {Object} obj Object to create hierarchy from
   * @param {number} maxDepth Maximum depth
   * @param {number} currentDepth Current depth
   * @returns {Object} Hierarchical representation
   */
  _createHierarchy(obj, maxDepth = 3, currentDepth = 0) {
    try {
      // Base case: maximum depth reached
      if (currentDepth >= maxDepth) {
        if (Array.isArray(obj)) {
          return `Array(${obj.length})`;
        } else if (typeof obj === 'object' && obj !== null) {
          return `Object(${Object.keys(obj).length} keys)`;
        } else {
          return obj;
        }
      }
      
      // Handle arrays
      if (Array.isArray(obj)) {
        // For large arrays, take a sample
        if (obj.length > 10) {
          const sample = obj.slice(0, 5).map(item => 
            this._createHierarchy(item, maxDepth, currentDepth + 1)
          );
          return {
            _type: 'array',
            _length: obj.length,
            _sample: sample,
            _truncated: true
          };
        } else {
          return obj.map(item => 
            this._createHierarchy(item, maxDepth, currentDepth + 1)
          );
        }
      }
      
      // Handle objects
      if (typeof obj === 'object' && obj !== null) {
        const result = {};
        const keys = Object.keys(obj);
        
        // For large objects, take important keys
        if (keys.length > 20) {
          const importantKeys = ['id', 'name', 'title', 'description', 'summary', 'type', 'status', 'priority'];
          const selectedKeys = keys.filter(key => importantKeys.includes(key));
          
          // Add a few more keys if not enough
          if (selectedKeys.length < 5) {
            const remainingKeys = keys.filter(key => !selectedKeys.includes(key));
            selectedKeys.push(...remainingKeys.slice(0, 5 - selectedKeys.length));
          }
          
          // Process selected keys
          for (const key of selectedKeys) {
            result[key] = this._createHierarchy(obj[key], maxDepth, currentDepth + 1);
          }
          
          // Add metadata
          result._type = 'object';
          result._keys = keys.length;
          result._truncated = true;
        } else {
          // Process all keys
          for (const key of keys) {
            result[key] = this._createHierarchy(obj[key], maxDepth, currentDepth + 1);
          }
        }
        
        return result;
      }
      
      // Handle primitives
      return obj;
    } catch (error) {
      this.logger.error(`Failed to create hierarchy: ${error.message}`, { error });
      return String(obj);
    }
  }
  
  /**
   * Dispose of resources.
   * @returns {Promise<boolean>} True if disposal was successful
   */
  async dispose() {
    try {
      this.logger.info('Disposing ContextCompressionManager');
      
      // Remove event listeners
      this.mcpContextManager.removeAllListeners('contextUpdated');
      this.mcpContextManager.removeAllListeners('contextRequested');
      this.contextPrioritizationSystem.removeAllListeners('priorityUpdated');
      
      // Clean up resources
      this.compressedContextData.clear();
      this.compressionMetadata.clear();
      this.compressionStrategies.clear();
      this.compressionLevels.clear();
      this.summaries.clear();
      
      this.logger.info('ContextCompressionManager disposed successfully');
      
      return true;
    } catch (error) {
      this.logger.error(`Failed to dispose ContextCompressionManager: ${error.message}`, { error });
      return false;
    }
  }
}

module.exports = ContextCompressionManager;
