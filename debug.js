// Debug helper for the extension
const DEBUG = true

// Debug logger function
export function debugLog(...args) {
  if (DEBUG) {
    console.log("[Website-to-Figma]", ...args)
  }
}

// Error logger
export function debugError(...args) {
  if (DEBUG) {
    console.error("[Website-to-Figma ERROR]", ...args)
  }
}

// Function to check Chrome API availability
export function checkChromeAPI(apiName) {
  if (typeof chrome === "undefined" || !chrome) {
    debugError(`Chrome API not available`)
    return false
  }

  if (!chrome[apiName]) {
    debugError(`Chrome.${apiName} API not available`)
    return false
  }

  return true
}

// Function to check if the current environment is a Chrome extension