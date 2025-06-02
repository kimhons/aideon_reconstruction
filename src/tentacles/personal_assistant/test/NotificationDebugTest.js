/**
 * @fileoverview Isolated test for debugging notification integration in TaskManagementSystem
 * 
 * @module src/tentacles/personal_assistant/test/NotificationDebugTest
 */

const TaskManagementSystem = require('../TaskManagementSystem');

/**
 * Simple mock notification system for debugging
 */
class SimpleNotificationSystem {
  constructor() {
    this.notifications = [];
    this.canceledNotifications = [];
    console.log('SimpleNotificationSystem initialized');
  }
  
  async scheduleNotification(notification) {
    console.log('SimpleNotificationSystem.scheduleNotification called with:', notification);
    this.notifications.push(notification);
    return notification;
  }
  
  async cancelNotifications(query) {
    console.log('SimpleNotificationSystem.cancelNotifications called with:', query);
    this.canceledNotifications.push(query);
    return true;
  }
}

/**
 * Run isolated notification test
 */
async function runNotificationTest() {
  console.log('=== Starting Notification Debug Test ===');
  
  try {
    // Create notification system
    const notificationSystem = new SimpleNotificationSystem();
    console.log('Created notification system:', notificationSystem);
    
    // Create task management system with notification system
    const system = new TaskManagementSystem({}, { notificationSystem });
    console.log('Created task management system with notification system');
    
    // Create a task with due date
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    console.log('Due date for test task:', tomorrow);
    
    console.log('Creating task with due date...');
    const task = await system.createTask({
      title: 'Debug Notification Task',
      description: 'Testing notification scheduling',
      due: tomorrow
    });
    console.log('Task created:', task);
    
    // Check if notification was scheduled
    console.log('Checking notifications after task creation...');
    console.log('Notifications scheduled:', notificationSystem.notifications);
    
    if (notificationSystem.notifications.length > 0) {
      console.log('SUCCESS: Notification was scheduled');
    } else {
      console.log('FAILURE: No notification was scheduled');
      
      // Debug setupTaskNotifications method directly
      console.log('Calling setupTaskNotifications directly...');
      await system.setupTaskNotifications(task);
      
      console.log('Notifications after direct call:', notificationSystem.notifications);
      
      if (notificationSystem.notifications.length > 0) {
        console.log('SUCCESS: Direct call to setupTaskNotifications worked');
      } else {
        console.log('FAILURE: Direct call to setupTaskNotifications failed');
      }
    }
    
    // Update task due date
    const nextWeek = new Date();
    nextWeek.setDate(nextWeek.getDate() + 7);
    console.log('Updating task due date to:', nextWeek);
    
    const updatedTask = await system.updateTask(task.id, { due: nextWeek });
    console.log('Task updated:', updatedTask);
    
    // Check if notification was updated
    console.log('Checking notifications after task update...');
    console.log('Canceled notifications:', notificationSystem.canceledNotifications);
    console.log('Notifications scheduled:', notificationSystem.notifications);
    
    console.log('=== Notification Debug Test Complete ===');
  } catch (error) {
    console.error('Error in notification test:', error);
  }
}

// Run the test
runNotificationTest();
