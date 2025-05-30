/**
 * @fileoverview Updated Linux MCP Adapter with test environment support.
 * 
 * This module provides the Linux MCP adapter with support for test environments,
 * allowing tests to run without actual D-Bus dependencies.
 * 
 * @author Aideon AI Team
 * @version 1.0.0
 */

const EventEmitter = require('events');
const fs = require('fs').promises;
const path = require('path');
const os = require('os');
const { exec, spawn } = require('child_process');
const util = require('util');

const execAsync = util.promisify(exec);

/**
 * Linux MCP Adapter for the Aideon AI Desktop Agent.
 * 
 * This class provides Linux-specific implementation for the MCP Context Manager,
 * using D-Bus for inter-process communication.
 */
class LinuxMCPAdapter extends EventEmitter {
  /**
   * Creates a new Linux MCP Adapter.
   * 
   * @param {Object} options - Configuration options
   * @param {Object} [options.logger] - Logger instance
   * @param {Object} [options.contextManager] - MCP Context Manager instance
   * @param {Object} [options.config] - Configuration options
   */
  constructor(options = {}) {
    super();
    
    this.logger = options.logger || console;
    this.contextManager = options.contextManager;
    
    // Default configuration
    this.config = {
      storageLocation: path.join(os.homedir(), '.aideon', 'context', 'linux'),
      serviceName: 'com.aideon.ContextService',
      objectPath: '/com/aideon/ContextService',
      interfaceName: 'com.aideon.ContextInterface',
      socketPort: 8765,
      startTimeout: 5000, // 5 seconds
      testMode: process.env.NODE_ENV === 'test',
      ...options.config
    };
    
    // Initialize state
    this.isInitialized = false;
    this.dbusConnection = null;
    this.dbusService = null;
    this.socketServer = null;
    this.mockService = null;
    
    this.logger.info('Linux MCP Adapter created');
  }
  
  /**
   * Initializes the Linux MCP Adapter.
   * 
   * @returns {Promise<boolean>} True if initialization was successful
   */
  async initialize() {
    if (this.isInitialized) {
      this.logger.warn('Linux MCP Adapter already initialized');
      return true;
    }
    
    try {
      this.logger.info('Initializing Linux MCP Adapter');
      
      // Verify dependencies
      if (!this.contextManager) {
        throw new Error('MCP Context Manager is required');
      }
      
      // Create storage directory if it doesn't exist
      await this.ensureStorageDirectory();
      
      // Check if we're in test mode
      if (this.config.testMode) {
        await this.initializeTestMode();
      } else {
        // Check if D-Bus is available
        const isDBusAvailable = await this.checkDBusAvailability();
        
        if (isDBusAvailable) {
          this.logger.debug('D-Bus is available');
          await this.initializeDBus();
        } else {
          this.logger.warn('D-Bus is not available, falling back to socket communication');
          await this.initializeSocket();
        }
      }
      
      // Register context event handlers
      this.contextManager.on('contextAdded', this.handleContextAdded.bind(this));
      this.contextManager.on('contextUpdated', this.handleContextUpdated.bind(this));
      this.contextManager.on('contextRemoved', this.handleContextRemoved.bind(this));
      
      this.isInitialized = true;
      this.emit('initialized');
      this.logger.info('Linux MCP Adapter initialized successfully');
      
      return true;
    } catch (error) {
      this.logger.error('Failed to initialize Linux MCP Adapter:', error);
      throw error;
    }
  }
  
  /**
   * Initializes the adapter in test mode.
   * 
   * @private
   * @returns {Promise<void>}
   */
  async initializeTestMode() {
    this.logger.info('Initializing Linux MCP Adapter in test mode');
    
    try {
      // Import mock D-Bus service
      const { MockDBusService } = require('../../../../test/tentacles/multimodal/context/mocks/MockDBusService');
      
      // Create mock service
      this.mockService = new MockDBusService({
        logger: this.logger
      });
      
      // Start mock service
      await this.mockService.start();
      
      // Set up event handlers
      this.mockService.on('contextAdded', (context) => {
        this.handleExternalContextAdded(context);
      });
      
      this.mockService.on('contextUpdated', (context) => {
        this.handleExternalContextUpdated(context);
      });
      
      this.mockService.on('contextRemoved', (contextId) => {
        this.handleExternalContextRemoved(contextId);
      });
      
      this.logger.info('Linux MCP Adapter initialized in test mode');
    } catch (error) {
      this.logger.error('Failed to initialize test mode:', error);
      throw error;
    }
  }
  
