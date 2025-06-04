/**
 * @fileoverview Calendar and Scheduling Engine for the Personal Assistant Tentacle.
 * Manages calendar events, scheduling, and integrates with external calendar services.
 * 
 * @module src/tentacles/personal_assistant/calendar/CalendarAndSchedulingEngine
 */

const EventEmitter = require('events');

/**
 * Calendar and Scheduling Engine
 * @extends EventEmitter
 */
class CalendarAndSchedulingEngine extends EventEmitter {
  /**
   * Create a new Calendar and Scheduling Engine
   * @param {Object} options - Configuration options
   * @param {Object} dependencies - System dependencies
   * @param {Object} dependencies.memoryTentacle - Memory Tentacle for persistent storage
   * @param {Object} dependencies.webTentacle - Web Tentacle for external calendar service access
   * @param {Object} dependencies.notificationSystem - Notification System for reminders
   * @param {Object} dependencies.taskManagementSystem - Task Management System for task integration
   * @param {Object} dependencies.modelIntegrationManager - Model Integration Manager for AI capabilities
   */
  constructor(options = {}, dependencies = {}) {
    super();
    
    this.options = {
      defaultReminderTime: 15, // minutes before event
      workingHoursStart: 9, // 9 AM
      workingHoursEnd: 17, // 5 PM
      workingDays: [1, 2, 3, 4, 5], // Monday to Friday
      ...options
    };
    
    this.dependencies = dependencies;
    
    // Initialize data structures
    this.events = new Map();
    this.calendars = new Map();
    this.externalSyncStatus = new Map();
    
    this.logger = dependencies.logger || console;
    this.logger.info('[CalendarAndSchedulingEngine] Calendar and Scheduling Engine initialized');
    
    // Initialize model integration if available
    this.modelIntegration = null;
    if (dependencies.modelIntegrationManager) {
      this._initializeModelIntegration();
    }
  }
  
  /**
   * Initialize model integration for intelligent scheduling
   * @private
   */
  async _initializeModelIntegration() {
    try {
      this.modelIntegration = await this.dependencies.modelIntegrationManager.getModelIntegration('calendar_scheduling');
      this.logger.info('[CalendarAndSchedulingEngine] Model integration initialized successfully');
    } catch (error) {
      this.logger.warn('[CalendarAndSchedulingEngine] Failed to initialize model integration', { error: error.message });
    }
  }
  
  /**
   * Get system status
   * @returns {Object} System status
   */
  getStatus() {
    return {
      eventCount: this.events.size,
      calendarCount: this.calendars.size,
      externalSyncCount: this.externalSyncStatus.size,
      modelIntegrationAvailable: !!this.modelIntegration
    };
  }
  
  /**
   * Create a new calendar
   * @param {Object} calendarData - Calendar data
   * @returns {Promise<Object>} Created calendar
   */
  async createCalendar(calendarData) {
    this.logger.debug('[CalendarAndSchedulingEngine] Creating calendar', { name: calendarData.name });
    
    const calendarId = calendarData.id || `calendar_${Date.now()}_${this._generateRandomId()}`;
    
    const calendar = {
      id: calendarId,
      name: calendarData.name || 'Untitled Calendar',
      description: calendarData.description || '',
      color: calendarData.color || '#3498db',
      isDefault: calendarData.isDefault || false,
      isVisible: calendarData.isVisible !== undefined ? calendarData.isVisible : true,
      externalSource: calendarData.externalSource || null,
      externalId: calendarData.externalId || null,
      created: new Date(),
      updated: new Date()
    };
    
    // Store calendar
    this.calendars.set(calendarId, calendar);
    
    // Store in memory tentacle if available
    if (this.dependencies.memoryTentacle) {
      await this.dependencies.memoryTentacle.storeEntity({
        type: 'calendar',
        id: calendarId,
        data: calendar
      });
    }
    
    // Set as default if requested or if it's the first calendar
    if (calendar.isDefault || this.calendars.size === 1) {
      await this._setDefaultCalendar(calendarId);
    }
    
    this.logger.info('[CalendarAndSchedulingEngine] Calendar created successfully', { calendarId });
    return calendar;
  }
  
