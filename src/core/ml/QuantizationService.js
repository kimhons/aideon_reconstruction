/**
 * @fileoverview QuantizationService is responsible for optimizing machine learning models
 * through quantization, providing different precision levels based on hardware capabilities
 * and performance requirements within Aideon Core.
 * 
 * @module core/ml/QuantizationService
 * @requires core/utils/Logger
 */

const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const { EventEmitter } = require('events');
const logger = require('../utils/Logger').getLogger('QuantizationService');

/**
 * @class QuantizationService
 * @extends EventEmitter
 * @description Service for optimizing ML models through quantization
 */
class QuantizationService extends EventEmitter {
  /**
   * Creates an instance of QuantizationService
   * @param {Object} options - Configuration options
   * @param {string} options.quantizationToolsPath - Path to quantization tools
   * @param {boolean} options.enableAutoQuantization - Whether to enable automatic quantization
   * @param {Array<string>} options.supportedFormats - Supported model formats for quantization
   */
  constructor(options = {}) {
    super();
    
    this.options = {
      quantizationToolsPath: path.join(process.cwd(), 'tools', 'quantization'),
      enableAutoQuantization: true,
      supportedFormats: ['ggml', 'gguf', 'onnx'],
      ...options
    };
    
    this.hardwareProfile = null;
    this.isInitialized = false;
    
    // Bind methods
    this.initialize = this.initialize.bind(this);
    this.quantizeModel = this.quantizeModel.bind(this);
    this.recommendQuantization = this.recommendQuantization.bind(this);
    this.getQuantizationOptions = this.getQuantizationOptions.bind(this);
    this.shutdown = this.shutdown.bind(this);
  }
  
  /**
   * Initializes the QuantizationService
   * @async
   * @param {Object} hardwareProfile - Hardware profile from HardwareProfiler
   * @returns {Promise<boolean>} Initialization success status
   */
  async initialize(hardwareProfile = null) {
    if (this.isInitialized) {
      logger.warn('QuantizationService already initialized');
      return true;
    }
    
    try {
      logger.info('Initializing QuantizationService');
      
      // Store hardware profile
      this.hardwareProfile = hardwareProfile;
      
      // Ensure quantization tools directory exists
      if (!fs.existsSync(this.options.quantizationToolsPath)) {
        fs.mkdirSync(this.options.quantizationToolsPath, { recursive: true });
      }
      
      // Check for required quantization tools
      await this.checkQuantizationTools();
      
      this.isInitialized = true;
      this.emit('initialized');
      logger.info('QuantizationService initialized successfully');
      return true;
    } catch (error) {
      logger.error(`Failed to initialize QuantizationService: ${error.message}`, error);
      this.emit('error', error);
      return false;
    }
  }
  
  /**
   * Checks for required quantization tools
   * @async
   * @returns {Promise<boolean>} Check success status
   */
  async checkQuantizationTools() {
    try {
      logger.debug('Checking quantization tools');
      
      // Check for GGML/GGUF quantization tools
      const ggmlToolPath = path.join(this.options.quantizationToolsPath, 'llama-cpp', 'quantize');
      const ggufToolPath = path.join(this.options.quantizationToolsPath, 'llama-cpp', 'quantize-gguf');
      
      const ggmlExists = fs.existsSync(ggmlToolPath);
      const ggufExists = fs.existsSync(ggufToolPath);
      
      if (!ggmlExists && !ggufExists) {
        logger.warn('GGML/GGUF quantization tools not found, some quantization features may be limited');
      } else {
        logger.debug(`Found quantization tools: ${ggmlExists ? 'GGML' : ''} ${ggufExists ? 'GGUF' : ''}`);
      }
      
      // Check for ONNX quantization tools
      try {
        const { spawn } = require('child_process');
        const onnxCheck = spawn('python', ['-c', 'import onnxruntime; print(onnxruntime.__version__)']);
        
        let onnxVersion = '';
        onnxCheck.stdout.on('data', (data) => {
          onnxVersion += data.toString();
        });
        
        await new Promise((resolve, reject) => {
          onnxCheck.on('close', (code) => {
            if (code === 0) {
              logger.debug(`Found ONNX Runtime: ${onnxVersion.trim()}`);
              resolve();
            } else {
              logger.warn('ONNX Runtime not found, ONNX quantization will be limited');
              resolve();
            }
          });
          
          onnxCheck.on('error', (err) => {
            logger.warn(`Failed to check ONNX Runtime: ${err.message}`);
            resolve();
          });
        });
      } catch (error) {
        logger.warn(`Failed to check ONNX Runtime: ${error.message}`);
      }
      
      return true;
    } catch (error) {
      logger.error(`Failed to check quantization tools: ${error.message}`, error);
      return false;
    }
  }
  
