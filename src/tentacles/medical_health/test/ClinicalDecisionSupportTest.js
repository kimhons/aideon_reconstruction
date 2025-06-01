/**
 * @fileoverview Tests for the ClinicalDecisionSupport component
 * 
 * @module test/tentacles/medical_health/ClinicalDecisionSupportTest
 * @requires assert
 * @requires tentacles/medical_health/ClinicalDecisionSupport
 * @requires tentacles/medical_health/HIPAAComplianceManager
 * @requires tentacles/medical_health/MedicalKnowledgeBase
 * @requires tentacles/medical_health/HealthDataProcessor
 * @requires core/ml/ModelLoaderService
 * @requires core/ml/external/ExternalModelManager
 */

const assert = require('assert');
const ClinicalDecisionSupport = require('../ClinicalDecisionSupport');
const HIPAAComplianceManager = require('../HIPAAComplianceManager');
const MedicalKnowledgeBase = require('../MedicalKnowledgeBase');
const HealthDataProcessor = require('../HealthDataProcessor');
const ModelLoaderService = require('../../../core/ml/ModelLoaderService');
const ExternalModelManager = require('../../../core/ml/external/ExternalModelManager');

// Mock dependencies
class MockModelLoaderService {
  async preloadModel() { return true; }
  async generateText() { 
    return JSON.stringify([
      {
        recommendation: "Consider ACE inhibitors for patients with hypertension and diabetes",
        evidenceLevel: "I",
        strength: "A",
        rationale: "Multiple systematic reviews have shown benefits in reducing cardiovascular events",
        references: ["JAMA. 2020;323(13):1-10", "N Engl J Med. 2019;380:2295-2306"]
      }
    ]);
  }
  async isModelAvailable() { return true; }
}

class MockExternalModelManager {
  async generateText() { 
    return JSON.stringify([
      {
        medications: ["lisinopril", "amlodipine"],
        type: "drug-drug",
        severity: "moderate",
        mechanism: "Additive hypotensive effects",
        consequences: "Increased risk of hypotension, dizziness, and falls",
        management: "Monitor blood pressure closely, especially when initiating therapy"
      }
    ]);
  }
  async isOnline() { return true; }
  async isModelAvailable() { return true; }
}

class MockHIPAAComplianceManager {
  async initialize() { return true; }
  logAuditEvent() { return {}; }
  async validateDataAccess() { return { granted: true }; }
  sanitizeOutput(data) { return data; }
}

class MockMedicalKnowledgeBase {
  async initialize() { return true; }
  async getModelForDomain() { 
    return {
      name: 'DeepSeek-V3',
      type: 'embedded'
    };
  }
}

class MockHealthDataProcessor {
  async initialize() { return true; }
}

