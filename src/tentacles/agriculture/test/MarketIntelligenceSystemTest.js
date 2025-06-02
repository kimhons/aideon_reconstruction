/**
 * @fileoverview Unit tests for the Market Intelligence System component.
 * 
 * @module test/tentacles/agriculture/MarketIntelligenceSystemTest
 * @requires tentacles/agriculture/MarketIntelligenceSystem
 */

const assert = require('assert');
const MarketIntelligenceSystem = require('../MarketIntelligenceSystem');

// Mock dependencies
const mockAgricultureKnowledgeManager = {
  getEntity: async (entityId) => {
    if (entityId === 'product-corn') {
      return {
        id: 'product-corn',
        entityType: 'product',
        name: 'Corn',
        description: 'Cereal grain',
        categories: ['grain', 'commodity']
      };
    } else if (entityId === 'product-microgreens') {
      return {
        id: 'product-microgreens',
        entityType: 'product',
        name: 'Microgreens',
        description: 'Young vegetable greens',
        categories: ['specialty', 'urban']
      };
    }
    return null;
  }
};

const mockFileSystemTentacle = {
  readFile: async (request) => {
    if (request.path === 'agriculture/market/data/corn_global_daily.json') {
      return JSON.stringify({
        commodity: 'corn',
        region: 'global',
        timeframe: 'daily',
        currency: 'USD',
        unit: 'bushel',
        prices: [
          { date: '2025-06-01', price: 4.25 },
          { date: '2025-05-31', price: 4.20 },
          { date: '2025-05-30', price: 4.22 }
        ],
        timestamp: Date.now() - 12 * 60 * 60 * 1000 // 12 hours ago
      });
    } else if (request.path === 'agriculture/market/historical/corn_global_2024-06-01_2025-06-01.json') {
      return JSON.stringify({
        commodity: 'corn',
        region: 'global',
        startDate: '2024-06-01',
        endDate: '2025-06-01',
        currency: 'USD',
        unit: 'bushel',
        prices: [
          { date: '2025-06-01', price: 4.25 },
          { date: '2025-03-01', price: 4.10 },
          { date: '2024-12-01', price: 3.95 },
          { date: '2024-09-01', price: 3.80 },
          { date: '2024-06-01', price: 3.75 }
        ],
        timestamp: Date.now() - 24 * 60 * 60 * 1000 // 24 hours ago
      });
    } else if (request.path === 'agriculture/market/forecasts/forecast-corn-123.json') {
      return JSON.stringify({
        id: 'forecast-corn-123',
        commodity: 'corn',
        region: 'global',
        horizon: '3m',
        interval: 'weekly',
        forecast: [
          { date: '2025-06-08', price: 4.28, confidence: { lower: 4.20, upper: 4.36 } },
          { date: '2025-06-15', price: 4.32, confidence: { lower: 4.22, upper: 4.42 } },
          { date: '2025-06-22', price: 4.35, confidence: { lower: 4.23, upper: 4.47 } }
        ],
        factors: [
          { name: 'weather', impact: 'positive', confidence: 'medium' },
          { name: 'exports', impact: 'positive', confidence: 'high' },
          { name: 'stockpiles', impact: 'negative', confidence: 'medium' }
        ],
        timestamp: Date.now() - 2 * 24 * 60 * 60 * 1000 // 2 days ago
      });
    } else if (request.path === 'agriculture/market/urban/urban-market-analysis-microgreens-123.json') {
      return JSON.stringify({
        id: 'urban-market-analysis-microgreens-123',
        product: 'microgreens',
        urbanMarket: {
          city: 'New York',
          population: 8500000,
          demographics: {
            income: 'mixed',
            education: 'high'
          }
        },
        segments: [
          { name: 'restaurants', potential: 'high', competition: 'medium' },
          { name: 'farmers_markets', potential: 'high', competition: 'high' },
          { name: 'grocery_stores', potential: 'medium', competition: 'low' }
        ],
        timestamp: Date.now() - 3 * 24 * 60 * 60 * 1000 // 3 days ago
      });
    }
    throw new Error('File not found');
  },
  writeFile: async () => true
};

const mockWebTentacle = {
  fetchResource: async (request) => {
    if (request.type === 'market_data' && request.commodity === 'corn') {
      return {
        commodity: 'corn',
        region: request.region || 'global',
        timeframe: request.timeframe || 'daily',
        currency: 'USD',
        unit: 'bushel',
        prices: [
          { date: '2025-06-01', price: 4.25 },
          { date: '2025-05-31', price: 4.20 },
          { date: '2025-05-30', price: 4.22 }
        ],
        lastUpdated: new Date().toISOString()
      };
    } else if (request.type === 'historical_market_data' && request.commodity === 'corn') {
      return {
        commodity: 'corn',
        region: request.region || 'global',
        startDate: request.startDate,
        endDate: request.endDate,
        currency: 'USD',
        unit: 'bushel',
        prices: [
          { date: '2025-06-01', price: 4.25 },
          { date: '2025-03-01', price: 4.10 },
          { date: '2024-12-01', price: 3.95 },
          { date: '2024-09-01', price: 3.80 },
          { date: '2024-06-01', price: 3.75 }
        ],
        lastUpdated: new Date().toISOString()
      };
    } else if (request.type === 'market_data' && request.commodity === 'microgreens') {
      return {
        commodity: 'microgreens',
        region: request.region || 'global',
        timeframe: request.timeframe || 'daily',
        currency: 'USD',
        unit: 'oz',
        prices: [
          { date: '2025-06-01', price: 1.75 },
          { date: '2025-05-31', price: 1.78 },
          { date: '2025-05-30', price: 1.72 }
        ],
        lastUpdated: new Date().toISOString()
      };
    }
    return null;
  }
};

