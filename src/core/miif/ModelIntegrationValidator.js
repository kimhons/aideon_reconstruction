/**
 * @fileoverview Test suite for validating the model integration.
 * This module provides comprehensive tests for the Core tier models.
 */

const ModelManager = require('../ModelManager');
const Phi3MiniModel = require('../Phi3MiniModel');
const BertBaseModel = require('../BertBaseModel');
const Gemma2BModel = require('../Gemma2BModel');

/**
 * Validates the Core tier model integration.
 */
async function validateModelIntegration() {
  console.log('=== AIDEON MODEL INTEGRATION VALIDATION ===');
  console.log('Testing Core tier models...\n');
  
  // Test results tracking
  const results = {
    total: 0,
    passed: 0,
    failed: 0,
    details: {}
  };
  
  // Test individual models
  await testPhi3Mini(results);
  await testBertBase(results);
  await testGemma2B(results);
  
  // Test model manager
  await testModelManager(results);
  
  // Print summary
  console.log('\n=== MODEL INTEGRATION VALIDATION SUMMARY ===');
  console.log(`Total Tests: ${results.total}`);
  console.log(`Passed: ${results.passed} (${((results.passed / results.total) * 100).toFixed(2)}%)`);
  console.log(`Failed: ${results.failed}`);
  
  // Print details by model
  for (const model in results.details) {
    console.log(`\n${model}:`);
    console.log(`  Passed: ${results.details[model].passed}/${results.details[model].total} (${((results.details[model].passed / results.details[model].total) * 100).toFixed(2)}%)`);
    console.log(`  Failed: ${results.details[model].failed}`);
  }
  
  // Calculate confidence level
  const confidenceLevel = (results.passed / results.total) * 100;
  console.log(`\nConfidence Level: ${confidenceLevel >= 95 ? 'SUFFICIENT' : 'INSUFFICIENT'} (${confidenceLevel.toFixed(2)}% >= 95% required)`);
  
  console.log('\nValidation complete!');
  
  return {
    success: confidenceLevel >= 95,
    confidenceLevel,
    results
  };
}

/**
 * Tests the Phi-3 mini model.
 * @param {Object} results - Results tracking object.
 */
async function testPhi3Mini(results) {
  console.log('Testing Phi-3 mini model...');
  
  // Initialize results tracking for this model
  results.details['Phi-3 mini'] = {
    total: 0,
    passed: 0,
    failed: 0
  };
  
  try {
    // Initialize model
    const model = new Phi3MiniModel();
    const initSuccess = await model.initialize();
    
    // Test initialization
    logTestResult(results, 'Phi-3 mini', 'initialization', initSuccess);
    
    if (initSuccess) {
      // Test text generation
      try {
        const generationPrompt = "What are the key features of an autonomous desktop agent?";
        const generatedText = await model.generate(generationPrompt);
        logTestResult(results, 'Phi-3 mini', 'text generation', 
          generatedText && generatedText.length > 0);
      } catch (error) {
        logTestResult(results, 'Phi-3 mini', 'text generation', false);
        console.error('  Error in text generation test:', error.message);
      }
      
      // Test classification
      try {
        const classificationText = "This desktop agent is incredibly helpful and intuitive.";
        const classes = ["positive", "neutral", "negative"];
        const classification = await model.classify(classificationText, classes);
        logTestResult(results, 'Phi-3 mini', 'classification', 
          classification && classification.label && classification.confidence > 0);
      } catch (error) {
        logTestResult(results, 'Phi-3 mini', 'classification', false);
        console.error('  Error in classification test:', error.message);
      }
      
      // Test information extraction
      try {
        const extractionText = "The Aideon AI Desktop Agent was developed in 2025 by a team of researchers.";
        const question = "When was the Aideon AI Desktop Agent developed?";
        const extraction = await model.extractInformation(extractionText, question);
        logTestResult(results, 'Phi-3 mini', 'information extraction', 
          extraction && extraction.answer && extraction.answer.length > 0);
      } catch (error) {
        logTestResult(results, 'Phi-3 mini', 'information extraction', false);
        console.error('  Error in information extraction test:', error.message);
      }
      
      // Test resource management
      try {
        const resourceReq = model.getResourceRequirements();
        logTestResult(results, 'Phi-3 mini', 'resource management', 
          resourceReq && typeof resourceReq.memory === 'string');
      } catch (error) {
        logTestResult(results, 'Phi-3 mini', 'resource management', false);
        console.error('  Error in resource management test:', error.message);
      }
      
      // Test metrics tracking
      try {
        const metrics = model.getMetrics();
        logTestResult(results, 'Phi-3 mini', 'metrics tracking', 
          metrics && typeof metrics.totalCalls === 'number' && metrics.totalCalls > 0);
      } catch (error) {
        logTestResult(results, 'Phi-3 mini', 'metrics tracking', false);
        console.error('  Error in metrics tracking test:', error.message);
      }
      
      // Test disposal
      try {
        await model.dispose();
        logTestResult(results, 'Phi-3 mini', 'disposal', true);
      } catch (error) {
        logTestResult(results, 'Phi-3 mini', 'disposal', false);
        console.error('  Error in disposal test:', error.message);
      }
    } else {
      console.log('  Skipping further tests due to initialization failure.');
    }
  } catch (error) {
    console.error('  Error testing Phi-3 mini model:', error);
  }
  
  console.log(`  Phi-3 mini tests: ${results.details['Phi-3 mini'].passed}/${results.details['Phi-3 mini'].total} passed`);
}

