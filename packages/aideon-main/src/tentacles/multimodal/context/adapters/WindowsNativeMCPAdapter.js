/**
 * @fileoverview Windows-native MCP Adapter for the Aideon AI Desktop Agent.
 * 
 * This module implements a Windows-specific adapter for the Model Context Protocol (MCP)
 * that leverages Microsoft's native MCP support on Windows. It provides deep integration
 * with the Windows operating system for enhanced context management capabilities.
 * 
 * The adapter communicates with Microsoft's MCP APIs to share and retrieve context
 * information, enabling seamless context sharing between Aideon and other Windows
 * applications that support MCP.
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
 * @typedef {Object} WindowsMCPConfig
 * @property {boolean} [useNativeAPI] - Whether to use the native Windows MCP API
 * @property {boolean} [enableSystemWideContext] - Whether to enable system-wide context sharing
 * @property {boolean} [enableAppSpecificContext] - Whether to enable app-specific context sharing
 * @property {string[]} [allowedApps] - List of applications allowed to access Aideon's context
 * @property {string[]} [allowedContextTypes] - List of context types allowed to be shared
 * @property {boolean} [enableNotifications] - Whether to enable Windows notifications for context events
 * @property {boolean} [enableDebugMode] - Whether to enable debug mode
 */

/**
 * Windows-native MCP Adapter for the Aideon AI Desktop Agent.
 * 
 * This class provides Windows-specific implementation for the Model Context Protocol,
 * leveraging Microsoft's native MCP support on Windows.
 */
class WindowsNativeMCPAdapter extends EventEmitter {
  /**
   * Creates a new Windows-native MCP Adapter.
   * 
   * @param {Object} options - Configuration options
   * @param {Object} [options.logger] - Logger instance
   * @param {Object} [options.contextManager] - MCP Context Manager instance
   * @param {WindowsMCPConfig} [options.config] - Windows-specific MCP configuration
   */
  constructor(options = {}) {
    super();
    
    this.logger = options.logger || console;
    this.contextManager = options.contextManager;
    
    // Default configuration
    this.config = {
      useNativeAPI: true,
      enableSystemWideContext: true,
      enableAppSpecificContext: true,
      allowedApps: ['*'],
      allowedContextTypes: ['*'],
      enableNotifications: true,
      enableDebugMode: false,
      ...options.config
    };
    
    // Initialize state
    this.isInitialized = false;
    this.isNativeAPIAvailable = false;
    this.nativeClient = null;
    this.contextSubscriptions = new Map();
    this.contextSyncInterval = null;
    
    // Initialize locks for thread safety
    this.apiLock = new EnhancedAsyncLock();
    
    // Debug data
    this.debugData = {
      operations: [],
      errors: [],
      metrics: {
        nativeContextsReceived: 0,
        nativeContextsSent: 0,
        apiCallsMade: 0,
        apiErrors: 0
      }
    };
    
    this.logger.info('Windows-native MCP Adapter created');
  }
  
