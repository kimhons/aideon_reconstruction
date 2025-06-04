/**
 * @fileoverview Tests for the Enhanced Configuration System.
 * 
 * @module core/config/ConfigTests
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const os = require('os');
const ConfigurationManager = require('./ConfigurationManager');

class ConfigTestSuite {
  constructor() {
    this.testDir = path.join(os.tmpdir(), 'aideon-config-test-' + Date.now());
    fs.mkdirSync(this.testDir, { recursive: true });
    
    this.tests = [
      this.testSchemaDefinition,
      this.testConfigLoading,
      this.testConfigSaving,
      this.testConfigGetSet,
      this.testConfigUpdate,
      this.testConfigReset,
      this.testConfigValidation,
      this.testContextProviders,
      this.testContextOverrides,
      this.testChangeSubscription,
      this.testMetricsIntegration
    ];
  }
  
  async run() {
    console.log('Running Enhanced Configuration System Tests...');
    
    const results = {
      total: this.tests.length,
      passed: 0,
      failed: 0,
      details: []
    };
    
    for (const test of this.tests) {
      const testName = test.name;
      console.log(`Running test: ${testName}`);
      
      try {
        await test.call(this);
        results.passed++;
        results.details.push({
          name: testName,
          status: 'passed'
        });
        console.log(`✓ ${testName} passed`);
      } catch (error) {
        results.failed++;
        results.details.push({
          name: testName,
          status: 'failed',
          error: error.message
        });
        console.error(`✗ ${testName} failed: ${error.message}`);
      }
    }
    
    // Clean up test directory
    try {
      this.cleanupTestDir();
    } catch (error) {
      console.error('Error cleaning up test directory:', error);
    }
    
    // Calculate confidence interval
    const passRate = results.passed / results.total;
    const z = 1.96; // 95% confidence
    const interval = z * Math.sqrt((passRate * (1 - passRate)) / results.total);
    
    results.passRate = passRate * 100;
    results.confidenceInterval = interval * 100;
    
    console.log('\nTest Results:');
    console.log(`Total: ${results.total}`);
    console.log(`Passed: ${results.passed}`);
    console.log(`Failed: ${results.failed}`);
    console.log(`Pass Rate: ${results.passRate.toFixed(2)}%`);
    console.log(`Confidence Interval: ±${results.confidenceInterval.toFixed(2)}%`);
    
    return results;
  }
  
  cleanupTestDir() {
    const deleteRecursive = (dirPath) => {
      if (fs.existsSync(dirPath)) {
        fs.readdirSync(dirPath).forEach((file) => {
          const curPath = path.join(dirPath, file);
          if (fs.lstatSync(curPath).isDirectory()) {
            deleteRecursive(curPath);
          } else {
            fs.unlinkSync(curPath);
          }
        });
        fs.rmdirSync(dirPath);
      }
    };
    
    deleteRecursive(this.testDir);
  }
  
  async testSchemaDefinition() {
    const configManager = new ConfigurationManager({
      configDir: path.join(this.testDir, 'config1'),
      enableAutoSave: false
    });
    
    // Test valid schema definition
    assert.strictEqual(
      configManager.defineConfigSchema('test', {
        properties: {
          testString: {
            type: 'string',
            default: 'default value'
          },
          testNumber: {
            type: 'number',
            default: 42
          }
        }
      }),
      true,
      'Should return true for valid schema definition'
    );
    
    // Test schema definition with missing namespace
    assert.throws(
      () => configManager.defineConfigSchema(null, {}),
      /Configuration namespace is required/,
      'Should throw error for missing namespace'
    );
    
    // Test schema definition with invalid schema
    assert.throws(
      () => configManager.defineConfigSchema('invalid', null),
      /Configuration schema must be a valid JSON Schema object/,
      'Should throw error for invalid schema'
    );
    
    // Test schema definition exists in internal storage
    assert.deepStrictEqual(
      configManager.schemas['test'].namespace,
      'test',
      'Schema definition should be stored internally'
    );
    
    await configManager.stop();
  }
  
  async testConfigLoading() {
    const configDir = path.join(this.testDir, 'config2');
    fs.mkdirSync(configDir, { recursive: true });
    
    // Create a test config file
    const testConfig = {
      testString: 'file value',
      testNumber: 100
    };
    
    fs.writeFileSync(
      path.join(configDir, 'test.json'),
      JSON.stringify(testConfig),
      'utf8'
    );
    
    const configManager = new ConfigurationManager({
      configDir,
      enableAutoSave: false,
      enableWatchers: false
    });
    
    // Define schema
    configManager.defineConfigSchema('test', {
      properties: {
        testString: {
          type: 'string',
          default: 'default value'
        },
        testNumber: {
          type: 'number',
          default: 42
        }
      }
    });
    
    // Test loading existing config
    const loadedConfig = configManager.loadConfig('test');
    
    assert.strictEqual(
      loadedConfig.testString,
      'file value',
      'Should load value from file'
    );
    
    assert.strictEqual(
      loadedConfig.testNumber,
      100,
      'Should load value from file'
    );
    
    // Test loading non-existent config
    configManager.defineConfigSchema('nonexistent', {
      properties: {
        testProperty: {
          type: 'string',
          default: 'default'
        }
      }
    });
    
    const defaultConfig = configManager.loadConfig('nonexistent');
    
    assert.strictEqual(
      defaultConfig.testProperty,
      'default',
      'Should load default value for non-existent config'
    );
    
    // Verify file was created with defaults
    assert.strictEqual(
      fs.existsSync(path.join(configDir, 'nonexistent.json')),
      true,
      'Should create config file with defaults'
    );
    
    await configManager.stop();
  }
  
  async testConfigSaving() {
    const configDir = path.join(this.testDir, 'config3');
    
    const configManager = new ConfigurationManager({
      configDir,
      enableAutoSave: false,
      enableWatchers: false
    });
    
    // Define schema
    configManager.defineConfigSchema('test', {
      properties: {
        testString: {
          type: 'string',
          default: 'default value'
        },
        testNumber: {
          type: 'number',
          default: 42
        }
      }
    });
    
    // Load config (creates with defaults)
    configManager.loadConfig('test');
    
    // Modify config
    configManager.configs['test'].testString = 'modified value';
    
    // Save config
    const saveResult = configManager.saveConfig('test');
    
    assert.strictEqual(
      saveResult,
      true,
      'Save should return true on success'
    );
    
    // Verify file was saved with modified value
    const fileContent = fs.readFileSync(
      path.join(configDir, 'test.json'),
      'utf8'
    );
    const savedConfig = JSON.parse(fileContent);
    
    assert.strictEqual(
      savedConfig.testString,
      'modified value',
      'Saved file should contain modified value'
    );
    
    // Test saveAll
    configManager.defineConfigSchema('test2', {
      properties: {
        anotherProperty: {
          type: 'string',
          default: 'another default'
        }
      }
    });
    
    configManager.loadConfig('test2');
    configManager.configs['test2'].anotherProperty = 'another modified';
    
    const saveAllResult = configManager.saveAll();
    
    assert.strictEqual(
      saveAllResult,
      true,
      'SaveAll should return true on success'
    );
    
    // Verify both files were saved
    const fileContent2 = fs.readFileSync(
      path.join(configDir, 'test2.json'),
      'utf8'
    );
    const savedConfig2 = JSON.parse(fileContent2);
    
    assert.strictEqual(
      savedConfig2.anotherProperty,
      'another modified',
      'Second saved file should contain modified value'
    );
    
    await configManager.stop();
  }
  
  async testConfigGetSet() {
    const configManager = new ConfigurationManager({
      configDir: path.join(this.testDir, 'config4'),
      enableAutoSave: false
    });
    
    // Define schema
    configManager.defineConfigSchema('test', {
      properties: {
        testString: {
          type: 'string',
          default: 'default value'
        },
        testNumber: {
          type: 'number',
          default: 42
        }
      }
    });
    
    // Test get (loads config if not loaded)
    const testString = configManager.get('test', 'testString');
    
    assert.strictEqual(
      testString,
      'default value',
      'Get should return default value'
    );
    
    // Test get entire config
    const entireConfig = configManager.get('test');
    
    assert.deepStrictEqual(
      entireConfig,
      {
        testString: 'default value',
        testNumber: 42
      },
      'Get without key should return entire config'
    );
    
    // Test set
    const setResult = configManager.set('test', 'testString', 'new value');
    
    assert.strictEqual(
      setResult,
      true,
      'Set should return true on success'
    );
    
    assert.strictEqual(
      configManager.get('test', 'testString'),
      'new value',
      'Get should return updated value after set'
    );
    
    // Test set with validation failure
    assert.throws(
      () => configManager.set('test', 'testNumber', 'not a number'),
      /Invalid type for configuration property testNumber/,
      'Set should throw error for invalid value'
    );
    
    // Verify value was not changed
    assert.strictEqual(
      configManager.get('test', 'testNumber'),
      42,
      'Value should not change on validation failure'
    );
    
    await configManager.stop();
  }
  
  async testConfigUpdate() {
    const configManager = new ConfigurationManager({
      configDir: path.join(this.testDir, 'config5'),
      enableAutoSave: false
    });
    
    // Define schema
    configManager.defineConfigSchema('test', {
      properties: {
        testString: {
          type: 'string',
          default: 'default value'
        },
        testNumber: {
          type: 'number',
          default: 42
        },
        testBoolean: {
          type: 'boolean',
          default: false
        }
      }
    });
    
    // Load config
    configManager.loadConfig('test');
    
    // Test update
    const updateResult = configManager.update('test', {
      testString: 'updated value',
      testNumber: 100,
      testBoolean: true
    });
    
    assert.strictEqual(
      updateResult,
      true,
      'Update should return true on success'
    );
    
    // Verify values were updated
    assert.strictEqual(
      configManager.get('test', 'testString'),
      'updated value',
      'String value should be updated'
    );
    
    assert.strictEqual(
      configManager.get('test', 'testNumber'),
      100,
      'Number value should be updated'
    );
    
    assert.strictEqual(
      configManager.get('test', 'testBoolean'),
      true,
      'Boolean value should be updated'
    );
    
    // Test update with validation failure
    assert.throws(
      () => configManager.update('test', {
        testNumber: 'not a number'
      }),
      /Invalid type for configuration property testNumber/,
      'Update should throw error for invalid value'
    );
    
    // Verify no values were changed
    assert.strictEqual(
      configManager.get('test', 'testNumber'),
      100,
      'Values should not change on validation failure'
    );
    
    await configManager.stop();
  }
  
  async testConfigReset() {
    const configManager = new ConfigurationManager({
      configDir: path.join(this.testDir, 'config6'),
      enableAutoSave: false
    });
    
    // Define schema
    configManager.defineConfigSchema('test', {
      properties: {
        testString: {
          type: 'string',
          default: 'default value'
        },
        testNumber: {
          type: 'number',
          default: 42
        },
        testBoolean: {
          type: 'boolean',
          default: false
        }
      }
    });
    
    // Load and modify config
    configManager.loadConfig('test');
    configManager.set('test', 'testString', 'modified value');
    configManager.set('test', 'testNumber', 100);
    configManager.set('test', 'testBoolean', true);
    
    // Test reset specific key
    const resetResult = configManager.reset('test', 'testString');
    
    assert.strictEqual(
      resetResult,
      true,
      'Reset should return true on success'
    );
    
    assert.strictEqual(
      configManager.get('test', 'testString'),
      'default value',
      'Reset key should revert to default value'
    );
    
    assert.strictEqual(
      configManager.get('test', 'testNumber'),
      100,
      'Other keys should not be affected by specific key reset'
    );
    
    // Test reset all
    const resetAllResult = configManager.reset('test');
    
    assert.strictEqual(
      resetAllResult,
      true,
      'Reset all should return true on success'
    );
    
    assert.deepStrictEqual(
      configManager.get('test'),
      {
        testString: 'default value',
        testNumber: 42,
        testBoolean: false
      },
      'Reset all should revert all keys to default values'
    );
    
    await configManager.stop();
  }
  
  async testConfigValidation() {
    const configManager = new ConfigurationManager({
      configDir: path.join(this.testDir, 'config7'),
      enableAutoSave: false
    });
    
    // Define schema with various validation rules
    configManager.defineConfigSchema('validation', {
      properties: {
        requiredString: {
          type: 'string',
          required: true,
          default: 'required value'
        },
        enumString: {
          type: 'string',
          enum: ['option1', 'option2', 'option3'],
          default: 'option1'
        },
        rangeNumber: {
          type: 'number',
          minimum: 0,
          maximum: 100,
          default: 50
        },
        integerValue: {
          type: 'integer',
          minimum: 1,
          maximum: 10,
          default: 5
        }
      }
    });
    
    // Load config
    configManager.loadConfig('validation');
    
    // Test validation success
    assert.strictEqual(
      configManager.validateConfig('validation'),
      true,
      'Validation should succeed for valid config'
    );
    
    // Test required property
    configManager.configs['validation'].requiredString = undefined;
    assert.throws(
      () => configManager.validateConfig('validation'),
      /Required configuration property missing/,
      'Validation should fail for missing required property'
    );
    configManager.configs['validation'].requiredString = 'required value';
    
    // Test enum validation
    configManager.configs['validation'].enumString = 'invalid option';
    assert.throws(
      () => configManager.validateConfig('validation'),
      /Invalid value for configuration property enumString/,
      'Validation should fail for invalid enum value'
    );
    configManager.configs['validation'].enumString = 'option2';
    
    // Test range validation
    configManager.configs['validation'].rangeNumber = 101;
    assert.throws(
      () => configManager.validateConfig('validation'),
      /Invalid value for configuration property rangeNumber/,
      'Validation should fail for number above maximum'
    );
    configManager.configs['validation'].rangeNumber = -1;
    assert.throws(
      () => configManager.validateConfig('validation'),
      /Invalid value for configuration property rangeNumber/,
      'Validation should fail for number below minimum'
    );
    configManager.configs['validation'].rangeNumber = 75;
    
    // Test integer validation
    configManager.configs['validation'].integerValue = 5.5;
    assert.throws(
      () => configManager.validateConfig('validation'),
      /Invalid type for configuration property integerValue/,
      'Validation should fail for non-integer value'
    );
    configManager.configs['validation'].integerValue = 7;
    
    // Verify validation passes after fixing all issues
    assert.strictEqual(
      configManager.validateConfig('validation'),
      true,
      'Validation should succeed after fixing all issues'
    );
    
    await configManager.stop();
  }
  
  async testContextProviders() {
    const configManager = new ConfigurationManager({
      configDir: path.join(this.testDir, 'config8'),
      enableAutoSave: false
    });
    
    // Test registering context provider
    assert.strictEqual(
      configManager.registerContextProvider('test.context', () => 'context value'),
      true,
      'Register context provider should return true on success'
    );
    
    // Test registering with missing key
    assert.throws(
      () => configManager.registerContextProvider(null, () => {}),
      /Context key is required/,
      'Register should throw error for missing key'
    );
    
    // Test registering with missing function
    assert.throws(
      () => configManager.registerContextProvider('test.context2', null),
      /Provider function is required/,
      'Register should throw error for missing function'
    );
    
    // Test getting context value
    assert.strictEqual(
      configManager.getContextValue('test.context'),
      'context value',
      'Get context value should return value from provider'
    );
    
    // Test getting with missing key
    assert.throws(
      () => configManager.getContextValue(null),
      /Context key is required/,
      'Get should throw error for missing key'
    );
    
    // Test getting with unregistered key
    assert.throws(
      () => configManager.getContextValue('unregistered.context'),
      /Context provider not registered for key/,
      'Get should throw error for unregistered key'
    );
    
    // Test provider that throws error
    configManager.registerContextProvider('error.context', () => {
      throw new Error('Provider error');
    });
    
    assert.strictEqual(
      configManager.getContextValue('error.context'),
      null,
      'Get should return null when provider throws error'
    );
    
    await configManager.stop();
  }
  
  async testContextOverrides() {
    const configManager = new ConfigurationManager({
      configDir: path.join(this.testDir, 'config9'),
      enableAutoSave: false
    });
    
    // Define schema
    configManager.defineConfigSchema('test', {
      properties: {
        overridableValue: {
          type: 'number',
          default: 50
        },
        normalValue: {
          type: 'string',
          default: 'normal'
        }
      }
    });
    
    // Register context provider
    configManager.registerContextProvider('test.mode', () => 'mode1');
    
    // Define context override
    assert.strictEqual(
      configManager.defineContextOverride('test.overridableValue', {
        context: 'test.mode',
        values: {
          'mode1': 100,
          'mode2': 200
        }
      }),
      true,
      'Define context override should return true on success'
    );
    
    // Test defining with missing path
    assert.throws(
      () => configManager.defineContextOverride(null, { context: 'test.mode', values: {} }),
      /Configuration path is required/,
      'Define should throw error for missing path'
    );
    
    // Test defining with invalid override
    assert.throws(
      () => configManager.defineContextOverride('test.overridableValue', null),
      /Override definition is invalid/,
      'Define should throw error for invalid override'
    );
    
    // Load config and verify override is applied
    configManager.loadConfig('test');
    
    assert.strictEqual(
      configManager.get('test', 'overridableValue'),
      100,
      'Override should be applied based on context value'
    );
    
    assert.strictEqual(
      configManager.get('test', 'normalValue'),
      'normal',
      'Non-overridden values should not be affected'
    );
    
    // Change context value and verify override changes
    configManager.contextProviders['test.mode'] = () => 'mode2';
    configManager.applyContextOverrides('test');
    
    assert.strictEqual(
      configManager.get('test', 'overridableValue'),
      200,
      'Override should change when context value changes'
    );
    
    // Change to unmatched context value and verify original value is restored
    configManager.contextProviders['test.mode'] = () => 'mode3';
    configManager.applyContextOverrides('test');
    
    assert.strictEqual(
      configManager.get('test', 'overridableValue'),
      50,
      'Original value should be restored when context value has no mapping'
    );
    
    await configManager.stop();
  }
  
  async testChangeSubscription() {
    const configManager = new ConfigurationManager({
      configDir: path.join(this.testDir, 'config10'),
      enableAutoSave: false
    });
    
    // Define schema
    configManager.defineConfigSchema('test', {
      properties: {
        testValue: {
          type: 'string',
          default: 'default'
        }
      }
    });
    
    // Load config
    configManager.loadConfig('test');
    
    // Set up subscription
    let changeEvent = null;
    const unsubscribe = configManager.subscribeToChanges((event) => {
      changeEvent = event;
    });
    
    // Modify config and verify event is emitted
    configManager.set('test', 'testValue', 'modified');
    
    assert.strictEqual(
      changeEvent !== null,
      true,
      'Change event should be emitted on set'
    );
    
    assert.strictEqual(
      changeEvent.namespace,
      'test',
      'Change event should have correct namespace'
    );
    
    assert.deepStrictEqual(
      changeEvent.changes.testValue,
      { oldValue: 'default', newValue: 'modified' },
      'Change event should contain correct change details'
    );
    
    // Reset event and unsubscribe
    changeEvent = null;
    unsubscribe();
    
    // Modify again and verify no event
    configManager.set('test', 'testValue', 'modified again');
    
    assert.strictEqual(
      changeEvent,
      null,
      'No event should be emitted after unsubscribe'
    );
    
    // Test namespace-specific subscription
    let namespaceEvent = null;
    const namespaceUnsubscribe = configManager.subscribeToChanges((event) => {
      namespaceEvent = event;
    }, 'test');
    
    // Define another namespace
    configManager.defineConfigSchema('other', {
      properties: {
        otherValue: {
          type: 'string',
          default: 'other default'
        }
      }
    });
    
    configManager.loadConfig('other');
    
    // Modify other namespace and verify no event
    configManager.set('other', 'otherValue', 'other modified');
    
    assert.strictEqual(
      namespaceEvent,
      null,
      'No event should be emitted for different namespace'
    );
    
    // Modify target namespace and verify event
    configManager.set('test', 'testValue', 'final value');
    
    assert.strictEqual(
      namespaceEvent !== null,
      true,
      'Event should be emitted for target namespace'
    );
    
    namespaceUnsubscribe();
    
    await configManager.stop();
  }
  
  async testMetricsIntegration() {
    // Create mock metrics collector
    const mockMetrics = {
      recordedMetrics: [],
      definedMetrics: [],
      definedDimensions: [],
      
      defineMetric(name, type, description, options) {
        this.definedMetrics.push({ name, type, description, options });
        return true;
      },
      
      defineDimension(name, description, allowedValues) {
        this.definedDimensions.push({ name, description, allowedValues });
        return true;
      },
      
      recordMetric(name, value, dimensions) {
        this.recordedMetrics.push({ name, value, dimensions });
        return true;
      }
    };
    
    const configManager = new ConfigurationManager({
      configDir: path.join(this.testDir, 'config11'),
      enableAutoSave: false,
      metricsCollector: mockMetrics
    });
    
    // Verify metrics were defined
    assert.strictEqual(
      mockMetrics.definedMetrics.length > 0,
      true,
      'Metrics should be defined when metrics collector is provided'
    );
    
    assert.strictEqual(
      mockMetrics.definedDimensions.length > 0,
      true,
      'Dimensions should be defined when metrics collector is provided'
    );
    
    // Define schema and load config
    configManager.defineConfigSchema('test', {
      properties: {
        testValue: {
          type: 'string',
          default: 'default'
        }
      }
    });
    
    configManager.loadConfig('test');
    
    // Verify load time metric was recorded
    const loadTimeMetric = mockMetrics.recordedMetrics.find(
      m => m.name === 'config.load.time' && m.dimensions['config.namespace'] === 'test'
    );
    
    assert.strictEqual(
      loadTimeMetric !== undefined,
      true,
      'Load time metric should be recorded for test namespace'
    );
    
    // Modify config and verify change metric
    mockMetrics.recordedMetrics = []; // Clear previous metrics
    configManager.set('test', 'testValue', 'modified');
    
    const changeMetric = mockMetrics.recordedMetrics.find(
      m => m.name === 'config.changes'
    );
    
    assert.strictEqual(
      changeMetric !== undefined,
      true,
      'Change metric should be recorded'
    );
    
    assert.strictEqual(
      changeMetric.dimensions['config.namespace'],
      'test',
      'Change metric should have correct namespace dimension'
    );
    
    assert.strictEqual(
      changeMetric.dimensions['config.key'],
      'testValue',
      'Change metric should have correct key dimension'
    );
    
    // Test context override metric
    mockMetrics.recordedMetrics = []; // Clear previous metrics
    
    configManager.registerContextProvider('test.mode', () => 'mode1');
    
    configManager.defineContextOverride('test.testValue', {
      context: 'test.mode',
      values: {
        'mode1': 'override value'
      }
    });
    
    const adaptationMetric = mockMetrics.recordedMetrics.find(
      m => m.name === 'config.adaptations'
    );
    
    assert.strictEqual(
      adaptationMetric !== undefined,
      true,
      'Adaptation metric should be recorded'
    );
    
    assert.strictEqual(
      adaptationMetric.dimensions['config.context'],
      'test.mode',
      'Adaptation metric should have correct context dimension'
    );
    
    await configManager.stop();
  }
}

// Run tests if this file is executed directly
if (require.main === module) {
  const testSuite = new ConfigTestSuite();
  testSuite.run().then(results => {
    process.exit(results.failed > 0 ? 1 : 0);
  });
}

module.exports = ConfigTestSuite;