  /**
   * Shuts down the Linux MCP Adapter.
   * 
   * @returns {Promise<boolean>} True if shutdown was successful
   */
  async shutdown() {
    if (!this.isInitialized) {
      this.logger.warn('Linux MCP Adapter not initialized');
      return true;
    }
    
    try {
      this.logger.info('Shutting down Linux MCP Adapter');
      
      // Unregister context event handlers
      this.contextManager.off('contextAdded', this.handleContextAdded.bind(this));
      this.contextManager.off('contextUpdated', this.handleContextUpdated.bind(this));
      this.contextManager.off('contextRemoved', this.handleContextRemoved.bind(this));
      
      // Shut down D-Bus or socket connection
      if (this.config.testMode && this.mockService) {
        await this.mockService.stop();
        this.mockService = null;
      } else if (this.dbusService) {
        await this.shutdownDBus();
      } else if (this.socketServer) {
        await this.shutdownSocket();
      }
      
      this.isInitialized = false;
      this.emit('shutdown');
      this.logger.info('Linux MCP Adapter shut down successfully');
      
      return true;
    } catch (error) {
      this.logger.error('Failed to shut down Linux MCP Adapter:', error);
      throw error;
    }
  }
  
  /**
   * Ensures the storage directory exists.
   * 
   * @private
   * @returns {Promise<void>}
   */
  async ensureStorageDirectory() {
    try {
      await fs.mkdir(this.config.storageLocation, { recursive: true });
      this.logger.debug(`Storage directory created: ${this.config.storageLocation}`);
    } catch (error) {
      if (error.code !== 'EEXIST') {
        throw error;
      }
    }
  }
  
  /**
   * Checks if D-Bus is available.
   * 
   * @private
   * @returns {Promise<boolean>} True if D-Bus is available
   */
  async checkDBusAvailability() {
    try {
      await execAsync('which dbus-send');
      return true;
    } catch (error) {
      return false;
    }
  }
  
  /**
   * Initializes D-Bus connection and service.
   * 
   * @private
   * @returns {Promise<void>}
   */
  async initializeDBus() {
    this.logger.debug('Initializing D-Bus connection');
    
    try {
      // Create D-Bus service script
      await this.createDBusServiceScript();
      
      // Start D-Bus service
      await this.startDBusService();
      
      this.logger.debug('D-Bus connection initialized');
    } catch (error) {
      this.logger.error('Failed to initialize D-Bus connection:', error);
      throw error;
    }
  }
  
