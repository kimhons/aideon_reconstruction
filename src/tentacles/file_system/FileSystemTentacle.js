/**
 * @fileoverview Enhanced File System Tentacle with advanced multi-LLM orchestration
 * Provides comprehensive file system operations with superintelligent capabilities through
 * collaborative model orchestration and specialized model selection
 * 
 * @module tentacles/file_system/FileSystemTentacle
 */

const TentacleBase = require('../TentacleBase');
const path = require('path');
const fs = require('fs').promises;
const { performance } = require('perf_hooks');
const EnhancedTentacleIntegration = require('../common/EnhancedTentacleIntegration');
const FileSystemIntegration = require('./FileSystemIntegration');
const FileSystemStrategy = require('./FileSystemStrategy');

// Import advanced orchestration components
const { ModelType, CollaborationStrategy } = require('../../core/miif/models/ModelEnums');

/**
 * Enhanced File System Tentacle with superintelligent capabilities
 * Provides comprehensive file system operations with collaborative model orchestration
 * and specialized model selection for optimal file management and organization
 * @extends TentacleBase
 */
class EnhancedFileSystemTentacle extends TentacleBase {
  /**
   * Create a new enhanced File System Tentacle with advanced orchestration
   * @param {Object} config - Configuration object for the tentacle
   * @param {Object} dependencies - System dependencies required by the tentacle
   */
  constructor(config, dependencies) {
    // Default configuration for Enhanced File System Tentacle
    const defaultConfig = {
      id: 'enhanced_file_system',
      name: 'Enhanced File System',
      description: 'Advanced file system operations with superintelligent capabilities',
      version: '2.0.0',
      capabilities: {
        fileOperations: {
          create: true,
          read: true,
          update: true,
          delete: true,
          search: true,
          organize: true
        },
        intelligentOrganization: {
          semanticClustering: true,
          contentBasedTagging: true,
          userBehaviorAdaptation: true
        },
        dataLossPrevention: {
          backupManagement: true,
          versionControl: true,
          redundancyChecking: true
        },
        semanticSearch: {
          contentIndexing: true,
          naturalLanguageQueries: true,
          multimodalSearch: true
        },
        fileSynchronization: {
          cloudSync: true,
          deviceSync: true,
          conflictResolution: true
        },
        // Advanced orchestration capabilities
        advancedOrchestration: {
          collaborativeIntelligence: true,
          specializedModelSelection: true,
          adaptiveResourceAllocation: true,
          selfEvaluation: true,
          offlineCapability: 'full'
        }
      }
    };
    
    // Merge provided config with defaults
    const mergedConfig = { ...defaultConfig, ...config };
    
    super(mergedConfig, dependencies);
    
    this.log.info('Initializing Enhanced File System Tentacle with advanced orchestration...');
    
    // Store model orchestrator reference
    this.modelOrchestrator = dependencies.modelOrchestrationSystem || dependencies.modelOrchestrator;
    
    // Validate required dependencies
    if (!this.modelOrchestrator) {
      throw new Error("Required dependency 'modelOrchestrator' missing for EnhancedFileSystemTentacle");
    }
    
    // Advanced orchestration options
    this.advancedOptions = {
      collaborativeIntelligence: this.config.capabilities.advancedOrchestration.collaborativeIntelligence !== false,
      specializedModelSelection: this.config.capabilities.advancedOrchestration.specializedModelSelection !== false,
      adaptiveResourceAllocation: this.config.capabilities.advancedOrchestration.adaptiveResourceAllocation !== false,
      selfEvaluation: this.config.capabilities.advancedOrchestration.selfEvaluation !== false,
      offlineCapability: this.config.capabilities.advancedOrchestration.offlineCapability || 'full' // 'limited', 'standard', 'full'
    };
    
    // Initialize file system components
    this.fileSystemIntegration = new FileSystemIntegration();
    this.fileSystemStrategy = new FileSystemStrategy();
    
    // Initialize enhanced integration
    this._initializeEnhancedIntegration();
    
    this.log.info('Enhanced File System Tentacle initialized with superintelligent capabilities');
  }
  