  /**
   * Quantizes a model
   * @async
   * @param {Object} options - Quantization options
   * @param {string} options.inputPath - Path to input model
   * @param {string} options.outputPath - Path to output quantized model
   * @param {string} options.format - Model format (ggml, gguf, onnx)
   * @param {number} options.bits - Quantization bits (4, 5, 8)
   * @param {number} options.blockSize - Block size for quantization
   * @returns {Promise<Object>} Quantization result
   */
  async quantizeModel(options) {
    if (!this.isInitialized) {
      throw new Error('QuantizationService not initialized');
    }
    
    if (!options || !options.inputPath || !options.outputPath) {
      throw new Error('Input and output paths are required');
    }
    
    if (!options.format || !this.options.supportedFormats.includes(options.format.toLowerCase())) {
      throw new Error(`Unsupported format: ${options.format}. Supported formats: ${this.options.supportedFormats.join(', ')}`);
    }
    
    try {
      logger.info(`Quantizing model: ${options.inputPath} to ${options.outputPath} (${options.format}, ${options.bits} bits)`);
      
      this.emit('quantizationStarted', options);
      
      // Perform format-specific quantization
      let result;
      
      switch (options.format.toLowerCase()) {
        case 'ggml':
          result = await this.quantizeGGML(options);
          break;
        
        case 'gguf':
          result = await this.quantizeGGUF(options);
          break;
        
        case 'onnx':
          result = await this.quantizeONNX(options);
          break;
        
        default:
          throw new Error(`Unsupported format: ${options.format}`);
      }
      
      this.emit('quantizationCompleted', result);
      logger.info(`Model quantized successfully: ${options.outputPath}`);
      
      return result;
    } catch (error) {
      logger.error(`Failed to quantize model: ${error.message}`, error);
      this.emit('quantizationFailed', error);
      throw error;
    }
  }
  
  /**
   * Quantizes a GGML model
   * @async
   * @private
   * @param {Object} options - Quantization options
   * @returns {Promise<Object>} Quantization result
   */
  async quantizeGGML(options) {
    return new Promise((resolve, reject) => {
      logger.debug(`Quantizing GGML model: ${options.inputPath}`);
      
      // Determine quantization tool path
      const quantizeTool = path.join(this.options.quantizationToolsPath, 'llama-cpp', 'quantize');
      
      if (!fs.existsSync(quantizeTool)) {
        return reject(new Error('GGML quantization tool not found'));
      }
      
      // Prepare quantization arguments
      const args = [
        options.inputPath,
        options.outputPath,
        `${options.bits}`,
      ];
      
      if (options.blockSize) {
        args.push(`${options.blockSize}`);
      }
      
      // Spawn quantization process
      const process = spawn(quantizeTool, args);
      
      let stdout = '';
      let stderr = '';
      
      process.stdout.on('data', (data) => {
        stdout += data.toString();
        logger.debug(`Quantization output: ${data.toString().trim()}`);
      });
      
      process.stderr.on('data', (data) => {
        stderr += data.toString();
        logger.warn(`Quantization error: ${data.toString().trim()}`);
      });
      
      process.on('close', (code) => {
        if (code === 0) {
          // Get output file size
          const outputSize = fs.statSync(options.outputPath).size;
          const inputSize = fs.statSync(options.inputPath).size;
          const compressionRatio = (outputSize / inputSize) * 100;
          
          const result = {
            inputPath: options.inputPath,
            outputPath: options.outputPath,
            format: 'ggml',
            bits: options.bits,
            blockSize: options.blockSize,
            inputSize,
            outputSize,
            compressionRatio: compressionRatio.toFixed(2) + '%',
            stdout,
            stderr
          };
          
          resolve(result);
        } else {
          reject(new Error(`Quantization failed with code ${code}: ${stderr}`));
        }
      });
      
      process.on('error', (err) => {
        reject(new Error(`Failed to spawn quantization process: ${err.message}`));
      });
    });
  }
  
