/**
 * @fileoverview Tests for the ReviewAndRatingSystem component
 * 
 * @author Aideon AI Team
 * @version 1.0.0
 */

// Import dependencies
var ReviewAndRatingSystem = require('../../../../src/marketplace/ui/review/ReviewAndRatingSystem').ReviewAndRatingSystem;

// Create mock modules
jest.mock('../../../../core/logging/Logger', () => ({
  Logger: function() {
    return {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn()
    };
  }
}), { virtual: true });

jest.mock('../../../../core/events/EventEmitter', () => ({
  EventEmitter: function() {
    return {
      on: jest.fn(),
      off: jest.fn(),
      emit: jest.fn()
    };
  }
}), { virtual: true });

jest.mock('../../../../test/mocks/Logger', () => ({
  Logger: function() {
    return {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn()
    };
  }
}), { virtual: true });

jest.mock('../../../../test/mocks/EventEmitter', () => ({
  EventEmitter: function() {
    return {
      on: jest.fn(),
      off: jest.fn(),
      emit: jest.fn()
    };
  }
}), { virtual: true });

// Mock marketplace core
var mockMarketplaceCore = {
  initialized: true,
  initialize: jest.fn().mockResolvedValue(true),
  getReviewsForTentacle: jest.fn(),
  getUserReviewForTentacle: jest.fn(),
  submitReviewForTentacle: jest.fn(),
  updateReviewForTentacle: jest.fn(),
  deleteReviewForTentacle: jest.fn(),
  markReviewAsHelpful: jest.fn(),
  markReviewAsNotHelpful: jest.fn(),
  reportReview: jest.fn(),
  getRatingSummaryForTentacle: jest.fn(),
  getCurrentUser: jest.fn(),
  events: {
    on: jest.fn(),
    off: jest.fn(),
    emit: jest.fn()
  }
};

// Test data
var mockReviews = [
  {
    id: 'review1',
    tentacleId: 'tentacle1',
    userId: 'user1',
    userName: 'User One',
    rating: 5,
    title: 'Great tentacle!',
    content: 'This tentacle is amazing. It has greatly improved my productivity.',
    date: '2025-01-01T00:00:00.000Z',
    isVerifiedPurchase: true,
    isAnonymous: false,
    helpfulCount: 10,
    notHelpfulCount: 2
  },
  {
    id: 'review2',
    tentacleId: 'tentacle1',
    userId: 'user2',
    userName: 'User Two',
    rating: 3,
    title: 'Decent tentacle',
    content: 'This tentacle is okay. It has some good features but could be improved.',
    date: '2025-01-02T00:00:00.000Z',
    isVerifiedPurchase: true,
    isAnonymous: false,
    helpfulCount: 5,
    notHelpfulCount: 1
  }
];

var mockReviewsData = {
  reviews: mockReviews,
  totalReviews: 2,
  averageRating: 4.0,
  ratingDistribution: {
    1: 0,
    2: 0,
    3: 1,
    4: 0,
    5: 1
  },
  totalPages: 1
};

var mockRatingSummary = {
  tentacleId: 'tentacle1',
  averageRating: 4.0,
  totalReviews: 2,
  ratingDistribution: {
    1: 0,
    2: 0,
    3: 1,
    4: 0,
    5: 1
  }
};

var mockUser = {
  id: 'user1',
  name: 'User One',
  email: 'user1@example.com'
};

