/**
 * @fileoverview Mock Web Tentacle for testing.
 * Provides mock implementations of web functionality.
 * 
 * @module test/mocks/WebTentacle
 */

/**
 * Mock Web Tentacle
 */
class MockWebTentacle {
  /**
   * Create a new Mock Web Tentacle
   */
  constructor() {
    this.requestCalls = [];
    this.nextId = 1;
  }
  
  /**
   * Make HTTP request
   * @param {Object} options - Request options
   * @returns {Promise<Object>} Response
   */
  async request(options) {
    const requestId = `request_${this.nextId++}`;
    this.requestCalls.push({ id: requestId, options, timestamp: new Date() });
    
    // Mock different responses based on URL patterns
    const url = options.url || '';
    
    // Social media API mock responses
    if (url.includes('twitter.com') || url.includes('api.twitter')) {
      return this._mockTwitterResponse(options);
    }
    
    if (url.includes('linkedin.com') || url.includes('api.linkedin')) {
      return this._mockLinkedInResponse(options);
    }
    
    if (url.includes('facebook.com') || url.includes('graph.facebook')) {
      return this._mockFacebookResponse(options);
    }
    
    if (url.includes('instagram.com') || url.includes('api.instagram')) {
      return this._mockInstagramResponse(options);
    }
    
    // Calendar API mock responses
    if (url.includes('calendar') || url.includes('events')) {
      return this._mockCalendarResponse(options);
    }
    
    // Generic API response
    return {
      status: 200,
      statusText: 'OK',
      data: {
        success: true,
        requestId,
        message: 'Mock response for: ' + url
      },
      headers: {
        'content-type': 'application/json',
        'x-request-id': requestId
      }
    };
  }
  
  /**
   * Mock Twitter API response
   * @param {Object} options - Request options
   * @returns {Object} Mock response
   * @private
   */
  _mockTwitterResponse(options) {
    const method = options.method ? options.method.toLowerCase() : 'get';
    
    if (method === 'post' && options.url.includes('/tweets')) {
      // Mock tweet creation
      return {
        status: 201,
        statusText: 'Created',
        data: {
          id: `tweet_${Date.now()}`,
          text: options.data.text || 'Mock tweet text',
          created_at: new Date().toISOString(),
          user: {
            id: 'user_123',
            name: 'Test User',
            screen_name: 'testuser'
          }
        }
      };
    }
    
    if (method === 'get' && options.url.includes('/tweets')) {
      // Mock tweet retrieval
      return {
        status: 200,
        statusText: 'OK',
        data: {
          data: [
            {
              id: 'tweet_123',
              text: 'This is a mock tweet',
              created_at: new Date().toISOString(),
              public_metrics: {
                retweet_count: 5,
                reply_count: 2,
                like_count: 10,
                quote_count: 1
              }
            },
            {
              id: 'tweet_456',
              text: 'Another mock tweet',
              created_at: new Date(Date.now() - 86400000).toISOString(),
              public_metrics: {
                retweet_count: 3,
                reply_count: 1,
                like_count: 7,
                quote_count: 0
              }
            }
          ],
          meta: {
            result_count: 2,
            newest_id: 'tweet_123',
            oldest_id: 'tweet_456'
          }
        }
      };
    }
    
    // Default Twitter response
    return {
      status: 200,
      statusText: 'OK',
      data: {
        data: {
          id: 'user_123',
          name: 'Test User',
          username: 'testuser'
        }
      }
    };
  }
  
  /**
   * Mock LinkedIn API response
   * @param {Object} options - Request options
   * @returns {Object} Mock response
   * @private
   */
  _mockLinkedInResponse(options) {
    const method = options.method ? options.method.toLowerCase() : 'get';
    
    if (method === 'post' && options.url.includes('/shares')) {
      // Mock share creation
      return {
        status: 201,
        statusText: 'Created',
        data: {
          id: `share_${Date.now()}`,
          created: {
            time: Date.now()
          },
          owner: 'urn:li:person:123',
          text: {
            text: options.data.text || 'Mock LinkedIn share'
          }
        }
      };
    }
    
    if (method === 'get' && options.url.includes('/shares')) {
      // Mock share retrieval
      return {
        status: 200,
        statusText: 'OK',
        data: {
          elements: [
            {
              id: 'share_123',
              created: {
                time: Date.now() - 3600000
              },
              text: {
                text: 'Mock LinkedIn share content'
              },
              socialDetail: {
                totalShareStatistics: {
                  likeCount: 15,
                  commentCount: 3,
                  shareCount: 2
                }
              }
            }
          ],
          paging: {
            count: 1,
            start: 0,
            total: 1
          }
        }
      };
    }
    
    // Default LinkedIn response
    return {
      status: 200,
      statusText: 'OK',
      data: {
        id: 'urn:li:person:123',
        firstName: {
          localized: {
            en_US: 'Test'
          }
        },
        lastName: {
          localized: {
            en_US: 'User'
          }
        },
        profilePicture: {
          displayImage: 'urn:li:digitalmediaAsset:123'
        }
      }
    };
  }
  
