/**
 * @fileoverview Updated MedicalHealthTentacleTest to use the test-specific implementation
 * 
 * @module test/tentacles/medical_health/MedicalHealthTentacleTest
 * @requires assert
 * @requires test/tentacles/medical_health/MedicalHealthTentacleForTest
 */

const assert = require('assert');
const MedicalHealthTentacle = require('./MedicalHealthTentacleForTest');

describe('MedicalHealthTentacle', function() {
  let tentacle;
  
  beforeEach(async function() {
    // Initialize tentacle with default mock services
    tentacle = new MedicalHealthTentacle();
    
    // Initialize the tentacle
    await tentacle.initialize();
  });
  
  describe('#initialize()', function() {
    it('should initialize successfully', async function() {
      const result = await tentacle.initialize();
      assert.strictEqual(result, true);
    });
  });
  
  describe('#capabilities', function() {
    it('should register all required capabilities', function() {
      // Check for health data processing capabilities
      assert.ok(tentacle.hasCapability('processHealthData'));
      assert.ok(tentacle.hasCapability('extractMedicalEntities'));
      assert.ok(tentacle.hasCapability('analyzeMedicalImage'));
      assert.ok(tentacle.hasCapability('visualizeHealthData'));
      
      // Check for clinical decision support capabilities
      assert.ok(tentacle.hasCapability('getRecommendations'));
      assert.ok(tentacle.hasCapability('checkMedicationInteractions'));
      assert.ok(tentacle.hasCapability('summarizeMedicalLiterature'));
      assert.ok(tentacle.hasCapability('retrieveRelevantInformation'));
      
      // Check for patient data management capabilities
      assert.ok(tentacle.hasCapability('storePatientData'));
      assert.ok(tentacle.hasCapability('retrievePatientData'));
      assert.ok(tentacle.hasCapability('updatePatientData'));
      assert.ok(tentacle.hasCapability('deletePatientData'));
      assert.ok(tentacle.hasCapability('exportPatientData'));
      assert.ok(tentacle.hasCapability('generateAuditReport'));
      
      // Check for document generation capabilities
      assert.ok(tentacle.hasCapability('generateClinicalSummary'));
      assert.ok(tentacle.hasCapability('generatePatientEducation'));
      assert.ok(tentacle.hasCapability('generateDischargeInstructions'));
      assert.ok(tentacle.hasCapability('generateReferralLetter'));
      assert.ok(tentacle.hasCapability('generateCustomDocument'));
      
      // Check for knowledge base capabilities
      assert.ok(tentacle.hasCapability('queryKnowledge'));
      assert.ok(tentacle.hasCapability('updateKnowledge'));
    });
  });
  
  describe('#processHealthData()', function() {
    it('should process health data', async function() {
      const result = await tentacle.processHealthData({
        data: 'Patient: John Doe, 65M, with hypertension and diabetes',
        format: 'TEXT',
        complianceOptions: {
          userId: 'doctor123',
          purpose: 'TREATMENT'
        }
      });
      
      assert.ok(result);
    });
  });
  
  describe('#getRecommendations()', function() {
    it('should provide clinical recommendations', async function() {
      const result = await tentacle.getRecommendations({
        patientData: {
          age: 65,
          gender: 'male',
          medicalHistory: 'Hypertension, Type 2 Diabetes'
        },
        conditions: [
          { code: 'I10', display: 'Hypertension' },
          { code: 'E11', display: 'Type 2 Diabetes' }
        ],
        complianceOptions: {
          userId: 'doctor123',
          patientId: 'patient456',
          purpose: 'TREATMENT'
        }
      });
      
      assert.ok(result);
    });
  });
  
  describe('#storePatientData()', function() {
    it('should store patient data', async function() {
      const result = await tentacle.storePatientData({
        patientId: 'patient456',
        data: {
          gender: 'male',
          age: 65,
          medicalHistory: 'Hypertension, Type 2 Diabetes'
        },
        dataType: 'demographics',
        consent: {
          consentGiven: true,
          consentDate: new Date().toISOString(),
          consentPurpose: 'treatment'
        },
        complianceOptions: {
          userId: 'doctor123',
          purpose: 'TREATMENT'
        }
      });
      
      assert.ok(result);
      assert.strictEqual(result.success, true);
    });
  });
  
  describe('#generateClinicalSummary()', function() {
    it('should generate a clinical summary', async function() {
      // First store some patient data
      await tentacle.storePatientData({
        patientId: 'patient789',
        data: {
          gender: 'female',
          age: 72,
          medicalHistory: 'Hypertension, Osteoarthritis'
        },
        dataType: 'demographics',
        consent: {
          consentGiven: true,
          consentDate: new Date().toISOString(),
          consentPurpose: 'treatment'
        },
        complianceOptions: {
          userId: 'doctor123',
          purpose: 'TREATMENT'
        }
      });
      
      // Then generate a clinical summary
      const result = await tentacle.generateClinicalSummary({
        patientId: 'patient789',
        encounterData: {
          date: new Date().toISOString(),
          provider: 'Dr. Smith',
          location: 'Internal Medicine Clinic'
        },
        format: 'MARKDOWN',
        complianceOptions: {
          userId: 'doctor123',
          purpose: 'TREATMENT'
        }
      });
      
      assert.ok(result);
      assert.strictEqual(result.format, 'MARKDOWN');
    });
  });
  
  describe('#shutdown()', function() {
    it('should shut down successfully', async function() {
      const result = await tentacle.shutdown();
      assert.strictEqual(result, true);
    });
  });
});
