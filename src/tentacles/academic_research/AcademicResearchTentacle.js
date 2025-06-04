/**
 * @fileoverview Academic Research Tentacle
 * Enhances academic productivity, research, and collaboration for universities and colleges
 * 
 * @module src/tentacles/academic_research/AcademicResearchTentacle
 */

const EnhancedTentacleIntegration = require('../common/EnhancedTentacleIntegration');
const { CollaborativeModelOrchestrator } = require('../../core/miif/models/orchestration/CollaborativeModelOrchestrator');

/**
 * Academic Research Tentacle
 * Provides comprehensive support for academic research workflows, literature review,
 * publication, grant management, data analysis, and collaboration
 */
class AcademicResearchTentacle {
  /**
   * Create a new Academic Research Tentacle
   * @param {Object} options - Configuration options
   * @param {Object} dependencies - System dependencies
   */
  constructor(options = {}, dependencies = {}) {
    this.options = {
      enableLiteratureReview: true,
      enablePublicationSupport: true,
      enableGrantManagement: true,
      enableDataManagement: true,
      enableCollaboration: true,
      enableImpactTracking: true,
      offlineCapability: 'standard', // 'limited', 'standard', 'full'
      ...options
    };
    
    this.dependencies = dependencies;
    this.logger = dependencies.logger || console;
    this.tentacleId = 'academic_research';
    
    // Initialize enhanced tentacle integration
    this.enhancedIntegration = new EnhancedTentacleIntegration({
      collaborativeIntelligence: true,
      specializedModelSelection: true,
      adaptiveResourceAllocation: true,
      selfEvaluation: true,
      offlineCapability: this.options.offlineCapability
    }, {
      logger: this.logger,
      modelOrchestrationSystem: dependencies.modelOrchestrationSystem
    });
    
    // Initialize components
    this.knowledgeBase = dependencies.knowledgeBase;
    this.toolIntegration = dependencies.toolIntegration;
    this.workflowEngine = dependencies.workflowEngine;
    this.uiComponents = dependencies.uiComponents;
    
    this.components = {
      literatureReview: null,
      publicationSupport: null,
      grantManagement: null,
      dataManagement: null,
      collaboration: null,
      impactTracking: null
    };
    
    this.logger.info(`[AcademicResearchTentacle] Initialized with options:`, this.options);
  }
  
  /**
   * Initialize the tentacle
   * @returns {Promise<boolean>} Success status
   */
  async initialize() {
    this.logger.info(`[AcademicResearchTentacle] Initializing...`);
    
    try {
      // Initialize enhanced integration
      await this.enhancedIntegration.initializeAdvancedOrchestration(this.tentacleId, [
        {
          name: 'literature_review',
          modelType: 'text',
          taskType: 'research',
          collaborationStrategy: 'sequential'
        },
        {
          name: 'publication_support',
          modelType: 'text',
          taskType: 'writing',
          collaborationStrategy: 'parallel'
        },
        {
          name: 'data_analysis',
          modelType: 'multimodal',
          taskType: 'analysis',
          collaborationStrategy: 'expert_panel'
        }
      ]);
      
      // Initialize components based on options
      if (this.options.enableLiteratureReview) {
        this.components.literatureReview = await this._initializeLiteratureReview();
      }
      
      if (this.options.enablePublicationSupport) {
        this.components.publicationSupport = await this._initializePublicationSupport();
      }
      
      if (this.options.enableGrantManagement) {
        this.components.grantManagement = await this._initializeGrantManagement();
      }
      
      if (this.options.enableDataManagement) {
        this.components.dataManagement = await this._initializeDataManagement();
      }
      
      if (this.options.enableCollaboration) {
        this.components.collaboration = await this._initializeCollaboration();
      }
      
      if (this.options.enableImpactTracking) {
        this.components.impactTracking = await this._initializeImpactTracking();
      }
      
      this.logger.info(`[AcademicResearchTentacle] Initialization complete`);
      return true;
      
    } catch (error) {
      this.logger.error(`[AcademicResearchTentacle] Initialization failed: ${error.message}`);
      return false;
    }
  }
  
