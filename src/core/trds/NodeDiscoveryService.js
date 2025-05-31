/**
 * NodeDiscoveryService.js
 * 
 * Service responsible for discovering other Aideon nodes in the network.
 */

const EventEmitter = require('events');
const os = require('os');
const dgram = require('dgram');
const crypto = require('crypto');

/**
 * @typedef {import('../types').NodeCapability} NodeCapability
 */

/**
 * @typedef {Object} INodeIdentity
 * @property {string} nodeId - Unique identifier for the node
 * @property {string} publicKey - Public key for secure communication
 * @property {NodeCapability[]} capabilities - Capabilities of the node
 * @property {Object} metadata - Additional metadata about the node
 */

/**
 * Interface for node discovery service
 * @interface INodeDiscoveryService
 */
class INodeDiscoveryService {
  /**
   * Discover nodes in the network
   * @returns {Promise<INodeIdentity[]>} - List of discovered nodes
   */
  async discoverNodes() {
    throw new Error('Method not implemented');
  }

  /**
   * Announce presence to other nodes
   * @returns {Promise<void>}
   */
  async announcePresence() {
    throw new Error('Method not implemented');
  }

  /**
   * Register callback for when a node is discovered
   * @param {function(INodeIdentity): void} callback - Callback function
   * @returns {void}
   */
  onNodeDiscovered(callback) {
    throw new Error('Method not implemented');
  }

  /**
   * Register callback for when a node is lost
   * @param {function(string): void} callback - Callback function
   * @returns {void}
   */
  onNodeLost(callback) {
    throw new Error('Method not implemented');
  }
}

/**
 * Implementation of node discovery service using mDNS/Bonjour
 */
class NodeDiscoveryService extends EventEmitter {
  /**
   * Create a new NodeDiscoveryService
   * @param {Object} options - Options for the discovery service
   * @param {string} options.serviceName - Name of the service to advertise
   * @param {number} options.port - Port to use for discovery
   * @param {number} options.announcementInterval - Interval in ms between announcements
   * @param {number} options.nodeTimeoutInterval - Time in ms after which a node is considered lost
   */
  constructor(options = {}) {
    super();
    this.options = {
      serviceName: options.serviceName || 'aideon-distributed',
      port: options.port || 41234,
      announcementInterval: options.announcementInterval || 30000,
      nodeTimeoutInterval: options.nodeTimeoutInterval || 90000
    };
    
    this.localNode = null;
    this.discoveredNodes = new Map();
    this.socket = null;
    this.announceIntervalId = null;
    this.cleanupIntervalId = null;
  }

  /**
   * Initialize the discovery service
   * @param {INodeIdentity} localNode - Identity of the local node
   * @returns {Promise<void>}
   */
  async initialize(localNode) {
    this.localNode = localNode;
    
    // Create UDP socket for discovery
    this.socket = dgram.createSocket('udp4');
    
    // Handle incoming discovery messages
    this.socket.on('message', (msg, rinfo) => {
      try {
        const announcement = JSON.parse(msg.toString());
        if (announcement.type === 'announcement' && announcement.nodeId !== this.localNode.nodeId) {
          this._handleNodeAnnouncement(announcement.node, rinfo);
        }
      } catch (error) {
        console.error('Error processing discovery message:', error);
      }
    });
    
    // Bind socket to port
    await new Promise((resolve, reject) => {
      this.socket.bind(this.options.port, () => {
        try {
          // Enable broadcast
          this.socket.setBroadcast(true);
          resolve();
        } catch (error) {
          reject(error);
        }
      });
    });
    
    // Start periodic announcements
    this.announceIntervalId = setInterval(() => {
      this.announcePresence().catch(error => {
        console.error('Error announcing presence:', error);
      });
    }, this.options.announcementInterval);
    
    // Start node cleanup interval
    this.cleanupIntervalId = setInterval(() => {
      this._cleanupStaleNodes();
    }, this.options.nodeTimeoutInterval / 3);
    
    // Initial announcement
    await this.announcePresence();
  }

  /**
   * Stop the discovery service
   * @returns {Promise<void>}
   */
  async stop() {
    if (this.announceIntervalId) {
      clearInterval(this.announceIntervalId);
      this.announceIntervalId = null;
    }
    
    if (this.cleanupIntervalId) {
      clearInterval(this.cleanupIntervalId);
      this.cleanupIntervalId = null;
    }
    
    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }
  }

  /**
   * Discover nodes in the network
   * @returns {Promise<INodeIdentity[]>} - List of discovered nodes
   */
  async discoverNodes() {
    // Return currently known nodes
    return Array.from(this.discoveredNodes.values()).map(entry => entry.node);
  }

  /**
   * Announce presence to other nodes
   * @returns {Promise<void>}
   */
  async announcePresence() {
    if (!this.socket || !this.localNode) {
      throw new Error('Discovery service not initialized');
    }
    
    const announcement = {
      type: 'announcement',
      nodeId: this.localNode.nodeId,
      timestamp: Date.now(),
      node: this.localNode
    };
    
    const message = Buffer.from(JSON.stringify(announcement));
    
    // Broadcast to local network
    return new Promise((resolve, reject) => {
      this.socket.send(message, 0, message.length, this.options.port, '255.255.255.255', (err) => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });
  }

  /**
   * Register callback for when a node is discovered
   * @param {function(INodeIdentity): void} callback - Callback function
   * @returns {void}
   */
  onNodeDiscovered(callback) {
    this.on('nodeDiscovered', callback);
  }

  /**
   * Register callback for when a node is lost
   * @param {function(string): void} callback - Callback function
   * @returns {void}
   */
  onNodeLost(callback) {
    this.on('nodeLost', callback);
  }

  /**
   * Handle node announcement
   * @private
   * @param {INodeIdentity} node - Node identity
   * @param {Object} rinfo - Remote info
   */
  _handleNodeAnnouncement(node, rinfo) {
    const now = Date.now();
    const existingEntry = this.discoveredNodes.get(node.nodeId);
    
    if (!existingEntry) {
      // New node discovered
      this.discoveredNodes.set(node.nodeId, {
        node,
        lastSeen: now,
        address: rinfo.address
      });
      
      this.emit('nodeDiscovered', node);
    } else {
      // Update existing node
      existingEntry.lastSeen = now;
      existingEntry.address = rinfo.address;
      
      // Check if capabilities or metadata changed
      const hasChanges = JSON.stringify(existingEntry.node) !== JSON.stringify(node);
      if (hasChanges) {
        existingEntry.node = node;
        this.emit('nodeUpdated', node);
      }
    }
  }

  /**
   * Clean up stale nodes
   * @private
   */
  _cleanupStaleNodes() {
    const now = Date.now();
    const staleThreshold = now - this.options.nodeTimeoutInterval;
    
    for (const [nodeId, entry] of this.discoveredNodes.entries()) {
      if (entry.lastSeen < staleThreshold) {
        this.discoveredNodes.delete(nodeId);
        this.emit('nodeLost', nodeId);
      }
    }
  }

  /**
   * Get the local IP address
   * @private
   * @returns {string} - Local IP address
   */
  _getLocalIpAddress() {
    const interfaces = os.networkInterfaces();
    for (const name of Object.keys(interfaces)) {
      for (const iface of interfaces[name]) {
        // Skip internal and non-IPv4 addresses
        if (iface.family === 'IPv4' && !iface.internal) {
          return iface.address;
        }
      }
    }
    return '127.0.0.1';
  }
}

module.exports = {
  INodeDiscoveryService,
  NodeDiscoveryService
};
