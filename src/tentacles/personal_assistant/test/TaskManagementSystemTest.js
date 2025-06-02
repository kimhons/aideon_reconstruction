/**
 * @fileoverview Unit tests for the Task Management System component.
 * 
 * @module src/tentacles/personal_assistant/test/TaskManagementSystemTest
 * @requires assert
 */

const assert = require('assert');
const TaskManagementSystem = require('../TaskManagementSystem');
const MockNotificationSystem = require('./MockNotificationSystem');

/**
 * Mock Memory Tentacle for testing
 */
class MockMemoryTentacle {
  constructor() {
    this.entities = new Map();
  }
  
  async storeEntity(entityData) {
    this.entities.set(`${entityData.type}:${entityData.id}`, entityData);
    return entityData;
  }
  
  async getEntity(query) {
    return this.entities.get(`${query.type}:${query.id}`);
  }
  
  async updateEntity(entityData) {
    this.entities.set(`${entityData.type}:${entityData.id}`, entityData);
    return entityData;
  }
  
  async deleteEntity(query) {
    this.entities.delete(`${query.type}:${query.id}`);
    return true;
  }
}

/**
 * Mock File System Tentacle for testing
 */
class MockFileSystemTentacle {
  constructor() {
    this.files = new Map();
  }
  
  async writeFile(options) {
    this.files.set(options.path, options.content);
    return options.path;
  }
  
  async readFile(options) {
    return this.files.get(options.path);
  }
}

/**
 * Task Management System test suite
 */
class TaskManagementSystemTest {
  /**
   * Run all tests
   */
  static runTests() {
    console.log('=== Task Management System Test Suite ===');
    
    // Get all test methods
    const testMethods = Object.getOwnPropertyNames(TaskManagementSystemTest)
      .filter(name => name.startsWith('test') && typeof TaskManagementSystemTest[name] === 'function');
    
    console.log(`Found ${testMethods.length} tests to run.`);
    
    // Run each test
    let passed = 0;
    let failed = 0;
    
    for (const method of testMethods) {
      try {
        console.log(`Running test: ${method}`);
        TaskManagementSystemTest[method]();
        console.log(`✓ Test passed: ${method}`);
        passed++;
      } catch (error) {
        console.error(`✗ Test failed: ${method}`);
        console.error(`  Error: ${error.message}`);
        if (error.stack) {
          console.error(`  Stack: ${error.stack.split('\n').slice(1).join('\n')}`);
        }
        failed++;
      }
    }
    
    // Print summary
    console.log('=== Test Summary ===');
    console.log(`Total tests: ${testMethods.length}`);
    console.log(`Passed: ${passed}`);
    console.log(`Failed: ${failed}`);
    console.log('=== Task Management System Tests Complete ===');
    
    return failed === 0;
  }
  
  /**
   * Test system initialization
   */
  static testInitialization() {
    const system = new TaskManagementSystem();
    
    assert.strictEqual(typeof system, 'object', 'System should be an object');
    assert.strictEqual(system.tasks.size, 0, 'Tasks should be empty initially');
    assert.strictEqual(system.taskLists.size, 0, 'Task lists should be empty initially');
    assert.strictEqual(system.tags.size, 0, 'Tags should be empty initially');
    
    const status = system.getStatus();
    assert.strictEqual(status.taskCount, 0, 'Task count should be 0');
    assert.strictEqual(status.taskListCount, 0, 'Task list count should be 0');
  }
  