  /**
   * Quantizes a GGUF model
   * @async
   * @private
   * @param {Object} options - Quantization options
   * @returns {Promise<Object>} Quantization result
   */
  async quantizeGGUF(options) {
    return new Promise((resolve, reject) => {
      logger.debug(`Quantizing GGUF model: ${options.inputPath}`);
      
      // Determine quantization tool path
      const quantizeTool = path.join(this.options.quantizationToolsPath, 'llama-cpp', 'quantize-gguf');
      
      if (!fs.existsSync(quantizeTool)) {
        return reject(new Error('GGUF quantization tool not found'));
      }
      
      // Map bits to GGUF quantization type
      const quantType = this.mapBitsToGGUFType(options.bits, options.blockSize);
      
      // Prepare quantization arguments
      const args = [
        options.inputPath,
        options.outputPath,
        quantType
      ];
      
      // Spawn quantization process
      const process = spawn(quantizeTool, args);
      
      let stdout = '';
      let stderr = '';
      
      process.stdout.on('data', (data) => {
        stdout += data.toString();
        logger.debug(`Quantization output: ${data.toString().trim()}`);
      });
      
      process.stderr.on('data', (data) => {
        stderr += data.toString();
        logger.warn(`Quantization error: ${data.toString().trim()}`);
      });
      
      process.on('close', (code) => {
        if (code === 0) {
          // Get output file size
          const outputSize = fs.statSync(options.outputPath).size;
          const inputSize = fs.statSync(options.inputPath).size;
          const compressionRatio = (outputSize / inputSize) * 100;
          
          const result = {
            inputPath: options.inputPath,
            outputPath: options.outputPath,
            format: 'gguf',
            quantType,
            bits: options.bits,
            blockSize: options.blockSize,
            inputSize,
            outputSize,
            compressionRatio: compressionRatio.toFixed(2) + '%',
            stdout,
            stderr
          };
          
          resolve(result);
        } else {
          reject(new Error(`Quantization failed with code ${code}: ${stderr}`));
        }
      });
      
      process.on('error', (err) => {
        reject(new Error(`Failed to spawn quantization process: ${err.message}`));
      });
    });
  }
  
  /**
   * Maps bits to GGUF quantization type
   * @private
   * @param {number} bits - Quantization bits
   * @param {number} blockSize - Block size for quantization
   * @returns {string} GGUF quantization type
   */
  mapBitsToGGUFType(bits, blockSize) {
    switch (bits) {
      case 2:
        return 'q2_K';
      case 3:
        return 'q3_K_S';
      case 4:
        return blockSize === 32 ? 'q4_K_S' : 'q4_K_M';
      case 5:
        return 'q5_K_S';
      case 6:
        return 'q6_K';
      case 8:
        return 'q8_0';
      default:
        return 'q4_K_M'; // Default to 4-bit
    }
  }
  