  /**
   * Initialize literature review component
   * @private
   * @returns {Promise<Object>} Literature review component
   */
  async _initializeLiteratureReview() {
    this.logger.debug(`[AcademicResearchTentacle] Initializing literature review component`);
    
    // Initialize literature review component
    const literatureReview = {
      searchAcademicLiterature: async (query, options = {}) => {
        try {
          const result = await this.enhancedIntegration.executeCollaborativeTask(
            'literature_review',
            {
              action: 'search',
              query,
              options
            }
          );
          return result;
        } catch (error) {
          this.logger.error(`[AcademicResearchTentacle] Literature search failed: ${error.message}`);
          throw error;
        }
      },
      
      analyzeCitationNetwork: async (papers, options = {}) => {
        try {
          const result = await this.enhancedIntegration.executeCollaborativeTask(
            'literature_review',
            {
              action: 'analyze_citations',
              papers,
              options
            }
          );
          return result;
        } catch (error) {
          this.logger.error(`[AcademicResearchTentacle] Citation analysis failed: ${error.message}`);
          throw error;
        }
      },
      
      conductSystematicReview: async (topic, options = {}) => {
        try {
          const result = await this.enhancedIntegration.executeCollaborativeTask(
            'literature_review',
            {
              action: 'systematic_review',
              topic,
              options
            }
          );
          return result;
        } catch (error) {
          this.logger.error(`[AcademicResearchTentacle] Systematic review failed: ${error.message}`);
          throw error;
        }
      },
      
      manageCitations: async (action, data, options = {}) => {
        try {
          const result = await this.enhancedIntegration.executeCollaborativeTask(
            'literature_review',
            {
              action: 'manage_citations',
              subAction: action,
              data,
              options
            }
          );
          return result;
        } catch (error) {
          this.logger.error(`[AcademicResearchTentacle] Citation management failed: ${error.message}`);
          throw error;
        }
      }
    };
    
    return literatureReview;
  }
  
  /**
   * Initialize publication support component
   * @private
   * @returns {Promise<Object>} Publication support component
   */
  async _initializePublicationSupport() {
    this.logger.debug(`[AcademicResearchTentacle] Initializing publication support component`);
    
    // Initialize publication support component
    const publicationSupport = {
      enhanceManuscript: async (manuscript, options = {}) => {
        try {
          const result = await this.enhancedIntegration.executeCollaborativeTask(
            'publication_support',
            {
              action: 'enhance_manuscript',
              manuscript,
              options
            }
          );
          return result;
        } catch (error) {
          this.logger.error(`[AcademicResearchTentacle] Manuscript enhancement failed: ${error.message}`);
          throw error;
        }
      },
      
      formatForJournal: async (manuscript, journalName, options = {}) => {
        try {
          const result = await this.enhancedIntegration.executeCollaborativeTask(
            'publication_support',
            {
              action: 'format_for_journal',
              manuscript,
              journalName,
              options
            }
          );
          return result;
        } catch (error) {
          this.logger.error(`[AcademicResearchTentacle] Journal formatting failed: ${error.message}`);
          throw error;
        }
      },
      
      recommendJournals: async (abstract, options = {}) => {
        try {
          const result = await this.enhancedIntegration.executeCollaborativeTask(
            'publication_support',
            {
              action: 'recommend_journals',
              abstract,
              options
            }
          );
          return result;
        } catch (error) {
          this.logger.error(`[AcademicResearchTentacle] Journal recommendation failed: ${error.message}`);
          throw error;
        }
      },
      
      draftPeerReviewResponse: async (review, manuscript, options = {}) => {
        try {
          const result = await this.enhancedIntegration.executeCollaborativeTask(
            'publication_support',
            {
              action: 'draft_review_response',
              review,
              manuscript,
              options
            }
          );
          return result;
        } catch (error) {
          this.logger.error(`[AcademicResearchTentacle] Review response drafting failed: ${error.message}`);
          throw error;
        }
      }
    };
    
    return publicationSupport;
  }
  