  /**
   * Set default calendar
   * @param {string} calendarId - Calendar ID
   * @returns {Promise<boolean>} Success
   * @private
   */
  async _setDefaultCalendar(calendarId) {
    // Reset all calendars to non-default
    for (const [id, calendar] of this.calendars.entries()) {
      if (id !== calendarId && calendar.isDefault) {
        calendar.isDefault = false;
        
        // Update in memory tentacle if available
        if (this.dependencies.memoryTentacle) {
          await this.dependencies.memoryTentacle.updateEntity({
            type: 'calendar',
            id,
            data: calendar
          });
        }
      }
    }
    
    // Set new default
    const calendar = this.calendars.get(calendarId);
    if (calendar) {
      calendar.isDefault = true;
      
      // Update in memory tentacle if available
      if (this.dependencies.memoryTentacle) {
        await this.dependencies.memoryTentacle.updateEntity({
          type: 'calendar',
          id: calendarId,
          data: calendar
        });
      }
      
      return true;
    }
    
    return false;
  }
  
  /**
   * Get default calendar
   * @returns {Object|null} Default calendar or null if none
   */
  getDefaultCalendar() {
    for (const calendar of this.calendars.values()) {
      if (calendar.isDefault) {
        return calendar;
      }
    }
    
    // If no default, return first calendar
    if (this.calendars.size > 0) {
      return Array.from(this.calendars.values())[0];
    }
    
    return null;
  }
  
  /**
   * Create a new event
   * @param {Object} eventData - Event data
   * @returns {Promise<Object>} Created event
   */
  async createEvent(eventData) {
    this.logger.debug('[CalendarAndSchedulingEngine] Creating event', { title: eventData.title });
    
    const now = new Date();
    const eventId = eventData.id || `event_${Date.now()}_${this._generateRandomId()}`;
    
    // Determine calendar
    let calendarId = eventData.calendarId;
    if (!calendarId) {
      const defaultCalendar = this.getDefaultCalendar();
      calendarId = defaultCalendar ? defaultCalendar.id : null;
    }
    
    if (!calendarId) {
      throw new Error('No calendar specified and no default calendar available');
    }
    
    const event = {
      id: eventId,
      title: eventData.title || 'Untitled Event',
      description: eventData.description || '',
      start: eventData.start || now,
      end: eventData.end || new Date(now.getTime() + 3600000), // Default 1 hour
      location: eventData.location || null,
      attendees: eventData.attendees || [],
      recurrence: eventData.recurrence || null,
      reminders: eventData.reminders || [{ minutes: this.options.defaultReminderTime }],
      status: eventData.status || 'confirmed',
      visibility: eventData.visibility || 'default',
      attachments: eventData.attachments || [],
      categories: eventData.categories || [],
      calendarId: calendarId,
      source: eventData.source || 'local',
      externalId: eventData.externalId || null,
      created: now,
      updated: now
    };
    
    // Store event
    this.events.set(eventId, event);
    
    // Store in memory tentacle if available
    if (this.dependencies.memoryTentacle) {
      await this.dependencies.memoryTentacle.storeEntity({
        type: 'calendarEvent',
        id: eventId,
        data: event
      });
    }
    
    // Set up reminders
    await this._setupEventReminders(event);
    
    // If this is a recurring event, generate next occurrences
    if (event.recurrence) {
      await this._generateRecurringEventInstances(event);
    }
    
    // Sync with external calendar if applicable
    await this._syncEventToExternalCalendar(event);
    
    this.logger.info('[CalendarAndSchedulingEngine] Event created successfully', { eventId });
    return event;
  }
  
  /**
   * Get an event by ID
   * @param {string} eventId - Event ID
   * @returns {Promise<Object>} Event
   * @throws {Error} If event not found
   */
  async getEvent(eventId) {
    this.logger.debug('[CalendarAndSchedulingEngine] Getting event', { eventId });
    
    const event = this.events.get(eventId);
    if (!event) {
      throw new Error(`Event not found: ${eventId}`);
    }
    
    return event;
  }
  