  /**
   * Quantizes an ONNX model
   * @async
   * @private
   * @param {Object} options - Quantization options
   * @returns {Promise<Object>} Quantization result
   */
  async quantizeONNX(options) {
    return new Promise((resolve, reject) => {
      logger.debug(`Quantizing ONNX model: ${options.inputPath}`);
      
      // Create temporary Python script for ONNX quantization
      const scriptPath = path.join(this.options.quantizationToolsPath, 'quantize_onnx_temp.py');
      
      // Determine quantization type based on bits
      const quantType = options.bits === 16 ? 'fp16' : 'int8';
      
      // Create Python script content
      const scriptContent = `
import onnx
from onnxruntime.quantization import quantize_dynamic, QuantType

# Load model
model = onnx.load("${options.inputPath.replace(/\\/g, '\\\\')}")

# Quantize model
if "${quantType}" == "fp16":
    from onnxruntime.quantization import quantize_static, QuantFormat, QuantType
    quantize_static(
        "${options.inputPath.replace(/\\/g, '\\\\')}",
        "${options.outputPath.replace(/\\/g, '\\\\')}",
        weight_type=QuantType.FP16
    )
else:
    quantize_dynamic(
        "${options.inputPath.replace(/\\/g, '\\\\')}",
        "${options.outputPath.replace(/\\/g, '\\\\')}",
        weight_type=QuantType.QInt8
    )

print("Quantization completed successfully")
`;
      
      // Write script to file
      fs.writeFileSync(scriptPath, scriptContent);
      
      // Spawn Python process
      const process = spawn('python', [scriptPath]);
      
      let stdout = '';
      let stderr = '';
      
      process.stdout.on('data', (data) => {
        stdout += data.toString();
        logger.debug(`Quantization output: ${data.toString().trim()}`);
      });
      
      process.stderr.on('data', (data) => {
        stderr += data.toString();
        logger.warn(`Quantization error: ${data.toString().trim()}`);
      });
      
      process.on('close', (code) => {
        // Clean up temporary script
        try {
          fs.unlinkSync(scriptPath);
        } catch (error) {
          logger.warn(`Failed to delete temporary script: ${error.message}`);
        }
        
        if (code === 0) {
          // Get output file size
          const outputSize = fs.statSync(options.outputPath).size;
          const inputSize = fs.statSync(options.inputPath).size;
          const compressionRatio = (outputSize / inputSize) * 100;
          
          const result = {
            inputPath: options.inputPath,
            outputPath: options.outputPath,
            format: 'onnx',
            quantType,
            bits: options.bits,
            inputSize,
            outputSize,
            compressionRatio: compressionRatio.toFixed(2) + '%',
            stdout,
            stderr
          };
          
          resolve(result);
        } else {
          reject(new Error(`Quantization failed with code ${code}: ${stderr}`));
        }
      });
      
      process.on('error', (err) => {
        // Clean up temporary script
        try {
          fs.unlinkSync(scriptPath);
        } catch (error) {
          logger.warn(`Failed to delete temporary script: ${error.message}`);
        }
        
        reject(new Error(`Failed to spawn quantization process: ${err.message}`));
      });
    });
  }
  
