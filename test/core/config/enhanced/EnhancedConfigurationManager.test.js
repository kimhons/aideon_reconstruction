/**
 * @fileoverview Tests for Enhanced Configuration Manager
 * 
 * This file contains comprehensive tests for the EnhancedConfigurationManager,
 * ensuring all functionality works as expected and meets the requirements
 * for improving Aideon's GAIA Score.
 */

'use strict';

const assert = require('assert');
const path = require('path');
const fs = require('fs').promises;
const os = require('os');
const EnhancedConfigurationManager = require('../../../../src/core/config/enhanced/EnhancedConfigurationManager');

describe('EnhancedConfigurationManager', () => {
  let configManager;
  let tempDir;
  
  // Setup before each test
  beforeEach(async () => {
    // Create a temporary directory for configuration files
    tempDir = path.join(os.tmpdir(), `aideon-config-test-${Date.now()}`);
    await fs.mkdir(tempDir, { recursive: true });
    
    // Create a new configuration manager instance
    configManager = new EnhancedConfigurationManager({
      configDir: tempDir,
      autoSave: false // Disable auto-save for tests
    });
  });
  
  // Cleanup after each test
  afterEach(async () => {
    // Dispose the configuration manager
    if (configManager) {
      configManager.dispose();
    }
    
    // Remove the temporary directory
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch (err) {
      console.error('Failed to remove temporary directory:', err);
    }
  });
  
  describe('Basic Configuration Operations', () => {
    it('should get and set configuration values', () => {
      // Set a value
      const result = configManager.set('test.value', 123);
      assert.strictEqual(result, true);
      
      // Get the value
      const value = configManager.get('test.value');
      assert.strictEqual(value, 123);
    });
    
    it('should return default value for non-existent paths', () => {
      const value = configManager.get('non.existent.path', 'default');
      assert.strictEqual(value, 'default');
    });
    
    it('should check if a path exists', () => {
      configManager.set('test.exists', true);
      
      const exists = configManager.has('test.exists');
      assert.strictEqual(exists, true);
      
      const notExists = configManager.has('test.not.exists');
      assert.strictEqual(notExists, false);
    });
    
    it('should delete configuration values', () => {
      configManager.set('test.delete', 'value');
      assert.strictEqual(configManager.get('test.delete'), 'value');
      
      const result = configManager.delete('test.delete');
      assert.strictEqual(result, true);
      assert.strictEqual(configManager.has('test.delete'), false);
    });
    
    it('should handle nested paths correctly', () => {
      configManager.set('level1.level2.level3', 'nested');
      assert.strictEqual(configManager.get('level1.level2.level3'), 'nested');
      
      const level2 = configManager.get('level1.level2');
      assert.deepStrictEqual(level2, { level3: 'nested' });
    });
    
    it('should return the entire configuration when getting with empty path', () => {
      configManager.set('test.value1', 1);
      configManager.set('test.value2', 2);
      
      const config = configManager.get();
      assert.deepStrictEqual(config, {
        test: {
          value1: 1,
          value2: 2
        }
      });
    });
  });
  
  describe('Schema Validation', () => {
    it('should register and validate against schemas', () => {
      // Register a schema
      configManager.registerSchema('validation.number', {
        type: 'number',
        minimum: 0,
        maximum: 100
      });
      
      // Valid value
      const validResult = configManager.set('validation.number', 50);
      assert.strictEqual(validResult, true);
      assert.strictEqual(configManager.get('validation.number'), 50);
      
      // Invalid value (string instead of number)
      const invalidTypeResult = configManager.set('validation.number', 'not a number');
      assert.strictEqual(invalidTypeResult, false);
      assert.strictEqual(configManager.get('validation.number'), 50); // Value should not change
      
      // Invalid value (out of range)
      const invalidRangeResult = configManager.set('validation.number', 150);
      assert.strictEqual(invalidRangeResult, false);
      assert.strictEqual(configManager.get('validation.number'), 50); // Value should not change
    });
    
    it('should validate string values', () => {
      // Register a schema
      configManager.registerSchema('validation.string', {
        type: 'string',
        minLength: 3,
        maxLength: 10,
        pattern: '^[a-z]+$'
      });
      
      // Valid value
      const validResult = configManager.set('validation.string', 'valid');
      assert.strictEqual(validResult, true);
      
      // Invalid value (too short)
      const tooShortResult = configManager.set('validation.string', 'ab');
      assert.strictEqual(tooShortResult, false);
      
      // Invalid value (too long)
      const tooLongResult = configManager.set('validation.string', 'thisiswaytoolong');
      assert.strictEqual(tooLongResult, false);
      
      // Invalid value (pattern mismatch)
      const patternMismatchResult = configManager.set('validation.string', 'INVALID');
      assert.strictEqual(patternMismatchResult, false);
    });
    
    it('should validate array values', () => {
      // Register a schema
      configManager.registerSchema('validation.array', {
        type: 'array',
        minItems: 1,
        maxItems: 3,
        items: {
          type: 'string'
        }
      });
      
      // Valid value
      const validResult = configManager.set('validation.array', ['item1', 'item2']);
      assert.strictEqual(validResult, true);
      
      // Invalid value (empty array)
      const emptyResult = configManager.set('validation.array', []);
      assert.strictEqual(emptyResult, false);
      
      // Invalid value (too many items)
      const tooManyResult = configManager.set('validation.array', ['item1', 'item2', 'item3', 'item4']);
      assert.strictEqual(tooManyResult, false);
      
      // Invalid value (wrong item type)
      const wrongTypeResult = configManager.set('validation.array', ['item1', 123]);
      assert.strictEqual(wrongTypeResult, false);
    });
    
    it('should validate enum values', () => {
      // Register a schema
      configManager.registerSchema('validation.enum', {
        enum: ['option1', 'option2', 'option3']
      });
      
      // Valid value
      const validResult = configManager.set('validation.enum', 'option2');
      assert.strictEqual(validResult, true);
      
      // Invalid value (not in enum)
      const invalidResult = configManager.set('validation.enum', 'option4');
      assert.strictEqual(invalidResult, false);
    });
    
    it('should get schema version', () => {
      // Register a schema with version
      configManager.registerSchema('versioned.config', {
        type: 'object',
        version: '1.2.3'
      });
      
      const version = configManager.getSchemaVersion('versioned.config');
      assert.strictEqual(version, '1.2.3');
      
      // Non-existent schema
      const noVersion = configManager.getSchemaVersion('non.existent');
      assert.strictEqual(noVersion, null);
    });
  });
  
  describe('Transactions', () => {
    it('should commit a transaction successfully', () => {
      // Begin a transaction
      const transaction = configManager.beginTransaction();
      assert.ok(transaction.id);
      
      // Set values in the transaction
      configManager.set('transaction.value1', 1, { transaction: transaction.id });
      configManager.set('transaction.value2', 2, { transaction: transaction.id });
      
      // Commit the transaction
      const result = configManager.commitTransaction(transaction);
      assert.strictEqual(result, true);
      
      // Check values
      assert.strictEqual(configManager.get('transaction.value1'), 1);
      assert.strictEqual(configManager.get('transaction.value2'), 2);
    });
    
    it('should rollback a transaction', () => {
      // Set initial values
      configManager.set('rollback.value', 'initial');
      
      // Begin a transaction
      const transaction = configManager.beginTransaction();
      
      // Modify values in the transaction
      configManager.set('rollback.value', 'modified', { transaction: transaction.id });
      configManager.set('rollback.new', 'new value', { transaction: transaction.id });
      
      // Check values before rollback
      assert.strictEqual(configManager.get('rollback.value'), 'modified');
      assert.strictEqual(configManager.get('rollback.new'), 'new value');
      
      // Rollback the transaction
      const result = configManager.rollbackTransaction(transaction);
      assert.strictEqual(result, true);
      
      // Check values after rollback
      assert.strictEqual(configManager.get('rollback.value'), 'initial');
      assert.strictEqual(configManager.has('rollback.new'), false);
    });
    
    it('should validate all changes in a transaction', () => {
      // Register schemas
      configManager.registerSchema('transaction.number', {
        type: 'number'
      });
      configManager.registerSchema('transaction.string', {
        type: 'string'
      });
      
      // Begin a transaction
      const transaction = configManager.beginTransaction();
      
      // Add valid and invalid changes
      transaction.changes.set('transaction.number', 123);
      transaction.changes.set('transaction.string', 456); // Invalid
      
      // Commit should fail due to validation
      const result = configManager.commitTransaction(transaction);
      assert.strictEqual(result, false);
      
      // Values should not be set
      assert.strictEqual(configManager.has('transaction.number'), false);
      assert.strictEqual(configManager.has('transaction.string'), false);
    });
  });
  
  describe('Environment Management', () => {
    it('should get and set the current environment', () => {
      const initialEnv = configManager.getCurrentEnvironment();
      assert.strictEqual(initialEnv, 'development'); // Default
      
      const result = configManager.setEnvironment('production');
      assert.strictEqual(result, true);
      assert.strictEqual(configManager.getCurrentEnvironment(), 'production');
    });
    
    it('should handle environment-specific overrides', () => {
      // Set base configuration
      configManager.set('env.value', 'base');
      
      // Set environment overrides
      configManager.setEnvironmentOverrides('development', {
        'env.value': 'dev'
      });
      configManager.setEnvironmentOverrides('production', {
        'env.value': 'prod'
      });
      
      // Check value in development environment
      configManager.setEnvironment('development');
      assert.strictEqual(configManager.get('env.value'), 'dev');
      
      // Check value in production environment
      configManager.setEnvironment('production');
      assert.strictEqual(configManager.get('env.value'), 'prod');
      
      // Check value in another environment
      configManager.setEnvironment('staging');
      assert.strictEqual(configManager.get('env.value'), 'base');
    });
    
    it('should get environment overrides', () => {
      const overrides = {
        'env.value1': 'override1',
        'env.value2': 'override2'
      };
      
      configManager.setEnvironmentOverrides('test', overrides);
      
      const result = configManager.getEnvironmentOverrides('test');
      assert.deepStrictEqual(result, overrides);
      
      // Non-existent environment
      const emptyResult = configManager.getEnvironmentOverrides('non-existent');
      assert.deepStrictEqual(emptyResult, {});
    });
  });
  
  describe('Feature Flags', () => {
    it('should check if a feature is enabled', () => {
      // Set feature flags
      configManager.setFeatureFlag('feature1', {
        enabled: true,
        rolloutPercentage: 100
      });
      configManager.setFeatureFlag('feature2', {
        enabled: false
      });
      configManager.setFeatureFlag('feature3', {
        enabled: true,
        rolloutPercentage: 50
      });
      
      // Check enabled feature
      assert.strictEqual(configManager.isFeatureEnabled('feature1'), true);
      
      // Check disabled feature
      assert.strictEqual(configManager.isFeatureEnabled('feature2'), false);
      
      // Check partially rolled out feature (result depends on hash)
      const feature3Result = configManager.isFeatureEnabled('feature3');
      assert.ok(typeof feature3Result === 'boolean');
      
      // Check non-existent feature
      assert.strictEqual(configManager.isFeatureEnabled('non-existent'), false);
    });
    
    it('should handle target segments', () => {
      // Set feature flag with target segments
      configManager.setFeatureFlag('segmented', {
        enabled: true,
        rolloutPercentage: 0, // 0% rollout
        targetSegments: ['admin', 'beta']
      });
      
      // Check with matching segment
      assert.strictEqual(
        configManager.isFeatureEnabled('segmented', { segments: ['admin'] }),
        true
      );
      
      // Check with non-matching segment
      assert.strictEqual(
        configManager.isFeatureEnabled('segmented', { segments: ['user'] }),
        false
      );
      
      // Check with no segment
      assert.strictEqual(
        configManager.isFeatureEnabled('segmented'),
        false
      );
    });
    
    it('should get feature rollout percentage', () => {
      configManager.setFeatureFlag('rollout-test', {
        enabled: true,
        rolloutPercentage: 75
      });
      
      const percentage = configManager.getFeatureRolloutPercentage('rollout-test');
      assert.strictEqual(percentage, 75);
      
      // Non-existent feature
      const noPercentage = configManager.getFeatureRolloutPercentage('non-existent');
      assert.strictEqual(noPercentage, 0);
    });
  });
  
  describe('Change Notifications', () => {
    it('should notify listeners of configuration changes', (done) => {
      // Register a change listener
      configManager.onConfigChange('notify.value', (event) => {
        assert.strictEqual(event.path, 'notify.value');
        assert.strictEqual(event.newValue, 'changed');
        assert.strictEqual(event.oldValue, undefined);
        done();
      });
      
      // Trigger a change
      configManager.set('notify.value', 'changed');
    });
    
    it('should notify parent path listeners', (done) => {
      // Register a change listener for parent path
      configManager.onConfigChange('parent', (event) => {
        assert.strictEqual(event.path, 'parent.child');
        assert.strictEqual(event.newValue, 'value');
        done();
      });
      
      // Trigger a change on child path
      configManager.set('parent.child', 'value');
    });
    
    it('should unregister change listeners', () => {
      let callCount = 0;
      
      // Create a listener
      const listener = () => {
        callCount++;
      };
      
      // Register the listener
      configManager.onConfigChange('unregister.test', listener);
      
      // Trigger a change
      configManager.set('unregister.test', 'value1');
      assert.strictEqual(callCount, 1);
      
      // Unregister the listener
      const result = configManager.offConfigChange('unregister.test', listener);
      assert.strictEqual(result, true);
      
      // Trigger another change
      configManager.set('unregister.test', 'value2');
      assert.strictEqual(callCount, 1); // Should not increase
    });
  });
  
  describe('File Operations', () => {
    it('should save and load configuration from file', async () => {
      // Set some configuration values
      configManager.set('file.value1', 'test1');
      configManager.set('file.value2', 'test2');
      
      // Save to file
      const saveResult = await configManager.saveToFile();
      assert.strictEqual(saveResult, true);
      
      // Create a new configuration manager
      const newConfigManager = new EnhancedConfigurationManager({
        configDir: tempDir,
        autoSave: false
      });
      
      // Load from file
      const loadResult = await newConfigManager.loadFromFile();
      assert.strictEqual(loadResult, true);
      
      // Check values
      assert.strictEqual(newConfigManager.get('file.value1'), 'test1');
      assert.strictEqual(newConfigManager.get('file.value2'), 'test2');
      
      // Clean up
      newConfigManager.dispose();
    });
    
    it('should export and import configuration as JSON', () => {
      // Set some configuration values
      configManager.set('json.value1', 'export1');
      configManager.set('json.value2', 'export2');
      
      // Register a schema
      configManager.registerSchema('json.schema', {
        type: 'string',
        version: '1.0.0'
      });
      
      // Export to JSON
      const json = configManager.exportToJSON();
      assert.ok(json.config);
      assert.ok(json.schemas);
      assert.ok(json.timestamp);
      
      // Create a new configuration manager
      const newConfigManager = new EnhancedConfigurationManager({
        configDir: tempDir,
        autoSave: false
      });
      
      // Import from JSON
      const importResult = newConfigManager.importFromJSON(json);
      assert.strictEqual(importResult, true);
      
      // Check values
      assert.strictEqual(newConfigManager.get('json.value1'), 'export1');
      assert.strictEqual(newConfigManager.get('json.value2'), 'export2');
      
      // Check schema
      const schemaVersion = newConfigManager.getSchemaVersion('json.schema');
      assert.strictEqual(schemaVersion, '1.0.0');
      
      // Clean up
      newConfigManager.dispose();
    });
  });
  
  describe('Error Handling', () => {
    it('should handle invalid paths gracefully', () => {
      // Set with invalid path
      assert.throws(() => {
        configManager.set(null, 'value');
      }, /Path is required/);
      
      // Get with invalid path
      const result = configManager.get(null);
      assert.deepStrictEqual(result, configManager.config);
      
      // Has with invalid path
      const hasResult = configManager.has(null);
      assert.strictEqual(hasResult, false);
      
      // Delete with invalid path
      assert.throws(() => {
        configManager.delete(null);
      }, /Path is required/);
    });
    
    it('should handle invalid schema registration', () => {
      assert.throws(() => {
        configManager.registerSchema(null, {});
      }, /Path and schema are required/);
      
      assert.throws(() => {
        configManager.registerSchema('path', null);
      }, /Path and schema are required/);
    });
    
    it('should handle invalid transactions', () => {
      assert.throws(() => {
        configManager.commitTransaction(null);
      }, /Invalid transaction/);
      
      assert.throws(() => {
        configManager.rollbackTransaction(null);
      }, /Invalid transaction/);
    });
    
    it('should handle invalid environment operations', () => {
      assert.throws(() => {
        configManager.setEnvironment(null);
      }, /Environment is required/);
      
      assert.throws(() => {
        configManager.setEnvironmentOverrides(null, {});
      }, /Environment and overrides are required/);
      
      assert.throws(() => {
        configManager.setEnvironmentOverrides('env', null);
      }, /Environment and overrides are required/);
    });
    
    it('should handle invalid feature flag operations', () => {
      assert.throws(() => {
        configManager.setFeatureFlag(null, {});
      }, /Feature key and options are required/);
      
      assert.throws(() => {
        configManager.setFeatureFlag('key', null);
      }, /Feature key and options are required/);
    });
    
    it('should handle invalid change listener operations', () => {
      assert.throws(() => {
        configManager.onConfigChange(null, () => {});
      }, /Path and callback are required/);
      
      assert.throws(() => {
        configManager.onConfigChange('path', null);
      }, /Path and callback are required/);
    });
  });
  
  describe('Performance', () => {
    it('should handle large configuration efficiently', () => {
      // Create a large configuration
      const start = Date.now();
      
      for (let i = 0; i < 1000; i++) {
        configManager.set(`perf.section${i}.value`, i);
      }
      
      const end = Date.now();
      const duration = end - start;
      
      // Should complete in a reasonable time (adjust threshold as needed)
      assert.ok(duration < 1000, `Large configuration operation took ${duration}ms`);
      
      // Verify values
      for (let i = 0; i < 1000; i++) {
        assert.strictEqual(configManager.get(`perf.section${i}.value`), i);
      }
    });
  });
});