  /**
   * Update an event
   * @param {string} eventId - Event ID
   * @param {Object} updates - Event updates
   * @returns {Promise<Object>} Updated event
   * @throws {Error} If event not found
   */
  async updateEvent(eventId, updates) {
    this.logger.debug('[CalendarAndSchedulingEngine] Updating event', { eventId });
    
    const event = this.events.get(eventId);
    if (!event) {
      this.logger.error('[CalendarAndSchedulingEngine] Failed to update event', { 
        eventId, 
        error: `Event not found: ${eventId}` 
      });
      throw new Error(`Event not found: ${eventId}`);
    }
    
    const updatedEvent = { ...event };
    
    // Apply updates
    Object.keys(updates).forEach(key => {
      if (key !== 'id' && key !== 'created') {
        updatedEvent[key] = updates[key];
      }
    });
    
    // Update timestamp
    updatedEvent.updated = new Date();
    
    // Store updated event
    this.events.set(eventId, updatedEvent);
    
    // Update in memory tentacle if available
    if (this.dependencies.memoryTentacle) {
      await this.dependencies.memoryTentacle.updateEntity({
        type: 'calendarEvent',
        id: eventId,
        data: updatedEvent
      });
    }
    
    // Update reminders if necessary
    if (updates.start || updates.reminders) {
      await this._setupEventReminders(updatedEvent);
    }
    
    // Update recurring instances if necessary
    if (updates.recurrence || updates.start || updates.end) {
      await this._updateRecurringEventInstances(updatedEvent);
    }
    
    // Sync with external calendar if applicable
    await this._syncEventToExternalCalendar(updatedEvent);
    
    this.logger.info('[CalendarAndSchedulingEngine] Event updated successfully', { eventId });
    return updatedEvent;
  }
  
  /**
   * Delete an event
   * @param {string} eventId - Event ID
   * @returns {Promise<boolean>} Success
   * @throws {Error} If event not found
   */
  async deleteEvent(eventId) {
    this.logger.debug('[CalendarAndSchedulingEngine] Deleting event', { eventId });
    
    const event = this.events.get(eventId);
    if (!event) {
      throw new Error(`Event not found: ${eventId}`);
    }
    
    // Remove event
    this.events.delete(eventId);
    
    // Remove from memory tentacle if available
    if (this.dependencies.memoryTentacle) {
      await this.dependencies.memoryTentacle.deleteEntity({
        type: 'calendarEvent',
        id: eventId
      });
    }
    
    // Cancel reminders
    if (this.dependencies.notificationSystem) {
      await this.dependencies.notificationSystem.cancelNotifications({
        sourceType: 'calendarEvent',
        sourceId: eventId
      });
    }
    
    // Delete from external calendar if applicable
    await this._deleteEventFromExternalCalendar(event);
    
    this.logger.info('[CalendarAndSchedulingEngine] Event deleted successfully', { eventId });
    return true;
  }
  
  /**
   * Search events
   * @param {Object} criteria - Search criteria
   * @returns {Promise<Array<Object>>} Matching events
   */
  async searchEvents(criteria = {}) {
    this.logger.debug('[CalendarAndSchedulingEngine] Searching events', { criteria });
    
    let results = Array.from(this.events.values());
    
    // Filter by query
    if (criteria.query) {
      const query = criteria.query.toLowerCase();
      results = results.filter(event => 
        event.title.toLowerCase().includes(query) || 
        event.description.toLowerCase().includes(query)
      );
    }
    
    // Filter by calendar
    if (criteria.calendarId) {
      results = results.filter(event => event.calendarId === criteria.calendarId);
    }
    
    // Filter by date range
    if (criteria.startAfter) {
      results = results.filter(event => event.start >= criteria.startAfter);
    }
    
    if (criteria.startBefore) {
      results = results.filter(event => event.start <= criteria.startBefore);
    }
    
    if (criteria.endAfter) {
      results = results.filter(event => event.end >= criteria.endAfter);
    }
    
    if (criteria.endBefore) {
      results = results.filter(event => event.end <= criteria.endBefore);
    }
    
    // Filter by status
    if (criteria.status) {
      results = results.filter(event => event.status === criteria.status);
    }
    
    // Filter by categories
    if (criteria.categories && criteria.categories.length > 0) {
      results = results.filter(event => 
        criteria.categories.some(category => event.categories.includes(category))
      );
    }
    
    // Apply pagination
    if (criteria.offset || criteria.limit) {
      const offset = criteria.offset || 0;
      const limit = criteria.limit || results.length;
      results = results.slice(offset, offset + limit);
    }
    
    this.logger.info('[CalendarAndSchedulingEngine] Event search completed', { resultCount: results.length });
    return results;
  }
  