  /**
   * Test task creation
   */
  static async testCreateTask() {
    const system = new TaskManagementSystem();
    
    const taskData = {
      title: 'Test Task',
      description: 'This is a test task',
      priority: 2,
      tags: ['test', 'important']
    };
    
    const task = await system.createTask(taskData);
    
    assert.strictEqual(typeof task, 'object', 'Task should be an object');
    assert.strictEqual(task.title, taskData.title, 'Task title should match');
    assert.strictEqual(task.description, taskData.description, 'Task description should match');
    assert.strictEqual(task.priority, taskData.priority, 'Task priority should match');
    assert.deepStrictEqual(task.tags, taskData.tags, 'Task tags should match');
    assert.strictEqual(task.status, 'not_started', 'Task status should be not_started');
    assert.strictEqual(task.progress, 0, 'Task progress should be 0');
    
    assert.strictEqual(system.tasks.size, 1, 'System should have 1 task');
    assert.strictEqual(system.tags.size, 2, 'System should have 2 tags');
    
    // Test task ID generation
    assert.ok(task.id, 'Task should have an ID');
    assert.ok(task.id.startsWith('task_'), 'Task ID should start with "task_"');
    
    // Test created timestamp
    assert.ok(task.created instanceof Date, 'Created timestamp should be a Date');
  }
  
  /**
   * Test task retrieval
   */
  static async testGetTask() {
    const system = new TaskManagementSystem();
    
    const taskData = {
      title: 'Test Task',
      description: 'This is a test task'
    };
    
    const createdTask = await system.createTask(taskData);
    const retrievedTask = await system.getTask(createdTask.id);
    
    assert.deepStrictEqual(retrievedTask, createdTask, 'Retrieved task should match created task');
    
    // Test non-existent task
    try {
      await system.getTask('non_existent_id');
      assert.fail('Should throw error for non-existent task');
    } catch (error) {
      assert.ok(error.message.includes('not found'), 'Error should indicate task not found');
    }
  }
  
  /**
   * Test task update
   */
  static async testUpdateTask() {
    const system = new TaskManagementSystem();
    
    const taskData = {
      title: 'Original Title',
      description: 'Original description',
      priority: 3
    };
    
    const task = await system.createTask(taskData);
    
    const updates = {
      title: 'Updated Title',
      description: 'Updated description',
      priority: 1,
      tags: ['new', 'tags']
    };
    
    const updatedTask = await system.updateTask(task.id, updates);
    
    assert.strictEqual(updatedTask.title, updates.title, 'Title should be updated');
    assert.strictEqual(updatedTask.description, updates.description, 'Description should be updated');
    assert.strictEqual(updatedTask.priority, updates.priority, 'Priority should be updated');
    assert.deepStrictEqual(updatedTask.tags, updates.tags, 'Tags should be updated');
    
    // Verify task in system is updated
    const retrievedTask = await system.getTask(task.id);
    assert.deepStrictEqual(retrievedTask, updatedTask, 'Retrieved task should match updated task');
    
    // Test updating status to completed
    const completionUpdate = {
      status: 'completed'
    };
    
    const completedTask = await system.updateTask(task.id, completionUpdate);
    
    assert.strictEqual(completedTask.status, 'completed', 'Status should be updated to completed');
    assert.ok(completedTask.completed instanceof Date, 'Completed timestamp should be set');
    
    // Test non-existent task
    try {
      await system.updateTask('non_existent_id', updates);
      assert.fail('Should throw error for non-existent task');
    } catch (error) {
      assert.ok(error.message.includes('not found'), 'Error should indicate task not found');
    }
  }
  
  /**
   * Test task deletion
   */
  static async testDeleteTask() {
    const system = new TaskManagementSystem();
    
    const taskData = {
      title: 'Task to Delete'
    };
    
    const task = await system.createTask(taskData);
    assert.strictEqual(system.tasks.size, 1, 'System should have 1 task');
    
    const result = await system.deleteTask(task.id);
    assert.strictEqual(result, true, 'Delete should return true');
    assert.strictEqual(system.tasks.size, 0, 'System should have 0 tasks');
    
    // Test deleting non-existent task
    try {
      await system.deleteTask('non_existent_id');
      assert.fail('Should throw error for non-existent task');
    } catch (error) {
      assert.ok(error.message.includes('not found'), 'Error should indicate task not found');
    }
  }
  
