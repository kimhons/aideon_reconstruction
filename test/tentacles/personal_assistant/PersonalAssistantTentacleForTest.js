/**
 * @fileoverview Personal Assistant Tentacle for Test.
 * Test-specific implementation of the Personal Assistant Tentacle.
 * 
 * @module test/tentacles/personal_assistant/PersonalAssistantTentacleForTest
 */

const PersonalAssistantTentacle = require('../../../src/tentacles/personal_assistant/PersonalAssistantTentacle');
const MockLogger = require('../../mocks/Logger');
const MockMemoryTentacle = require('../../mocks/MemoryTentacle');
const MockSecurityFramework = require('../../mocks/SecurityFramework');
const MockModelIntegrationManager = require('../../mocks/ModelIntegrationManager');
const MockWebTentacle = require('../../mocks/WebTentacle');
const MockFileSystemTentacle = require('../../mocks/FileSystemTentacle');

/**
 * Personal Assistant Tentacle For Test
 * @extends PersonalAssistantTentacle
 */
class PersonalAssistantTentacleForTest extends PersonalAssistantTentacle {
  /**
   * Create a new Personal Assistant Tentacle For Test
   * @param {Object} config - Configuration options
   */
  constructor(config = {}) {
    // Create mock dependencies
    const dependencies = {
      logger: new MockLogger(),
      memoryTentacle: new MockMemoryTentacle(),
      securityFramework: new MockSecurityFramework(),
      modelIntegrationManager: new MockModelIntegrationManager(),
      webTentacle: new MockWebTentacle(),
      fileSystemTentacle: new MockFileSystemTentacle()
    };
    
    super(config, dependencies);
    
    // Add test-specific properties
    this.testMode = true;
    this.testEvents = [];
  }
  
  /**
   * Record test event
   * @param {string} eventType - Event type
   * @param {Object} data - Event data
   */
  recordTestEvent(eventType, data) {
    this.testEvents.push({
      type: eventType,
      data,
      timestamp: new Date()
    });
  }
  
  /**
   * Get test events
   * @returns {Array<Object>} Test events
   */
  getTestEvents() {
    return [...this.testEvents];
  }
  
  /**
   * Clear test events
   */
  clearTestEvents() {
    this.testEvents = [];
  }
}

module.exports = PersonalAssistantTentacleForTest;
