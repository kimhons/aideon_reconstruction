/**
 * @fileoverview Intelligent Tutoring System for the Aideon Academy Tentacle
 * Provides personalized, adaptive tutoring with dynamic content generation and feedback
 * 
 * @module src/tentacles/aideon_academy/intelligent_tutoring/IntelligentTutoringSystem
 */

const EventEmitter = require("events");
const { v4: uuidv4 } = require("uuid");
const { BloomsLevel, LearningStyle, LearningPace } = require("../types/AcademyTypes");

/**
 * Intelligent Tutoring System
 * Provides personalized, adaptive tutoring with dynamic content generation
 * @extends EventEmitter
 */
class IntelligentTutoringSystem extends EventEmitter {
  /**
   * Create a new Intelligent Tutoring System
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
    
    if (!this.storage || !this.modelOrchestrator || !this.learningProfileManager) {
      throw new Error("Required dependencies missing for IntelligentTutoringSystem");
    }
    
    // Active tutoring sessions
    this.activeSessions = new Map();
    
    this.logger.info("[IntelligentTutoringSystem] Intelligent Tutoring System initialized");
  }
  
  /**
   * Initialize the Intelligent Tutoring System with user profile
   * @param {Object} userProfile - User profile
   * @returns {Promise<boolean>} Success status
   */
  async initialize(userProfile) {
    this.logger.info(`[IntelligentTutoringSystem] Initializing for user: ${userProfile.userId}`);
    
    try {
      // Load tutoring history and preferences
      const tutoringHistory = await this.storage.getTutoringHistory(userProfile.userId);
      this.userTutoringData = {
        userId: userProfile.userId,
        tier: userProfile.tier,
        history: tutoringHistory || [],
        preferences: userProfile.preferences,
        learningState: userProfile.learningState
      };
      
      // Initialize model capabilities based on tier
      await this._initializeModelCapabilities(userProfile.tier);
      
      this.logger.info(`[IntelligentTutoringSystem] Initialized successfully for user: ${userProfile.userId}`);
      return true;
    } catch (error) {
      this.logger.error(`[IntelligentTutoringSystem] Initialization failed: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Start a new tutoring session
   * @param {Object} options - Session options
   * @param {string} options.userId - User ID
   * @param {string} options.subject - Subject to tutor
   * @param {string} [options.topic] - Specific topic within subject
   * @param {string} [options.learningObjective] - Specific learning objective
   * @param {string} [options.difficulty] - Difficulty level
   * @param {string} [options.mode] - Tutoring mode (e.g., "guided", "exploratory", "practice")
   * @returns {Promise<Object>} Tutoring session
   */
  async startTutoringSession(options) {
    const { userId, subject, topic, learningObjective, difficulty, mode } = options;
    
    this.logger.info(`[IntelligentTutoringSystem] Starting tutoring session for user ${userId}, subject: ${subject}`);
    
    try {
      // Get user profile
      const userProfile = await this.learningProfileManager.getProfile(userId);
      if (!userProfile) {
        throw new Error(`User profile not found for ${userId}`);
      }
      
      // Create session
      const sessionId = uuidv4();
      const now = new Date();
      
      const session = {
        sessionId,
        userId,
        subject,
        topic,
        learningObjective,
        startTime: now,
        lastInteractionTime: now,
        mode: mode || "guided",
        difficulty: difficulty || this._determineDifficulty(userProfile, subject, topic),
        status: "active",
        progress: 0,
        interactions: [],
        metrics: {
          engagementScore: 0,
          correctResponses: 0,
          incorrectResponses: 0,
          hintsRequested: 0,
          timeSpent: 0,
          conceptsIntroduced: 0,
          conceptsMastered: 0
        },
        adaptationData: {
          currentBloomsLevel: this._determineStartingBloomsLevel(userProfile, subject, topic),
          paceAdjustment: 0, // -1 to 1 scale for slowing down or speeding up
          styleEmphasis: this._determineStyleEmphasis(userProfile),
          scaffoldingLevel: 0.5 // 0 to 1 scale for how much support to provide
        },
        creditUsage: {
          estimatedTotal: 0,
          consumed: 0,
          modelUsage: {}
        }
      };
      
      // Store session
      this.activeSessions.set(sessionId, session);
      
      // Generate initial content
      const initialContent = await this._generateInitialContent(session, userProfile);
      
      // Update session with initial content
      session.currentContent = initialContent;
      session.contentHistory = [initialContent];
      
      // Emit event
      this.emit("session.started", { 
        userId, 
        sessionId, 
        subject, 
        topic 
      });
      
      // Track credit usage for this operation
      await this._trackCreditUsage(userId, sessionId, initialContent.creditUsage || 0);
      
      this.logger.info(`[IntelligentTutoringSystem] Tutoring session ${sessionId} started successfully`);
      return session;
    } catch (error) {
      this.logger.error(`[IntelligentTutoringSystem] Failed to start tutoring session: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Process user interaction in tutoring session
   * @param {string} sessionId - Session ID
   * @param {Object} interaction - User interaction
   * @param {string} interaction.type - Interaction type (e.g., "answer", "question", "request_hint")
   * @param {string} interaction.content - Interaction content
   * @returns {Promise<Object>} Updated session with tutor response
   */
  async processInteraction(sessionId, interaction) {
    this.logger.debug(`[IntelligentTutoringSystem] Processing interaction for session ${sessionId}`);
    
    const session = this.activeSessions.get(sessionId);
    if (!session) {
      throw new Error(`Tutoring session not found: ${sessionId}`);
    }
    
    try {
      // Record interaction
      const now = new Date();
      const interactionRecord = {
        timestamp: now,
        type: interaction.type,
        content: interaction.content,
        metrics: {}
      };
      
      session.interactions.push(interactionRecord);
      session.lastInteractionTime = now;
      
      // Process based on interaction type
      let response;
      let creditUsage = 0;
      
      switch (interaction.type) {
        case "answer":
          response = await this._processAnswer(session, interaction.content);
          break;
        case "question":
          response = await this._processQuestion(session, interaction.content);
          break;
        case "request_hint":
          response = await this._generateHint(session);
          session.metrics.hintsRequested++;
          break;
        case "request_explanation":
          response = await this._generateExplanation(session, interaction.content);
          break;
        case "change_topic":
          response = await this._changeTopic(session, interaction.content);
          break;
        default:
          response = await this._generateGenericResponse(session, interaction);
      }
      
      // Update session
      session.currentResponse = response;
      creditUsage = response.creditUsage || 0;
      
      // Update metrics
      this._updateSessionMetrics(session, interaction, response);
      
      // Adapt tutoring approach if needed
      await this._adaptTutoringApproach(session);
      
      // Track credit usage
      await this._trackCreditUsage(session.userId, sessionId, creditUsage);
      
      // Emit event
      this.emit("interaction.processed", {
        sessionId,
        userId: session.userId,
        interactionType: interaction.type
      });
      
      return session;
    } catch (error) {
      this.logger.error(`[IntelligentTutoringSystem] Failed to process interaction: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * End tutoring session
   * @param {string} sessionId - Session ID
   * @returns {Promise<Object>} Completed session
   */
  async endTutoringSession(sessionId) {
    this.logger.info(`[IntelligentTutoringSystem] Ending tutoring session ${sessionId}`);
    
    const session = this.activeSessions.get(sessionId);
    if (!session) {
      throw new Error(`Tutoring session not found: ${sessionId}`);
    }
    
    try {
      // Update session status
      session.status = "completed";
      session.endTime = new Date();
      session.metrics.timeSpent = (session.endTime - session.startTime) / 1000; // in seconds
      
      // Generate session summary
      const summary = await this._generateSessionSummary(session);
      session.summary = summary;
      
      // Save session to storage
      await this.storage.saveTutoringSession(session);
      
      // Update user knowledge map
      await this._updateUserKnowledge(session);
      
      // Remove from active sessions
      this.activeSessions.delete(sessionId);
      
      // Emit event
      this.emit("session.ended", {
        sessionId,
        userId: session.userId,
        subject: session.subject,
        topic: session.topic,
        duration: session.metrics.timeSpent
      });
      
      this.logger.info(`[IntelligentTutoringSystem] Tutoring session ${sessionId} ended successfully`);
      return session;
    } catch (error) {
      this.logger.error(`[IntelligentTutoringSystem] Failed to end tutoring session: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Generate next content for tutoring session
   * @param {string} sessionId - Session ID
   * @returns {Promise<Object>} Next content
   */
  async generateNextContent(sessionId) {
    this.logger.debug(`[IntelligentTutoringSystem] Generating next content for session ${sessionId}`);
    
    const session = this.activeSessions.get(sessionId);
    if (!session) {
      throw new Error(`Tutoring session not found: ${sessionId}`);
    }
    
    try {
      // Get user profile for latest state
      const userProfile = await this.learningProfileManager.getProfile(session.userId);
      
      // Generate content based on session state and user profile
      const content = await this._generateContent(session, userProfile);
      
      // Update session
      session.currentContent = content;
      session.contentHistory.push(content);
      session.progress = Math.min(1, session.progress + 0.1); // Increment progress
      
      // Track credit usage
      await this._trackCreditUsage(session.userId, sessionId, content.creditUsage || 0);
      
      // Emit event
      this.emit("content.generated", {
        sessionId,
        userId: session.userId,
        contentType: content.type
      });
      
      return content;
    } catch (error) {
      this.logger.error(`[IntelligentTutoringSystem] Failed to generate next content: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Get active tutoring session
   * @param {string} sessionId - Session ID
   * @returns {Object|null} Tutoring session or null if not found
   */
  getSession(sessionId) {
    return this.activeSessions.get(sessionId) || null;
  }
  
  /**
   * Get all active tutoring sessions for a user
   * @param {string} userId - User ID
   * @returns {Array<Object>} Active tutoring sessions
   */
  getUserActiveSessions(userId) {
    const userSessions = [];
    for (const session of this.activeSessions.values()) {
      if (session.userId === userId) {
        userSessions.push(session);
      }
    }
    return userSessions;
  }
  
  // ====================================================================
  // PRIVATE METHODS
  // ====================================================================
  
  /**
   * Initialize model capabilities based on user tier
   * @param {string} tier - User tier
   * @returns {Promise<void>}
   * @private
   */
  async _initializeModelCapabilities(tier) {
    this.logger.debug(`[IntelligentTutoringSystem] Initializing model capabilities for tier: ${tier}`);
    
    // Determine which models to use based on tier
    switch (tier.toLowerCase()) {
      case "enterprise":
        this.textModelId = "qwen2_72b"; // Most capable model for enterprise tier
        this.useApiExtension = true;
        break;
      case "pro":
        this.textModelId = "mixtral_8x22b"; // Powerful model for pro tier
        this.useApiExtension = true;
        break;
      case "standard":
        this.textModelId = "llama_3_1_8b"; // Good balance for standard tier
        this.useApiExtension = true;
        break;
      default: // Free tier
        this.textModelId = "llama_3_1_8b"; // Base model for free tier
        this.useApiExtension = false;
    }
    
    // Initialize offline model
    try {
      await this.modelOrchestrator.getModelForTask("text-generation", {
        tier,
        offlineMode: true
      });
      this.logger.info(`[IntelligentTutoringSystem] Offline model initialized for tier: ${tier}`);
    } catch (error) {
      this.logger.warn(`[IntelligentTutoringSystem] Failed to initialize offline model: ${error.message}`);
    }
  }
  
  /**
   * Determine appropriate difficulty level based on user profile and subject
   * @param {Object} userProfile - User profile
   * @param {string} subject - Subject
   * @param {string} topic - Topic
   * @returns {string} Difficulty level
   * @private
   */
  _determineDifficulty(userProfile, subject, topic) {
    // Check if user has knowledge in this subject
    const subjectKnowledge = userProfile.learningState.knowledgeMap[subject];
    if (!subjectKnowledge) {
      return "beginner";
    }
    
    // If topic is specified, check topic mastery
    if (topic && subjectKnowledge.concepts[topic]) {
      const topicMastery = subjectKnowledge.concepts[topic].mastery;
      if (topicMastery < 0.3) return "beginner";
      if (topicMastery < 0.7) return "intermediate";
      return "advanced";
    }
    
    // Otherwise use overall subject mastery
    const masteryLevel = subjectKnowledge.masteryLevel;
    if (masteryLevel < 0.3) return "beginner";
    if (masteryLevel < 0.7) return "intermediate";
    return "advanced";
  }
  
  /**
   * Determine starting Bloom's Taxonomy level based on user profile and subject
   * @param {Object} userProfile - User profile
   * @param {string} subject - Subject
   * @param {string} topic - Topic
   * @returns {string} Bloom's level
   * @private
   */
  _determineStartingBloomsLevel(userProfile, subject, topic) {
    // Check if user has knowledge in this subject
    const subjectKnowledge = userProfile.learningState.knowledgeMap[subject];
    if (!subjectKnowledge) {
      return BloomsLevel.REMEMBERING;
    }
    
    // If topic is specified, check topic mastery
    if (topic && subjectKnowledge.concepts[topic]) {
      const topicMastery = subjectKnowledge.concepts[topic].mastery;
      if (topicMastery < 0.2) return BloomsLevel.REMEMBERING;
      if (topicMastery < 0.4) return BloomsLevel.UNDERSTANDING;
      if (topicMastery < 0.6) return BloomsLevel.APPLYING;
      if (topicMastery < 0.8) return BloomsLevel.ANALYZING;
      return BloomsLevel.EVALUATING;
    }
    
    // Otherwise use overall subject mastery
    const masteryLevel = subjectKnowledge.masteryLevel;
    if (masteryLevel < 0.2) return BloomsLevel.REMEMBERING;
    if (masteryLevel < 0.4) return BloomsLevel.UNDERSTANDING;
    if (masteryLevel < 0.6) return BloomsLevel.APPLYING;
    if (masteryLevel < 0.8) return BloomsLevel.ANALYZING;
    return BloomsLevel.EVALUATING;
  }
  
  /**
   * Determine learning style emphasis based on user profile
   * @param {Object} userProfile - User profile
   * @returns {Object} Style emphasis
   * @private
   */
  _determineStyleEmphasis(userProfile) {
    const style = userProfile.preferences.learningStyle || LearningStyle.VISUAL;
    
    // Create emphasis object with all styles
    const emphasis = {
      [LearningStyle.VISUAL]: 0.25,
      [LearningStyle.AUDITORY]: 0.25,
      [LearningStyle.READING]: 0.25,
      [LearningStyle.KINESTHETIC]: 0.25
    };
    
    // Emphasize preferred style
    emphasis[style] = 0.55;
    
    // Reduce others proportionally
    for (const s in emphasis) {
      if (s !== style) {
        emphasis[s] = 0.15;
      }
    }
    
    return emphasis;
  }
  
  /**
   * Generate initial content for tutoring session
   * @param {Object} session - Tutoring session
   * @param {Object} userProfile - User profile
   * @returns {Promise<Object>} Initial content
   * @private
   */
  async _generateInitialContent(session, userProfile) {
    this.logger.debug(`[IntelligentTutoringSystem] Generating initial content for session ${session.sessionId}`);
    
    try {
      // Determine if we should use online or offline model
      const useOnlineModel = this.useApiExtension && this._shouldUseOnlineModel(session);
      
      let content;
      let creditUsage = 0;
      
      if (useOnlineModel) {
        // Use API service for advanced capabilities
        const apiResult = await this._generateContentViaApi(session, userProfile);
        content = apiResult.content;
        creditUsage = apiResult.creditUsage;
      } else {
        // Use local model
        content = await this._generateContentViaLocalModel(session, userProfile);
      }
      
      // Format content based on learning style
      content = this._formatContentForLearningStyle(content, userProfile.preferences.learningStyle);
      
      // Add credit usage information
      content.creditUsage = creditUsage;
      
      return content;
    } catch (error) {
      this.logger.error(`[IntelligentTutoringSystem] Failed to generate initial content: ${error.message}`);
      
      // Fallback to simple content if generation fails
      return {
        type: "introduction",
        title: `Introduction to ${session.topic || session.subject}`,
        sections: [
          {
            type: "text",
            content: `Welcome to this tutoring session on ${session.topic || session.subject}. Let's start exploring this subject together.`
          }
        ],
        questions: [
          {
            type: "open",
            question: `What would you like to know about ${session.topic || session.subject}?`
          }
        ],
        creditUsage: 0
      };
    }
  }
  
  /**
   * Generate content via local model
   * @param {Object} session - Tutoring session
   * @param {Object} userProfile - User profile
   * @returns {Promise<Object>} Generated content
   * @private
   */
  async _generateContentViaLocalModel(session, userProfile) {
    this.logger.debug(`[IntelligentTutoringSystem] Generating content via local model for session ${session.sessionId}`);
    
    try {
      const model = await this.modelOrchestrator.getModelForTask("text-generation", {
        tier: userProfile.tier,
        offlineMode: true
      });
      
      // Prepare prompt based on session and user profile
      const prompt = this._prepareContentGenerationPrompt(session, userProfile);
      
      // Generate content
      const result = await model.generateText({
        prompt,
        maxTokens: 1024,
        temperature: 0.7
      });
      
      // Parse and structure the result
      return this._parseGeneratedContent(result.text, session);
    } catch (error) {
      this.logger.error(`[IntelligentTutoringSystem] Local model content generation failed: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Generate content via API service
   * @param {Object} session - Tutoring session
   * @param {Object} userProfile - User profile
   * @returns {Promise<Object>} Generated content and credit usage
   * @private
   */
  async _generateContentViaApi(session, userProfile) {
    this.logger.debug(`[IntelligentTutoringSystem] Generating content via API for session ${session.sessionId}`);
    
    try {
      // Find best API service for educational content generation
      const serviceId = this.apiServiceIntegration.findBestApiServiceForTask("text-generation", {
        tier: userProfile.tier
      });
      
      if (!serviceId) {
        throw new Error("No suitable API service found for content generation");
      }
      
      // Prepare prompt
      const prompt = this._prepareContentGenerationPrompt(session, userProfile);
      
      // Execute API request
      const response = await this.apiServiceIntegration.executeApiRequest(serviceId, {
        prompt,
        max_tokens: 2048,
        temperature: 0.7,
        format: "json"
      });
      
      // Parse and structure the result
      const content = this._parseGeneratedContent(response.text || response.content || response.generated_text, session);
      
      // Calculate credit usage
      const creditUsage = response.usage ? response.usage.total_tokens * 0.001 : 10; // Default to 10 credits if usage not provided
      
      return { content, creditUsage };
    } catch (error) {
      this.logger.error(`[IntelligentTutoringSystem] API content generation failed: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Prepare prompt for content generation
   * @param {Object} session - Tutoring session
   * @param {Object} userProfile - User profile
   * @returns {string} Prompt for content generation
   * @private
   */
  _prepareContentGenerationPrompt(session, userProfile) {
    const { subject, topic, difficulty, mode } = session;
    const bloomsLevel = session.adaptationData.currentBloomsLevel;
    const learningStyle = userProfile.preferences.learningStyle;
    const ageGroup = userProfile.demographics.ageGroup;
    
    // Build prompt
    let prompt = `Generate educational content for a tutoring session with the following parameters:
Subject: ${subject}
${topic ? `Topic: ${topic}` : ''}
Difficulty: ${difficulty}
Mode: ${mode}
Bloom's Taxonomy Level: ${bloomsLevel}
Preferred Learning Style: ${learningStyle}
Age Group: ${ageGroup}

The content should include:
1. An engaging introduction to the topic
2. Key concepts explained clearly
3. Examples that illustrate the concepts
4. Interactive elements appropriate for the learning style
5. Questions to check understanding

Format the response as a structured JSON object with the following schema:
{
  "type": "lesson",
  "title": "Title of the lesson",
  "sections": [
    {
      "type": "text|image|video|interactive",
      "title": "Section title",
      "content": "Section content"
    }
  ],
  "questions": [
    {
      "type": "multiple_choice|open|true_false",
      "question": "Question text",
      "options": ["Option 1", "Option 2", "Option 3", "Option 4"],
      "correctAnswer": "Correct answer or index"
    }
  ]
}`;

    return prompt;
  }
  
  /**
   * Parse generated content from model output
   * @param {string} generatedText - Generated text from model
   * @param {Object} session - Tutoring session
   * @returns {Object} Structured content
   * @private
   */
  _parseGeneratedContent(generatedText, session) {
    try {
      // Try to parse as JSON
      let content;
      
      // Extract JSON if wrapped in markdown code blocks or other text
      const jsonMatch = generatedText.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/) || 
                        generatedText.match(/(\{[\s\S]*\})/);
      
      if (jsonMatch && jsonMatch[1]) {
        content = JSON.parse(jsonMatch[1]);
      } else {
        // Fallback to parsing the whole text
        try {
          content = JSON.parse(generatedText);
        } catch (e) {
          // If parsing fails, create a structured content from the text
          content = {
            type: "lesson",
            title: `${session.topic || session.subject} - Lesson`,
            sections: [
              {
                type: "text",
                title: "Introduction",
                content: generatedText
              }
            ],
            questions: [
              {
                type: "open",
                question: `What did you learn about ${session.topic || session.subject}?`
              }
            ]
          };
        }
      }
      
      // Validate and ensure required structure
      if (!content.type) content.type = "lesson";
      if (!content.title) content.title = `${session.topic || session.subject} - Lesson`;
      if (!content.sections || !Array.isArray(content.sections) || content.sections.length === 0) {
        content.sections = [
          {
            type: "text",
            title: "Introduction",
            content: "Let's explore this topic together."
          }
        ];
      }
      if (!content.questions || !Array.isArray(content.questions) || content.questions.length === 0) {
        content.questions = [
          {
            type: "open",
            question: `What would you like to know about ${session.topic || session.subject}?`
          }
        ];
      }
      
      return content;
    } catch (error) {
      this.logger.error(`[IntelligentTutoringSystem] Failed to parse generated content: ${error.message}`);
      
      // Return a simple fallback content
      return {
        type: "lesson",
        title: `${session.topic || session.subject} - Lesson`,
        sections: [
          {
            type: "text",
            title: "Introduction",
            content: "Let's explore this topic together."
          }
        ],
        questions: [
          {
            type: "open",
            question: `What would you like to know about ${session.topic || session.subject}?`
          }
        ]
      };
    }
  }
  
  /**
   * Format content based on learning style
   * @param {Object} content - Content to format
   * @param {string} learningStyle - Learning style
   * @returns {Object} Formatted content
   * @private
   */
  _formatContentForLearningStyle(content, learningStyle) {
    // Clone content to avoid modifying the original
    const formattedContent = JSON.parse(JSON.stringify(content));
    
    // Add style-specific formatting
    switch (learningStyle) {
      case LearningStyle.VISUAL:
        // Emphasize visual elements
        formattedContent.visualEmphasis = true;
        break;
      case LearningStyle.AUDITORY:
        // Add audio narration suggestions
        formattedContent.audioNarration = true;
        break;
      case LearningStyle.READING:
        // Emphasize text and reading materials
        formattedContent.textEmphasis = true;
        break;
      case LearningStyle.KINESTHETIC:
        // Add interactive exercises
        formattedContent.interactiveExercises = true;
        break;
    }
    
    return formattedContent;
  }
  
  /**
   * Process user answer
   * @param {Object} session - Tutoring session
   * @param {string} answer - User answer
   * @returns {Promise<Object>} Response
   * @private
   */
  async _processAnswer(session, answer) {
    this.logger.debug(`[IntelligentTutoringSystem] Processing answer for session ${session.sessionId}`);
    
    try {
      // Get current question
      const currentQuestion = session.currentContent.questions[0];
      if (!currentQuestion) {
        return {
          type: "feedback",
          content: "I don't have a specific question to evaluate your answer against. Let's continue with the lesson.",
          isCorrect: null,
          creditUsage: 0
        };
      }
      
      // Determine if we should use online or offline model
      const useOnlineModel = this.useApiExtension && this._shouldUseOnlineModel(session);
      
      let feedback;
      let creditUsage = 0;
      
      if (useOnlineModel) {
        // Use API service for advanced evaluation
        const apiResult = await this._evaluateAnswerViaApi(session, currentQuestion, answer);
        feedback = apiResult.feedback;
        creditUsage = apiResult.creditUsage;
      } else {
        // Use local model
        feedback = await this._evaluateAnswerViaLocalModel(session, currentQuestion, answer);
      }
      
      // Update metrics based on correctness
      if (feedback.isCorrect) {
        session.metrics.correctResponses++;
      } else if (feedback.isCorrect === false) {
        session.metrics.incorrectResponses++;
      }
      
      // Add credit usage information
      feedback.creditUsage = creditUsage;
      
      return feedback;
    } catch (error) {
      this.logger.error(`[IntelligentTutoringSystem] Failed to process answer: ${error.message}`);
      
      // Return generic feedback if processing fails
      return {
        type: "feedback",
        content: "Thank you for your answer. Let's continue with our lesson.",
        isCorrect: null,
        creditUsage: 0
      };
    }
  }
  
  /**
   * Evaluate answer via local model
   * @param {Object} session - Tutoring session
   * @param {Object} question - Current question
   * @param {string} answer - User answer
   * @returns {Promise<Object>} Feedback
   * @private
   */
  async _evaluateAnswerViaLocalModel(session, question, answer) {
    try {
      const model = await this.modelOrchestrator.getModelForTask("text-generation", {
        offlineMode: true
      });
      
      // Prepare prompt
      const prompt = `Evaluate the following answer to a question:
Question: ${question.question}
${question.options ? `Options: ${question.options.join(', ')}` : ''}
${question.correctAnswer ? `Correct Answer: ${question.correctAnswer}` : ''}
User's Answer: ${answer}

Provide feedback on the answer. If the question has a correct answer, determine if the user's answer is correct.
Format your response as a JSON object with the following structure:
{
  "isCorrect": true/false/null,
  "feedback": "Detailed feedback on the answer",
  "explanation": "Explanation of the correct answer if needed"
}`;
      
      // Generate feedback
      const result = await model.generateText({
        prompt,
        maxTokens: 512,
        temperature: 0.3
      });
      
      // Parse feedback
      try {
        const jsonMatch = result.text.match(/(\{[\s\S]*\})/);
        if (jsonMatch && jsonMatch[1]) {
          const parsed = JSON.parse(jsonMatch[1]);
          return {
            type: "feedback",
            content: parsed.feedback,
            explanation: parsed.explanation,
            isCorrect: parsed.isCorrect
          };
        }
      } catch (e) {
        // Parsing failed, use text as is
      }
      
      // Fallback if parsing fails
      return {
        type: "feedback",
        content: result.text,
        isCorrect: null
      };
    } catch (error) {
      this.logger.error(`[IntelligentTutoringSystem] Local model answer evaluation failed: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Evaluate answer via API service
   * @param {Object} session - Tutoring session
   * @param {Object} question - Current question
   * @param {string} answer - User answer
   * @returns {Promise<Object>} Feedback and credit usage
   * @private
   */
  async _evaluateAnswerViaApi(session, question, answer) {
    try {
      // Get user profile for tier information
      const userProfile = await this.learningProfileManager.getProfile(session.userId);
      
      // Find best API service
      const serviceId = this.apiServiceIntegration.findBestApiServiceForTask("text-generation", {
        tier: userProfile.tier
      });
      
      if (!serviceId) {
        throw new Error("No suitable API service found for answer evaluation");
      }
      
      // Prepare prompt
      const prompt = `Evaluate the following answer to a question:
Question: ${question.question}
${question.options ? `Options: ${question.options.join(', ')}` : ''}
${question.correctAnswer ? `Correct Answer: ${question.correctAnswer}` : ''}
User's Answer: ${answer}

Provide detailed, educational feedback on the answer. If the question has a correct answer, determine if the user's answer is correct.
Format your response as a JSON object with the following structure:
{
  "isCorrect": true/false/null,
  "feedback": "Detailed feedback on the answer",
  "explanation": "Explanation of the correct answer if needed"
}`;
      
      // Execute API request
      const response = await this.apiServiceIntegration.executeApiRequest(serviceId, {
        prompt,
        max_tokens: 512,
        temperature: 0.3,
        format: "json"
      });
      
      // Parse feedback
      let feedback;
      try {
        const content = response.text || response.content || response.generated_text;
        const jsonMatch = content.match(/(\{[\s\S]*\})/);
        if (jsonMatch && jsonMatch[1]) {
          const parsed = JSON.parse(jsonMatch[1]);
          feedback = {
            type: "feedback",
            content: parsed.feedback,
            explanation: parsed.explanation,
            isCorrect: parsed.isCorrect
          };
        } else {
          // Use text as is
          feedback = {
            type: "feedback",
            content,
            isCorrect: null
          };
        }
      } catch (e) {
        // Parsing failed, use text as is
        const content = response.text || response.content || response.generated_text;
        feedback = {
          type: "feedback",
          content,
          isCorrect: null
        };
      }
      
      // Calculate credit usage
      const creditUsage = response.usage ? response.usage.total_tokens * 0.001 : 5; // Default to 5 credits if usage not provided
      
      return { feedback, creditUsage };
    } catch (error) {
      this.logger.error(`[IntelligentTutoringSystem] API answer evaluation failed: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Process user question
   * @param {Object} session - Tutoring session
   * @param {string} question - User question
   * @returns {Promise<Object>} Response
   * @private
   */
  async _processQuestion(session, question) {
    // Similar implementation to _processAnswer but for questions
    // Would use models to generate appropriate responses to user questions
    
    // Placeholder implementation
    return {
      type: "answer",
      content: `That's a great question about ${session.topic || session.subject}. Let me explain...`,
      creditUsage: 0
    };
  }
  
  /**
   * Generate hint
   * @param {Object} session - Tutoring session
   * @returns {Promise<Object>} Hint
   * @private
   */
  async _generateHint(session) {
    // Placeholder implementation
    return {
      type: "hint",
      content: `Here's a hint to help you with this ${session.topic || session.subject} problem...`,
      creditUsage: 0
    };
  }
  
  /**
   * Generate explanation
   * @param {Object} session - Tutoring session
   * @param {string} concept - Concept to explain
   * @returns {Promise<Object>} Explanation
   * @private
   */
  async _generateExplanation(session, concept) {
    // Placeholder implementation
    return {
      type: "explanation",
      content: `Let me explain ${concept} in the context of ${session.topic || session.subject}...`,
      creditUsage: 0
    };
  }
  
  /**
   * Change topic
   * @param {Object} session - Tutoring session
   * @param {string} newTopic - New topic
   * @returns {Promise<Object>} Response
   * @private
   */
  async _changeTopic(session, newTopic) {
    // Update session topic
    session.topic = newTopic;
    
    // Generate new content for the topic
    const userProfile = await this.learningProfileManager.getProfile(session.userId);
    const content = await this._generateInitialContent(session, userProfile);
    
    // Update session
    session.currentContent = content;
    session.contentHistory.push(content);
    
    return {
      type: "topic_change",
      content: `Let's explore ${newTopic} within ${session.subject}.`,
      creditUsage: content.creditUsage || 0
    };
  }
  
  /**
   * Generate generic response
   * @param {Object} session - Tutoring session
   * @param {Object} interaction - User interaction
   * @returns {Promise<Object>} Response
   * @private
   */
  async _generateGenericResponse(session, interaction) {
    // Placeholder implementation
    return {
      type: "response",
      content: `I understand your ${interaction.type}. Let's continue with our ${session.topic || session.subject} lesson.`,
      creditUsage: 0
    };
  }
  
  /**
   * Update session metrics
   * @param {Object} session - Tutoring session
   * @param {Object} interaction - User interaction
   * @param {Object} response - Tutor response
   * @private
   */
  _updateSessionMetrics(session, interaction, response) {
    // Update engagement score based on interaction
    const now = new Date();
    const timeSinceLastInteraction = (now - session.lastInteractionTime) / 1000; // in seconds
    
    // If response time is quick, increase engagement
    if (timeSinceLastInteraction < 60) {
      session.metrics.engagementScore = Math.min(1, session.metrics.engagementScore + 0.05);
    } else if (timeSinceLastInteraction > 300) {
      // If response time is slow, decrease engagement
      session.metrics.engagementScore = Math.max(0, session.metrics.engagementScore - 0.05);
    }
    
    // Update other metrics based on interaction type
    if (interaction.type === "question") {
      // Questions indicate engagement
      session.metrics.engagementScore = Math.min(1, session.metrics.engagementScore + 0.1);
    }
  }
  
  /**
   * Adapt tutoring approach based on session progress
   * @param {Object} session - Tutoring session
   * @returns {Promise<void>}
   * @private
   */
  async _adaptTutoringApproach(session) {
    // Adjust difficulty based on performance
    const correctRatio = session.metrics.correctResponses / 
      (session.metrics.correctResponses + session.metrics.incorrectResponses || 1);
    
    if (correctRatio > 0.8 && session.interactions.length > 5) {
      // User is doing well, increase difficulty
      this._adjustBloomsLevel(session, 1);
      session.adaptationData.scaffoldingLevel = Math.max(0, session.adaptationData.scaffoldingLevel - 0.1);
    } else if (correctRatio < 0.5 && session.interactions.length > 3) {
      // User is struggling, decrease difficulty
      this._adjustBloomsLevel(session, -1);
      session.adaptationData.scaffoldingLevel = Math.min(1, session.adaptationData.scaffoldingLevel + 0.2);
    }
    
    // Adjust pace based on engagement
    if (session.metrics.engagementScore < 0.3) {
      // Low engagement, speed up
      session.adaptationData.paceAdjustment = Math.min(1, session.adaptationData.paceAdjustment + 0.2);
    } else if (session.metrics.engagementScore > 0.8) {
      // High engagement, maintain pace
      session.adaptationData.paceAdjustment = 0;
    }
  }
  
  /**
   * Adjust Bloom's Taxonomy level
   * @param {Object} session - Tutoring session
   * @param {number} adjustment - Level adjustment (+1 or -1)
   * @private
   */
  _adjustBloomsLevel(session, adjustment) {
    const bloomsLevels = [
      BloomsLevel.REMEMBERING,
      BloomsLevel.UNDERSTANDING,
      BloomsLevel.APPLYING,
      BloomsLevel.ANALYZING,
      BloomsLevel.EVALUATING,
      BloomsLevel.CREATING
    ];
    
    const currentIndex = bloomsLevels.indexOf(session.adaptationData.currentBloomsLevel);
    if (currentIndex === -1) return;
    
    const newIndex = Math.max(0, Math.min(bloomsLevels.length - 1, currentIndex + adjustment));
    session.adaptationData.currentBloomsLevel = bloomsLevels[newIndex];
  }
  
  /**
   * Generate session summary
   * @param {Object} session - Tutoring session
   * @returns {Promise<Object>} Session summary
   * @private
   */
  async _generateSessionSummary(session) {
    // Placeholder implementation
    return {
      duration: session.metrics.timeSpent,
      conceptsCovered: session.metrics.conceptsIntroduced,
      conceptsMastered: session.metrics.conceptsMastered,
      performance: {
        correctResponses: session.metrics.correctResponses,
        incorrectResponses: session.metrics.incorrectResponses,
        accuracy: session.metrics.correctResponses / 
          (session.metrics.correctResponses + session.metrics.incorrectResponses || 1)
      },
      nextSteps: [
        `Continue exploring ${session.topic || session.subject}`,
        `Practice more with ${session.adaptationData.currentBloomsLevel} level activities`
      ]
    };
  }
  
  /**
   * Update user knowledge based on session
   * @param {Object} session - Tutoring session
   * @returns {Promise<void>}
   * @private
   */
  async _updateUserKnowledge(session) {
    try {
      // Extract concepts covered in the session
      const conceptsCovered = this._extractConceptsFromSession(session);
      
      // Calculate mastery updates
      const knowledgeUpdates = {
        masteryLevel: this._calculateOverallMastery(session),
        concepts: {}
      };
      
      // Update mastery for each concept
      for (const concept of conceptsCovered) {
        knowledgeUpdates.concepts[concept.id] = {
          mastery: concept.mastery,
          source: "tutoring_session"
        };
      }
      
      // Update user knowledge map
      await this.learningProfileManager.updateKnowledgeMap(
        session.userId,
        session.subject,
        knowledgeUpdates
      );
      
      this.logger.info(`[IntelligentTutoringSystem] Updated knowledge map for user ${session.userId}, subject ${session.subject}`);
    } catch (error) {
      this.logger.error(`[IntelligentTutoringSystem] Failed to update user knowledge: ${error.message}`);
    }
  }
  
  /**
   * Extract concepts covered in session
   * @param {Object} session - Tutoring session
   * @returns {Array<Object>} Concepts with mastery levels
   * @private
   */
  _extractConceptsFromSession(session) {
    // Placeholder implementation
    // In a real implementation, this would analyze session content and interactions
    // to identify concepts covered and estimate mastery
    return [
      { id: `${session.topic || session.subject}_concept1`, mastery: 0.7 },
      { id: `${session.topic || session.subject}_concept2`, mastery: 0.5 }
    ];
  }
  
  /**
   * Calculate overall mastery from session
   * @param {Object} session - Tutoring session
   * @returns {number} Overall mastery level (0-1)
   * @private
   */
  _calculateOverallMastery(session) {
    // Placeholder implementation
    // In a real implementation, this would be based on performance metrics
    const correctRatio = session.metrics.correctResponses / 
      (session.metrics.correctResponses + session.metrics.incorrectResponses || 1);
    
    // Weight by number of interactions
    const interactionWeight = Math.min(1, session.interactions.length / 10);
    
    return correctRatio * interactionWeight;
  }
  
  /**
   * Track credit usage
   * @param {string} userId - User ID
   * @param {string} sessionId - Session ID
   * @param {number} credits - Credits used
   * @returns {Promise<void>}
   * @private
   */
  async _trackCreditUsage(userId, sessionId, credits) {
    if (credits <= 0) return;
    
    try {
      // Update session credit usage
      const session = this.activeSessions.get(sessionId);
      if (session) {
        if (!session.creditUsage.modelUsage[this.textModelId]) {
          session.creditUsage.modelUsage[this.textModelId] = 0;
        }
        session.creditUsage.modelUsage[this.textModelId] += credits;
        session.creditUsage.consumed += credits;
        session.creditUsage.estimatedTotal += credits;
      }
      
      // Update user profile credit balance
      await this.learningProfileManager.updateCreditBalance(userId, credits);
      
      this.logger.debug(`[IntelligentTutoringSystem] Tracked ${credits} credits for user ${userId}, session ${sessionId}`);
    } catch (error) {
      this.logger.error(`[IntelligentTutoringSystem] Failed to track credit usage: ${error.message}`);
    }
  }
  
  /**
   * Determine if online model should be used
   * @param {Object} session - Tutoring session
   * @returns {boolean} Whether to use online model
   * @private
   */
  _shouldUseOnlineModel(session) {
    // Check if we're allowed to use API extension
    if (!this.useApiExtension) return false;
    
    // For complex topics or higher Bloom's levels, prefer online models
    const complexTopics = ["quantum_physics", "advanced_mathematics", "machine_learning"];
    const highBloomsLevels = [BloomsLevel.ANALYZING, BloomsLevel.EVALUATING, BloomsLevel.CREATING];
    
    if (complexTopics.includes(session.subject) || 
        highBloomsLevels.includes(session.adaptationData.currentBloomsLevel)) {
      return true;
    }
    
    // For most interactions, use local model to save credits
    return false;
  }
}

module.exports = IntelligentTutoringSystem;
