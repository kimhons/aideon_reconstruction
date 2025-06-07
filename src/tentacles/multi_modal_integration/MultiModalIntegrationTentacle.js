/**
 * @fileoverview Multi-Modal Integration Tentacle for the Aideon AI Desktop Agent.
 * Provides integration of multiple modalities (text, image, audio, video) for
 * comprehensive multi-modal understanding and generation.
 * 
 * @author Aideon AI Team
 * @version 1.0.0
 */

const InputPipeline = require('./core/InputPipeline');
const ProcessingCore = require('./core/ProcessingCore');
const OutputPipeline = require('./core/OutputPipeline');
const ModelRegistry = require('./model_registry/ModelRegistry');
const CrossModalReasoningEngine = require('./cross_modal_reasoning/CrossModalReasoningEngine');
const IntegrationManager = require('./integration/IntegrationManager');

// Modality handlers
const TextHandler = require('./modality_handlers/TextHandler');
const ImageHandler = require('./modality_handlers/ImageHandler');
const AudioHandler = require('./modality_handlers/AudioHandler');
const VideoHandler = require('./modality_handlers/VideoHandler');

/**
 * Multi-Modal Integration Tentacle
 * Provides integration of multiple modalities for comprehensive multi-modal understanding and generation.
 */
class MultiModalIntegrationTentacle {
  /**
   * Creates a new MultiModalIntegrationTentacle instance.
   * @param {Object} coreSystem - Core system
   */
  constructor(coreSystem) {
    this.id = 'multi-modal-integration';
    this.name = 'Multi-Modal Integration Tentacle';
    this.version = '1.0.0';
    this.description = 'Provides integration of multiple modalities (text, image, audio, video) for comprehensive multi-modal understanding and generation.';
    
    // Core system
    this.config = coreSystem.config;
    this.logging = coreSystem.logging;
    this.events = coreSystem.events;
    this.metrics = coreSystem.metrics;
    this.storage = coreSystem.storage;
    
    // Create logger
    this.logger = this.logging ? this.logging.createLogger('multi-modal-integration') : console;
    
    // Components
    this.inputPipeline = new InputPipeline({
      tentacle: this,
      ...coreSystem
    });
    
    this.processingCore = new ProcessingCore({
      tentacle: this,
      ...coreSystem
    });
    
    this.outputPipeline = new OutputPipeline({
      tentacle: this,
      ...coreSystem
    });
    
    this.modelRegistry = new ModelRegistry({
      tentacle: this,
      ...coreSystem
    });
    
    this.crossModalReasoningEngine = new CrossModalReasoningEngine({
      tentacle: this,
      ...coreSystem
    });
    
    this.integrationManager = new IntegrationManager({
      tentacle: this,
      ...coreSystem
    });
    
    // Modality handlers
    this.textHandler = new TextHandler({
      tentacle: this,
      ...coreSystem
    });
    
    this.imageHandler = new ImageHandler({
      tentacle: this,
      ...coreSystem
    });
    
    this.audioHandler = new AudioHandler({
      tentacle: this,
      ...coreSystem
    });
    
    this.videoHandler = new VideoHandler({
      tentacle: this,
      ...coreSystem
    });
    
    // Bind methods
    this.initialize = this.initialize.bind(this);
    this.shutdown = this.shutdown.bind(this);
    this.processMultiModalInput = this.processMultiModalInput.bind(this);
    this.generateMultiModalOutput = this.generateMultiModalOutput.bind(this);
    this.performCrossModalReasoning = this.performCrossModalReasoning.bind(this);
  }
  
