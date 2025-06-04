/**
 * @fileoverview Integration tests for the Personal Assistant Tentacle.
 * Tests the integration between all components and model integration functionality.
 * 
 * @module src/tentacles/personal_assistant/test/PersonalAssistantTentacleIntegrationTest
 */

const assert = require('assert');
const PersonalAssistantTentacle = require('../PersonalAssistantTentacle');
const MockLogger = require('../../../../test/mocks/Logger');
const MockMemoryTentacle = require('../../../../test/mocks/MemoryTentacle');
const MockSecurityFramework = require('../../../../test/mocks/SecurityFramework');
const MockModelIntegrationManager = require('../../../../test/mocks/ModelIntegrationManager');
const MockWebTentacle = require('../../../../test/mocks/WebTentacle');
const MockFileSystemTentacle = require('../../../../test/mocks/FileSystemTentacle');

/**
 * Personal Assistant Tentacle Integration Test
 */
class PersonalAssistantTentacleIntegrationTest {
  /**
   * Run all integration tests
   */
  static async runTests() {
    console.log('\n=== Personal Assistant Tentacle Integration Tests ===\n');
    
    try {
      await this.testTentacleInitialization();
      await this.testComponentIntegration();
      await this.testModelIntegration();
      await this.testTaskManagementIntegration();
      await this.testCalendarIntegration();
      await this.testContactManagementIntegration();
      await this.testCommunicationIntegration();
      await this.testInformationOrganizationIntegration();
      await this.testLifestyleManagementIntegration();
      await this.testPersonalBrandingIntegration();
      await this.testSocialMediaManagementIntegration();
      await this.testProactiveIntelligenceIntegration();
      await this.testOfflineCapability();
      await this.testEventPropagation();
      
      console.log('\n✅ All Personal Assistant Tentacle integration tests passed!\n');
    } catch (error) {
      console.error('\n❌ Personal Assistant Tentacle integration tests failed:', error);
      throw error;
    }
  }
  
  /**
   * Test tentacle initialization
   */
  static async testTentacleInitialization() {
    console.log('Testing tentacle initialization...');
    
    // Create dependencies
    const dependencies = this._createMockDependencies();
    
    // Create tentacle
    const tentacle = new PersonalAssistantTentacle({}, dependencies);
    
    // Verify tentacle initialization
    assert(tentacle, 'Tentacle should be initialized');
    assert.strictEqual(tentacle.name, 'personal_assistant', 'Tentacle name should be personal_assistant');
    assert(tentacle.taskManagement, 'Task Management System should be initialized');
    assert(tentacle.calendarEngine, 'Calendar Engine should be initialized');
    assert(tentacle.contactManagement, 'Contact Management System should be initialized');
    assert(tentacle.communicationAssistant, 'Communication Assistant should be initialized');
    assert(tentacle.informationSystem, 'Information Organization System should be initialized');
    assert(tentacle.lifestyleAssistant, 'Lifestyle Management Assistant should be initialized');
    assert(tentacle.personalBranding, 'Personal Branding Management System should be initialized');
    assert(tentacle.socialMediaManagement, 'Social Media Management System should be initialized');
    assert(tentacle.proactiveIntelligence, 'Proactive Intelligence System should be initialized');
    
    console.log('✅ Tentacle initialization test passed');
  }
  
  /**
   * Test component integration
   */
  static async testComponentIntegration() {
    console.log('Testing component integration...');
    
    // Create dependencies
    const dependencies = this._createMockDependencies();
    
    // Create tentacle
    const tentacle = new PersonalAssistantTentacle({}, dependencies);
    
    // Get tentacle status
    const status = await tentacle.getStatus();
    
    // Verify status contains all components
    assert(status, 'Status should be returned');
    assert(status.components.taskManagement, 'Status should include Task Management System');
    assert(status.components.calendarEngine, 'Status should include Calendar Engine');
    assert(status.components.contactManagement, 'Status should include Contact Management System');
    assert(status.components.communicationAssistant, 'Status should include Communication Assistant');
    assert(status.components.informationSystem, 'Status should include Information Organization System');
    assert(status.components.lifestyleAssistant, 'Status should include Lifestyle Management Assistant');
    assert(status.components.personalBranding, 'Status should include Personal Branding Management System');
    assert(status.components.socialMediaManagement, 'Status should include Social Media Management System');
    assert(status.components.proactiveIntelligence, 'Status should include Proactive Intelligence System');
    
    console.log('✅ Component integration test passed');
  }
  