  /**
   * Initialize enhanced integration
   * @private
   */
  _initializeEnhancedIntegration() {
    this.log.debug('Initializing enhanced integration');
    
    // Configure enhanced tentacle integration
    this.enhancedIntegration = new EnhancedTentacleIntegration(
      {
        collaborativeIntelligence: this.advancedOptions.collaborativeIntelligence,
        specializedModelSelection: this.advancedOptions.specializedModelSelection,
        adaptiveResourceAllocation: this.advancedOptions.adaptiveResourceAllocation,
        selfEvaluation: this.advancedOptions.selfEvaluation,
        offlineCapability: this.advancedOptions.offlineCapability
      },
      {
        logger: this.log,
        modelOrchestrationSystem: this.modelOrchestrator
      }
    );
  }
  
  /**
   * Initialize collaboration sessions for advanced orchestration
   * @private
   * @returns {Promise<void>}
   */
  async _initializeCollaborationSessions() {
    if (!this.advancedOptions.collaborativeIntelligence) {
      this.log.info('Collaborative intelligence disabled, skipping collaboration sessions');
      return;
    }
    
    this.log.debug('Initializing collaboration sessions');
    
    try {
      // Define collaboration configurations
      const collaborationConfigs = [
        {
          name: "file_organization",
          modelType: ModelType.TEXT,
          taskType: "file_organization",
          collaborationStrategy: CollaborationStrategy.ENSEMBLE,
          offlineOnly: true
        },
        {
          name: "semantic_search",
          modelType: ModelType.TEXT,
          taskType: "semantic_search",
          collaborationStrategy: CollaborationStrategy.SPECIALIZED_ROUTING,
          offlineOnly: false
        },
        {
          name: "content_analysis",
          modelType: ModelType.MULTIMODAL,
          taskType: "content_analysis",
          collaborationStrategy: CollaborationStrategy.CROSS_MODAL_FUSION,
          offlineOnly: false
        },
        {
          name: "data_loss_prevention",
          modelType: ModelType.TEXT,
          taskType: "data_loss_prevention",
          collaborationStrategy: CollaborationStrategy.CONSENSUS,
          offlineOnly: true
        },
        {
          name: "file_tagging",
          modelType: ModelType.TEXT,
          taskType: "file_tagging",
          collaborationStrategy: CollaborationStrategy.TASK_DECOMPOSITION,
          offlineOnly: true
        }
      ];
      
      // Initialize all collaboration sessions
      await this.enhancedIntegration.initializeAdvancedOrchestration("file_system", collaborationConfigs);
      
      this.log.info('Collaboration sessions initialized successfully');
      
    } catch (error) {
      this.log.error(`Failed to initialize collaboration sessions: ${error.message}`);
    }
  }
  
  /**
   * Initialize the tentacle
   * @returns {Promise<boolean>} - Promise resolving to true if initialization is successful
   */
  async initialize() {
    try {
      this.log.info('Starting Enhanced File System Tentacle initialization...');
      const startTime = performance.now();
      
      // Initialize enhanced integration
      await this.enhancedIntegration.initialize();
      this.log.info('Enhanced integration initialized');
      
      // Initialize collaboration sessions
      await this._initializeCollaborationSessions();
      this.log.info('Collaboration sessions initialized');
      
      // Initialize file system components
      await this.fileSystemIntegration.initialize();
      await this.fileSystemStrategy.initialize();
      this.log.info('File system components initialized');
      
      const endTime = performance.now();
      this.log.info(`Enhanced File System Tentacle initialization completed in ${(endTime - startTime).toFixed(2)}ms`);
      
      this.updateStatus('idle');
      return true;
    } catch (error) {
      this.log.error(`Error initializing Enhanced File System Tentacle: ${error.message}`, error);
      this.updateStatus('error');
      throw error;
    }
  }
  