  /**
   * Find available time slots for scheduling
   * @param {Object} criteria - Scheduling criteria
   * @param {Date} criteria.startDate - Start date for search
   * @param {Date} criteria.endDate - End date for search
   * @param {number} criteria.duration - Duration in minutes
   * @param {Array<string>} criteria.requiredAttendees - Required attendees
   * @param {Array<string>} criteria.optionalAttendees - Optional attendees
   * @param {boolean} criteria.respectWorkingHours - Whether to respect working hours
   * @returns {Promise<Array<Object>>} Available time slots
   */
  async findAvailableTimeSlots(criteria) {
    this.logger.debug('[CalendarAndSchedulingEngine] Finding available time slots', { criteria });
    
    // Use model integration for intelligent scheduling if available
    if (this.modelIntegration) {
      try {
        const modelResult = await this.modelIntegration.findOptimalTimeSlots({
          startDate: criteria.startDate,
          endDate: criteria.endDate,
          duration: criteria.duration,
          requiredAttendees: criteria.requiredAttendees,
          optionalAttendees: criteria.optionalAttendees,
          respectWorkingHours: criteria.respectWorkingHours,
          existingEvents: Array.from(this.events.values()),
          workingHours: {
            start: this.options.workingHoursStart,
            end: this.options.workingHoursEnd,
            days: this.options.workingDays
          }
        });
        
        if (modelResult && modelResult.timeSlots) {
          this.logger.info('[CalendarAndSchedulingEngine] Found time slots using model integration', { 
            slotCount: modelResult.timeSlots.length 
          });
          return modelResult.timeSlots;
        }
      } catch (error) {
        this.logger.warn('[CalendarAndSchedulingEngine] Model integration failed, falling back to standard algorithm', { 
          error: error.message 
        });
      }
    }
    
    // Fall back to standard algorithm
    return this._findAvailableTimeSlotsStandard(criteria);
  }
  
  /**
   * Find available time slots using standard algorithm
   * @param {Object} criteria - Scheduling criteria
   * @returns {Promise<Array<Object>>} Available time slots
   * @private
   */
  async _findAvailableTimeSlotsStandard(criteria) {
    const startDate = criteria.startDate || new Date();
    const endDate = criteria.endDate || new Date(startDate.getTime() + 7 * 24 * 60 * 60 * 1000); // Default 1 week
    const duration = criteria.duration || 60; // Default 60 minutes
    const respectWorkingHours = criteria.respectWorkingHours !== undefined ? criteria.respectWorkingHours : true;
    
    // Get all events in the date range
    const events = await this.searchEvents({
      startAfter: startDate,
      endBefore: endDate
    });
    
    // Generate time slots
    const timeSlots = [];
    const currentDate = new Date(startDate);
    
    while (currentDate < endDate) {
      const dayOfWeek = currentDate.getDay();
      
      // Skip if outside working days and respecting working hours
      if (respectWorkingHours && !this.options.workingDays.includes(dayOfWeek)) {
        currentDate.setDate(currentDate.getDate() + 1);
        currentDate.setHours(0, 0, 0, 0);
        continue;
      }
      
      // Set to start of working hours if respecting working hours
      if (respectWorkingHours) {
        currentDate.setHours(this.options.workingHoursStart, 0, 0, 0);
      }
      
      // End time for the day
      const dayEndTime = new Date(currentDate);
      if (respectWorkingHours) {
        dayEndTime.setHours(this.options.workingHoursEnd, 0, 0, 0);
      } else {
        dayEndTime.setHours(23, 59, 59, 999);
      }
      
      // Check each potential slot
      while (currentDate.getTime() + duration * 60000 <= dayEndTime.getTime()) {
        const slotEnd = new Date(currentDate.getTime() + duration * 60000);
        
        // Check if slot conflicts with any event
        const hasConflict = events.some(event => {
          return (
            (currentDate >= event.start && currentDate < event.end) || // Slot start during event
            (slotEnd > event.start && slotEnd <= event.end) || // Slot end during event
            (currentDate <= event.start && slotEnd >= event.end) // Slot contains event
          );
        });
        
        if (!hasConflict) {
          timeSlots.push({
            start: new Date(currentDate),
            end: new Date(slotEnd)
          });
        }
        
        // Move to next slot (30-minute increments)
        currentDate.setMinutes(currentDate.getMinutes() + 30);
      }
      
      // Move to next day
      currentDate.setDate(currentDate.getDate() + 1);
      currentDate.setHours(0, 0, 0, 0);
    }
    
    this.logger.info('[CalendarAndSchedulingEngine] Found time slots using standard algorithm', { 
      slotCount: timeSlots.length 
    });
    return timeSlots;
  }
  
