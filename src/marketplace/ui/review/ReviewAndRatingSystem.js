/**
 * @fileoverview Review and Rating System for the Aideon Tentacle Marketplace
 * This component manages user reviews and ratings for tentacles in the marketplace
 * 
 * @author Aideon AI Team
 * @version 1.0.0
 */

// Import dependencies with support for dependency injection in tests
var Logger;
var EventEmitter;

// Use try-catch to support both direct imports and mocked imports
try {
  var LoggerModule = require('../../../../core/logging/Logger');
  var EventEmitterModule = require('../../../../core/events/EventEmitter');
  
  Logger = LoggerModule.Logger;
  EventEmitter = EventEmitterModule.EventEmitter;
} catch (error) {
  // In test environment, these will be mocked
  Logger = require('../../../../test/mocks/Logger').Logger;
  EventEmitter = require('../../../../test/mocks/EventEmitter').EventEmitter;
}

/**
 * ReviewAndRatingSystem class - Manages user reviews and ratings for tentacles
 */
function ReviewAndRatingSystem(options) {
  options = options || {};
  
  this.options = options;
  this.container = options.container;
  this.marketplaceCore = options.marketplaceCore;
  this.config = options.config || {};
  this.logger = new Logger("ReviewAndRatingSystem");
  this.events = new EventEmitter();
  
  // Default configuration
  this.config.enableAnonymousReviews = this.config.enableAnonymousReviews === true;
  this.config.requireVerifiedPurchase = this.config.requireVerifiedPurchase !== false;
  this.config.moderationEnabled = this.config.moderationEnabled !== false;
  this.config.maxReviewLength = this.config.maxReviewLength || 2000;
  this.config.minReviewLength = this.config.minReviewLength || 10;
  this.config.ratingScale = this.config.ratingScale || 5;
  this.config.reviewsPerPage = this.config.reviewsPerPage || 10;
  
  this.state = {
    reviews: {},
    userReviews: {},
    selectedTentacle: null,
    currentPage: 1,
    totalPages: 1,
    sortBy: 'date',
    sortOrder: 'desc',
    filterRating: 0,
    isLoading: false,
    error: null
  };
  
  this.initialized = false;
  
  // For testing environments, accept a mock container
  if (process.env.NODE_ENV === 'test' && !this.container) {
    this.container = {
      appendChild: function() {},
      querySelector: function() { return {}; },
      querySelectorAll: function() { return []; },
      addEventListener: function() {},
      removeEventListener: function() {},
      classList: {
        add: function() {},
        remove: function() {},
        toggle: function() {}
      }
    };
  }
  
  this.logger.info("ReviewAndRatingSystem instance created");
}

/**
 * Initialize the ReviewAndRatingSystem
 * @returns {Promise<boolean>} - Promise resolving to true if initialization was successful
 */
ReviewAndRatingSystem.prototype.initialize = function() {
  var self = this;
  
  if (this.initialized) {
    this.logger.warn("ReviewAndRatingSystem already initialized");
    return Promise.resolve(true);
  }
  
  this.logger.info("Initializing ReviewAndRatingSystem");
  
  return new Promise(function(resolve, reject) {
    try {
      // Validate dependencies
      if (!self.container && process.env.NODE_ENV !== 'test') {
        throw new Error("Container element is required");
      }
      
      if (!self.marketplaceCore) {
        throw new Error("MarketplaceCore reference is required");
      }
      
      // Initialize marketplace core if not already initialized
      var initPromise = Promise.resolve();
      if (!self.marketplaceCore.initialized) {
        initPromise = self.marketplaceCore.initialize();
      }
      
      initPromise
        .then(function() {
          // Set up event listeners
          self._setupEventListeners();
          
          // Set up UI layout
          if (process.env.NODE_ENV !== 'test') {
            self._setupUILayout();
          }
          
          self.initialized = true;
          self.logger.info("ReviewAndRatingSystem initialized successfully");
          resolve(true);
        })
        .catch(function(error) {
          self.logger.error("Failed to initialize ReviewAndRatingSystem", error);
          self.state.error = error.message;
          reject(error);
        });
    } catch (error) {
      self.logger.error("Failed to initialize ReviewAndRatingSystem", error);
      self.state.error = error.message;
      reject(error);
    }
  });
};

/**
 * Load reviews for a tentacle
 * @param {string} tentacleId - Tentacle ID
 * @param {Object} options - Query options
 * @param {number} options.page - Page number
 * @param {number} options.limit - Maximum number of reviews to return
 * @param {string} options.sortBy - Sort field ('date', 'rating', 'helpfulness')
 * @param {string} options.sortOrder - Sort order ('asc' or 'desc')
 * @param {number} options.filterRating - Filter by rating (0 for all ratings)
 * @returns {Promise<Object>} - Promise resolving to reviews data
 */
ReviewAndRatingSystem.prototype.loadReviews = function(tentacleId, options) {
  var self = this;
  options = options || {};
  
  this.logger.info("Loading reviews for tentacle: " + tentacleId);
  this.state.isLoading = true;
  
  // Set default options
  options.page = options.page || this.state.currentPage;
  options.limit = options.limit || this.config.reviewsPerPage;
  options.sortBy = options.sortBy || this.state.sortBy;
  options.sortOrder = options.sortOrder || this.state.sortOrder;
  options.filterRating = options.filterRating !== undefined ? options.filterRating : this.state.filterRating;
  
  // Update state
  this.state.currentPage = options.page;
  this.state.sortBy = options.sortBy;
  this.state.sortOrder = options.sortOrder;
  this.state.filterRating = options.filterRating;
  
  return new Promise(function(resolve, reject) {
    try {
      // Get reviews from marketplace core
      self.marketplaceCore.getReviewsForTentacle(tentacleId, options)
        .then(function(reviewsData) {
          // Update state
          self.state.reviews[tentacleId] = reviewsData.reviews;
          self.state.totalPages = reviewsData.totalPages;
          self.state.isLoading = false;
          
          // Emit reviews loaded event
          self.events.emit('reviews:loaded', {
            tentacleId: tentacleId,
            reviews: reviewsData.reviews,
            totalReviews: reviewsData.totalReviews,
            averageRating: reviewsData.averageRating,
            ratingDistribution: reviewsData.ratingDistribution,
            currentPage: self.state.currentPage,
            totalPages: self.state.totalPages,
            options: options
          });
          
          // Render reviews if container is available
          if (self.container && process.env.NODE_ENV !== 'test') {
            self._renderReviews(tentacleId);
          }
          
          self.logger.info("Loaded " + reviewsData.reviews.length + " reviews for tentacle " + tentacleId);
          resolve(reviewsData);
        })
        .catch(function(error) {
          self.logger.error("Failed to load reviews for tentacle " + tentacleId, error);
          self.state.error = error.message;
          self.state.isLoading = false;
          reject(error);
        });
    } catch (error) {
      self.logger.error("Failed to load reviews for tentacle " + tentacleId, error);
      self.state.error = error.message;
      self.state.isLoading = false;
      reject(error);
    }
  });
};