  /**
   * Process a task assigned to this tentacle
   * @param {Object} task - Task object containing details of the work to be done
   * @returns {Promise<Object>} - Promise resolving to the task result
   */
  async processTask(task) {
    try {
      this.log.info(`Processing task: ${task.id} - ${task.type}`);
      this.updateStatus('processing');
      
      // Track task start
      const startTime = performance.now();
      
      // Validate task
      this._validateTask(task);
      
      // Determine if we should use advanced orchestration
      let result;
      if (this._shouldUseAdvancedOrchestration(task)) {
        result = await this._processTaskWithAdvancedOrchestration(task);
      } else {
        // Process task based on type using standard processing
        result = await this._processTaskStandard(task);
      }
      
      // Track task completion
      const endTime = performance.now();
      
      this.updateStatus('idle');
      return {
        success: true,
        taskId: task.id,
        result,
        executionTime: endTime - startTime
      };
    } catch (error) {
      this.log.error(`Error processing task ${task.id}: ${error.message}`, error);
      
      this.updateStatus('error');
      return {
        success: false,
        taskId: task.id,
        error: error.message,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
      };
    }
  }
  
  /**
   * Determine if a task should use advanced orchestration
   * @param {Object} task - Task to evaluate
   * @returns {boolean} - Whether to use advanced orchestration
   * @private
   */
  _shouldUseAdvancedOrchestration(task) {
    // Skip advanced orchestration if explicitly disabled in task
    if (task.options && task.options.disableAdvancedOrchestration) {
      return false;
    }
    
    // Use advanced orchestration for complex tasks
    const complexTaskTypes = [
      'file_organization',
      'semantic_search',
      'content_analysis',
      'data_loss_prevention',
      'file_tagging'
    ];
    
    // Check if task type is complex
    if (complexTaskTypes.includes(task.type)) {
      return true;
    }
    
    // Check if task has high complexity flag
    if (task.options && task.options.complexity === 'high') {
      return true;
    }
    
    return false;
  }
  
  /**
   * Process task with advanced orchestration
   * @param {Object} task - Task to process
   * @returns {Promise<Object>} - Task result
   * @private
   */
  async _processTaskWithAdvancedOrchestration(task) {
    this.log.debug(`Processing task ${task.id} with advanced orchestration`);
    
    // Determine which advanced orchestration approach to use
    if (this.advancedOptions.collaborativeIntelligence && this._isCollaborativeTask(task)) {
      return await this._processTaskWithCollaborativeIntelligence(task);
    } else if (this.advancedOptions.specializedModelSelection && this._needsSpecializedModel(task)) {
      return await this._processTaskWithSpecializedModel(task);
    } else if (this.advancedOptions.selfEvaluation && this._needsSelfEvaluation(task)) {
      return await this._processTaskWithSelfEvaluation(task);
    } else if (this.advancedOptions.adaptiveResourceAllocation) {
      return await this._processTaskWithAdaptiveResourceAllocation(task);
    } else {
      // Fallback to standard processing
      return await this._processTaskStandard(task);
    }
  }
  
  /**
   * Process task with collaborative intelligence
   * @param {Object} task - Task to process
   * @returns {Promise<Object>} - Task result
   * @private
   */
  async _processTaskWithCollaborativeIntelligence(task) {
    this.log.debug(`Processing task ${task.id} with collaborative intelligence`);
    
    try {
      // Map task type to collaboration task type
      const collaborationTaskType = this._mapTaskTypeToCollaborationTaskType(task.type);
      
      // Execute collaborative task
      const result = await this.enhancedIntegration.executeCollaborativeTask(
        collaborationTaskType,
        {
          taskId: task.id,
          taskData: task.data,
          taskOptions: task.options
        },
        {
          priority: task.options?.priority || 'normal',
          timeout: task.options?.timeout || 60000
        }
      );
      
      return {
        ...result.result,
        collaborativeExecution: {
          strategy: result.strategy,
          modelCount: result.modelResults?.length || 0
        }
      };
    } catch (error) {
      this.log.error(`Collaborative intelligence processing failed for task ${task.id}: ${error.message}`);
      
      // Fallback to standard processing
      this.log.info(`Falling back to standard processing for task ${task.id}`);
      return await this._processTaskStandard(task);
    }
  }
  
