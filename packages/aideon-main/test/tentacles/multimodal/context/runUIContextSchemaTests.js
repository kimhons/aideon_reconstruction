/**
 * @fileoverview Test runner for UI Context Schema tests.
 * 
 * This module runs the tests for UI Context Schemas in the Aideon AI Desktop Agent
 * using a simple custom test harness.
 * 
 * @author Aideon AI Team
 * @version 1.0.0
 */

const path = require('path');
const assert = require('assert');

// Configure module resolver
global.requireModule = (modulePath) => {
  try {
    return require(path.resolve(__dirname, '../../../..', modulePath));
  } catch (error) {
    // Handle special cases for test mocks
    if (modulePath.includes('UIContextSchemas')) {
      return require('./schemas/UIContextSchemas');
    } else if (modulePath.includes('EnhancedAsyncLockAdapter')) {
      return require('./mocks/EnhancedAsyncLockAdapter');
    } else {
      console.error(`Failed to resolve module: ${modulePath}`, error);
      throw error;
    }
  }
};

// Import UI Context Schemas
const {
  uiStateCurrentSchema,
  uiStateHistorySchema,
  uiInteractionEventSchema,
  uiInteractionPatternSchema,
  uiPreferenceSettingSchema,
  uiPreferenceDefaultSchema,
  uiAccessibilityRequirementSchema,
  uiAccessibilityAdaptationSchema,
  uiThemeCurrentSchema,
  uiThemeCustomizationSchema,
  validateContextSchema
} = requireModule('src/tentacles/multimodal/context/schemas/UIContextSchemas');

// Simple test harness
class TestHarness {
  constructor() {
    this.tests = [];
    this.currentSuite = null;
    this.passed = 0;
    this.failed = 0;
    this.errors = [];
  }

  describe(name, fn) {
    console.log(`\n📋 Test Suite: ${name}`);
    const previousSuite = this.currentSuite;
    this.currentSuite = name;
    fn();
    this.currentSuite = previousSuite;
  }

  it(name, fn) {
    this.tests.push({
      suite: this.currentSuite,
      name,
      fn
    });
  }

  async runTests() {
    console.log('\n🚀 Starting tests...\n');
    
    for (const test of this.tests) {
      try {
        await test.fn();
        console.log(`✅ [${test.suite}] ${test.name}`);
        this.passed++;
      } catch (error) {
        console.error(`❌ [${test.suite}] ${test.name}`);
        console.error(`   Error: ${error.message}`);
        this.failed++;
        this.errors.push({
          suite: test.suite,
          name: test.name,
          error
        });
      }
    }
    
    console.log(`\n📊 Test Results: ${this.passed} passed, ${this.failed} failed`);
    
    if (this.failed > 0) {
      console.error('\n❌ Failed Tests:');
      for (const error of this.errors) {
        console.error(`   [${error.suite}] ${error.name}`);
        console.error(`   Error: ${error.error.message}`);
        console.error('   Stack:', error.error.stack);
        console.error('');
      }
      return false;
    }
    
    return true;
  }
}

// Create test harness and expose methods
const testHarness = new TestHarness();
const describe = testHarness.describe.bind(testHarness);
const it = testHarness.it.bind(testHarness);

// Define tests
describe('UI State Schemas', () => {
  it('should validate valid UI state current context', () => {
    const validContext = {
      version: '1.0.0',
      timestamp: Date.now(),
      state: 'ready',
      viewId: 'dashboard',
      viewData: {
        widgets: ['cpu', 'memory', 'disk']
      },
      modalState: {
        isOpen: false
      },
      navigationStack: ['home', 'settings', 'dashboard']
    };
    
    const result = validateContextSchema(validContext, uiStateCurrentSchema);
    assert.strictEqual(result.isValid, true, 'Valid context should pass validation');
    assert.strictEqual(result.errors.length, 0, 'Valid context should have no errors');
  });
  
  it('should reject invalid UI state current context', () => {
    const invalidContext = {
      version: '1.0.0',
      timestamp: Date.now(),
      state: 'invalid_state', // Invalid enum value
      viewId: 'dashboard'
    };
    
    const result = validateContextSchema(invalidContext, uiStateCurrentSchema);
    assert.strictEqual(result.isValid, false, 'Invalid context should fail validation');
    assert.ok(result.errors.length > 0, 'Invalid context should have errors');
  });
  
  it('should validate valid UI state history context', () => {
    const validContext = {
      version: '1.0.0',
      timestamp: Date.now(),
      stateHistory: [
        {
          state: 'loading',
          viewId: 'dashboard',
          timestamp: Date.now() - 5000,
          duration: 2000
        },
        {
          state: 'ready',
          viewId: 'dashboard',
          timestamp: Date.now() - 3000,
          duration: 3000
        }
      ],
      maxHistoryLength: 10
    };
    
    const result = validateContextSchema(validContext, uiStateHistorySchema);
    assert.strictEqual(result.isValid, true, 'Valid context should pass validation');
    assert.strictEqual(result.errors.length, 0, 'Valid context should have no errors');
  });
});