/**
 * Get user's review for a tentacle
 * @param {string} tentacleId - Tentacle ID
 * @param {string} userId - User ID
 * @returns {Promise<Object>} - Promise resolving to user's review
 */
ReviewAndRatingSystem.prototype.getUserReview = function(tentacleId, userId) {
  var self = this;
  
  this.logger.info("Getting user review for tentacle: " + tentacleId + ", user: " + userId);
  
  return new Promise(function(resolve, reject) {
    try {
      // Get user review from marketplace core
      self.marketplaceCore.getUserReviewForTentacle(tentacleId, userId)
        .then(function(review) {
          // Update state
          if (review) {
            if (!self.state.userReviews[userId]) {
              self.state.userReviews[userId] = {};
            }
            self.state.userReviews[userId][tentacleId] = review;
          }
          
          self.logger.info("Got user review for tentacle " + tentacleId + ", user " + userId);
          resolve(review);
        })
        .catch(function(error) {
          self.logger.error("Failed to get user review for tentacle " + tentacleId + ", user " + userId, error);
          reject(error);
        });
    } catch (error) {
      self.logger.error("Failed to get user review for tentacle " + tentacleId + ", user " + userId, error);
      reject(error);
    }
  });
};

/**
 * Submit a review for a tentacle
 * @param {string} tentacleId - Tentacle ID
 * @param {Object} reviewData - Review data
 * @param {string} reviewData.userId - User ID
 * @param {number} reviewData.rating - Rating (1-5)
 * @param {string} reviewData.title - Review title
 * @param {string} reviewData.content - Review content
 * @param {boolean} reviewData.isAnonymous - Whether the review is anonymous
 * @returns {Promise<Object>} - Promise resolving to submitted review
 */
ReviewAndRatingSystem.prototype.submitReview = function(tentacleId, reviewData) {
  var self = this;
  
  this.logger.info("Submitting review for tentacle: " + tentacleId);
  
  return new Promise(function(resolve, reject) {
    try {
      // Validate review data
      if (!reviewData.userId && !self.config.enableAnonymousReviews) {
        throw new Error("User ID is required for reviews");
      }
      
      if (!reviewData.rating || reviewData.rating < 1 || reviewData.rating > self.config.ratingScale) {
        throw new Error("Rating must be between 1 and " + self.config.ratingScale);
      }
      
      if (!reviewData.title) {
        throw new Error("Review title is required");
      }
      
      if (!reviewData.content) {
        throw new Error("Review content is required");
      }
      
      if (reviewData.content.length < self.config.minReviewLength) {
        throw new Error("Review content must be at least " + self.config.minReviewLength + " characters");
      }
      
      if (reviewData.content.length > self.config.maxReviewLength) {
        throw new Error("Review content must be at most " + self.config.maxReviewLength + " characters");
      }
      
      // Submit review to marketplace core
      self.marketplaceCore.submitReviewForTentacle(tentacleId, reviewData)
        .then(function(review) {
          // Update state
          if (reviewData.userId) {
            if (!self.state.userReviews[reviewData.userId]) {
              self.state.userReviews[reviewData.userId] = {};
            }
            self.state.userReviews[reviewData.userId][tentacleId] = review;
          }
          
          // Reload reviews
          return self.loadReviews(tentacleId)
            .then(function() {
              // Emit review submitted event
              self.events.emit('review:submitted', {
                tentacleId: tentacleId,
                review: review
              });
              
              self.logger.info("Review submitted for tentacle " + tentacleId);
              resolve(review);
            });
        })
        .catch(function(error) {
          self.logger.error("Failed to submit review for tentacle " + tentacleId, error);
          reject(error);
        });
    } catch (error) {
      self.logger.error("Failed to submit review for tentacle " + tentacleId, error);
      reject(error);
    }
  });
};

/**
 * Update a review for a tentacle
 * @param {string} tentacleId - Tentacle ID
 * @param {string} reviewId - Review ID
 * @param {Object} reviewData - Review data
 * @param {number} reviewData.rating - Rating (1-5)
 * @param {string} reviewData.title - Review title
 * @param {string} reviewData.content - Review content
 * @param {boolean} reviewData.isAnonymous - Whether the review is anonymous
 * @returns {Promise<Object>} - Promise resolving to updated review
 */
ReviewAndRatingSystem.prototype.updateReview = function(tentacleId, reviewId, reviewData) {
  var self = this;
  
  this.logger.info("Updating review " + reviewId + " for tentacle: " + tentacleId);
  
  return new Promise(function(resolve, reject) {
    try {
      // Validate review data
      if (!reviewData.rating || reviewData.rating < 1 || reviewData.rating > self.config.ratingScale) {
        throw new Error("Rating must be between 1 and " + self.config.ratingScale);
      }
      
      if (!reviewData.title) {
        throw new Error("Review title is required");
      }
      
      if (!reviewData.content) {
        throw new Error("Review content is required");
      }
      
      if (reviewData.content.length < self.config.minReviewLength) {
        throw new Error("Review content must be at least " + self.config.minReviewLength + " characters");
      }
      
      if (reviewData.content.length > self.config.maxReviewLength) {
        throw new Error("Review content must be at most " + self.config.maxReviewLength + " characters");
      }
      
      // Update review in marketplace core
      self.marketplaceCore.updateReviewForTentacle(tentacleId, reviewId, reviewData)
        .then(function(review) {
          // Update state
          if (review.userId) {
            if (!self.state.userReviews[review.userId]) {
              self.state.userReviews[review.userId] = {};
            }
            self.state.userReviews[review.userId][tentacleId] = review;
          }
          
          // Reload reviews
          return self.loadReviews(tentacleId)
            .then(function() {
              // Emit review updated event
              self.events.emit('review:updated', {
                tentacleId: tentacleId,
                reviewId: reviewId,
                review: review
              });
              
              self.logger.info("Review " + reviewId + " updated for tentacle " + tentacleId);
              resolve(review);
            });
        })
        .catch(function(error) {
          self.logger.error("Failed to update review " + reviewId + " for tentacle " + tentacleId, error);
          reject(error);
        });
    } catch (error) {
      self.logger.error("Failed to update review " + reviewId + " for tentacle " + tentacleId, error);
      reject(error);
    }
  });
};