  /**
   * Initialize grant management component
   * @private
   * @returns {Promise<Object>} Grant management component
   */
  async _initializeGrantManagement() {
    this.logger.debug(`[AcademicResearchTentacle] Initializing grant management component`);
    
    // Initialize grant management component
    const grantManagement = {
      findFundingOpportunities: async (researchArea, options = {}) => {
        try {
          const result = await this.enhancedIntegration.executeCollaborativeTask(
            'literature_review', // Reuse literature review session for this task
            {
              action: 'find_funding',
              researchArea,
              options
            }
          );
          return result;
        } catch (error) {
          this.logger.error(`[AcademicResearchTentacle] Funding search failed: ${error.message}`);
          throw error;
        }
      },
      
      developProposal: async (opportunity, researchPlan, options = {}) => {
        try {
          const result = await this.enhancedIntegration.executeCollaborativeTask(
            'publication_support', // Reuse publication support session for this task
            {
              action: 'develop_proposal',
              opportunity,
              researchPlan,
              options
            }
          );
          return result;
        } catch (error) {
          this.logger.error(`[AcademicResearchTentacle] Proposal development failed: ${error.message}`);
          throw error;
        }
      },
      
      createBudget: async (projectDetails, options = {}) => {
        try {
          const result = await this.enhancedIntegration.executeCrossModalTask(
            {
              action: 'create_budget',
              projectDetails,
              options
            },
            ['text', 'structured_data']
          );
          return result;
        } catch (error) {
          this.logger.error(`[AcademicResearchTentacle] Budget creation failed: ${error.message}`);
          throw error;
        }
      },
      
      trackGrantProgress: async (grantId, options = {}) => {
        try {
          const result = await this.enhancedIntegration.executeCrossModalTask(
            {
              action: 'track_grant',
              grantId,
              options
            },
            ['text', 'structured_data']
          );
          return result;
        } catch (error) {
          this.logger.error(`[AcademicResearchTentacle] Grant tracking failed: ${error.message}`);
          throw error;
        }
      }
    };
    
    return grantManagement;
  }
  
  /**
   * Initialize data management component
   * @private
   * @returns {Promise<Object>} Data management component
   */
  async _initializeDataManagement() {
    this.logger.debug(`[AcademicResearchTentacle] Initializing data management component`);
    
    // Initialize data management component
    const dataManagement = {
      designDataCollection: async (researchQuestion, options = {}) => {
        try {
          const result = await this.enhancedIntegration.executeCollaborativeTask(
            'data_analysis',
            {
              action: 'design_collection',
              researchQuestion,
              options
            }
          );
          return result;
        } catch (error) {
          this.logger.error(`[AcademicResearchTentacle] Data collection design failed: ${error.message}`);
          throw error;
        }
      },
      
      analyzeResearchData: async (data, analysisType, options = {}) => {
        try {
          const result = await this.enhancedIntegration.executeCollaborativeTask(
            'data_analysis',
            {
              action: 'analyze_data',
              data,
              analysisType,
              options
            }
          );
          return result;
        } catch (error) {
          this.logger.error(`[AcademicResearchTentacle] Data analysis failed: ${error.message}`);
          throw error;
        }
      },
      
      visualizeResults: async (data, visualizationType, options = {}) => {
        try {
          const result = await this.enhancedIntegration.executeCrossModalTask(
            {
              action: 'visualize_results',
              data,
              visualizationType,
              options
            },
            ['text', 'image']
          );
          return result;
        } catch (error) {
          this.logger.error(`[AcademicResearchTentacle] Result visualization failed: ${error.message}`);
          throw error;
        }
      },
      
      prepareDataSharing: async (dataset, options = {}) => {
        try {
          const result = await this.enhancedIntegration.executeCollaborativeTask(
            'data_analysis',
            {
              action: 'prepare_data_sharing',
              dataset,
              options
            }
          );
          return result;
        } catch (error) {
          this.logger.error(`[AcademicResearchTentacle] Data sharing preparation failed: ${error.message}`);
          throw error;
        }
      }
    };
    
    return dataManagement;
  }
  
