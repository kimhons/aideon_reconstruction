/**
 * @fileoverview Integration tests for the Medical/Health Tentacle components
 * 
 * @module test/tentacles/medical_health/MedicalHealthTentacleIntegrationTest
 * @requires assert
 * @requires tentacles/medical_health/HIPAAComplianceManager
 * @requires tentacles/medical_health/MedicalKnowledgeBase
 * @requires tentacles/medical_health/HealthDataProcessor
 * @requires tentacles/medical_health/ClinicalDecisionSupport
 * @requires tentacles/medical_health/PatientDataManager
 * @requires tentacles/medical_health/MedicalDocumentGenerator
 */

const assert = require('assert');
const HIPAAComplianceManager = require('../HIPAAComplianceManager');
const MedicalKnowledgeBase = require('../MedicalKnowledgeBase');
const HealthDataProcessor = require('../HealthDataProcessor');
const ClinicalDecisionSupport = require('../ClinicalDecisionSupport');
const PatientDataManager = require('../PatientDataManager');
const MedicalDocumentGenerator = require('../MedicalDocumentGenerator');

// Mock dependencies for testing
const mockEncryptionService = {
  encrypt: async (data) => ({ encrypted: true, data: `encrypted_${JSON.stringify(data)}` }),
  decrypt: async (data) => JSON.parse(data.replace('encrypted_', '')),
  verifyStatus: async () => ({ available: true, level: 'AES-256' })
};

const mockModelLoaderService = {
  preloadModel: async () => true,
  generateText: async (model, prompt) => {
    if (prompt.includes('recommendations')) {
      return JSON.stringify([{
        recommendation: "Consider ACE inhibitors for patients with hypertension and diabetes",
        evidenceLevel: "I",
        strength: "A",
        rationale: "Multiple systematic reviews have shown benefits in reducing cardiovascular events",
        references: ["JAMA. 2020;323(13):1-10"]
      }]);
    } else if (prompt.includes('interactions')) {
      return JSON.stringify([{
        medications: ["lisinopril", "amlodipine"],
        type: "drug-drug",
        severity: "moderate",
        mechanism: "Additive hypotensive effects",
        consequences: "Increased risk of hypotension",
        management: "Monitor blood pressure closely"
      }]);
    } else if (prompt.includes('Clinical Summary')) {
      return `# Clinical Summary

## Demographics
Patient: John Doe, 65-year-old male

## Chief Complaint
Shortness of breath and chest pain

## History of Present Illness
Patient reports experiencing chest pain and shortness of breath for the past 3 days.

## Assessment
1. Hypertension
2. Type 2 Diabetes
3. Chest pain - likely angina

## Plan
1. ECG and cardiac enzymes
2. Adjust antihypertensive medication
3. Follow-up in 1 week`;
    } else {
      return "Generated text based on prompt";
    }
  },
  isModelAvailable: async () => true
};

const mockExternalModelManager = {
  generateText: async () => "Generated text from API model",
  isOnline: async () => false,
  isModelAvailable: async () => false
};