/**
 * Delete a review for a tentacle
 * @param {string} tentacleId - Tentacle ID
 * @param {string} reviewId - Review ID
 * @returns {Promise<boolean>} - Promise resolving to true if deletion was successful
 */
ReviewAndRatingSystem.prototype.deleteReview = function(tentacleId, reviewId) {
  var self = this;
  
  this.logger.info("Deleting review " + reviewId + " for tentacle: " + tentacleId);
  
  return new Promise(function(resolve, reject) {
    try {
      // Delete review in marketplace core
      self.marketplaceCore.deleteReviewForTentacle(tentacleId, reviewId)
        .then(function(result) {
          // Reload reviews
          return self.loadReviews(tentacleId)
            .then(function() {
              // Emit review deleted event
              self.events.emit('review:deleted', {
                tentacleId: tentacleId,
                reviewId: reviewId
              });
              
              self.logger.info("Review " + reviewId + " deleted for tentacle " + tentacleId);
              resolve(true);
            });
        })
        .catch(function(error) {
          self.logger.error("Failed to delete review " + reviewId + " for tentacle " + tentacleId, error);
          reject(error);
        });
    } catch (error) {
      self.logger.error("Failed to delete review " + reviewId + " for tentacle " + tentacleId, error);
      reject(error);
    }
  });
};

/**
 * Mark a review as helpful
 * @param {string} tentacleId - Tentacle ID
 * @param {string} reviewId - Review ID
 * @param {string} userId - User ID
 * @returns {Promise<Object>} - Promise resolving to updated review
 */
ReviewAndRatingSystem.prototype.markReviewAsHelpful = function(tentacleId, reviewId, userId) {
  var self = this;
  
  this.logger.info("Marking review " + reviewId + " as helpful by user " + userId);
  
  return new Promise(function(resolve, reject) {
    try {
      // Mark review as helpful in marketplace core
      self.marketplaceCore.markReviewAsHelpful(tentacleId, reviewId, userId)
        .then(function(review) {
          // Update reviews in state
          if (self.state.reviews[tentacleId]) {
            for (var i = 0; i < self.state.reviews[tentacleId].length; i++) {
              if (self.state.reviews[tentacleId][i].id === reviewId) {
                self.state.reviews[tentacleId][i] = review;
                break;
              }
            }
          }
          
          // Emit review marked as helpful event
          self.events.emit('review:helpful', {
            tentacleId: tentacleId,
            reviewId: reviewId,
            userId: userId,
            review: review
          });
          
          // Update UI if container is available
          if (self.container && process.env.NODE_ENV !== 'test') {
            self._updateReviewHelpfulness(tentacleId, reviewId, review);
          }
          
          self.logger.info("Review " + reviewId + " marked as helpful by user " + userId);
          resolve(review);
        })
        .catch(function(error) {
          self.logger.error("Failed to mark review " + reviewId + " as helpful", error);
          reject(error);
        });
    } catch (error) {
      self.logger.error("Failed to mark review " + reviewId + " as helpful", error);
      reject(error);
    }
  });
};

/**
 * Mark a review as not helpful
 * @param {string} tentacleId - Tentacle ID
 * @param {string} reviewId - Review ID
 * @param {string} userId - User ID
 * @returns {Promise<Object>} - Promise resolving to updated review
 */
ReviewAndRatingSystem.prototype.markReviewAsNotHelpful = function(tentacleId, reviewId, userId) {
  var self = this;
  
  this.logger.info("Marking review " + reviewId + " as not helpful by user " + userId);
  
  return new Promise(function(resolve, reject) {
    try {
      // Mark review as not helpful in marketplace core
      self.marketplaceCore.markReviewAsNotHelpful(tentacleId, reviewId, userId)
        .then(function(review) {
          // Update reviews in state
          if (self.state.reviews[tentacleId]) {
            for (var i = 0; i < self.state.reviews[tentacleId].length; i++) {
              if (self.state.reviews[tentacleId][i].id === reviewId) {
                self.state.reviews[tentacleId][i] = review;
                break;
              }
            }
          }
          
          // Emit review marked as not helpful event
          self.events.emit('review:not-helpful', {
            tentacleId: tentacleId,
            reviewId: reviewId,
            userId: userId,
            review: review
          });
          
          // Update UI if container is available
          if (self.container && process.env.NODE_ENV !== 'test') {
            self._updateReviewHelpfulness(tentacleId, reviewId, review);
          }
          
          self.logger.info("Review " + reviewId + " marked as not helpful by user " + userId);
          resolve(review);
        })
        .catch(function(error) {
          self.logger.error("Failed to mark review " + reviewId + " as not helpful", error);
          reject(error);
        });
    } catch (error) {
      self.logger.error("Failed to mark review " + reviewId + " as not helpful", error);
      reject(error);
    }
  });
};

/**
 * Report a review for moderation
 * @param {string} tentacleId - Tentacle ID
 * @param {string} reviewId - Review ID
 * @param {string} userId - User ID
 * @param {string} reason - Reason for reporting
 * @returns {Promise<boolean>} - Promise resolving to true if report was successful
 */
ReviewAndRatingSystem.prototype.reportReview = function(tentacleId, reviewId, userId, reason) {
  var self = this;
  
  this.logger.info("Reporting review " + reviewId + " by user " + userId);
  
  return new Promise(function(resolve, reject) {
    try {
      // Validate reason
      if (!reason) {
        throw new Error("Reason is required for reporting a review");
      }
      
      // Report review in marketplace core
      self.marketplaceCore.reportReview(tentacleId, reviewId, userId, reason)
        .then(function(result) {
          // Emit review reported event
          self.events.emit('review:reported', {
            tentacleId: tentacleId,
            reviewId: reviewId,
            userId: userId,
            reason: reason
          });
          
          self.logger.info("Review " + reviewId + " reported by user " + userId);
          resolve(true);
        })
        .catch(function(error) {
          self.logger.error("Failed to report review " + reviewId, error);
          reject(error);
        });
    } catch (error) {
      self.logger.error("Failed to report review " + reviewId, error);
      reject(error);
    }
  });
};