  /**
   * Test model integration
   */
  static async testModelIntegration() {
    console.log('Testing model integration...');
    
    // Create dependencies with mock model integration manager
    const dependencies = this._createMockDependencies();
    const modelIntegrationManager = dependencies.modelIntegrationManager;
    
    // Create tentacle
    const tentacle = new PersonalAssistantTentacle({}, dependencies);
    
    // Verify model integration manager was used
    assert(modelIntegrationManager.getModelIntegrationCalls.length > 0, 'Model integration manager should be used');
    
    // Test model integration in personal branding
    const contentRequest = {
      type: 'bio',
      platform: 'linkedin',
      tone: 'professional'
    };
    
    const brandingContent = await tentacle.generateBrandingContent(contentRequest);
    assert(brandingContent, 'Branding content should be generated');
    assert(brandingContent.content, 'Branding content should have content property');
    
    // Test model integration in social media management
    const contentIdeas = await tentacle.generateSocialMediaContentIdeas({
      platform: 'twitter',
      topics: ['technology', 'ai']
    });
    
    assert(Array.isArray(contentIdeas), 'Content ideas should be an array');
    assert(contentIdeas.length > 0, 'Content ideas should not be empty');
    
    console.log('✅ Model integration test passed');
  }
  
  /**
   * Test task management integration
   */
  static async testTaskManagementIntegration() {
    console.log('Testing task management integration...');
    
    // Create dependencies
    const dependencies = this._createMockDependencies();
    
    // Create tentacle
    const tentacle = new PersonalAssistantTentacle({}, dependencies);
    
    // Create task
    const taskData = {
      title: 'Test Task',
      description: 'This is a test task',
      dueDate: new Date(Date.now() + 24 * 60 * 60 * 1000), // Tomorrow
      priority: 'high'
    };
    
    const task = await tentacle.createTask(taskData);
    assert(task, 'Task should be created');
    assert.strictEqual(task.title, taskData.title, 'Task title should match');
    
    // Get task
    const retrievedTask = await tentacle.getTask(task.id);
    assert(retrievedTask, 'Task should be retrieved');
    assert.strictEqual(retrievedTask.id, task.id, 'Task ID should match');
    
    // Update task
    const updatedTask = await tentacle.updateTask(task.id, { priority: 'medium' });
    assert(updatedTask, 'Task should be updated');
    assert.strictEqual(updatedTask.priority, 'medium', 'Task priority should be updated');
    
    // Complete task
    const completedTask = await tentacle.completeTask(task.id);
    assert(completedTask, 'Task should be completed');
    assert.strictEqual(completedTask.status, 'completed', 'Task status should be completed');
    
    // Get all tasks
    const allTasks = await tentacle.getAllTasks();
    assert(Array.isArray(allTasks), 'All tasks should be an array');
    assert(allTasks.length > 0, 'All tasks should not be empty');
    
    console.log('✅ Task management integration test passed');
  }
  
  /**
   * Test calendar integration
   */
  static async testCalendarIntegration() {
    console.log('Testing calendar integration...');
    
    // Create dependencies
    const dependencies = this._createMockDependencies();
    
    // Create tentacle
    const tentacle = new PersonalAssistantTentacle({}, dependencies);
    
    // Create calendar event
    const eventData = {
      title: 'Test Event',
      description: 'This is a test event',
      startTime: new Date(Date.now() + 24 * 60 * 60 * 1000), // Tomorrow
      endTime: new Date(Date.now() + 25 * 60 * 60 * 1000), // Tomorrow + 1 hour
      location: 'Test Location'
    };
    
    const event = await tentacle.createCalendarEvent(eventData);
    assert(event, 'Event should be created');
    assert.strictEqual(event.title, eventData.title, 'Event title should match');
    
    // Get event
    const retrievedEvent = await tentacle.getCalendarEvent(event.id);
    assert(retrievedEvent, 'Event should be retrieved');
    assert.strictEqual(retrievedEvent.id, event.id, 'Event ID should match');
    
    // Update event
    const updatedEvent = await tentacle.updateCalendarEvent(event.id, { location: 'Updated Location' });
    assert(updatedEvent, 'Event should be updated');
    assert.strictEqual(updatedEvent.location, 'Updated Location', 'Event location should be updated');
    
    // Get all events
    const allEvents = await tentacle.getCalendarEvents();
    assert(Array.isArray(allEvents), 'All events should be an array');
    assert(allEvents.length > 0, 'All events should not be empty');
    
    // Delete event
    const deleteResult = await tentacle.deleteCalendarEvent(event.id);
    assert(deleteResult, 'Event should be deleted');
    
    console.log('✅ Calendar integration test passed');
  }
  
