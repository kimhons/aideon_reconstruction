/**
 * @fileoverview Resource Monitor for the Model Orchestration System
 * Provides real-time monitoring of system resources for optimal model management
 * 
 * @module src/core/miif/models/orchestration/ResourceMonitor
 */

const os = require('os');
const EventEmitter = require('events');

/**
 * Resource Monitor
 * Monitors system resources for optimal model management
 * @extends EventEmitter
 */
class ResourceMonitor extends EventEmitter {
  /**
   * Create a new Resource Monitor
   * @param {Object} options - Configuration options
   * @param {Object} dependencies - System dependencies
   */
  constructor(options = {}, dependencies = {}) {
    super();
    
    this.options = {
      monitoringInterval: 5000, // 5 seconds
      memoryThresholdWarning: 0.8, // 80% of available memory
      memoryThresholdCritical: 0.9, // 90% of available memory
      cpuThresholdWarning: 0.7, // 70% of available CPU
      cpuThresholdCritical: 0.9, // 90% of available CPU
      enableGpuMonitoring: true,
      ...options
    };
    
    this.dependencies = dependencies;
    this.logger = dependencies.logger || console;
    
    this.monitoringInterval = null;
    this.gpuInfo = null;
    this.lastReadings = {
      timestamp: Date.now(),
      memory: {
        total: 0,
        free: 0,
        used: 0,
        usagePercentage: 0
      },
      cpu: {
        usage: 0,
        loadAverage: [0, 0, 0]
      },
      gpu: {
        total: 0,
        free: 0,
        used: 0,
        usagePercentage: 0
      }
    };
    
    this.logger.info('[ResourceMonitor] Resource Monitor initialized');
  }
  
  /**
   * Start monitoring
   * @returns {boolean} Success status
   */
  start() {
    if (this.monitoringInterval) {
      this.logger.warn('[ResourceMonitor] Monitoring already started');
      return false;
    }
    
    this.logger.info('[ResourceMonitor] Starting resource monitoring');
    
    // Initialize GPU monitoring if enabled
    if (this.options.enableGpuMonitoring) {
      this._initializeGpuMonitoring();
    }
    
    // Start monitoring interval
    this.monitoringInterval = setInterval(() => {
      this._updateResourceReadings();
    }, this.options.monitoringInterval);
    
    // Initial reading
    this._updateResourceReadings();
    
    return true;
  }
  
  /**
   * Stop monitoring
   * @returns {boolean} Success status
   */
  stop() {
    if (!this.monitoringInterval) {
      this.logger.warn('[ResourceMonitor] Monitoring not started');
      return false;
    }
    
    this.logger.info('[ResourceMonitor] Stopping resource monitoring');
    
    clearInterval(this.monitoringInterval);
    this.monitoringInterval = null;
    
    return true;
  }
  
  /**
   * Initialize GPU monitoring
   * @private
   */
  _initializeGpuMonitoring() {
    try {
      // This would use a library like node-nvidia-smi or similar
      // This is a placeholder for the actual implementation
      this.logger.info('[ResourceMonitor] Initializing GPU monitoring');
      
      // Mock GPU info for development
      this.gpuInfo = {
        name: 'NVIDIA RTX 4090',
        totalMemory: 24 * 1024, // 24 GB in MB
        driver: '535.104.05'
      };
    } catch (error) {
      this.logger.warn(`[ResourceMonitor] Failed to initialize GPU monitoring: ${error.message}`);
      this.options.enableGpuMonitoring = false;
    }
  }
  
  /**
   * Update resource readings
   * @private
   */
  _updateResourceReadings() {
    const now = Date.now();
    
    // Memory readings
    const totalMemory = os.totalmem() / (1024 * 1024 * 1024); // GB
    const freeMemory = os.freemem() / (1024 * 1024 * 1024); // GB
    const usedMemory = totalMemory - freeMemory;
    const memoryUsagePercentage = usedMemory / totalMemory;
    
    // CPU readings
    const cpuUsage = this._getCpuUsage();
    const loadAverage = os.loadavg();
    
    // GPU readings (if enabled)
    let gpuReadings = {
      total: 0,
      free: 0,
      used: 0,
      usagePercentage: 0
    };
    
    if (this.options.enableGpuMonitoring && this.gpuInfo) {
      gpuReadings = this._getGpuReadings();
    }
    
    // Update last readings
    this.lastReadings = {
      timestamp: now,
      memory: {
        total: totalMemory,
        free: freeMemory,
        used: usedMemory,
        usagePercentage: memoryUsagePercentage
      },
      cpu: {
        usage: cpuUsage,
        loadAverage
      },
      gpu: gpuReadings
    };
    
    // Check thresholds and emit events
    this._checkThresholds();
    
    // Emit update event
    this.emit('resourceUpdate', this.lastReadings);
  }
  