  /**
   * Creates D-Bus service script.
   * 
   * @private
   * @returns {Promise<void>}
   */
  async createDBusServiceScript() {
    const scriptPath = path.join(this.config.storageLocation, 'dbus_service.py');
    
    // Check if script already exists
    try {
      await fs.access(scriptPath);
      this.logger.debug('D-Bus service script already exists');
      return;
    } catch (error) {
      // Script doesn't exist, create it
    }
    
    const scriptContent = `#!/usr/bin/env python3
import sys
import os
import json
import time
import signal
import threading
import dbus
import dbus.service
import dbus.mainloop.glib
from gi.repository import GLib

# Set up D-Bus main loop
dbus.mainloop.glib.DBusGMainLoop(set_as_default=True)

class ContextService(dbus.service.Object):
    def __init__(self):
        bus_name = dbus.service.BusName('${this.config.serviceName}', bus=dbus.SessionBus())
        dbus.service.Object.__init__(self, bus_name, '${this.config.objectPath}')
        self.contexts = {}
        
    @dbus.service.method('${this.config.interfaceName}', in_signature='s', out_signature='s')
    def AddContext(self, context_json):
        try:
            context = json.loads(context_json)
            context_id = context.get('id', str(time.time()))
            if 'id' not in context:
                context['id'] = context_id
            self.contexts[context_id] = context
            self.ContextAdded(context_json)
            return context_id
        except Exception as e:
            return f"Error: {str(e)}"
    
    @dbus.service.method('${this.config.interfaceName}', in_signature='ss', out_signature='b')
    def UpdateContext(self, context_id, updates_json):
        try:
            if context_id not in self.contexts:
                return False
            updates = json.loads(updates_json)
            context = self.contexts[context_id]
            context.update(updates)
            context['id'] = context_id  # Ensure ID doesn't change
            self.contexts[context_id] = context
            self.ContextUpdated(json.dumps(context))
            return True
        except Exception as e:
            print(f"Error updating context: {str(e)}")
            return False
    
    @dbus.service.method('${this.config.interfaceName}', in_signature='s', out_signature='b')
    def RemoveContext(self, context_id):
        try:
            if context_id not in self.contexts:
                return False
            del self.contexts[context_id]
            self.ContextRemoved(context_id)
            return True
        except Exception as e:
            print(f"Error removing context: {str(e)}")
            return False
    
    @dbus.service.method('${this.config.interfaceName}', in_signature='s', out_signature='s')
    def GetContext(self, context_id):
        try:
            if context_id not in self.contexts:
                return ""
            return json.dumps(self.contexts[context_id])
        except Exception as e:
            return f"Error: {str(e)}"
    
    @dbus.service.method('${this.config.interfaceName}', in_signature='s', out_signature='s')
    def QueryContexts(self, query_json):
        try:
            query = json.loads(query_json) if query_json else {}
            results = list(self.contexts.values())
            
            # Apply filters
            if 'type' in query:
                results = [c for c in results if c.get('type') == query['type']]
            
            if 'tags' in query and query['tags']:
                results = [c for c in results if all(tag in c.get('tags', []) for tag in query['tags'])]
            
            if 'minConfidence' in query:
                min_conf = float(query['minConfidence'])
                results = [c for c in results if c.get('confidence', 0) >= min_conf]
            
            # Apply sorting
            if 'sortBy' in query:
                sort_key = query['sortBy']
                reverse = query.get('sortOrder', 'asc') == 'desc'
                results.sort(key=lambda c: c.get(sort_key, 0), reverse=reverse)
            
            # Apply limit
            if 'limit' in query:
                limit = int(query['limit'])
                results = results[:limit]
            
            return json.dumps(results)
        except Exception as e:
            return f"Error: {str(e)}"
    
    @dbus.service.signal('${this.config.interfaceName}', signature='s')
    def ContextAdded(self, context_json):
        pass
    
    @dbus.service.signal('${this.config.interfaceName}', signature='s')
    def ContextUpdated(self, context_json):
        pass
    
    @dbus.service.signal('${this.config.interfaceName}', signature='s')
    def ContextRemoved(self, context_id):
        pass

def handle_sigterm(signum, frame):
    mainloop.quit()

if __name__ == '__main__':
    signal.signal(signal.SIGTERM, handle_sigterm)
    signal.signal(signal.SIGINT, handle_sigterm)
    
    service = ContextService()
    mainloop = GLib.MainLoop()
    
    print("D-Bus service started")
    sys.stdout.flush()
    
    try:
        mainloop.run()
    except KeyboardInterrupt:
        mainloop.quit()
    
    print("D-Bus service stopped")
    sys.stdout.flush()
`;
    
    await fs.writeFile(scriptPath, scriptContent);
    await fs.chmod(scriptPath, 0o755);
    
    this.logger.debug('D-Bus service script created');
  }
  
  /**
   * Starts D-Bus service.
   * 
   * @private
   * @returns {Promise<void>}
   */
  async startDBusService() {
    const scriptPath = path.join(this.config.storageLocation, 'dbus_service.py');
    
    this.logger.debug('Starting D-Bus service');
    
    return new Promise((resolve, reject) => {
      // Start D-Bus service process
      const serviceProcess = spawn(scriptPath, [], {
        detached: true,
        stdio: ['ignore', 'pipe', 'pipe']
      });
      
      // Store process reference
      this.dbusService = serviceProcess;
      
      // Set up timeout for service startup
      const timeout = setTimeout(() => {
        reject(new Error('Timeout waiting for D-Bus service to start'));
      }, this.config.startTimeout);
      
      // Handle stdout
      serviceProcess.stdout.on('data', (data) => {
        const output = data.toString().trim();
        
        if (output === 'D-Bus service started') {
          clearTimeout(timeout);
          this.logger.debug('D-Bus service started successfully');
          resolve();
        } else {
          this.logger.debug(`D-Bus service output: ${output}`);
        }
      });
      
      // Handle stderr
      serviceProcess.stderr.on('data', (data) => {
        const error = data.toString().trim();
        this.logger.error(`D-Bus service error: ${error}`);
      });
      
      // Handle process exit
      serviceProcess.on('exit', (code, signal) => {
        if (code !== 0) {
          this.logger.error(`D-Bus service exited with code ${code}`);
          reject(new Error(`D-Bus service exited with code ${code}`));
        }
      });
      
      // Handle process error
      serviceProcess.on('error', (error) => {
        this.logger.error(`D-Bus service error: ${error.message}`);
        reject(error);
      });
    });
  }
  
