/**
 * @fileoverview Temporal Context Manager for the Contextual Intelligence Tentacle.
 * Tracks how context evolves over time and manages historical context.
 * 
 * @author Aideon AI Team
 * @version 1.0.0
 */

const EventEmitter = require('events');
const { deepClone } = require('../../utils/object_utils');

/**
 * Manages temporal aspects of context, including history and evolution over time.
 */
class TemporalContextManager {
  /**
   * Creates a new TemporalContextManager instance.
   * @param {Object} options - Configuration options
   * @param {Map} [options.contextTimeline] - Initial context timeline
   * @param {number} [options.snapshotInterval] - Interval between automatic snapshots in milliseconds
   * @param {number} [options.maxHistoryLength] - Maximum number of snapshots to keep per context
   * @param {EventEmitter} [options.eventEmitter] - Event emitter for temporal events
   */
  constructor(options = {}) {
    this.contextTimeline = options.contextTimeline || new Map();
    this.snapshotInterval = options.snapshotInterval || 300000; // 5 minutes default
    this.maxHistoryLength = options.maxHistoryLength || 100;
    this.eventEmitter = options.eventEmitter || new EventEmitter();
    this.lastSnapshot = Date.now();
    this.initialized = false;
    this.autoSnapshotEnabled = options.autoSnapshotEnabled !== undefined ? options.autoSnapshotEnabled : true;
    this.snapshotTimer = null;
    this.snapshotPaths = new Set();
  }

  /**
   * Initializes the Temporal Context Manager.
   * @returns {Promise<boolean>} - Promise resolving to true if initialization was successful
   */
  async initialize() {
    if (this.initialized) {
      return true;
    }

    try {
      // Set up event listeners
      this._setupEventListeners();

      // Start automatic snapshot timer if enabled
      if (this.autoSnapshotEnabled) {
        this._startAutoSnapshot();
      }

      this.initialized = true;
      this.eventEmitter.emit('temporal:initialized');
      return true;
    } catch (error) {
      this.eventEmitter.emit('temporal:error', {
        operation: 'initialize',
        error: error.message
      });
      return false;
    }
  }

  /**
   * Sets up event listeners for context events.
   * @private
   */
  _setupEventListeners() {
    // Listen for context updates
    this.eventEmitter.on('context:updated', (event) => {
      const { path } = event;
      this.snapshotPaths.add(path);
    });

    // Listen for context deletions
    this.eventEmitter.on('context:deleted', (event) => {
      const { path } = event;
      this.snapshotPaths.delete(path);
    });
  }

  /**
   * Starts the automatic snapshot timer.
   * @private
   */
  _startAutoSnapshot() {
    if (this.snapshotTimer) {
      clearInterval(this.snapshotTimer);
    }

    this.snapshotTimer = setInterval(() => {
      this._performAutoSnapshot();
    }, this.snapshotInterval);

    // Ensure the timer doesn't prevent Node from exiting
    if (this.snapshotTimer.unref) {
      this.snapshotTimer.unref();
    }
  }

  /**
   * Performs automatic snapshots for recently updated contexts.
   * @private
   */
  async _performAutoSnapshot() {
    try {
      const now = Date.now();
      const paths = Array.from(this.snapshotPaths);
      this.snapshotPaths.clear();

      // Create snapshots for all updated paths
      for (const path of paths) {
        try {
          // Emit event to request current context value
          this.eventEmitter.emit('temporal:snapshot:request', { path });

          // Wait for response or timeout
          const context = await new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
              this.eventEmitter.removeListener('temporal:snapshot:response', handleResponse);
              resolve(null);
            }, 1000);

            const handleResponse = (response) => {
              if (response.path === path) {
                clearTimeout(timeout);
                this.eventEmitter.removeListener('temporal:snapshot:response', handleResponse);
                resolve(response.context);
              }
            };

            this.eventEmitter.on('temporal:snapshot:response', handleResponse);
          });

