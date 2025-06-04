/**
 * @fileoverview Simple test to verify module imports for Screen Recording and Analysis module.
 * 
 * @author Aideon AI Team
 * @version 1.0.0
 */

// Use absolute paths for imports
const path = require('path');
const rootDir = path.resolve(__dirname, '../../../../..');

console.log('Testing module imports for Screen Recording and Analysis module...');
console.log('Root directory:', rootDir);

try {
  console.log('Attempting to import EnhancedScreenRecordingManager...');
  const managerPath = path.join(rootDir, 'src/tentacles/multimodal/input/screen/EnhancedScreenRecordingManager.js');
  console.log('Manager path:', managerPath);
  const ScreenRecordingManager = require(managerPath);
  console.log('✅ Successfully imported ScreenRecordingManager');
  
  console.log('Attempting to import utils...');
  const utilsPath = path.join(rootDir, 'src/tentacles/multimodal/input/screen/utils/index.js');
  console.log('Utils path:', utilsPath);
  const Utils = require(utilsPath);
  console.log('✅ Successfully imported utils');
  
  console.log('Verifying utils exports...');
  console.log('AsyncLock:', typeof Utils.AsyncLock);
  console.log('CancellationToken:', typeof Utils.CancellationToken);
  console.log('AsyncOperation:', typeof Utils.AsyncOperation);
  
  console.log('Creating manager instance...');
  const manager = new ScreenRecordingManager({
    logger: console,
    config: {
      outputDir: '/tmp/test-recordings',
      debugMode: true
    }
  });
  console.log('✅ Successfully created manager instance');
  
  console.log('All imports successful!');
} catch (error) {
  console.error('❌ Import error:', error.message);
  console.error('Stack trace:', error.stack);
}
