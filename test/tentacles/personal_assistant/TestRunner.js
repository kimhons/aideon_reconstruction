/**
 * @fileoverview Test runner for Personal Assistant Tentacle tests.
 * Executes all test suites for the Personal Assistant Tentacle.
 * 
 * @module test/tentacles/personal_assistant/TestRunner
 */

const PersonalAssistantTentacleIntegrationTest = require('../../../src/tentacles/personal_assistant/test/PersonalAssistantTentacleIntegrationTest');

/**
 * Personal Assistant Tentacle Test Runner
 */
class TestRunner {
  /**
   * Run all tests
   */
  static async runTests() {
    console.log('\n=== Personal Assistant Tentacle Test Runner ===\n');
    
    try {
      // Run integration tests
      await PersonalAssistantTentacleIntegrationTest.runTests();
      
      console.log('\n✅ All Personal Assistant Tentacle tests passed!\n');
      return true;
    } catch (error) {
      console.error('\n❌ Personal Assistant Tentacle tests failed:', error);
      return false;
    }
  }
}

// Run tests if this file is executed directly
if (require.main === module) {
  TestRunner.runTests()
    .then((success) => {
      process.exit(success ? 0 : 1);
    })
    .catch((error) => {
      console.error('Test runner failed:', error);
      process.exit(1);
    });
}

module.exports = TestRunner;
