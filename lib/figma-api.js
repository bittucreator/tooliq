// At the beginning of the file, add this check to ensure chrome is defined
if (typeof chrome === "undefined") {
    console.warn("Chrome API not available in this context")
  }
  
  // Figma API integration
  
  // Figma API constants
  const FIGMA_API_BASE = "https://api.figma.com/v1"
  const FIGMA_OAUTH_URL = "https://www.figma.com/oauth"
  
  // Get Figma access token from storage
  export async function getFigmaToken() {
    return new Promise((resolve) => {
      if (typeof chrome !== "undefined" && chrome.storage) {
        chrome.storage.sync.get("figmaToken", (data) => {
          console.log("Retrieved figmaToken from storage:", data.figmaToken ? "Token exists" : "No token")
          resolve(data.figmaToken || null)
        })
      } else {
        console.warn("Chrome storage API not available.")
        resolve(null)
      }
    })
  }
  
  // Save Figma access token to storage
  export async function saveFigmaToken(token) {
    return new Promise((resolve) => {
      if (typeof chrome !== "undefined" && chrome.storage) {
        console.log("Saving figmaToken to storage")
        chrome.storage.sync.set({ figmaToken: token }, () => {
          if (chrome.runtime.lastError) {
            console.error("Error saving token:", chrome.runtime.lastError)
          } else {
            console.log("Token saved successfully")
          }
          resolve()
        })
      } else {
        console.warn("Chrome storage API not available.")
        resolve()
      }
    })
  }
  
  // Initialize Figma authentication
  export async function initFigmaAuth(clientId, redirectUri) {
    console.log("Initializing Figma auth with:", { clientId, redirectUri })
  
    // Check if we already have a token
    const token = await getFigmaToken()
    if (token) {
      console.log("Token already exists")
      return token
    }
  
    // Create the OAuth URL with state parameter for security
    const state = Math.random().toString(36).substring(2)
  
    // Store the state in local storage to verify when the redirect comes back
    if (typeof chrome !== "undefined" && chrome.storage) {
      chrome.storage.local.set({ figmaAuthState: state })
    }
  
    const authUrl = `${FIGMA_OAUTH_URL}?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=file_read file_write&state=${state}&response_type=code`
  
    console.log("Auth URL:", authUrl)
  
    // Open the auth window
    if (typeof chrome !== "undefined" && chrome.tabs) {
      chrome.tabs.create({ url: authUrl })
      console.log("Auth tab created")
    } else {
      console.warn("Chrome tabs API not available. Authentication URL:", authUrl)
      // Fallback: open in current window (less ideal)
      window.location.href = authUrl
    }
  
    // The redirect URI should be handled by the background script
    // which will exchange the code for a token
    return null
  }
  
  // Exchange authorization code for access token
  export async function exchangeCodeForToken(code, clientId, clientSecret, redirectUri) {
    console.log("Exchanging code for token:", { code, clientId, redirectUri })
  
    try {
      // Use a direct fetch to the Figma API
      const response = await fetch(`${FIGMA_OAUTH_URL}/token`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          client_id: clientId,
          client_secret: clientSecret,
          redirect_uri: redirectUri,
          code: code,
          grant_type: "authorization_code",
        }),
      })
  
      const data = await response.json()
      console.log("Token exchange response:", data)
  
      if (data.access_token) {
        await saveFigmaToken(data.access_token)
        return data.access_token
      } else {
        throw new Error("Failed to get access token: " + (data.error || "Unknown error"))
      }
    } catch (error) {
      console.error("Error exchanging code for token:", error)
      throw error
    }
  }
  
  // Verify Figma token is valid
  export async function verifyFigmaToken(token) {
    try {
      const response = await fetch(`${FIGMA_API_BASE}/me`, {
        headers: {
          "X-Figma-Token": token,
        },
      })
  
      if (response.ok) {
        const data = await response.json()
        console.log("Token verification successful:", data)
        return true
      } else {
        console.error("Token verification failed:", await response.text())
        return false
      }
    } catch (error) {
      console.error("Error verifying token:", error)
      return false
    }
  }
  
  // Create a new Figma file
  export async function createFigmaFile(name, nodes) {
    const token = await getFigmaToken()
    if (!token) {
      throw new Error("Figma authentication required")
    }
  
    try {
      // First, create an empty file
      const createResponse = await fetch(`${FIGMA_API_BASE}/files`, {
        method: "POST",
        headers: {
          "X-Figma-Token": token,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: name,
          thumbnail_url: "",
          workspace: "",
        }),
      })
  
      const fileData = await createResponse.json()
      if (!fileData.key) {
        throw new Error("Failed to create Figma file: " + (fileData.error || "Unknown error"))
      }
  
      const fileKey = fileData.key
  
      // Now we would need to add nodes to the file
      // This is a simplified version - in reality, this would be more complex
      // as the Figma API doesn't directly support adding multiple nodes at once
  
      // Return the file URL that users can open
      return {
        fileKey: fileKey,
        fileUrl: `https://www.figma.com/file/${fileKey}/${encodeURIComponent(name)}`,
      }
    } catch (error) {
      console.error("Error creating Figma file:", error)
      throw error
    }
  }
  
  // Convert our internal representation to Figma API format
  export function convertToFigmaNodes(figmaData) {
    // This would be a complex conversion from our internal format to Figma's API format
    // For now, this is a placeholder
    return figmaData
  }
  
  