// Google OAuth authentication
import { debugLog, debugError } from "../debug.js"

// Google OAuth configuration
const GOOGLE_CLIENT_ID = "YOUR_GOOGLE_CLIENT_ID" // Replace with your actual client ID
const GOOGLE_REDIRECT_URI = chrome.identity.getRedirectURL()
const GOOGLE_SCOPES = [
  "https://www.googleapis.com/auth/userinfo.email",
  "https://www.googleapis.com/auth/userinfo.profile",
]

// Initialize Google OAuth
export async function initGoogleAuth() {
  try {
    debugLog("Initializing Google Auth")

    // Check if we already have a token
    const token = await getGoogleToken()
    if (token) {
      debugLog("Google token already exists")
      return token
    }

    // Start the OAuth flow
    return await startGoogleAuthFlow()
  } catch (error) {
    debugError("Error initializing Google Auth:", error)
    throw error
  }
}

// Get Google access token from storage
export async function getGoogleToken() {
  return new Promise((resolve) => {
    if (typeof chrome !== "undefined" && chrome.storage) {
      chrome.storage.sync.get("googleToken", (data) => {
        debugLog("Retrieved googleToken from storage:", data.googleToken ? "Token exists" : "No token")
        resolve(data.googleToken || null)
      })
    } else {
      debugError("Chrome storage API not available.")
      resolve(null)
    }
  })
}

// Save Google access token to storage
export async function saveGoogleToken(token) {
  return new Promise((resolve) => {
    if (typeof chrome !== "undefined" && chrome.storage) {
      debugLog("Saving googleToken to storage")
      chrome.storage.sync.set({ googleToken: token }, () => {
        if (chrome.runtime.lastError) {
          debugError("Error saving token:", chrome.runtime.lastError)
        } else {
          debugLog("Token saved successfully")
        }
        resolve()
      })
    } else {
      debugError("Chrome storage API not available.")
      resolve()
    }
  })
}

// Start Google OAuth flow
export async function startGoogleAuthFlow() {
  return new Promise((resolve, reject) => {
    try {
      debugLog("Starting Google Auth flow")

      // Construct the auth URL
      const authUrl = new URL("https://accounts.google.com/o/oauth2/auth")
      authUrl.searchParams.append("client_id", GOOGLE_CLIENT_ID)
      authUrl.searchParams.append("redirect_uri", GOOGLE_REDIRECT_URI)
      authUrl.searchParams.append("response_type", "token")
      authUrl.searchParams.append("scope", GOOGLE_SCOPES.join(" "))

      // Launch the auth flow
      if (typeof chrome !== "undefined" && chrome.identity) {
        chrome.identity.launchWebAuthFlow(
          {
            url: authUrl.toString(),
            interactive: true,
          },
          (responseUrl) => {
            if (chrome.runtime.lastError) {
              debugError("Auth flow error:", chrome.runtime.lastError)
              reject(new Error(chrome.runtime.lastError.message))
              return
            }

            if (!responseUrl) {
              debugError("No response URL")
              reject(new Error("Authentication failed"))
              return
            }

            // Extract the access token from the URL
            const urlParams = new URLSearchParams(new URL(responseUrl).hash.substring(1))
            const accessToken = urlParams.get("access_token")

            if (!accessToken) {
              debugError("No access token in response")
              reject(new Error("No access token received"))
              return
            }

            // Save the token
            saveGoogleToken(accessToken).then(() => {
              debugLog("Google Auth successful")
              resolve(accessToken)
            })
          },
        )
      } else {
        debugError("Chrome identity API not available.")
        reject(new Error("Chrome identity API not available."))
      }
    } catch (error) {
      debugError("Error in Google Auth flow:", error)
      reject(error)
    }
  })
}

// Get user info from Google
export async function getGoogleUserInfo(token) {
  try {
    debugLog("Getting Google user info")

    const response = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })

    if (!response.ok) {
      throw new Error(`Failed to get user info: ${response.status}`)
    }

    const userInfo = await response.json()
    debugLog("Got user info:", userInfo.email)

    return userInfo
  } catch (error) {
    debugError("Error getting user info:", error)
    throw error
  }
}

// Verify Google token is valid
export async function verifyGoogleToken(token) {
  try {
    debugLog("Verifying Google token")

    const response = await fetch(`https://www.googleapis.com/oauth2/v1/tokeninfo?access_token=${token}`)

    if (response.ok) {
      const data = await response.json()
      debugLog("Token verification successful")
      return true
    } else {
      debugError("Token verification failed:", await response.text())
      return false
    }
  } catch (error) {
    debugError("Error verifying token:", error)
    return false
  }
}

// Sign out from Google
export async function signOutGoogle() {
  return new Promise((resolve) => {
    if (typeof chrome !== "undefined" && chrome.storage) {
      chrome.storage.sync.remove("googleToken", () => {
        debugLog("Google token removed")
        resolve()
      })
    } else {
      debugError("Chrome storage API not available.")
      resolve()
    }
  })
}

