/**
 * @fileoverview Setup file for marketplace tests
 * This file sets up the test environment for both analytics and UI tests
 * 
 * @author Aideon AI Team
 * @version 1.0.0
 */

// Add TextEncoder and TextDecoder to global scope for jsdom
const { TextEncoder, TextDecoder } = require('util');
global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder;

// Set up DOM environment for UI tests
const { JSDOM } = require('jsdom');

const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', {
  url: 'http://localhost/',
  pretendToBeVisual: true,
  runScripts: 'dangerously'
});

global.window = dom.window;
global.document = dom.window.document;
global.navigator = dom.window.navigator;
global.HTMLElement = dom.window.HTMLElement;
global.Element = dom.window.Element;
global.localStorage = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn()
};

// Mock timers for rotation and animation testing
jest.useFakeTimers();

// Mock fetch for API calls
global.fetch = jest.fn().mockImplementation(() => 
  Promise.resolve({
    json: () => Promise.resolve({}),
    text: () => Promise.resolve(''),
    ok: true
  })
);

// Set up environment variables
process.env.NODE_ENV = 'test';

// Note: Cleanup is now handled in individual test files
// Do not use afterAll here as it's not available in the setup context