  /**
   * Initializes the tentacle.
   * @returns {Promise<boolean>} - Whether initialization was successful
   */
  async initialize() {
    try {
      this.logger.info('Initializing Multi-Modal Integration Tentacle');
      
      // Initialize components
      await this.inputPipeline.initialize();
      await this.processingCore.initialize();
      await this.outputPipeline.initialize();
      await this.modelRegistry.initialize();
      await this.crossModalReasoningEngine.initialize();
      await this.integrationManager.initialize();
      
      // Initialize modality handlers
      await this.textHandler.initialize();
      await this.imageHandler.initialize();
      await this.audioHandler.initialize();
      await this.videoHandler.initialize();
      
      // Register with event system
      if (this.events) {
        this.events.on('multi-modal.process', this.processMultiModalInput);
        this.events.on('multi-modal.generate', this.generateMultiModalOutput);
        this.events.on('multi-modal.reason', this.performCrossModalReasoning);
      }
      
      this.logger.info('Multi-Modal Integration Tentacle initialized successfully');
      return true;
    } catch (error) {
      this.logger.error('Failed to initialize Multi-Modal Integration Tentacle:', error);
      throw error;
    }
  }
  
  /**
   * Shuts down the tentacle.
   * @returns {Promise<boolean>} - Whether shutdown was successful
   */
  async shutdown() {
    try {
      this.logger.info('Shutting down Multi-Modal Integration Tentacle');
      
      // Unregister from event system
      if (this.events) {
        this.events.off('multi-modal.process', this.processMultiModalInput);
        this.events.off('multi-modal.generate', this.generateMultiModalOutput);
        this.events.off('multi-modal.reason', this.performCrossModalReasoning);
      }
      
      // Shutdown modality handlers
      await this.textHandler.shutdown();
      await this.imageHandler.shutdown();
      await this.audioHandler.shutdown();
      await this.videoHandler.shutdown();
      
      // Shutdown components
      await this.integrationManager.shutdown();
      await this.crossModalReasoningEngine.shutdown();
      await this.modelRegistry.shutdown();
      await this.outputPipeline.shutdown();
      await this.processingCore.shutdown();
      await this.inputPipeline.shutdown();
      
      this.logger.info('Multi-Modal Integration Tentacle shut down successfully');
      return true;
    } catch (error) {
      this.logger.error('Failed to shut down Multi-Modal Integration Tentacle:', error);
      throw error;
    }
  }
  
  /**
   * Processes multi-modal input.
   * @param {Object} input - Multi-modal input
   * @param {Object} [options] - Processing options
   * @returns {Promise<Object>} - Processing result
   */
  async processMultiModalInput(input, options = {}) {
    try {
      this.logger.info('Processing multi-modal input');
      
      // Start timing
      const startTime = Date.now();
      
      // Process through input pipeline
      const processedInput = await this.inputPipeline.process(input, options);
      
      // Process through processing core
      const result = await this.processingCore.process(processedInput, options);
      
      // Process through output pipeline
      const finalResult = await this.outputPipeline.process(result, options);
      
      // Ensure result has the expected structure
      const structuredResult = {
        results: Array.isArray(finalResult) ? finalResult : [finalResult],
        metadata: {
          processedAt: Date.now(),
          tentacle: this.id,
          version: this.version
        }
      };
      
      // Record metrics
      if (this.metrics) {
        this.metrics.record('multi-modal.process.count', 1);
        this.metrics.recordTiming('multi-modal.process.time', Date.now() - startTime);
      }
      
      return structuredResult;
    } catch (error) {
      this.logger.error('Failed to process multi-modal input:', error);
      
      // Record error metric
      if (this.metrics) {
        this.metrics.record('multi-modal.process.error', 1);
      }
      
      throw error;
    }
  }
  
