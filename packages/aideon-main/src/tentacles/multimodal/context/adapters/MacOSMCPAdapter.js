/**
 * @fileoverview macOS MCP Adapter for the Aideon AI Desktop Agent.
 * 
 * This module implements a macOS-specific adapter for the Model Context Protocol (MCP)
 * that provides integration with the macOS operating system for context management.
 * Since macOS doesn't have native MCP support like Windows, this adapter implements
 * a custom solution that follows MCP principles while leveraging macOS-specific
 * capabilities like AppleScript, NSDistributedNotificationCenter, and XPC.
 * 
 * @author Aideon AI Team
 * @version 1.0.0
 */

const os = require('os');
const path = require('path');
const fs = require('fs').promises;
const { spawn, exec } = require('child_process');
const EventEmitter = require('events');

// Import utility modules
const { EnhancedAsyncLock } = require('../../input/utils/EnhancedAsyncLock');
const { EnhancedCancellationToken } = require('../../input/utils/EnhancedCancellationToken');
const { EnhancedAsyncOperation } = require('../../input/utils/EnhancedAsyncOperation');

/**
 * @typedef {Object} MacOSMCPConfig
 * @property {boolean} [enableSystemWideContext] - Whether to enable system-wide context sharing
 * @property {boolean} [enableAppSpecificContext] - Whether to enable app-specific context sharing
 * @property {string[]} [allowedApps] - List of applications allowed to access Aideon's context
 * @property {string[]} [allowedContextTypes] - List of context types allowed to be shared
 * @property {boolean} [enableNotifications] - Whether to enable macOS notifications for context events
 * @property {string} [storageLocation] - Custom storage location for context data
 * @property {boolean} [enableDebugMode] - Whether to enable debug mode
 */

/**
 * macOS MCP Adapter for the Aideon AI Desktop Agent.
 * 
 * This class provides macOS-specific implementation for the Model Context Protocol,
 * using macOS capabilities to provide context management functionality.
 */
class MacOSMCPAdapter extends EventEmitter {
  /**
   * Creates a new macOS MCP Adapter.
   * 
   * @param {Object} options - Configuration options
   * @param {Object} [options.logger] - Logger instance
   * @param {Object} [options.contextManager] - MCP Context Manager instance
   * @param {MacOSMCPConfig} [options.config] - macOS-specific MCP configuration
   */
  constructor(options = {}) {
    super();
    
    this.logger = options.logger || console;
    this.contextManager = options.contextManager;
    
    // Default configuration
    this.config = {
      enableSystemWideContext: true,
      enableAppSpecificContext: true,
      allowedApps: ['*'],
      allowedContextTypes: ['*'],
      enableNotifications: true,
      storageLocation: path.join(os.homedir(), '.aideon', 'context', 'macos'),
      enableDebugMode: false,
      ...options.config
    };
    
    // Initialize state
    this.isInitialized = false;
    this.notificationObservers = new Map();
    this.registeredApps = new Map();
    this.contextSyncInterval = null;
    this.contextBroadcastServer = null;
    
    // Initialize locks for thread safety
    this.apiLock = new EnhancedAsyncLock();
    
    // Debug data
    this.debugData = {
      operations: [],
      errors: [],
      metrics: {
        notificationsReceived: 0,
        notificationsSent: 0,
        appleScriptExecutions: 0,
        appleScriptErrors: 0
      }
    };
    
    this.logger.info('macOS MCP Adapter created');
  }
  
  /**
   * Initializes the macOS MCP Adapter.
   * 
   * @returns {Promise<boolean>} True if initialization was successful
   */
  async initialize() {
    if (this.isInitialized) {
      this.logger.warn('macOS MCP Adapter already initialized');
      return true;
    }
    
    try {
      this.logger.info('Initializing macOS MCP Adapter');
      
      // Verify we're running on macOS
      if (os.platform() !== 'darwin') {
        throw new Error('macOS MCP Adapter can only be used on macOS');
      }
      
      // Create storage directory
      await fs.mkdir(this.config.storageLocation, { recursive: true });
      
      // Initialize notification observers
      await this.initializeNotificationObservers();
      
      // Initialize context broadcast server
      await this.initializeContextBroadcastServer();
      
      // Initialize context synchronization
      await this.initializeContextSync();
      
      this.isInitialized = true;
      this.emit('initialized');
      this.logger.info('macOS MCP Adapter initialized successfully');
      
      return true;
    } catch (error) {
      this.logger.error('Failed to initialize macOS MCP Adapter:', error);
      this.debugData.errors.push({
        timestamp: Date.now(),
        operation: 'initialize',
        error: error.message,
        stack: error.stack
      });
      
      throw error;
    }
  }
  