  /**
   * Initializes the Windows-native MCP Adapter.
   * 
   * @returns {Promise<boolean>} True if initialization was successful
   */
  async initialize() {
    if (this.isInitialized) {
      this.logger.warn('Windows-native MCP Adapter already initialized');
      return true;
    }
    
    try {
      this.logger.info('Initializing Windows-native MCP Adapter');
      
      // Verify we're running on Windows
      if (os.platform() !== 'win32') {
        throw new Error('Windows-native MCP Adapter can only be used on Windows');
      }
      
      // Check for native MCP API availability
      if (this.config.useNativeAPI) {
        this.isNativeAPIAvailable = await this.checkNativeAPIAvailability();
        
        if (this.isNativeAPIAvailable) {
          this.logger.info('Microsoft native MCP API is available');
          await this.initializeNativeClient();
        } else {
          this.logger.warn('Microsoft native MCP API is not available, falling back to emulation mode');
        }
      }
      
      // Initialize context synchronization
      await this.initializeContextSync();
      
      this.isInitialized = true;
      this.emit('initialized');
      this.logger.info('Windows-native MCP Adapter initialized successfully');
      
      return true;
    } catch (error) {
      this.logger.error('Failed to initialize Windows-native MCP Adapter:', error);
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
   * Shuts down the Windows-native MCP Adapter.
   * 
   * @returns {Promise<boolean>} True if shutdown was successful
   */
  async shutdown() {
    if (!this.isInitialized) {
      this.logger.warn('Windows-native MCP Adapter not initialized');
      return true;
    }
    
    try {
      this.logger.info('Shutting down Windows-native MCP Adapter');
      
      // Stop context synchronization
      if (this.contextSyncInterval) {
        clearInterval(this.contextSyncInterval);
        this.contextSyncInterval = null;
      }
      
      // Unsubscribe from all context subscriptions
      for (const [appId, subscription] of this.contextSubscriptions.entries()) {
        try {
          await this.unsubscribeFromAppContext(appId);
        } catch (error) {
          this.logger.warn(`Failed to unsubscribe from app ${appId}:`, error);
        }
      }
      
      // Shutdown native client if available
      if (this.nativeClient) {
        await this.shutdownNativeClient();
      }
      
      this.isInitialized = false;
      this.emit('shutdown');
      this.logger.info('Windows-native MCP Adapter shut down successfully');
      
      return true;
    } catch (error) {
      this.logger.error('Failed to shut down Windows-native MCP Adapter:', error);
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
   * Checks if the Microsoft native MCP API is available.
   * 
   * @private
   * @returns {Promise<boolean>} True if the API is available
   */
  async checkNativeAPIAvailability() {
    try {
      // Check for Windows 11 or newer (where MCP is supported)
      const windowsVersion = os.release().split('.');
      const majorVersion = parseInt(windowsVersion[0], 10);
      const minorVersion = parseInt(windowsVersion[1], 10);
      
      // Windows 11 is 10.0.22000 or higher
      if (majorVersion < 10 || (majorVersion === 10 && minorVersion === 0 && parseInt(windowsVersion[2], 10) < 22000)) {
        this.logger.warn('Microsoft native MCP API requires Windows 11 or newer');
        return false;
      }
      
      // Check for MCP API availability using PowerShell
      return new Promise((resolve) => {
        exec('powershell -Command "if (Get-Command -Name Get-MCPContext -ErrorAction SilentlyContinue) { exit 0 } else { exit 1 }"', (error) => {
          if (error) {
            this.logger.warn('Microsoft native MCP API not found');
            resolve(false);
          } else {
            resolve(true);
          }
        });
      });
    } catch (error) {
      this.logger.warn('Failed to check for Microsoft native MCP API availability:', error);
      return false;
    }
  }
  
  /**
   * Initializes the native MCP client.
   * 
   * @private
   * @returns {Promise<void>}
   */
  async initializeNativeClient() {
    try {
      this.logger.info('Initializing native MCP client');
      
      // Register Aideon with the Windows MCP system
      await this.registerWithMCPSystem();
      
      // Create native client
      this.nativeClient = {
        isConnected: true,
        appId: 'aideon-ai-desktop-agent',
        sessionId: this.generateSessionId()
      };
      
      // Subscribe to system-wide context if enabled
      if (this.config.enableSystemWideContext) {
        await this.subscribeToSystemWideContext();
      }
      
      // Subscribe to app-specific context if enabled
      if (this.config.enableAppSpecificContext) {
        await this.subscribeToAllowedApps();
      }
      
      this.logger.info('Native MCP client initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize native MCP client:', error);
      this.debugData.errors.push({
        timestamp: Date.now(),
        operation: 'initializeNativeClient',
        error: error.message,
        stack: error.stack
      });
      
      this.isNativeAPIAvailable = false;
      throw error;
    }
  }
  
  /**
   * Shuts down the native MCP client.
   * 
   * @private
   * @returns {Promise<void>}
   */
  async shutdownNativeClient() {
    try {
      this.logger.info('Shutting down native MCP client');
      
      // Unregister Aideon from the Windows MCP system
      await this.unregisterFromMCPSystem();
      
      this.nativeClient = null;
      
      this.logger.info('Native MCP client shut down successfully');
    } catch (error) {
      this.logger.error('Failed to shut down native MCP client:', error);
      this.debugData.errors.push({
        timestamp: Date.now(),
        operation: 'shutdownNativeClient',
        error: error.message,
        stack: error.stack
      });
      
      throw error;
    }
  }
  
  /**
   * Registers Aideon with the Windows MCP system.
   * 
   * @private
   * @returns {Promise<void>}
   */
  async registerWithMCPSystem() {
    try {
      await this.apiLock.acquire();
      
      this.logger.info('Registering Aideon with Windows MCP system');
      
      // Prepare registration data
      const registrationData = {
        appId: 'aideon-ai-desktop-agent',
        appName: 'Aideon AI Desktop Agent',
        appVersion: '1.0.0',
        capabilities: [
          'context.provide',
          'context.consume',
          'context.sync'
        ]
      };
      
      // Register with MCP system using PowerShell
      const registrationScript = `
        $registrationData = '${JSON.stringify(registrationData)}'
        Register-MCPApplication -InputObject $registrationData
      `;
      
      await this.executePowerShellScript(registrationScript);
      
      this.logger.info('Aideon registered with Windows MCP system successfully');
      this.debugData.metrics.apiCallsMade++;
    } catch (error) {
      this.logger.error('Failed to register with Windows MCP system:', error);
      this.debugData.metrics.apiErrors++;
      this.debugData.errors.push({
        timestamp: Date.now(),
        operation: 'registerWithMCPSystem',
        error: error.message,
        stack: error.stack
      });
      
      throw error;
    } finally {
      this.apiLock.release();
    }
  }
  
  /**
   * Unregisters Aideon from the Windows MCP system.
   * 
   * @private
   * @returns {Promise<void>}
   */
  async unregisterFromMCPSystem() {
    try {
      await this.apiLock.acquire();
      
      this.logger.info('Unregistering Aideon from Windows MCP system');
      
      // Unregister from MCP system using PowerShell
      const unregistrationScript = `
        Unregister-MCPApplication -AppId 'aideon-ai-desktop-agent'
      `;
      
      await this.executePowerShellScript(unregistrationScript);
      
      this.logger.info('Aideon unregistered from Windows MCP system successfully');
      this.debugData.metrics.apiCallsMade++;
    } catch (error) {
      this.logger.error('Failed to unregister from Windows MCP system:', error);
      this.debugData.metrics.apiErrors++;
      this.debugData.errors.push({
        timestamp: Date.now(),
        operation: 'unregisterFromMCPSystem',
        error: error.message,
        stack: error.stack
      });
      
      throw error;
    } finally {
      this.apiLock.release();
    }
  }
  
  /**
   * Subscribes to system-wide context.
   * 
   * @private
   * @returns {Promise<void>}
   */
  async subscribeToSystemWideContext() {
    try {
      await this.apiLock.acquire();
      
      this.logger.info('Subscribing to system-wide context');
      
      // Subscribe to system-wide context using PowerShell
      const subscriptionScript = `
        Register-MCPContextSubscription -AppId 'aideon-ai-desktop-agent' -Scope 'System' -ContextTypes '*'
      `;
      
      await this.executePowerShellScript(subscriptionScript);
      
      // Set up event listener for system-wide context
      const listenerScript = `
        $eventId = Register-MCPContextEventListener -AppId 'aideon-ai-desktop-agent' -Scope 'System'
        Write-Output $eventId
      `;
      
      const eventId = await this.executePowerShellScript(listenerScript);
      
      // Store subscription
      this.contextSubscriptions.set('system', {
        eventId: eventId.trim(),
        scope: 'System',
        active: true
      });
      
      this.logger.info('Subscribed to system-wide context successfully');
      this.debugData.metrics.apiCallsMade += 2;
    } catch (error) {
      this.logger.error('Failed to subscribe to system-wide context:', error);
      this.debugData.metrics.apiErrors++;
      this.debugData.errors.push({
        timestamp: Date.now(),
        operation: 'subscribeToSystemWideContext',
        error: error.message,
        stack: error.stack
      });
      
      throw error;
    } finally {
      this.apiLock.release();
    }
  }
  
  /**
   * Subscribes to context from allowed applications.
   * 
   * @private
   * @returns {Promise<void>}
   */
  async subscribeToAllowedApps() {
    try {
      this.logger.info('Subscribing to allowed applications');
      
      // Get list of running applications that support MCP
      const mcpApps = await this.getMCPSupportedApps();
      
      // Filter by allowed apps
      const allowedApps = this.config.allowedApps;
      const appsToSubscribe = allowedApps.includes('*') 
        ? mcpApps 
        : mcpApps.filter(app => allowedApps.includes(app.appId));
      
      // Subscribe to each app
      for (const app of appsToSubscribe) {
        try {
          await this.subscribeToAppContext(app.appId);
        } catch (error) {
          this.logger.warn(`Failed to subscribe to app ${app.appId}:`, error);
        }
      }
      
      this.logger.info(`Subscribed to ${appsToSubscribe.length} applications`);
    } catch (error) {
      this.logger.error('Failed to subscribe to allowed applications:', error);
      this.debugData.errors.push({
        timestamp: Date.now(),
        operation: 'subscribeToAllowedApps',
        error: error.message,
        stack: error.stack
      });
      
      throw error;
    }
  }
  
  /**
   * Subscribes to context from a specific application.
   * 
   * @private
   * @param {string} appId - Application ID
   * @returns {Promise<void>}
   */
  async subscribeToAppContext(appId) {
    try {
      await this.apiLock.acquire();
      
      this.logger.info(`Subscribing to context from app ${appId}`);
      
      // Subscribe to app context using PowerShell
      const subscriptionScript = `
        Register-MCPContextSubscription -AppId 'aideon-ai-desktop-agent' -TargetAppId '${appId}' -ContextTypes '*'
      `;
      
      await this.executePowerShellScript(subscriptionScript);
      
      // Set up event listener for app context
      const listenerScript = `
        $eventId = Register-MCPContextEventListener -AppId 'aideon-ai-desktop-agent' -TargetAppId '${appId}'
        Write-Output $eventId
      `;
      
      const eventId = await this.executePowerShellScript(listenerScript);
      
      // Store subscription
      this.contextSubscriptions.set(appId, {
        eventId: eventId.trim(),
        targetAppId: appId,
        active: true
      });
      
      this.logger.info(`Subscribed to context from app ${appId} successfully`);
      this.debugData.metrics.apiCallsMade += 2;
    } catch (error) {
      this.logger.error(`Failed to subscribe to context from app ${appId}:`, error);
      this.debugData.metrics.apiErrors++;
      this.debugData.errors.push({
        timestamp: Date.now(),
        operation: 'subscribeToAppContext',
        error: error.message,
        stack: error.stack,
        appId
      });
      
      throw error;
    } finally {
      this.apiLock.release();
    }
  }
  
  /**
   * Unsubscribes from context from a specific application.
   * 
   * @private
   * @param {string} appId - Application ID
   * @returns {Promise<void>}
   */
  async unsubscribeFromAppContext(appId) {
    try {
      await this.apiLock.acquire();
      
      this.logger.info(`Unsubscribing from context from app ${appId}`);
      
      // Get subscription
      const subscription = this.contextSubscriptions.get(appId);
      if (!subscription) {
        this.logger.warn(`No subscription found for app ${appId}`);
        return;
      }
      
      // Unregister event listener
      const unregisterListenerScript = `
        Unregister-MCPContextEventListener -EventId '${subscription.eventId}'
      `;
      
      await this.executePowerShellScript(unregisterListenerScript);
      
      // Unsubscribe from app context
      const unsubscriptionScript = `
        Unregister-MCPContextSubscription -AppId 'aideon-ai-desktop-agent' -TargetAppId '${appId}'
      `;
      
      await this.executePowerShellScript(unsubscriptionScript);
      
      // Remove subscription
      this.contextSubscriptions.delete(appId);
      
      this.logger.info(`Unsubscribed from context from app ${appId} successfully`);
      this.debugData.metrics.apiCallsMade += 2;
    } catch (error) {
      this.logger.error(`Failed to unsubscribe from context from app ${appId}:`, error);
      this.debugData.metrics.apiErrors++;
      this.debugData.errors.push({
        timestamp: Date.now(),
        operation: 'unsubscribeFromAppContext',
        error: error.message,
        stack: error.stack,
        appId
      });
      
      throw error;
    } finally {
      this.apiLock.release();
    }
  }
  
  /**
   * Gets a list of running applications that support MCP.
   * 
   * @private
   * @returns {Promise<Array<Object>>} List of MCP-supported applications
   */
  async getMCPSupportedApps() {
    try {
      await this.apiLock.acquire();
      
      this.logger.info('Getting list of MCP-supported applications');
      
      // Get MCP-supported apps using PowerShell
      const script = `
        $apps = Get-MCPApplication
        ConvertTo-Json -InputObject $apps -Compress
      `;
      
      const result = await this.executePowerShellScript(script);
      const apps = JSON.parse(result);
      
      this.logger.info(`Found ${apps.length} MCP-supported applications`);
      this.debugData.metrics.apiCallsMade++;
      
      return apps;
    } catch (error) {
      this.logger.error('Failed to get MCP-supported applications:', error);
      this.debugData.metrics.apiErrors++;
      this.debugData.errors.push({
        timestamp: Date.now(),
        operation: 'getMCPSupportedApps',
        error: error.message,
        stack: error.stack
      });
      
      return [];
    } finally {
      this.apiLock.release();
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
   * Synchronizes contexts between Aideon and the Windows MCP system.
   * 
   * @private
   * @returns {Promise<void>}
   */
  async syncContexts() {
    if (!this.isInitialized || !this.isNativeAPIAvailable) {
      return;
    }
    
    try {
      // Pull contexts from Windows MCP system
      await this.pullContextsFromMCP();
      
      // Push contexts to Windows MCP system
      await this.pushContextsToMCP();
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
   * Pulls contexts from the Windows MCP system.
   * 
   * @private
   * @returns {Promise<void>}
   */
  async pullContextsFromMCP() {
    if (!this.contextManager) {
      return;
    }
    
    try {
      await this.apiLock.acquire();
      
      this.logger.debug('Pulling contexts from Windows MCP system');
      
      // Get contexts from MCP system using PowerShell
      const script = `
        $contexts = Get-MCPContext -AppId 'aideon-ai-desktop-agent'
        ConvertTo-Json -InputObject $contexts -Depth 10 -Compress
      `;
      
      const result = await this.executePowerShellScript(script);
      let contexts = [];
      
      try {
        contexts = JSON.parse(result);
        if (!Array.isArray(contexts)) {
          contexts = [contexts];
        }
      } catch (error) {
        this.logger.warn('Failed to parse contexts from MCP system:', error);
        return;
      }
      
      // Process each context
      for (const mcpContext of contexts) {
        try {
          // Convert MCP context to Aideon context format
          const context = this.convertMCPContextToAideonContext(mcpContext);
          
          // Add or update context in Aideon
          const existingContext = await this.contextManager.getContext(context.id);
          
          if (existingContext) {
            await this.contextManager.updateContext(context.id, context, { merge: true });
          } else {
            await this.contextManager.addContext(context);
          }
          
          this.debugData.metrics.nativeContextsReceived++;
        } catch (error) {
          this.logger.warn('Failed to process context from MCP system:', error);
        }
      }
      
      this.logger.debug(`Pulled ${contexts.length} contexts from Windows MCP system`);
      this.debugData.metrics.apiCallsMade++;
    } catch (error) {
      this.logger.error('Failed to pull contexts from Windows MCP system:', error);
      this.debugData.metrics.apiErrors++;
      this.debugData.errors.push({
        timestamp: Date.now(),
        operation: 'pullContextsFromMCP',
        error: error.message,
        stack: error.stack
      });
      
      throw error;
    } finally {
      this.apiLock.release();
    }
  }
  
  /**
   * Pushes contexts to the Windows MCP system.
   * 
   * @private
   * @returns {Promise<void>}
   */
  async pushContextsToMCP() {
    if (!this.contextManager) {
      return;
    }
    
    try {
      this.logger.debug('Pushing contexts to Windows MCP system');
      
      // Get contexts from Aideon
      const contexts = await this.contextManager.queryContexts({
        minConfidence: 0.7, // Only push high-confidence contexts
        sortBy: 'timestamp',
        sortOrder: 'desc',
        limit: 20 // Limit to 20 most recent contexts
      });
      
      // Push each context to MCP system
      for (const context of contexts) {
        try {
          await this.pushContextToMCP(context);
        } catch (error) {
          this.logger.warn(`Failed to push context ${context.id} to MCP system:`, error);
        }
      }
      
      this.logger.debug(`Pushed ${contexts.length} contexts to Windows MCP system`);
    } catch (error) {
      this.logger.error('Failed to push contexts to Windows MCP system:', error);
      this.debugData.errors.push({
        timestamp: Date.now(),
        operation: 'pushContextsToMCP',
        error: error.message,
        stack: error.stack
      });
      
      throw error;
    }
  }
  
  /**
   * Pushes a single context to the Windows MCP system.
   * 
   * @private
   * @param {Object} context - Context to push
   * @returns {Promise<void>}
   */
  async pushContextToMCP(context) {
    try {
      await this.apiLock.acquire();
      
      // Convert Aideon context to MCP context format
      const mcpContext = this.convertAideonContextToMCPContext(context);
      
      // Push context to MCP system using PowerShell
      const script = `
        $contextData = '${JSON.stringify(mcpContext)}'
        $context = ConvertFrom-Json -InputObject $contextData
        Set-MCPContext -AppId 'aideon-ai-desktop-agent' -Context $context
      `;
      
      await this.executePowerShellScript(script);
      
      this.debugData.metrics.nativeContextsSent++;
      this.debugData.metrics.apiCallsMade++;
    } catch (error) {
      this.logger.error(`Failed to push context ${context.id} to MCP system:`, error);
      this.debugData.metrics.apiErrors++;
      this.debugData.errors.push({
        timestamp: Date.now(),
        operation: 'pushContextToMCP',
        error: error.message,
        stack: error.stack,
        contextId: context.id
      });
      
      throw error;
    } finally {
      this.apiLock.release();
    }
  }
  
  /**
   * Converts an MCP context to Aideon context format.
   * 
   * @private
   * @param {Object} mcpContext - MCP context
   * @returns {Object} Aideon context
   */
  convertMCPContextToAideonContext(mcpContext) {
    // Generate a consistent ID based on MCP context
    const id = this.generateContextId(mcpContext);
    
    // Map MCP context to Aideon context format
    return {
      id,
      source: 'windows-mcp',
      type: mcpContext.Type || 'unknown',
      data: mcpContext.Data || {},
      timestamp: new Date(mcpContext.Timestamp || Date.now()).getTime(),
      expiryTimestamp: mcpContext.ExpiryTimestamp 
        ? new Date(mcpContext.ExpiryTimestamp).getTime() 
        : undefined,
      priority: mcpContext.Priority || 5,
      confidence: mcpContext.Confidence || 0.8,
      tags: mcpContext.Tags || [],
      metadata: {
        sourceAppId: mcpContext.SourceAppId || 'unknown',
        sourceAppName: mcpContext.SourceAppName || 'unknown',
        contextId: mcpContext.ContextId || id,
        scope: mcpContext.Scope || 'App',
        ...mcpContext.Metadata
      }
    };
  }
  
  /**
   * Converts an Aideon context to MCP context format.
   * 
   * @private
   * @param {Object} context - Aideon context
   * @returns {Object} MCP context
   */
  convertAideonContextToMCPContext(context) {
    // Map Aideon context to MCP context format
    return {
      ContextId: context.id,
      Type: context.type,
      Data: context.data,
      Timestamp: new Date(context.timestamp).toISOString(),
      ExpiryTimestamp: context.expiryTimestamp 
        ? new Date(context.expiryTimestamp).toISOString() 
        : undefined,
      Priority: context.priority,
      Confidence: context.confidence,
      Tags: context.tags || [],
      SourceAppId: 'aideon-ai-desktop-agent',
      SourceAppName: 'Aideon AI Desktop Agent',
      Scope: 'App',
      Metadata: context.metadata || {}
    };
  }
  
  /**
   * Executes a PowerShell script.
   * 
   * @private
   * @param {string} script - PowerShell script to execute
   * @returns {Promise<string>} Script output
   */
  async executePowerShellScript(script) {
    return new Promise((resolve, reject) => {
      // Create temporary script file
      const tempDir = os.tmpdir();
      const tempFile = path.join(tempDir, `aideon-mcp-${Date.now()}.ps1`);
      
      fs.writeFile(tempFile, script)
        .then(() => {
          // Execute PowerShell script
          const ps = spawn('powershell', [
            '-ExecutionPolicy', 'Bypass',
            '-File', tempFile
          ]);
          
          let stdout = '';
          let stderr = '';
          
          ps.stdout.on('data', (data) => {
            stdout += data.toString();
          });
          
          ps.stderr.on('data', (data) => {
            stderr += data.toString();
          });
          
          ps.on('close', (code) => {
            // Clean up temporary file
            fs.unlink(tempFile).catch(() => {});
            
            if (code === 0) {
              resolve(stdout.trim());
            } else {
              reject(new Error(`PowerShell script failed with code ${code}: ${stderr}`));
            }
          });
          
          ps.on('error', (error) => {
            // Clean up temporary file
            fs.unlink(tempFile).catch(() => {});
            
            reject(error);
          });
        })
        .catch(reject);
    });
  }
  
  /**
   * Generates a unique session ID.
   * 
   * @private
   * @returns {string} Session ID
   */
  generateSessionId() {
    return `aideon-session-${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
  }
  
  /**
   * Generates a consistent context ID based on MCP context.
   * 
   * @private
   * @param {Object} mcpContext - MCP context
   * @returns {string} Context ID
   */
  generateContextId(mcpContext) {
    // Use existing context ID if available
    if (mcpContext.ContextId) {
      return `mcp-${mcpContext.ContextId}`;
    }
    
    // Generate ID based on context properties
    const idBase = `${mcpContext.SourceAppId || 'unknown'}-${mcpContext.Type || 'unknown'}-${mcpContext.Timestamp || Date.now()}`;
    return `mcp-${Buffer.from(idBase).toString('base64').replace(/[+/=]/g, '')}`;
  }
  
  /**
   * Handles a new context added to the Aideon context manager.
   * 
   * @param {Object} context - Added context
   */
  onContextAdded(context) {
    if (!this.isInitialized || !this.isNativeAPIAvailable) {
      return;
    }
    
    // Skip contexts from Windows MCP to avoid loops
    if (context.source === 'windows-mcp') {
      return;
    }
    
    // Push context to MCP system
    this.pushContextToMCP(context).catch(error => {
      this.logger.warn(`Failed to push new context ${context.id} to MCP system:`, error);
    });
  }
  
  /**
   * Handles a context updated in the Aideon context manager.
   * 
   * @param {Object} context - Updated context
   */
  onContextUpdated(context) {
    if (!this.isInitialized || !this.isNativeAPIAvailable) {
      return;
    }
    
    // Skip contexts from Windows MCP to avoid loops
    if (context.source === 'windows-mcp') {
      return;
    }
    
    // Push updated context to MCP system
    this.pushContextToMCP(context).catch(error => {
      this.logger.warn(`Failed to push updated context ${context.id} to MCP system:`, error);
    });
  }
  
  /**
   * Handles a context removed from the Aideon context manager.
   * 
   * @param {Object} context - Removed context
   */
  onContextRemoved(context) {
    if (!this.isInitialized || !this.isNativeAPIAvailable) {
      return;
    }
    
    // Skip contexts from Windows MCP to avoid loops
    if (context.source === 'windows-mcp') {
      return;
    }
    
    // Remove context from MCP system
    this.removeContextFromMCP(context.id).catch(error => {
      this.logger.warn(`Failed to remove context ${context.id} from MCP system:`, error);
    });
  }
  
  /**
   * Removes a context from the Windows MCP system.
   * 
   * @private
   * @param {string} contextId - Context ID to remove
   * @returns {Promise<void>}
   */
  async removeContextFromMCP(contextId) {
    try {
      await this.apiLock.acquire();
      
      // Remove context from MCP system using PowerShell
      const script = `
        Remove-MCPContext -AppId 'aideon-ai-desktop-agent' -ContextId '${contextId}'
      `;
      
      await this.executePowerShellScript(script);
      
      this.debugData.metrics.apiCallsMade++;
    } catch (error) {
      this.logger.error(`Failed to remove context ${contextId} from MCP system:`, error);
      this.debugData.metrics.apiErrors++;
      this.debugData.errors.push({
        timestamp: Date.now(),
        operation: 'removeContextFromMCP',
        error: error.message,
        stack: error.stack,
        contextId
      });
      
      throw error;
    } finally {
      this.apiLock.release();
    }
  }
  
  /**
   * Gets the current status of the Windows-native MCP Adapter.
   * 
   * @returns {Object} Current status
   */
  getStatus() {
    return {
      isInitialized: this.isInitialized,
      isNativeAPIAvailable: this.isNativeAPIAvailable,
      nativeClient: this.nativeClient ? {
        isConnected: this.nativeClient.isConnected,
        appId: this.nativeClient.appId,
        sessionId: this.nativeClient.sessionId
      } : null,
      subscriptionCount: this.contextSubscriptions.size,
      metrics: { ...this.debugData.metrics }
    };
  }
}

module.exports = { WindowsNativeMCPAdapter };