  /**
   * Test contact management integration
   */
  static async testContactManagementIntegration() {
    console.log('Testing contact management integration...');
    
    // Create dependencies
    const dependencies = this._createMockDependencies();
    
    // Create tentacle
    const tentacle = new PersonalAssistantTentacle({}, dependencies);
    
    // Create contact
    const contactData = {
      name: 'Test Contact',
      email: 'test@example.com',
      phone: '123-456-7890',
      company: 'Test Company'
    };
    
    const contact = await tentacle.createContact(contactData);
    assert(contact, 'Contact should be created');
    assert.strictEqual(contact.name, contactData.name, 'Contact name should match');
    
    // Get contact
    const retrievedContact = await tentacle.getContact(contact.id);
    assert(retrievedContact, 'Contact should be retrieved');
    assert.strictEqual(retrievedContact.id, contact.id, 'Contact ID should match');
    
    // Update contact
    const updatedContact = await tentacle.updateContact(contact.id, { company: 'Updated Company' });
    assert(updatedContact, 'Contact should be updated');
    assert.strictEqual(updatedContact.company, 'Updated Company', 'Contact company should be updated');
    
    // Get all contacts
    const allContacts = await tentacle.getAllContacts();
    assert(Array.isArray(allContacts), 'All contacts should be an array');
    assert(allContacts.length > 0, 'All contacts should not be empty');
    
    // Delete contact
    const deleteResult = await tentacle.deleteContact(contact.id);
    assert(deleteResult, 'Contact should be deleted');
    
    console.log('✅ Contact management integration test passed');
  }
  
  /**
   * Test communication integration
   */
  static async testCommunicationIntegration() {
    console.log('Testing communication integration...');
    
    // Create dependencies
    const dependencies = this._createMockDependencies();
    
    // Create tentacle
    const tentacle = new PersonalAssistantTentacle({}, dependencies);
    
    // Create message
    const messageData = {
      recipient: 'test@example.com',
      subject: 'Test Message',
      content: 'This is a test message',
      type: 'email'
    };
    
    const message = await tentacle.sendMessage(messageData);
    assert(message, 'Message should be sent');
    assert.strictEqual(message.subject, messageData.subject, 'Message subject should match');
    
    // Get message
    const retrievedMessage = await tentacle.getMessage(message.id);
    assert(retrievedMessage, 'Message should be retrieved');
    assert.strictEqual(retrievedMessage.id, message.id, 'Message ID should match');
    
    // Get messages
    const messages = await tentacle.getMessages();
    assert(Array.isArray(messages), 'Messages should be an array');
    assert(messages.length > 0, 'Messages should not be empty');
    
    // Generate message draft
    const draftContext = {
      recipient: 'test@example.com',
      purpose: 'follow_up',
      previousMessageId: message.id
    };
    
    const draft = await tentacle.generateMessageDraft(draftContext);
    assert(draft, 'Draft should be generated');
    assert(draft.content, 'Draft should have content');
    assert(draft.subject, 'Draft should have subject');
    
    console.log('✅ Communication integration test passed');
  }
  
  /**
   * Test information organization integration
   */
  static async testInformationOrganizationIntegration() {
    console.log('Testing information organization integration...');
    
    // Create dependencies
    const dependencies = this._createMockDependencies();
    
    // Create tentacle
    const tentacle = new PersonalAssistantTentacle({}, dependencies);
    
    // Store information
    const informationData = {
      title: 'Test Information',
      content: 'This is test information content',
      type: 'note',
      tags: ['test', 'integration']
    };
    
    const information = await tentacle.storeInformation(informationData);
    assert(information, 'Information should be stored');
    assert.strictEqual(information.title, informationData.title, 'Information title should match');
    
    // Get information
    const retrievedInformation = await tentacle.getInformation(information.id);
    assert(retrievedInformation, 'Information should be retrieved');
    assert.strictEqual(retrievedInformation.id, information.id, 'Information ID should match');
    
    // Search information
    const searchResults = await tentacle.searchInformation({ query: 'test' });
    assert(Array.isArray(searchResults), 'Search results should be an array');
    assert(searchResults.length > 0, 'Search results should not be empty');
    
    // Organize information
    const organizationData = {
      category: 'Test Category',
      tags: ['organized', 'categorized']
    };
    
    const organizationResult = await tentacle.organizeInformation([information.id], organizationData);
    assert(organizationResult, 'Organization result should be returned');
    assert(organizationResult.success, 'Organization should be successful');
    
    console.log('✅ Information organization integration test passed');
  }
  
