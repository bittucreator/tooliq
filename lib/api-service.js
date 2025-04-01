// API service for communicating with backend services
import { debugLog, debugError } from "../debug.js"
import { getAuthToken } from "./auth-service.js"
import { handleMockApiRequest, initializeMockData } from "./api-mock.js"

// API base URL - replace with your actual API endpoint
const API_BASE_URL = "https://api.sendpe.in/v1"

const USE_MOCK_API = true // Set to false to use real API

// Default request timeout in milliseconds
const DEFAULT_TIMEOUT = 30000

// API rate limiting parameters
const RATE_LIMIT = {
  maxRequests: 50, // Maximum requests per window
  timeWindow: 60000, // Time window in milliseconds (1 minute)
  requestTimestamps: [], // Timestamps of recent requests
}

// Initialize mock data
if (USE_MOCK_API) {
  initializeMockData()
}

class ApiService {
  constructor() {
    this.pendingRequests = new Map()
    this.requestId = 1
  }

  // Make a GET request
  async get(endpoint, params = {}, options = {}) {
    const url = this._buildUrl(endpoint, params)
    return this._request("GET", url, null, options)
  }

  // Make a POST request
  async post(endpoint, data = {}, options = {}) {
    const url = this._buildUrl(endpoint)
    return this._request("POST", url, data, options)
  }

  // Make a PUT request
  async put(endpoint, data = {}, options = {}) {
    const url = this._buildUrl(endpoint)
    return this._request("PUT", url, data, options)
  }

  // Make a DELETE request
  async delete(endpoint, params = {}, options = {}) {
    const url = this._buildUrl(endpoint, params)
    return this._request("DELETE", url, null, options)
  }

  // Make a PATCH request
  async patch(endpoint, data = {}, options = {}) {
    const url = this._buildUrl(endpoint)
    return this._request("PATCH", url, data, options)
  }

  // Upload a file
  async uploadFile(endpoint, file, metadata = {}, options = {}) {
    const url = this._buildUrl(endpoint)

    const formData = new FormData()
    formData.append("file", file)

    // Add metadata fields to form data
    Object.entries(metadata).forEach(([key, value]) => {
      formData.append(key, value)
    })

    return this._request("POST", url, formData, {
      ...options,
      headers: {
        ...options.headers,
        // Don't set Content-Type for FormData, browser will set it with boundary
      },
    })
  }

  // Cancel a pending request
  cancelRequest(requestId) {
    if (this.pendingRequests.has(requestId)) {
      const { controller } = this.pendingRequests.get(requestId)
      controller.abort()
      this.pendingRequests.delete(requestId)
      debugLog(`Request ${requestId} cancelled`)
      return true
    }
    return false
  }

  // Cancel all pending requests
  cancelAllRequests() {
    this.pendingRequests.forEach(({ controller }, requestId) => {
      controller.abort()
      debugLog(`Request ${requestId} cancelled`)
    })
    this.pendingRequests.clear()
  }

  // Build URL with query parameters
  _buildUrl(endpoint, params = {}) {
    const url = new URL(`${API_BASE_URL}/${endpoint}`)

    // Add query parameters
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        url.searchParams.append(key, value)
      }
    })

    return url.toString()
  }

  // Check if we're within rate limits
  _checkRateLimit() {
    const now = Date.now()

    // Remove timestamps outside the current window
    RATE_LIMIT.requestTimestamps = RATE_LIMIT.requestTimestamps.filter(
      (timestamp) => now - timestamp < RATE_LIMIT.timeWindow,
    )

    // Check if we've hit the limit
    if (RATE_LIMIT.requestTimestamps.length >= RATE_LIMIT.maxRequests) {
      const oldestTimestamp = RATE_LIMIT.requestTimestamps[0]
      const resetTime = oldestTimestamp + RATE_LIMIT.timeWindow
      const waitTime = resetTime - now

      throw new Error(`Rate limit exceeded. Try again in ${Math.ceil(waitTime / 1000)} seconds.`)
    }

    // Add current timestamp
    RATE_LIMIT.requestTimestamps.push(now)
  }

  // Make an HTTP request
  async _request(method, url, data = null, options = {}) {
    try {
      // Check rate limit
      this._checkRateLimit()

      // If using mock API, handle request with mock handler
      if (USE_MOCK_API) {
        // Extract endpoint from URL
        const urlObj = new URL(url)
        const endpoint = urlObj.pathname.replace(`${API_BASE_URL}/`, "")

        // Get auth token
        const token = await getAuthToken()

        // Handle mock request
        const response = await handleMockApiRequest(endpoint, method, data, token)

        // If error status, throw error
        if (response.status >= 400) {
          const error = new Error(response.body.error || "API request failed")
          error.status = response.status
          error.data = response.body
          throw error
        }

        return response.body
      }

      // Create abort controller for timeout and cancellation
      const controller = new AbortController()
      const { signal } = controller

      // Generate request ID
      const requestId = this.requestId++

      // Set up timeout
      const timeout = options.timeout || DEFAULT_TIMEOUT
      const timeoutId = setTimeout(() => {
        controller.abort()
        this.pendingRequests.delete(requestId)
        debugError(`Request ${requestId} timed out after ${timeout}ms`)
      }, timeout)

      // Store pending request
      this.pendingRequests.set(requestId, { controller, timeoutId })

      // Get auth token
      const token = await getAuthToken()

      // Prepare headers
      const headers = {
        "Content-Type": "application/json",
        Accept: "application/json",
        ...options.headers,
      }

      // Add auth token if available
      if (token) {
        headers["Authorization"] = `Bearer ${token}`
      }

      // Prepare request options
      const requestOptions = {
        method,
        headers,
        signal,
        credentials: "include",
        ...options,
      }

      // Add body for methods that support it
      if (data !== null && !["GET", "HEAD"].includes(method)) {
        if (data instanceof FormData) {
          // For FormData, don't set Content-Type, browser will set it with boundary
          delete requestOptions.headers["Content-Type"]
          requestOptions.body = data
        } else {
          requestOptions.body = JSON.stringify(data)
        }
      }

      debugLog(`Making ${method} request to ${url}`, { requestId })

      // Make the request
      const response = await fetch(url, requestOptions)

      // Clean up
      clearTimeout(timeoutId)
      this.pendingRequests.delete(requestId)

      // Parse response
      let responseData
      const contentType = response.headers.get("content-type")

      if (contentType && contentType.includes("application/json")) {
        responseData = await response.json()
      } else if (contentType && contentType.includes("text/")) {
        responseData = await response.text()
      } else {
        responseData = await response.blob()
      }

      // Handle error responses
      if (!response.ok) {
        const error = new Error(responseData.message || "API request failed")
        error.status = response.status
        error.data = responseData
        throw error
      }

      debugLog(`Request ${requestId} completed successfully`)
      return responseData
    } catch (error) {
      if (error.name === "AbortError") {
        throw new Error("Request was aborted")
      }

      debugError("API request error:", error)
      throw error
    }
  }
}

// Create singleton instance
const apiService = new ApiService()

export default apiService

