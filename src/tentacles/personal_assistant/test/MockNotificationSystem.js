/**
 * @fileoverview Mock Notification System for testing the Personal Assistant Tentacle.
 * 
 * @module src/tentacles/personal_assistant/test/MockNotificationSystem
 */

/**
 * Mock Notification System for testing
 */
class MockNotificationSystem {
  /**
   * Create a new Mock Notification System
   */
  constructor() {
    this.notifications = [];
    this.canceledNotifications = [];
  }
  
  /**
   * Schedule a notification
   * @param {Object} notification - Notification data
   * @returns {Promise<Object>} Scheduled notification
   */
  async scheduleNotification(notification) {
    console.log('MockNotificationSystem: Scheduling notification', notification);
    this.notifications.push(notification);
    return notification;
  }
  
  /**
   * Cancel notifications matching query
   * @param {Object} query - Query to match notifications
   * @returns {Promise<Boolean>} True if cancellation was successful
   */
  async cancelNotifications(query) {
    console.log('MockNotificationSystem: Canceling notifications', query);
    this.canceledNotifications.push(query);
    return true;
  }
}

module.exports = MockNotificationSystem;