  /**
   * Mock Facebook API response
   * @param {Object} options - Request options
   * @returns {Object} Mock response
   * @private
   */
  _mockFacebookResponse(options) {
    const method = options.method ? options.method.toLowerCase() : 'get';
    
    if (method === 'post' && options.url.includes('/feed')) {
      // Mock post creation
      return {
        status: 200,
        statusText: 'OK',
        data: {
          id: `post_${Date.now()}`,
          post_id: `123_${Date.now()}`
        }
      };
    }
    
    if (method === 'get' && options.url.includes('/feed')) {
      // Mock feed retrieval
      return {
        status: 200,
        statusText: 'OK',
        data: {
          data: [
            {
              id: 'post_123',
              message: 'Mock Facebook post',
              created_time: new Date().toISOString(),
              likes: {
                summary: {
                  total_count: 12
                }
              },
              comments: {
                summary: {
                  total_count: 3
                }
              },
              shares: {
                count: 2
              }
            }
          ],
          paging: {
            cursors: {
              before: 'before_cursor',
              after: 'after_cursor'
            }
          }
        }
      };
    }
    
    // Default Facebook response
    return {
      status: 200,
      statusText: 'OK',
      data: {
        id: '123',
        name: 'Test User',
        email: 'test@example.com'
      }
    };
  }
  
  /**
   * Mock Instagram API response
   * @param {Object} options - Request options
   * @returns {Object} Mock response
   * @private
   */
  _mockInstagramResponse(options) {
    const method = options.method ? options.method.toLowerCase() : 'get';
    
    if (method === 'post' && options.url.includes('/media')) {
      // Mock media creation
      return {
        status: 200,
        statusText: 'OK',
        data: {
          id: `media_${Date.now()}`,
          status: 'PUBLISHED'
        }
      };
    }
    
    if (method === 'get' && options.url.includes('/media')) {
      // Mock media retrieval
      return {
        status: 200,
        statusText: 'OK',
        data: {
          data: [
            {
              id: 'media_123',
              caption: 'Mock Instagram post',
              media_type: 'IMAGE',
              timestamp: new Date().toISOString(),
              like_count: 25,
              comments_count: 5
            }
          ],
          paging: {
            cursors: {
              before: 'before_cursor',
              after: 'after_cursor'
            }
          }
        }
      };
    }
    
    // Default Instagram response
    return {
      status: 200,
      statusText: 'OK',
      data: {
        id: '123',
        username: 'testuser',
        media_count: 42,
        followers_count: 1000,
        follows_count: 500
      }
    };
  }
  
  /**
   * Mock Calendar API response
   * @param {Object} options - Request options
   * @returns {Object} Mock response
   * @private
   */
  _mockCalendarResponse(options) {
    const method = options.method ? options.method.toLowerCase() : 'get';
    
    if (method === 'post' && options.url.includes('/events')) {
      // Mock event creation
      return {
        status: 201,
        statusText: 'Created',
        data: {
          id: `event_${Date.now()}`,
          summary: options.data.summary || 'Mock Event',
          description: options.data.description || 'Mock event description',
          start: {
            dateTime: options.data.start || new Date().toISOString()
          },
          end: {
            dateTime: options.data.end || new Date(Date.now() + 3600000).toISOString()
          },
          location: options.data.location || 'Mock Location',
          status: 'confirmed'
        }
      };
    }
    
    if (method === 'get' && options.url.includes('/events')) {
      // Mock events retrieval
      return {
        status: 200,
        statusText: 'OK',
        data: {
          items: [
            {
              id: 'event_123',
              summary: 'Mock Calendar Event',
              description: 'This is a mock calendar event',
              start: {
                dateTime: new Date(Date.now() + 86400000).toISOString()
              },
              end: {
                dateTime: new Date(Date.now() + 90000000).toISOString()
              },
              location: 'Mock Location',
              status: 'confirmed'
            },
            {
              id: 'event_456',
              summary: 'Another Mock Event',
              description: 'This is another mock calendar event',
              start: {
                dateTime: new Date(Date.now() + 172800000).toISOString()
              },
              end: {
                dateTime: new Date(Date.now() + 176400000).toISOString()
              },
              location: 'Another Mock Location',
              status: 'confirmed'
            }
          ]
        }
      };
    }
    
    // Default Calendar response
    return {
      status: 200,
      statusText: 'OK',
      data: {
        kind: 'calendar#calendarList',
        items: [
          {
            id: 'primary',
            summary: 'Test Calendar',
            primary: true
          }
        ]
      }
    };
  }
  
  /**
   * Get status
   * @returns {Promise<Object>} Status
   */
  async getStatus() {
    return {
      requestCount: this.requestCalls.length,
      status: 'operational'
    };
  }
}

module.exports = MockWebTentacle;
