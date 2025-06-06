/**
 * @fileoverview Test setup file
 * 
 * This file sets up the testing environment for all tests.
 */

const chai = require('chai');
const sinon = require('sinon');
const sinonChai = require('sinon-chai');

// Configure chai to use sinon-chai
chai.use(sinonChai);