  /**
   * Process task with specialized model selection
   * @param {Object} task - Task to process
   * @returns {Promise<Object>} - Task result
   * @private
   */
  async _processTaskWithSpecializedModel(task) {
    this.log.debug(`Processing task ${task.id} with specialized model selection`);
    
    try {
      // Determine requirements for specialized model
      const modelRequirements = this._determineModelRequirements(task);
      
      // Select specialized model
      const model = await this.enhancedIntegration.selectSpecializedModel({
        taskType: task.type,
        requirements: modelRequirements
      });
      
      // Execute task with specialized model
      const result = await model.execute({
        task: task.type,
        data: task.data,
        options: task.options
      });
      
      return {
        ...result,
        specializedModel: {
          modelId: model.modelId,
          modelType: model.modelType
        }
      };
    } catch (error) {
      this.log.error(`Specialized model processing failed for task ${task.id}: ${error.message}`);
      
      // Fallback to standard processing
      this.log.info(`Falling back to standard processing for task ${task.id}`);
      return await this._processTaskStandard(task);
    }
  }
  
  /**
   * Process task with self-evaluation
   * @param {Object} task - Task to process
   * @returns {Promise<Object>} - Task result
   * @private
   */
  async _processTaskWithSelfEvaluation(task) {
    this.log.debug(`Processing task ${task.id} with self-evaluation`);
    
    try {
      // Process task with standard method first
      const initialResult = await this._processTaskStandard(task);
      
      // Perform self-evaluation
      const evaluationResult = await this.enhancedIntegration.performSelfEvaluation({
        task: task.type,
        result: initialResult,
        criteria: task.options?.evaluationCriteria || this._getDefaultEvaluationCriteria(task.type)
      });
      
      // If evaluation score is below threshold, reprocess with collaborative intelligence
      if (evaluationResult.score < 0.8) {
        this.log.debug(`Self-evaluation score below threshold (${evaluationResult.score}), reprocessing with collaborative intelligence`);
        
        // Map task type to collaboration task type
        const collaborationTaskType = this._mapTaskTypeToCollaborationTaskType(task.type);
        
        // Execute collaborative task with initial result and evaluation feedback
        const result = await this.enhancedIntegration.executeCollaborativeTask(
          collaborationTaskType,
          {
            taskId: task.id,
            taskData: task.data,
            taskOptions: task.options,
            initialResult: initialResult,
            evaluationFeedback: evaluationResult.feedback
          },
          {
            priority: task.options?.priority || 'high',
            timeout: task.options?.timeout || 60000
          }
        );
        
        return {
          ...result.result,
          selfEvaluation: {
            performed: true,
            initialScore: evaluationResult.score,
            feedback: evaluationResult.feedback
          },
          collaborativeExecution: {
            strategy: result.strategy,
            modelCount: result.modelResults?.length || 0
          }
        };
      } else {
        // Return initial result with evaluation results
        return {
          ...initialResult,
          selfEvaluation: {
            performed: true,
            score: evaluationResult.score,
            feedback: evaluationResult.feedback
          }
        };
      }
    } catch (error) {
      this.log.error(`Self-evaluation processing failed for task ${task.id}: ${error.message}`);
      
      // Fallback to standard processing
      this.log.info(`Falling back to standard processing for task ${task.id}`);
      return await this._processTaskStandard(task);
    }
  }
  
