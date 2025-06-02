/**
 * @fileoverview Assessment Engine for the Aideon Academy Tentacle
 * Creates, administers, and evaluates assessments to measure learner progress and mastery
 * 
 * @module src/tentacles/aideon_academy/assessment_engine/AssessmentEngine
 */

const EventEmitter = require("events");
const { v4: uuidv4 } = require("uuid");
const { AssessmentType, QuestionType, BloomsLevel } = require("../types/AcademyTypes");

/**
 * Assessment Engine
 * Manages the creation, administration, and evaluation of assessments
 * @extends EventEmitter
 */
class AssessmentEngine extends EventEmitter {
  /**
   * Create a new Assessment Engine
   * @param {Object} options - Configuration options
   * @param {Object} dependencies - System dependencies
   */
  constructor(options = {}, dependencies = {}) {
    super();
    
    this.options = options;
    this.dependencies = dependencies;
    this.logger = dependencies.logger || console;
    this.storage = dependencies.storage;
    this.config = dependencies.config;
    this.modelOrchestrator = dependencies.modelOrchestrator;
    this.learningProfileManager = dependencies.learningProfileManager;
    this.apiServiceIntegration = dependencies.apiServiceIntegration;
    // Assume a central credit manager exists in dependencies for credit checks/deductions
    this.creditManager = dependencies.creditManager; 
    
    if (!this.storage || !this.modelOrchestrator || !this.learningProfileManager || !this.creditManager) {
      throw new Error("Required dependencies missing for AssessmentEngine");
    }
    
    // Active assessment sessions
    this.activeAssessments = new Map();
    
    this.logger.info("[AssessmentEngine] Assessment Engine initialized");
  }
  
  /**
   * Initialize the Assessment Engine with user profile
   * @param {Object} userProfile - User profile
   * @returns {Promise<boolean>} Success status
   */
  async initialize(userProfile) {
    this.logger.info(`[AssessmentEngine] Initializing for user: ${userProfile.userId}`);
    this.userId = userProfile.userId;
    this.tier = userProfile.tier;
    // Load any necessary user-specific assessment settings or history
    this.logger.info(`[AssessmentEngine] Initialized successfully for user: ${userProfile.userId}`);
    return true;
  }
  