/**
 * Get rating summary for a tentacle
 * @param {string} tentacleId - Tentacle ID
 * @returns {Promise<Object>} - Promise resolving to rating summary
 */
ReviewAndRatingSystem.prototype.getRatingSummary = function(tentacleId) {
  var self = this;
  
  this.logger.info("Getting rating summary for tentacle: " + tentacleId);
  
  return new Promise(function(resolve, reject) {
    try {
      // Get rating summary from marketplace core
      self.marketplaceCore.getRatingSummaryForTentacle(tentacleId)
        .then(function(summary) {
          // Emit rating summary loaded event
          self.events.emit('rating:summary:loaded', {
            tentacleId: tentacleId,
            summary: summary
          });
          
          // Render rating summary if container is available
          if (self.container && process.env.NODE_ENV !== 'test') {
            self._renderRatingSummary(tentacleId, summary);
          }
          
          self.logger.info("Got rating summary for tentacle " + tentacleId);
          resolve(summary);
        })
        .catch(function(error) {
          self.logger.error("Failed to get rating summary for tentacle " + tentacleId, error);
          reject(error);
        });
    } catch (error) {
      self.logger.error("Failed to get rating summary for tentacle " + tentacleId, error);
      reject(error);
    }
  });
};

/**
 * Set up event listeners
 * @private
 */
ReviewAndRatingSystem.prototype._setupEventListeners = function() {
  var self = this;
  
  this.logger.info("Setting up event listeners");
  
  // Listen for marketplace core events
  if (this.marketplaceCore && this.marketplaceCore.events) {
    this.marketplaceCore.events.on("tentacle:selected", function(event) {
      self._handleTentacleSelected(event);
    });
    
    this.marketplaceCore.events.on("review:added", function(event) {
      self._handleReviewAdded(event);
    });
    
    this.marketplaceCore.events.on("review:updated", function(event) {
      self._handleReviewUpdated(event);
    });
    
    this.marketplaceCore.events.on("review:deleted", function(event) {
      self._handleReviewDeleted(event);
    });
  }
  
  // Set up UI event listeners if container is available
  if (this.container && process.env.NODE_ENV !== 'test') {
    // Sort dropdown
    var sortDropdown = this.container.querySelector('.review-sort-dropdown');
    if (sortDropdown) {
      sortDropdown.addEventListener('change', function(event) {
        self._handleSortChange(event);
      });
    }
    
    // Filter buttons
    var filterButtons = this.container.querySelectorAll('.review-filter-button');
    for (var i = 0; i < filterButtons.length; i++) {
      var button = filterButtons[i];
      button.addEventListener('click', function(event) {
        self._handleFilterClick(event);
      });
    }
    
    // Pagination buttons
    var paginationButtons = this.container.querySelectorAll('.review-pagination-button');
    for (var j = 0; j < paginationButtons.length; j++) {
      var paginationButton = paginationButtons[j];
      paginationButton.addEventListener('click', function(event) {
        self._handlePaginationClick(event);
      });
    }
    
    // Submit review button
    var submitButton = this.container.querySelector('.review-submit-button');
    if (submitButton) {
      submitButton.addEventListener('click', function(event) {
        self._handleSubmitButtonClick(event);
      });
    }
  }
  
  this.logger.info("Event listeners set up");
};

/**
 * Set up UI layout
 * @private
 */
ReviewAndRatingSystem.prototype._setupUILayout = function() {
  var self = this;
  
  this.logger.info("Setting up UI layout");
  
  // Create review system container
  var reviewContainer = document.createElement('div');
  reviewContainer.className = 'review-system-container';
  
  // Create review header
  var reviewHeader = document.createElement('div');
  reviewHeader.className = 'review-header';
  
  // Create review title
  var reviewTitle = document.createElement('h3');
  reviewTitle.className = 'review-title';
  reviewTitle.textContent = 'Reviews & Ratings';
  
  // Create review summary container
  var reviewSummary = document.createElement('div');
  reviewSummary.className = 'review-summary';
  
  // Create review actions
  var reviewActions = document.createElement('div');
  reviewActions.className = 'review-actions';
  
  // Create sort dropdown
  var sortContainer = document.createElement('div');
  sortContainer.className = 'review-sort-container';
  
  var sortLabel = document.createElement('label');
  sortLabel.textContent = 'Sort by: ';
  sortLabel.setAttribute('for', 'review-sort-dropdown');
  
  var sortDropdown = document.createElement('select');
  sortDropdown.className = 'review-sort-dropdown';
  sortDropdown.id = 'review-sort-dropdown';
  
  var sortOptions = [
    { value: 'date-desc', text: 'Newest first' },
    { value: 'date-asc', text: 'Oldest first' },
    { value: 'rating-desc', text: 'Highest rating' },
    { value: 'rating-asc', text: 'Lowest rating' },
    { value: 'helpfulness-desc', text: 'Most helpful' }
  ];
  
  for (var i = 0; i < sortOptions.length; i++) {
    var option = document.createElement('option');
    option.value = sortOptions[i].value;
    option.textContent = sortOptions[i].text;
    sortDropdown.appendChild(option);
  }
  
  sortContainer.appendChild(sortLabel);
  sortContainer.appendChild(sortDropdown);
  
  // Create filter buttons
  var filterContainer = document.createElement('div');
  filterContainer.className = 'review-filter-container';
  
  var filterLabel = document.createElement('span');
  filterLabel.textContent = 'Filter: ';
  
  filterContainer.appendChild(filterLabel);
  
  for (var j = 0; j <= this.config.ratingScale; j++) {
    var filterButton = document.createElement('button');
    filterButton.className = 'review-filter-button';
    filterButton.dataset.rating = j;
    
    if (j === 0) {
      filterButton.textContent = 'All';
      filterButton.classList.add('active');
    } else {
      filterButton.textContent = j + ' ' + (j === 1 ? 'Star' : 'Stars');
    }
    
    filterContainer.appendChild(filterButton);
  }
  
  // Create submit review button
  var submitButton = document.createElement('button');
  submitButton.className = 'review-submit-button';
  submitButton.textContent = 'Write a Review';
  
  // Add elements to review actions
  reviewActions.appendChild(sortContainer);
  reviewActions.appendChild(filterContainer);
  reviewActions.appendChild(submitButton);
  
  // Add title and actions to header
  reviewHeader.appendChild(reviewTitle);
  reviewHeader.appendChild(reviewActions);
  
  // Create review list container
  var reviewList = document.createElement('div');
  reviewList.className = 'review-list';
  
  // Create review pagination
  var reviewPagination = document.createElement('div');
  reviewPagination.className = 'review-pagination';
  
  // Add elements to container
  reviewContainer.appendChild(reviewHeader);
  reviewContainer.appendChild(reviewSummary);
  reviewContainer.appendChild(reviewList);
  reviewContainer.appendChild(reviewPagination);
  
  // Add container to main container
  this.container.appendChild(reviewContainer);
  
  this.logger.info("UI layout set up");
};

