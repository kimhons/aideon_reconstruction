/**
 * @fileoverview Test for GAIA Score Validator
 * 
 * This file contains tests for the GAIA Score Validator component of the
 * Decision Intelligence Tentacle.
 */

const { expect } = require('chai');
const sinon = require('sinon');
const { GAIAScoreValidator } = require('../../../src/tentacles/decision_intelligence/validation/GAIAScoreValidator');

describe('GAIAScoreValidator', () => {
  let validator;
  let mockAideon;
  let mockTentacle;
  let mockLogger;
  let mockEvents;
  
  beforeEach(() => {
    // Create mock objects
    mockLogger = {
      info: sinon.spy(),
      warn: sinon.spy(),
      error: sinon.spy()
    };
    
    mockEvents = {
      emit: sinon.spy()
    };
    
    mockAideon = {
      config: {
        getNamespace: sinon.stub().returns({
          getNamespace: sinon.stub().returns({
            getNamespace: sinon.stub().returns({
              get: sinon.stub()
            })
          })
        })
      },
      gaia: {
        getCurrentScore: sinon.stub().resolves({
          total: 95.5,
          dimensions: {
            intelligence: 96.2,
            adaptability: 94.8,
            autonomy: 95.1,
            userExperience: 96.0
          }
        }),
        getScoreWithout: sinon.stub().resolves({
          total: 94.0,
          dimensions: {
            intelligence: 94.5,
            adaptability: 93.2,
            autonomy: 94.0,
            userExperience: 94.3
          }
        })
      },
      metrics: {
        trackEvent: sinon.spy()
      }
    };
    
    mockTentacle = {
      getStatus: sinon.stub().returns({
        components: {
          dataAnalyzer: { initialized: true },
          optionEvaluator: { initialized: true },
          recommendationGenerator: { initialized: true },
          explanationEngine: { initialized: true },
          decisionIntelligencePipeline: { initialized: true }
        }
      })
    };
    
    // Create validator instance with mocks
    validator = new GAIAScoreValidator(mockAideon, mockTentacle);
    
    // Replace logger and events with mocks
    validator.logger = mockLogger;
    validator.events = mockEvents;
  });
  
  afterEach(() => {
    sinon.restore();
  });
  
  describe('initialization', () => {
    it('should initialize successfully', async () => {
      await validator.initialize();
      
      expect(validator.initialized).to.be.true;
      expect(mockLogger.info.calledWith('GAIA Score Validator initialized successfully')).to.be.true;
      expect(mockEvents.emit.calledWith('initialized')).to.be.true;
    });
    
    it('should not initialize twice', async () => {
      await validator.initialize();
      await validator.initialize();
      
      expect(mockLogger.info.calledWith('Already initialized')).to.be.true;
    });
    
    it('should handle initialization errors', async () => {
      mockAideon.config.getNamespace.throws(new Error('Config error'));
      
      try {
        await validator.initialize();
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error.message).to.equal('Config error');
        expect(mockLogger.error.calledWith('Initialization failed')).to.be.true;
      }
    });
  });
  
  describe('validation', () => {
    beforeEach(async () => {
      await validator.initialize();
    });
    
    it('should validate GAIA Score impact successfully', async () => {
      const results = await validator.validateGAIAScoreImpact();
      
      expect(results).to.exist;
      expect(results.impact.total).to.equal(1.5);
      expect(results.impact.percentage).to.be.closeTo(1.6, 0.1);
      expect(mockLogger.info.calledWith('GAIA Score validation complete')).to.be.true;
      expect(mockEvents.emit.calledWith('validation:complete')).to.be.true;
    });
    
    it('should calculate impact correctly', () => {
      const currentScore = {
        total: 95.5,
        dimensions: {
          intelligence: 96.2,
          adaptability: 94.8,
          autonomy: 95.1,
          userExperience: 96.0
        }
      };
      
      const baselineScore = {
        total: 94.0,
        dimensions: {
          intelligence: 94.5,
          adaptability: 93.2,
          autonomy: 94.0,
          userExperience: 94.3
        }
      };
      
      const impact = validator._calculateImpact(currentScore, baselineScore);
      
      expect(impact.total).to.equal(1.5);
      expect(impact.percentage).to.be.closeTo(1.6, 0.1);
      expect(impact.dimensions.intelligence).to.equal(1.7);
      expect(impact.dimensions.adaptability).to.equal(1.6);
      expect(impact.dimensions.autonomy).to.equal(1.1);
      expect(impact.dimensions.userExperience).to.equal(1.7);
    });
    
    it('should validate component impacts', async () => {
      mockAideon.gaia.getScoreWithout.withArgs('decision-intelligence', 'dataAnalyzer')
        .resolves({
          total: 95.0,
          dimensions: {}
        });
      
      mockAideon.gaia.getScoreWithout.withArgs('decision-intelligence', 'optionEvaluator')
        .resolves({
          total: 95.2,
          dimensions: {}
        });
      
      const results = await validator.validateGAIAScoreImpact();
      
      expect(results.componentImpacts).to.exist;
      expect(results.componentImpacts.dataAnalyzer).to.exist;
      expect(results.componentImpacts.dataAnalyzer.impact).to.equal(0.5);
      expect(results.componentImpacts.optionEvaluator).to.exist;
      expect(results.componentImpacts.optionEvaluator.impact).to.equal(0.3);
    });
    
    it('should handle validation errors', async () => {
      mockAideon.gaia.getCurrentScore.rejects(new Error('GAIA error'));
      
      try {
        await validator.validateGAIAScoreImpact();
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error.message).to.equal('GAIA error');
        expect(mockLogger.error.calledWith('Validation failed')).to.be.true;
        expect(mockEvents.emit.calledWith('validation:error')).to.be.true;
      }
    });
  });
  
  describe('shutdown', () => {
    beforeEach(async () => {
      await validator.initialize();
    });
    
    it('should shut down successfully', async () => {
      await validator.shutdown();
      
      expect(validator.initialized).to.be.false;
      expect(validator.validationResults).to.be.null;
      expect(mockLogger.info.calledWith('GAIA Score Validator shutdown complete')).to.be.true;
      expect(mockEvents.emit.calledWith('shutdown')).to.be.true;
    });
    
    it('should not shut down if not initialized', async () => {
      await validator.shutdown();
      await validator.shutdown();
      
      expect(mockLogger.info.calledWith('Not initialized, nothing to shut down')).to.be.true;
    });
  });
  
  describe('API endpoints', () => {
    let mockApi;
    
    beforeEach(async () => {
      mockApi = {
        register: sinon.spy()
      };
      
      await validator.initialize();
    });
    
    it('should register API endpoints', () => {
      validator.registerApiEndpoints(mockApi);
      
      expect(mockApi.register.calledTwice).to.be.true;
      expect(mockApi.register.calledWith('decision/gaia/validate')).to.be.true;
      expect(mockApi.register.calledWith('decision/gaia/results')).to.be.true;
    });
    
    it('should handle missing API service', () => {
      validator.registerApiEndpoints(null);
      
      expect(mockLogger.warn.calledWith('API service not available, skipping endpoint registration')).to.be.true;
    });
  });
});
