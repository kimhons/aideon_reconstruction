/**
 * @fileoverview Configuration Transaction for Aideon
 * 
 * The ConfigurationTransaction provides atomic update capabilities for the
 * Enhanced Configuration System, allowing multiple configuration changes
 * to be applied as a single unit of work.
 * 
 * This component is part of the Enhanced Configuration System designed
 * to improve Aideon's GAIA Score by enhancing reliability and adaptability.
 */

'use strict';

const EventEmitter = require('events');

/**
 * Configuration Transaction class
 * 
 * Provides atomic update capabilities for configuration values,
 * with commit and rollback support.
 */
class ConfigurationTransaction {
  /**
   * Creates a new ConfigurationTransaction instance
   * 
   * @param {Object} options - Transaction options
   * @param {string} options.id - Transaction identifier
   * @param {Object} options.configManager - Configuration manager instance
   */
  constructor(options = {}) {
    this.id = options.id || `txn-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    this.configManager = options.configManager;
    this.changes = new Map();
    this.originalValues = new Map();
    this.timestamp = Date.now();
    this.status = 'pending'; // pending, committed, rolled-back
    this.eventEmitter = new EventEmitter();
    this.metadata = options.metadata || {};
    this.validationErrors = [];
  }

  /**
   * Sets a configuration value in the transaction
   * 
   * @param {string} path - Configuration path using dot notation
   * @param {*} value - Value to set
   * @returns {ConfigurationTransaction} This transaction for chaining
   */
  set(path, value) {
    if (!path) {
      throw new Error('Path is required');
    }

    // Store original value if not already stored
    if (!this.originalValues.has(path) && this.configManager) {
      this.originalValues.set(path, this.configManager.get(path));
    }

    // Store the change
    this.changes.set(path, value);

    return this;
  }

  /**
   * Deletes a configuration value in the transaction
   * 
   * @param {string} path - Configuration path using dot notation
   * @returns {ConfigurationTransaction} This transaction for chaining
   */
  delete(path) {
    if (!path) {
      throw new Error('Path is required');
    }

    // Store original value if not already stored
    if (!this.originalValues.has(path) && this.configManager) {
      this.originalValues.set(path, this.configManager.get(path));
    }

    // Store the deletion (undefined value means delete)
    this.changes.set(path, undefined);

    return this;
  }

  /**
   * Gets a configuration value from the transaction
   * 
   * @param {string} path - Configuration path using dot notation
   * @returns {*} Configuration value
   */
  get(path) {
    if (!path) {
      return null;
    }

    // Check if the path is in the transaction
    if (this.changes.has(path)) {
      return this.changes.get(path);
    }

    // If not in transaction, get from config manager
    if (this.configManager) {
      return this.configManager.get(path);
    }

    return null;
  }

  /**
   * Validates the transaction against schemas
   * 
   * @returns {boolean} Whether the transaction is valid
   */
  validate() {
    if (!this.configManager) {
      return true; // No config manager to validate against
    }

    this.validationErrors = [];
    let isValid = true;

    // Validate each change
    for (const [path, value] of this.changes.entries()) {
      // Skip validation for deletions
      if (value === undefined) {
        continue;
      }

      // Validate against schema
      const validationResult = this.configManager.validateAgainstSchema(path, value);
      if (!validationResult) {
        isValid = false;
        this.validationErrors.push({
          path,
          message: `Invalid value for ${path}`
        });
      }
    }

    return isValid;
  }

  /**
   * Gets validation errors
   * 
   * @returns {Array} Validation errors
   */
  getValidationErrors() {
    return this.validationErrors;
  }

  /**
   * Commits the transaction
   * 
   * @returns {boolean} Whether the commit was successful
   */
  commit() {
    if (this.status !== 'pending') {
      throw new Error(`Cannot commit transaction with status: ${this.status}`);
    }

    if (!this.configManager) {
      throw new Error('No configuration manager associated with this transaction');
    }

    // Validate the transaction
    if (!this.validate()) {
      return false;
    }

    // Apply all changes
    for (const [path, value] of this.changes.entries()) {
      if (value === undefined) {
        this.configManager.delete(path, { transaction: this.id, silent: true });
      } else {
        this.configManager.set(path, value, { transaction: this.id, validate: false, silent: true });
      }
    }

    // Update status
    this.status = 'committed';
    
    // Emit commit event
    this.eventEmitter.emit('commit', {
      id: this.id,
      timestamp: Date.now(),
      changes: Array.from(this.changes.entries()),
      metadata: this.metadata
    });

    // Emit transaction event on config manager
    if (this.configManager.eventEmitter) {
      this.configManager.eventEmitter.emit('transaction', {
        id: this.id,
        timestamp: Date.now(),
        changes: Array.from(this.changes.entries()),
        metadata: this.metadata
      });
    }

    return true;
  }

  /**
   * Rolls back the transaction
   * 
   * @returns {boolean} Whether the rollback was successful
   */
  rollback() {
    if (this.status !== 'pending') {
      throw new Error(`Cannot rollback transaction with status: ${this.status}`);
    }

    if (!this.configManager) {
      throw new Error('No configuration manager associated with this transaction');
    }

    // If no changes have been applied, nothing to rollback
    if (this.originalValues.size === 0) {
      this.status = 'rolled-back';
      return true;
    }

    // Restore original values
    for (const [path, value] of this.originalValues.entries()) {
      if (value === undefined) {
        this.configManager.delete(path, { transaction: `${this.id}-rollback`, silent: true });
      } else {
        this.configManager.set(path, value, { transaction: `${this.id}-rollback`, validate: false, silent: true });
      }
    }

    // Update status
    this.status = 'rolled-back';
    
    // Emit rollback event
    this.eventEmitter.emit('rollback', {
      id: this.id,
      timestamp: Date.now(),
      metadata: this.metadata
    });

    // Emit rollback event on config manager
    if (this.configManager.eventEmitter) {
      this.configManager.eventEmitter.emit('rollback', {
        id: this.id,
        timestamp: Date.now(),
        metadata: this.metadata
      });
    }

    return true;
  }

  /**
   * Gets the transaction status
   * 
   * @returns {string} Transaction status
   */
  getStatus() {
    return this.status;
  }

  /**
   * Gets the transaction ID
   * 
   * @returns {string} Transaction ID
   */
  getId() {
    return this.id;
  }

  /**
   * Gets the transaction timestamp
   * 
   * @returns {number} Transaction timestamp
   */
  getTimestamp() {
    return this.timestamp;
  }

  /**
   * Gets the transaction changes
   * 
   * @returns {Map} Transaction changes
   */
  getChanges() {
    return this.changes;
  }

  /**
   * Gets the transaction original values
   * 
   * @returns {Map} Transaction original values
   */
  getOriginalValues() {
    return this.originalValues;
  }

  /**
   * Gets the transaction metadata
   * 
   * @returns {Object} Transaction metadata
   */
  getMetadata() {
    return this.metadata;
  }

  /**
   * Sets transaction metadata
   * 
   * @param {Object} metadata - Transaction metadata
   * @returns {ConfigurationTransaction} This transaction for chaining
   */
  setMetadata(metadata) {
    this.metadata = metadata || {};
    return this;
  }

  /**
   * Adds a transaction event listener
   * 
   * @param {string} event - Event name
   * @param {Function} listener - Event listener
   * @returns {ConfigurationTransaction} This transaction for chaining
   */
  on(event, listener) {
    this.eventEmitter.on(event, listener);
    return this;
  }

  /**
   * Removes a transaction event listener
   * 
   * @param {string} event - Event name
   * @param {Function} listener - Event listener
   * @returns {ConfigurationTransaction} This transaction for chaining
   */
  off(event, listener) {
    this.eventEmitter.off(event, listener);
    return this;
  }

  /**
   * Creates a transaction summary
   * 
   * @returns {Object} Transaction summary
   */
  getSummary() {
    return {
      id: this.id,
      timestamp: this.timestamp,
      status: this.status,
      changeCount: this.changes.size,
      paths: Array.from(this.changes.keys()),
      metadata: this.metadata
    };
  }

  /**
   * Serializes the transaction to JSON
   * 
   * @returns {Object} Serialized transaction
   */
  toJSON() {
    return {
      id: this.id,
      timestamp: this.timestamp,
      status: this.status,
      changes: Array.from(this.changes.entries()),
      originalValues: Array.from(this.originalValues.entries()),
      metadata: this.metadata
    };
  }

  /**
   * Creates a transaction from JSON
   * 
   * @param {Object|string} json - JSON object or string
   * @param {Object} configManager - Configuration manager instance
   * @returns {ConfigurationTransaction} Created transaction
   * @static
   */
  static fromJSON(json, configManager) {
    const parsed = typeof json === 'string' ? JSON.parse(json) : json;
    
    const transaction = new ConfigurationTransaction({
      id: parsed.id,
      configManager,
      metadata: parsed.metadata
    });
    
    transaction.timestamp = parsed.timestamp;
    transaction.status = parsed.status;
    transaction.changes = new Map(parsed.changes);
    transaction.originalValues = new Map(parsed.originalValues);
    
    return transaction;
  }
}

module.exports = ConfigurationTransaction;