  /**
   * Test lifestyle management integration
   */
  static async testLifestyleManagementIntegration() {
    console.log('Testing lifestyle management integration...');
    
    // Create dependencies
    const dependencies = this._createMockDependencies();
    
    // Create tentacle
    const tentacle = new PersonalAssistantTentacle({}, dependencies);
    
    // Create lifestyle goal
    const goalData = {
      title: 'Test Goal',
      description: 'This is a test goal',
      category: 'health',
      targetDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days from now
    };
    
    const goal = await tentacle.createLifestyleGoal(goalData);
    assert(goal, 'Goal should be created');
    assert.strictEqual(goal.title, goalData.title, 'Goal title should match');
    
    // Get goal
    const retrievedGoal = await tentacle.getLifestyleGoal(goal.id);
    assert(retrievedGoal, 'Goal should be retrieved');
    assert.strictEqual(retrievedGoal.id, goal.id, 'Goal ID should match');
    
    // Update goal
    const updatedGoal = await tentacle.updateLifestyleGoal(goal.id, { progress: 0.5 });
    assert(updatedGoal, 'Goal should be updated');
    assert.strictEqual(updatedGoal.progress, 0.5, 'Goal progress should be updated');
    
    // Track metric
    const metricData = {
      type: 'exercise',
      value: 30,
      unit: 'minutes',
      timestamp: new Date()
    };
    
    const metric = await tentacle.trackLifestyleMetric(metricData);
    assert(metric, 'Metric should be tracked');
    assert.strictEqual(metric.type, metricData.type, 'Metric type should match');
    
    // Get insights
    const insights = await tentacle.getLifestyleInsights({ category: 'health' });
    assert(Array.isArray(insights), 'Insights should be an array');
    assert(insights.length > 0, 'Insights should not be empty');
    
    console.log('✅ Lifestyle management integration test passed');
  }
  
  /**
   * Test personal branding integration
   */
  static async testPersonalBrandingIntegration() {
    console.log('Testing personal branding integration...');
    
    // Create dependencies
    const dependencies = this._createMockDependencies();
    
    // Create tentacle
    const tentacle = new PersonalAssistantTentacle({}, dependencies);
    
    // Create branding strategy
    const strategyData = {
      targetAudience: ['professionals', 'industry leaders'],
      keyValues: ['innovation', 'expertise', 'reliability'],
      brandVoice: 'professional yet approachable',
      platforms: ['linkedin', 'twitter', 'medium']
    };
    
    const strategy = await tentacle.createBrandingStrategy(strategyData);
    assert(strategy, 'Strategy should be created');
    assert.deepStrictEqual(strategy.targetAudience, strategyData.targetAudience, 'Strategy target audience should match');
    
    // Get strategy
    const retrievedStrategy = await tentacle.getBrandingStrategy();
    assert(retrievedStrategy, 'Strategy should be retrieved');
    assert.strictEqual(retrievedStrategy.id, strategy.id, 'Strategy ID should match');
    
    // Update strategy
    const updatedStrategy = await tentacle.updateBrandingStrategy({ brandVoice: 'authoritative and insightful' });
    assert(updatedStrategy, 'Strategy should be updated');
    assert.strictEqual(updatedStrategy.brandVoice, 'authoritative and insightful', 'Strategy brand voice should be updated');
    
    // Analyze brand presence
    const presenceAnalysis = await tentacle.analyzeBrandPresence();
    assert(presenceAnalysis, 'Presence analysis should be returned');
    assert(presenceAnalysis.platforms, 'Presence analysis should include platforms');
    
    // Generate branding content
    const contentRequest = {
      type: 'bio',
      platform: 'linkedin',
      tone: 'professional'
    };
    
    const content = await tentacle.generateBrandingContent(contentRequest);
    assert(content, 'Content should be generated');
    assert(content.content, 'Content should have content property');
    
    console.log('✅ Personal branding integration test passed');
  }
  