  /**
   * Initialize collaboration component
   * @private
   * @returns {Promise<Object>} Collaboration component
   */
  async _initializeCollaboration() {
    this.logger.debug(`[AcademicResearchTentacle] Initializing collaboration component`);
    
    // Initialize collaboration component
    const collaboration = {
      manageResearchProject: async (project, action, options = {}) => {
        try {
          const result = await this.enhancedIntegration.executeCollaborativeTask(
            'literature_review', // Reuse literature review session for this task
            {
              action: 'manage_project',
              subAction: action,
              project,
              options
            }
          );
          return result;
        } catch (error) {
          this.logger.error(`[AcademicResearchTentacle] Project management failed: ${error.message}`);
          throw error;
        }
      },
      
      facilitateCollaboration: async (team, task, options = {}) => {
        try {
          const result = await this.enhancedIntegration.executeCollaborativeTask(
            'publication_support', // Reuse publication support session for this task
            {
              action: 'facilitate_collaboration',
              team,
              task,
              options
            }
          );
          return result;
        } catch (error) {
          this.logger.error(`[AcademicResearchTentacle] Collaboration facilitation failed: ${error.message}`);
          throw error;
        }
      },
      
      mentorResearchers: async (mentee, area, options = {}) => {
        try {
          const result = await this.enhancedIntegration.executeCollaborativeTask(
            'literature_review', // Reuse literature review session for this task
            {
              action: 'mentor_researchers',
              mentee,
              area,
              options
            }
          );
          return result;
        } catch (error) {
          this.logger.error(`[AcademicResearchTentacle] Researcher mentoring failed: ${error.message}`);
          throw error;
        }
      }
    };
    
    return collaboration;
  }
  
  /**
   * Initialize impact tracking component
   * @private
   * @returns {Promise<Object>} Impact tracking component
   */
  async _initializeImpactTracking() {
    this.logger.debug(`[AcademicResearchTentacle] Initializing impact tracking component`);
    
    // Initialize impact tracking component
    const impactTracking = {
      trackCitations: async (publications, options = {}) => {
        try {
          const result = await this.enhancedIntegration.executeCollaborativeTask(
            'literature_review', // Reuse literature review session for this task
            {
              action: 'track_citations',
              publications,
              options
            }
          );
          return result;
        } catch (error) {
          this.logger.error(`[AcademicResearchTentacle] Citation tracking failed: ${error.message}`);
          throw error;
        }
      },
      
      analyzeResearchImpact: async (researcher, options = {}) => {
        try {
          const result = await this.enhancedIntegration.executeCollaborativeTask(
            'data_analysis', // Reuse data analysis session for this task
            {
              action: 'analyze_impact',
              researcher,
              options
            }
          );
          return result;
        } catch (error) {
          this.logger.error(`[AcademicResearchTentacle] Impact analysis failed: ${error.message}`);
          throw error;
        }
      },
      
      optimizeResearchDissemination: async (research, options = {}) => {
        try {
          const result = await this.enhancedIntegration.executeCollaborativeTask(
            'publication_support', // Reuse publication support session for this task
            {
              action: 'optimize_dissemination',
              research,
              options
            }
          );
          return result;
        } catch (error) {
          this.logger.error(`[AcademicResearchTentacle] Dissemination optimization failed: ${error.message}`);
          throw error;
        }
      },
      
      manageAcademicProfile: async (profile, action, options = {}) => {
        try {
          const result = await this.enhancedIntegration.executeCollaborativeTask(
            'publication_support', // Reuse publication support session for this task
            {
              action: 'manage_profile',
              subAction: action,
              profile,
              options
            }
          );
          return result;
        } catch (error) {
          this.logger.error(`[AcademicResearchTentacle] Profile management failed: ${error.message}`);
          throw error;
        }
      }
    };
    
    return impactTracking;
  }
  