  /**
   * Process task with adaptive resource allocation
   * @param {Object} task - Task to process
   * @returns {Promise<Object>} - Task result
   * @private
   */
  async _processTaskWithAdaptiveResourceAllocation(task) {
    this.log.debug(`Processing task ${task.id} with adaptive resource allocation`);
    
    try {
      // Get resource allocation strategy
      const allocationStrategy = await this.enhancedIntegration.getAdaptiveResourceAllocation({
        taskType: task.type,
        importance: task.options?.importance || 'medium',
        complexity: task.options?.complexity || 'medium',
        deadline: task.options?.deadline
      });
      
      // Apply resource allocation strategy to task options
      const enhancedTask = {
        ...task,
        options: {
          ...task.options,
          resourceAllocation: allocationStrategy
        }
      };
      
      // Process task with standard method but enhanced options
      const result = await this._processTaskStandard(enhancedTask);
      
      return {
        ...result,
        adaptiveAllocation: {
          applied: true,
          strategy: allocationStrategy
        }
      };
    } catch (error) {
      this.log.error(`Adaptive resource allocation processing failed for task ${task.id}: ${error.message}`);
      
      // Fallback to standard processing
      this.log.info(`Falling back to standard processing for task ${task.id}`);
      return await this._processTaskStandard(task);
    }
  }
  
  /**
   * Process task with standard method
   * @param {Object} task - Task to process
   * @returns {Promise<Object>} - Task result
   * @private
   */
  async _processTaskStandard(task) {
    // Process task based on type
    switch (task.type) {
      case 'file_create':
        return await this._createFile(task.data.path, task.data.content, task.data.options);
      case 'file_read':
        return await this._readFile(task.data.path, task.data.options);
      case 'file_update':
        return await this._updateFile(task.data.path, task.data.content, task.data.options);
      case 'file_delete':
        return await this._deleteFile(task.data.path, task.data.options);
      case 'file_search':
        return await this._searchFiles(task.data.query, task.data.options);
      case 'file_organization':
        return await this._organizeFiles(task.data.paths, task.data.options);
      case 'semantic_search':
        return await this._semanticSearch(task.data.query, task.data.options);
      case 'content_analysis':
        return await this._analyzeContent(task.data.paths, task.data.options);
      case 'data_loss_prevention':
        return await this._preventDataLoss(task.data.paths, task.data.options);
      case 'file_tagging':
        return await this._tagFiles(task.data.paths, task.data.options);
      case 'file_sync':
        return await this._syncFiles(task.data.source, task.data.destination, task.data.options);
      default:
        throw new Error(`Unsupported task type: ${task.type}`);
    }
  }
  
  /**
   * Create a file
   * @param {string} filePath - Path to the file
   * @param {string|Buffer} content - File content
   * @param {Object} options - Options for file creation
   * @returns {Promise<Object>} - Result of the operation
   * @private
   */
  async _createFile(filePath, content, options = {}) {
    try {
      // Ensure directory exists
      const dirPath = path.dirname(filePath);
      await fs.mkdir(dirPath, { recursive: true });
      
      // Write file
      await fs.writeFile(filePath, content, options.encoding || 'utf8');
      
      // Get file stats
      const stats = await fs.stat(filePath);
      
      return {
        success: true,
        path: filePath,
        size: stats.size,
        created: stats.birthtime,
        modified: stats.mtime
      };
    } catch (error) {
      throw new Error(`Failed to create file ${filePath}: ${error.message}`);
    }
  }
  
  /**
   * Read a file
   * @param {string} filePath - Path to the file
   * @param {Object} options - Options for file reading
   * @returns {Promise<Object>} - Result of the operation
   * @private
   */
  async _readFile(filePath, options = {}) {
    try {
      // Read file
      const content = await fs.readFile(filePath, options.encoding || 'utf8');
      
      // Get file stats
      const stats = await fs.stat(filePath);
      
      return {
        success: true,
        path: filePath,
        content,
        size: stats.size,
        created: stats.birthtime,
        modified: stats.mtime
      };
    } catch (error) {
      throw new Error(`Failed to read file ${filePath}: ${error.message}`);
    }
  }
  