/**
 * Render reviews for a tentacle
 * @param {string} tentacleId - Tentacle ID
 * @private
 */
ReviewAndRatingSystem.prototype._renderReviews = function(tentacleId) {
  var self = this;
  
  this.logger.info("Rendering reviews for tentacle: " + tentacleId);
  
  var reviewList = this.container.querySelector('.review-list');
  
  if (!reviewList) {
    this.logger.error("Review list container not found");
    return;
  }
  
  // Clear existing content
  reviewList.innerHTML = '';
  
  // Get reviews for tentacle
  var reviews = this.state.reviews[tentacleId] || [];
  
  if (reviews.length === 0) {
    // Create empty state
    var emptyState = document.createElement('div');
    emptyState.className = 'review-empty-state';
    
    var emptyStateMessage = document.createElement('p');
    emptyStateMessage.textContent = 'No reviews yet. Be the first to review this tentacle!';
    
    emptyState.appendChild(emptyStateMessage);
    reviewList.appendChild(emptyState);
    
    this.logger.info("No reviews to render for tentacle " + tentacleId);
    return;
  }
  
  // Create review items
  for (var i = 0; i < reviews.length; i++) {
    var review = reviews[i];
    
    // Create review item
    var reviewItem = document.createElement('div');
    reviewItem.className = 'review-item';
    reviewItem.dataset.reviewId = review.id;
    
    // Create review header
    var reviewHeader = document.createElement('div');
    reviewHeader.className = 'review-item-header';
    
    // Create review author
    var reviewAuthor = document.createElement('div');
    reviewAuthor.className = 'review-author';
    
    var authorName = document.createElement('span');
    authorName.className = 'review-author-name';
    authorName.textContent = review.isAnonymous ? 'Anonymous' : review.userName;
    
    var verifiedBadge = null;
    if (review.isVerifiedPurchase) {
      verifiedBadge = document.createElement('span');
      verifiedBadge.className = 'review-verified-badge';
      verifiedBadge.textContent = 'Verified Purchase';
    }
    
    reviewAuthor.appendChild(authorName);
    if (verifiedBadge) {
      reviewAuthor.appendChild(verifiedBadge);
    }
    
    // Create review rating
    var reviewRating = document.createElement('div');
    reviewRating.className = 'review-rating';
    
    for (var j = 1; j <= this.config.ratingScale; j++) {
      var star = document.createElement('span');
      star.className = 'review-star';
      
      if (j <= review.rating) {
        star.classList.add('filled');
        star.textContent = '★';
      } else {
        star.textContent = '☆';
      }
      
      reviewRating.appendChild(star);
    }
    
    // Create review date
    var reviewDate = document.createElement('div');
    reviewDate.className = 'review-date';
    reviewDate.textContent = new Date(review.date).toLocaleDateString();
    
    // Add elements to review header
    reviewHeader.appendChild(reviewAuthor);
    reviewHeader.appendChild(reviewRating);
    reviewHeader.appendChild(reviewDate);
    
    // Create review content
    var reviewContent = document.createElement('div');
    reviewContent.className = 'review-content';
    
    // Create review title
    var reviewTitle = document.createElement('h4');
    reviewTitle.className = 'review-item-title';
    reviewTitle.textContent = review.title;
    
    // Create review text
    var reviewText = document.createElement('p');
    reviewText.className = 'review-text';
    reviewText.textContent = review.content;
    
    // Add elements to review content
    reviewContent.appendChild(reviewTitle);
    reviewContent.appendChild(reviewText);
    
    // Create review footer
    var reviewFooter = document.createElement('div');
    reviewFooter.className = 'review-item-footer';
    
    // Create helpfulness section
    var helpfulnessSection = document.createElement('div');
    helpfulnessSection.className = 'review-helpfulness';
    
    var helpfulnessText = document.createElement('span');
    helpfulnessText.className = 'review-helpfulness-text';
    helpfulnessText.textContent = 'Was this review helpful?';
    
    var helpfulButton = document.createElement('button');
    helpfulButton.className = 'review-helpful-button';
    helpfulButton.dataset.reviewId = review.id;
    helpfulButton.textContent = 'Yes (' + (review.helpfulCount || 0) + ')';
    
    var notHelpfulButton = document.createElement('button');
    notHelpfulButton.className = 'review-not-helpful-button';
    notHelpfulButton.dataset.reviewId = review.id;
    notHelpfulButton.textContent = 'No (' + (review.notHelpfulCount || 0) + ')';
    
    helpfulnessSection.appendChild(helpfulnessText);
    helpfulnessSection.appendChild(helpfulButton);
    helpfulnessSection.appendChild(notHelpfulButton);
    
    // Create report button
    var reportButton = document.createElement('button');
    reportButton.className = 'review-report-button';
    reportButton.dataset.reviewId = review.id;
    reportButton.textContent = 'Report';
    
    // Add elements to review footer
    reviewFooter.appendChild(helpfulnessSection);
    reviewFooter.appendChild(reportButton);
    
    // Add elements to review item
    reviewItem.appendChild(reviewHeader);
    reviewItem.appendChild(reviewContent);
    reviewItem.appendChild(reviewFooter);
    
    // Add review item to list
    reviewList.appendChild(reviewItem);
    
    // Add event listeners
    helpfulButton.addEventListener('click', function(event) {
      var reviewId = this.dataset.reviewId;
      self._handleHelpfulButtonClick(tentacleId, reviewId);
    });
    
    notHelpfulButton.addEventListener('click', function(event) {
      var reviewId = this.dataset.reviewId;
      self._handleNotHelpfulButtonClick(tentacleId, reviewId);
    });
    
    reportButton.addEventListener('click', function(event) {
      var reviewId = this.dataset.reviewId;
      self._handleReportButtonClick(tentacleId, reviewId);
    });
  }
  
  // Update pagination
  this._updatePagination(tentacleId);
  
  this.logger.info("Rendered " + reviews.length + " reviews for tentacle " + tentacleId);
};

