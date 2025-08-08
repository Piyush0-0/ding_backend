const db = require('../db');

/**
 * Simplified Onboarding Service
 * Single source of truth for restaurant onboarding state
 */
class OnboardingService {
  
  /**
   * Get complete onboarding state for a user
   */
  static async getOnboardingState(userId) {
    try {
      // Get user
      const [user] = await db.query(
        'SELECT id, name, email, phone_number, role FROM Users WHERE id = ?',
        [userId]
      );
      
      if (!user) {
        throw new Error('User not found');
      }
      
      // Get restaurant
      const [restaurant] = await db.query(
        'SELECT id, name, address, city, state, country, contact, onboarding_status FROM Restaurants WHERE created_by_user_id = ?',
        [userId]
      );
      
      // Get POS integration
      const [posIntegration] = await db.query(
        'SELECT pos_type, pos_restaurant_id, api_key, config FROM restaurant_pos_integrations WHERE restaurant_id = ?',
        [restaurant?.id || 0]
      );
      
      // Parse onboarding status safely
      const onboardingStatus = this.parseOnboardingStatus(restaurant?.onboarding_status);
      
      // Determine current step
      const currentStep = this.determineCurrentStep(user, restaurant, posIntegration, onboardingStatus);
      
      // Build step data
      const stepData = this.buildStepData(user, restaurant, posIntegration);
      
      // Build available steps
      const availableSteps = this.buildAvailableSteps(restaurant, posIntegration, onboardingStatus, currentStep);
      
      // Calculate progress
      const completedSteps = availableSteps.filter(step => step.completed).length;
      const progress = Math.round((completedSteps / availableSteps.length) * 100);
      
      return {
        currentStep,
        completedSteps: availableSteps.filter(step => step.completed).map(step => step.key),
        availableSteps,
        stepData,
        progress,
        restaurantId: restaurant?.id || null,
        userId
      };
      
    } catch (error) {
      console.error('[OnboardingService] Error:', error);
      throw error;
    }
  }
  
  /**
   * Safely parse onboarding status JSON
   */
  static parseOnboardingStatus(jsonString) {
    if (!jsonString) return {};
    
    try {
      return JSON.parse(jsonString);
    } catch (error) {
      console.warn('[OnboardingService] Invalid JSON in onboarding_status:', error.message);
      return {};
    }
  }
  
  /**
   * Determine current step based on completion status
   */
  static determineCurrentStep(user, restaurant, posIntegration, onboardingStatus) {
    // Step 1: Restaurant Info
    if (!restaurant) {
      return 'RESTAURANT_INFO';
    }
    
    // Step 2: POS Integration
    if (!posIntegration) {
      return 'POS_INTEGRATION';
    }
    
    // Step 3: Menu Preview (check explicit completion)
    if (!onboardingStatus.menu_setup) {
      return 'MENU_PREVIEW';
    }
    
    // Step 4: Complete
    return 'COMPLETE';
  }
  
  /**
   * Build step data for frontend
   */
  static buildStepData(user, restaurant, posIntegration) {
    return {
      PERSONAL_DETAILS: {
        name: user.name,
        email: user.email,
        phone: user.phone_number
      },
      RESTAURANT_INFO: restaurant ? {
        restaurantName: restaurant.name,
        address: restaurant.address,
        city: restaurant.city,
        state: restaurant.state,
        country: restaurant.country,
        contact: restaurant.contact
      } : null,
      POS_INTEGRATION: posIntegration ? {
        posSystem: posIntegration.pos_type,
        restaurantId: posIntegration.pos_restaurant_id,
        apiKey: posIntegration.api_key,
        config: posIntegration.config
      } : null,
      MENU_PREVIEW: null,
      COMPLETE: null
    };
  }
  
  /**
   * Build available steps with completion status
   */
  static buildAvailableSteps(restaurant, posIntegration, onboardingStatus, currentStep) {
    return [
      {
        key: 'PERSONAL_DETAILS',
        title: 'Personal Details',
        description: 'Create your account and provide basic information',
        completed: true, // Always completed if user exists
        editable: true,
        isCurrent: currentStep === 'PERSONAL_DETAILS'
      },
      {
        key: 'RESTAURANT_INFO',
        title: 'Restaurant Information',
        description: 'Set up your restaurant profile and basic details',
        completed: !!restaurant,
        editable: true,
        isCurrent: currentStep === 'RESTAURANT_INFO'
      },
      {
        key: 'POS_INTEGRATION',
        title: 'POS Integration',
        description: 'Connect your POS system to sync menu and orders',
        completed: !!posIntegration,
        editable: !!restaurant,
        isCurrent: currentStep === 'POS_INTEGRATION'
      },
      {
        key: 'MENU_PREVIEW',
        title: 'Menu Preview',
        description: 'Review and customize your synced menu',
        completed: onboardingStatus.menu_setup === true,
        editable: !!posIntegration,
        isCurrent: currentStep === 'MENU_PREVIEW'
      },
      {
        key: 'COMPLETE',
        title: 'Setup Complete',
        description: 'Your restaurant is ready to receive orders',
        completed: currentStep === 'COMPLETE',
        editable: false,
        isCurrent: currentStep === 'COMPLETE'
      }
    ];
  }
}

module.exports = OnboardingService; 