  /**
   * Get CPU usage
   * @returns {number} CPU usage percentage
   * @private
   */
  _getCpuUsage() {
    // This is a simplified implementation
    // A more accurate implementation would compare usage over time
    const cpus = os.cpus();
    let idle = 0;
    let total = 0;
    
    for (const cpu of cpus) {
      for (const type in cpu.times) {
        total += cpu.times[type];
      }
      idle += cpu.times.idle;
    }
    
    return 1 - (idle / total);
  }
  
  /**
   * Get GPU readings
   * @returns {Object} GPU readings
   * @private
   */
  _getGpuReadings() {
    // This would use a library like node-nvidia-smi or similar
    // This is a placeholder for the actual implementation
    
    // Mock GPU readings for development
    const totalMemory = this.gpuInfo.totalMemory / 1024; // GB
    const usedMemory = Math.random() * totalMemory * 0.7; // Random usage up to 70%
    const freeMemory = totalMemory - usedMemory;
    const usagePercentage = usedMemory / totalMemory;
    
    return {
      total: totalMemory,
      free: freeMemory,
      used: usedMemory,
      usagePercentage
    };
  }
  
  /**
   * Check resource thresholds and emit events
   * @private
   */
  _checkThresholds() {
    const { memory, cpu, gpu } = this.lastReadings;
    
    // Memory thresholds
    if (memory.usagePercentage >= this.options.memoryThresholdCritical) {
      this.logger.warn(`[ResourceMonitor] CRITICAL: Memory usage at ${(memory.usagePercentage * 100).toFixed(1)}%`);
      this.emit('memoryCritical', memory);
    } else if (memory.usagePercentage >= this.options.memoryThresholdWarning) {
      this.logger.warn(`[ResourceMonitor] WARNING: Memory usage at ${(memory.usagePercentage * 100).toFixed(1)}%`);
      this.emit('memoryWarning', memory);
    }
    
    // CPU thresholds
    if (cpu.usage >= this.options.cpuThresholdCritical) {
      this.logger.warn(`[ResourceMonitor] CRITICAL: CPU usage at ${(cpu.usage * 100).toFixed(1)}%`);
      this.emit('cpuCritical', cpu);
    } else if (cpu.usage >= this.options.cpuThresholdWarning) {
      this.logger.warn(`[ResourceMonitor] WARNING: CPU usage at ${(cpu.usage * 100).toFixed(1)}%`);
      this.emit('cpuWarning', cpu);
    }
    
    // GPU thresholds (if enabled)
    if (this.options.enableGpuMonitoring && this.gpuInfo) {
      if (gpu.usagePercentage >= this.options.memoryThresholdCritical) {
        this.logger.warn(`[ResourceMonitor] CRITICAL: GPU memory usage at ${(gpu.usagePercentage * 100).toFixed(1)}%`);
        this.emit('gpuCritical', gpu);
      } else if (gpu.usagePercentage >= this.options.memoryThresholdWarning) {
        this.logger.warn(`[ResourceMonitor] WARNING: GPU memory usage at ${(gpu.usagePercentage * 100).toFixed(1)}%`);
        this.emit('gpuWarning', gpu);
      }
    }
  }
  
  /**
   * Get available memory
   * @returns {Object} Available memory in GB
   */
  getAvailableMemory() {
    return {
      ram: this.lastReadings.memory.free,
      vram: this.options.enableGpuMonitoring ? this.lastReadings.gpu.free : 0
    };
  }
  
  /**
   * Get current resource readings
   * @returns {Object} Current resource readings
   */
  getCurrentReadings() {
    return this.lastReadings;
  }
  
  /**
   * Get system information
   * @returns {Object} System information
   */
  getSystemInfo() {
    return {
      platform: os.platform(),
      arch: os.arch(),
      cpus: os.cpus().length,
      totalMemory: os.totalmem() / (1024 * 1024 * 1024), // GB
      hostname: os.hostname(),
      gpu: this.gpuInfo
    };
  }
}

module.exports = ResourceMonitor;
