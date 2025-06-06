/**
 * @fileoverview Tests for object utility functions.
 * 
 * @author Aideon AI Team
 * @version 1.0.0
 */

const { expect } = require('chai');
const { deepClone, deepMerge, pathToArray, arrayToPath } = require('../../../src/tentacles/utils/object_utils');

describe('Object Utils', function() {
  describe('deepClone', function() {
    it('should create a deep clone of an object', function() {
      const original = {
        a: 1,
        b: {
          c: 2,
          d: [3, 4, { e: 5 }]
        },
        f: new Date()
      };
      
      const clone = deepClone(original);
      
      expect(clone).to.deep.equal(original);
      expect(clone).to.not.equal(original);
      expect(clone.b).to.not.equal(original.b);
      expect(clone.b.d).to.not.equal(original.b.d);
      expect(clone.b.d[2]).to.not.equal(original.b.d[2]);
      expect(clone.f).to.not.equal(original.f);
    });
    
    it('should handle non-objects', function() {
      expect(deepClone(42)).to.equal(42);
      expect(deepClone('string')).to.equal('string');
      expect(deepClone(null)).to.be.null;
      expect(deepClone(undefined)).to.be.undefined;
    });
  });
  
  describe('deepMerge', function() {
    it('should merge two objects deeply', function() {
      const target = {
        a: 1,
        b: {
          c: 2,
          d: [3, 4]
        }
      };
      
      const source = {
        b: {
          e: 5,
          d: [6]
        },
        f: 7
      };
      
      const result = deepMerge(target, source);
      
      expect(result.a).to.equal(1);
      expect(result.b.c).to.equal(2);
      expect(result.b.e).to.equal(5);
      expect(result.b.d).to.deep.equal([6]);
      expect(result.f).to.equal(7);
    });
    
    it('should handle non-objects', function() {
      expect(deepMerge(null, { a: 1 })).to.deep.equal({ a: 1 });
      expect(deepMerge({ a: 1 }, null)).to.deep.equal({ a: 1 });
      expect(deepMerge({ a: 1 }, 'string')).to.deep.equal({ a: 1 });
    });
  });
  
  describe('pathToArray', function() {
    it('should convert a path string to an array', function() {
      expect(pathToArray('a.b.c')).to.deep.equal(['a', 'b', 'c']);
      expect(pathToArray('a')).to.deep.equal(['a']);
    });
    
    it('should handle custom separators', function() {
      expect(pathToArray('a/b/c', '/')).to.deep.equal(['a', 'b', 'c']);
    });
    
    it('should handle invalid inputs', function() {
      expect(pathToArray(null)).to.deep.equal([]);
      expect(pathToArray(42)).to.deep.equal([]);
    });
  });
  
  describe('arrayToPath', function() {
    it('should convert an array to a path string', function() {
      expect(arrayToPath(['a', 'b', 'c'])).to.equal('a.b.c');
      expect(arrayToPath(['a'])).to.equal('a');
    });
    
    it('should handle custom separators', function() {
      expect(arrayToPath(['a', 'b', 'c'], '/')).to.equal('a/b/c');
    });
    
    it('should handle invalid inputs', function() {
      expect(arrayToPath(null)).to.equal('');
      expect(arrayToPath(42)).to.equal('');
    });
  });
});