describe('Medical/Health Tentacle Integration Tests', function() {
  let hipaaComplianceManager;
  let medicalKnowledgeBase;
  let healthDataProcessor;
  let clinicalDecisionSupport;
  let patientDataManager;
  let medicalDocumentGenerator;
  
  const testPatientId = 'test-patient-123';
  const testUserId = 'test-doctor-456';
  
  beforeEach(async function() {
    // Initialize components with mock dependencies
    hipaaComplianceManager = new HIPAAComplianceManager({
      encryptionService: mockEncryptionService
    });
    
    medicalKnowledgeBase = new MedicalKnowledgeBase({
      modelLoaderService: mockModelLoaderService,
      externalModelManager: mockExternalModelManager,
      hipaaComplianceManager: hipaaComplianceManager
    });
    
    healthDataProcessor = new HealthDataProcessor({
      modelLoaderService: mockModelLoaderService,
      externalModelManager: mockExternalModelManager,
      hipaaComplianceManager: hipaaComplianceManager,
      medicalKnowledgeBase: medicalKnowledgeBase
    });
    
    clinicalDecisionSupport = new ClinicalDecisionSupport({
      modelLoaderService: mockModelLoaderService,
      externalModelManager: mockExternalModelManager,
      hipaaComplianceManager: hipaaComplianceManager,
      medicalKnowledgeBase: medicalKnowledgeBase,
      healthDataProcessor: healthDataProcessor
    });
    
    patientDataManager = new PatientDataManager({
      hipaaComplianceManager: hipaaComplianceManager,
      encryptionService: mockEncryptionService
    });
    
    medicalDocumentGenerator = new MedicalDocumentGenerator({
      modelLoaderService: mockModelLoaderService,
      externalModelManager: mockExternalModelManager,
      hipaaComplianceManager: hipaaComplianceManager,
      medicalKnowledgeBase: medicalKnowledgeBase,
      patientDataManager: patientDataManager
    });
    
    // Initialize all components
    await hipaaComplianceManager.initialize();
    await medicalKnowledgeBase.initialize();
    await healthDataProcessor.initialize();
    await clinicalDecisionSupport.initialize();
    await patientDataManager.initialize();
    await medicalDocumentGenerator.initialize();
    
    // Store test patient data
    await patientDataManager.storePatientData({
      patientId: testPatientId,
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
        userId: testUserId,
        purpose: 'TREATMENT'
      }
    });
    
    await patientDataManager.storePatientData({
      patientId: testPatientId,
      data: [
        { code: 'I10', display: 'Hypertension', system: 'ICD-10' },
        { code: 'E11', display: 'Type 2 Diabetes', system: 'ICD-10' }
      ],
      dataType: 'conditions',
      consent: {
        consentGiven: true,
        consentDate: new Date().toISOString(),
        consentPurpose: 'treatment'
      },
      complianceOptions: {
        userId: testUserId,
        purpose: 'TREATMENT'
      }
    });
    
    await patientDataManager.storePatientData({
      patientId: testPatientId,
      data: [
        { code: 'C09AA05', display: 'Ramipril 5mg', system: 'RxNorm' },
        { code: 'A10BA02', display: 'Metformin 500mg', system: 'RxNorm' }
      ],
      dataType: 'medications',
      consent: {
        consentGiven: true,
        consentDate: new Date().toISOString(),
        consentPurpose: 'treatment'
      },
      complianceOptions: {
        userId: testUserId,
        purpose: 'TREATMENT'
      }
    });
  });
  
  describe('End-to-End Patient Care Workflow', function() {
    it('should support a complete patient care workflow', async function() {
      // Step 1: Process health data
      const healthData = `
Patient: John Doe
Age: 65
Gender: Male
Chief Complaint: Chest pain and shortness of breath
History: Patient reports experiencing chest pain and shortness of breath for the past 3 days.
Past Medical History: Hypertension, Type 2 Diabetes
Medications: Ramipril 5mg daily, Metformin 500mg twice daily
Allergies: Penicillin
Vitals: BP 150/90, HR 88, RR 18, Temp 98.6F, O2 Sat 96%
`;
      
      const processedData = await healthDataProcessor.processHealthData({
        data: healthData,
        format: 'TEXT',
        complianceOptions: {
          userId: testUserId,
          patientId: testPatientId,
          purpose: 'TREATMENT'
        }
      });
      
      assert.ok(processedData);
      assert.ok(processedData.processedData);
      
      // Step 2: Get clinical recommendations
      const recommendations = await clinicalDecisionSupport.getRecommendations({
        patientData: {
          age: 65,
          gender: 'male',
          medicalHistory: 'Hypertension, Type 2 Diabetes'
        },
        conditions: [
          { code: 'I10', display: 'Hypertension' },
          { code: 'E11', display: 'Type 2 Diabetes' }
        ],
        medications: [
          { code: 'C09AA05', display: 'Ramipril 5mg' },
          { code: 'A10BA02', display: 'Metformin 500mg' }
        ],
        complianceOptions: {
          userId: testUserId,
          patientId: testPatientId,
          purpose: 'TREATMENT'
        }
      });
      
      assert.ok(recommendations);
      assert.ok(Array.isArray(recommendations.recommendations));
      assert.ok(recommendations.recommendations.length > 0);
      
      // Step 3: Check medication interactions
      const interactions = await clinicalDecisionSupport.checkMedicationInteractions({
        medications: [
          { code: 'C09AA05', display: 'Ramipril 5mg' },
          { code: 'C08CA01', display: 'Amlodipine 5mg' }
        ],
        conditions: [
          { code: 'I10', display: 'Hypertension' },
          { code: 'E11', display: 'Type 2 Diabetes' }
        ],
        complianceOptions: {
          userId: testUserId,
          patientId: testPatientId,
          purpose: 'TREATMENT'
        }
      });
      
      assert.ok(interactions);
      assert.ok(interactions.interactions);
      
      // Step 4: Update patient data with new medication
      await patientDataManager.storePatientData({
        patientId: testPatientId,
        data: [
          { code: 'C08CA01', display: 'Amlodipine 5mg', system: 'RxNorm' }
        ],
        dataType: 'medications',
        consent: {
          consentGiven: true,
          consentDate: new Date().toISOString(),
          consentPurpose: 'treatment'
        },
        complianceOptions: {
          userId: testUserId,
          purpose: 'TREATMENT'
        }
      });
      
      // Step 5: Generate clinical summary
      const clinicalSummary = await medicalDocumentGenerator.generateClinicalSummary({
        patientId: testPatientId,
        encounterData: {
          date: new Date().toISOString(),
          provider: 'Dr. Smith',
          location: 'Internal Medicine Clinic'
        },
        format: 'MARKDOWN',
        complianceOptions: {
          userId: testUserId,
          purpose: 'TREATMENT'
        }
      });
      
      assert.ok(clinicalSummary);
      assert.ok(clinicalSummary.content);
      assert.strictEqual(clinicalSummary.format, 'MARKDOWN');
      
      // Step 6: Generate patient education materials
      const patientEducation = await medicalDocumentGenerator.generatePatientEducation({
        condition: 'Hypertension',
        patientId: testPatientId,
        format: 'MARKDOWN',
        literacyLevel: 'INTERMEDIATE',
        complianceOptions: {
          userId: testUserId,
          purpose: 'TREATMENT'
        }
      });
      
      assert.ok(patientEducation);
      assert.ok(patientEducation.content);
      assert.strictEqual(patientEducation.format, 'MARKDOWN');
      
      // Step 7: Generate discharge instructions
      const dischargeInstructions = await medicalDocumentGenerator.generateDischargeInstructions({
        patientId: testPatientId,
        dischargeData: {
          diagnosis: 'Hypertensive Urgency',
          followUpInstructions: 'Follow up with Dr. Smith in 1 week',
          activityRestrictions: 'Avoid strenuous activity for 3 days'
        },
        format: 'MARKDOWN',
        literacyLevel: 'INTERMEDIATE',
        complianceOptions: {
          userId: testUserId,
          purpose: 'TREATMENT'
        }
      });
      
      assert.ok(dischargeInstructions);
      assert.ok(dischargeInstructions.content);
      assert.strictEqual(dischargeInstructions.format, 'MARKDOWN');
      
      // Step 8: Export patient data
      const exportedData = await patientDataManager.exportPatientData({
        patientId: testPatientId,
        format: 'FHIR',
        consent: {
          consentGiven: true,
          consentDate: new Date().toISOString(),
          consentPurpose: 'treatment export'
        },
        complianceOptions: {
          userId: testUserId,
          purpose: 'TREATMENT'
        }
      });
      
      assert.ok(exportedData);
      assert.ok(exportedData.data);
      assert.strictEqual(exportedData.format, 'FHIR');
    });
  });
  
  describe('HIPAA Compliance Integration', function() {
    it('should enforce HIPAA compliance across all components', async function() {
      // Test unauthorized access
      try {
        await patientDataManager.retrievePatientData({
          patientId: testPatientId,
          complianceOptions: {
            userId: 'unauthorized-user',
            purpose: 'MARKETING' // Invalid purpose
          }
        });
        assert.fail('Should have thrown an access denied error');
      } catch (error) {
        assert.ok(error.message.includes('Access denied'));
      }
      
      // Test data minimization
      const minimizedData = hipaaComplianceManager.applyDataMinimization(
        {
          ssn: '123-45-6789',
          name: 'John Doe',
          age: 65,
          gender: 'male',
          diagnosis: 'Hypertension'
        },
        {
          purpose: 'RESEARCH',
          requiredFields: ['age', 'gender', 'diagnosis']
        }
      );
      
      assert.ok(minimizedData);
      assert.strictEqual(minimizedData.age, 65);
      assert.strictEqual(minimizedData.gender, 'male');
      assert.strictEqual(minimizedData.diagnosis, 'Hypertension');
      assert.strictEqual(minimizedData.ssn, undefined);
      assert.strictEqual(minimizedData.name, undefined);
      
      // Test audit logging
      const auditEvent = hipaaComplianceManager.logAuditEvent({
        eventType: 'ACCESS',
        action: 'RETRIEVE',
        component: 'PatientDataManager',
        outcome: 'SUCCESS',
        userId: testUserId,
        patientId: testPatientId,
        details: 'Retrieved patient data for treatment'
      });
      
      assert.ok(auditEvent);
      assert.strictEqual(auditEvent.eventType, 'ACCESS');
      assert.strictEqual(auditEvent.action, 'RETRIEVE');
      assert.strictEqual(auditEvent.outcome, 'SUCCESS');
    });
  });
  
  describe('Offline Functionality', function() {
    it('should function properly in offline mode', async function() {
      // All tests are already running in offline mode since mockExternalModelManager.isOnline returns false
      
      // Test clinical decision support in offline mode
      const recommendations = await clinicalDecisionSupport.getRecommendations({
        patientData: {
          age: 65,
          gender: 'male',
          medicalHistory: 'Hypertension, Type 2 Diabetes'
        },
        conditions: [
          { code: 'I10', display: 'Hypertension' },
          { code: 'E11', display: 'Type 2 Diabetes' }
        ],
        medications: [
          { code: 'C09AA05', display: 'Ramipril 5mg' }
        ],
        forceOffline: true,
        complianceOptions: {
          userId: testUserId,
          patientId: testPatientId,
          purpose: 'TREATMENT'
        }
      });
      
      assert.ok(recommendations);
      assert.ok(Array.isArray(recommendations.recommendations));
      assert.strictEqual(recommendations.modelType, 'embedded');
      
      // Test document generation in offline mode
      const clinicalSummary = await medicalDocumentGenerator.generateClinicalSummary({
        patientId: testPatientId,
        forceOffline: true,
        complianceOptions: {
          userId: testUserId,
          purpose: 'TREATMENT'
        }
      });
      
      assert.ok(clinicalSummary);
      assert.strictEqual(clinicalSummary.modelType, 'embedded');
    });
  });
  
  describe('Cross-Component Integration', function() {
    it('should integrate knowledge base with clinical decision support', async function() {
      // Query the knowledge base
      const conditionInfo = await medicalKnowledgeBase.queryKnowledge({
        query: 'Hypertension treatment guidelines',
        domain: 'conditions',
        complianceOptions: {
          userId: testUserId,
          purpose: 'TREATMENT'
        }
      });
      
      assert.ok(conditionInfo);
      assert.ok(conditionInfo.response);
      
      // Use the knowledge in clinical decision support
      const recommendations = await clinicalDecisionSupport.getRecommendations({
        patientData: {
          age: 65,
          gender: 'male',
          medicalHistory: 'Hypertension'
        },
        conditions: [
          { code: 'I10', display: 'Hypertension' }
        ],
        clinicalQuestion: conditionInfo.query,
        complianceOptions: {
          userId: testUserId,
          patientId: testPatientId,
          purpose: 'TREATMENT'
        }
      });
      
      assert.ok(recommendations);
      assert.ok(Array.isArray(recommendations.recommendations));
    });
    
    it('should integrate patient data manager with document generator', async function() {
      // Generate a document using patient data
      const referralLetter = await medicalDocumentGenerator.generateReferralLetter({
        patientId: testPatientId,
        referralData: {
          referringProvider: 'Dr. Smith',
          referringProviderSpecialty: 'Internal Medicine',
          consultantSpecialty: 'Cardiology',
          reasonForReferral: 'Evaluation of chest pain and hypertension',
          urgency: 'Routine'
        },
        complianceOptions: {
          userId: testUserId,
          purpose: 'TREATMENT'
        }
      });
      
      assert.ok(referralLetter);
      assert.ok(referralLetter.content);
      assert.strictEqual(referralLetter.patientId, testPatientId);
    });
  });
});
