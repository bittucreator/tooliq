// API mock for testing Stripe integration
import { debugLog, debugError } from "../debug.js"

// Mock subscription data
const mockSubscriptions = new Map()

// Mock API endpoints
const mockEndpoints = {
  // Subscription endpoints
  "subscriptions/status": async (method, data, token) => {
    if (method !== "GET") return { status: 404, body: { error: "Not found" } }

    // Get user ID from token
    const userId = getUserIdFromToken(token)
    if (!userId) return { status: 401, body: { error: "Unauthorized" } }

    // Get subscription for user
    const subscription = mockSubscriptions.get(userId)

    if (!subscription) {
      return {
        status: 200,
        body: {
          status: "inactive",
          customerId: null,
        },
      }
    }

    return {
      status: 200,
      body: {
        status: subscription.status,
        customerId: subscription.customerId,
      },
    }
  },

  "subscriptions/details": async (method, data, token) => {
    if (method !== "GET") return { status: 404, body: { error: "Not found" } }

    // Get user ID from token
    const userId = getUserIdFromToken(token)
    if (!userId) return { status: 401, body: { error: "Unauthorized" } }

    // Get subscription for user
    const subscription = mockSubscriptions.get(userId)

    if (!subscription) {
      return { status: 404, body: { error: "Subscription not found" } }
    }

    return {
      status: 200,
      body: {
        id: subscription.id,
        status: subscription.status,
        planName: "Premium",
        currentPeriodStart: Math.floor(Date.now() / 1000) - 86400, // 1 day ago
        currentPeriodEnd: Math.floor(Date.now() / 1000) + 2592000, // 30 days from now
        cancelAtPeriodEnd: subscription.cancelAtPeriodEnd || false,
      },
    }
  },

  "subscriptions/create-checkout": async (method, data, token) => {
    if (method !== "POST") return { status: 404, body: { error: "Not found" } }

    // Get user ID from token
    const userId = getUserIdFromToken(token)
    if (!userId) return { status: 401, body: { error: "Unauthorized" } }

    // Validate data
    if (!data.priceId) return { status: 400, body: { error: "Price ID is required" } }

    // Create mock session ID
    const sessionId = `cs_test_${Math.random().toString(36).substring(2, 15)}`

    return {
      status: 200,
      body: {
        sessionId,
        url: `https://checkout.stripe.com/pay/${sessionId}`,
      },
    }
  },

  "subscriptions/create-portal": async (method, data, token) => {
    if (method !== "POST") return { status: 404, body: { error: "Not found" } }

    // Get user ID from token
    const userId = getUserIdFromToken(token)
    if (!userId) return { status: 401, body: { error: "Unauthorized" } }

    // Validate data
    if (!data.customerId) return { status: 400, body: { error: "Customer ID is required" } }

    return {
      status: 200,
      body: {
        url: `https://billing.stripe.com/p/session/${Math.random().toString(36).substring(2, 15)}`,
      },
    }
  },

  "subscriptions/activate": async (method, data, token) => {
    if (method !== "POST") return { status: 404, body: { error: "Not found" } }

    // Get user ID from token
    const userId = getUserIdFromToken(token)
    if (!userId) return { status: 401, body: { error: "Unauthorized" } }

    // Validate data
    if (!data.customerId) return { status: 400, body: { error: "Customer ID is required" } }

    // Create mock subscription
    const subscriptionId = `sub_${Math.random().toString(36).substring(2, 15)}`

    mockSubscriptions.set(userId, {
      id: subscriptionId,
      status: "active",
      customerId: data.customerId,
      createdAt: Date.now(),
      cancelAtPeriodEnd: false,
    })

    return { status: 200, body: { success: true } }
  },

  "subscriptions/update": async (method, data, token) => {
    if (method !== "POST") return { status: 404, body: { error: "Not found" } }

    // Get user ID from token
    const userId = getUserIdFromToken(token)
    if (!userId) return { status: 401, body: { error: "Unauthorized" } }

    // Validate data
    if (!data.subscriptionId) return { status: 400, body: { error: "Subscription ID is required" } }
    if (!data.status) return { status: 400, body: { error: "Status is required" } }

    // Get subscription for user
    const subscription = mockSubscriptions.get(userId)

    if (!subscription) {
      return { status: 404, body: { error: "Subscription not found" } }
    }

    // Update subscription status
    subscription.status = data.status

    // If canceling at period end
    if (data.cancelAtPeriodEnd) {
      subscription.cancelAtPeriodEnd = true
    }

    mockSubscriptions.set(userId, subscription)

    return { status: 200, body: { success: true } }
  },

  "subscriptions/cancel": async (method, data, token) => {
    if (method !== "POST") return { status: 404, body: { error: "Not found" } }

    // Get user ID from token
    const userId = getUserIdFromToken(token)
    if (!userId) return { status: 401, body: { error: "Unauthorized" } }

    // Get subscription for user
    const subscription = mockSubscriptions.get(userId)

    if (!subscription) {
      return { status: 404, body: { error: "Subscription not found" } }
    }

    // Set subscription to cancel at period end
    subscription.cancelAtPeriodEnd = true
    mockSubscriptions.set(userId, subscription)

    return { status: 200, body: { success: true } }
  },

  "subscriptions/resume": async (method, data, token) => {
    if (method !== "POST") return { status: 404, body: { error: "Not found" } }

    // Get user ID from token
    const userId = getUserIdFromToken(token)
    if (!userId) return { status: 401, body: { error: "Unauthorized" } }

    // Get subscription for user
    const subscription = mockSubscriptions.get(userId)

    if (!subscription) {
      return { status: 404, body: { error: "Subscription not found" } }
    }

    // Resume subscription
    subscription.cancelAtPeriodEnd = false
    mockSubscriptions.set(userId, subscription)

    return { status: 200, body: { success: true } }
  },

  "subscriptions/change-plan": async (method, data, token) => {
    if (method !== "POST") return { status: 404, body: { error: "Not found" } }

    // Get user ID from token
    const userId = getUserIdFromToken(token)
    if (!userId) return { status: 401, body: { error: "Unauthorized" } }

    // Validate data
    if (!data.priceId) return { status: 400, body: { error: "Price ID is required" } }

    // Get subscription for user
    const subscription = mockSubscriptions.get(userId)

    if (!subscription) {
      return { status: 404, body: { error: "Subscription not found" } }
    }

    // Update subscription (in a real implementation, this would change the plan)
    // For mock purposes, we'll just acknowledge the change

    return { status: 200, body: { success: true } }
  },
}

// Helper function to extract user ID from token
function getUserIdFromToken(token) {
  if (!token) return null

  try {
    // In a real implementation, this would validate and decode the JWT
    // For mock purposes, we'll just extract a mock user ID
    return "user_" + token.substring(0, 10)
  } catch (error) {
    return null
  }
}

// Mock API request handler
export async function handleMockApiRequest(endpoint, method, data, token) {
  debugLog(`Mock API request: ${method} ${endpoint}`)

  // Check if endpoint exists
  if (!mockEndpoints[endpoint]) {
    return { status: 404, body: { error: "Endpoint not found" } }
  }

  try {
    // Call endpoint handler
    const response = await mockEndpoints[endpoint](method, data, token)
    return response
  } catch (error) {
    debugError(`Error in mock API endpoint ${endpoint}:`, error)
    return { status: 500, body: { error: "Internal server error" } }
  }
}

// Initialize with some test data
export function initializeMockData() {
  // Create a test subscription for a test user
  mockSubscriptions.set("user_test", {
    id: "sub_test123",
    status: "active",
    customerId: "cus_test123",
    createdAt: Date.now(),
    cancelAtPeriodEnd: false,
  })

  debugLog("Mock API data initialized")
}