  /**
   * Test social media management integration
   */
  static async testSocialMediaManagementIntegration() {
    console.log('Testing social media management integration...');
    
    // Create dependencies
    const dependencies = this._createMockDependencies();
    
    // Create tentacle
    const tentacle = new PersonalAssistantTentacle({}, dependencies);
    
    // Create social media content
    const contentData = {
      platform: 'twitter',
      content: 'This is a test social media post #testing',
      contentType: 'text',
      tags: ['test', 'integration']
    };
    
    const content = await tentacle.createSocialMediaContent(contentData);
    assert(content, 'Content should be created');
    assert.strictEqual(content.platform, contentData.platform, 'Content platform should match');
    
    // Schedule content
    const scheduleData = {
      publishTime: new Date(Date.now() + 24 * 60 * 60 * 1000), // Tomorrow
      timezone: 'UTC'
    };
    
    const scheduledContent = await tentacle.scheduleSocialMediaContent(content.id, scheduleData);
    assert(scheduledContent, 'Content should be scheduled');
    assert(scheduledContent.scheduledTime, 'Content should have scheduled time');
    
    // Get content
    const retrievedContent = await tentacle.getSocialMediaContent(content.id);
    assert(retrievedContent, 'Content should be retrieved');
    assert.strictEqual(retrievedContent.id, content.id, 'Content ID should match');
    
    // Get all content
    const allContent = await tentacle.getAllSocialMediaContent();
    assert(Array.isArray(allContent), 'All content should be an array');
    assert(allContent.length > 0, 'All content should not be empty');
    
    // Analyze performance
    const performanceAnalysis = await tentacle.analyzeSocialMediaPerformance();
    assert(performanceAnalysis, 'Performance analysis should be returned');
    assert(performanceAnalysis.platforms, 'Performance analysis should include platforms');
    
    // Generate content ideas
    const contentIdeas = await tentacle.generateSocialMediaContentIdeas({
      platform: 'twitter',
      topics: ['technology', 'ai']
    });
    
    assert(Array.isArray(contentIdeas), 'Content ideas should be an array');
    assert(contentIdeas.length > 0, 'Content ideas should not be empty');
    
    console.log('✅ Social media management integration test passed');
  }
  
  /**
   * Test proactive intelligence integration
   */
  static async testProactiveIntelligenceIntegration() {
    console.log('Testing proactive intelligence integration...');
    
    // Create dependencies
    const dependencies = this._createMockDependencies();
    
    // Create tentacle
    const tentacle = new PersonalAssistantTentacle({}, dependencies);
    
    // Update environmental data
    const environmentalData = {
      type: 'location',
      data: {
        latitude: 37.7749,
        longitude: -122.4194,
        city: 'San Francisco',
        country: 'USA'
      }
    };
    
    const updatedData = await tentacle.updateEnvironmentalData(environmentalData);
    assert(updatedData, 'Environmental data should be updated');
    assert.strictEqual(updatedData.type, environmentalData.type, 'Environmental data type should match');
    
    // Get recommendations
    const recommendations = await tentacle.getProactiveRecommendations();
    assert(Array.isArray(recommendations), 'Recommendations should be an array');
    
    // If there are recommendations, test updating status
    if (recommendations.length > 0) {
      const recommendation = recommendations[0];
      const updatedRecommendation = await tentacle.updateRecommendationStatus(recommendation.id, 'accepted', { feedback: 'Useful recommendation' });
      assert(updatedRecommendation, 'Recommendation should be updated');
      assert.strictEqual(updatedRecommendation.status, 'accepted', 'Recommendation status should be updated');
    }
    
    // Get user patterns
    const patterns = await tentacle.getUserPatterns();
    assert(Array.isArray(patterns), 'Patterns should be an array');
    
    // Get contextual awareness
    const contexts = await tentacle.getContextualAwareness();
    assert(Array.isArray(contexts), 'Contexts should be an array');
    
    // Predict intent
    const actionContext = {
      type: 'task_creation',
      data: {
        title: 'Meeting preparation',
        context: 'work'
      }
    };
    
    const intent = await tentacle.predictIntent(actionContext);
    assert(intent, 'Intent should be predicted');
    assert(intent.type, 'Intent should have type');
    assert(intent.confidence, 'Intent should have confidence');
    
    console.log('✅ Proactive intelligence integration test passed');
  }
  