describe('UI Interaction Schemas', () => {
  it('should validate valid UI interaction event context', () => {
    const validContext = {
      version: '1.0.0',
      timestamp: Date.now(),
      eventType: 'click',
      elementId: 'submit-button',
      elementType: 'button',
      viewId: 'login-form',
      value: null,
      position: {
        x: 100,
        y: 200
      },
      metadata: {
        durationMs: 50
      }
    };
    
    const result = validateContextSchema(validContext, uiInteractionEventSchema);
    assert.strictEqual(result.isValid, true, 'Valid context should pass validation');
    assert.strictEqual(result.errors.length, 0, 'Valid context should have no errors');
  });
  
  it('should validate valid UI interaction pattern context', () => {
    const validContext = {
      version: '1.0.0',
      timestamp: Date.now(),
      patternType: 'form-filling',
      confidence: 0.85,
      events: [
        {
          eventType: 'click',
          elementId: 'username-input',
          timestamp: Date.now() - 5000
        },
        {
          eventType: 'input',
          elementId: 'username-input',
          timestamp: Date.now() - 4000
        }
      ],
      frequency: 5,
      lastObserved: Date.now() - 60000,
      metadata: {
        averageCompletionTimeMs: 12000
      }
    };
    
    const result = validateContextSchema(validContext, uiInteractionPatternSchema);
    assert.strictEqual(result.isValid, true, 'Valid context should pass validation');
    assert.strictEqual(result.errors.length, 0, 'Valid context should have no errors');
  });
});

describe('UI Preference Schemas', () => {
  it('should validate valid UI preference setting context', () => {
    const validContext = {
      version: '1.0.0',
      timestamp: Date.now(),
      preferenceId: 'notification-frequency',
      category: 'notifications',
      value: 'hourly',
      defaultValue: 'daily',
      scope: 'user',
      metadata: {
        lastModifiedBy: 'user-settings-panel'
      }
    };
    
    const result = validateContextSchema(validContext, uiPreferenceSettingSchema);
    assert.strictEqual(result.isValid, true, 'Valid context should pass validation');
    assert.strictEqual(result.errors.length, 0, 'Valid context should have no errors');
  });
  
  it('should validate valid UI preference default context', () => {
    const validContext = {
      version: '1.0.0',
      timestamp: Date.now(),
      defaults: {
        'notification-frequency': 'daily',
        'theme': 'system',
        'language': 'en-US'
      },
      userTier: 'pro',
      platform: 'windows',
      version: '1.2.0'
    };
    
    const result = validateContextSchema(validContext, uiPreferenceDefaultSchema);
    assert.strictEqual(result.isValid, true, 'Valid context should pass validation');
    assert.strictEqual(result.errors.length, 0, 'Valid context should have no errors');
  });
});

describe('UI Accessibility Schemas', () => {
  it('should validate valid UI accessibility requirement context', () => {
    const validContext = {
      version: '1.0.0',
      timestamp: Date.now(),
      requirements: [
        {
          type: 'screenReader',
          enabled: true,
          level: 'high',
          customSettings: {
            speed: 1.5
          }
        },
        {
          type: 'highContrast',
          enabled: true,
          level: 'medium'
        }
      ],
      detectionMethod: 'systemSetting',
      lastUpdated: Date.now() - 86400000
    };
    
    const result = validateContextSchema(validContext, uiAccessibilityRequirementSchema);
    assert.strictEqual(result.isValid, true, 'Valid context should pass validation');
    assert.strictEqual(result.errors.length, 0, 'Valid context should have no errors');
  });
  
  it('should validate valid UI accessibility adaptation context', () => {
    const validContext = {
      version: '1.0.0',
      timestamp: Date.now(),
      adaptations: [
        {
          type: 'textSize',
          elementId: 'main-content',
          viewId: 'dashboard',
          adaptation: {
            fontSize: '1.5rem'
          },
          requirement: 'largeText'
        },
        {
          type: 'contrast',
          elementId: 'sidebar',
          viewId: 'dashboard',
          adaptation: {
            backgroundColor: '#000000',
            textColor: '#ffffff'
          },
          requirement: 'highContrast'
        }
      ],
      globalAdaptations: {
        focusIndicatorSize: '3px',
        animationSpeed: 0.5
      }
    };
    
    const result = validateContextSchema(validContext, uiAccessibilityAdaptationSchema);
    assert.strictEqual(result.isValid, true, 'Valid context should pass validation');
    assert.strictEqual(result.errors.length, 0, 'Valid context should have no errors');
  });
});

