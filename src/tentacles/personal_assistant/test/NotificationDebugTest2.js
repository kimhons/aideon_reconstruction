/**
 * @fileoverview Second isolated test for debugging notification integration in TaskManagementSystem
 * 
 * @module src/tentacles/personal_assistant/test/NotificationDebugTest2
 */

const TaskManagementSystem = require('../TaskManagementSystem');

/**
 * Simple mock notification system for debugging with extra logging
 */
class SimpleNotificationSystem {
  constructor() {
    this.notifications = [];
    this.canceledNotifications = [];
    console.log('SimpleNotificationSystem initialized');
  }
  
  async scheduleNotification(notification) {
    console.log('SimpleNotificationSystem.scheduleNotification called with:', JSON.stringify(notification, null, 2));
    this.notifications.push(notification);
    return notification;
  }
  
  async cancelNotifications(query) {
    console.log('SimpleNotificationSystem.cancelNotifications called with:', JSON.stringify(query, null, 2));
    this.canceledNotifications.push(query);
    return true;
  }
}

/**
 * Run isolated notification test with direct method calls
 */
async function runNotificationTest() {
  console.log('=== Starting Notification Debug Test 2 ===');
  
  try {
    // Create notification system
    const notificationSystem = new SimpleNotificationSystem();
    console.log('Created notification system:', notificationSystem);
    
    // Create task management system with notification system
    const system = new TaskManagementSystem({}, { 
      notificationSystem,
      logger: {
        debug: (msg, data) => console.log(`DEBUG: ${msg}`, data || ''),
        info: (msg, data) => console.log(`INFO: ${msg}`, data || ''),
        warn: (msg, data) => console.log(`WARN: ${msg}`, data || ''),
        error: (msg, data) => console.log(`ERROR: ${msg}`, data || '')
      }
    });
    console.log('Created task management system with notification system');
    
    // Create a task with due date
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    console.log('Due date for test task:', tomorrow);
    
    // Directly call setupTaskNotifications with a mock task
    console.log('Directly calling setupTaskNotifications with mock task...');
    const mockTask = {
      id: 'mock_task_id',
      title: 'Mock Task',
      description: 'Mock task description',
      due: tomorrow,
      priority: 2
    };
    
    await system.setupTaskNotifications(mockTask);
    
    console.log('Notifications after direct call with mock task:', notificationSystem.notifications);
    
    if (notificationSystem.notifications.length > 0) {
      console.log('SUCCESS: Direct call to setupTaskNotifications worked with mock task');
    } else {
      console.log('FAILURE: Direct call to setupTaskNotifications failed with mock task');
      
      // Check if the notification system is being passed correctly
      console.log('Checking if notification system is accessible...');
      console.log('Dependencies:', system.dependencies);
      console.log('Has notificationSystem:', !!system.dependencies.notificationSystem);
    }
    
    // Create a real task with due date
    console.log('Creating real task with due date...');
    const task = await system.createTask({
      title: 'Debug Notification Task 2',
      description: 'Testing notification scheduling',
      due: tomorrow
    });
    console.log('Task created:', task);
    
    // Check if notification was scheduled
    console.log('Checking notifications after task creation...');
    console.log('Notifications scheduled:', notificationSystem.notifications);
    
    console.log('=== Notification Debug Test 2 Complete ===');
  } catch (error) {
    console.error('Error in notification test:', error);
  }
}

// Run the test
runNotificationTest();