  /**
   * Connect to external calendar service
   * @param {Object} connectionData - Connection data
   * @returns {Promise<Object>} Connection status
   */
  async connectExternalCalendar(connectionData) {
    this.logger.debug('[CalendarAndSchedulingEngine] Connecting to external calendar', { 
      service: connectionData.service 
    });
    
    if (!this.dependencies.webTentacle) {
      throw new Error('Web Tentacle is required for external calendar integration');
    }
    
    const connectionId = `connection_${connectionData.service}_${Date.now()}`;
    
    // Store connection data
    const connection = {
      id: connectionId,
      service: connectionData.service,
      accountId: connectionData.accountId,
      displayName: connectionData.displayName,
      authData: connectionData.authData,
      status: 'connecting',
      lastSync: null,
      created: new Date()
    };
    
    this.externalSyncStatus.set(connectionId, connection);
    
    try {
      // Attempt connection via Web Tentacle
      const result = await this.dependencies.webTentacle.connectCalendarService({
        service: connectionData.service,
        authData: connectionData.authData
      });
      
      // Update connection status
      connection.status = 'connected';
      connection.serviceData = result.serviceData;
      
      // Import calendars
      if (result.calendars && result.calendars.length > 0) {
        for (const calendarData of result.calendars) {
          await this.createCalendar({
            name: calendarData.name,
            description: calendarData.description,
            color: calendarData.color,
            externalSource: connectionData.service,
            externalId: calendarData.id
          });
        }
      }
      
      this.logger.info('[CalendarAndSchedulingEngine] Connected to external calendar successfully', { 
        service: connectionData.service 
      });
      
      // Schedule initial sync
      this._syncExternalCalendar(connectionId);
      
      return {
        status: 'success',
        connectionId,
        calendars: result.calendars
      };
    } catch (error) {
      // Update connection status
      connection.status = 'error';
      connection.error = error.message;
      
      this.logger.error('[CalendarAndSchedulingEngine] Failed to connect to external calendar', { 
        service: connectionData.service,
        error: error.message
      });
      
      return {
        status: 'error',
        error: error.message
      };
    }
  }
  
  /**
   * Sync with external calendar
   * @param {string} connectionId - Connection ID
   * @returns {Promise<Object>} Sync status
   * @private
   */
  async _syncExternalCalendar(connectionId) {
    const connection = this.externalSyncStatus.get(connectionId);
    if (!connection) {
      throw new Error(`External calendar connection not found: ${connectionId}`);
    }
    
    this.logger.debug('[CalendarAndSchedulingEngine] Syncing with external calendar', { 
      service: connection.service 
    });
    
    try {
      // Get events from external calendar
      const result = await this.dependencies.webTentacle.syncCalendarEvents({
        service: connection.service,
        authData: connection.authData,
        lastSync: connection.lastSync
      });
      
      // Process new and updated events
      if (result.events && result.events.length > 0) {
        for (const eventData of result.events) {
          // Find matching calendar
          const calendar = Array.from(this.calendars.values()).find(cal => 
            cal.externalSource === connection.service && cal.externalId === eventData.calendarId
          );
          
          if (calendar) {
            // Check if event already exists
            const existingEvent = Array.from(this.events.values()).find(event => 
              event.externalId === eventData.id && event.source === connection.service
            );
            
            if (existingEvent) {
              // Update existing event
              await this.updateEvent(existingEvent.id, {
                title: eventData.title,
                description: eventData.description,
                start: new Date(eventData.start),
                end: new Date(eventData.end),
                location: eventData.location,
                attendees: eventData.attendees,
                recurrence: eventData.recurrence,
                status: eventData.status
              });
            } else {
              // Create new event
              await this.createEvent({
                title: eventData.title,
                description: eventData.description,
                start: new Date(eventData.start),
                end: new Date(eventData.end),
                location: eventData.location,
                attendees: eventData.attendees,
                recurrence: eventData.recurrence,
                status: eventData.status,
                calendarId: calendar.id,
                source: connection.service,
                externalId: eventData.id
              });
            }
          }
        }
      }
      
      // Process deleted events
      if (result.deletedEvents && result.deletedEvents.length > 0) {
        for (const externalId of result.deletedEvents) {
          const existingEvent = Array.from(this.events.values()).find(event => 
            event.externalId === externalId && event.source === connection.service
          );
          
          if (existingEvent) {
            await this.deleteEvent(existingEvent.id);
          }
        }
      }
      
      // Update connection status
      connection.status = 'connected';
      connection.lastSync = new Date();
      connection.error = null;
      
      this.logger.info('[CalendarAndSchedulingEngine] External calendar sync completed', { 
        service: connection.service,
        newEvents: result.events ? result.events.length : 0,
        deletedEvents: result.deletedEvents ? result.deletedEvents.length : 0
      });
      
      return {
        status: 'success',
        newEvents: result.events ? result.events.length : 0,
        deletedEvents: result.deletedEvents ? result.deletedEvents.length : 0
      };
    } catch (error) {
      // Update connection status
      connection.status = 'error';
      connection.error = error.message;
      
      this.logger.error('[CalendarAndSchedulingEngine] Failed to sync with external calendar', { 
        service: connection.service,
        error: error.message
      });
      
      return {
        status: 'error',
        error: error.message
      };
    }
  }
  
