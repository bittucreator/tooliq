// Stripe webhook handler
import { debugLog, debugError } from "../debug.js"
import databaseService, { TABLES } from "./database-service.js"

class StripeWebhookHandler {
  // Handle Stripe webhook event
  async handleEvent(event) {
    try {
      debugLog(`Processing Stripe webhook event: ${event.type}`)

      switch (event.type) {
        case "checkout.session.completed":
          await this._handleCheckoutSessionCompleted(event.data.object)
          break

        case "customer.subscription.created":
          await this._handleSubscriptionCreated(event.data.object)
          break

        case "customer.subscription.updated":
          await this._handleSubscriptionUpdated(event.data.object)
          break

        case "customer.subscription.deleted":
          await this._handleSubscriptionDeleted(event.data.object)
          break

        case "invoice.payment_succeeded":
          await this._handleInvoicePaymentSucceeded(event.data.object)
          break

        case "invoice.payment_failed":
          await this._handleInvoicePaymentFailed(event.data.object)
          break

        default:
          debugLog(`Unhandled event type: ${event.type}`)
      }

      return true
    } catch (error) {
      debugError(`Error handling Stripe webhook event ${event.type}:`, error)
      throw error
    }
  }

  // Handle checkout.session.completed event
  async _handleCheckoutSessionCompleted(session) {
    try {
      debugLog("Handling checkout.session.completed event")

      // Get customer and subscription IDs
      const customerId = session.customer
      const subscriptionId = session.subscription

      // Get user ID from metadata
      const userId = session.client_reference_id || session.metadata?.userId

      if (!userId) {
        debugError("No user ID found in session metadata")
        return
      }

      // Check if subscription already exists
      const existingSubscriptions = await databaseService.query(TABLES.SUBSCRIPTIONS, {
        filters: [
          { column: "user_id", operator: "eq", value: userId },
          { column: "subscription_id", operator: "eq", value: subscriptionId },
        ],
      })

      if (existingSubscriptions.length > 0) {
        debugLog("Subscription already exists, skipping creation")
        return
      }

      // Create subscription record
      await databaseService.createSubscription({
        user_id: userId,
        customer_id: customerId,
        subscription_id: subscriptionId,
        status: "active",
        plan_name: "Premium",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })

      debugLog("Subscription created successfully")
    } catch (error) {
      debugError("Error handling checkout.session.completed:", error)
      throw error
    }
  }

  // Handle customer.subscription.created event
  async _handleSubscriptionCreated(subscription) {
    try {
      debugLog("Handling customer.subscription.created event")

      // Get customer and subscription IDs
      const customerId = subscription.customer
      const subscriptionId = subscription.id

      // Get user ID from metadata
      const userId = subscription.metadata?.userId

      if (!userId) {
        debugError("No user ID found in subscription metadata")
        return
      }

      // Check if subscription already exists
      const existingSubscriptions = await databaseService.query(TABLES.SUBSCRIPTIONS, {
        filters: [
          { column: "user_id", operator: "eq", value: userId },
          { column: "subscription_id", operator: "eq", value: subscriptionId },
        ],
      })

      if (existingSubscriptions.length > 0) {
        debugLog("Subscription already exists, updating instead")

        // Update subscription
        await databaseService.updateSubscription(existingSubscriptions[0].id, {
          status: subscription.status,
          current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
          current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
          cancel_at_period_end: subscription.cancel_at_period_end,
          updated_at: new Date().toISOString(),
        })

        return
      }

      // Create subscription record
      await databaseService.createSubscription({
        user_id: userId,
        customer_id: customerId,
        subscription_id: subscriptionId,
        status: subscription.status,
        plan_name: "Premium",
        current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
        current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
        cancel_at_period_end: subscription.cancel_at_period_end,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })

      debugLog("Subscription created successfully")
    } catch (error) {
      debugError("Error handling customer.subscription.created:", error)
      throw error
    }
  }