/**
 * Tests the BERT-base model.
 * @param {Object} results - Results tracking object.
 */
async function testBertBase(results) {
  console.log('\nTesting BERT-base model...');
  
  // Initialize results tracking for this model
  results.details['BERT-base'] = {
    total: 0,
    passed: 0,
    failed: 0
  };
  
  try {
    // Initialize model
    const model = new BertBaseModel();
    const initSuccess = await model.initialize();
    
    // Test initialization
    logTestResult(results, 'BERT-base', 'initialization', initSuccess);
    
    if (initSuccess) {
      // Test classification
      try {
        const classificationText = "This new feature is amazing and works perfectly.";
        const classes = ["positive", "neutral", "negative"];
        const classification = await model.classify(classificationText, classes);
        logTestResult(results, 'BERT-base', 'classification', 
          classification && classification.label && classification.confidence > 0);
      } catch (error) {
        logTestResult(results, 'BERT-base', 'classification', false);
        console.error('  Error in classification test:', error.message);
      }
      
      // Test embedding
      try {
        const embeddingText = "Embedding test for BERT model.";
        const embedding = await model.embed(embeddingText);
        logTestResult(results, 'BERT-base', 'embedding', 
          embedding && Array.isArray(embedding) && embedding.length > 0);
      } catch (error) {
        logTestResult(results, 'BERT-base', 'embedding', false);
        console.error('  Error in embedding test:', error.message);
      }
      
      // Test token classification
      try {
        const nerText = "John Smith works at Microsoft in Seattle.";
        const nerResults = await model.tokenClassify(nerText, 'ner');
        logTestResult(results, 'BERT-base', 'token classification (NER)', 
          nerResults && Array.isArray(nerResults) && nerResults.length > 0);
      } catch (error) {
        logTestResult(results, 'BERT-base', 'token classification (NER)', false);
        console.error('  Error in token classification (NER) test:', error.message);
      }
      
      // Test POS tagging
      try {
        const posText = "The quick brown fox jumps over the lazy dog.";
        const posResults = await model.tokenClassify(posText, 'pos');
        logTestResult(results, 'BERT-base', 'token classification (POS)', 
          posResults && Array.isArray(posResults) && posResults.length > 0);
      } catch (error) {
        logTestResult(results, 'BERT-base', 'token classification (POS)', false);
        console.error('  Error in token classification (POS) test:', error.message);
      }
      
      // Test caching
      try {
        const cacheText = "Testing the caching mechanism.";
        const classes = ["test", "other"];
        
        // First call should cache the result
        await model.classify(cacheText, classes);
        
        // Second call should use cached result (faster)
        const startTime = Date.now();
        await model.classify(cacheText, classes);
        const duration = Date.now() - startTime;
        
        logTestResult(results, 'BERT-base', 'result caching', duration < 100);
      } catch (error) {
        logTestResult(results, 'BERT-base', 'result caching', false);
        console.error('  Error in result caching test:', error.message);
      }
      
      // Test cache clearing
      try {
        model.clearCache();
        logTestResult(results, 'BERT-base', 'cache clearing', true);
      } catch (error) {
        logTestResult(results, 'BERT-base', 'cache clearing', false);
        console.error('  Error in cache clearing test:', error.message);
      }
      
      // Test disposal
      try {
        await model.dispose();
        logTestResult(results, 'BERT-base', 'disposal', true);
      } catch (error) {
        logTestResult(results, 'BERT-base', 'disposal', false);
        console.error('  Error in disposal test:', error.message);
      }
    } else {
      console.log('  Skipping further tests due to initialization failure.');
    }
  } catch (error) {
    console.error('  Error testing BERT-base model:', error);
  }
  
  console.log(`  BERT-base tests: ${results.details['BERT-base'].passed}/${results.details['BERT-base'].total} passed`);
}

/**
 * Tests the Gemma 2B model.
 * @param {Object} results - Results tracking object.
 */
