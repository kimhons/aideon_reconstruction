/**
 * @fileoverview HardwareProfiler is responsible for detecting and profiling the hardware
 * capabilities of the system, providing information for optimal model selection and
 * quantization decisions within Aideon Core.
 * 
 * @module core/ml/HardwareProfiler
 * @requires core/utils/Logger
 */

const os = require('os');
const { exec } = require('child_process');
const { promisify } = require('util');
const { EventEmitter } = require('events');
const logger = require('../utils/Logger').getLogger('HardwareProfiler');

// Promisify exec
const execAsync = promisify(exec);

/**
 * @class HardwareProfiler
 * @extends EventEmitter
 * @description Detects and profiles hardware capabilities for optimal model selection
 */
class HardwareProfiler extends EventEmitter {
  /**
   * Creates an instance of HardwareProfiler
   * @param {Object} options - Configuration options
   * @param {boolean} options.detectGPU - Whether to detect GPU capabilities
   * @param {boolean} options.detectCPU - Whether to detect CPU capabilities
   * @param {boolean} options.detectMemory - Whether to detect memory capabilities
   * @param {boolean} options.detectDisk - Whether to detect disk capabilities
   * @param {number} options.refreshInterval - Interval for refreshing hardware profile in milliseconds
   */
  constructor(options = {}) {
    super();
    
    this.options = {
      detectGPU: true,
      detectCPU: true,
      detectMemory: true,
      detectDisk: true,
      refreshInterval: 300000, // 5 minutes
      ...options
    };
    
    this.profile = {
      timestamp: null,
      cpu: {},
      memory: {},
      gpu: {},
      disk: {}
    };
    
    this.refreshTimer = null;
    this.isInitialized = false;
    
    // Bind methods
    this.initialize = this.initialize.bind(this);
    this.detectCPU = this.detectCPU.bind(this);
    this.detectMemory = this.detectMemory.bind(this);
    this.detectGPU = this.detectGPU.bind(this);
    this.detectDisk = this.detectDisk.bind(this);
    this.refreshProfile = this.refreshProfile.bind(this);
    this.getProfile = this.getProfile.bind(this);
    this.shutdown = this.shutdown.bind(this);
  }
  
  /**
   * Initializes the HardwareProfiler
   * @async
   * @returns {Promise<boolean>} Initialization success status
   */
  async initialize() {
    if (this.isInitialized) {
      logger.warn('HardwareProfiler already initialized');
      return true;
    }
    
    try {
      logger.info('Initializing HardwareProfiler');
      
      // Perform initial hardware detection
      await this.refreshProfile();
      
      // Set up refresh timer if interval is positive
      if (this.options.refreshInterval > 0) {
        this.refreshTimer = setInterval(
          this.refreshProfile,
          this.options.refreshInterval
        );
      }
      
      this.isInitialized = true;
      this.emit('initialized', this.profile);
      logger.info('HardwareProfiler initialized successfully');
      return true;
    } catch (error) {
      logger.error(`Failed to initialize HardwareProfiler: ${error.message}`, error);
      this.emit('error', error);
      return false;
    }
  }
  
  /**
   * Refreshes the hardware profile
   * @async
   * @returns {Promise<Object>} Updated hardware profile
   */
  async refreshProfile() {
    try {
      logger.debug('Refreshing hardware profile');
      
      // Update timestamp
      this.profile.timestamp = Date.now();
      
      // Detect hardware capabilities
      if (this.options.detectCPU) {
        await this.detectCPU();
      }
      
      if (this.options.detectMemory) {
        await this.detectMemory();
      }
      
      if (this.options.detectGPU) {
        await this.detectGPU();
      }
      
      if (this.options.detectDisk) {
        await this.detectDisk();
      }
      
      this.emit('profileUpdated', this.profile);
      logger.debug('Hardware profile refreshed successfully');
      
      return this.profile;
    } catch (error) {
      logger.error(`Failed to refresh hardware profile: ${error.message}`, error);
      this.emit('profileUpdateError', error);
      throw error;
    }
  }
  