  // Handle customer.subscription.updated event
  async _handleSubscriptionUpdated(subscription) {
    try {
      debugLog("Handling customer.subscription.updated event")

      // Get subscription ID
      const subscriptionId = subscription.id

      // Find subscription in database
      const existingSubscriptions = await databaseService.query(TABLES.SUBSCRIPTIONS, {
        filters: [{ column: "subscription_id", operator: "eq", value: subscriptionId }],
      })

      if (existingSubscriptions.length === 0) {
        debugError("Subscription not found in database")
        return
      }

      // Update subscription
      await databaseService.updateSubscription(existingSubscriptions[0].id, {
        status: subscription.status,
        current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
        current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
        cancel_at_period_end: subscription.cancel_at_period_end,
        updated_at: new Date().toISOString(),
      })

      debugLog("Subscription updated successfully")
    } catch (error) {
      debugError("Error handling customer.subscription.updated:", error)
      throw error
    }
  }

  // Handle customer.subscription.deleted event
  async _handleSubscriptionDeleted(subscription) {
    try {
      debugLog("Handling customer.subscription.deleted event")

      // Get subscription ID
      const subscriptionId = subscription.id

      // Find subscription in database
      const existingSubscriptions = await databaseService.query(TABLES.SUBSCRIPTIONS, {
        filters: [{ column: "subscription_id", operator: "eq", value: subscriptionId }],
      })

      if (existingSubscriptions.length === 0) {
        debugError("Subscription not found in database")
        return
      }

      // Update subscription
      await databaseService.updateSubscription(existingSubscriptions[0].id, {
        status: "canceled",
        cancel_at_period_end: false,
        updated_at: new Date().toISOString(),
      })

      debugLog("Subscription marked as canceled")
    } catch (error) {
      debugError("Error handling customer.subscription.deleted:", error)
      throw error
    }
  }

  // Handle invoice.payment_succeeded event
  async _handleInvoicePaymentSucceeded(invoice) {
    try {
      debugLog("Handling invoice.payment_succeeded event")

      // Only process subscription invoices
      if (!invoice.subscription) {
        debugLog("Not a subscription invoice, skipping")
        return
      }

      // Get subscription ID
      const subscriptionId = invoice.subscription

      // Find subscription in database
      const existingSubscriptions = await databaseService.query(TABLES.SUBSCRIPTIONS, {
        filters: [{ column: "subscription_id", operator: "eq", value: subscriptionId }],
      })

      if (existingSubscriptions.length === 0) {
        debugError("Subscription not found in database")
        return
      }

      // Update subscription if needed
      if (existingSubscriptions[0].status !== "active") {
        await databaseService.updateSubscription(existingSubscriptions[0].id, {
          status: "active",
          updated_at: new Date().toISOString(),
        })

        debugLog("Subscription activated after payment")
      }
    } catch (error) {
      debugError("Error handling invoice.payment_succeeded:", error)
      throw error
    }
  }

  // Handle invoice.payment_failed event
  async _handleInvoicePaymentFailed(invoice) {
    try {
      debugLog("Handling invoice.payment_failed event")

      // Only process subscription invoices
      if (!invoice.subscription) {
        debugLog("Not a subscription invoice, skipping")
        return
      }

      // Get subscription ID
      const subscriptionId = invoice.subscription

      // Find subscription in database
      const existingSubscriptions = await databaseService.query(TABLES.SUBSCRIPTIONS, {
        filters: [{ column: "subscription_id", operator: "eq", value: subscriptionId }],
      })

      if (existingSubscriptions.length === 0) {
        debugError("Subscription not found in database")
        return
      }

      // Update subscription
      await databaseService.updateSubscription(existingSubscriptions[0].id, {
        status: "past_due",
        updated_at: new Date().toISOString(),
      })

      debugLog("Subscription marked as past_due after failed payment")
    } catch (error) {
      debugError("Error handling invoice.payment_failed:", error)
      throw error
    }
  }
}

// Create singleton instance
const stripeWebhookHandler = new StripeWebhookHandler()

export default stripeWebhookHandler