  /**
   * Test task search
   */
  static async testSearchTasks() {
    const system = new TaskManagementSystem();
    
    // Create test tasks
    await system.createTask({
      title: 'Work Task',
      description: 'Important work task',
      priority: 1,
      tags: ['work', 'important'],
      status: 'in_progress',
      due: new Date(Date.now() + 86400000) // Tomorrow
    });
    
    await system.createTask({
      title: 'Personal Task',
      description: 'Low priority personal task',
      priority: 4,
      tags: ['personal', 'low_priority'],
      status: 'not_started',
      due: new Date(Date.now() + 172800000) // Day after tomorrow
    });
    
    await system.createTask({
      title: 'Completed Work Task',
      description: 'Already completed work task',
      priority: 2,
      tags: ['work', 'completed'],
      status: 'completed',
      due: new Date(Date.now() - 86400000), // Yesterday
      completed: new Date()
    });
    
    // Test search by query
    let results = await system.searchTasks({ query: 'work' });
    assert.strictEqual(results.length, 2, 'Should find 2 tasks with "work" in title or description');
    
    // Test search by status
    results = await system.searchTasks({ status: 'completed' });
    assert.strictEqual(results.length, 1, 'Should find 1 completed task');
    assert.strictEqual(results[0].title, 'Completed Work Task', 'Should find the completed task');
    
    // Test search by tags
    results = await system.searchTasks({ tags: ['work'] });
    assert.strictEqual(results.length, 2, 'Should find 2 tasks with "work" tag');
    
    // Test search by due date
    results = await system.searchTasks({ dueBefore: new Date(Date.now() + 100000000) });
    assert.strictEqual(results.length, 2, 'Should find 2 tasks due before the specified date');
    
    // Test search with multiple criteria
    results = await system.searchTasks({
      tags: ['work'],
      status: 'in_progress'
    });
    assert.strictEqual(results.length, 1, 'Should find 1 in-progress work task');
    assert.strictEqual(results[0].title, 'Work Task', 'Should find the in-progress work task');
    
    // Test pagination
    await system.createTask({ title: 'Extra Task 1' });
    await system.createTask({ title: 'Extra Task 2' });
    
    results = await system.searchTasks({ limit: 2, offset: 0 });
    assert.strictEqual(results.length, 2, 'Should return 2 tasks with limit=2');
    
    results = await system.searchTasks({ limit: 2, offset: 2 });
    assert.strictEqual(results.length, 2, 'Should return 2 tasks with limit=2, offset=2');
    
    results = await system.searchTasks({ limit: 2, offset: 4 });
    assert.strictEqual(results.length, 1, 'Should return 1 task with limit=2, offset=4');
  }
  
  /**
   * Test task list creation and management
   */
  static async testTaskLists() {
    const system = new TaskManagementSystem();
    
    // Create a task list
    const listData = {
      name: 'Test List',
      description: 'A test task list'
    };
    
    const taskList = await system.createTaskList(listData);
    
    assert.strictEqual(typeof taskList, 'object', 'Task list should be an object');
    assert.strictEqual(taskList.name, listData.name, 'List name should match');
    assert.strictEqual(taskList.description, listData.description, 'List description should match');
    assert.strictEqual(taskList.taskIds.length, 0, 'List should have 0 tasks initially');
    
    // Create tasks
    const task1 = await system.createTask({ title: 'Task 1' });
    const task2 = await system.createTask({ title: 'Task 2' });
    
    // Add tasks to list
    await system.addTaskToList(taskList.id, task1.id);
    await system.addTaskToList(taskList.id, task2.id);
    
    // Get tasks in list
    const tasksInList = await system.getTasksInList(taskList.id);
    
    assert.strictEqual(tasksInList.length, 2, 'List should have 2 tasks');
    assert.strictEqual(tasksInList[0].id, task1.id, 'First task ID should match');
    assert.strictEqual(tasksInList[1].id, task2.id, 'Second task ID should match');
    
    // Test adding duplicate task (should be idempotent)
    const updatedList = await system.addTaskToList(taskList.id, task1.id);
    assert.strictEqual(updatedList.taskIds.length, 2, 'List should still have 2 tasks after adding duplicate');
    
    // Test adding to non-existent list
    try {
      await system.addTaskToList('non_existent_id', task1.id);
      assert.fail('Should throw error for non-existent list');
    } catch (error) {
      assert.ok(error.message.includes('not found'), 'Error should indicate list not found');
    }
    
    // Test adding non-existent task
    try {
      await system.addTaskToList(taskList.id, 'non_existent_id');
      assert.fail('Should throw error for non-existent task');
    } catch (error) {
      assert.ok(error.message.includes('not found'), 'Error should indicate task not found');
    }
  }
  