  /**
   * Generates multi-modal output.
   * @param {Object} spec - Output specification
   * @param {Object} [context] - Generation context
   * @param {Object} [options] - Generation options
   * @returns {Promise<Object>} - Generated output
   */
  async generateMultiModalOutput(spec, context = {}, options = {}) {
    try {
      this.logger.info('Generating multi-modal output');
      
      // Start timing
      const startTime = Date.now();
      
      // Process through processing core
      const result = await this.processingCore.generate(spec, context, options);
      
      // Process through output pipeline
      const finalResult = await this.outputPipeline.process(result, options);
      
      // Record metrics
      if (this.metrics) {
        this.metrics.record('multi-modal.generate.count', 1);
        this.metrics.recordTiming('multi-modal.generate.time', Date.now() - startTime);
      }
      
      return finalResult;
    } catch (error) {
      this.logger.error('Failed to generate multi-modal output:', error);
      
      // Record error metric
      if (this.metrics) {
        this.metrics.record('multi-modal.generate.error', 1);
      }
      
      throw error;
    }
  }
  
  /**
   * Performs cross-modal reasoning.
   * @param {Array<Object>} inputs - Multi-modal inputs
   * @param {Object} query - Reasoning query
   * @param {Object} [options] - Reasoning options
   * @returns {Promise<Object>} - Reasoning result
   */
  async performCrossModalReasoning(inputs, query, options = {}) {
    try {
      this.logger.info('Performing cross-modal reasoning');
      
      const startTime = Date.now();
      
      // Validate inputs
      if (!Array.isArray(inputs)) {
        throw new Error('Invalid inputs: expected an array');
      }
      
      if (!query || typeof query !== 'object') {
        throw new Error('Invalid query: expected an object');
      }
      
      // Process inputs through input pipeline
      const processedInputs = await Promise.all(
        inputs.map(input => this.inputPipeline.process(input, options))
      );
      
      // DEBUG: Log the processed inputs to diagnose the issue
      this.logger.debug('Processed inputs for cross-modal reasoning:', 
        JSON.stringify(processedInputs, (key, value) => {
          // Handle Buffer objects for logging
          if (value && value.type === 'Buffer') {
            return '[Buffer data]';
          }
          return value;
        }, 2)
      );
      
      // Check if each processed input has at least two modalities
      const modalityCheck = processedInputs.map(input => {
        const modalities = Object.keys(input).filter(key => 
          ['text', 'image', 'audio', 'video'].includes(key) && input[key]
        );
        return {
          modalities,
          count: modalities.length
        };
      });
      
      this.logger.debug('Modality check results:', JSON.stringify(modalityCheck, null, 2));
      
      // If no input has at least two modalities, use the first input as a combined object
      if (!modalityCheck.some(check => check.count >= 2)) {
        this.logger.warn('No input has at least two modalities, creating a combined input');
        
        // Create a combined input with all modalities from all inputs
        const combinedInput = {};
        
        for (const input of processedInputs) {
          for (const modality of ['text', 'image', 'audio', 'video']) {
            if (input[modality]) {
              combinedInput[modality] = input[modality];
            }
          }
        }
        
        // Replace the processed inputs with the combined input
        processedInputs.length = 0;
        processedInputs.push(combinedInput);
        
        this.logger.debug('Created combined input:', 
          JSON.stringify(combinedInput, (key, value) => {
            if (value && value.type === 'Buffer') {
              return '[Buffer data]';
            }
            return value;
          }, 2)
        );
      }
      
      // Perform reasoning
      const result = await this.crossModalReasoningEngine.reason(processedInputs[0], query, options);
      
      // Process through output pipeline
      const finalResult = await this.outputPipeline.process(result, options);
      
      // Ensure the result has the expected structure for validation
      if (!finalResult.result && result.result) {
        finalResult.result = result.result;
      }
      
      // Record metrics
      if (this.metrics) {
        this.metrics.record('multi-modal.reason.count', 1);
        this.metrics.recordTiming('multi-modal.reason.time', Date.now() - startTime);
      }
      
      return finalResult;
    } catch (error) {
      this.logger.error('Failed to perform cross-modal reasoning:', error);
      
      // Record error metric
      if (this.metrics) {
        this.metrics.record('multi-modal.reason.error', 1);
      }
      
      throw error;
    }
  }
}

module.exports = MultiModalIntegrationTentacle;
