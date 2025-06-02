/**
 * @fileoverview Test data generator for ML model testing
 * 
 * @module core/ml/testing/TestDataGenerator
 * @requires core/utils/Logger
 */

const fs = require('fs');
const path = require('path');
const logger = require('../../utils/Logger').getLogger('TestDataGenerator');

/**
 * Generates test data for ML model testing
 * @param {string} outputDir - Directory to save test data
 * @returns {Promise<boolean>} Success status
 */
async function generateTestData(outputDir) {
  try {
    logger.info(`Generating test data in ${outputDir}`);
    
    // Ensure output directory exists
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    
    // Generate text generation test data
    await generateTextGenerationData(outputDir);
    
    // Generate reasoning test data
    await generateReasoningData(outputDir);
    
    // Generate code generation test data
    await generateCodeGenerationData(outputDir);
    
    // Generate classification test data
    await generateClassificationData(outputDir);
    
    logger.info('Test data generation completed successfully');
    return true;
  } catch (error) {
    logger.error(`Failed to generate test data: ${error.message}`, error);
    return false;
  }
}

/**
 * Generates text generation test data
 * @param {string} outputDir - Directory to save test data
 * @returns {Promise<boolean>} Success status
 */
async function generateTextGenerationData(outputDir) {
  try {
    logger.debug('Generating text generation test data');
    
    const testData = {
      name: 'text_generation',
      description: 'Test data for text generation tasks',
      tests: [
        {
          id: 'simple_question_1',
          prompt: 'What is the capital of France?',
          expected_contains: ['Paris'],
          max_tokens: 50
        },
        {
          id: 'simple_question_2',
          prompt: 'Who wrote Romeo and Juliet?',
          expected_contains: ['Shakespeare', 'William Shakespeare'],
          max_tokens: 50
        },
        {
          id: 'open_ended_1',
          prompt: 'Explain the concept of artificial intelligence in simple terms.',
          expected_contains: ['intelligence', 'computer', 'human', 'learn'],
          max_tokens: 200
        },
        {
          id: 'open_ended_2',
          prompt: 'Describe the process of photosynthesis.',
          expected_contains: ['plants', 'light', 'energy', 'carbon dioxide', 'oxygen'],
          max_tokens: 200
        },
        {
          id: 'creative_1',
          prompt: 'Write a short poem about the ocean.',
          expected_contains: ['ocean', 'sea', 'wave', 'water'],
          max_tokens: 150
        }
      ]
    };
    
    // Save test data
    const filePath = path.join(outputDir, 'text_generation_tests.json');
    fs.writeFileSync(filePath, JSON.stringify(testData, null, 2));
    
    logger.debug(`Text generation test data saved to ${filePath}`);
    return true;
  } catch (error) {
    logger.error(`Failed to generate text generation test data: ${error.message}`, error);
    return false;
  }
}

/**
 * Generates reasoning test data
 * @param {string} outputDir - Directory to save test data
 * @returns {Promise<boolean>} Success status
 */
async function generateReasoningData(outputDir) {
  try {
    logger.debug('Generating reasoning test data');
    
    const testData = {
      name: 'reasoning',
      description: 'Test data for reasoning tasks',
      tests: [
        {
          id: 'math_problem_1',
          prompt: 'If a train travels at 60 mph for 3 hours, how far does it go?',
          expected_contains: ['180', 'miles'],
          max_tokens: 100
        },
        {
          id: 'math_problem_2',
          prompt: 'If x + y = 10 and x - y = 4, what are the values of x and y?',
          expected_contains: ['x = 7', 'y = 3'],
          max_tokens: 150
        },
        {
          id: 'logic_problem_1',
          prompt: 'All men are mortal. Socrates is a man. What can you conclude?',
          expected_contains: ['Socrates is mortal'],
          max_tokens: 100
        },
        {
          id: 'logic_problem_2',
          prompt: 'If it is raining, then the ground is wet. The ground is wet. Can you conclude that it is raining?',
          expected_contains: ['No', 'not necessarily', 'other causes'],
          max_tokens: 150
        },
        {
          id: 'complex_reasoning',
          prompt: 'A bat and a ball cost $1.10 in total. The bat costs $1.00 more than the ball. How much does the ball cost?',
          expected_contains: ['$0.05', '5 cents'],
          max_tokens: 200
        }
      ]
    };
    
    // Save test data
    const filePath = path.join(outputDir, 'reasoning_tests.json');
    fs.writeFileSync(filePath, JSON.stringify(testData, null, 2));
    
    logger.debug(`Reasoning test data saved to ${filePath}`);
    return true;
  } catch (error) {
    logger.error(`Failed to generate reasoning test data: ${error.message}`, error);
    return false;
  }
}