  /**
   * Test recurring task functionality
   */
  static async testRecurringTasks() {
    const system = new TaskManagementSystem();
    
    // Create a recurring task template
    const templateData = {
      title: 'Weekly Meeting',
      description: 'Team status meeting',
      priority: 2,
      recurrence: {
        frequency: 'weekly',
        interval: 1,
        daysOfWeek: [1] // Monday
      },
      tags: ['meeting', 'team']
    };
    
    const template = await system.createRecurringTaskTemplate(templateData);
    
    assert.strictEqual(typeof template, 'object', 'Template should be an object');
    assert.strictEqual(template.title, templateData.title, 'Template title should match');
    assert.strictEqual(template.recurrence.frequency, 'weekly', 'Frequency should be weekly');
    
    // Check that a task was generated
    assert.strictEqual(system.tasks.size, 1, 'System should have 1 task from the template');
    
    // Get the generated task
    const tasks = Array.from(system.tasks.values());
    const generatedTask = tasks[0];
    
    assert.strictEqual(generatedTask.title, templateData.title, 'Generated task title should match template');
    assert.strictEqual(generatedTask.description, templateData.description, 'Generated task description should match template');
    assert.deepStrictEqual(generatedTask.tags, templateData.tags, 'Generated task tags should match template');
    assert.ok(generatedTask.due instanceof Date, 'Generated task should have a due date');
    
    // Test completing a recurring task and generating the next occurrence
    await system.updateTask(generatedTask.id, { status: 'completed' });
    
    // Should now have 2 tasks (the completed one and the new occurrence)
    assert.strictEqual(system.tasks.size, 2, 'System should have 2 tasks after completing the recurring task');
    
    // Find the new task (not completed)
    const newTasks = Array.from(system.tasks.values()).filter(task => task.status !== 'completed');
    assert.strictEqual(newTasks.length, 1, 'Should have 1 new task');
    
    const newTask = newTasks[0];
    assert.strictEqual(newTask.title, templateData.title, 'New task title should match template');
    assert.ok(newTask.due > generatedTask.due, 'New task due date should be after the original task');
  }
  
  /**
   * Test integration with Memory Tentacle
   */
  static async testMemoryTentacleIntegration() {
    const memoryTentacle = new MockMemoryTentacle();
    const system = new TaskManagementSystem({}, { memoryTentacle });
    
    // Create a task
    const task = await system.createTask({
      title: 'Memory Test Task',
      description: 'Testing memory integration'
    });
    
    // Verify task was stored in memory tentacle
    const storedEntity = await memoryTentacle.getEntity({
      type: 'task',
      id: task.id
    });
    
    assert.ok(storedEntity, 'Task should be stored in memory tentacle');
    assert.strictEqual(storedEntity.data.title, task.title, 'Stored task title should match');
    
    // Update task
    const updatedTask = await system.updateTask(task.id, {
      title: 'Updated Memory Test Task'
    });
    
    // Verify update in memory tentacle
    const updatedEntity = await memoryTentacle.getEntity({
      type: 'task',
      id: task.id
    });
    
    assert.strictEqual(updatedEntity.data.title, updatedTask.title, 'Updated task title should match in memory tentacle');
    
    // Delete task
    await system.deleteTask(task.id);
    
    // Verify deletion in memory tentacle
    const deletedEntity = await memoryTentacle.getEntity({
      type: 'task',
      id: task.id
    });
    
    assert.strictEqual(deletedEntity, undefined, 'Task should be deleted from memory tentacle');
  }
  