  /**
   * Create a new assessment
   * @param {Object} options - Assessment creation options
   * @param {string} options.userId - User ID
   * @param {string} options.subject - Subject area
   * @param {string} [options.topic] - Specific topic
   * @param {string} options.assessmentType - Type of assessment (e.g., DIAGNOSTIC, FORMATIVE, SUMMATIVE)
   * @param {number} [options.numQuestions=10] - Number of questions
   * @param {string} [options.difficulty] - Target difficulty level
   * @param {Array<string>} [options.bloomsLevels] - Target Bloom's levels
   * @returns {Promise<Object>} The created assessment object (without answers)
   */
  async createAssessment(options) {
    const { 
      userId, 
      subject, 
      topic, 
      assessmentType, 
      numQuestions = 10, 
      difficulty, 
      bloomsLevels 
    } = options;
    
    this.logger.info(`[AssessmentEngine] Creating ${assessmentType} assessment for user ${userId}, subject: ${subject}`);
    
    try {
      const userProfile = await this.learningProfileManager.getProfile(userId);
      if (!userProfile) throw new Error(`User profile not found for ${userId}`);
      
      // Determine if online model should be used for generation
      const useOnlineModel = this._shouldUseOnlineModel(userProfile.tier, assessmentType);
      const creditCost = useOnlineModel ? numQuestions * 2 : 0; // Example credit cost
      
      // Check credits if using online model
      if (useOnlineModel && !(await this.creditManager.hasSufficientCredits(userId, creditCost))) {
        throw new Error("Insufficient credits to generate assessment using advanced models.");
      }
      
      let assessmentData;
      if (useOnlineModel) {
        const apiResult = await this._generateAssessmentViaApi(userProfile, options);
        assessmentData = apiResult.assessment;
        // Deduct credits via central manager
        await this.creditManager.deductCredits(userId, apiResult.creditUsage, "assessment_generation");
      } else {
        assessmentData = await this._generateAssessmentViaLocalModel(userProfile, options);
      }
      
      const assessmentId = uuidv4();
      const assessment = {
        assessmentId,
        userId,
        subject,
        topic,
        assessmentType,
        createdAt: new Date(),
        status: "created",
        numQuestions: assessmentData.questions.length,
        difficulty: difficulty || "adaptive",
        bloomsLevels: bloomsLevels || [BloomsLevel.REMEMBERING, BloomsLevel.UNDERSTANDING],
        questions: assessmentData.questions, // Questions only, no answers yet
        // Store answers securely, perhaps separately or encrypted
        _internalData: {
          answers: assessmentData.answers
        }
      };
      
      // Save assessment structure (without answers exposed)
      await this.storage.saveAssessment(assessment);
      
      this.logger.info(`[AssessmentEngine] Assessment ${assessmentId} created successfully`);
      this.emit("assessment.created", { userId, assessmentId, assessmentType });
      
      // Return assessment without internal data
      const { _internalData, ...publicAssessment } = assessment;
      return publicAssessment;
      
    } catch (error) {
      this.logger.error(`[AssessmentEngine] Failed to create assessment: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Start an assessment session
   * @param {string} assessmentId - ID of the assessment to start
   * @returns {Promise<Object>} The active assessment session object
   */
  async startAssessmentSession(assessmentId) {
    this.logger.info(`[AssessmentEngine] Starting assessment session for assessment: ${assessmentId}`);
    
    try {
      const assessment = await this.storage.getAssessment(assessmentId);
      if (!assessment) throw new Error(`Assessment not found: ${assessmentId}`);
      if (assessment.status !== "created") throw new Error(`Assessment already started or completed: ${assessmentId}`);
      
      const sessionId = uuidv4();
      const now = new Date();
      
      const session = {
        sessionId,
        assessmentId,
        userId: assessment.userId,
        startTime: now,
        status: "active",
        currentQuestionIndex: 0,
        userAnswers: new Array(assessment.numQuestions).fill(null),
        lastInteractionTime: now
      };
      
      this.activeAssessments.set(sessionId, session);
      
      // Update assessment status in storage
      await this.storage.updateAssessmentStatus(assessmentId, "active");
      
      this.logger.info(`[AssessmentEngine] Assessment session ${sessionId} started`);
      this.emit("assessment.session.started", { sessionId, assessmentId, userId: assessment.userId });
      
      // Return the first question
      const firstQuestion = this._getQuestionForSession(assessment, 0);
      return { session, currentQuestion: firstQuestion };
      
    } catch (error) {
      this.logger.error(`[AssessmentEngine] Failed to start assessment session: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Submit an answer for the current question in an assessment session
   * @param {string} sessionId - ID of the active assessment session
   * @param {any} answer - The user's answer for the current question
   * @returns {Promise<Object>} Object containing the session and the next question (or null if finished)
   */
  async submitAnswer(sessionId, answer) {
    this.logger.debug(`[AssessmentEngine] Submitting answer for session: ${sessionId}`);
    
    const session = this.activeAssessments.get(sessionId);
    if (!session) throw new Error(`Active assessment session not found: ${sessionId}`);
    if (session.status !== "active") throw new Error(`Assessment session is not active: ${sessionId}`);
    
    try {
      const assessment = await this.storage.getAssessment(session.assessmentId);
      if (!assessment) throw new Error(`Assessment not found: ${session.assessmentId}`);
      
      // Record the answer
      session.userAnswers[session.currentQuestionIndex] = answer;
      session.lastInteractionTime = new Date();
      
      // Move to the next question or finish
      session.currentQuestionIndex++;
      
      let nextQuestion = null;
      if (session.currentQuestionIndex < assessment.numQuestions) {
        nextQuestion = this._getQuestionForSession(assessment, session.currentQuestionIndex);
      } else {
        // Assessment finished
        await this.finishAssessmentSession(sessionId);
      }
      
      this.emit("assessment.answer.submitted", { sessionId, questionIndex: session.currentQuestionIndex - 1 });
      return { session, currentQuestion: nextQuestion };
      
    } catch (error) {
      this.logger.error(`[AssessmentEngine] Failed to submit answer: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Finish an assessment session and evaluate results
   * @param {string} sessionId - ID of the assessment session to finish
   * @returns {Promise<Object>} The evaluated assessment results
   */
  async finishAssessmentSession(sessionId) {
    this.logger.info(`[AssessmentEngine] Finishing assessment session: ${sessionId}`);
    
    const session = this.activeAssessments.get(sessionId);
    if (!session) throw new Error(`Active assessment session not found: ${sessionId}`);
    
    try {
      session.status = "completed";
      session.endTime = new Date();
      
      const assessment = await this.storage.getAssessment(session.assessmentId);
      if (!assessment) throw new Error(`Assessment not found: ${session.assessmentId}`);
      
      // Retrieve the internal data (answers) securely
      const internalData = await this.storage.getAssessmentInternalData(session.assessmentId);
      if (!internalData || !internalData.answers) {
         throw new Error(`Internal assessment data not found for ${session.assessmentId}`);
      }
      
      // Evaluate the assessment
      const results = await this._evaluateAssessment(session, assessment, internalData.answers);
      
      // Save results
      await this.storage.saveAssessmentResults(sessionId, results);
      
      // Update assessment status in storage
      await this.storage.updateAssessmentStatus(session.assessmentId, "completed");
      
      // Update user profile based on results
      await this._updateUserProfileFromResults(session.userId, assessment.subject, results);
      
      // Remove from active sessions
      this.activeAssessments.delete(sessionId);
      
      this.logger.info(`[AssessmentEngine] Assessment session ${sessionId} finished and evaluated`);
      this.emit("assessment.session.completed", { sessionId, assessmentId: session.assessmentId, userId: session.userId, results });
      
      return results;
      
    } catch (error) {
      this.logger.error(`[AssessmentEngine] Failed to finish assessment session: ${error.message}`);
      // Attempt to rollback status if evaluation failed
      if (session) session.status = "active"; 
      throw error;
    }
  }
  
  // ====================================================================
  // PRIVATE METHODS
  // ====================================================================
  
  /**
   * Determine if online model should be used for assessment generation
   * @param {string} tier - User tier
   * @param {string} assessmentType - Type of assessment
   * @returns {boolean}
   * @private
   */
  _shouldUseOnlineModel(tier, assessmentType) {
    // Use online models for higher tiers or more complex assessment types (e.g., summative, adaptive)
    const highTiers = ["pro", "enterprise"];
    const complexTypes = [AssessmentType.SUMMATIVE, AssessmentType.ADAPTIVE]; // Assuming ADAPTIVE type exists
    
    return highTiers.includes(tier.toLowerCase()) || complexTypes.includes(assessmentType);
  }
  
  /**
   * Generate assessment questions and answers via local model
   * @param {Object} userProfile - User profile
   * @param {Object} options - Assessment creation options
   * @returns {Promise<Object>} { questions: [], answers: [] }
   * @private
   */
  async _generateAssessmentViaLocalModel(userProfile, options) {
    this.logger.debug(`[AssessmentEngine] Generating assessment via local model`);
    try {
      const model = await this.modelOrchestrator.getModelForTask("text-generation", {
        tier: userProfile.tier,
        offlineMode: true
      });
      
      const prompt = this._prepareAssessmentGenerationPrompt(userProfile, options);
      
      const result = await model.generateText({ prompt, maxTokens: 2048, temperature: 0.5 });
      return this._parseGeneratedAssessment(result.text);
      
    } catch (error) {
      this.logger.error(`[AssessmentEngine] Local model assessment generation failed: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Generate assessment questions and answers via API service
   * @param {Object} userProfile - User profile
   * @param {Object} options - Assessment creation options
   * @returns {Promise<Object>} { assessment: { questions: [], answers: [] }, creditUsage: number }
   * @private
   */
  async _generateAssessmentViaApi(userProfile, options) {
    this.logger.debug(`[AssessmentEngine] Generating assessment via API`);
    try {
      const serviceId = this.apiServiceIntegration.findBestApiServiceForTask("text-generation", {
        tier: userProfile.tier
      });
      if (!serviceId) throw new Error("No suitable API service found for assessment generation");
      
      const prompt = this._prepareAssessmentGenerationPrompt(userProfile, options);
      
      const response = await this.apiServiceIntegration.executeApiRequest(serviceId, {
        prompt,
        max_tokens: 4096,
        temperature: 0.5,
        format: "json"
      });
      
      const assessment = this._parseGeneratedAssessment(response.text || response.content || response.generated_text);
      const creditUsage = response.usage ? response.usage.total_tokens * 0.0015 : options.numQuestions * 2; // Example cost
      
      return { assessment, creditUsage };
      
    } catch (error) {
      this.logger.error(`[AssessmentEngine] API assessment generation failed: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Prepare prompt for assessment generation
   * @param {Object} userProfile - User profile
   * @param {Object} options - Assessment creation options
   * @returns {string} Prompt string
   * @private
   */
  _prepareAssessmentGenerationPrompt(userProfile, options) {
    const { subject, topic, assessmentType, numQuestions, difficulty, bloomsLevels } = options;
    
    return `Generate an ${assessmentType} assessment with ${numQuestions} questions for the subject "${subject}"${topic ? ` focusing on the topic "${topic}"` : ''}. 
The target audience is ${userProfile.demographics.ageGroup}. 
${difficulty ? `Target difficulty: ${difficulty}.` : ''}
${bloomsLevels ? `Target Bloom's Levels: ${bloomsLevels.join(', ')}.` : ''}
Include a mix of question types (multiple_choice, true_false, open_ended, matching). 
Format the response as a JSON object with two keys: "questions" and "answers".
"questions" should be an array of question objects, each with "id", "type", "text", and optional "options".
"answers" should be an array of corresponding correct answers or evaluation criteria for open_ended questions.

Example Question Object:
{ "id": "q1", "type": "multiple_choice", "text": "What is 2+2?", "options": ["3", "4", "5"] }
Example Answer Object:
"4"

Example Open Ended Answer:
"Evaluation criteria: Correctly identifies photosynthesis, mentions key inputs (light, water, CO2) and outputs (glucose, oxygen)."`;
  }
  
  /**
   * Parse generated assessment text into structured format
   * @param {string} generatedText - Text output from the model
   * @returns {Object} { questions: [], answers: [] }
   * @private
   */
  _parseGeneratedAssessment(generatedText) {
    try {
      const jsonMatch = generatedText.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/) || 
                        generatedText.match(/(\{[\s\S]*\})/);
                        
      if (jsonMatch && jsonMatch[1]) {
        const parsed = JSON.parse(jsonMatch[1]);
        if (parsed.questions && parsed.answers && Array.isArray(parsed.questions) && Array.isArray(parsed.answers) && parsed.questions.length === parsed.answers.length) {
          // Basic validation passed
          return { questions: parsed.questions, answers: parsed.answers };
        }
      }
      
      this.logger.warn("[AssessmentEngine] Failed to parse generated assessment JSON accurately. Falling back.");
      // Fallback logic if JSON parsing fails or structure is wrong
      // This is complex; a simple fallback might just create placeholder questions
      return { questions: [{id: "q1", type: "open_ended", text: "Describe the main topic."}], answers: ["Evaluation criteria: Demonstrates basic understanding."] };
      
    } catch (error) {
      this.logger.error(`[AssessmentEngine] Error parsing generated assessment: ${error.message}`);
      // Return a minimal fallback
      return { questions: [{id: "q1", type: "open_ended", text: "Describe the main topic."}], answers: ["Evaluation criteria: Demonstrates basic understanding."] };
    }
  }
  
  /**
   * Get a specific question object for the session (without answer)
   * @param {Object} assessment - The full assessment object from storage
   * @param {number} index - The index of the question
   * @returns {Object|null} Question object or null
   * @private
   */
  _getQuestionForSession(assessment, index) {
    if (index < 0 || index >= assessment.questions.length) {
      return null;
    }
    // Return only the question part, excluding any potential answer info
    const { answer, ...questionData } = assessment.questions[index]; 
    return questionData;
  }
  
  /**
   * Evaluate the completed assessment session
   * @param {Object} session - The completed assessment session
   * @param {Object} assessment - The assessment structure
   * @param {Array} correctAnswers - The array of correct answers/criteria
   * @returns {Promise<Object>} Evaluation results
   * @private
   */
  async _evaluateAssessment(session, assessment, correctAnswers) {
    this.logger.debug(`[AssessmentEngine] Evaluating assessment session: ${session.sessionId}`);
    let score = 0;
    let correctCount = 0;
    const questionResults = [];
    
    for (let i = 0; i < assessment.numQuestions; i++) {
      const question = assessment.questions[i];
      const userAnswer = session.userAnswers[i];
      const correctAnswer = correctAnswers[i];
      let isCorrect = false;
      let evaluationFeedback = "";
      
      if (question.type === "multiple_choice" || question.type === "true_false" || question.type === "matching") {
        // Simple comparison for objective questions
        isCorrect = userAnswer === correctAnswer;
      } else if (question.type === "open_ended") {
        // Use AI model for evaluating open-ended questions
        const evaluationResult = await this._evaluateOpenEndedAnswer(question, userAnswer, correctAnswer);
        isCorrect = evaluationResult.isCorrect;
        evaluationFeedback = evaluationResult.feedback;
        // Potentially deduct credits for AI evaluation
        await this.creditManager.deductCredits(session.userId, evaluationResult.creditUsage, "assessment_evaluation");
      }
      
      if (isCorrect) {
        correctCount++;
      }
      
      questionResults.push({
        questionId: question.id,
        questionText: question.text,
        userAnswer,
        correctAnswer,
        isCorrect,
        feedback: evaluationFeedback
      });
    }
    
    score = (correctCount / assessment.numQuestions) * 100;
    
    const results = {
      sessionId: session.sessionId,
      assessmentId: session.assessmentId,
      userId: session.userId,
      completionTime: session.endTime,
      duration: (session.endTime - session.startTime) / 1000, // seconds
      score: parseFloat(score.toFixed(2)),
      correctCount,
      totalQuestions: assessment.numQuestions,
      questionResults
    };
    
    this.logger.debug(`[AssessmentEngine] Evaluation complete for session ${sessionId}: Score ${results.score}%`);
    return results;
  }
  
  /**
   * Evaluate an open-ended answer using an AI model
   * @param {Object} question - The question object
   * @param {string} userAnswer - The user's answer
   * @param {string} criteria - The evaluation criteria or correct answer description
   * @returns {Promise<Object>} { isCorrect: boolean, feedback: string, creditUsage: number }
   * @private
   */
  async _evaluateOpenEndedAnswer(question, userAnswer, criteria) {
    this.logger.debug(`[AssessmentEngine] Evaluating open-ended answer for question: ${question.id}`);
    try {
      const userProfile = await this.learningProfileManager.getProfile(this.userId);
      const useOnlineModel = this._shouldUseOnlineModel(userProfile.tier, "evaluation");
      let creditUsage = 0;
      let evaluationResultText;
      
      const prompt = `Evaluate the following user answer based on the provided criteria:
Question: ${question.text}
Evaluation Criteria: ${criteria}
User Answer: ${userAnswer}

Determine if the answer meets the criteria (isCorrect: true/false) and provide brief feedback.
Format response as JSON: { "isCorrect": boolean, "feedback": "string" }`;

      if (useOnlineModel) {
        const serviceId = this.apiServiceIntegration.findBestApiServiceForTask("text-generation", { tier: userProfile.tier });
        if (!serviceId) throw new Error("No suitable API service for evaluation");
        const response = await this.apiServiceIntegration.executeApiRequest(serviceId, { prompt, max_tokens: 256, temperature: 0.2, format: "json" });
        evaluationResultText = response.text || response.content || response.generated_text;
        creditUsage = response.usage ? response.usage.total_tokens * 0.001 : 2; // Example cost
      } else {
        const model = await this.modelOrchestrator.getModelForTask("text-generation", { tier: userProfile.tier, offlineMode: true });
        const result = await model.generateText({ prompt, maxTokens: 256, temperature: 0.2 });
        evaluationResultText = result.text;
      }
      
      // Parse the result
      try {
         const jsonMatch = evaluationResultText.match(/(\{[\s\S]*\})/);
         if (jsonMatch && jsonMatch[1]) {
            const parsed = JSON.parse(jsonMatch[1]);
            return { isCorrect: !!parsed.isCorrect, feedback: parsed.feedback || "Evaluation complete.", creditUsage };
         }
      } catch(e) { /* Fall through */ }
      
      this.logger.warn("[AssessmentEngine] Failed to parse evaluation JSON. Returning default.");
      return { isCorrect: false, feedback: "Unable to automatically evaluate.", creditUsage };
      
    } catch (error) {
      this.logger.error(`[AssessmentEngine] Failed to evaluate open-ended answer: ${error.message}`);
      return { isCorrect: false, feedback: "Evaluation error.", creditUsage: 0 };
    }
  }
  
  /**
   * Update user profile based on assessment results
   * @param {string} userId - User ID
   * @param {string} subject - Subject of the assessment
   * @param {Object} results - Assessment results object
   * @returns {Promise<void>}
   * @private
   */
  async _updateUserProfileFromResults(userId, subject, results) {
    this.logger.debug(`[AssessmentEngine] Updating user profile based on assessment results for user: ${userId}`);
    try {
      // Calculate mastery updates based on results
      // This is a simplified example; a real system would map questions to concepts
      const overallMastery = results.score / 100;
      
      const knowledgeUpdates = {
        masteryLevel: overallMastery,
        // Ideally, update concept-level mastery based on question performance
        concepts: { 
          // Example: map question IDs to concepts and update mastery
          // "concept_id_1": { mastery: 0.8, source: "assessment" }
        }
      };
      
      await this.learningProfileManager.updateKnowledgeMap(userId, subject, knowledgeUpdates);
      
      // Add assessment to history
      await this.learningProfileManager.updateProfile(userId, {
        history: { assessmentHistory: [results.assessmentId] } // Append to history
      });
      
      this.logger.info(`[AssessmentEngine] User profile updated for ${userId} based on assessment ${results.assessmentId}`);
      
    } catch (error) {
      this.logger.error(`[AssessmentEngine] Failed to update user profile from results: ${error.message}`);
      // Log error but don't fail the entire assessment completion
    }
  }
}

module.exports = AssessmentEngine;