  /**
   * Detects CPU capabilities
   * @async
   * @returns {Promise<Object>} CPU profile
   */
  async detectCPU() {
    try {
      logger.debug('Detecting CPU capabilities');
      
      // Get CPU info from os module
      const cpus = os.cpus();
      const cpuCount = cpus.length;
      const cpuModel = cpus[0]?.model || 'Unknown';
      const cpuSpeed = cpus[0]?.speed || 0;
      
      // Detect CPU architecture
      const arch = os.arch();
      
      // Detect CPU features (platform-specific)
      let features = [];
      
      if (process.platform === 'linux') {
        try {
          const { stdout } = await execAsync('cat /proc/cpuinfo | grep flags | head -1');
          features = stdout.split(':')[1]?.trim().split(' ') || [];
        } catch (error) {
          logger.warn(`Failed to detect CPU features: ${error.message}`);
        }
      } else if (process.platform === 'darwin') {
        try {
          const { stdout } = await execAsync('sysctl -a | grep machdep.cpu.features');
          features = stdout.split(':')[1]?.trim().split(' ') || [];
        } catch (error) {
          logger.warn(`Failed to detect CPU features: ${error.message}`);
        }
      } else if (process.platform === 'win32') {
        // Windows detection would require more complex approach
        // This is a simplified placeholder
        features = ['x64'];
      }
      
      // Update CPU profile
      this.profile.cpu = {
        model: cpuModel,
        count: cpuCount,
        speed: cpuSpeed,
        arch,
        features,
        // Determine capabilities relevant for ML
        capabilities: {
          avx: features.some(f => f.includes('avx')),
          avx2: features.some(f => f.includes('avx2')),
          avx512: features.some(f => f.includes('avx512')),
          sse4: features.some(f => f.includes('sse4')),
          fma: features.some(f => f.includes('fma')),
        }
      };
      
      logger.debug(`CPU detected: ${cpuCount}x ${cpuModel} (${arch})`);
      return this.profile.cpu;
    } catch (error) {
      logger.error(`Failed to detect CPU: ${error.message}`, error);
      this.profile.cpu = {
        error: error.message
      };
      return this.profile.cpu;
    }
  }
  
  /**
   * Detects memory capabilities
   * @async
   * @returns {Promise<Object>} Memory profile
   */
  async detectMemory() {
    try {
      logger.debug('Detecting memory capabilities');
      
      // Get memory info from os module
      const totalMemory = os.totalmem();
      const freeMemory = os.freemem();
      
      // Calculate available memory for ML models (75% of free memory)
      const availableMemory = Math.floor(freeMemory * 0.75);
      
      // Update memory profile
      this.profile.memory = {
        total: totalMemory,
        free: freeMemory,
        available: availableMemory,
        // Determine memory tier for model selection
        tier: this.determineMemoryTier(totalMemory)
      };
      
      logger.debug(`Memory detected: ${Math.round(totalMemory / (1024 * 1024 * 1024))} GB total, ${Math.round(freeMemory / (1024 * 1024 * 1024))} GB free`);
      return this.profile.memory;
    } catch (error) {
      logger.error(`Failed to detect memory: ${error.message}`, error);
      this.profile.memory = {
        error: error.message
      };
      return this.profile.memory;
    }
  }
  
  /**
   * Determines memory tier based on total memory
   * @param {number} totalMemory - Total memory in bytes
   * @returns {string} Memory tier (low, medium, high, ultra)
   */
  determineMemoryTier(totalMemory) {
    const gbTotal = totalMemory / (1024 * 1024 * 1024);
    
    if (gbTotal < 8) {
      return 'low';
    } else if (gbTotal < 16) {
      return 'medium';
    } else if (gbTotal < 32) {
      return 'high';
    } else {
      return 'ultra';
    }
  }
  