async function testGemma2B(results) {
  console.log('\nTesting Gemma 2B model...');
  
  // Initialize results tracking for this model
  results.details['Gemma 2B'] = {
    total: 0,
    passed: 0,
    failed: 0
  };
  
  try {
    // Initialize model
    const model = new Gemma2BModel();
    const initSuccess = await model.initialize();
    
    // Test initialization
    logTestResult(results, 'Gemma 2B', 'initialization', initSuccess);
    
    if (initSuccess) {
      // Test text generation
      try {
        const generationPrompt = "Explain the concept of autonomous agents in simple terms.";
        const generatedText = await model.generate(generationPrompt);
        logTestResult(results, 'Gemma 2B', 'text generation', 
          generatedText && generatedText.length > 0);
      } catch (error) {
        logTestResult(results, 'Gemma 2B', 'text generation', false);
        console.error('  Error in text generation test:', error.message);
      }
      
      // Test summarization
      try {
        const textToSummarize = "Autonomous agents are software entities that can perform tasks without direct human intervention. They use artificial intelligence to perceive their environment, make decisions, and take actions to achieve specific goals. These agents can range from simple programs that perform specific tasks to complex systems that can learn and adapt over time. In the context of desktop environments, autonomous agents can help users by automating repetitive tasks, organizing information, and providing intelligent assistance for various activities.";
        const summary = await model.summarize(textToSummarize, { style: 'concise' });
        logTestResult(results, 'Gemma 2B', 'summarization (concise)', 
          summary && summary.length > 0 && summary.length < textToSummarize.length);
      } catch (error) {
        logTestResult(results, 'Gemma 2B', 'summarization (concise)', false);
        console.error('  Error in summarization (concise) test:', error.message);
      }
      
      // Test bullet point summarization
      try {
        const textToSummarize = "Autonomous agents are software entities that can perform tasks without direct human intervention. They use artificial intelligence to perceive their environment, make decisions, and take actions to achieve specific goals. These agents can range from simple programs that perform specific tasks to complex systems that can learn and adapt over time. In the context of desktop environments, autonomous agents can help users by automating repetitive tasks, organizing information, and providing intelligent assistance for various activities.";
        const summary = await model.summarize(textToSummarize, { style: 'bullets' });
        logTestResult(results, 'Gemma 2B', 'summarization (bullets)', 
          summary && summary.includes('•'));
      } catch (error) {
        logTestResult(results, 'Gemma 2B', 'summarization (bullets)', false);
        console.error('  Error in summarization (bullets) test:', error.message);
      }
      
      // Test question answering
      try {
        const context = "Aideon is an AI desktop agent designed to be fully autonomous. It can complete complex tasks without supervision and works on Windows, Mac, and Linux platforms.";
        const question = "What platforms does Aideon work on?";
        const answer = await model.answerQuestion(question, context);
        logTestResult(results, 'Gemma 2B', 'question answering', 
          answer && answer.answer && answer.answer.length > 0 && answer.confidence > 0);
      } catch (error) {
        logTestResult(results, 'Gemma 2B', 'question answering', false);
        console.error('  Error in question answering test:', error.message);
      }
      
      // Test system prompt usage
      try {
        // First generate with default system prompt
        const prompt1 = "What is your purpose?";
        const response1 = await model.generate(prompt1);
        
        // Then generate with custom system prompt
        model.systemPrompt = "You are a technical assistant focused on programming help.";
        const prompt2 = "What is your purpose?";
        const response2 = await model.generate(prompt2);
        
        // Responses should be different due to different system prompts
        logTestResult(results, 'Gemma 2B', 'system prompt customization', 
          response1 !== response2);
      } catch (error) {
        logTestResult(results, 'Gemma 2B', 'system prompt customization', false);
        console.error('  Error in system prompt customization test:', error.message);
      }
      
      // Test disposal
      try {
        await model.dispose();
        logTestResult(results, 'Gemma 2B', 'disposal', true);
      } catch (error) {
        logTestResult(results, 'Gemma 2B', 'disposal', false);
        console.error('  Error in disposal test:', error.message);
      }
    } else {
      console.log('  Skipping further tests due to initialization failure.');
    }
  } catch (error) {
    console.error('  Error testing Gemma 2B model:', error);
  }
  
  console.log(`  Gemma 2B tests: ${results.details['Gemma 2B'].passed}/${results.details['Gemma 2B'].total} passed`);
}

/**
 * Tests the Model Manager.
 * @param {Object} results - Results tracking object.
 */
async function testModelManager(results) {
  console.log('\nTesting Model Manager...');
  
  // Initialize results tracking for the manager
  results.details['Model Manager'] = {
    total: 0,
    passed: 0,
    failed: 0
  };
  
  try {
    // Initialize manager
    const manager = new ModelManager({
      tier: 'core',
      preferLocalModels: true
    });
    
    // Test initialization of all core models
    try {
      const initResults = await manager.initializeModels();
      logTestResult(results, 'Model Manager', 'model initiali
(Content truncated due to size limit. Use line ranges to read in chunks)