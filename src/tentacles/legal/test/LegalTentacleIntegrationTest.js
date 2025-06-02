/**
 * @fileoverview Updated integration tests for the Legal Tentacle
 * 
 * This file contains integration tests for the Legal Tentacle, testing the interaction
 * between all components and ensuring they work together seamlessly.
 * 
 * @module tentacles/legal/test/LegalTentacleIntegrationTest
 * @requires assert
 */

const assert = require('assert');
// Use the test version of LegalTentacle that uses mock BaseTentacle
const LegalTentacle = require('../../../test/tentacles/legal/LegalTentacleForTest');

/**
 * Runs integration tests for the Legal Tentacle
 */
async function runIntegrationTests() {
  console.log('Starting Legal Tentacle Integration Tests');
  
  try {
    // Create test instance
    const legalTentacle = new LegalTentacle({
      modelServices: {
        modelLoaderService: {
          preloadModel: async () => true,
          runInference: async (modelId, params) => {
            // Return mock inference results based on model and task
            if (modelId === 'legal-knowledge-base') {
              return { entities: [{ id: 'test-entity', name: 'Test Entity' }] };
            } else if (modelId === 'legal-compliance') {
              return { 
                compliant: false, 
                gaps: [{ id: 'gap-1', description: 'Test Gap', severity: 7, remediation: 'Test Remediation' }],
                riskScore: 65
              };
            } else if (modelId === 'legal-case-analysis') {
              return { 
                analysis: 'Test Analysis',
                riskScore: 45,
                riskFactors: [{ id: 'risk-1', description: 'Test Risk', severity: 6, domain: 'test' }]
              };
            } else if (modelId === 'accounting-financial-analysis') {
              return {
                ratios: { currentRatio: 1.5, quickRatio: 1.2 },
                trends: [{ name: 'Revenue Growth', value: 0.15 }],
                analysis: 'Test Financial Analysis'
              };
            }
            return { result: 'mock-result' };
          }
        }
      },
      storageServices: {
        dataStore: {
          get: async (key) => {
            if (key === 'legal:jurisdictions') {
              return { 'US-CA': { name: 'California', country: 'United States' } };
            } else if (key === 'legal:entity-types') {
              return { 'llc': { name: 'Limited Liability Company' } };
            }
            return null;
          },
          set: async () => true
        }
      },
      networkServices: {
        isOnline: async () => true,
        apiClient: {
          get: async (endpoint) => {
            if (endpoint.includes('jurisdictions')) {
              return { data: { 'US-CA': { name: 'California', country: 'United States' } } };
            } else if (endpoint.includes('entity-types')) {
              return { data: { 'llc': { name: 'Limited Liability Company' } } };
            }
            return { data: {} };
          },
          post: async () => ({ data: { id: 'test-result', status: 'success' } })
        }
      },
      tentacleServices: {}
    });
    
    // Test initialization
    console.log('Testing initialization...');
    const initResult = await legalTentacle.initialize();
    assert(initResult === true, 'Initialization should return true');
    assert(legalTentacle.legalKnowledgeBase !== null, 'Legal Knowledge Base should be initialized');
    assert(legalTentacle.complianceChecker !== null, 'Compliance Checker should be initialized');
    assert(legalTentacle.caseAnalysisEngine !== null, 'Case Analysis Engine should be initialized');
    assert(legalTentacle.taxPreparationEngine !== null, 'Tax Preparation Engine should be initialized');
    assert(legalTentacle.documentPreparationSystem !== null, 'Document Preparation System should be initialized');
    assert(legalTentacle.legalResearchAssistant !== null, 'Legal Research Assistant should be initialized');
    assert(legalTentacle.accountingAssistant !== null, 'Accounting Assistant should be initialized');
    console.log('✓ Initialization successful');
    
    // Test legal knowledge capabilities
    console.log('Testing legal knowledge capabilities...');
    const legalEntity = await legalTentacle.getLegalEntity({ id: 'test-entity' });
    assert(legalEntity !== null, 'Should return a legal entity');
    
    const jurisdictionInfo = await legalTentacle.getJurisdictionInfo('US-CA');
    assert(jurisdictionInfo !== null, 'Should return jurisdiction information');
    console.log('✓ Legal knowledge capabilities working');
    
    // Test compliance capabilities
    console.log('Testing compliance capabilities...');
    const complianceResult = await legalTentacle.checkCompliance({ name: 'Test Business' }, 'data-privacy');
    assert(complianceResult !== null, 'Should return compliance result');
    assert(complianceResult.compliant === false, 'Should return compliance status');
    assert(Array.isArray(complianceResult.gaps), 'Should return compliance gaps');
    console.log('✓ Compliance capabilities working');
    
    // Test case analysis capabilities
    console.log('Testing case analysis capabilities...');
    const caseAnalysis = await legalTentacle.analyzeCase({ title: 'Test Case' });
    assert(caseAnalysis !== null, 'Should return case analysis');
    assert(caseAnalysis.analysis === 'Test Analysis', 'Should return analysis content');
    
    const riskAssessment = await legalTentacle.assessLegalRisk({ title: 'Test Situation' });
    assert(riskAssessment !== null, 'Should return risk assessment');
    assert(typeof riskAssessment.riskScore === 'number', 'Should return risk score');
    console.log('✓ Case analysis capabilities working');
    
    // Test tax preparation capabilities
    console.log('Testing tax preparation capabilities...');
    const taxReturn = await legalTentacle.prepareTaxReturn({ name: 'Test Taxpayer' }, { income: 100000 });
    assert(taxReturn !== null, 'Should return tax return');
    
    const taxStrategy = await legalTentacle.optimizeTaxStrategy({ name: 'Test Taxpayer' }, { income: 100000 });
    assert(taxStrategy !== null, 'Should return tax strategy');
    console.log('✓ Tax preparation capabilities working');
    
    // Test document preparation capabilities
    console.log('Testing document preparation capabilities...');
    const document = await legalTentacle.createLegalDocument('contract-employment', { employerName: 'Test Employer' });
    assert(document !== null, 'Should return created document');
    
    const validationResult = await legalTentacle.validateDocument({ id: 'test-doc' }, 'US-CA');
    assert(validationResult !== null, 'Should return validation result');
    console.log('✓ Document preparation capabilities working');
    
    // Test legal research capabilities
    console.log('Testing legal research capabilities...');
    const caseSearchResults = await legalTentacle.searchCaseLaw({ query: 'test case' });
    assert(caseSearchResults !== null, 'Should return case search results');
    
    const researchMemo = await legalTentacle.createResearchMemo({ title: 'Test Research' });
    assert(researchMemo !== null, 'Should return research memo');
    console.log('✓ Legal research capabilities working');
    
    // Test accounting capabilities
    console.log('Testing accounting capabilities...');
    const financialAnalysis = await legalTentacle.analyzeFinancialStatements({ entityName: 'Test Company' });
    assert(financialAnalysis !== null, 'Should return financial analysis');
    assert(financialAnalysis.ratios !== undefined, 'Should return financial ratios');
    
    const businessValuation = await legalTentacle.performBusinessValuation(
      { name: 'Test Business' }, 
      { revenue: 1000000 }, 
      'dcf'
    );
    assert(businessValuation !== null, 'Should return business valuation');
    console.log('✓ Accounting capabilities working');
    
    // Test business consulting capabilities
    console.log('Testing business consulting capabilities...');
    const businessStructureAnalysis = await legalTentacle.analyzeBusinessStructure({
      name: 'Test Business',
      jurisdiction: 'US-CA',
      entityType: 'llc'
    });
    assert(businessStructureAnalysis !== null, 'Should return business structure analysis');
    assert(businessStructureAnalysis.recommendations !== undefined, 'Should return recommendations');
    
    const regulatoryRiskAssessment = await legalTentacle.assessRegulatoryRisk(
      { name: 'Test Business' },
      ['data-privacy', 'employment']
    );
    assert(regulatoryRiskAssessment !== null, 'Should return regulatory risk assessment');
    assert(regulatoryRiskAssessment.riskProfile !== undefined, 'Should return risk profile');
    assert(regulatoryRiskAssessment.mitigationStrategies !== undefined, 'Should return mitigation strategies');
    console.log('✓ Business consulting capabilities working');
    
    // Test cross-component integration
    console.log('Testing cross-component integration...');
    const successionPlan = await legalTentacle.developSuccessionPlan(
      { 
        name: 'Test Business',
        jurisdiction: 'US-CA',
        entityType: 'llc',
        financials: { revenue: 1000000 }
      },
      { 
        owners: [{ name: 'Test Owner', share: 100 }],
        familyMembers: [{ name: 'Test Family Member' }]
      }
    );
    assert(successionPlan !== null, 'Should return succession plan');
    assert(successionPlan.businessValuation !== undefined, 'Should include business valuation');
    assert(successionPlan.taxImplications !== undefined, 'Should include tax implications');
    assert(successionPlan.successionOptions !== undefined, 'Should include succession options');
    assert(successionPlan.documents !== undefined, 'Should include document templates');
    console.log('✓ Cross-component integration working');
    
    console.log('All Legal Tentacle integration tests passed!');
    return true;
  } catch (error) {
    console.error('Legal Tentacle integration tests failed:', error);
    return false;
  }
}

// Export the test runner
module.exports = { runIntegrationTests };

// Run tests if this file is executed directly
if (require.main === module) {
  runIntegrationTests().then(success => {
    console.log(`Integration tests ${success ? 'passed' : 'failed'}`);
    process.exit(success ? 0 : 1);
  });
}