  /**
   * Test offline capability
   */
  static async testOfflineCapability() {
    console.log('Testing offline capability...');
    
    // Create dependencies with offline configuration
    const dependencies = this._createMockDependencies();
    dependencies.webTentacle = null; // Simulate offline by removing web tentacle
    
    // Create tentacle with offline capability
    const tentacle = new PersonalAssistantTentacle({
      offlineCapability: 'full'
    }, dependencies);
    
    // Test core functionality still works offline
    const taskData = {
      title: 'Offline Task',
      description: 'This task should work offline',
      priority: 'high'
    };
    
    const task = await tentacle.createTask(taskData);
    assert(task, 'Task should be created offline');
    assert.strictEqual(task.title, taskData.title, 'Task title should match');
    
    // Test personal branding with offline models
    const contentRequest = {
      type: 'bio',
      platform: 'linkedin',
      tone: 'professional',
      offlineMode: true
    };
    
    const content = await tentacle.generateBrandingContent(contentRequest);
    assert(content, 'Content should be generated offline');
    assert(content.content, 'Content should have content property');
    assert(content.generatedOffline, 'Content should be marked as generated offline');
    
    console.log('✅ Offline capability test passed');
  }
  
  /**
   * Test event propagation
   */
  static async testEventPropagation() {
    console.log('Testing event propagation...');
    
    // Create dependencies
    const dependencies = this._createMockDependencies();
    
    // Create tentacle
    const tentacle = new PersonalAssistantTentacle({}, dependencies);
    
    // Set up event listeners
    let taskCreatedFired = false;
    let calendarEventCreatedFired = false;
    let proactiveRecommendationFired = false;
    
    tentacle.on('taskCreated', (task) => {
      taskCreatedFired = true;
      assert(task, 'Task should be provided in event');
      assert(task.id, 'Task should have ID');
    });
    
    tentacle.on('calendarEventCreated', (event) => {
      calendarEventCreatedFired = true;
      assert(event, 'Event should be provided in event');
      assert(event.id, 'Event should have ID');
    });
    
    tentacle.on('proactiveRecommendation', (recommendation) => {
      proactiveRecommendationFired = true;
      assert(recommendation, 'Recommendation should be provided in event');
      assert(recommendation.id, 'Recommendation should have ID');
    });
    
    // Create task to trigger event
    const task = await tentacle.createTask({
      title: 'Event Test Task',
      priority: 'high'
    });
    
    // Create calendar event to trigger event
    const calendarEvent = await tentacle.createCalendarEvent({
      title: 'Event Test Calendar Event',
      startTime: new Date(Date.now() + 24 * 60 * 60 * 1000)
    });
    
    // Wait for events to propagate
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Verify events fired
    assert(taskCreatedFired, 'Task created event should fire');
    assert(calendarEventCreatedFired, 'Calendar event created event should fire');
    
    // Note: proactiveRecommendation may not fire immediately as it depends on analysis
    // This is acceptable for the test
    
    console.log('✅ Event propagation test passed');
  }
  
  /**
   * Create mock dependencies for testing
   * @returns {Object} Mock dependencies
   * @private
   */
  static _createMockDependencies() {
    const logger = new MockLogger();
    const memoryTentacle = new MockMemoryTentacle();
    const securityFramework = new MockSecurityFramework();
    const modelIntegrationManager = new MockModelIntegrationManager();
    const webTentacle = new MockWebTentacle();
    const fileSystemTentacle = new MockFileSystemTentacle();
    
    return {
      logger,
      memoryTentacle,
      securityFramework,
      modelIntegrationManager,
      webTentacle,
      fileSystemTentacle
    };
  }
}

// Run tests if this file is executed directly
if (require.main === module) {
  PersonalAssistantTentacleIntegrationTest.runTests()
    .then(() => {
      process.exit(0);
    })
    .catch((error) => {
      console.error('Tests failed:', error);
      process.exit(1);
    });
}

module.exports = PersonalAssistantTentacleIntegrationTest;