/**
 * Render rating summary for a tentacle
 * @param {string} tentacleId - Tentacle ID
 * @param {Object} summary - Rating summary
 * @private
 */
ReviewAndRatingSystem.prototype._renderRatingSummary = function(tentacleId, summary) {
  var self = this;
  
  this.logger.info("Rendering rating summary for tentacle: " + tentacleId);
  
  var summaryContainer = this.container.querySelector('.review-summary');
  
  if (!summaryContainer) {
    this.logger.error("Review summary container not found");
    return;
  }
  
  // Clear existing content
  summaryContainer.innerHTML = '';
  
  // Create summary content
  var summaryContent = document.createElement('div');
  summaryContent.className = 'review-summary-content';
  
  // Create average rating
  var averageRating = document.createElement('div');
  averageRating.className = 'review-average-rating';
  
  var averageValue = document.createElement('span');
  averageValue.className = 'review-average-value';
  averageValue.textContent = summary.averageRating.toFixed(1);
  
  var averageStars = document.createElement('div');
  averageStars.className = 'review-average-stars';
  
  for (var i = 1; i <= this.config.ratingScale; i++) {
    var star = document.createElement('span');
    star.className = 'review-star';
    
    if (i <= Math.round(summary.averageRating)) {
      star.classList.add('filled');
      star.textContent = '★';
    } else {
      star.textContent = '☆';
    }
    
    averageStars.appendChild(star);
  }
  
  var reviewCount = document.createElement('span');
  reviewCount.className = 'review-count';
  reviewCount.textContent = summary.totalReviews + ' ' + (summary.totalReviews === 1 ? 'review' : 'reviews');
  
  averageRating.appendChild(averageValue);
  averageRating.appendChild(averageStars);
  averageRating.appendChild(reviewCount);
  
  // Create rating distribution
  var ratingDistribution = document.createElement('div');
  ratingDistribution.className = 'review-rating-distribution';
  
  for (var j = this.config.ratingScale; j >= 1; j--) {
    var ratingBar = document.createElement('div');
    ratingBar.className = 'review-rating-bar';
    
    var ratingLabel = document.createElement('span');
    ratingLabel.className = 'review-rating-label';
    ratingLabel.textContent = j + ' ' + (j === 1 ? 'Star' : 'Stars');
    
    var ratingProgress = document.createElement('div');
    ratingProgress.className = 'review-rating-progress';
    
    var ratingCount = summary.ratingDistribution[j] || 0;
    var ratingPercentage = summary.totalReviews > 0 ? (ratingCount / summary.totalReviews) * 100 : 0;
    
    var ratingFill = document.createElement('div');
    ratingFill.className = 'review-rating-fill';
    ratingFill.style.width = ratingPercentage + '%';
    
    var ratingCount = document.createElement('span');
    ratingCount.className = 'review-rating-count';
    ratingCount.textContent = summary.ratingDistribution[j] || 0;
    
    ratingProgress.appendChild(ratingFill);
    
    ratingBar.appendChild(ratingLabel);
    ratingBar.appendChild(ratingProgress);
    ratingBar.appendChild(ratingCount);
    
    ratingDistribution.appendChild(ratingBar);
  }
  
  // Add elements to summary content
  summaryContent.appendChild(averageRating);
  summaryContent.appendChild(ratingDistribution);
  
  // Add summary content to container
  summaryContainer.appendChild(summaryContent);
  
  this.logger.info("Rating summary rendered for tentacle " + tentacleId);
};

/**
 * Update pagination
 * @param {string} tentacleId - Tentacle ID
 * @private
 */
ReviewAndRatingSystem.prototype._updatePagination = function(tentacleId) {
  var self = this;
  
  this.logger.info("Updating pagination for tentacle: " + tentacleId);
  
  var paginationContainer = this.container.querySelector('.review-pagination');
  
  if (!paginationContainer) {
    this.logger.error("Pagination container not found");
    return;
  }
  
  // Clear existing content
  paginationContainer.innerHTML = '';
  
  // If only one page, don't show pagination
  if (this.state.totalPages <= 1) {
    return;
  }
  
  // Create pagination content
  var paginationContent = document.createElement('div');
  paginationContent.className = 'review-pagination-content';
  
  // Create previous button
  var prevButton = document.createElement('button');
  prevButton.className = 'review-pagination-button review-pagination-prev';
  prevButton.textContent = 'Previous';
  prevButton.disabled = this.state.currentPage <= 1;
  prevButton.dataset.page = this.state.currentPage - 1;
  
  // Create page buttons
  var pageButtonsContainer = document.createElement('div');
  pageButtonsContainer.className = 'review-pagination-pages';
  
  var startPage = Math.max(1, this.state.currentPage - 2);
  var endPage = Math.min(this.state.totalPages, startPage + 4);
  
  if (endPage - startPage < 4) {
    startPage = Math.max(1, endPage - 4);
  }
  
  for (var i = startPage; i <= endPage; i++) {
    var pageButton = document.createElement('button');
    pageButton.className = 'review-pagination-button review-pagination-page';
    pageButton.textContent = i;
    pageButton.dataset.page = i;
    
    if (i === this.state.currentPage) {
      pageButton.classList.add('active');
    }
    
    pageButtonsContainer.appendChild(pageButton);
  }
  
  // Create next button
  var nextButton = document.createElement('button');
  nextButton.className = 'review-pagination-button review-pagination-next';
  nextButton.textContent = 'Next';
  nextButton.disabled = this.state.currentPage >= this.state.totalPages;
  nextButton.dataset.page = this.state.currentPage + 1;
  
  // Add elements to pagination content
  paginationContent.appendChild(prevButton);
  paginationContent.appendChild(pageButtonsContainer);
  paginationContent.appendChild(nextButton);
  
  // Add pagination content to container
  paginationContainer.appendChild(paginationContent);
  
  // Add event listeners
  var paginationButtons = paginationContainer.querySelectorAll('.review-pagination-button');
  for (var j = 0; j < paginationButtons.length; j++) {
    var button = paginationButtons[j];
    button.addEventListener('click', function(event) {
      if (!this.disabled) {
        var page = parseInt(this.dataset.page);
        self._handlePaginationClick(tentacleId, page);
      }
    });
  }
  
  this.logger.info("Pagination updated for tentacle " + tentacleId);
};

