// Stripe service for payment processing
import { debugLog, debugError } from "../debug.js"
import apiService from "./api-service.js"
import authService from "./auth-service.js"
import databaseService from "./database-service.js"

// Stripe configuration
const STRIPE_PUBLIC_KEY = "pk_test_your_stripe_public_key"

// Subscription plans
const SUBSCRIPTION_PLANS = {
  MONTHLY: "price_monthly_id",
  ANNUAL: "price_annual_id",
}

// Declare Stripe variable
let Stripe

class StripeService {
  constructor() {
    this.initialized = false
    this.stripe = null
  }

  // Initialize Stripe
  async initialize() {
    if (this.initialized) return this.stripe

    try {
      // Load Stripe.js
      if (typeof Stripe === "undefined") {
        await this._loadStripeScript()
      }

      // Initialize Stripe
      this.stripe = Stripe(STRIPE_PUBLIC_KEY)
      this.initialized = true

      debugLog("Stripe initialized")
      return this.stripe
    } catch (error) {
      debugError("Error initializing Stripe:", error)
      throw error
    }
  }

  // Load Stripe.js script
  async _loadStripeScript() {
    return new Promise((resolve, reject) => {
      const script = document.createElement("script")
      script.src = "https://js.stripe.com/v3/"
      script.onload = resolve
      script.onerror = () => reject(new Error("Failed to load Stripe.js"))
      document.head.appendChild(script)
    })
  }

  // Check if user has active subscription
  async hasActiveSubscription() {
    try {
      // Check if user is authenticated
      if (!authService.isAuthenticated()) {
        return false
      }

      // Get user ID
      const user = await authService.getCurrentUser()

      // Get subscription from database
      const subscription = await databaseService.getUserSubscription(user.id)

      return !!subscription && ["active", "trialing"].includes(subscription.status)
    } catch (error) {
      debugError("Error checking subscription status:", error)
      return false
    }
  }

  // Get subscription details
  async getSubscriptionDetails() {
    try {
      // Check if user is authenticated
      if (!authService.isAuthenticated()) {
        throw new Error("Authentication required")
      }

      // Get user ID
      const user = await authService.getCurrentUser()

      // Get subscription from database
      const subscription = await databaseService.getUserSubscription(user.id)

      if (!subscription) {
        throw new Error("No active subscription found")
      }

      return {
        id: subscription.id,
        status: subscription.status,
        planName: subscription.plan_name || "Premium",
        currentPeriodStart: subscription.current_period_start,
        currentPeriodEnd: subscription.current_period_end,
        cancelAtPeriodEnd: subscription.cancel_at_period_end || false,
      }
    } catch (error) {
      debugError("Error getting subscription details:", error)
      throw error
    }
  }

  // Create checkout session
  async createCheckoutSession(planType = "MONTHLY", successUrl, cancelUrl) {
    try {
      // Check if user is authenticated
      if (!authService.isAuthenticated()) {
        throw new Error("Authentication required")
      }

      // Initialize Stripe
      await this.initialize()

      // Get price ID
      const priceId = SUBSCRIPTION_PLANS[planType]
      if (!priceId) {
        throw new Error("Invalid plan type")
      }

      // Create checkout session
      const response = await apiService.post("subscriptions/create-checkout", {
        priceId,
        successUrl,
        cancelUrl,
      })

      // Redirect to checkout
      window.location.href = response.url

      return response
    } catch (error) {
      debugError("Error creating checkout session:", error)
      throw error
    }
  }

  // Create customer portal session
  async createCustomerPortalSession(returnUrl) {
    try {
      // Check if user is authenticated
      if (!authService.isAuthenticated()) {
        throw new Error("Authentication required")
      }

      // Get user ID
      const user = await authService.getCurrentUser()

      // Get subscription from database
      const subscription = await databaseService.getUserSubscription(user.id)

      if (!subscription) {
        throw new Error("No active subscription found")
      }

      // Create portal session
      const response = await apiService.post("subscriptions/create-portal", {
        customerId: subscription.customer_id,
        returnUrl,
      })

      // Redirect to portal
      window.location.href = response.url

      return response
    } catch (error) {
      debugError("Error creating customer portal session:", error)
      throw error
    }
  }

  // Cancel subscription
  async cancelSubscription() {
    try {
      // Check if user is authenticated
      if (!authService.isAuthenticated()) {
        throw new Error("Authentication required")
      }

      // Get user ID
      const user = await authService.getCurrentUser()

      // Get subscription from database
      const subscription = await databaseService.getUserSubscription(user.id)

      if (!subscription) {
        throw new Error("No active subscription found")
      }

      // Cancel subscription
      await apiService.post("subscriptions/cancel", {
        subscriptionId: subscription.subscription_id,
      })

      // Update subscription in database
      await databaseService.updateSubscription(subscription.id, {
        cancel_at_period_end: true,
        updated_at: new Date().toISOString(),
      })

      return true
    } catch (error) {
      debugError("Error canceling subscription:", error)
      throw error
    }
  }

  // Resume subscription
  async resumeSubscription() {
    try {
      // Check if user is authenticated
      if (!authService.isAuthenticated()) {
        throw new Error("Authentication required")
      }

      // Get user ID
      const user = await authService.getCurrentUser()

      // Get subscription from database
      const subscription = await databaseService.getUserSubscription(user.id)

      if (!subscription) {
        throw new Error("No active subscription found")
      }

      // Resume subscription
      await apiService.post("subscriptions/resume", {
        subscriptionId: subscription.subscription_id,
      })

      // Update subscription in database
      await databaseService.updateSubscription(subscription.id, {
        cancel_at_period_end: false,
        updated_at: new Date().toISOString(),
      })

      return true
    } catch (error) {
      debugError("Error resuming subscription:", error)
      throw error
    }
  }

  // Change subscription plan
  async changeSubscriptionPlan(planType) {
    try {
      // Check if user is authenticated
      if (!authService.isAuthenticated()) {
        throw new Error("Authentication required")
      }

      // Get price ID
      const priceId = SUBSCRIPTION_PLANS[planType]
      if (!priceId) {
        throw new Error("Invalid plan type")
      }

      // Get user ID
      const user = await authService.getCurrentUser()

      // Get subscription from database
      const subscription = await databaseService.getUserSubscription(user.id)

      if (!subscription) {
        throw new Error("No active subscription found")
      }

      // Change subscription plan
      await apiService.post("subscriptions/change-plan", {
        subscriptionId: subscription.subscription_id,
        priceId,
      })

      return true
    } catch (error) {
      debugError("Error changing subscription plan:", error)
      throw error
    }
  }
}

// Create singleton instance
const stripeService = new StripeService()

export default stripeService