  /**
   * Execute a literature review task
   * @param {string} action - Action to perform
   * @param {Object} params - Task parameters
   * @param {Object} options - Execution options
   * @returns {Promise<Object>} Task result
   */
  async executeLiteratureReviewTask(action, params, options = {}) {
    this.logger.debug(`[AcademicResearchTentacle] Executing literature review task: ${action}`);
    
    if (!this.components.literatureReview) {
      throw new Error("Literature review component is not enabled");
    }
    
    try {
      let result;
      
      switch (action) {
        case 'search':
          result = await this.components.literatureReview.searchAcademicLiterature(
            params.query,
            options
          );
          break;
          
        case 'analyze_citations':
          result = await this.components.literatureReview.analyzeCitationNetwork(
            params.papers,
            options
          );
          break;
          
        case 'systematic_review':
          result = await this.components.literatureReview.conductSystematicReview(
            params.topic,
            options
          );
          break;
          
        case 'manage_citations':
          result = await this.components.literatureReview.manageCitations(
            params.subAction,
            params.data,
            options
          );
          break;
          
        default:
          throw new Error(`Unknown literature review action: ${action}`);
      }
      
      return result;
      
    } catch (error) {
      this.logger.error(`[AcademicResearchTentacle] Literature review task failed: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Execute a publication support task
   * @param {string} action - Action to perform
   * @param {Object} params - Task parameters
   * @param {Object} options - Execution options
   * @returns {Promise<Object>} Task result
   */
  async executePublicationTask(action, params, options = {}) {
    this.logger.debug(`[AcademicResearchTentacle] Executing publication task: ${action}`);
    
    if (!this.components.publicationSupport) {
      throw new Error("Publication support component is not enabled");
    }
    
    try {
      let result;
      
      switch (action) {
        case 'enhance_manuscript':
          result = await this.components.publicationSupport.enhanceManuscript(
            params.manuscript,
            options
          );
          break;
          
        case 'format_for_journal':
          result = await this.components.publicationSupport.formatForJournal(
            params.manuscript,
            params.journalName,
            options
          );
          break;
          
        case 'recommend_journals':
          result = await this.components.publicationSupport.recommendJournals(
            params.abstract,
            options
          );
          break;
          
        case 'draft_review_response':
          result = await this.components.publicationSupport.draftPeerReviewResponse(
            params.review,
            params.manuscript,
            options
          );
          break;
          
        default:
          throw new Error(`Unknown publication action: ${action}`);
      }
      
      return result;
      
    } catch (error) {
      this.logger.error(`[AcademicResearchTentacle] Publication task failed: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Execute a grant management task
   * @param {string} action - Action to perform
   * @param {Object} params - Task parameters
   * @param {Object} options - Execution options
   * @returns {Promise<Object>} Task result
   */
  async executeGrantTask(action, params, options = {}) {
    this.logger.debug(`[AcademicResearchTentacle] Executing grant task: ${action}`);
    
    if (!this.components.grantManagement) {
      throw new Error("Grant management component is not enabled");
    }
    
    try {
      let result;
      
      switch (action) {
        case 'find_funding':
          result = await this.components.grantManagement.findFundingOpportunities(
            params.researchArea,
            options
          );
          break;
          
        case 'develop_proposal':
          result = await this.components.grantManagement.developProposal(
            params.opportunity,
            params.researchPlan,
            options
          );
          break;
          
        case 'create_budget':
          result = await this.components.grantManagement.createBudget(
            params.projectDetails,
            options
          );
          break;
          
        case 'track_grant':
          result = await this.components.grantManagement.trackGrantProgress(
            params.grantId,
            options
          );
          break;
          
        default:
          throw new Error(`Unknown grant action: ${action}`);
      }
      
      return result;
      
    } catch (error) {
      this.logger.error(`[AcademicResearchTentacle] Grant task failed: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Execute a data management task
   * @param {string} action - Action to perform
   * @param {Object} params - Task parameters
   * @param {Object} options - Execution options
   * @returns {Promise<Object>} Task result
   */
  async executeDataTask(action, params, options = {}) {
    this.logger.debug(`[AcademicResearchTentacle] Executing data task: ${action}`);
    
    if (!this.components.dataManagement) {
      throw new Error("Data management component is not enabled");
    }
    
    try {
      let result;
      
      switch (action) {
        case 'design_collection':
          result = await this.components.dataManagement.designDataCollection(
            params.researchQuestion,
            options
          );
          break;
          
        case 'analyze_data':
          result = await this.components.dataManagement.analyzeResearchData(
            params.data,
            params.analysisType,
            options
          );
          break;
          
        case 'visualize_results':
          result = await this.components.dataManagement.visualizeResults(
            params.data,
            params.visualizationType,
            options
          );
          break;
          
        case 'prepare_data_sharing':
          result = await this.components.dataManagement.prepareDataSharing(
            params.dataset,
            options
          );
          break;
          
        default:
          throw new Error(`Unknown data action: ${action}`);
      }
      
      return result;
      
    } catch (error) {
      this.logger.error(`[AcademicResearchTentacle] Data task failed: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Execute a collaboration task
   * @param {string} action - Action to perform
   * @param {Object} params - Task parameters
   * @param {Object} options - Execution options
   * @returns {Promise<Object>} Task result
   */
  async executeCollaborationTask(action, params, options = {}) {
    this.logger.debug(`[AcademicResearchTentacle] Executing collaboration task: ${action}`);
    
    if (!this.components.collaboration) {
      throw new Error("Collaboration component is not enabled");
    }
    
    try {
      let result;
      
      switch (action) {
        case 'manage_project':
          result = await this.components.collaboration.manageResearchProject(
            params.project,
            params.subAction,
            options
          );
          break;
          
        case 'facilitate_collaboration':
          result = await this.components.collaboration.facilitateCollaboration(
            params.team,
            params.task,
            options
          );
          break;
          
        case 'mentor_researchers':
          result = await this.components.collaboration.mentorResearchers(
            params.mentee,
            params.area,
            options
          );
          break;
          
        default:
          throw new Error(`Unknown collaboration action: ${action}`);
      }
      
      return result;
      
    } catch (error) {
      this.logger.error(`[AcademicResearchTentacle] Collaboration task failed: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Execute an impact tracking task
   * @param {string} action - Action to perform
   * @param {Object} params - Task parameters
   * @param {Object} options - Execution options
   * @returns {Promise<Object>} Task result
   */
  async executeImpactTask(action, params, options = {}) {
    this.logger.debug(`[AcademicResearchTentacle] Executing impact task: ${action}`);
    
    if (!this.components.impactTracking) {
      throw new Error("Impact tracking component is not enabled");
    }
    
    try {
      let result;
      
      switch (action) {
        case 'track_citations':
          result = await this.components.impactTracking.trackCitations(
            params.publications,
            options
          );
          break;
          
        case 'analyze_impact':
          result = await this.components.impactTracking.analyzeResearchImpact(
            params.researcher,
            options
          );
          break;
          
        case 'optimize_dissemination':
          result = await this.components.impactTracking.optimizeResearchDissemination(
            params.research,
            options
          );
          break;
          
        case 'manage_profile':
          result = await this.components.impactTracking.manageAcademicProfile(
            params.profile,
            params.subAction,
            options
          );
          break;
          
        default:
          throw new Error(`Unknown impact action: ${action}`);
      }
      
      return result;
      
    } catch (error) {
      this.logger.error(`[AcademicResearchTentacle] Impact task failed: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Execute a task
   * @param {string} domain - Task domain
   * @param {string} action - Action to perform
   * @param {Object} params - Task parameters
   * @param {Object} options - Execution options
   * @returns {Promise<Object>} Task result
   */
  async executeTask(domain, action, params, options = {}) {
    this.logger.info(`[AcademicResearchTentacle] Executing task: ${domain}/${action}`);
    
    try {
      let result;
      
      switch (domain) {
        case 'literature':
          result = await this.executeLiteratureReviewTask(action, params, options);
          break;
          
        case 'publication':
          result = await this.executePublicationTask(action, params, options);
          break;
          
        case 'grant':
          result = await this.executeGrantTask(action, params, options);
          break;
          
        case 'data':
          result = await this.executeDataTask(action, params, options);
          break;
          
        case 'collaboration':
          result = await this.executeCollaborationTask(action, params, options);
          break;
          
        case 'impact':
          result = await this.executeImpactTask(action, params, options);
          break;
          
        default:
          throw new Error(`Unknown task domain: ${domain}`);
      }
      
      return result;
      
    } catch (error) {
      this.logger.error(`[AcademicResearchTentacle] Task execution failed: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Clean up resources
   * @returns {Promise<boolean>} Success status
   */
  async cleanup() {
    this.logger.info(`[AcademicResearchTentacle] Cleaning up resources`);
    
    try {
      // Clean up enhanced integration
      await this.enhancedIntegration.cleanup();
      
      // Clean up components
      for (const component in this.components) {
        if (this.components[component] && typeof this.components[component].cleanup === 'function') {
          await this.components[component].cleanup();
        }
      }
      
      this.logger.info(`[AcademicResearchTentacle] Cleanup complete`);
      return true;
      
    } catch (error) {
      this.logger.error(`[AcademicResearchTentacle] Cleanup failed: ${error.message}`);
      return false;
    }
  }
}

module.exports = AcademicResearchTentacle;