/**
 * Update review helpfulness UI
 * @param {string} tentacleId - Tentacle ID
 * @param {string} reviewId - Review ID
 * @param {Object} review - Updated review
 * @private
 */
ReviewAndRatingSystem.prototype._updateReviewHelpfulness = function(tentacleId, reviewId, review) {
  this.logger.info("Updating helpfulness UI for review: " + reviewId);
  
  var reviewItem = this.container.querySelector('.review-item[data-review-id="' + reviewId + '"]');
  
  if (!reviewItem) {
    this.logger.error("Review item not found for review " + reviewId);
    return;
  }
  
  var helpfulButton = reviewItem.querySelector('.review-helpful-button');
  var notHelpfulButton = reviewItem.querySelector('.review-not-helpful-button');
  
  if (helpfulButton) {
    helpfulButton.textContent = 'Yes (' + (review.helpfulCount || 0) + ')';
  }
  
  if (notHelpfulButton) {
    notHelpfulButton.textContent = 'No (' + (review.notHelpfulCount || 0) + ')';
  }
  
  this.logger.info("Helpfulness UI updated for review " + reviewId);
};

/**
 * Handle tentacle selected event
 * @param {Object} event - Tentacle selected event
 * @private
 */
ReviewAndRatingSystem.prototype._handleTentacleSelected = function(event) {
  var self = this;
  
  this.logger.info("Tentacle selected: " + event.tentacleId);
  
  // Update state
  this.state.selectedTentacle = event.tentacleId;
  
  // Load rating summary
  this.getRatingSummary(event.tentacleId)
    .catch(function(error) {
      self.logger.error("Failed to load rating summary for tentacle " + event.tentacleId, error);
    });
  
  // Load reviews
  this.loadReviews(event.tentacleId)
    .catch(function(error) {
      self.logger.error("Failed to load reviews for tentacle " + event.tentacleId, error);
    });
};

/**
 * Handle review added event
 * @param {Object} event - Review added event
 * @private
 */
ReviewAndRatingSystem.prototype._handleReviewAdded = function(event) {
  var self = this;
  
  this.logger.info("Review added for tentacle: " + event.tentacleId);
  
  // Reload reviews if tentacle is selected
  if (this.state.selectedTentacle === event.tentacleId) {
    // Load rating summary
    this.getRatingSummary(event.tentacleId)
      .catch(function(error) {
        self.logger.error("Failed to load rating summary for tentacle " + event.tentacleId, error);
      });
    
    // Load reviews
    this.loadReviews(event.tentacleId)
      .catch(function(error) {
        self.logger.error("Failed to load reviews for tentacle " + event.tentacleId, error);
      });
  }
};

/**
 * Handle review updated event
 * @param {Object} event - Review updated event
 * @private
 */
ReviewAndRatingSystem.prototype._handleReviewUpdated = function(event) {
  var self = this;
  
  this.logger.info("Review updated for tentacle: " + event.tentacleId);
  
  // Reload reviews if tentacle is selected
  if (this.state.selectedTentacle === event.tentacleId) {
    // Load rating summary
    this.getRatingSummary(event.tentacleId)
      .catch(function(error) {
        self.logger.error("Failed to load rating summary for tentacle " + event.tentacleId, error);
      });
    
    // Load reviews
    this.loadReviews(event.tentacleId)
      .catch(function(error) {
        self.logger.error("Failed to load reviews for tentacle " + event.tentacleId, error);
      });
  }
};

/**
 * Handle review deleted event
 * @param {Object} event - Review deleted event
 * @private
 */
ReviewAndRatingSystem.prototype._handleReviewDeleted = function(event) {
  var self = this;
  
  this.logger.info("Review deleted for tentacle: " + event.tentacleId);
  
  // Reload reviews if tentacle is selected
  if (this.state.selectedTentacle === event.tentacleId) {
    // Load rating summary
    this.getRatingSummary(event.tentacleId)
      .catch(function(error) {
        self.logger.error("Failed to load rating summary for tentacle " + event.tentacleId, error);
      });
    
    // Load reviews
    this.loadReviews(event.tentacleId)
      .catch(function(error) {
        self.logger.error("Failed to load reviews for tentacle " + event.tentacleId, error);
      });
  }
};

/**
 * Handle sort change
 * @param {Event} event - Change event
 * @private
 */
ReviewAndRatingSystem.prototype._handleSortChange = function(event) {
  var self = this;
  
  this.logger.info("Sort changed: " + event.target.value);
  
  // Parse sort value
  var sortValue = event.target.value.split('-');
  var sortBy = sortValue[0];
  var sortOrder = sortValue[1];
  
  // Update state
  this.state.sortBy = sortBy;
  this.state.sortOrder = sortOrder;
  
  // Reload reviews if tentacle is selected
  if (this.state.selectedTentacle) {
    this.loadReviews(this.state.selectedTentacle, {
      sortBy: sortBy,
      sortOrder: sortOrder,
      page: 1 // Reset to first page
    }).catch(function(error) {
      self.logger.error("Failed to load reviews with new sort", error);
    });
  }
};

/**
 * Handle filter click
 * @param {Event} event - Click event
 * @private
 */
ReviewAndRatingSystem.prototype._handleFilterClick = function(event) {
  var self = this;
  
  var rating = parseInt(event.target.dataset.rating);
  
  this.logger.info("Filter clicked: " + rating);
  
  // Update active filter
  var filterButtons = this.container.querySelectorAll('.review-filter-button');
  for (var i = 0; i < filterButtons.length; i++) {
    filterButtons[i].classList.remove('active');
  }
  event.target.classList.add('active');
  
  // Update state
  this.state.filterRating = rating;
  
  // Reload reviews if tentacle is selected
  if (this.state.selectedTentacle) {
    this.loadReviews(this.state.selectedTentacle, {
      filterRating: rating,
      page: 1 // Reset to first page
    }).catch(function(error) {
      self.logger.error("Failed to load reviews with new filter", error);
    });
  }
};