  /**
   * Detects GPU capabilities
   * @async
   * @returns {Promise<Object>} GPU profile
   */
  async detectGPU() {
    try {
      logger.debug('Detecting GPU capabilities');
      
      // Initialize GPU profile
      const gpuProfile = {
        available: false,
        devices: [],
        cuda: {
          available: false,
          version: null
        },
        directml: {
          available: false
        },
        metal: {
          available: false
        }
      };
      
      // Detect CUDA
      if (process.platform === 'linux' || process.platform === 'win32') {
        try {
          const { stdout } = await execAsync('nvidia-smi --query-gpu=name,memory.total,driver_version --format=csv,noheader');
          
          if (stdout && stdout.trim()) {
            gpuProfile.cuda.available = true;
            
            // Parse NVIDIA GPU info
            const gpuLines = stdout.trim().split('\n');
            gpuProfile.devices = gpuLines.map(line => {
              const [name, memory, driverVersion] = line.split(', ');
              return {
                name: name.trim(),
                memory: parseInt(memory.replace('MiB', '').trim()) * 1024 * 1024, // Convert MiB to bytes
                driver: driverVersion.trim(),
                type: 'nvidia'
              };
            });
            
            // Try to get CUDA version
            try {
              const { stdout: cudaVersionStdout } = await execAsync('nvcc --version');
              const versionMatch = cudaVersionStdout.match(/release (\d+\.\d+)/);
              if (versionMatch) {
                gpuProfile.cuda.version = versionMatch[1];
              }
            } catch (cudaError) {
              logger.warn(`Failed to detect CUDA version: ${cudaError.message}`);
            }
          }
        } catch (error) {
          logger.debug(`No NVIDIA GPU detected: ${error.message}`);
        }
        
        // Check for AMD GPUs on Linux
        if (process.platform === 'linux' && !gpuProfile.cuda.available) {
          try {
            const { stdout } = await execAsync('lspci | grep -i amd/ati');
            if (stdout && stdout.includes('VGA')) {
              gpuProfile.devices.push({
                name: stdout.split(':').pop().trim(),
                type: 'amd',
                // Other details not easily available
              });
            }
          } catch (error) {
            logger.debug(`No AMD GPU detected: ${error.message}`);
          }
        }
        
        // Check for DirectML on Windows
        if (process.platform === 'win32') {
          try {
            const { stdout } = await execAsync('powershell "Get-WmiObject win32_VideoController | Select-Object Name, AdapterRAM"');
            if (stdout && !gpuProfile.cuda.available) {
              // Parse Windows GPU info (simplified)
              const gpuMatches = stdout.matchAll(/Name\s+:\s+(.+)\r?\nAdapterRAM\s+:\s+(\d+)/g);
              for (const match of gpuMatches) {
                gpuProfile.devices.push({
                  name: match[1].trim(),
                  memory: parseInt(match[2]),
                  type: match[1].toLowerCase().includes('nvidia') ? 'nvidia' : 
                        match[1].toLowerCase().includes('amd') ? 'amd' : 'other'
                });
              }
              
              // If we have GPUs but no CUDA, assume DirectML is available
              if (gpuProfile.devices.length > 0) {
                gpuProfile.directml.available = true;
              }
            }
          } catch (error) {
            logger.debug(`Failed to detect DirectML: ${error.message}`);
          }
        }
      } else if (process.platform === 'darwin') {
        // Check for Metal on macOS
        try {
          const { stdout } = await execAsync('system_profiler SPDisplaysDataType | grep "Metal:"');
          if (stdout && stdout.includes('Metal: Supported')) {
            gpuProfile.metal.available = true;
            
            // Try to get GPU info
            try {
              const { stdout: gpuInfoStdout } = await execAsync('system_profiler SPDisplaysDataType');
              const nameMatch = gpuInfoStdout.match(/Chipset Model: (.+)/);
              const memoryMatch = gpuInfoStdout.match(/VRAM \(Dynamic, Max\): (\d+) MB/);
              
              if (nameMatch) {
                gpuProfile.devices.push({
                  name: nameMatch[1].trim(),
                  memory: memoryMatch ? parseInt(memoryMatch[1]) * 1024 * 1024 : undefined,
                  type: nameMatch[1].toLowerCase().includes('amd') ? 'amd' : 
                        nameMatch[1].toLowerCase().includes('nvidia') ? 'nvidia' : 'apple'
                });
              }
            } catch (gpuError) {
              logger.warn(`Failed to detect GPU details: ${gpuError.message}`);
            }
          }
        } catch (error) {
          logger.debug(`Failed to detect Metal: ${error.message}`);
        }
      }
      
      // Update available flag
      gpuProfile.available = gpuProfile.devices.length > 0;
      
      // Update GPU profile
      this.profile.gpu = gpuProfile;
      
      if (gpuProfile.available) {
        logger.debug(`GPU detected: ${gpuProfile.devices.map(d => d.name).join(', ')}`);
      } else {
        logger.debug('No GPU detected');
      }
      
      return this.profile.gpu;
    } catch (error) {
      logger.error(`Failed to detect GPU: ${error.message}`, error);
      this.profile.gpu = {
        error: error.message,
        available: false
      };
      return this.profile.gpu;
    }
  }
  
