// Supabase client for authentication and storage
import { debugLog, debugError } from "../debug.js"

// Supabase configuration
const SUPABASE_URL = "https://your-supabase-project.supabase.co"
const SUPABASE_ANON_KEY = "your-supabase-anon-key"

// Initialize Supabase client
let supabase = null

// Initialize Supabase client
export async function initSupabase() {
  try {
    if (supabase) return supabase

    // Dynamically import Supabase JS client
    const { createClient } = await import("https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.38.4/+esm")

    supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        persistSession: false, // We'll handle session persistence ourselves
        autoRefreshToken: true,
        detectSessionInUrl: false, // We'll handle this ourselves
      },
    })

    debugLog("Supabase client initialized")
    return supabase
  } catch (error) {
    debugError("Error initializing Supabase client:", error)
    throw error
  }
}

// Get Supabase client (initialize if needed)
export async function getSupabase() {
  if (!supabase) {
    return await initSupabase()
  }
  return supabase
}

// Get current session
export async function getSession() {
  try {
    const client = await getSupabase()
    const { data, error } = await client.auth.getSession()

    if (error) {
      debugError("Error getting session:", error)
      return null
    }

    return data.session
  } catch (error) {
    debugError("Error getting session:", error)
    return null
  }
}

// Store session in Chrome storage
export async function storeSession(session) {
  return new Promise((resolve, reject) => {
    if (typeof chrome !== "undefined" && chrome.storage) {
      chrome.storage.local.set({ supabaseSession: session }, () => {
        if (chrome.runtime.lastError) {
          debugError("Error storing session:", chrome.runtime.lastError)
          reject(chrome.runtime.lastError)
        } else {
          debugLog("Session stored successfully")
          resolve()
        }
      })
    } else {
      debugError("Chrome storage API not available")
      reject(new Error("Chrome storage API not available"))
    }
  })
}

// Retrieve session from Chrome storage
export async function retrieveSession() {
  return new Promise((resolve) => {
    if (typeof chrome !== "undefined" && chrome.storage) {
      chrome.storage.local.get("supabaseSession", (data) => {
        if (chrome.runtime.lastError) {
          debugError("Error retrieving session:", chrome.runtime.lastError)
          resolve(null)
        } else {
          debugLog("Session retrieved:", data.supabaseSession ? "exists" : "not found")
          resolve(data.supabaseSession || null)
        }
      })
    } else {
      debugError("Chrome storage API not available")
      resolve(null)
    }
  })
}

// Clear session from Chrome storage
export async function clearSession() {
  return new Promise((resolve) => {
    if (typeof chrome !== "undefined" && chrome.storage) {
      chrome.storage.local.remove("supabaseSession", () => {
        if (chrome.runtime.lastError) {
          debugError("Error clearing session:", chrome.runtime.lastError)
        } else {
          debugLog("Session cleared successfully")
        }
        resolve()
      })
    } else {
      debugError("Chrome storage API not available")
      resolve()
    }
  })
}

// Helper function to handle Supabase errors
export function handleSupabaseError(error) {
  if (!error) return null

  debugError("Supabase error:", error)

  // Format error message
  let message = error.message || "An unknown error occurred"

  // Add additional context for specific error types
  if (error.code) {
    switch (error.code) {
      case "auth/invalid-email":
        message = "The email address is invalid."
        break
      case "auth/user-disabled":
        message = "This user account has been disabled."
        break
      case "auth/user-not-found":
        message = "No user found with this email address."
        break
      case "auth/wrong-password":
        message = "Incorrect password."
        break
      case "auth/email-already-in-use":
        message = "This email is already in use."
        break
      case "auth/weak-password":
        message = "The password is too weak."
        break
      case "auth/popup-closed-by-user":
        message = "Authentication was cancelled."
        break
      case "storage/unauthorized":
        message = "You don't have permission to access this resource."
        break
      case "storage/quota-exceeded":
        message = "Storage quota exceeded."
        break
    }
  }

  return { message, code: error.code, status: error.status }
}