  /**
   * Test integration with Notification System
   */
  static async testNotificationSystemIntegration() {
    // Create a mock notification system
    const notificationSystem = new MockNotificationSystem();
    console.log('Created mock notification system:', notificationSystem);
    
    // Create a task management system with the mock notification system
    const system = new TaskManagementSystem({}, { notificationSystem });
    
    // Create a task with due date
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    const task = await system.createTask({
      id: 'test_task_id',
      title: 'Notification Test Task',
      description: 'Testing notification integration',
      due: tomorrow
    });
    
    console.log('Created task with due date:', task);
    console.log('Notifications scheduled:', notificationSystem.notifications);
    
    // Verify notification was scheduled
    assert.strictEqual(notificationSystem.notifications.length, 1, 'One notification should be scheduled');
    assert.strictEqual(notificationSystem.notifications[0].sourceId, task.id, 'Notification source ID should match task ID');
    
    // Update task due date
    const nextWeek = new Date();
    nextWeek.setDate(nextWeek.getDate() + 7);
    
    await system.updateTask(task.id, { due: nextWeek });
    
    // Verify old notification was canceled and new one scheduled
    assert.strictEqual(notificationSystem.canceledNotifications.length, 1, 'Old notification should be canceled');
    assert.strictEqual(notificationSystem.notifications.length, 2, 'New notification should be scheduled');
  }
  
  /**
   * Test task import/export functionality
   */
  static async testTaskImportExport() {
    const fileSystemTentacle = new MockFileSystemTentacle();
    const system = new TaskManagementSystem({}, { fileSystemTentacle });
    
    // Create test tasks
    await system.createTask({ title: 'Task 1', description: 'Description 1', tags: ['tag1', 'tag2'] });
    await system.createTask({ title: 'Task 2', description: 'Description 2', priority: 1 });
    
    // Export tasks to JSON
    const jsonPath = await system.exportTasks('json');
    
    // Verify export
    assert.ok(fileSystemTentacle.files.has(jsonPath), 'JSON file should be created');
    const jsonContent = fileSystemTentacle.files.get(jsonPath);
    const exportedTasks = JSON.parse(jsonContent);
    
    assert.strictEqual(exportedTasks.length, 2, 'Should export 2 tasks');
    assert.strictEqual(exportedTasks[0].title, 'Task 1', 'First exported task title should match');
    assert.strictEqual(exportedTasks[1].title, 'Task 2', 'Second exported task title should match');
    
    // Export tasks to CSV
    const csvPath = await system.exportTasks('csv');
    
    // Verify CSV export
    assert.ok(fileSystemTentacle.files.has(csvPath), 'CSV file should be created');
    const csvContent = fileSystemTentacle.files.get(csvPath);
    const csvLines = csvContent.split('\n');
    
    assert.strictEqual(csvLines.length, 3, 'CSV should have 3 lines (header + 2 tasks)');
    assert.ok(csvLines[0].includes('title'), 'CSV header should include title column');
    assert.ok(csvLines[1].includes('Task 1'), 'First CSV line should include Task 1');
    
    // Create a new system for import testing
    const importSystem = new TaskManagementSystem({}, { fileSystemTentacle });
    
    // Import from JSON
    const jsonImportResults = await importSystem.importTasks(jsonPath, 'json');
    
    assert.strictEqual(jsonImportResults.imported, 2, 'Should import 2 tasks from JSON');
    assert.strictEqual(importSystem.tasks.size, 2, 'Import system should have 2 tasks after JSON import');
    
    // Create another system for CSV import testing
    const csvImportSystem = new TaskManagementSystem({}, { fileSystemTentacle });
    
    // Import from CSV
    const csvImportResults = await csvImportSystem.importTasks(csvPath, 'csv');
    
    assert.strictEqual(csvImportResults.imported, 2, 'Should import 2 tasks from CSV');
    assert.strictEqual(csvImportSystem.tasks.size, 2, 'Import system should have 2 tasks after CSV import');
  }
}

// Run tests if this file is executed directly
if (require.main === module) {
  TaskManagementSystemTest.runTests();
}

module.exports = TaskManagementSystemTest;