  /**
   * Sync event to external calendar
   * @param {Object} event - Event
   * @returns {Promise<boolean>} Success
   * @private
   */
  async _syncEventToExternalCalendar(event) {
    // Skip if event is from external source
    if (event.source !== 'local') {
      return false;
    }
    
    // Get calendar
    const calendar = this.calendars.get(event.calendarId);
    if (!calendar || !calendar.externalSource || !calendar.externalId) {
      return false;
    }
    
    // Find connection
    const connection = Array.from(this.externalSyncStatus.values()).find(conn => 
      conn.service === calendar.externalSource && conn.status === 'connected'
    );
    
    if (!connection) {
      return false;
    }
    
    this.logger.debug('[CalendarAndSchedulingEngine] Syncing event to external calendar', { 
      eventId: event.id,
      service: calendar.externalSource
    });
    
    try {
      // Prepare event data
      const eventData = {
        id: event.externalId,
        calendarId: calendar.externalId,
        title: event.title,
        description: event.description,
        start: event.start,
        end: event.end,
        location: event.location,
        attendees: event.attendees,
        recurrence: event.recurrence,
        status: event.status
      };
      
      // Send to external calendar
      const result = await this.dependencies.webTentacle.updateCalendarEvent({
        service: calendar.externalSource,
        authData: connection.authData,
        event: eventData
      });
      
      // Update external ID if new
      if (!event.externalId && result.id) {
        await this.updateEvent(event.id, {
          externalId: result.id
        });
      }
      
      this.logger.info('[CalendarAndSchedulingEngine] Event synced to external calendar', { 
        eventId: event.id,
        service: calendar.externalSource
      });
      
      return true;
    } catch (error) {
      this.logger.error('[CalendarAndSchedulingEngine] Failed to sync event to external calendar', { 
        eventId: event.id,
        service: calendar.externalSource,
        error: error.message
      });
      
      return false;
    }
  }
  
  /**
   * Delete event from external calendar
   * @param {Object} event - Event
   * @returns {Promise<boolean>} Success
   * @private
   */
  async _deleteEventFromExternalCalendar(event) {
    // Skip if event is from external source or has no external ID
    if (event.source !== 'local' || !event.externalId) {
      return false;
    }
    
    // Get calendar
    const calendar = this.calendars.get(event.calendarId);
    if (!calendar || !calendar.externalSource) {
      return false;
    }
    
    // Find connection
    const connection = Array.from(this.externalSyncStatus.values()).find(conn => 
      conn.service === calendar.externalSource && conn.status === 'connected'
    );
    
    if (!connection) {
      return false;
    }
    
    this.logger.debug('[CalendarAndSchedulingEngine] Deleting event from external calendar', { 
      eventId: event.id,
      service: calendar.externalSource
    });
    
    try {
      // Send delete request
      await this.dependencies.webTentacle.deleteCalendarEvent({
        service: calendar.externalSource,
        authData: connection.authData,
        calendarId: calendar.externalId,
        eventId: event.externalId
      });
      
      this.logger.info('[CalendarAndSchedulingEngine] Event deleted from external calendar', { 
        eventId: event.id,
        service: calendar.externalSource
      });
      
      return true;
    } catch (error) {
      this.logger.error('[CalendarAndSchedulingEngine] Failed to delete event from external calendar', { 
        eventId: event.id,
        service: calendar.externalSource,
        error: error.message
      });
      
      return false;
    }
  }
  
