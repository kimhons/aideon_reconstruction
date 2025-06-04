/**
 * @fileoverview Updated index file for Screen Recording and Analysis utilities.
 * 
 * This file exports all utilities for the Screen Recording and Analysis module,
 * including the enhanced async utilities and module resolver.
 * 
 * @author Aideon AI Team
 * @version 1.0.0
 */

const EnhancedAsyncLock = require('./EnhancedAsyncLock');
const EnhancedCancellationToken = require('./EnhancedCancellationToken');
const EnhancedAsyncOperation = require('./EnhancedAsyncOperation');
const ModuleResolver = require('./ModuleResolver');

module.exports = {
  EnhancedAsyncLock,
  EnhancedCancellationToken,
  EnhancedAsyncOperation,
  ModuleResolver
};