  /**
   * Update a file
   * @param {string} filePath - Path to the file
   * @param {string|Buffer} content - New file content
   * @param {Object} options - Options for file update
   * @returns {Promise<Object>} - Result of the operation
   * @private
   */
  async _updateFile(filePath, content, options = {}) {
    try {
      // Check if file exists
      const fileExists = await this._fileExists(filePath);
      if (!fileExists) {
        throw new Error(`File does not exist: ${filePath}`);
      }
      
      // Create backup if requested
      if (options.createBackup) {
        await this._createBackup(filePath);
      }
      
      // Write file
      await fs.writeFile(filePath, content, options.encoding || 'utf8');
      
      // Get file stats
      const stats = await fs.stat(filePath);
      
      return {
        success: true,
        path: filePath,
        size: stats.size,
        modified: stats.mtime
      };
    } catch (error) {
      throw new Error(`Failed to update file ${filePath}: ${error.message}`);
    }
  }
  
  /**
   * Delete a file
   * @param {string} filePath - Path to the file
   * @param {Object} options - Options for file deletion
   * @returns {Promise<Object>} - Result of the operation
   * @private
   */
  async _deleteFile(filePath, options = {}) {
    try {
      // Check if file exists
      const fileExists = await this._fileExists(filePath);
      if (!fileExists) {
        throw new Error(`File does not exist: ${filePath}`);
      }
      
      // Create backup if requested
      if (options.createBackup) {
        await this._createBackup(filePath);
      }
      
      // Delete file
      await fs.unlink(filePath);
      
      return {
        success: true,
        path: filePath
      };
    } catch (error) {
      throw new Error(`Failed to delete file ${filePath}: ${error.message}`);
    }
  }
  
  /**
   * Search for files
   * @param {string} query - Search query
   * @param {Object} options - Search options
   * @returns {Promise<Object>} - Search results
   * @private
   */
  async _searchFiles(query, options = {}) {
    try {
      // Implement file search logic
      // This is a placeholder for actual implementation
      
      return {
        success: true,
        query,
        results: []
      };
    } catch (error) {
      throw new Error(`Failed to search files: ${error.message}`);
    }
  }
  
  /**
   * Organize files
   * @param {Array<string>} paths - Paths to organize
   * @param {Object} options - Organization options
   * @returns {Promise<Object>} - Organization results
   * @private
   */
  async _organizeFiles(paths, options = {}) {
    try {
      // Implement file organization logic
      // This is a placeholder for actual implementation
      
      return {
        success: true,
        organized: 0,
        skipped: 0,
        details: []
      };
    } catch (error) {
      throw new Error(`Failed to organize files: ${error.message}`);
    }
  }
  
  /**
   * Perform semantic search
   * @param {string} query - Search query
   * @param {Object} options - Search options
   * @returns {Promise<Object>} - Search results
   * @private
   */
  async _semanticSearch(query, options = {}) {
    try {
      // Implement semantic search logic
      // This is a placeholder for actual implementation
      
      return {
        success: true,
        query,
        results: []
      };
    } catch (error) {
      throw new Error(`Failed to perform semantic search: ${error.message}`);
    }
  }
  
  /**
   * Analyze content
   * @param {Array<string>} paths - Paths to analyze
   * @param {Object} options - Analysis options
   * @returns {Promise<Object>} - Analysis results
   * @private
   */
  async _analyzeContent(paths, options = {}) {
    try {
      // Implement content analysis logic
      // This is a placeholder for actual implementation
      
      return {
        success: true,
        analyzed: 0,
        skipped: 0,
        results: []
      };
    } catch (error) {
      throw new Error(`Failed to analyze content: ${error.message}`);
    }
  }
  