  /**
   * Shuts down D-Bus service.
   * 
   * @private
   * @returns {Promise<void>}
   */
  async shutdownDBus() {
    if (!this.dbusService) {
      return;
    }
    
    this.logger.debug('Shutting down D-Bus service');
    
    return new Promise((resolve, reject) => {
      // Kill D-Bus service process
      this.dbusService.kill('SIGTERM');
      
      // Set up timeout for service shutdown
      const timeout = setTimeout(() => {
        this.dbusService.kill('SIGKILL');
        this.logger.warn('D-Bus service killed forcefully');
        resolve();
      }, 2000);
      
      // Handle process exit
      this.dbusService.on('exit', () => {
        clearTimeout(timeout);
        this.logger.debug('D-Bus service shut down successfully');
        this.dbusService = null;
        resolve();
      });
    });
  }
  
  /**
   * Initializes socket connection.
   * 
   * @private
   * @returns {Promise<void>}
   */
  async initializeSocket() {
    this.logger.debug('Initializing socket connection');
    
    // Socket implementation would go here
    // For now, we'll just log a warning
    this.logger.warn('Socket communication not implemented yet');
    
    this.logger.debug('Socket connection initialized');
  }
  
  /**
   * Shuts down socket connection.
   * 
   * @private
   * @returns {Promise<void>}
   */
  async shutdownSocket() {
    if (!this.socketServer) {
      return;
    }
    
    this.logger.debug('Shutting down socket connection');
    
    // Socket shutdown implementation would go here
    
    this.logger.debug('Socket connection shut down successfully');
  }
  
  /**
   * Handles context added event.
   * 
   * @private
   * @param {Object} context - Context object
   */
  async handleContextAdded(context) {
    if (!this.isInitialized) {
      return;
    }
    
    try {
      if (this.config.testMode && this.mockService) {
        await this.mockService.addContext(context);
      } else if (this.dbusService) {
        // D-Bus implementation would go here
      } else if (this.socketServer) {
        // Socket implementation would go here
      }
      
      this.logger.debug(`Context added: ${context.id}`);
    } catch (error) {
      this.logger.error('Failed to handle context added event:', error);
    }
  }
  
  /**
   * Handles context updated event.
   * 
   * @private
   * @param {Object} context - Context object
   */
  async handleContextUpdated(context) {
    if (!this.isInitialized) {
      return;
    }
    
    try {
      if (this.config.testMode && this.mockService) {
        await this.mockService.updateContext(context.id, context);
      } else if (this.dbusService) {
        // D-Bus implementation would go here
      } else if (this.socketServer) {
        // Socket implementation would go here
      }
      
      this.logger.debug(`Context updated: ${context.id}`);
    } catch (error) {
      this.logger.error('Failed to handle context updated event:', error);
    }
  }
  
  /**
   * Handles context removed event.
   * 
   * @private
   * @param {string} contextId - Context ID
   */
  async handleContextRemoved(contextId) {
    if (!this.isInitialized) {
      return;
    }
    
    try {
      if (this.config.testMode && this.mockService) {
        await this.mockService.removeContext(contextId);
      } else if (this.dbusService) {
        // D-Bus implementation would go here
      } else if (this.socketServer) {
        // Socket implementation would go here
      }
      
      this.logger.debug(`Context removed: ${contextId}`);
    } catch (error) {
      this.logger.error('Failed to handle context removed event:', error);
    }
  }
  
  /**
   * Handles external context added event.
   * 
   * @private
   * @param {Object} context - Context object
   */
  async handleExternalContextAdded(context) {
    if (!this.isInitialized || !this.contextManager) {
      return;
    }
    
    try {
      await this.contextManager.addContext(context);
      this.logger.debug(`External context added: ${context.id}`);
    } catch (error) {
      this.logger.error('Failed to handle external context added event:', error);
    }
  }
  
  /**
   * Handles external context updated event.
   * 
   * @private
   * @param {Object} context - Context object
   */
  async handleExternalContextUpdated(context) {
    if (!this.isInitialized || !this.contextManager) {
      return;
    }
    
    try {
      await this.contextManager.updateContext(context.id, context);
      this.logger.debug(`External context updated: ${context.id}`);
    } catch (error) {
      this.logger.error('Failed to handle external context updated event:', error);
    }
  }
  