const mockFinancialAnalysisTentacle = {
  analyzeFinancialData: async (data) => {
    return {
      summary: {
        profitability: 'high',
        risk: 'medium',
        roi: { value: 0.15, timeframe: '1y' }
      },
      details: {
        revenue: { value: 100000, trend: 'increasing' },
        costs: { value: 70000, trend: 'stable' },
        profit: { value: 30000, trend: 'increasing' }
      }
    };
  }
};

// Mock MIIF
global.MIIF = {
  executeModel: async (request) => {
    if (request.task === 'analysis' && request.subtype === 'market_trends') {
      return {
        trends: {
          overall: {
            direction: 'upward',
            strength: 'moderate',
            confidence: 'high'
          },
          seasonal: {
            pattern: 'typical',
            currentPhase: 'rising',
            nextPhase: { direction: 'plateau', expectedStart: '2025-08-01' }
          },
          factors: [
            { name: 'weather', impact: 'positive', confidence: 'medium' },
            { name: 'exports', impact: 'positive', confidence: 'high' },
            { name: 'stockpiles', impact: 'negative', confidence: 'medium' }
          ],
          volatility: {
            level: 'low',
            trend: 'stable'
          },
          longTerm: {
            direction: 'upward',
            strength: 'moderate',
            confidence: 'medium'
          }
        }
      };
    } else if (request.task === 'forecast' && request.subtype === 'price_forecast') {
      return {
        forecast: {
          id: `forecast-${request.input.commodity}-${Date.now()}`,
          forecast: [
            { date: '2025-06-08', price: 4.28, confidence: { lower: 4.20, upper: 4.36 } },
            { date: '2025-06-15', price: 4.32, confidence: { lower: 4.22, upper: 4.42 } },
            { date: '2025-06-22', price: 4.35, confidence: { lower: 4.23, upper: 4.47 } }
          ],
          factors: [
            { name: 'weather', impact: 'positive', confidence: 'medium' },
            { name: 'exports', impact: 'positive', confidence: 'high' },
            { name: 'stockpiles', impact: 'negative', confidence: 'medium' }
          ],
          methodology: {
            name: 'ensemble',
            components: ['arima', 'prophet', 'lstm'],
            accuracy: { mape: 3.2, rmse: 0.15 }
          },
          summary: 'Prices expected to rise moderately over the forecast period due to strong export demand and favorable weather conditions, partially offset by high stockpile levels.'
        }
      };
    } else if (request.task === 'evaluation' && request.subtype === 'forecast_accuracy') {
      return {
        evaluation: {
          overall: {
            accuracy: 0.92,
            bias: 0.02,
            confidence: 'high'
          },
          metrics: {
            mape: 3.8,
            rmse: 0.17,
            mae: 0.14
          },
          comparison: [
            { date: '2025-06-08', forecast: 4.28, actual: 4.30, error: 0.02 },
            { date: '2025-06-15', forecast: 4.32, actual: 4.35, error: 0.03 },
            { date: '2025-06-22', forecast: 4.35, actual: 4.32, error: -0.03 }
          ],
          factors: {
            underestimated: ['export demand'],
            overestimated: ['weather impact'],
            accurate: ['stockpile levels']
          },
          recommendations: [
            'Adjust export demand sensitivity in model',
            'Maintain current stockpile impact factors'
          ]
        }
      };
    } else if (request.task === 'analysis' && request.subtype === 'supply_chain') {
      return {
        analysis: {
          id: `supply-chain-analysis-${request.input.product.id}-${Date.now()}`,
          efficiency: {
            overall: 0.78,
            bottlenecks: [
              { stage: 'processing', severity: 'medium', impact: 'moderate delay' },
              { stage: 'distribution', severity: 'low', impact: 'minor cost increase' }
            ]
          },
          costs: {
            total: { value: 100000, unit: 'USD' },
            breakdown: [
              { stage: 'production', value: 40000, percentage: 40 },
              { stage: 'processing', value: 25000, percentage: 25 },
              { stage: 'distribution', value: 20000, percentage: 20 },
              { stage: 'retail', value: 15000, percentage: 15 }
            ]
          },
          risks: [
            { type: 'weather', probability: 'medium', impact: 'high', mitigation: 'Insurance' },
            { type: 'transportation', probability: 'low', impact: 'medium', mitigation: 'Multiple carriers' }
          ],
          recommendations: [
            { priority: 'high', action: 'Upgrade processing equipment', benefit: 'Reduce bottleneck' },
            { priority: 'medium', action: 'Optimize distribution routes', benefit: 'Lower costs' }
          ]
        }
      };
    } else if (request.task === 'optimization' && request.subtype === 'distribution_routes') {
      return {
        routes: {
          optimized: true,
          savings: { cost: 12, percentage: 15, unit: 'percent' },
          routes: [
            {
              id: 'route-1',
              origin: 'Farm A',
              destination: 'Market B',
              distance: { value: 120, unit: 'km' },
              time: { value: 2.5, unit: 'hours' },
              cost: { value: 350, unit: 'USD' }
            },
            {
              id: 'route-2',
              origin: 'Farm A',
              destination: 'Market C',
              distance: { value: 85, unit: 'km' },
              time: { value: 1.8, unit: 'hours' },
              cost: { value: 275, unit: 'USD' }
            }
          ],
          constraints: {
            timeWindows: true,
            vehicleCapacity: true,
            productFreshness: true
          }
        }
      };
    } else if (request.task === 'analysis' && request.subtype === 'market_opportunities') {
      return {
        opportunities: [
          {
            market: 'Organic',
            potential: 'high',
            competition: 'medium',
            entryBarriers: 'medium',
            timeToMarket: { value: 1, unit: 'year' },
            investment: { value: 50000, unit: 'USD' },
            roi: { value: 0.25, timeframe: '2y' }
          },
          {
            market: 'Direct-to-Consumer',
            potential: 'medium',
            competition: 'low',
            entryBarriers: 'low',
            timeToMarket: { value: 3, unit: 'months' },
            investment: { value: 15000, unit: 'USD' },
            roi: { value: 0.20, timeframe: '1y' }
          }
        ]
      };
    } else if (request.task === 'analysis' && request.subtype === 'value_chain') {
      return {
        analysis: {
          valueAddition: [
            { stage: 'production', value: { base: 1.00, unit: 'USD/unit' } },
            { stage: 'processing', value: { added: 0.75, cumulative: 1.75, unit: 'USD/unit' } },
            { stage: 'packaging', value: { added: 0.50, cumulative: 2.25, unit: 'USD/unit' } },
            { stage: 'distribution', value: { added: 0.25, cumulative: 2.50, unit: 'USD/unit' } },
            { stage: 'retail', value: { added: 1.50, cumulative: 4.00, unit: 'USD/unit' } }
          ],
          margins: [
            { stage: 'production', margin: { value: 0.15, unit: 'percent' } },
            { stage: 'processing', margin: { value: 0.20, unit: 'percent' } },
            { stage: 'packaging', margin: { value: 0.18, unit: 'percent' } },
            { stage: 'distribution', margin: { value: 0.10, unit: 'percent' } },
            { stage: 'retail', margin: { value: 0.25, unit: 'percent' } }
          ],
          opportunities: [
            { stage: 'processing', description: 'Vertical integration could increase margins by 15%' },
            { stage: 'retail', description: 'Direct marketing could capture additional 20% margin' }
          ]
        }
      };
    } else if (request.task === 'generation' && request.subtype === 'marketing_strategy') {
      return {
        strategy: {
          id: `marketing-strategy-${request.input.product.id}-${Date.now()}`,
          targetMarkets: [
            {
              segment: 'Health-conscious consumers',
              demographics: { age: '25-45', income: 'middle to high', education: 'college+' },
              psychographics: { values: ['health', 'sustainability', 'quality'], lifestyle: 'active' },
              size: { value: 15000000, unit: 'people' },
              growth: { value: 8, unit: 'percent' }
            },
            {
              segment: 'Specialty restaurants',
              demographics: { type: 'farm-to-table', location: 'urban' },
              psychographics: { values: ['quality', 'local', 'unique'] },
              size: { value: 25000, unit: 'businesses' },
              growth: { value: 5, unit: 'percent' }
            }
          ],
          positioning: {
            statement: 'Premium quality [product] grown with sustainable practices for health-conscious consumers and discerning chefs',
            differentiators: ['organic certification', 'local production', 'superior taste', 'sustainable practices']
          },
          channels: [
            { type: 'direct', priority: 'high', strategy: 'Online store with subscription option' },
            { type: 'farmers_markets', priority: 'high', strategy: 'Premium booth with sampling' },
            { type: 'specialty_retail', priority: 'medium', strategy: 'Limited distribution to maintain premium positioning' }
          ],
          pricing: {
            strategy: 'premium',
            structure: [
              { channel: 'direct', price: { value: 4.00, unit: 'USD/unit' } },
              { channel: 'farmers_markets', price: { value: 4.50, unit: 'USD/unit' } },
              { channel: 'specialty_retail', price: { value: 3.75, unit: 'USD/unit' } }
            ]
          },
          promotion: {
            messaging: ['Health benefits', 'Sustainable practices', 'Local economy support', 'Superior taste'],
            tactics: [
              { type: 'content_marketing', priority: 'high', channels: ['blog', 'social_media'] },
              { type: 'sampling', priority: 'high', channels: ['farmers_markets', 'food_events'] },
              { type: 'chef_partnerships', priority: 'medium', channels: ['restaurants', 'cooking_schools'] }
            ]
          },
          budget: {
            total: { value: 50000, unit: 'USD' },
            allocation: [
              { category: 'digital_marketing', percentage: 40 },
              { category: 'events', percentage: 30 },
              { category: 'partnerships', percentage: 20 },
              { category: 'materials', percentage: 10 }
            ]
          },
          timeline: {
            phases: [
              { name: 'Launch', duration: { value: 3, unit: 'months' }, focus: 'Awareness' },
              { name: 'Growth', duration: { value: 6, unit: 'months' }, focus: 'Conversion' },
              { name: 'Expansion', duration: { value: 12, unit: 'months' }, focus: 'Retention and referral' }
            ]
          }
        }
      };
    } else if (request.task === 'recommendation' && request.subtype === 'product_branding') {
      return {
        recommendations: {
          name: {
            suggestions: ['Harvest Gold', 'Nature\'s Best', 'Pure Harvest'],
            considerations: ['Memorable', 'Evokes quality', 'Suggests natural origins']
          },
          visualIdentity: {
            colors: ['Green (#336633)', 'Earth tone (#CC9966)', 'Gold (#FFCC33)'],
            imagery: ['Natural landscapes', 'Close-up product shots', 'Farming heritage'],
            style: 'Clean, natural, premium'
          },
          packaging: {
            materials: ['Recyclable kraft paper', 'Compostable film', 'Glass (premium line)'],
            design: 'Transparent window to show product, minimal but premium design',
            information: ['Origin story', 'Nutritional benefits', 'Sustainability practices']
          },
          story: {
            themes: ['Heritage', 'Sustainability', 'Quality'],
            narrative: 'Family farm with generations of expertise, committed to sustainable practices and exceptional quality'
          },
          differentiation: {
            uniqueSellingPropositions: [
              'Grown using regenerative agriculture practices',
              'Harvested at peak ripeness for superior flavor',
              'Supporting local farming communities'
            ]
          }
        }
      };
    } else if (request.task === 'analysis' && request.subtype === 'consumer_preferences') {
      return {
        analysis: {
          segments: [
            {
              name: 'Health Enthusiasts',
              size: { percentage: 35 },
              preferences: {
                attributes: ['organic', 'non-GMO', 'nutrient-dense'],
                packaging: ['eco-friendly', 'information-rich'],
                price: { sensitivity: 'low', premium: { willing: true, max: 30 } }
              }
            },
            {
              name: 'Convenience Seekers',
              size: { percentage: 45 },
              preferences: {
                attributes: ['easy-to-prepare', 'consistent quality', 'familiar'],
                packaging: ['convenient', 'resealable'],
                price: { sensitivity: 'medium', premium: { willing: false } }
              }
            },
            {
              name: 'Culinary Explorers',
              size: { percentage: 20 },
              preferences: {
                attributes: ['unique varieties', 'heirloom', 'flavor profile'],
                packaging: ['premium', 'story-telling'],
                price: { sensitivity: 'low', premium: { willing: true, max: 50 } }
              }
            }
          ],
          trends: [
            { name: 'Health consciousness', direction: 'increasing', impact: 'high' },
            { name: 'Sustainability concern', direction: 'increasing', impact: 'medium' },
            { name: 'Convenience demand', direction: 'stable', impact: 'high' },
            { name: 'Exotic flavors interest', direction: 'increasing', impact: 'medium' }
          ],
          recommendations: [
            'Develop product lines targeting Health Enthusiasts and Culinary Explorers',
            'Emphasize organic certification and nutrient content',
            'Invest in sustainable packaging with clear storytelling',
            'Consider premium pricing strategy for specialty varieties'
          ]
        }
      };
    } else if (request.task === 'analysis' && request.subtype === 'urban_market') {
      return {
        analysis: {
          id: `urban-market-analysis-${request.input.product.id}-${Date.now()}`,
          marketSize: {
            value: { current: 25000000, unit: 'USD' },
            growth: { rate: 12, unit: 'percent' },
            potential: { value: 45000000, unit: 'USD', timeframe: '5y' }
          },
          segments: [
            { name: 'restaurants', potential: 'high', competition: 'medium', share: { value: 40, unit: 'percent' } },
            { name: 'farmers_markets', potential: 'high', competition: 'high', share: { value: 30, unit: 'percent' } },
            { name: 'grocery_stores', potential: 'medium', competition: 'low', share: { value: 20, unit: 'percent' } },
            { name: 'direct_to_consumer', potential: 'medium', competition: 'low', share: { value: 10, unit: 'percent' } }
          ],
          consumerProfile: {
            demographics: {
              age: '25-45',
              income: 'middle to high',
              education: 'college+',
              location: 'urban and inner suburban'
            },
            preferences: [
              { attribute: 'freshness', importance: 'very high' },
              { attribute: 'local', importance: 'high' },
              { attribute: 'organic', importance: 'medium' },
              { attribute: 'unique_varieties', importance: 'medium' }
            ]
          },
          competition: {
            intensity: 'medium',
            majorPlayers: [
              { name: 'Urban Greens', marketShare: { value: 15, unit: 'percent' }, strengths: ['brand recognition', 'distribution'] },
              { name: 'City Sprouts', marketShare: { value: 12, unit: 'percent' }, strengths: ['product variety', 'quality'] }
            ],
            barriers: [
              { type: 'brand_recognition', level: 'medium' },
              { type: 'distribution_access', level: 'high' },
              { type: 'price_competition', level: 'medium' }
            ]
          },
          opportunities: [
            { segment: 'high_end_restaurants', potential: 'high', strategy: 'Direct sales with custom growing programs' },
            { segment: 'subscription_boxes', potential: 'high', strategy: 'Weekly fresh harvest boxes with recipes' },
            { segment: 'specialty_retailers', potential: 'medium', strategy: 'Branded displays with story-telling' }
          ],
          challenges: [
            { type: 'logistics', description: 'Last-mile delivery in urban areas', severity: 'medium' },
            { type: 'seasonality', description: 'Maintaining year-round supply', severity: 'high' },
            { type: 'price_sensitivity', description: 'Premium pricing acceptance', severity: 'low' }
          ]
        }
      };
    } else if (request.task === 'analysis' && request.subtype === 'direct_to_consumer') {
      return {
        opportunities: [
          {
            type: 'farmers_market',
            locations: [
              { name: 'Downtown Market', potential: 'high', competition: 'high', demographics: 'affluent urban' },
              { name: 'Neighborhood Market', potential: 'medium', competition: 'low', demographics: 'mixed urban' }
            ],
            requirements: ['Weekly commitment', 'Display materials', 'Sampling capability'],
            roi: { estimate: 0.25, timeframe: '6m' }
          },
          {
            type: 'subscription_service',
            model: 'Weekly delivery box',
            potential: 'high',
            competition: 'medium',
            requirements: ['Delivery logistics', 'Website/app', 'Consistent supply'],
            roi: { estimate: 0.30, timeframe: '1y' }
          },
          {
            type: 'pop_up_shop',
            locations: [
              { name: 'Food Hall', potential: 'high', competition: 'medium', demographics: 'foodies' },
              { name: 'Corporate Campus', potential: 'medium', competition: 'low', demographics: 'professionals' }
            ],
            requirements: ['Temporary setup', 'Staff', 'Marketing materials'],
            roi: { estimate: 0.20, timeframe: '3m' }
          }
        ]
      };
    } else if (request.task === 'analysis' && request.subtype === 'specialty_market') {
      return {
        analysis: {
          market: {
            size: { value: 12000000, unit: 'USD' },
            growth: { rate: 15, unit: 'percent' },
            maturity: 'emerging'
          },
          segments: [
            {
              name: 'Gourmet Restaurants',
              size: { value: 5000000, unit: 'USD' },
              growth: { rate: 12, unit: 'percent' },
              requirements: ['Consistent quality', 'Unique varieties', 'Reliable delivery'],
              potential: 'high'
            },
            {
              name: 'Specialty Food Stores',
              size: { value: 4000000, unit: 'USD' },
              growth: { rate: 18, unit: 'percent' },
              requirements: ['Attractive packaging', 'Brand story', 'Shelf life'],
              potential: 'high'
            },
            {
              name: 'Food Service Distributors',
              size: { value: 3000000, unit: 'USD' },
              growth: { rate: 10, unit: 'percent' },
              requirements: ['Volume capacity', 'Competitive pricing', 'Food safety certification'],
              potential: 'medium'
            }
          ],
          productFit: {
            overall: 'strong',
            strengths: ['Quality', 'Uniqueness', 'Story'],
            weaknesses: ['Scale', 'Brand recognition'],
            opportunities: ['Premium positioning', 'Chef partnerships', 'Educational marketing']
          },
          entryStrategy: {
            approach: 'Targeted entry focusing on high-end restaurants and specialty stores',
            timeline: { estimate: '6-12 months' },
            investment: { estimate: { value: 75000, unit: 'USD' } },
            keySteps: [
              'Develop chef ambassador program',
              'Create premium packaging',
              'Establish direct sales relationships'
            ]
          }
        }
      };
    } else if (request.task === 'generation' && request.subtype === 'urban_business_plan') {
      return {
        businessPlan: {
          executive_summary: {
            concept: 'Urban vertical farm producing premium microgreens and specialty herbs for local restaurants and consumers',
            market: 'Growing demand for locally-grown, fresh produce in urban areas',
            differentiation: 'Year-round production, ultra-fresh delivery, custom growing programs',
            financials: { investment: { value: 250000, unit: 'USD' }, roi: { value: 0.35, timeframe: '3y' } }
          },
          market_analysis: {
            size: { value: 15000000, unit: 'USD', area: 'metropolitan area' },
            growth: { rate: 12, unit: 'percent' },
            segments: [
              { name: 'High-end restaurants', share: { value: 45, unit: 'percent' } },
              { name: 'Specialty retailers', share: { value: 30, unit: 'percent' } },
              { name: 'Direct-to-consumer', share: { value: 25, unit: 'percent' } }
            ]
          },
          operations: {
            facility: {
              size: { value: 5000, unit: 'sq ft' },
              location: 'Warehouse district',
              systems: ['Vertical hydroponic towers', 'LED lighting', 'Automated nutrient delivery']
            },
            production: {
              capacity: { value: 1200, unit: 'lbs/month' },
              crops: ['Microgreens', 'Specialty herbs', 'Edible flowers'],
              cycles: { average: { value: 14, unit: 'days' } }
            },
            distribution: {
              model: 'Direct delivery within 24 hours of harvest',
              radius: { value: 25, unit: 'miles' },
              frequency: 'Daily'
            }
          },
          marketing: {
            positioning: 'Ultra-fresh, locally-grown specialty produce with consistent year-round availability',
            channels: [
              { type: 'Direct sales', target: 'Restaurants', strategy: 'Chef relationships' },
              { type: 'Retail partnerships', target: 'Specialty stores', strategy: 'Branded displays' },
              { type: 'E-commerce', target: 'Consumers', strategy: 'Subscription service' }
            ]
          },
          financials: {
            startup: {
              total: { value: 250000, unit: 'USD' },
              breakdown: [
                { category: 'Equipment', value: 150000 },
                { category: 'Facility', value: 50000 },
                { category: 'Working capital', value: 50000 }
              ]
            },
            projections: {
              year1: { revenue: 180000, expenses: 160000, profit: 20000 },
              year2: { revenue: 350000, expenses: 250000, profit: 100000 },
              year3: { revenue: 500000, expenses: 325000, profit: 175000 }
            },
            breakeven: { time: { value: 18, unit: 'months' } }
          },
          implementation: {
            timeline: [
              { phase: 'Setup', duration: { value: 3, unit: 'months' } },
              { phase: 'Initial production', duration: { value: 1, unit: 'month' } },
              { phase: 'Market entry', duration: { value: 2, unit: 'months' } },
              { phase: 'Scaling', duration: { value: 6, unit: 'months' } }
            ],
            milestones: [
              { name: 'Facility ready', timing: 'Month 3' },
              { name: 'First harvest', timing: 'Month 4' },
              { name: 'Break-even', timing: 'Month 18' },
              { name: 'Full capacity', timing: 'Month 24' }
            ]
          }
        }
      };
    }
    return null;
  }
};