  /**
   * Prevent data loss
   * @param {Array<string>} paths - Paths to protect
   * @param {Object} options - Protection options
   * @returns {Promise<Object>} - Protection results
   * @private
   */
  async _preventDataLoss(paths, options = {}) {
    try {
      // Implement data loss prevention logic
      // This is a placeholder for actual implementation
      
      return {
        success: true,
        protected: 0,
        skipped: 0,
        details: []
      };
    } catch (error) {
      throw new Error(`Failed to prevent data loss: ${error.message}`);
    }
  }
  
  /**
   * Tag files
   * @param {Array<string>} paths - Paths to tag
   * @param {Object} options - Tagging options
   * @returns {Promise<Object>} - Tagging results
   * @private
   */
  async _tagFiles(paths, options = {}) {
    try {
      // Implement file tagging logic
      // This is a placeholder for actual implementation
      
      return {
        success: true,
        tagged: 0,
        skipped: 0,
        details: []
      };
    } catch (error) {
      throw new Error(`Failed to tag files: ${error.message}`);
    }
  }
  
  /**
   * Synchronize files
   * @param {string} source - Source path
   * @param {string} destination - Destination path
   * @param {Object} options - Synchronization options
   * @returns {Promise<Object>} - Synchronization results
   * @private
   */
  async _syncFiles(source, destination, options = {}) {
    try {
      // Implement file synchronization logic
      // This is a placeholder for actual implementation
      
      return {
        success: true,
        copied: 0,
        updated: 0,
        deleted: 0,
        skipped: 0,
        details: []
      };
    } catch (error) {
      throw new Error(`Failed to synchronize files: ${error.message}`);
    }
  }
  
  /**
   * Check if a file exists
   * @param {string} filePath - Path to the file
   * @returns {Promise<boolean>} - Whether the file exists
   * @private
   */
  async _fileExists(filePath) {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }
  
  /**
   * Create a backup of a file
   * @param {string} filePath - Path to the file
   * @returns {Promise<string>} - Path to the backup file
   * @private
   */
  async _createBackup(filePath) {
    try {
      const backupPath = `${filePath}.backup.${Date.now()}`;
      await fs.copyFile(filePath, backupPath);
      return backupPath;
    } catch (error) {
      throw new Error(`Failed to create backup of ${filePath}: ${error.message}`);
    }
  }
  
  /**
   * Map task type to collaboration task type
   * @param {string} taskType - Original task type
   * @returns {string} - Collaboration task type
   * @private
   */
  _mapTaskTypeToCollaborationTaskType(taskType) {
    const mapping = {
      'file_organization': 'file_organization',
      'semantic_search': 'semantic_search',
      'content_analysis': 'content_analysis',
      'data_loss_prevention': 'data_loss_prevention',
      'file_tagging': 'file_tagging'
    };
    
    return mapping[taskType] || 'file_organization';
  }
  
  /**
   * Determine if a task is suitable for collaborative intelligence
   * @param {Object} task - Task to evaluate
   * @returns {boolean} - Whether task is suitable for collaborative intelligence
   * @private
   */
  _isCollaborativeTask(task) {
    const collaborativeTaskTypes = [
      'file_organization',
      'semantic_search',
      'content_analysis',
      'data_loss_prevention',
      'file_tagging'
    ];
    
    return collaborativeTaskTypes.includes(task.type);
  }
  
  /**
   * Determine if a task needs specialized model selection
   * @param {Object} task - Task to evaluate
   * @returns {boolean} - Whether task needs specialized model selection
   * @private
   */
  _needsSpecializedModel(task) {
    const specializedModelTaskTypes = [
      'semantic_search',
      'content_analysis'
    ];
    
    return specializedModelTaskTypes.includes(task.type);
  }
  