          if (context) {
            await this.createSnapshot(path, context);
          }
        } catch (error) {
          this.eventEmitter.emit('temporal:warning', {
            operation: 'autoSnapshot',
            path,
            error: error.message
          });
        }
      }

      this.lastSnapshot = now;
    } catch (error) {
      this.eventEmitter.emit('temporal:error', {
        operation: 'performAutoSnapshot',
        error: error.message
      });
    }
  }

  /**
   * Creates a snapshot of a context at the current time.
   * @param {string} path - The path to the context
   * @param {Object} context - The context to snapshot
   * @returns {Promise<boolean>} - Promise resolving to true if snapshot was created
   */
  async createSnapshot(path, context) {
    try {
      if (!this.initialized) {
        await this.initialize();
      }

      if (!path || typeof path !== 'string') {
        throw new Error('Context path must be a non-empty string');
      }

      if (!context || typeof context !== 'object') {
        throw new Error('Context must be an object');
      }

      // Create timeline entry if it doesn't exist
      if (!this.contextTimeline.has(path)) {
        this.contextTimeline.set(path, []);
      }

      const timeline = this.contextTimeline.get(path);
      const timestamp = Date.now();

      // Create snapshot with metadata
      const snapshot = {
        timestamp,
        context: deepClone(context),
        metadata: {
          snapshotType: 'manual',
          snapshotId: `${path}-${timestamp}`
        }
      };

      // Add to timeline
      timeline.unshift(snapshot);

      // Trim timeline if it exceeds max length
      if (timeline.length > this.maxHistoryLength) {
        timeline.length = this.maxHistoryLength;
      }

      this.eventEmitter.emit('temporal:snapshot:created', {
        path,
        timestamp,
        snapshotId: snapshot.metadata.snapshotId
      });

      return true;
    } catch (error) {
      this.eventEmitter.emit('temporal:error', {
        operation: 'createSnapshot',
        path,
        error: error.message
      });
      return false;
    }
  }

  /**
   * Gets a context at a specific point in time.
   * @param {string} path - The path to the context
   * @param {number} timestamp - The timestamp to get context at
   * @returns {Promise<Object|null>} - Promise resolving to historical context or null
   */
  async getContextAtTime(path, timestamp) {
    try {
      if (!this.initialized) {
        await this.initialize();
      }

      if (!path || typeof path !== 'string') {
        throw new Error('Context path must be a non-empty string');
      }

      if (!timestamp || typeof timestamp !== 'number') {
        throw new Error('Timestamp must be a number');
      }

      // Check if timeline exists for this path
      if (!this.contextTimeline.has(path)) {
        return null;
      }

      const timeline = this.contextTimeline.get(path);

      // Find the closest snapshot before or at the requested timestamp
      let closestSnapshot = null;
      let closestDiff = Infinity;

      for (const snapshot of timeline) {
        // Only consider snapshots before or at the requested time
        if (snapshot.timestamp <= timestamp) {
          const diff = timestamp - snapshot.timestamp;
          if (diff < closestDiff) {
            closestSnapshot = snapshot;
            closestDiff = diff;
          }
        }
      }

      if (closestSnapshot) {
        return deepClone(closestSnapshot.context);
      }

      return null;
    } catch (error) {
      this.eventEmitter.emit('temporal:error', {
        operation: 'getContextAtTime',
        path,
        timestamp,
        error: error.message
      });
      return null;
    }
  }

  /**
   * Gets context evolution over a time period.
   * @param {string} path - The path to the context
   * @param {number} startTime - The start timestamp
   * @param {number} endTime - The end timestamp
   * @returns {Promise<Array<Object>>} - Promise resolving to array of context snapshots
   */
  async getContextEvolution(path, startTime, endTime) {
    try {
      if (!this.initialized) {
        await this.initialize();
      }

      if (!path || typeof path !== 'string') {
        throw new Error('Context path must be a non-empty string');
      }

      if (!startTime || typeof startTime !== 'number') {
        throw new Error('Start time must be a number');
      }

      if (!endTime || typeof endTime !== 'number') {
        throw new Error('End time must be a number');
      }

      if (startTime > endTime) {
        throw new Error('Start time must be before end time');
      }

      // Check if timeline exists for this path
      if (!this.contextTimeline.has(path)) {
        return [];
      }

      const timeline = this.contextTimeline.get(path);

      // Filter snapshots within the time range
      const evolution = timeline.filter(snapshot => {
        return snapshot.timestamp >= startTime && snapshot.timestamp <= endTime;
      });

      // Sort by timestamp (oldest first)
      evolution.sort((a, b) => a.timestamp - b.timestamp);

      // Return deep clones to prevent modification
      return evolution.map(snapshot => ({
        timestamp: snapshot.timestamp,
        context: deepClone(snapshot.context),
        metadata: { ...snapshot.metadata }
      }));
    } catch (error) {
      this.eventEmitter.emit('temporal:error', {
        operation: 'getContextEvolution',
        path,
        startTime,
        endTime,
        error: error.message
      });
      return [];
    }
  }

  /**
   * Gets the most recent snapshot for a context.
   * @param {string} path - The path to the context
   * @returns {Promise<Object|null>} - Promise resolving to most recent snapshot or null
   */
  async getLatestSnapshot(path) {
    try {
      if (!this.initialized) {
        await this.initialize();
      }

      if (!path || typeof path !== 'string') {
        throw new Error('Context path must be a non-empty string');
      }

      // Check if timeline exists for this path
      if (!this.contextTimeline.has(path)) {
        return null;
      }

      const timeline = this.contextTimeline.get(path);

      if (timeline.length === 0) {
        return null;
      }

      // Return the most recent snapshot (first in the timeline)
      const snapshot = timeline[0];
      return {
        timestamp: snapshot.timestamp,
        context: deepClone(snapshot.context),
        metadata: { ...snapshot.metadata }
      };
    } catch (error) {
      this.eventEmitter.emit('temporal:error', {
        operation: 'getLatestSnapshot',
        path,
        error: error.message
      });
      return null;
    }
  }

  /**
   * Gets the number of snapshots for a context.
   * @param {string} path - The path to the context
   * @returns {Promise<number>} - Promise resolving to number of snapshots
   */
  async getSnapshotCount(path) {
    try {
      if (!this.initialized) {
        await this.initialize();
      }

      if (!path || typeof path !== 'string') {
        throw new Error('Context path must be a non-empty string');
      }

      // Check if timeline exists for this path
      if (!this.contextTimeline.has(path)) {
        return 0;
      }

      return this.contextTimeline.get(path).length;
    } catch (error) {
      this.eventEmitter.emit('temporal:error', {
        operation: 'getSnapshotCount',
        path,
        error: error.message
      });
      return 0;
    }
  }

  /**
   * Clears the timeline for a specific context.
   * @param {string} path - The path to the context
   * @returns {Promise<boolean>} - Promise resolving to true if timeline was cleared
   */
  async clearTimeline(path) {
    try {
      if (!this.initialized) {
        await this.initialize();
      }

      if (!path || typeof path !== 'string') {
        throw new Error('Context path must be a non-empty string');
      }

      // Check if timeline exists for this path
      if (this.contextTimeline.has(path)) {
        this.contextTimeline.set(path, []);
        
        this.eventEmitter.emit('temporal:timeline:cleared', {
          path
        });
      }

      return true;
    } catch (error) {
      this.eventEmitter.emit('temporal:error', {
        operation: 'clearTimeline',
        path,
        error: error.message
      });
      return false;
    }
  }

  /**
   * Prunes old snapshots to save memory.
   * @param {Object} [options] - Pruning options
   * @param {number} [options.maxAge] - Maximum age of snapshots to keep in milliseconds
   * @param {number} [options.maxPerPath] - Maximum number of snapshots to keep per path
   * @returns {Promise<Object>} - Promise resolving to pruning statistics
   */
  async pruneSnapshots(options = {}) {
    try {
      if (!this.initialized) {
        await this.initialize();
      }

      const maxAge = options.maxAge || 30 * 24 * 60 * 60 * 1000; // 30 days default
      const maxPerPath = options.maxPerPath || this.maxHistoryLength;
      const now = Date.now();
      const stats = {
        pathsProcessed: 0,
        snapshotsRemoved: 0,
        snapshotsKept: 0
      };

      // Process each path
      for (const [path, timeline] of this.contextTimeline.entries()) {
        stats.pathsProcessed++;
        
        const originalLength = timeline.length;
        
        // Remove old snapshots
        const filteredTimeline = timeline.filter(snapshot => {
          return now - snapshot.timestamp <= maxAge;
        });
        
        // Trim to max per path
        if (filteredTimeline.length > maxPerPath) {
          filteredTimeline.length = maxPerPath;
        }
        
        // Update timeline
        this.contextTimeline.set(path, filteredTimeline);
        
        // Update stats
        stats.snapshotsRemoved += originalLength - filteredTimeline.length;
        stats.snapshotsKept += filteredTimeline.length;
      }

      this.eventEmitter.emit('temporal:pruned', stats);
      
      return stats;
    } catch (error) {
      this.eventEmitter.emit('temporal:error', {
        operation: 'pruneSnapshots',
        error: error.message
      });
      return {
        pathsProcessed: 0,
        snapshotsRemoved: 0,
        snapshotsKept: 0,
        error: error.message
      };
    }
  }

  /**
   * Compares two snapshots of a context and returns the differences.
   * @param {string} path - The path to the context
   * @param {number} timestamp1 - The first timestamp
   * @param {number} timestamp2 - The second timestamp
   * @returns {Promise<Object>} - Promise resolving to differences object
   */
  async compareSnapshots(path, timestamp1, timestamp2) {
    try {
      if (!this.initialized) {
        await this.initialize();
      }

      const snapshot1 = await this.getContextAtTime(path, timestamp1);
      const snapshot2 = await this.getContextAtTime(path, timestamp2);

      if (!snapshot1 || !snapshot2) {
        throw new Error('One or both snapshots not found');
      }

      return this._calculateDifferences(snapshot1, snapshot2);
    } catch (error) {
      this.eventEmitter.emit('temporal:error', {
        operation: 'compareSnapshots',
        path,
        timestamp1,
        timestamp2,
        error: error.message
      });
      return {
        added: {},
        removed: {},
        changed: {}
      };
    }
  }

  /**
   * Calculates differences between two objects.
   * @param {Object} obj1 - First object
   * @param {Object} obj2 - Second object
   * @returns {Object} - Differences object
   * @private
   */
  _calculateDifferences(obj1, obj2) {
    const differences = {
      added: {},
      removed: {},
      changed: {}
    };

    // Find added and changed properties
    for (const key in obj2) {
      if (!(key in obj1)) {
        differences.added[key] = obj2[key];
      } else if (typeof obj2[key] === 'object' && obj2[key] !== null && 
                 typeof obj1[key] === 'object' && obj1[key] !== null) {
        const nestedDiff = this._calculateDifferences(obj1[key], obj2[key]);
        
        if (Object.keys(nestedDiff.added).length > 0 || 
            Object.keys(nestedDiff.removed).length > 0 || 
            Object.keys(nestedDiff.changed).length > 0) {
          differences.changed[key] = nestedDiff;
        }
      } else if (obj1[key] !== obj2[key]) {
        differences.changed[key] = {
          from: obj1[key],
          to: obj2[key]
        };
      }
    }

    // Find removed properties
    for (const key in obj1) {
      if (!(key in obj2)) {
        differences.removed[key] = obj1[key];
      }
    }

    return differences;
  }

  /**
   * Gets a list of all contexts with temporal data.
   * @returns {Promise<Array<string>>} - Promise resolving to array of context paths
   */
  async listTemporalContexts() {
    try {
      if (!this.initialized) {
        await this.initialize();
      }

      return Array.from(this.contextTimeline.keys());
    } catch (error) {
      this.eventEmitter.emit('temporal:error', {
        operation: 'listTemporalContexts',
        error: error.message
      });
      return [];
    }
  }

  /**
   * Gets statistics about temporal data.
   * @returns {Promise<Object>} - Promise resolving to statistics object
   */
  async getStatistics() {
    try {
      if (!this.initialized) {
        await this.initialize();
      }

      const stats = {
        contextCount: this.contextTimeline.size,
        totalSnapshots: 0,
        oldestSnapshot: Infinity,
        newestSnapshot: 0,
        averageSnapshotsPerContext: 0,
        contextWithMostSnapshots: null,
        maxSnapshotCount: 0
      };

      // Calculate statistics
      for (const [path, timeline] of this.contextTimeline.entries()) {
        stats.totalSnapshots += timeline.length;
        
        if (timeline.length > stats.maxSnapshotCount) {
          stats.maxSnapshotCount = timeline.length;
          stats.contextWithMostSnapshots = path;
        }
        
        for (const snapshot of timeline) {
          if (snapshot.timestamp < stats.oldestSnapshot) {
            stats.oldestSnapshot = snapshot.timestamp;
          }
          
          if (snapshot.timestamp > stats.newestSnapshot) {
            stats.newestSnapshot = snapshot.timestamp;
          }
        }
      }
      
      if (stats.contextCount > 0) {
        stats.averageSnapshotsPerContext = stats.totalSnapshots / stats.contextCount;
      }
      
      // Convert timestamps to dates for readability
      if (stats.oldestSnapshot !== Infinity) {
        stats.oldestSnapshotDate = new Date(stats.oldestSnapshot).toISOString();
      } else {
        stats.oldestSnapshot = null;
        stats.oldestSnapshotDate = null;
      }
      
      if (stats.newestSnapshot !== 0) {
        stats.newestSnapshotDate = new Date(stats.newestSnapshot).toISOString();
      } else {
        stats.newestSnapshot = null;
        stats.newestSnapshotDate = null;
      }

      return stats;
    } catch (error) {
      this.eventEmitter.emit('temporal:error', {
        operation: 'getStatistics',
        error: error.message
      });
      return {
        contextCount: 0,
        totalSnapshots: 0,
        error: error.message
      };
    }
  }

  /**
   * Configures the automatic snapshot behavior.
   * @param {Object} config - Configuration options
   * @param {boolean} [config.enabled] - Whether automatic snapshots are enabled
   * @param {number} [config.interval] - Interval between snapshots in milliseconds
   * @returns {Promise<boolean>} - Promise resolving to true if configuration was successful
   */
  async configureAutoSnapshot(config) {
    try {
      if (!this.initialized) {
        await this.initialize();
      }

      if (config.enabled !== undefined) {
        this.autoSnapshotEnabled = config.enabled;
        
        if (this.autoSnapshotEnabled) {
          this._startAutoSnapshot();
        } else if (this.snapshotTimer) {
          clearInterval(this.snapshotTimer);
          this.snapshotTimer = null;
        }
      }
      
      if (config.interval !== undefined && typeof config.interval === 'number') {
        this.snapshotInterval = config.interval;
        
        if (this.autoSnapshotEnabled && this.snapshotTimer) {
          this._startAutoSnapshot(); // Restart with new interval
        }
      }
      
      this.eventEmitter.emit('temporal:configured', {
        autoSnapshotEnabled: this.autoSnapshotEnabled,
        snapshotInterval: this.snapshotInterval
      });
      
      return true;
    } catch (error) {
      this.eventEmitter.emit('temporal:error', {
        operation: 'configureAutoSnapshot',
        error: error.message
      });
      return false;
    }
  }

  /**
   * Shuts down the Temporal Context Manager.
   * @returns {Promise<boolean>} - Promise resolving to true if shutdown was successful
   */
  async shutdown() {
    try {
      if (!this.initialized) {
        return true;
      }

      // Stop automatic snapshot timer
      if (this.snapshotTimer) {
        clearInterval(this.snapshotTimer);
        this.snapshotTimer = null;
      }

      // Clear all data
      this.contextTimeline.clear();
      this.snapshotPaths.clear();

      this.initialized = false;
      this.eventEmitter.emit('temporal:shutdown');
      
      return true;
    } catch (error) {
      this.eventEmitter.emit('temporal:error', {
        operation: 'shutdown',
        error: error.message
      });
      return false;
    }
  }
}

module.exports = TemporalContextManager;