/**
 * Generates code generation test data
 * @param {string} outputDir - Directory to save test data
 * @returns {Promise<boolean>} Success status
 */
async function generateCodeGenerationData(outputDir) {
  try {
    logger.debug('Generating code generation test data');
    
    const testData = {
      name: 'code_generation',
      description: 'Test data for code generation tasks',
      tests: [
        {
          id: 'javascript_function_1',
          prompt: 'Write a JavaScript function to calculate the factorial of a number.',
          expected_contains: ['function', 'factorial', 'return'],
          max_tokens: 200
        },
        {
          id: 'javascript_function_2',
          prompt: 'Write a JavaScript function to check if a string is a palindrome.',
          expected_contains: ['function', 'palindrome', 'return'],
          max_tokens: 200
        },
        {
          id: 'python_function_1',
          prompt: 'Write a Python function to find the maximum element in a list.',
          expected_contains: ['def', 'max', 'return'],
          max_tokens: 150
        },
        {
          id: 'python_function_2',
          prompt: 'Write a Python function to count the frequency of words in a string.',
          expected_contains: ['def', 'count', 'return'],
          max_tokens: 200
        },
        {
          id: 'algorithm_implementation',
          prompt: 'Implement a binary search algorithm in the programming language of your choice.',
          expected_contains: ['binary', 'search', 'function', 'return'],
          max_tokens: 300
        }
      ]
    };
    
    // Save test data
    const filePath = path.join(outputDir, 'code_generation_tests.json');
    fs.writeFileSync(filePath, JSON.stringify(testData, null, 2));
    
    logger.debug(`Code generation test data saved to ${filePath}`);
    return true;
  } catch (error) {
    logger.error(`Failed to generate code generation test data: ${error.message}`, error);
    return false;
  }
}

/**
 * Generates classification test data
 * @param {string} outputDir - Directory to save test data
 * @returns {Promise<boolean>} Success status
 */
async function generateClassificationData(outputDir) {
  try {
    logger.debug('Generating classification test data');
    
    const testData = {
      name: 'classification',
      description: 'Test data for classification tasks',
      tests: [
        {
          id: 'sentiment_1',
          prompt: 'Classify the sentiment of this text: "I love this product, it works great!"',
          expected_contains: ['positive', 'Positive'],
          max_tokens: 50
        },
        {
          id: 'sentiment_2',
          prompt: 'Classify the sentiment of this text: "This is the worst experience I have ever had."',
          expected_contains: ['negative', 'Negative'],
          max_tokens: 50
        },
        {
          id: 'sentiment_3',
          prompt: 'Classify the sentiment of this text: "The product is okay, but could be better."',
          expected_contains: ['neutral', 'Neutral', 'mixed', 'Mixed'],
          max_tokens: 50
        },
        {
          id: 'topic_1',
          prompt: 'Classify the topic of this text: "The new vaccine has shown promising results in clinical trials."',
          expected_contains: ['medical', 'health', 'science'],
          max_tokens: 50
        },
        {
          id: 'topic_2',
          prompt: 'Classify the topic of this text: "The stock market reached a new high today as investors reacted to positive economic data."',
          expected_contains: ['finance', 'economy', 'business'],
          max_tokens: 50
        }
      ]
    };
    
    // Save test data
    const filePath = path.join(outputDir, 'classification_tests.json');
    fs.writeFileSync(filePath, JSON.stringify(testData, null, 2));
    
    logger.debug(`Classification test data saved to ${filePath}`);
    return true;
  } catch (error) {
    logger.error(`Failed to generate classification test data: ${error.message}`, error);
    return false;
  }
}

// Export functions
module.exports = {
  generateTestData
};

// Run generator if this file is executed directly
if (require.main === module) {
  const outputDir = process.argv[2] || path.join(process.cwd(), 'test', 'data');
  
  generateTestData(outputDir)
    .then(success => {
      if (success) {
        console.log(`Test data generated successfully in ${outputDir}`);
        process.exit(0);
      } else {
        console.error('Failed to generate test data');
        process.exit(1);
      }
    })
    .catch(error => {
      console.error('Error generating test data:', error);
      process.exit(1);
    });
}