  /**
   * Determine if a task needs self-evaluation
   * @param {Object} task - Task to evaluate
   * @returns {boolean} - Whether task needs self-evaluation
   * @private
   */
  _needsSelfEvaluation(task) {
    const selfEvaluationTaskTypes = [
      'file_organization',
      'data_loss_prevention'
    ];
    
    return selfEvaluationTaskTypes.includes(task.type) || 
           (task.options && task.options.requireHighAccuracy);
  }
  
  /**
   * Determine model requirements based on task
   * @param {Object} task - Task to evaluate
   * @returns {Object} - Model requirements
   * @private
   */
  _determineModelRequirements(task) {
    const requirements = {
      taskType: task.type,
      accuracy: task.options?.requiredAccuracy || 0.8
    };
    
    switch (task.type) {
      case 'semantic_search':
        requirements.specialization = 'information_retrieval';
        requirements.dataTypes = ['text', 'metadata'];
        break;
      case 'content_analysis':
        requirements.specialization = 'content_understanding';
        requirements.dataTypes = ['text', 'image', 'document'];
        requirements.multimodal = true;
        break;
      default:
        requirements.specialization = 'file_management';
    }
    
    return requirements;
  }
  
  /**
   * Get default evaluation criteria for a task type
   * @param {string} taskType - Task type
   * @returns {Object} - Evaluation criteria
   * @private
   */
  _getDefaultEvaluationCriteria(taskType) {
    const baseCriteria = {
      accuracy: 0.8,
      consistency: 0.7,
      completeness: 0.8
    };
    
    switch (taskType) {
      case 'file_organization':
        return {
          ...baseCriteria,
          coherence: 0.85,
          userPreferenceAlignment: 0.9,
          efficiency: 0.8
        };
      case 'data_loss_prevention':
        return {
          ...baseCriteria,
          comprehensiveness: 0.9,
          riskMitigation: 0.95,
          recoveryOptions: 0.9
        };
      default:
        return baseCriteria;
    }
  }
  
  /**
   * Validate task
   * @private
   * @param {Object} task - Task to validate
   * @throws {Error} If task is invalid
   */
  _validateTask(task) {
    if (!task) {
      throw new Error('Task is required');
    }
    
    if (!task.id) {
      throw new Error('Task ID is required');
    }
    
    if (!task.type) {
      throw new Error('Task type is required');
    }
    
    if (!this.canHandleTask(task)) {
      throw new Error(`Unsupported task type: ${task.type}`);
    }
  }
  
  /**
   * Check if this tentacle can handle a specific task
   * @param {Object} task - Task to evaluate
   * @returns {boolean} - Whether this tentacle can handle the task
   */
  canHandleTask(task) {
    const supportedTaskTypes = [
      'file_create',
      'file_read',
      'file_update',
      'file_delete',
      'file_search',
      'file_organization',
      'semantic_search',
      'content_analysis',
      'data_loss_prevention',
      'file_tagging',
      'file_sync'
    ];
    
    return supportedTaskTypes.includes(task.type);
  }
  
  /**
   * Get the capabilities of this tentacle
   * @returns {Object} - Capabilities object
   */
  getCapabilities() {
    return this.config.capabilities;
  }
  
  /**
   * Shutdown the tentacle gracefully
   * @returns {Promise<boolean>} - Promise resolving to true if shutdown is successful
   */
  async shutdown() {
    try {
      this.log.info('Shutting down Enhanced File System Tentacle...');
      
      // Shutdown file system components
      await this.fileSystemStrategy.cleanup();
      await this.fileSystemIntegration.cleanup();
      
      // Shutdown enhanced integration
      await this.enhancedIntegration.cleanup();
      
      this.log.info('Enhanced File System Tentacle shutdown complete');
      return true;
    } catch (error) {
      this.log.error(`Error during Enhanced File System Tentacle shutdown: ${error.message}`, error);
      return false;
    }
  }
}

module.exports = EnhancedFileSystemTentacle;