  /**
   * Shuts down the macOS MCP Adapter.
   * 
   * @returns {Promise<boolean>} True if shutdown was successful
   */
  async shutdown() {
    if (!this.isInitialized) {
      this.logger.warn('macOS MCP Adapter not initialized');
      return true;
    }
    
    try {
      this.logger.info('Shutting down macOS MCP Adapter');
      
      // Stop context synchronization
      if (this.contextSyncInterval) {
        clearInterval(this.contextSyncInterval);
        this.contextSyncInterval = null;
      }
      
      // Remove notification observers
      await this.removeNotificationObservers();
      
      // Shutdown context broadcast server
      await this.shutdownContextBroadcastServer();
      
      this.isInitialized = false;
      this.emit('shutdown');
      this.logger.info('macOS MCP Adapter shut down successfully');
      
      return true;
    } catch (error) {
      this.logger.error('Failed to shut down macOS MCP Adapter:', error);
      this.debugData.errors.push({
        timestamp: Date.now(),
        operation: 'shutdown',
        error: error.message,
        stack: error.stack
      });
      
      throw error;
    }
  }
  
  /**
   * Initializes notification observers for context events.
   * 
   * @private
   * @returns {Promise<void>}
   */
  async initializeNotificationObservers() {
    try {
      this.logger.info('Initializing notification observers');
      
      // Create Swift script for notification observer
      const observerScript = `
#!/usr/bin/swift

import Foundation

// Set up notification observer
let notificationCenter = DistributedNotificationCenter.default()
let queue = OperationQueue.main

// Register for Aideon MCP notifications
let observer = notificationCenter.addObserver(
    forName: NSNotification.Name("com.aideon.mcp.context"),
    object: nil,
    queue: queue
) { notification in
    if let userInfo = notification.userInfo,
       let contextData = userInfo["contextData"] as? String {
        print("CONTEXT_DATA:\\(contextData)")
    }
}

// Keep the script running to receive notifications
RunLoop.main.run()
      `;
      
      // Write script to file
      const scriptPath = path.join(this.config.storageLocation, 'observer.swift');
      await fs.writeFile(scriptPath, observerScript);
      
      // Make script executable
      await fs.chmod(scriptPath, 0o755);
      
      // Start observer process
      const observer = spawn(scriptPath, [], {
        detached: true,
        stdio: ['ignore', 'pipe', 'pipe']
      });
      
      // Store observer process
      this.notificationObservers.set('main', {
        process: observer,
        scriptPath
      });
      
      // Handle observer output
      observer.stdout.on('data', (data) => {
        const output = data.toString().trim();
        
        // Look for context data
        const contextDataMatch = output.match(/CONTEXT_DATA:(.+)/);
        if (contextDataMatch) {
          try {
            const contextData = JSON.parse(contextDataMatch[1]);
            this.handleReceivedContext(contextData);
          } catch (error) {
            this.logger.warn('Failed to parse received context data:', error);
          }
        }
      });
      
      // Handle observer errors
      observer.stderr.on('data', (data) => {
        this.logger.warn('Notification observer error:', data.toString());
      });
      
      // Handle observer exit
      observer.on('exit', (code) => {
        this.logger.warn(`Notification observer exited with code ${code}`);
        
        // Remove from observers
        this.notificationObservers.delete('main');
        
        // Restart observer if still initialized
        if (this.isInitialized) {
          this.logger.info('Restarting notification observer');
          this.initializeNotificationObservers().catch((error) => {
            this.logger.error('Failed to restart notification observer:', error);
          });
        }
      });
      
      this.logger.info('Notification observers initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize notification observers:', error);
      this.debugData.errors.push({
        timestamp: Date.now(),
        operation: 'initializeNotificationObservers',
        error: error.message,
        stack: error.stack
      });
      
      throw error;
    }
  }
  