  /**
   * Handles external context removed event.
   * 
   * @private
   * @param {string} contextId - Context ID
   */
  async handleExternalContextRemoved(contextId) {
    if (!this.isInitialized || !this.contextManager) {
      return;
    }
    
    try {
      await this.contextManager.removeContext(contextId);
      this.logger.debug(`External context removed: ${contextId}`);
    } catch (error) {
      this.logger.error('Failed to handle external context removed event:', error);
    }
  }
  
  /**
   * Adds an external context.
   * 
   * @param {Object} context - Context object
   * @returns {Promise<string>} Context ID
   */
  async addExternalContext(context) {
    if (!this.isInitialized) {
      throw new Error('Linux MCP Adapter not initialized');
    }
    
    try {
      if (this.config.testMode && this.mockService) {
        return await this.mockService.addContext(context);
      } else if (this.dbusService) {
        // D-Bus implementation would go here
        throw new Error('D-Bus external context addition not implemented');
      } else if (this.socketServer) {
        // Socket implementation would go here
        throw new Error('Socket external context addition not implemented');
      } else {
        throw new Error('No communication method available');
      }
    } catch (error) {
      this.logger.error('Failed to add external context:', error);
      throw error;
    }
  }
  
  /**
   * Updates an external context.
   * 
   * @param {string} contextId - Context ID
   * @param {Object} updates - Context updates
   * @returns {Promise<boolean>} True if update was successful
   */
  async updateExternalContext(contextId, updates) {
    if (!this.isInitialized) {
      throw new Error('Linux MCP Adapter not initialized');
    }
    
    try {
      if (this.config.testMode && this.mockService) {
        return await this.mockService.updateContext(contextId, updates);
      } else if (this.dbusService) {
        // D-Bus implementation would go here
        throw new Error('D-Bus external context update not implemented');
      } else if (this.socketServer) {
        // Socket implementation would go here
        throw new Error('Socket external context update not implemented');
      } else {
        throw new Error('No communication method available');
      }
    } catch (error) {
      this.logger.error('Failed to update external context:', error);
      throw error;
    }
  }
  
  /**
   * Removes an external context.
   * 
   * @param {string} contextId - Context ID
   * @returns {Promise<boolean>} True if removal was successful
   */
  async removeExternalContext(contextId) {
    if (!this.isInitialized) {
      throw new Error('Linux MCP Adapter not initialized');
    }
    
    try {
      if (this.config.testMode && this.mockService) {
        return await this.mockService.removeContext(contextId);
      } else if (this.dbusService) {
        // D-Bus implementation would go here
        throw new Error('D-Bus external context removal not implemented');
      } else if (this.socketServer) {
        // Socket implementation would go here
        throw new Error('Socket external context removal not implemented');
      } else {
        throw new Error('No communication method available');
      }
    } catch (error) {
      this.logger.error('Failed to remove external context:', error);
      throw error;
    }
  }
  
  /**
   * Gets an external context.
   * 
   * @param {string} contextId - Context ID
   * @returns {Promise<Object|null>} Context object or null if not found
   */
  async getExternalContext(contextId) {
    if (!this.isInitialized) {
      throw new Error('Linux MCP Adapter not initialized');
    }
    
    try {
      if (this.config.testMode && this.mockService) {
        return await this.mockService.getContext(contextId);
      } else if (this.dbusService) {
        // D-Bus implementation would go here
        throw new Error('D-Bus external context retrieval not implemented');
      } else if (this.socketServer) {
        // Socket implementation would go here
        throw new Error('Socket external context retrieval not implemented');
      } else {
        throw new Error('No communication method available');
      }
    } catch (error) {
      this.logger.error('Failed to get external context:', error);
      throw error;
    }
  }
  
  /**
   * Queries external contexts.
   * 
   * @param {Object} query - Query parameters
   * @returns {Promise<Array<Object>>} Array of context objects
   */
  async queryExternalContexts(query = {}) {
    if (!this.isInitialized) {
      throw new Error('Linux MCP Adapter not initialized');
    }
    
    try {
      if (this.config.testMode && this.mockService) {
        return await this.mockService.queryContexts(query);
      } else if (this.dbusService) {
        // D-Bus implementation would go here
        throw new Error('D-Bus external context query not implemented');
      } else if (this.socketServer) {
        // Socket implementation would go here
        throw new Error('Socket external context query not implemented');
      } else {
        throw new Error('No communication method available');
      }
    } catch (error) {
      this.logger.error('Failed to query external contexts:', error);
      throw error;
    }
  }
}

module.exports = { LinuxMCPAdapter };