  /**
   * Detects disk capabilities
   * @async
   * @returns {Promise<Object>} Disk profile
   */
  async detectDisk() {
    try {
      logger.debug('Detecting disk capabilities');
      
      // Initialize disk profile
      const diskProfile = {
        modelStoragePath: this.options.modelStoragePath || path.join(process.cwd(), 'models'),
        available: 0,
        total: 0,
        type: 'unknown'
      };
      
      // Get disk space info (platform-specific)
      if (process.platform === 'linux' || process.platform === 'darwin') {
        try {
          const { stdout } = await execAsync(`df -k "${diskProfile.modelStoragePath}"`);
          const lines = stdout.trim().split('\n');
          if (lines.length > 1) {
            const parts = lines[1].split(/\s+/);
            if (parts.length >= 4) {
              diskProfile.total = parseInt(parts[1]) * 1024; // Convert KB to bytes
              diskProfile.available = parseInt(parts[3]) * 1024; // Convert KB to bytes
            }
          }
        } catch (error) {
          logger.warn(`Failed to get disk space: ${error.message}`);
        }
        
        // Try to determine disk type on Linux
        if (process.platform === 'linux') {
          try {
            // Get device for path
            const { stdout: dfStdout } = await execAsync(`df "${diskProfile.modelStoragePath}" | tail -1 | awk '{print $1}'`);
            const device = dfStdout.trim();
            
            if (device.startsWith('/dev/')) {
              // Check if SSD or HDD
              const { stdout: lsblkStdout } = await execAsync(`lsblk -d -o name,rota | grep ${device.replace('/dev/', '')}`);
              if (lsblkStdout.includes('0')) {
                diskProfile.type = 'ssd';
              } else if (lsblkStdout.includes('1')) {
                diskProfile.type = 'hdd';
              }
            }
          } catch (error) {
            logger.warn(`Failed to determine disk type: ${error.message}`);
          }
        }
      } else if (process.platform === 'win32') {
        try {
          // Get drive letter from path
          const driveLetter = diskProfile.modelStoragePath.charAt(0);
          const { stdout } = await execAsync(`wmic logicaldisk where DeviceID="${driveLetter}:" get Size,FreeSpace`);
          const lines = stdout.trim().split('\n');
          if (lines.length > 1) {
            const parts = lines[1].trim().split(/\s+/);
            if (parts.length >= 2) {
              diskProfile.available = parseInt(parts[0]);
              diskProfile.total = parseInt(parts[1]);
            }
          }
          
          // Try to determine disk type
          try {
            const { stdout: diskTypeStdout } = await execAsync(`wmic diskdrive get MediaType`);
            if (diskTypeStdout.toLowerCase().includes('ssd')) {
              diskProfile.type = 'ssd';
            } else if (diskTypeStdout.toLowerCase().includes('hdd') || diskTypeStdout.toLowerCase().includes('hard')) {
              diskProfile.type = 'hdd';
            }
          } catch (error) {
            logger.warn(`Failed to determine disk type: ${error.message}`);
          }
        } catch (error) {
          logger.warn(`Failed to get disk space: ${error.message}`);
        }
      }
      
      // Update disk profile
      this.profile.disk = diskProfile;
      
      logger.debug(`Disk detected: ${Math.round(diskProfile.available / (1024 * 1024 * 1024))} GB available of ${Math.round(diskProfile.total / (1024 * 1024 * 1024))} GB total (${diskProfile.type})`);
      return this.profile.disk;
    } catch (error) {
      logger.error(`Failed to detect disk: ${error.message}`, error);
      this.profile.disk = {
        error: error.message
      };
      return this.profile.disk;
    }
  }
  
  /**
   * Gets the current hardware profile
   * @returns {Object} Hardware profile
   */
  getProfile() {
    return this.profile;
  }
  
  /**
   * Shuts down the HardwareProfiler
   * @async
   * @returns {Promise<boolean>} Shutdown success status
   */
  async shutdown() {
    if (!this.isInitialized) {
      logger.warn('HardwareProfiler not initialized, nothing to shut down');
      return true;
    }
    
    try {
      logger.info('Shutting down HardwareProfiler');
      
      // Clear refresh timer
      if (this.refreshTimer) {
        clearInterval(this.refreshTimer);
        this.refreshTimer = null;
      }
      
      this.isInitialized = false;
      this.emit('shutdown');
      logger.info('HardwareProfiler shut down successfully');
      return true;
    } catch (error) {
      logger.error(`Error during HardwareProfiler shutdown: ${error.message}`, error);
      return false;
    }
  }
}

module.exports = HardwareProfiler;