  /**
   * Recommends quantization parameters based on hardware profile and model characteristics
   * @param {string} modelType - Model type
   * @param {number} modelSize - Model size in bytes
   * @param {Object} hwProfile - Hardware profile
   * @returns {Object} Recommended quantization parameters
   */
  recommendQuantization(modelType, modelSize, hwProfile = null) {
    // Use provided hardware profile or stored profile
    const profile = hwProfile || this.hardwareProfile;
    
    // Default to conservative quantization if no profile available
    if (!profile) {
      logger.warn('No hardware profile available, using conservative quantization');
      return {
        bits: 8,
        blockSize: 32
      };
    }
    
    logger.debug(`Recommending quantization for ${modelType} model (${Math.round(modelSize / (1024 * 1024 * 1024))} GB)`);
    
    // Determine memory tier
    const memoryTier = profile.memory?.tier || 'medium';
    
    // Determine if GPU is available
    const hasGPU = profile.gpu?.available || false;
    
    // Determine if CPU has AVX2/AVX512
    const hasAVX2 = profile.cpu?.capabilities?.avx2 || false;
    const hasAVX512 = profile.cpu?.capabilities?.avx512 || false;
    
    // Determine disk type
    const diskType = profile.disk?.type || 'unknown';
    
    // Base recommendations on hardware capabilities
    let bits = 4;
    let blockSize = 32;
    
    // Adjust based on memory tier
    switch (memoryTier) {
      case 'low':
        bits = 4;
        blockSize = 32;
        break;
      
      case 'medium':
        bits = hasAVX2 ? 4 : 8;
        blockSize = 32;
        break;
      
      case 'high':
        bits = hasAVX2 ? 5 : 8;
        blockSize = hasAVX512 ? 64 : 32;
        break;
      
      case 'ultra':
        bits = hasGPU ? 8 : (hasAVX512 ? 6 : 8);
        blockSize = hasAVX512 ? 64 : 32;
        break;
    }
    
    // Adjust based on model type
    if (modelType === 'embedding') {
      // Embedding models are more sensitive to quantization
      bits = Math.max(bits, 5);
    } else if (modelType === 'text-generation') {
      // Text generation models can use more aggressive quantization
      if (memoryTier === 'low') {
        bits = 3;
      }
    }
    
    // Adjust based on disk type (for loading speed considerations)
    if (diskType === 'ssd' && memoryTier !== 'low') {
      // Can use higher precision on SSDs due to faster loading
      bits = Math.min(bits + 1, 8);
    }
    
    logger.debug(`Recommended quantization: ${bits} bits, block size ${blockSize}`);
    
    return {
      bits,
      blockSize
    };
  }
  
  /**
   * Gets available quantization options for a model format
   * @param {string} format - Model format
   * @returns {Array<Object>} Available quantization options
   */
  getQuantizationOptions(format) {
    if (!format) {
      throw new Error('Model format is required');
    }
    
    switch (format.toLowerCase()) {
      case 'ggml':
        return [
          { bits: 4, blockSize: 32, name: '4-bit (Q4_0)', description: 'Good balance of quality and size' },
          { bits: 5, blockSize: 32, name: '5-bit (Q5_0)', description: 'Better quality, larger size' },
          { bits: 8, blockSize: 32, name: '8-bit (Q8_0)', description: 'High quality, largest size' }
        ];
      
      case 'gguf':
        return [
          { bits: 2, blockSize: 32, name: 'Q2_K', description: 'Smallest size, lowest quality' },
          { bits: 3, blockSize: 32, name: 'Q3_K_S', description: 'Very small size, lower quality' },
          { bits: 4, blockSize: 32, name: 'Q4_K_S', description: 'Small size, decent quality' },
          { bits: 4, blockSize: 64, name: 'Q4_K_M', description: 'Small size, better quality' },
          { bits: 5, blockSize: 32, name: 'Q5_K_S', description: 'Medium size, good quality' },
          { bits: 6, blockSize: 32, name: 'Q6_K', description: 'Larger size, very good quality' },
          { bits: 8, blockSize: 32, name: 'Q8_0', description: 'Largest size, highest quality' }
        ];
      
      case 'onnx':
        return [
          { bits: 8, name: 'INT8', description: 'Reduced precision, smaller size' },
          { bits: 16, name: 'FP16', description: 'Half precision, good quality' }
        ];
      
      default:
        throw new Error(`Unsupported format: ${format}`);
    }
  }
  
  /**
   * Shuts down the QuantizationService
   * @async
   * @returns {Promise<boolean>} Shutdown success status
   */
  async shutdown() {
    if (!this.isInitialized) {
      logger.warn('QuantizationService not initialized, nothing to shut down');
      return true;
    }
    
    try {
      logger.info('Shutting down QuantizationService');
      
      this.isInitialized = false;
      this.emit('shutdown');
      logger.info('QuantizationService shut down successfully');
      return true;
    } catch (error) {
      logger.error(`Error during QuantizationService shutdown: ${error.message}`, error);
      return false;
    }
  }
}

module.exports = QuantizationService;