describe('ClinicalDecisionSupport', function() {
  let clinicalDecisionSupport;
  let mockModelLoaderService;
  let mockExternalModelManager;
  let mockHipaaComplianceManager;
  let mockMedicalKnowledgeBase;
  let mockHealthDataProcessor;
  
  beforeEach(function() {
    mockModelLoaderService = new MockModelLoaderService();
    mockExternalModelManager = new MockExternalModelManager();
    mockHipaaComplianceManager = new MockHIPAAComplianceManager();
    mockMedicalKnowledgeBase = new MockMedicalKnowledgeBase();
    mockHealthDataProcessor = new MockHealthDataProcessor();
    
    clinicalDecisionSupport = new ClinicalDecisionSupport({
      modelLoaderService: mockModelLoaderService,
      externalModelManager: mockExternalModelManager,
      hipaaComplianceManager: mockHipaaComplianceManager,
      medicalKnowledgeBase: mockMedicalKnowledgeBase,
      healthDataProcessor: mockHealthDataProcessor
    });
  });
  
  describe('#initialize()', function() {
    it('should initialize successfully', async function() {
      const result = await clinicalDecisionSupport.initialize();
      assert.strictEqual(result, true);
    });
  });
  
  describe('#getRecommendations()', function() {
    it('should return evidence-based recommendations', async function() {
      const options = {
        patientData: {
          age: 65,
          gender: 'female',
          medicalHistory: 'Hypertension, Type 2 Diabetes'
        },
        conditions: [
          { code: 'I10', display: 'Hypertension' },
          { code: 'E11', display: 'Type 2 Diabetes' }
        ],
        medications: [
          { code: 'C09AA05', display: 'Ramipril' }
        ],
        complianceOptions: {
          userId: 'doctor123',
          patientId: 'patient456'
        }
      };
      
      const result = await clinicalDecisionSupport.getRecommendations(options);
      
      assert.ok(result);
      assert.ok(Array.isArray(result.recommendations));
      assert.ok(result.recommendations.length > 0);
      assert.ok(result.disclaimer);
      assert.ok(result.modelUsed);
      assert.ok(result.timestamp);
    });
    
    it('should throw an error when required parameters are missing', async function() {
      try {
        await clinicalDecisionSupport.getRecommendations({});
        assert.fail('Should have thrown an error');
      } catch (error) {
        assert.ok(error instanceof Error);
      }
    });
  });
  
  describe('#checkMedicationInteractions()', function() {
    it('should identify potential medication interactions', async function() {
      const options = {
        medications: [
          { code: 'C09AA05', display: 'Ramipril' },
          { code: 'C08CA01', display: 'Amlodipine' }
        ],
        conditions: [
          { code: 'I10', display: 'Hypertension' },
          { code: 'E11', display: 'Type 2 Diabetes' }
        ],
        complianceOptions: {
          userId: 'doctor123',
          patientId: 'patient456'
        }
      };
      
      const result = await clinicalDecisionSupport.checkMedicationInteractions(options);
      
      assert.ok(result);
      assert.ok(result.interactions);
      assert.ok(result.disclaimer);
      assert.ok(result.modelUsed);
      assert.ok(result.timestamp);
    });
    
    it('should throw an error when medications are missing', async function() {
      try {
        await clinicalDecisionSupport.checkMedicationInteractions({});
        assert.fail('Should have thrown an error');
      } catch (error) {
        assert.ok(error instanceof Error);
      }
    });
  });
  
  describe('#summarizeMedicalLiterature()', function() {
    it('should summarize medical literature', async function() {
      const options = {
        query: 'ACE inhibitors in diabetic nephropathy',
        complianceOptions: {
          userId: 'doctor123'
        }
      };
      
      const result = await clinicalDecisionSupport.summarizeMedicalLiterature(options);
      
      assert.ok(result);
      assert.strictEqual(result.query, options.query);
      assert.ok(result.summary);
      assert.ok(result.disclaimer);
      assert.ok(result.modelUsed);
      assert.ok(result.timestamp);
    });
    
    it('should throw an error when query is missing', async function() {
      try {
        await clinicalDecisionSupport.summarizeMedicalLiterature({});
        assert.fail('Should have thrown an error');
      } catch (error) {
        assert.ok(error instanceof Error);
      }
    });
  });
  
  describe('#retrieveRelevantInformation()', function() {
    it('should retrieve relevant clinical information', async function() {
      const options = {
        query: 'Management of diabetic foot ulcers',
        complianceOptions: {
          userId: 'doctor123'
        }
      };
      
      const result = await clinicalDecisionSupport.retrieveRelevantInformation(options);
      
      assert.ok(result);
      assert.strictEqual(result.query, options.query);
      assert.ok(result.information);
      assert.ok(result.disclaimer);
      assert.ok(result.modelUsed);
      assert.ok(result.timestamp);
    });
    
    it('should throw an error when query is missing', async function() {
      try {
        await clinicalDecisionSupport.retrieveRelevantInformation({});
        assert.fail('Should have thrown an error');
      } catch (error) {
        assert.ok(error instanceof Error);
      }
    });
  });
  
  describe('#getModelForTask()', function() {
    it('should return the appropriate model for a task', async function() {
      const model = await clinicalDecisionSupport.getModelForTask('recommendations');
      
      assert.ok(model);
      assert.ok(model.name);
      assert.ok(model.type);
    });
    
    it('should throw an error for unknown tasks', async function() {
      try {
        await clinicalDecisionSupport.getModelForTask('unknownTask');
        assert.fail('Should have thrown an error');
      } catch (error) {
        assert.ok(error instanceof Error);
      }
    });
  });
  
  describe('#validateRecommendation()', function() {
    it('should validate a proper recommendation', async function() {
      const recommendation = {
        recommendation: 'Consider ACE inhibitors for patients with hypertension and diabetes',
        evidenceLevel: 'I',
        strength: 'A',
        rationale: 'Multiple systematic reviews have shown benefits',
        references: ['JAMA. 2020;323(13):1-10']
      };
      
      const isValid = await clinicalDecisionSupport.validateRecommendation(recommendation);
      assert.strictEqual(isValid, true);
    });
    
    it('should reject inappropriate recommendations', async function() {
      const recommendation = {
        recommendation: 'I recommend prescribing lisinopril 10mg daily',
        evidenceLevel: 'I',
        strength: 'A'
      };
      
      const isValid = await clinicalDecisionSupport.validateRecommendation(recommendation);
      assert.strictEqual(isValid, false);
    });
  });
  
  describe('#assignEvidenceLevel()', function() {
    it('should assign evidence level I for systematic reviews', async function() {
      const recommendation = {
        recommendation: 'Consider statins for cardiovascular risk reduction',
        rationale: 'Based on systematic review of multiple trials',
        references: ['Cochrane Database Syst Rev. 2021;5:CD004816']
      };
      
      const level = await clinicalDecisionSupport.assignEvidenceLevel(recommendation);
      assert.strictEqual(level, 'I');
    });
    
    it('should assign evidence level II for randomized trials', async function() {
      const recommendation = {
        recommendation: 'Consider SGLT2 inhibitors for diabetic patients',
        rationale: 'Based on randomized trial evidence',
        references: ['N Engl J Med. 2019;380:2295-2306']
      };
      
      const level = await clinicalDecisionSupport.assignEvidenceLevel(recommendation);
      assert.strictEqual(level, 'II');
    });
  });
  
  describe('#assignRecommendationStrength()', function() {
    it('should assign strength A for evidence level I', function() {
      const strength = clinicalDecisionSupport.assignRecommendationStrength('I');
      assert.strictEqual(strength, 'A');
    });
    
    it('should assign strength B for evidence level II', function() {
      const strength = clinicalDecisionSupport.assignRecommendationStrength('II');
      assert.strictEqual(strength, 'B');
    });
    
    it('should assign strength C for evidence levels III and IV', function() {
      let strength = clinicalDecisionSupport.assignRecommendationStrength('III');
      assert.strictEqual(strength, 'C');
      
      strength = clinicalDecisionSupport.assignRecommendationStrength('IV');
      assert.strictEqual(strength, 'C');
    });
  });
  
  describe('#preparePatientSummary()', function() {
    it('should create a concise patient summary', function() {
      const patientData = {
        age: 65,
        gender: 'female',
        medicalHistory: 'Hypertension, Type 2 Diabetes'
      };
      
      const summary = clinicalDecisionSupport.preparePatientSummary(patientData);
      assert.strictEqual(summary, '65-year-old female with relevant history: Hypertension, Type 2 Diabetes');
    });
    
    it('should handle missing patient data', function() {
      const summary = clinicalDecisionSupport.preparePatientSummary({});
      assert.strictEqual(summary, 'Unknown-year-old Unknown with relevant history: None provided');
    });
  });
  
  describe('#processLiteratureSummary()', function() {
    it('should structure a literature summary into sections', function() {
      const rawSummary = `
Key Findings:
ACE inhibitors reduce proteinuria and slow progression of diabetic nephropathy.

Ongoing Research:
Studies are investigating combination therapy with ARBs.

Clinical Implications:
Early intervention with ACE inhibitors is recommended.

Strength of Evidence:
Level I evidence from multiple RCTs and meta-analyses.

Knowledge Gaps:
Optimal dosing strategies remain unclear.

References:
1. Lewis EJ, et al. N Engl J Med. 1993;329:1456-1462.
2. Brenner BM, et al. N Engl J Med. 2001;345:861-869.
      `;
      
      const processed = clinicalDecisionSupport.processLiteratureSummary(rawSummary);
      
      assert.ok(processed);
      assert.ok(processed.keyfindings);
      assert.ok(processed.ongoingresearch);
      assert.ok(processed.clinicalimplications);
      assert.ok(processed.strengthofevidence);
      assert.ok(processed.knowledgegaps);
      assert.ok(processed.references);
    });
  });
  
  describe('#processRetrievedInformation()', function() {
    it('should structure retrieved information into sections', function() {
      const rawInformation = `
Definitions:
Diabetic foot ulcers are open sores or wounds on the feet of people with diabetes.

Guidelines:
The International Working Group on the Diabetic Foot recommends regular foot examinations.

Diagnostic Criteria:
Classification includes Wagner grades 1-5 based on depth and presence of infection.

Treatment:
Offloading, debridement, infection control, and wound care are key components.

Prognosis:
Healing rates vary from 50-60% at 6 months with standard care.

Special Considerations:
Peripheral arterial disease requires vascular assessment and possible revascularization.
      `;
      
      const processed = clinicalDecisionSupport.processRetrievedInformation(rawInformation);
      
      assert.ok(processed);
      assert.ok(processed.definitions);
      assert.ok(processed.guidelines);
      assert.ok(processed.diagnosticcriteria);
      assert.ok(processed.treatment);
      assert.ok(processed.prognosis);
      assert.ok(processed.specialconsiderations);
    });
  });
  
  describe('#calculateAverageConfidence()', function() {
    it('should calculate the average confidence score', function() {
      const relationships = [
        { source: 0, target: 1, relationship: 'treats', confidence: 0.8 },
        { source: 2, target: 3, relationship: 'diagnoses', confidence: 0.9 },
        { source: 4, target: 5, relationship: 'prevents', confidence: 0.7 }
      ];
      
      const average = clinicalDecisionSupport.calculateAverageConfidence(relationships);
      assert.strictEqual(average, 0.8);
    });
    
    it('should handle empty relationships array', function() {
      const average = clinicalDecisionSupport.calculateAverageConfidence([]);
      assert.strictEqual(average, 0);
    });
  });
});