  /**
   * Removes notification observers.
   * 
   * @private
   * @returns {Promise<void>}
   */
  async removeNotificationObservers() {
    try {
      this.logger.info('Removing notification observers');
      
      // Kill all observer processes
      for (const [id, observer] of this.notificationObservers.entries()) {
        try {
          if (observer.process) {
            observer.process.kill();
          }
        } catch (error) {
          this.logger.warn(`Failed to kill observer ${id}:`, error);
        }
      }
      
      // Clear observers
      this.notificationObservers.clear();
      
      this.logger.info('Notification observers removed successfully');
    } catch (error) {
      this.logger.error('Failed to remove notification observers:', error);
      this.debugData.errors.push({
        timestamp: Date.now(),
        operation: 'removeNotificationObservers',
        error: error.message,
        stack: error.stack
      });
      
      throw error;
    }
  }
  
  /**
   * Initializes the context broadcast server.
   * 
   * @private
   * @returns {Promise<void>}
   */
  async initializeContextBroadcastServer() {
    try {
      this.logger.info('Initializing context broadcast server');
      
      // Create Swift script for context broadcast server
      const serverScript = `
#!/usr/bin/swift

import Foundation

// Function to post a notification with context data
func broadcastContext(contextData: String) {
    let notificationCenter = DistributedNotificationCenter.default()
    let userInfo = ["contextData": contextData]
    
    notificationCenter.postNotificationName(
        NSNotification.Name("com.aideon.mcp.context"),
        object: nil,
        userInfo: userInfo,
        deliverImmediately: true
    )
    
    print("BROADCAST_SUCCESS")
}

// Read from stdin for commands
while let line = readLine() {
    if line.hasPrefix("BROADCAST:") {
        let contextData = String(line.dropFirst(10))
        broadcastContext(contextData: contextData)
    }
}
      `;
      
      // Write script to file
      const scriptPath = path.join(this.config.storageLocation, 'broadcaster.swift');
      await fs.writeFile(scriptPath, serverScript);
      
      // Make script executable
      await fs.chmod(scriptPath, 0o755);
      
      // Start server process
      const server = spawn(scriptPath, [], {
        stdio: ['pipe', 'pipe', 'pipe']
      });
      
      // Store server process
      this.contextBroadcastServer = {
        process: server,
        scriptPath
      };
      
      // Handle server output
      server.stdout.on('data', (data) => {
        const output = data.toString().trim();
        
        if (output === 'BROADCAST_SUCCESS') {
          this.debugData.metrics.notificationsSent++;
        }
      });
      
      // Handle server errors
      server.stderr.on('data', (data) => {
        this.logger.warn('Context broadcast server error:', data.toString());
      });
      
      // Handle server exit
      server.on('exit', (code) => {
        this.logger.warn(`Context broadcast server exited with code ${code}`);
        
        // Clear server
        this.contextBroadcastServer = null;
        
        // Restart server if still initialized
        if (this.isInitialized) {
          this.logger.info('Restarting context broadcast server');
          this.initializeContextBroadcastServer().catch((error) => {
            this.logger.error('Failed to restart context broadcast server:', error);
          });
        }
      });
      
      this.logger.info('Context broadcast server initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize context broadcast server:', error);
      this.debugData.errors.push({
        timestamp: Date.now(),
        operation: 'initializeContextBroadcastServer',
        error: error.message,
        stack: error.stack
      });
      
      throw error;
    }
  }
  
  /**
   * Shuts down the context broadcast server.
   * 
   * @private
   * @returns {Promise<void>}
   */
  async shutdownContextBroadcastServer() {
    try {
      this.logger.info('Shutting down context broadcast server');
      
      // Kill server process
      if (this.contextBroadcastServer && this.contextBroadcastServer.process) {
        this.contextBroadcastServer.process.kill();
      }
      
      // Clear server
      this.contextBroadcastServer = null;
      
      this.logger.info('Context broadcast server shut down successfully');
    } catch (error) {
      this.logger.error('Failed to shut down context broadcast server:', error);
      this.debugData.errors.push({
        timestamp: Date.now(),
        operation: 'shutdownContextBroadcastServer',
        error: error.message,
        stack: error.stack
      });
      
      throw error;
    }
  }
  
  /**
   * Initializes context synchronization.
   * 
   * @private
   * @returns {Promise<void>}
   */
  async initializeContextSync() {
    try {
      this.logger.info('Initializing context synchronization');
      
      // Set up context sync interval
      this.contextSyncInterval = setInterval(() => {
        this.syncContexts().catch(error => {
          this.logger.error('Error during context synchronization:', error);
        });
      }, 5000); // Sync every 5 seconds
      
      // Initial sync
      await this.syncContexts();
      
      this.logger.info('Context synchronization initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize context synchronization:', error);
      this.debugData.errors.push({
        timestamp: Date.now(),
        operation: 'initializeContextSync',
        error: error.message,
        stack: error.stack
      });
      
      throw error;
    }
  }
  