// Mock Logger
global.Logger = class Logger {
  constructor() {}
  info() {}
  debug() {}
  warn() {}
  error() {}
};

describe('MarketIntelligenceSystem', function() {
  let marketIntelligenceSystem;
  
  beforeEach(function() {
    marketIntelligenceSystem = new MarketIntelligenceSystem({
      agricultureKnowledgeManager: mockAgricultureKnowledgeManager,
      fileSystemTentacle: mockFileSystemTentacle,
      webTentacle: mockWebTentacle,
      financialAnalysisTentacle: mockFinancialAnalysisTentacle
    });
  });
  
  describe('#marketDataManager', function() {
    it('should get current market data for a commodity', async function() {
      const marketData = await marketIntelligenceSystem.marketDataManager.getMarketData(
        'corn',
        {
          region: 'global',
          timeframe: 'daily'
        }
      );
      
      assert.strictEqual(marketData.commodity, 'corn');
      assert.strictEqual(marketData.region, 'global');
      assert.strictEqual(marketData.timeframe, 'daily');
      assert.strictEqual(marketData.prices.length, 3);
    });
    
    it('should get historical market data for a commodity', async function() {
      const historicalData = await marketIntelligenceSystem.marketDataManager.getHistoricalData(
        'corn',
        {
          region: 'global',
          startDate: '2024-06-01',
          endDate: '2025-06-01'
        }
      );
      
      assert.strictEqual(historicalData.commodity, 'corn');
      assert.strictEqual(historicalData.region, 'global');
      assert.strictEqual(historicalData.startDate, '2024-06-01');
      assert.strictEqual(historicalData.endDate, '2025-06-01');
      assert.strictEqual(historicalData.prices.length, 5);
    });
    
    it('should get market trends for a commodity', async function() {
      const trends = await marketIntelligenceSystem.marketDataManager.getMarketTrends(
        'corn',
        {
          region: 'global',
          period: '1y'
        }
      );
      
      assert.strictEqual(trends.overall.direction, 'upward');
      assert.strictEqual(trends.seasonal.pattern, 'typical');
      assert.strictEqual(trends.factors.length, 3);
    });
    
    it('should use embedded data when offline', async function() {
      // Create a new instance without web tentacle to simulate offline mode
      const offlineMarketIntelligenceSystem = new MarketIntelligenceSystem({
        agricultureKnowledgeManager: mockAgricultureKnowledgeManager,
        fileSystemTentacle: mockFileSystemTentacle
      });
      
      const marketData = await offlineMarketIntelligenceSystem.marketDataManager.getMarketData(
        'corn',
        {
          region: 'global',
          timeframe: 'daily'
        }
      );
      
      assert.strictEqual(marketData.commodity, 'corn');
      assert.strictEqual(marketData.source, 'embedded');
    });
  });
  
  describe('#priceForecastingEngine', function() {
    it('should generate price forecast for a commodity', async function() {
      const forecast = await marketIntelligenceSystem.priceForecastingEngine.generateForecast(
        'corn',
        {
          region: 'global',
          horizon: '3m',
          interval: 'weekly'
        }
      );
      
      assert.strictEqual(forecast.commodity, 'corn');
      assert.strictEqual(forecast.region, 'global');
      assert.strictEqual(forecast.horizon, '3m');
      assert.strictEqual(forecast.interval, 'weekly');
      assert.strictEqual(forecast.forecast.length, 3);
    });
    
    it('should get forecast by ID', async function() {
      const forecast = await marketIntelligenceSystem.priceForecastingEngine.getForecast('forecast-corn-123');
      
      assert.strictEqual(forecast.id, 'forecast-corn-123');
      assert.strictEqual(forecast.commodity, 'corn');
      assert.strictEqual(forecast.region, 'global');
      assert.strictEqual(forecast.horizon, '3m');
    });
    
    it('should evaluate forecast accuracy', async function() {
      const evaluation = await marketIntelligenceSystem.priceForecastingEngine.evaluateForecastAccuracy(
        'forecast-corn-123',
        {
          prices: [
            { date: '2025-06-08', price: 4.30 },
            { date: '2025-06-15', price: 4.35 },
            { date: '2025-06-22', price: 4.32 }
          ]
        }
      );
      
      assert.strictEqual(evaluation.overall.accuracy, 0.92);
      assert.strictEqual(evaluation.metrics.mape, 3.8);
      assert.strictEqual(evaluation.comparison.length, 3);
    });
  });
  
  describe('#supplyChainOptimizer', function() {
    it('should analyze supply chain for a product', async function() {
      const analysis = await marketIntelligenceSystem.supplyChainOptimizer.analyzeSupplyChain(
        'corn',
        {
          stages: [
            { name: 'production', location: 'Farm A', capacity: 1000 },
            { name: 'processing', location: 'Facility B', capacity: 800 },
            { name: 'distribution', location: 'Center C', capacity: 1200 }
          ],
          flows: [
            { from: 'production', to: 'processing', volume: 800 },
            { from: 'processing', to: 'distribution', volume: 750 }
          ]
        }
      );
      
      assert.strictEqual(analysis.product, 'corn');
      assert.strictEqual(analysis.efficiency.overall, 0.78);
      assert.strictEqual(analysis.costs.total.value, 100000);
      assert.strictEqual(analysis.recommendations.length, 2);
    });
    
    it('should optimize distribution routes', async function() {
      const routes = await marketIntelligenceSystem.supplyChainOptimizer.optimizeDistributionRoutes(
        'corn',
        {
          origin: 'Farm A',
          destinations: [
            { id: 'Market B', distance: 150, demand: 500 },
            { id: 'Market C', distance: 100, demand: 300 }
          ],
          constraints: {
            timeWindows: true,
            vehicleCapacity: 800,
            productFreshness: { maxHours: 48 }
          }
        }
      );
      
      assert.strictEqual(routes.optimized, true);
      assert.strictEqual(routes.savings.percentage, 15);
      assert.strictEqual(routes.routes.length, 2);
    });
    
    it('should identify market opportunities', async function() {
      const opportunities = await marketIntelligenceSystem.supplyChainOptimizer.identifyMarketOpportunities(
        'corn',
        {
          current: {
            markets: [
              { name: 'Commodity', share: 0.8 },
              { name: 'Specialty', share: 0.2 }
            ]
          },
          trends: [
            { market: 'Organic', growth: 0.15 },
            { market: 'Direct-to-Consumer', growth: 0.25 }
          ]
        }
      );
      
      assert.strictEqual(opportunities.length, 2);
      assert.strictEqual(opportunities[0].market, 'Organic');
      assert.strictEqual(opportunities[0].potential, 'high');
      assert.strictEqual(opportunities[1].market, 'Direct-to-Consumer');
    });
  });
  
  describe('#marketingStrategyAdvisor', function() {
    it('should generate marketing strategy', async function() {
      const strategy = await marketIntelligenceSystem.marketingStrategyAdvisor.generateStrategy(
        'corn',
        {
          product: {
            type: 'specialty',
            attributes: ['organic', 'heirloom', 'locally grown']
          },
          target: {
            primary: 'health-conscious consumers',
            secondary: 'specialty restaurants'
          },
          goals: [
            { type: 'awareness', target: { value: 50, unit: 'percent' } },
            { type: 'sales', target: { value: 100000, unit: 'USD' } }
          ]
        }
      );
      
      assert.strictEqual(strategy.product, 'corn');
      assert.strictEqual(strategy.targetMarkets.length, 2);
      assert.strictEqual(strategy.positioning.differentiators.length, 4);
      assert.strictEqual(strategy.channels.length, 3);
    });
    
    it('should generate branding recommendations', async function() {
      const recommendations = await marketIntelligenceSystem.marketingStrategyAdvisor.generateBrandingRecommendations(
        'corn',
        {
          product: {
            type: 'specialty',
            attributes: ['organic', 'heirloom', 'locally grown']
          },
          target: {
            primary: 'health-conscious consumers',
            secondary: 'specialty restaurants'
          },
          values: ['quality', 'sustainability', 'heritage']
        }
      );
      
      assert.strictEqual(recommendations.name.suggestions.length, 3);
      assert.strictEqual(recommendations.visualIdentity.colors.length, 3);
      assert.strictEqual(recommendations.packaging.materials.length, 3);
      assert.strictEqual(recommendations.differentiation.uniqueSellingPropositions.length, 3);
    });
    
    it('should analyze consumer preferences', async function() {
      const analysis = await marketIntelligenceSystem.marketingStrategyAdvisor.analyzeConsumerPreferences(
        'corn',
        {
          segments: [
            { name: 'Health Enthusiasts', size: 0.35 },
            { name: 'Convenience Seekers', size: 0.45 },
            { name: 'Culinary Explorers', size: 0.20 }
          ],
          surveys: {
            sample: 500,
            questions: [
              { topic: 'attributes', responses: { organic: 0.65, non_gmo: 0.70, flavor: 0.85 } },
              { topic: 'packaging', responses: { eco_friendly: 0.60, convenient: 0.75 } },
              { topic: 'price', responses: { premium_willing: 0.40, max_premium: 0.30 } }
            ]
          }
        }
      );
      
      assert.strictEqual(analysis.segments.length, 3);
      assert.strictEqual(analysis.trends.length, 4);
      assert.strictEqual(analysis.recommendations.length, 4);
    });
  });
  
  describe('#urbanMarketSpecialist', function() {
    it('should analyze urban market for a product', async function() {
      const analysis = await marketIntelligenceSystem.urbanMarketSpecialist.analyzeUrbanMarket(
        'microgreens',
        {
          city: {
            name: 'New York',
            population: 8500000,
            demographics: {
              income: { median: 65000 },
              education: { college: 0.35 }
            }
          },
          market: {
            current: { size: 25000000 },
            growth: 0.12
          },
          competition: [
            { name: 'Urban Greens', share: 0.15 },
            { name: 'City Sprouts', share: 0.12 }
          ]
        }
      );
      
      assert.strictEqual(analysis.product, 'microgreens');
      assert.strictEqual(analysis.marketSize.growth.rate, 12);
      assert.strictEqual(analysis.segments.length, 4);
      assert.strictEqual(analysis.opportunities.length, 3);
    });
    
    it('should get urban market analysis by ID', async function() {
      const analysis = await marketIntelligenceSystem.urbanMarketSpecialist.getAnalysis('urban-market-analysis-microgreens-123');
      
      assert.strictEqual(analysis.id, 'urban-market-analysis-microgreens-123');
      assert.strictEqual(analysis.product, 'microgreens');
      assert.strictEqual(analysis.segments.length, 3);
    });
    
    it('should identify direct-to-consumer opportunities', async function() {
      const opportunities = await marketIntelligenceSystem.urbanMarketSpecialist.identifyDirectToConsumerOpportunities(
        'microgreens',
        {
          city: 'New York',
          neighborhoods: [
            { name: 'Downtown', demographics: 'affluent urban', density: 'high' },
            { name: 'Midtown', demographics: 'mixed urban', density: 'high' }
          ],
          venues: [
            { type: 'farmers_market', count: 12 },
            { type: 'food_hall', count: 5 }
          ]
        }
      );
      
      assert.strictEqual(opportunities.length, 3);
      assert.strictEqual(opportunities[0].type, 'farmers_market');
      assert.strictEqual(opportunities[0].locations.length, 2);
      assert.strictEqual(opportunities[1].type, 'subscription_service');
    });
    
    it('should analyze specialty market potential', async function() {
      const analysis = await marketIntelligenceSystem.urbanMarketSpecialist.analyzeSpecialtyMarketPotential(
        'microgreens',
        {
          segments: [
            { name: 'Gourmet Restaurants', size: 5000000 },
            { name: 'Specialty Food Stores', size: 4000000 },
            { name: 'Food Service Distributors', size: 3000000 }
          ],
          product: {
            attributes: ['freshness', 'variety', 'local'],
            capacity: { current: 500, unit: 'lbs/week' }
          }
        }
      );
      
      assert.strictEqual(analysis.market.size.value, 12000000);
      assert.strictEqual(analysis.segments.length, 3);
      assert.strictEqual(analysis.productFit.overall, 'strong');
      assert.strictEqual(analysis.entryStrategy.keySteps.length, 3);
    });
    
    it('should generate urban farming business plan', async function() {
      const businessPlan = await marketIntelligenceSystem.urbanMarketSpecialist.generateUrbanFarmingBusinessPlan(
        'microgreens',
        {
          concept: {
            type: 'vertical_farm',
            products: ['microgreens', 'herbs', 'edible_flowers'],
            scale: { size: 5000, unit: 'sq ft' }
          },
          location: {
            city: 'New York',
            area: 'Warehouse district'
          },
          market: {
            target: ['restaurants', 'specialty_retailers', 'direct_to_consumer'],
            size: 15000000
          }
        }
      );
      
      assert.strictEqual(businessPlan.executive_summary.concept.includes('Urban vertical farm'), true);
      assert.strictEqual(businessPlan.market_analysis.segments.length, 3);
      assert.strictEqual(businessPlan.operations.production.crops.includes('Microgreens'), true);
      assert.strictEqual(businessPlan.marketing.channels.length, 3);
      assert.strictEqual(businessPlan.financials.projections.year3.profit, 175000);
    });
  });
});