  /**
   * Set up reminders for an event
   * @param {Object} event - Event
   * @returns {Promise<void>}
   * @private
   */
  async _setupEventReminders(event) {
    if (!this.dependencies.notificationSystem || !event.reminders || event.reminders.length === 0) {
      return;
    }
    
    // Cancel existing reminders
    await this.dependencies.notificationSystem.cancelNotifications({
      sourceType: 'calendarEvent',
      sourceId: event.id
    });
    
    // Set up new reminders
    for (const reminder of event.reminders) {
      const reminderTime = new Date(event.start.getTime() - (reminder.minutes * 60000));
      
      // Skip if reminder time is in the past
      if (reminderTime <= new Date()) {
        continue;
      }
      
      await this.dependencies.notificationSystem.scheduleNotification({
        title: `Event Reminder: ${event.title}`,
        body: event.description || 'You have an upcoming event',
        scheduledTime: reminderTime,
        priority: 'high',
        category: 'calendar',
        actions: [
          { id: 'view', label: 'View Event' },
          { id: 'snooze', label: 'Snooze' }
        ],
        data: {
          sourceType: 'calendarEvent',
          sourceId: event.id,
          eventTitle: event.title,
          eventStart: event.start,
          eventLocation: event.location
        }
      });
    }
  }
  
  /**
   * Generate recurring event instances
   * @param {Object} template - Event template
   * @returns {Promise<Array<Object>>} Generated events
   * @private
   */
  async _generateRecurringEventInstances(template) {
    // Implementation for recurring events
    // This would generate instances based on recurrence pattern
    // Similar to the task recurrence implementation
    
    // For now, just log that this would happen
    this.logger.info('[CalendarAndSchedulingEngine] Would generate recurring instances', { 
      eventId: template.id,
      recurrence: template.recurrence
    });
    
    return [];
  }
  
  /**
   * Update recurring event instances
   * @param {Object} template - Event template
   * @returns {Promise<void>}
   * @private
   */
  async _updateRecurringEventInstances(template) {
    // Implementation for updating recurring events
    // This would update or regenerate instances based on template changes
    
    // For now, just log that this would happen
    this.logger.info('[CalendarAndSchedulingEngine] Would update recurring instances', { 
      eventId: template.id,
      recurrence: template.recurrence
    });
  }
  
  /**
   * Generate a random ID
   * @returns {string} Random ID
   * @private
   */
  _generateRandomId() {
    return Math.random().toString(36).substring(2, 15);
  }
  
  /**
   * Export calendar to iCalendar format
   * @param {string} calendarId - Calendar ID
   * @returns {Promise<string>} iCalendar data
   */
  async exportToICalendar(calendarId) {
    this.logger.debug('[CalendarAndSchedulingEngine] Exporting calendar to iCalendar', { calendarId });
    
    const calendar = this.calendars.get(calendarId);
    if (!calendar) {
      throw new Error(`Calendar not found: ${calendarId}`);
    }
    
    // Get events for this calendar
    const events = await this.searchEvents({ calendarId });
    
    // Generate iCalendar format
    let ical = 'BEGIN:VCALENDAR\r\n';
    ical += 'VERSION:2.0\r\n';
    ical += 'PRODID:-//Aideon//Personal Assistant//EN\r\n';
    ical += `X-WR-CALNAME:${calendar.name}\r\n`;
    
    // Add events
    for (const event of events) {
      ical += 'BEGIN:VEVENT\r\n';
      ical += `UID:${event.id}\r\n`;
      ical += `SUMMARY:${event.title}\r\n`;
      
      if (event.description) {
        ical += `DESCRIPTION:${event.description.replace(/\n/g, '\\n')}\r\n`;
      }
      
      // Format dates
      const formatDate = (date) => {
        return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
      };
      
      ical += `DTSTART:${formatDate(event.start)}\r\n`;
      ical += `DTEND:${formatDate(event.end)}\r\n`;
      
      if (event.location) {
        ical += `LOCATION:${event.location}\r\n`;
      }
      
      if (event.status) {
        ical += `STATUS:${event.status.toUpperCase()}\r\n`;
      }
      
      ical += `DTSTAMP:${formatDate(new Date())}\r\n`;
      ical += 'END:VEVENT\r\n';
    }
    
    ical += 'END:VCALENDAR\r\n';
    
    this.logger.info('[CalendarAndSchedulingEngine] Calendar exported successfully', { 
      calendarId,
      eventCount: events.length
    });
    
    return ical;
  }
  