describe('UI Theme Schemas', () => {
  it('should validate valid UI theme current context', () => {
    const validContext = {
      version: '1.0.0',
      timestamp: Date.now(),
      themeId: 'dark-pro',
      name: 'Dark Professional',
      colorScheme: 'dark',
      colors: {
        primary: '#3f51b5',
        secondary: '#f50057',
        background: '#121212',
        surface: '#1e1e1e',
        error: '#cf6679',
        text: {
          primary: '#ffffff',
          secondary: '#b0b0b0',
          disabled: '#707070'
        }
      },
      typography: {
        fontFamily: 'Roboto, sans-serif',
        fontSize: 16
      },
      spacing: {
        unit: 8
      },
      isBuiltIn: true
    };
    
    const result = validateContextSchema(validContext, uiThemeCurrentSchema);
    assert.strictEqual(result.isValid, true, 'Valid context should pass validation');
    assert.strictEqual(result.errors.length, 0, 'Valid context should have no errors');
  });
  
  it('should validate valid UI theme customization context', () => {
    const validContext = {
      version: '1.0.0',
      timestamp: Date.now(),
      baseThemeId: 'dark-pro',
      customizations: {
        colors: {
          primary: '#00bcd4',
          secondary: '#ff4081'
        },
        typography: {
          fontSize: 18
        }
      },
      name: 'My Custom Dark Theme',
      author: 'user123',
      isShared: false
    };
    
    const result = validateContextSchema(validContext, uiThemeCustomizationSchema);
    assert.strictEqual(result.isValid, true, 'Valid context should pass validation');
    assert.strictEqual(result.errors.length, 0, 'Valid context should have no errors');
  });
});

describe('Schema Validation Function', () => {
  it('should check required properties', () => {
    const schema = {
      required: ['prop1', 'prop2'],
      properties: {
        prop1: { type: 'string' },
        prop2: { type: 'number' }
      }
    };
    
    const validData = { prop1: 'value', prop2: 42 };
    const invalidData = { prop1: 'value' };
    
    const validResult = validateContextSchema(validData, schema);
    const invalidResult = validateContextSchema(invalidData, schema);
    
    assert.strictEqual(validResult.isValid, true, 'Data with all required properties should be valid');
    assert.strictEqual(invalidResult.isValid, false, 'Data missing required properties should be invalid');
  });
  
  it('should check property types', () => {
    const schema = {
      properties: {
        stringProp: { type: 'string' },
        numberProp: { type: 'number' },
        booleanProp: { type: 'boolean' },
        objectProp: { type: 'object' },
        arrayProp: { type: 'array' },
        nullProp: { type: 'null' },
        multiTypeProp: { type: ['string', 'number'] }
      }
    };
    
    const validData = {
      stringProp: 'value',
      numberProp: 42,
      booleanProp: true,
      objectProp: { key: 'value' },
      arrayProp: [1, 2, 3],
      nullProp: null,
      multiTypeProp: 'value'
    };
    
    const invalidData = {
      stringProp: 42,
      numberProp: 'value',
      booleanProp: 'true',
      objectProp: [1, 2, 3],
      arrayProp: { key: 'value' },
      nullProp: undefined,
      multiTypeProp: true
    };
    
    const validResult = validateContextSchema(validData, schema);
    const invalidResult = validateContextSchema(invalidData, schema);
    
    assert.strictEqual(validResult.isValid, true, 'Data with correct property types should be valid');
    assert.strictEqual(invalidResult.isValid, false, 'Data with incorrect property types should be invalid');
  });
  
  it('should check enum values', () => {
    const schema = {
      properties: {
        enumProp: { type: 'string', enum: ['value1', 'value2', 'value3'] }
      }
    };
    
    const validData = { enumProp: 'value2' };
    const invalidData = { enumProp: 'value4' };
    
    const validResult = validateContextSchema(validData, schema);
    const invalidResult = validateContextSchema(invalidData, schema);
    
    assert.strictEqual(validResult.isValid, true, 'Data with valid enum value should be valid');
    assert.strictEqual(invalidResult.isValid, false, 'Data with invalid enum value should be invalid');
  });
});

// Run tests
(async () => {
  try {
    // Add timeout to prevent hanging
    const testTimeout = setTimeout(() => {
      console.error('Test execution timed out after 10 seconds');
      process.exit(1);
    }, 10000);
    
    console.log('=== Running UI Context Schema Tests ===');
    const success = await testHarness.runTests();
    
    // Clear timeout if tests complete successfully
    clearTimeout(testTimeout);
    
    if (success) {
      console.log('=== UI Context Schema Tests Completed Successfully ===');
    } else {
      console.error('=== UI Context Schema Tests Failed ===');
      process.exit(1);
    }
  } catch (error) {
    console.error('Error running UI Context Schema tests:', error);
    process.exit(1);
  }
})();