/**
 * Handle pagination click
 * @param {string} tentacleId - Tentacle ID
 * @param {number} page - Page number
 * @private
 */
ReviewAndRatingSystem.prototype._handlePaginationClick = function(tentacleId, page) {
  var self = this;
  
  this.logger.info("Pagination clicked: page " + page);
  
  // Update state
  this.state.currentPage = page;
  
  // Reload reviews
  this.loadReviews(tentacleId, {
    page: page
  }).catch(function(error) {
    self.logger.error("Failed to load reviews for page " + page, error);
  });
};

/**
 * Handle submit button click
 * @param {Event} event - Click event
 * @private
 */
ReviewAndRatingSystem.prototype._handleSubmitButtonClick = function(event) {
  this.logger.info("Submit button clicked");
  
  // Emit submit review requested event
  this.events.emit('review:submit:requested', {
    tentacleId: this.state.selectedTentacle
  });
};

/**
 * Handle helpful button click
 * @param {string} tentacleId - Tentacle ID
 * @param {string} reviewId - Review ID
 * @private
 */
ReviewAndRatingSystem.prototype._handleHelpfulButtonClick = function(tentacleId, reviewId) {
  var self = this;
  
  this.logger.info("Helpful button clicked for review: " + reviewId);
  
  // Get current user ID
  this.marketplaceCore.getCurrentUser()
    .then(function(user) {
      if (!user) {
        // Emit login required event
        self.events.emit('login:required', {
          reason: 'mark-review-helpful',
          tentacleId: tentacleId,
          reviewId: reviewId
        });
        return;
      }
      
      // Mark review as helpful
      self.markReviewAsHelpful(tentacleId, reviewId, user.id)
        .catch(function(error) {
          self.logger.error("Failed to mark review as helpful", error);
        });
    })
    .catch(function(error) {
      self.logger.error("Failed to get current user", error);
    });
};

/**
 * Handle not helpful button click
 * @param {string} tentacleId - Tentacle ID
 * @param {string} reviewId - Review ID
 * @private
 */
ReviewAndRatingSystem.prototype._handleNotHelpfulButtonClick = function(tentacleId, reviewId) {
  var self = this;
  
  this.logger.info("Not helpful button clicked for review: " + reviewId);
  
  // Get current user ID
  this.marketplaceCore.getCurrentUser()
    .then(function(user) {
      if (!user) {
        // Emit login required event
        self.events.emit('login:required', {
          reason: 'mark-review-not-helpful',
          tentacleId: tentacleId,
          reviewId: reviewId
        });
        return;
      }
      
      // Mark review as not helpful
      self.markReviewAsNotHelpful(tentacleId, reviewId, user.id)
        .catch(function(error) {
          self.logger.error("Failed to mark review as not helpful", error);
        });
    })
    .catch(function(error) {
      self.logger.error("Failed to get current user", error);
    });
};

/**
 * Handle report button click
 * @param {string} tentacleId - Tentacle ID
 * @param {string} reviewId - Review ID
 * @private
 */
ReviewAndRatingSystem.prototype._handleReportButtonClick = function(tentacleId, reviewId) {
  var self = this;
  
  this.logger.info("Report button clicked for review: " + reviewId);
  
  // Get current user ID
  this.marketplaceCore.getCurrentUser()
    .then(function(user) {
      if (!user) {
        // Emit login required event
        self.events.emit('login:required', {
          reason: 'report-review',
          tentacleId: tentacleId,
          reviewId: reviewId
        });
        return;
      }
      
      // Emit report review requested event
      self.events.emit('review:report:requested', {
        tentacleId: tentacleId,
        reviewId: reviewId,
        userId: user.id
      });
    })
    .catch(function(error) {
      self.logger.error("Failed to get current user", error);
    });
};

/**
 * Get the status of the ReviewAndRatingSystem
 * @returns {Object} - Status object
 */
ReviewAndRatingSystem.prototype.getStatus = function() {
  return {
    initialized: this.initialized,
    selectedTentacle: this.state.selectedTentacle,
    currentPage: this.state.currentPage,
    totalPages: this.state.totalPages,
    sortBy: this.state.sortBy,
    sortOrder: this.state.sortOrder,
    filterRating: this.state.filterRating,
    isLoading: this.state.isLoading,
    error: this.state.error,
    enableAnonymousReviews: this.config.enableAnonymousReviews,
    requireVerifiedPurchase: this.config.requireVerifiedPurchase,
    moderationEnabled: this.config.moderationEnabled
  };
};

/**
 * Shutdown the ReviewAndRatingSystem
 * @returns {Promise<boolean>} - Promise resolving to true if shutdown was successful
 */
ReviewAndRatingSystem.prototype.shutdown = function() {
  var self = this;
  
  if (!this.initialized) {
    this.logger.warn("ReviewAndRatingSystem not initialized");
    return Promise.resolve(true);
  }
  
  this.logger.info("Shutting down ReviewAndRatingSystem");
  
  return new Promise(function(resolve, reject) {
    try {
      // Remove event listeners if container is available
      if (self.container && process.env.NODE_ENV !== 'test') {
        // Sort dropdown
        var sortDropdown = self.container.querySelector('.review-sort-dropdown');
        if (sortDropdown) {
          sortDropdown.removeEventListener('change', self._handleSortChange);
        }
        
        // Filter buttons
        var filterButtons = self.container.querySelectorAll('.review-filter-button');
        for (var i = 0; i < filterButtons.length; i++) {
          var button = filterButtons[i];
          button.removeEventListener('click', self._handleFilterClick);
        }
        
        // Pagination buttons
        var paginationButtons = self.container.querySelectorAll('.review-pagination-button');
        for (var j = 0; j < paginationButtons.length; j++) {
          var paginationButton = paginationButtons[j];
          paginationButton.removeEventListener('click', self._handlePaginationClick);
        }
        
        // Submit review button
        var submitButton = self.container.querySelector('.review-submit-button');
        if (submitButton) {
          submitButton.removeEventListener('click', self._handleSubmitButtonClick);
        }
      }
      
      self.initialized = false;
      self.logger.info("ReviewAndRatingSystem shutdown complete");
      resolve(true);
    } catch (error) {
      self.logger.error("Failed to shutdown ReviewAndRatingSystem", error);
      reject(error);
    }
  });
};

module.exports = { ReviewAndRatingSystem };