  /**
   * Synchronizes contexts between Aideon and macOS applications.
   * 
   * @private
   * @returns {Promise<void>}
   */
  async syncContexts() {
    if (!this.isInitialized) {
      return;
    }
    
    try {
      // Get running applications that might support context sharing
      const apps = await this.getRunningApplications();
      
      // Update registered apps
      await this.updateRegisteredApps(apps);
      
      // Pull contexts from registered apps
      await this.pullContextsFromApps();
      
      // Push contexts to registered apps
      await this.pushContextsToApps();
    } catch (error) {
      this.logger.error('Failed to synchronize contexts:', error);
      this.debugData.errors.push({
        timestamp: Date.now(),
        operation: 'syncContexts',
        error: error.message,
        stack: error.stack
      });
    }
  }
  
  /**
   * Gets a list of running applications.
   * 
   * @private
   * @returns {Promise<Array<Object>>} List of running applications
   */
  async getRunningApplications() {
    try {
      await this.apiLock.acquire();
      
      this.logger.debug('Getting list of running applications');
      
      // Get running applications using AppleScript
      const script = `
        tell application "System Events"
          set appList to {}
          set runningApps to application processes
          
          repeat with appProcess in runningApps
            set appName to name of appProcess
            set appInfo to {name:appName, bundleId:"", path:""}
            
            try
              set appPath to path of appProcess
              set appInfo's path to appPath
            end try
            
            try
              set appBundle to bundle identifier of appProcess
              set appInfo's bundleId to appBundle
            end try
            
            copy appInfo to end of appList
          end repeat
          
          return appList
        end tell
      `;
      
      const result = await this.executeAppleScript(script);
      let apps = [];
      
      try {
        apps = JSON.parse(result);
      } catch (error) {
        // AppleScript result might not be valid JSON, parse manually
        const appRegex = /\{name:"([^"]+)", bundleId:"([^"]*)", path:"([^"]*)"\}/g;
        let match;
        
        while ((match = appRegex.exec(result)) !== null) {
          apps.push({
            name: match[1],
            bundleId: match[2],
            path: match[3]
          });
        }
      }
      
      this.logger.debug(`Found ${apps.length} running applications`);
      
      return apps;
    } catch (error) {
      this.logger.error('Failed to get running applications:', error);
      this.debugData.errors.push({
        timestamp: Date.now(),
        operation: 'getRunningApplications',
        error: error.message,
        stack: error.stack
      });
      
      return [];
    } finally {
      this.apiLock.release();
    }
  }
  
  /**
   * Updates the list of registered applications.
   * 
   * @private
   * @param {Array<Object>} apps - List of running applications
   * @returns {Promise<void>}
   */
  async updateRegisteredApps(apps) {
    try {
      this.logger.debug('Updating registered applications');
      
      // Filter by allowed apps
      const allowedApps = this.config.allowedApps;
      const appsToRegister = allowedApps.includes('*') 
        ? apps 
        : apps.filter(app => {
            return allowedApps.some(pattern => {
              if (pattern.includes('*')) {
                const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
                return regex.test(app.name) || regex.test(app.bundleId);
              } else {
                return app.name === pattern || app.bundleId === pattern;
              }
            });
          });
      
      // Update registered apps
      for (const app of appsToRegister) {
        const appId = app.bundleId || app.name;
        
        if (!this.registeredApps.has(appId)) {
          this.registeredApps.set(appId, {
            name: app.name,
            bundleId: app.bundleId,
            path: app.path,
            lastSync: 0
          });
          
          this.logger.debug(`Registered app: ${app.name} (${appId})`);
        }
      }
      
      // Remove apps that are no longer running
      const runningAppIds = new Set(appsToRegister.map(app => app.bundleId || app.name));
      
      for (const [appId, app] of this.registeredApps.entries()) {
        if (!runningAppIds.has(appId)) {
          this.registeredApps.delete(appId);
          this.logger.debug(`Unregistered app: ${app.name} (${appId})`);
        }
      }
      
      this.logger.debug(`Updated registered applications: ${this.registeredApps.size} apps`);
    } catch (error) {
      this.logger.error('Failed to update registered applications:', error);
      this.debugData.errors.push({
        timestamp: Date.now(),
        operation: 'updateRegisteredApps',
        error: error.message,
        stack: error.stack
      });
      
      throw error;
    }
  }
  
  /**
   * Pulls contexts from registered applications.
   * 
   * @private
   * @returns {Promise<void>}
   */
  async pullContextsFromApps() {
    if (!this.contextManager) {
      return;
    }
    
    try {
      this.logger.debug('Pulling contexts from registered applications');
      
      // Nothing to do here as we rely on the notification system
      // Applications will send contexts via distributed notifications
      
      this.logger.debug('Pulled contexts from registered applications');
    } catch (error) {
      this.logger.error('Failed to pull contexts from registered applications:', error);
      this.debugData.errors.push({
        timestamp: Date.now(),
        operation: 'pullContextsFromApps',
        error: error.message,
        stack: error.stack
      });
      
      throw error;
    }
  }
  
  /**
   * Pushes contexts to registered applications.
   * 
   * @private
   * @returns {Promise<void>}
   */
  async pushContextsToApps() {
    if (!this.contextManager) {
      return;
    }
    
    try {
      this.logger.debug('Pushing contexts to registered applications');
      
      // Get contexts from Aideon
      const contexts = await this.contextManager.queryContexts({
        minConfidence: 0.7, // Only push high-confidence contexts
        sortBy: 'timestamp',
        sortOrder: 'desc',
        limit: 20 // Limit to 20 most recent contexts
      });
      
      // Push each context to registered apps
      for (const context of contexts) {
        try {
          await this.broadcastContext(context);
        } catch (error) {
          this.logger.warn(`Failed to broadcast context ${context.id}:`, error);
        }
      }
      
      this.logger.debug(`Pushed ${contexts.length} contexts to registered applications`);
    } catch (error) {
      this.logger.error('Failed to push contexts to registered applications:', error);
      this.debugData.errors.push({
        timestamp: Date.now(),
        operation: 'pushContextsToApps',
        error: error.message,
        stack: error.stack
      });
      
      throw error;
    }
  }
  
  /**
   * Broadcasts a context to all registered applications.
   * 
   * @private
   * @param {Object} context - Context to broadcast
   * @returns {Promise<void>}
   */
  async broadcastContext(context) {
    try {
      // Skip contexts from macOS to avoid loops
      if (context.source === 'macos-mcp') {
        return;
      }
      
      // Convert Aideon context to macOS context format
      const macosContext = this.convertAideonContextToMacOSContext(context);
      
      // Broadcast context using the context broadcast server
      if (this.contextBroadcastServer && this.contextBroadcastServer.process) {
        const contextData = JSON.stringify(macosContext);
        this.contextBroadcastServer.process.stdin.write(`BROADCAST:${contextData}\n`);
      }
    } catch (error) {
      this.logger.error(`Failed to broadcast context ${context.id}:`, error);
      this.debugData.errors.push({
        timestamp: Date.now(),
        operation: 'broadcastContext',
        error: error.message,
        stack: error.stack,
        contextId: context.id
      });
      
      throw error;
    }
  }
  
  /**
   * Handles a context received from a macOS application.
   * 
   * @private
   * @param {Object} macosContext - Context received from macOS
   * @returns {Promise<void>}
   */
  async handleReceivedContext(macosContext) {
    if (!this.contextManager) {
      return;
    }
    
    try {
      // Convert macOS context to Aideon context format
      const context = this.convertMacOSContextToAideonContext(macosContext);
      
      // Add or update context in Aideon
      const existingContext = await this.contextManager.getContext(context.id);
      
      if (existingContext) {
        await this.contextManager.updateContext(context.id, context, { merge: true });
      } else {
        await this.contextManager.addContext(context);
      }
      
      this.debugData.metrics.notificationsReceived++;
    } catch (error) {
      this.logger.warn('Failed to handle received context:', error);
      this.debugData.errors.push({
        timestamp: Date.now(),
        operation: 'handleReceivedContext',
        error: error.message,
        stack: error.stack,
        macosContext
      });
    }
  }
  
  /**
   * Converts a macOS context to Aideon context format.
   * 
   * @private
   * @param {Object} macosContext - macOS context
   * @returns {Object} Aideon context
   */
  convertMacOSContextToAideonContext(macosContext) {
    // Generate a consistent ID based on macOS context
    const id = this.generateContextId(macosContext);
    
    // Map macOS context to Aideon context format
    return {
      id,
      source: 'macos-mcp',
      type: macosContext.type || 'unknown',
      data: macosContext.data || {},
      timestamp: macosContext.timestamp || Date.now(),
      expiryTimestamp: macosContext.expiryTimestamp,
      priority: macosContext.priority || 5,
      confidence: macosContext.confidence || 0.8,
      tags: macosContext.tags || [],
      metadata: {
        sourceAppId: macosContext.sourceAppId || 'unknown',
        sourceAppName: macosContext.sourceAppName || 'unknown',
        contextId: macosContext.contextId || id,
        ...macosContext.metadata
      }
    };
  }
  
  /**
   * Converts an Aideon context to macOS context format.
   * 
   * @private
   * @param {Object} context - Aideon context
   * @returns {Object} macOS context
   */
  convertAideonContextToMacOSContext(context) {
    // Map Aideon context to macOS context format
    return {
      contextId: context.id,
      type: context.type,
      data: context.data,
      timestamp: context.timestamp,
      expiryTimestamp: context.expiryTimestamp,
      priority: context.priority,
      confidence: context.confidence,
      tags: context.tags || [],
      sourceAppId: 'aideon-ai-desktop-agent',
      sourceAppName: 'Aideon AI Desktop Agent',
      metadata: context.metadata || {}
    };
  }
  
  /**
   * Executes an AppleScript.
   * 
   * @private
   * @param {string} script - AppleScript to execute
   * @returns {Promise<string>} Script output
   */
  async executeAppleScript(script) {
    return new Promise((resolve, reject) => {
      // Create temporary script file
      const tempDir = os.tmpdir();
      const tempFile = path.join(tempDir, `aideon-mcp-${Date.now()}.scpt`);
      
      fs.writeFile(tempFile, script)
        .then(() => {
          // Execute AppleScript
          exec(`osascript "${tempFile}"`, (error, stdout, stderr) => {
            // Clean up temporary file
            fs.unlink(tempFile).catch(() => {});
            
            if (error) {
              this.debugData.metrics.appleScriptErrors++;
              reject(new Error(`AppleScript failed: ${stderr || error.message}`));
            } else {
              this.debugData.metrics.appleScriptExecutions++;
              resolve(stdout.trim());
            }
          });
        })
        .catch(reject);
    });
  }
  
  /**
   * Generates a consistent context ID based on macOS context.
   * 
   * @private
   * @param {Object} macosContext - macOS context
   * @returns {string} Context ID
   */
  generateContextId(macosContext) {
    // Use existing context ID if available
    if (macosContext.contextId) {
      return `macos-${macosContext.contextId}`;
    }
    
    // Generate ID based on context properties
    const idBase = `${macosContext.sourceAppId || 'unknown'}-${macosContext.type || 'unknown'}-${macosContext.timestamp || Date.now()}`;
    return `macos-${Buffer.from(idBase).toString('base64').replace(/[+/=]/g, '')}`;
  }
  
  /**
   * Handles a new context added to the Aideon context manager.
   * 
   * @param {Object} context - Added context
   */
  onContextAdded(context) {
    if (!this.isInitialized) {
      return;
    }
    
    // Skip contexts from macOS MCP to avoid loops
    if (context.source === 'macos-mcp') {
      return;
    }
    
    // Broadcast context to registered apps
    this.broadcastContext(context).catch(error => {
      this.logger.warn(`Failed to broadcast new context ${context.id}:`, error);
    });
  }
  
  /**
   * Handles a context updated in the Aideon context manager.
   * 
   * @param {Object} context - Updated context
   */
  onContextUpdated(context) {
    if (!this.isInitialized) {
      return;
    }
    
    // Skip contexts from macOS MCP to avoid loops
    if (context.source === 'macos-mcp') {
      return;
    }
    
    // Broadcast updated context to registered apps
    this.broadcastContext(context).catch(error => {
      this.logger.warn(`Failed to broadcast updated context ${context.id}:`, error);
    });
  }
  
  /**
   * Handles a context removed from the Aideon context manager.
   * 
   * @param {Object} context - Removed context
   */
  onContextRemoved(context) {
    // Nothing to do here as contexts will expire naturally
  }
  
  /**
   * Gets the current status of the macOS MCP Adapter.
   * 
   * @returns {Object} Current status
   */
  getStatus() {
    return {
      isInitialized: this.isInitialized,
      observerCount: this.notificationObservers.size,
      registeredAppCount: this.registeredApps.size,
      hasBroadcastServer: !!this.contextBroadcastServer,
      metrics: { ...this.debugData.metrics }
    };
  }
}

module.exports = { MacOSMCPAdapter };
