/**
 * @fileoverview Test runner for MCP Phase 4 Enterprise Integration Tests.
 * 
 * This module runs the comprehensive integration tests for Phase 4 components:
 * - TeamContextSharingManager
 * - EnterpriseContextConnector
 * - ContextSynchronizationService
 * - ContextComplianceManager
 * 
 * @author Aideon AI Team
 * @version 1.0.0
 */

const Mocha = require('mocha');
const path = require('path');

// Create Mocha instance
const mocha = new Mocha({
  timeout: 10000, // 10 seconds
  reporter: 'spec',
  ui: 'bdd'
});

// Add test file
mocha.addFile(path.join(__dirname, 'Phase4EnterpriseIntegrationTests.js'));

// Run tests
console.log('Running MCP Phase 4 Enterprise Integration Tests...');
console.log('=================================================');

mocha.run(failures => {
  process.exitCode = failures ? 1 : 0;
  
  if (failures) {
    console.log(`\n❌ Tests completed with ${failures} failures.`);
  } else {
    console.log('\n✅ All tests passed successfully!');
  }
  
  console.log('\nTest Summary:');
  console.log('- TeamContextSharingManager: Collaborative context sharing');
  console.log('- EnterpriseContextConnector: Organization-wide knowledge integration');
  console.log('- ContextSynchronizationService: Multi-device operation');
  console.log('- ContextComplianceManager: Regulatory compliance');
  console.log('- Cross-Component Integration: End-to-end workflows');
});
