// Authentication service using Supabase
import { debugLog, debugError } from "../debug.js"
import { getSupabase, storeSession, retrieveSession, clearSession, handleSupabaseError } from "./supabase-client.js"

// Auth events
const AUTH_EVENTS = {
  SIGNED_IN: "signed_in",
  SIGNED_OUT: "signed_out",
  TOKEN_REFRESHED: "token_refreshed",
  AUTH_ERROR: "auth_error",
}

// Check if running in a Chrome extension environment
const isChromeExtension = typeof chrome !== "undefined" && chrome.identity && chrome.identity.getRedirectURL

class AuthService {
  constructor() {
    this.currentUser = null
    this.session = null
    this.eventListeners = new Map()

    // Initialize from storage
    this._loadFromStorage()
  }

  // Initialize auth state from storage
  async _loadFromStorage() {
    try {
      // Get session from storage
      const storedSession = await retrieveSession()

      if (storedSession) {
        this.session = storedSession
        this.currentUser = storedSession.user

        // Verify session is still valid
        const supabase = await getSupabase()
        const { data, error } = await supabase.auth.getUser()

        if (error) {
          debugError("Stored session is invalid:", error)
          this.session = null
          this.currentUser = null
          await clearSession()
        } else if (data && data.user) {
          this.currentUser = data.user
          debugLog("Auth state loaded from storage")
        }
      }
    } catch (error) {
      debugError("Error loading auth state from storage:", error)
    }
  }

  // Sign in with email and password
  async signInWithEmailPassword(email, password) {
    try {
      const supabase = await getSupabase()
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (error) throw handleSupabaseError(error)

      this.session = data.session
      this.currentUser = data.user

      // Store session
      await storeSession(data.session)

      this._emitEvent(AUTH_EVENTS.SIGNED_IN, { user: this.currentUser })

      return this.currentUser
    } catch (error) {
      this._emitEvent(AUTH_EVENTS.AUTH_ERROR, { error })
      throw error
    }
  }