  /**
   * Import from iCalendar format
   * @param {string} icalData - iCalendar data
   * @param {string} [targetCalendarId] - Target calendar ID (optional)
   * @returns {Promise<Object>} Import results
   */
  async importFromICalendar(icalData, targetCalendarId) {
    this.logger.debug('[CalendarAndSchedulingEngine] Importing from iCalendar');
    
    // Determine target calendar
    let calendarId = targetCalendarId;
    if (!calendarId) {
      const defaultCalendar = this.getDefaultCalendar();
      calendarId = defaultCalendar ? defaultCalendar.id : null;
    }
    
    if (!calendarId) {
      // Create a new calendar for import
      const calendar = await this.createCalendar({
        name: 'Imported Calendar',
        description: 'Calendar imported from iCalendar data'
      });
      calendarId = calendar.id;
    }
    
    // Parse iCalendar data
    // This is a simplified parser and would need to be more robust in production
    const events = [];
    const lines = icalData.split(/\r?\n/);
    
    let currentEvent = null;
    
    for (const line of lines) {
      if (line === 'BEGIN:VEVENT') {
        currentEvent = {
          calendarId
        };
      } else if (line === 'END:VEVENT' && currentEvent) {
        events.push(currentEvent);
        currentEvent = null;
      } else if (currentEvent) {
        const [key, ...valueParts] = line.split(':');
        const value = valueParts.join(':');
        
        switch (key) {
          case 'UID':
            currentEvent.externalId = value;
            break;
          case 'SUMMARY':
            currentEvent.title = value;
            break;
          case 'DESCRIPTION':
            currentEvent.description = value.replace(/\\n/g, '\n');
            break;
          case 'DTSTART':
            currentEvent.start = this._parseICalDate(value);
            break;
          case 'DTEND':
            currentEvent.end = this._parseICalDate(value);
            break;
          case 'LOCATION':
            currentEvent.location = value;
            break;
          case 'STATUS':
            currentEvent.status = value.toLowerCase();
            break;
        }
      }
    }
    
    // Import events
    const importedEvents = [];
    for (const eventData of events) {
      try {
        const event = await this.createEvent(eventData);
        importedEvents.push(event);
      } catch (error) {
        this.logger.error('[CalendarAndSchedulingEngine] Failed to import event', { 
          title: eventData.title,
          error: error.message
        });
      }
    }
    
    this.logger.info('[CalendarAndSchedulingEngine] Calendar import completed', { 
      eventCount: importedEvents.length
    });
    
    return {
      calendarId,
      importedCount: importedEvents.length,
      totalCount: events.length
    };
  }
  
  /**
   * Parse iCalendar date
   * @param {string} value - iCalendar date string
   * @returns {Date} Parsed date
   * @private
   */
  _parseICalDate(value) {
    // Basic parsing for iCalendar date format
    // Format: YYYYMMDDTHHMMSSZ or YYYYMMDD
    
    const year = parseInt(value.substring(0, 4), 10);
    const month = parseInt(value.substring(4, 6), 10) - 1; // 0-based month
    const day = parseInt(value.substring(6, 8), 10);
    
    if (value.length > 8) {
      const hour = parseInt(value.substring(9, 11), 10);
      const minute = parseInt(value.substring(11, 13), 10);
      const second = parseInt(value.substring(13, 15), 10);
      
      return new Date(Date.UTC(year, month, day, hour, minute, second));
    } else {
      return new Date(Date.UTC(year, month, day));
    }
  }
}

module.exports = CalendarAndSchedulingEngine;