describe('ReviewAndRatingSystem', function() {
  var reviewAndRatingSystem;
  var mockContainer;
  
  beforeEach(function() {
    // Reset mocks
    jest.clearAllMocks();
    
    // Mock container
    mockContainer = {
      appendChild: jest.fn(),
      querySelector: jest.fn().mockReturnValue({
        innerHTML: '',
        appendChild: jest.fn()
      }),
      querySelectorAll: jest.fn().mockReturnValue([])
    };
    
    // Mock marketplace core responses
    mockMarketplaceCore.getReviewsForTentacle.mockResolvedValue(mockReviewsData);
    mockMarketplaceCore.getUserReviewForTentacle.mockResolvedValue(mockReviews[0]);
    mockMarketplaceCore.submitReviewForTentacle.mockResolvedValue(mockReviews[0]);
    mockMarketplaceCore.updateReviewForTentacle.mockResolvedValue(mockReviews[0]);
    mockMarketplaceCore.deleteReviewForTentacle.mockResolvedValue(true);
    mockMarketplaceCore.markReviewAsHelpful.mockResolvedValue(mockReviews[0]);
    mockMarketplaceCore.markReviewAsNotHelpful.mockResolvedValue(mockReviews[0]);
    mockMarketplaceCore.reportReview.mockResolvedValue(true);
    mockMarketplaceCore.getRatingSummaryForTentacle.mockResolvedValue(mockRatingSummary);
    mockMarketplaceCore.getCurrentUser.mockResolvedValue(mockUser);
    
    // Create instance
    reviewAndRatingSystem = new ReviewAndRatingSystem({
      container: mockContainer,
      marketplaceCore: mockMarketplaceCore,
      config: {
        enableAnonymousReviews: false,
        requireVerifiedPurchase: true,
        moderationEnabled: true,
        maxReviewLength: 2000,
        minReviewLength: 10,
        ratingScale: 5,
        reviewsPerPage: 10
      }
    });
  });
  
  describe('initialization', function() {
    test('should initialize successfully', function() {
      return expect(reviewAndRatingSystem.initialize()).resolves.toBe(true);
    });
    
    test('should set up event listeners during initialization', function() {
      return reviewAndRatingSystem.initialize().then(function() {
        expect(mockMarketplaceCore.events.on).toHaveBeenCalledWith('tentacle:selected', expect.any(Function));
        expect(mockMarketplaceCore.events.on).toHaveBeenCalledWith('review:added', expect.any(Function));
        expect(mockMarketplaceCore.events.on).toHaveBeenCalledWith('review:updated', expect.any(Function));
        expect(mockMarketplaceCore.events.on).toHaveBeenCalledWith('review:deleted', expect.any(Function));
      });
    });
    
    test('should fail initialization if marketplaceCore is missing', function() {
      reviewAndRatingSystem = new ReviewAndRatingSystem({
        container: mockContainer
      });
      
      return expect(reviewAndRatingSystem.initialize()).rejects.toThrow();
    });
  });
  
  describe('review operations', function() {
    beforeEach(function() {
      return reviewAndRatingSystem.initialize();
    });
    
    test('should load reviews for a tentacle', function() {
      return reviewAndRatingSystem.loadReviews('tentacle1').then(function(reviewsData) {
        expect(mockMarketplaceCore.getReviewsForTentacle).toHaveBeenCalledWith('tentacle1', expect.any(Object));
        expect(reviewsData).toEqual(mockReviewsData);
        expect(reviewAndRatingSystem.state.reviews['tentacle1']).toEqual(mockReviews);
        expect(reviewAndRatingSystem.events.emit).toHaveBeenCalledWith(
          'reviews:loaded',
          expect.objectContaining({
            tentacleId: 'tentacle1',
            reviews: mockReviews
          })
        );
      });
    });
    
    test('should get user review for a tentacle', function() {
      return reviewAndRatingSystem.getUserReview('tentacle1', 'user1').then(function(review) {
        expect(mockMarketplaceCore.getUserReviewForTentacle).toHaveBeenCalledWith('tentacle1', 'user1');
        expect(review).toEqual(mockReviews[0]);
        expect(reviewAndRatingSystem.state.userReviews['user1']['tentacle1']).toEqual(mockReviews[0]);
      });
    });
    
    test('should submit a review for a tentacle', function() {
      var reviewData = {
        userId: 'user1',
        rating: 5,
        title: 'Great tentacle!',
        content: 'This tentacle is amazing. It has greatly improved my productivity.'
      };
      
      return reviewAndRatingSystem.submitReview('tentacle1', reviewData).then(function(review) {
        expect(mockMarketplaceCore.submitReviewForTentacle).toHaveBeenCalledWith('tentacle1', reviewData);
        expect(mockMarketplaceCore.getReviewsForTentacle).toHaveBeenCalled();
        expect(reviewAndRatingSystem.events.emit).toHaveBeenCalledWith(
          'review:submitted',
          expect.objectContaining({
            tentacleId: 'tentacle1',
            review: mockReviews[0]
          })
        );
      });
    });
    
    test('should update a review for a tentacle', function() {
      var reviewData = {
        rating: 4,
        title: 'Updated review',
        content: 'I have updated my review after using this tentacle for a while.'
      };
      
      return reviewAndRatingSystem.updateReview('tentacle1', 'review1', reviewData).then(function(review) {
        expect(mockMarketplaceCore.updateReviewForTentacle).toHaveBeenCalledWith('tentacle1', 'review1', reviewData);
        expect(mockMarketplaceCore.getReviewsForTentacle).toHaveBeenCalled();
        expect(reviewAndRatingSystem.events.emit).toHaveBeenCalledWith(
          'review:updated',
          expect.objectContaining({
            tentacleId: 'tentacle1',
            reviewId: 'review1',
            review: mockReviews[0]
          })
        );
      });
    });
    
    test('should delete a review for a tentacle', function() {
      return reviewAndRatingSystem.deleteReview('tentacle1', 'review1').then(function(result) {
        expect(mockMarketplaceCore.deleteReviewForTentacle).toHaveBeenCalledWith('tentacle1', 'review1');
        expect(mockMarketplaceCore.getReviewsForTentacle).toHaveBeenCalled();
        expect(reviewAndRatingSystem.events.emit).toHaveBeenCalledWith(
          'review:deleted',
          expect.objectContaining({
            tentacleId: 'tentacle1',
            reviewId: 'review1'
          })
        );
        expect(result).toBe(true);
      });
    });
    
    test('should mark a review as helpful', function() {
      return reviewAndRatingSystem.markReviewAsHelpful('tentacle1', 'review1', 'user2').then(function(review) {
        expect(mockMarketplaceCore.markReviewAsHelpful).toHaveBeenCalledWith('tentacle1', 'review1', 'user2');
        expect(reviewAndRatingSystem.events.emit).toHaveBeenCalledWith(
          'review:helpful',
          expect.objectContaining({
            tentacleId: 'tentacle1',
            reviewId: 'review1',
            userId: 'user2',
            review: mockReviews[0]
          })
        );
      });
    });
    
    test('should mark a review as not helpful', function() {
      return reviewAndRatingSystem.markReviewAsNotHelpful('tentacle1', 'review1', 'user2').then(function(review) {
        expect(mockMarketplaceCore.markReviewAsNotHelpful).toHaveBeenCalledWith('tentacle1', 'review1', 'user2');
        expect(reviewAndRatingSystem.events.emit).toHaveBeenCalledWith(
          'review:not-helpful',
          expect.objectContaining({
            tentacleId: 'tentacle1',
            reviewId: 'review1',
            userId: 'user2',
            review: mockReviews[0]
          })
        );
      });
    });
    
    test('should report a review', function() {
      return reviewAndRatingSystem.reportReview('tentacle1', 'review1', 'user2', 'Inappropriate content').then(function(result) {
        expect(mockMarketplaceCore.reportReview).toHaveBeenCalledWith('tentacle1', 'review1', 'user2', 'Inappropriate content');
        expect(reviewAndRatingSystem.events.emit).toHaveBeenCalledWith(
          'review:reported',
          expect.objectContaining({
            tentacleId: 'tentacle1',
            reviewId: 'review1',
            userId: 'user2',
            reason: 'Inappropriate content'
          })
        );
        expect(result).toBe(true);
      });
    });
    
    test('should get rating summary for a tentacle', function() {
      return reviewAndRatingSystem.getRatingSummary('tentacle1').then(function(summary) {
        expect(mockMarketplaceCore.getRatingSummaryForTentacle).toHaveBeenCalledWith('tentacle1');
        expect(summary).toEqual(mockRatingSummary);
        expect(reviewAndRatingSystem.events.emit).toHaveBeenCalledWith(
          'rating:summary:loaded',
          expect.objectContaining({
            tentacleId: 'tentacle1',
            summary: mockRatingSummary
          })
        );
      });
    });
  });
  
  describe('validation', function() {
    beforeEach(function() {
      return reviewAndRatingSystem.initialize();
    });
    
    test('should validate review data when submitting a review', function() {
      var invalidReviewData = {
        userId: 'user1',
        rating: 6, // Invalid rating (> 5)
        title: 'Invalid review',
        content: 'This review has an invalid rating.'
      };
      
      return expect(reviewAndRatingSystem.submitReview('tentacle1', invalidReviewData)).rejects.toThrow();
    });
    
    test('should validate review content length when submitting a review', function() {
      var shortReviewData = {
        userId: 'user1',
        rating: 5,
        title: 'Short review',
        content: 'Too short' // Less than minReviewLength (10)
      };
      
      return expect(reviewAndRatingSystem.submitReview('tentacle1', shortReviewData)).rejects.toThrow();
    });
    
    test('should validate user ID when anonymous reviews are disabled', function() {
      var anonymousReviewData = {
        rating: 5,
        title: 'Anonymous review',
        content: 'This is an anonymous review that should be rejected.'
      };
      
      return expect(reviewAndRatingSystem.submitReview('tentacle1', anonymousReviewData)).rejects.toThrow();
    });
    
    test('should validate reason when reporting a review', function() {
      return expect(reviewAndRatingSystem.reportReview('tentacle1', 'review1', 'user2', '')).rejects.toThrow();
    });
  });
  
  describe('event handling', function() {
    beforeEach(function() {
      return reviewAndRatingSystem.initialize();
    });
    
    test('should handle tentacle selected event', function() {
      // Get the tentacle selected handler
      var handler;
      mockMarketplaceCore.events.on.mock.calls.forEach(function(call) {
        if (call[0] === 'tentacle:selected') {
          handler = call[1];
        }
      });
      
      // Call the handler
      handler({ tentacleId: 'tentacle1' });
      
      // Verify that reviews and rating summary are loaded
      expect(mockMarketplaceCore.getRatingSummaryForTentacle).toHaveBeenCalledWith('tentacle1');
      expect(mockMarketplaceCore.getReviewsForTentacle).toHaveBeenCalled();
      expect(reviewAndRatingSystem.state.selectedTentacle).toBe('tentacle1');
    });
    
    test('should handle review added event', function() {
      // Get the review added handler
      var handler;
      mockMarketplaceCore.events.on.mock.calls.forEach(function(call) {
        if (call[0] === 'review:added') {
          handler = call[1];
        }
      });
      
      // Set selected tentacle
      reviewAndRatingSystem.state.selectedTentacle = 'tentacle1';
      
      // Call the handler
      handler({ tentacleId: 'tentacle1' });
      
      // Verify that reviews and rating summary are reloaded
      expect(mockMarketplaceCore.getRatingSummaryForTentacle).toHaveBeenCalledWith('tentacle1');
      expect(mockMarketplaceCore.getReviewsForTentacle).toHaveBeenCalled();
    });
    
    test('should handle review updated event', function() {
      // Get the review updated handler
      var handler;
      mockMarketplaceCore.events.on.mock.calls.forEach(function(call) {
        if (call[0] === 'review:updated') {
          handler = call[1];
        }
      });
      
      // Set selected tentacle
      reviewAndRatingSystem.state.selectedTentacle = 'tentacle1';
      
      // Call the handler
      handler({ tentacleId: 'tentacle1' });
      
      // Verify that reviews and rating summary are reloaded
      expect(mockMarketplaceCore.getRatingSummaryForTentacle).toHaveBeenCalledWith('tentacle1');
      expect(mockMarketplaceCore.getReviewsForTentacle).toHaveBeenCalled();
    });
    
    test('should handle review deleted event', function() {
      // Get the review deleted handler
      var handler;
      mockMarketplaceCore.events.on.mock.calls.forEach(function(call) {
        if (call[0] === 'review:deleted') {
          handler = call[1];
        }
      });
      
      // Set selected tentacle
      reviewAndRatingSystem.state.selectedTentacle = 'tentacle1';
      
      // Call the handler
      handler({ tentacleId: 'tentacle1' });
      
      // Verify that reviews and rating summary are reloaded
      expect(mockMarketplaceCore.getRatingSummaryForTentacle).toHaveBeenCalledWith('tentacle1');
      expect(mockMarketplaceCore.getReviewsForTentacle).toHaveBeenCalled();
    });
  });
  
  describe('UI interactions', function() {
    beforeEach(function() {
      return reviewAndRatingSystem.initialize();
    });
    
    test('should emit submit review requested event when submit button is clicked', function() {
      // Set selected tentacle
      reviewAndRatingSystem.state.selectedTentacle = 'tentacle1';
      
      // Call the handler
      reviewAndRatingSystem._handleSubmitButtonClick();
      
      // Verify that event is emitted
      expect(reviewAndRatingSystem.events.emit).toHaveBeenCalledWith(
        'review:submit:requested',
        expect.objectContaining({
          tentacleId: 'tentacle1'
        })
      );
    });
    
    test('should handle helpful button click', function() {
      // Set selected tentacle
      reviewAndRatingSystem.state.selectedTentacle = 'tentacle1';
      
      // Call the handler
      reviewAndRatingSystem._handleHelpfulButtonClick('tentacle1', 'review1');
      
      // Verify that current user is checked
      expect(mockMarketplaceCore.getCurrentUser).toHaveBeenCalled();
    });
    
    test('should handle not helpful button click', function() {
      // Set selected tentacle
      reviewAndRatingSystem.state.selectedTentacle = 'tentacle1';
      
      // Call the handler
      reviewAndRatingSystem._handleNotHelpfulButtonClick('tentacle1', 'review1');
      
      // Verify that current user is checked
      expect(mockMarketplaceCore.getCurrentUser).toHaveBeenCalled();
    });
    
    test('should handle report button click', function() {
      // Set selected tentacle
      reviewAndRatingSystem.state.selectedTentacle = 'tentacle1';
      
      // Call the handler
      reviewAndRatingSystem._handleReportButtonClick('tentacle1', 'review1');
      
      // Verify that current user is checked
      expect(mockMarketplaceCore.getCurrentUser).toHaveBeenCalled();
    });
  });
  
  describe('shutdown', function() {
    beforeEach(function() {
      return reviewAndRatingSystem.initialize();
    });
    
    test('should shutdown successfully', function() {
      return expect(reviewAndRatingSystem.shutdown()).resolves.toBe(true);
    });
    
    test('should set initialized to false after shutdown', function() {
      return reviewAndRatingSystem.shutdown().then(function() {
        expect(reviewAndRatingSystem.initialized).toBe(false);
      });
    });
  });
});