  // Sign in with Google OAuth
  async signInWithGoogle() {
    if (!isChromeExtension) {
      throw new Error("Chrome identity API not available")
    }

    try {
      // Get Supabase client
      const supabase = await getSupabase()

      // Get the OAuth URL
      const {
        data: { url },
        error: urlError,
      } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: chrome.identity.getRedirectURL(),
          skipBrowserRedirect: true,
        },
      })

      if (urlError) throw handleSupabaseError(urlError)

      // Launch Chrome identity flow
      const responseUrl = await new Promise((resolve, reject) => {
        chrome.identity.launchWebAuthFlow(
          {
            url: url,
            interactive: true,
          },
          (responseUrl) => {
            if (chrome.runtime.lastError) {
              reject(new Error(chrome.runtime.lastError.message))
            } else {
              resolve(responseUrl)
            }
          },
        )
      })

      // Extract hash or query parameters from the response URL
      const hashParams = new URLSearchParams(new URL(responseUrl).hash.substring(1))
      const queryParams = new URLSearchParams(new URL(responseUrl).search)

      // Check for access token in hash (implicit flow)
      if (hashParams.has("access_token")) {
        const accessToken = hashParams.get("access_token")
        const refreshToken = hashParams.get("refresh_token")
        const expiresIn = hashParams.get("expires_in")

        // Exchange the token for a session
        const { data, error } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        })

        if (error) throw handleSupabaseError(error)

        this.session = data.session
        this.currentUser = data.user

        // Store session
        await storeSession(data.session)

        this._emitEvent(AUTH_EVENTS.SIGNED_IN, { user: this.currentUser })

        return this.currentUser
      }

      // Check for code in query parameters (authorization code flow)
      if (queryParams.has("code")) {
        const code = queryParams.get("code")

        // Exchange the code for a session
        const { data, error } = await supabase.auth.exchangeCodeForSession(code)

        if (error) throw handleSupabaseError(error)

        this.session = data.session
        this.currentUser = data.user

        // Store session
        await storeSession(data.session)

        this._emitEvent(AUTH_EVENTS.SIGNED_IN, { user: this.currentUser })

        return this.currentUser
      }

      throw new Error("No authentication data found in response")
    } catch (error) {
      this._emitEvent(AUTH_EVENTS.AUTH_ERROR, { error })
      throw error
    }
  }

  // Sign out
  async signOut() {
    try {
      if (this.session) {
        // Sign out from Supabase
        const supabase = await getSupabase()
        const { error } = await supabase.auth.signOut()

        if (error) {
          debugError("Error during Supabase signout:", error)
        }
      }

      // Clear local state
      this.session = null
      this.currentUser = null

      // Clear session from storage
      await clearSession()

      this._emitEvent(AUTH_EVENTS.SIGNED_OUT)

      return true
    } catch (error) {
      debugError("Error during sign out:", error)
      throw error
    }
  }

  // Register a new user
  async register(email, password, userData = {}) {
    try {
      const supabase = await getSupabase()

      // Register user
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: userData,
        },
      })

      if (error) throw handleSupabaseError(error)

      // Check if email confirmation is required
      if (data.user && data.user.identities && data.user.identities.length === 0) {
        return { requiresEmailConfirmation: true }
      }

      this.session = data.session
      this.currentUser = data.user

      // Store session
      if (data.session) {
        await storeSession(data.session)
      }

      this._emitEvent(AUTH_EVENTS.SIGNED_IN, { user: this.currentUser })

      return this.currentUser
    } catch (error) {
      this._emitEvent(AUTH_EVENTS.AUTH_ERROR, { error })
      throw error
    }
  }

  // Reset password
  async resetPassword(email) {
    try {
      const supabase = await getSupabase()

      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: isChromeExtension
          ? chrome.runtime.getURL("reset-password.html")
          : window.location.origin + "/reset-password.html",
      })

      if (error) throw handleSupabaseError(error)

      return true
    } catch (error) {
      this._emitEvent(AUTH_EVENTS.AUTH_ERROR, { error })
      throw error
    }
  }

  // Update password
  async updatePassword(newPassword) {
    try {
      const supabase = await getSupabase()

      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      })

      if (error) throw handleSupabaseError(error)

      return true
    } catch (error) {
      this._emitEvent(AUTH_EVENTS.AUTH_ERROR, { error })
      throw error
    }
  }

  // Update user profile
  async updateProfile(profileData) {
    try {
      const supabase = await getSupabase()

      const { data, error } = await supabase.auth.updateUser({
        data: profileData,
      })

      if (error) throw handleSupabaseError(error)

      // Update current user data
      this.currentUser = data.user

      return this.currentUser
    } catch (error) {
      this._emitEvent(AUTH_EVENTS.AUTH_ERROR, { error })
      throw error
    }
  }

  // Get current user
  async getCurrentUser(forceRefresh = false) {
    if (this.currentUser && !forceRefresh) {
      return this.currentUser
    }

    try {
      const supabase = await getSupabase()
      const { data, error } = await supabase.auth.getUser()

      if (error) throw handleSupabaseError(error)

      this.currentUser = data.user

      return this.currentUser
    } catch (error) {
      debugError("Error getting current user:", error)
      throw error
    }
  }

  // Get auth token
  async getAuthToken() {
    if (!this.session) {
      const session = await retrieveSession()
      if (session) {
        this.session = session
      } else {
        throw new Error("No active session")
      }
    }

    return this.session.access_token
  }

  // Check if user is authenticated
  isAuthenticated() {
    return !!this.session && !!this.currentUser
  }

  // Refresh auth token
  async refreshAuthToken() {
    try {
      const supabase = await getSupabase()
      const { data, error } = await supabase.auth.refreshSession()

      if (error) throw handleSupabaseError(error)

      this.session = data.session
      this.currentUser = data.user

      // Store updated session
      await storeSession(data.session)

      this._emitEvent(AUTH_EVENTS.TOKEN_REFRESHED)

      return this.session.access_token
    } catch (error) {
      debugError("Error refreshing token:", error)

      // If refresh fails, clear auth state
      await this.signOut()

      throw error
    }
  }

  // Add event listener
  addEventListener(event, listener) {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, [])
    }

    this.eventListeners.get(event).push(listener)

    // Return function to remove the listener
    return () => this.removeEventListener(event, listener)
  }

  // Remove event listener
  removeEventListener(event, listener) {
    if (!this.eventListeners.has(event)) {
      return
    }

    const listeners = this.eventListeners.get(event)
    const index = listeners.indexOf(listener)

    if (index !== -1) {
      listeners.splice(index, 1)
    }

    if (listeners.length === 0) {
      this.eventListeners.delete(event)
    }
  }

  // Emit event
  _emitEvent(event, data = {}) {
    if (this.eventListeners.has(event)) {
      const listeners = this.eventListeners.get(event)
      listeners.forEach((listener) => {
        try {
          listener(data)
        } catch (error) {
          debugError(`Error in ${event} listener:`, error)
        }
      })
    }

    // Also emit to 'all' listeners
    if (this.eventListeners.has("all")) {
      const listeners = this.eventListeners.get("all")
      listeners.forEach((listener) => {
        try {
          listener({ event, data })
        } catch (error) {
          debugError(`Error in 'all' event listener:`, error)
        }
      })
    }
  }
}

// Create singleton instance
const authService = new AuthService()

// Export auth events
export { AUTH_EVENTS }

// Export getAuthToken for use by other services
export const getAuthToken = async () => {
  return authService.isAuthenticated() ? await authService.getAuthToken() : null
}

export default authService

