// Check for Chrome API availability at the beginning
if (typeof chrome === "undefined") {
  // Mock the chrome API for testing purposes
  var chrome = {
    storage: {
      sync: {
        get: (keys, callback) => {
          console.log("chrome.storage.sync.get mock called")
          callback({})
        },
        set: (items, callback) => {
          console.log("chrome.storage.sync.set mock called")
          if (callback) callback()
        },
        remove: (keys, callback) => {
          console.log("chrome.storage.sync.remove mock called")
          if (callback) callback()
        },
      },
    },
    tabs: {
      query: (queryInfo, callback) => {
        console.log("chrome.tabs.query mock called")
        callback([])
      },
      sendMessage: (tabId, message, callback) => {
        console.log("chrome.tabs.sendMessage mock called")
        if (callback) callback({})
      },
    },
    runtime: {
      lastError: null,
      sendMessage: (message, callback) => {
        console.log("chrome.runtime.sendMessage mock called")
        if (callback) callback({})
      },
    },
  }
  console.warn("Chrome API not available in this context")
}

// Import config
import { FIGMA_CONFIG } from "./config.js"
import { debugLog, debugError } from "./debug.js"
import authService, { AUTH_EVENTS } from "./lib/auth-service.js"
import stripeService from "./lib/stripe-service.js"

// Function to show notification
function showNotification(title, message) {
  const notification = document.createElement("div")
  notification.classList.add("notification")

  notification.innerHTML = `
    <div class="notification-content">
      <h3>${title}</h3>
      <p>${message}</p>
    </div>
    <button class="notification-close">&times;</button>
  `

  document.body.appendChild(notification)

  const closeBtn = notification.querySelector(".notification-close")
  closeBtn.addEventListener("click", () => {
    notification.remove()
  })

  // Automatically remove the notification after 5 seconds
  setTimeout(() => {
    notification.remove()
  }, 5000)
}

// Function to decrement extractions left
function decrementExtractions() {
  chrome.storage.sync.get(["extractionsLeft"], (data) => {
    let extractionsLeft = data.extractionsLeft !== undefined ? data.extractionsLeft : 5
    if (extractionsLeft > 0) {
      extractionsLeft--
      chrome.storage.sync.set({ extractionsLeft: extractionsLeft }, () => {
        updatePlanUI("free", extractionsLeft)
      })
    }
  })
}

// Function to set up tab switching
function setupTabSwitching() {
  debugLog("Setting up tab switching")

  const tabButtons = document.querySelectorAll(".tab-btn")
  const tabContents = document.querySelectorAll(".tab-content")

  if (tabButtons.length === 0) {
    debugError("No tab buttons found")
    return
  }

  tabButtons.forEach((button) => {
    button.addEventListener("click", () => {
      debugLog(`Tab clicked: ${button.dataset.tab}`)

      // Remove active class from all buttons and contents
      tabButtons.forEach((btn) => btn.classList.remove("active"))
      tabContents.forEach((content) => content.classList.remove("active"))

      // Add active class to clicked button and corresponding content
      button.classList.add("active")
      const tabId = `${button.dataset.tab}-tab`
      const tabContent = document.getElementById(tabId)

      if (tabContent) {
        tabContent.classList.add("active")
      } else {
        debugError(`Tab content not found: ${tabId}`)
      }
    })
  })
}

// Function to set up all event listeners
function setupEventListeners() {
  debugLog("Setting up event listeners")

  // Save customizations button
  const saveCustomizeBtn = document.getElementById("save-customize-btn")
  if (saveCustomizeBtn) {
    saveCustomizeBtn.addEventListener("click", saveCustomizations)
  } else {
    debugError("Save customize button not found")
  }

  // Select element button
  const selectElementBtn = document.getElementById("select-element-btn")
  if (selectElementBtn) {
    selectElementBtn.addEventListener("click", startElementSelection)
  } else {
    debugError("Select element button not found")
  }

  // Extract button
  const extractBtn = document.getElementById("extract-btn")
  if (extractBtn) {
    extractBtn.addEventListener("click", handleExtractButtonClick)
    debugLog("Extract button event listener added")
  } else {
    debugError("Extract button not found")
  }

  // Save settings button
  const saveSettingsBtn = document.getElementById("save-settings-btn")
  if (saveSettingsBtn) {
    saveSettingsBtn.addEventListener("click", saveSettings)
  } else {
    debugError("Save settings button not found")
  }

  // Figma authentication button
  const figmaAuthBtn = document.getElementById("figma-auth-btn")
  if (figmaAuthBtn) {
    figmaAuthBtn.addEventListener("click", handleFigmaAuth)
  } else {
    debugError("Figma auth button not found")
  }
}

// Function to set up authentication
function setupAuthentication() {
  debugLog("Setting up authentication")

  // Get login elements
  const loginContainer = document.getElementById("login-container")
  const mainContainer = document.getElementById("main-container")
  const googleLoginBtn = document.getElementById("google-login-btn")

  // Get user profile elements
  const googleAuthStatus = document.getElementById("google-auth-status")
  const googleAuthBtn = document.getElementById("google-auth-btn")

  // Check if user is already authenticated
  if (authService.isAuthenticated()) {
    // Show main container, hide login
    if (loginContainer) loginContainer.style.display = "none"
    if (mainContainer) mainContainer.style.display = "block"

    // Update auth status
    if (googleAuthStatus) {
      const user = authService.currentUser
      googleAuthStatus.textContent = `Signed in as ${user.email}`
      googleAuthStatus.classList.add("connected")
    }

    // Update auth button
    if (googleAuthBtn) {
      googleAuthBtn.textContent = "Sign Out"
    }
  } else {
    // Show login container, hide main
    if (loginContainer) loginContainer.style.display = "block"
    if (mainContainer) mainContainer.style.display = "none"
  }

  // Add event listener for Google login button
  if (googleLoginBtn) {
    googleLoginBtn.addEventListener("click", handleGoogleLogin)
  } else {
    debugError("Google login button not found")
  }

  // Add event listener for Google auth button (sign out)
  if (googleAuthBtn) {
    googleAuthBtn.addEventListener("click", handleGoogleAuth)
  } else {
    debugError("Google auth button not found")
  }

  // Listen for auth events
  authService.addEventListener(AUTH_EVENTS.SIGNED_IN, () => {
    // Show main container, hide login
    if (loginContainer) loginContainer.style.display = "none"
    if (mainContainer) mainContainer.style.display = "block"

    // Update auth status
    if (googleAuthStatus) {
      const user = authService.currentUser
      googleAuthStatus.textContent = `Signed in as ${user.email}`
      googleAuthStatus.classList.add("connected")
    }

    // Update auth button
    if (googleAuthBtn) {
      googleAuthBtn.textContent = "Sign Out"
    }
  })

  authService.addEventListener(AUTH_EVENTS.SIGNED_OUT, () => {
    // Show login container, hide main
    if (loginContainer) loginContainer.style.display = "block"
    if (mainContainer) mainContainer.style.display = "none"

    // Update auth status
    if (googleAuthStatus) {
      googleAuthStatus.textContent = "Not signed in"
      googleAuthStatus.classList.remove("connected")
    }

    // Update auth button
    if (googleAuthBtn) {
      googleAuthBtn.textContent = "Sign In"
    }
  })
}

// Function to handle Google login
async function handleGoogleLogin() {
  debugLog("Google login button clicked")

  const loginBtn = document.getElementById("google-login-btn")
  if (loginBtn) {
    loginBtn.textContent = "Signing in..."
    loginBtn.disabled = true
  }

  try {
    await authService.signInWithGoogle()
    debugLog("Google sign in successful")
  } catch (error) {
    debugError("Google sign in error:", error)
    showNotification("Sign In Error", error.message || "Failed to sign in with Google")

    if (loginBtn) {
      loginBtn.textContent = "Sign in with Google"
      loginBtn.disabled = false
    }
  }
}

// Function to handle Google auth button (sign in/out)
async function handleGoogleAuth() {
  debugLog("Google auth button clicked")

  const authBtn = document.getElementById("google-auth-btn")

  if (authService.isAuthenticated()) {
    // Sign out
    if (authBtn) {
      authBtn.textContent = "Signing out..."
      authBtn.disabled = true
    }

    try {
      await authService.signOut()
      debugLog("Sign out successful")

      if (authBtn) {
        authBtn.textContent = "Sign In"
        authBtn.disabled = false
      }
    } catch (error) {
      debugError("Sign out error:", error)
      showNotification("Sign Out Error", error.message || "Failed to sign out")

      if (authBtn) {
        authBtn.textContent = "Sign Out"
        authBtn.disabled = false
      }
    }
  } else {
    // Sign in
    if (authBtn) {
      authBtn.textContent = "Signing in..."
      authBtn.disabled = true
    }

    try {
      await authService.signInWithGoogle()
      debugLog("Google sign in successful")

      if (authBtn) {
        authBtn.textContent = "Sign Out"
        authBtn.disabled = false
      }
    } catch (error) {
      debugError("Google sign in error:", error)
      showNotification("Sign In Error", error.message || "Failed to sign in with Google")

      if (authBtn) {
        authBtn.textContent = "Sign In"
        authBtn.disabled = false
      }
    }
  }
}

// Function to save customizations
function saveCustomizations() {
  debugLog("Saving customizations")

  const customizations = {
    colors: {
      primary: document.getElementById("primary-color")?.value || "#0070f3",
      secondary: document.getElementById("secondary-color")?.value || "#7928ca",
      text: document.getElementById("text-color")?.value || "#333333",
      background: document.getElementById("background-color")?.value || "#ffffff",
    },
    typography: {
      headingFont: document.getElementById("heading-font")?.value || "Inter",
      bodyFont: document.getElementById("body-font")?.value || "Inter",
    },
    layout: {
      responsive: document.getElementById("responsive-layout")?.checked || true,
      optimizeSpacing: document.getElementById("optimize-spacing")?.checked || true,
      containerWidth: document.getElementById("container-width")?.value || "1280",
    },
  }

  chrome.storage.sync.set({ customizations: customizations }, () => {
    const saveBtn = document.getElementById("save-customize-btn")
    if (saveBtn) {
      saveBtn.textContent = "Saved!"
      setTimeout(() => {
        saveBtn.textContent = "Save Customizations"
      }, 1500)
    }
  })
}

// Function to start element selection
function startElementSelection() {
  debugLog("Starting element selection")

  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs.length > 0) {
      debugLog("Sending startSelection message to tab:", tabs[0].id)

      chrome.tabs.sendMessage(tabs[0].id, { action: "startSelection" }, (response) => {
        if (chrome.runtime.lastError) {
          debugError("Error sending startSelection message:", chrome.runtime.lastError)

          // Try injecting the content script and retrying
          chrome.scripting.executeScript(
            {
              target: { tabId: tabs[0].id },
              files: ["content.js"],
            },
            () => {
              // Retry sending the message after injecting the script
              setTimeout(() => {
                chrome.tabs.sendMessage(tabs[0].id, { action: "startSelection" }, (retryResponse) => {
                  if (chrome.runtime.lastError) {
                    debugError("Error on retry:", chrome.runtime.lastError)
                    showNotification(
                      "Error",
                      "Could not start element selection. Please refresh the page and try again.",
                    )
                  } else {
                    debugLog("Selection started on retry, closing popup")
                    window.close() // Close popup to allow selection
                  }
                })
              }, 500)
            },
          )
        } else {
          debugLog("Selection started, closing popup")
          window.close() // Close popup to allow selection
        }
      })
    } else {
      debugError("No active tab found")
      showNotification("Error", "No active tab found. Please try again.")
    }
  })
}

// Function to extract website
function handleExtractButtonClick() {
  debugLog("Extract button clicked")

  // Check if user can extract
  canExtract().then((canProceed) => {
    if (!canProceed) {
      showNotification("Extraction Limit Reached", "Upgrade to Premium for unlimited extractions.")
      return
    }

    extractWebsite()
  })
}

function extractWebsite() {
  // Get all settings
  const settings = {
    figmaExport: document.getElementById("figma-export")?.checked || true,
    nextjsExport: document.getElementById("nextjs-export")?.checked || true,
    scope: document.getElementById("full-page")?.checked ? "fullPage" : "selectedElement",
    detectionLevel: document.getElementById("detection-level")?.value || "7",
    useTypescript: document.getElementById("use-typescript")?.checked || true,
    useTailwind: document.getElementById("use-tailwind")?.checked || true,
    appRouter: document.getElementById("app-router")?.checked || true,
    autoLayout: document.getElementById("auto-layout")?.checked || true,
    componentVariants: document.getElementById("component-variants")?.checked || false,
    exportType: document.querySelector('input[name="export-type"]:checked')?.id || "export-zip",
  }

  debugLog("Extraction settings:", settings)

  // Show loading state
  const extractBtn = document.getElementById("extract-btn")
  if (extractBtn) {
    extractBtn.textContent = "Extracting..."
    extractBtn.disabled = true
  }

  // Get customizations
  chrome.storage.sync.get("customizations", (data) => {
    if (data.customizations) {
      settings.customizations = data.customizations
    }

    // Send message to content script
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs.length > 0) {
        debugLog("Sending extract message to tab:", tabs[0].id)

        try {
          chrome.tabs.sendMessage(
            tabs[0].id,
            {
              action: "extract",
              settings: settings,
            },
            (response) => {
              if (chrome.runtime.lastError) {
                debugError("Error sending extract message:", chrome.runtime.lastError)

                // Try injecting the content script and retrying
                chrome.scripting.executeScript(
                  {
                    target: { tabId: tabs[0].id },
                    files: ["content.js"],
                  },
                  () => {
                    // Retry sending the message after injecting the script
                    setTimeout(() => {
                      chrome.tabs.sendMessage(
                        tabs[0].id,
                        {
                          action: "extract",
                          settings: settings,
                        },
                        (retryResponse) => {
                          handleExtractResponse(retryResponse, extractBtn)
                          if (retryResponse && retryResponse.success) {
                            decrementExtractions()
                          }
                        },
                      )
                    }, 500)
                  },
                )
              } else {
                handleExtractResponse(response, extractBtn)
                if (response && response.success) {
                  decrementExtractions()
                }
              }
            },
          )
        } catch (error) {
          debugError("Exception sending extract message:", error)
          if (extractBtn) {
            extractBtn.textContent = "Error! Try Again"
            setTimeout(() => {
              extractBtn.textContent = "Extract Design & Code"
              extractBtn.disabled = false
            }, 2000)
          }
        }
      } else {
        debugError("No active tab found")
        if (extractBtn) {
          extractBtn.textContent = "Error! Try Again"
          setTimeout(() => {
            extractBtn.textContent = "Extract Design & Code"
            extractBtn.disabled = false
          }, 2000)
        }
      }
    })
  })
}

// Helper function to handle extract response
function handleExtractResponse(response, extractBtn) {
  if (response && response.success) {
    debugLog("Extraction successful")
    if (extractBtn) {
      extractBtn.textContent = "Extraction Complete!"
      setTimeout(() => {
        extractBtn.textContent = "Extract Design & Code"
        extractBtn.disabled = false
      }, 2000)
    }
  } else {
    debugError("Extraction failed or no response")
    if (extractBtn) {
      extractBtn.textContent = "Error! Try Again"
      setTimeout(() => {
        extractBtn.textContent = "Extract Design & Code"
        extractBtn.disabled = false
      }, 2000)
    }
  }
}

// Function to save settings
function saveSettings() {
  debugLog("Saving settings")

  const settings = {
    useTypescript: document.getElementById("use-typescript")?.checked || true,
    useTailwind: document.getElementById("use-tailwind")?.checked || true,
    appRouter: document.getElementById("app-router")?.checked || true,
    autoLayout: document.getElementById("auto-layout")?.checked || true,
    componentVariants: document.getElementById("component-variants")?.checked || false,
  }

  chrome.storage.sync.set({ settings: settings }, () => {
    const saveBtn = document.getElementById("save-settings-btn")
    if (saveBtn) {
      saveBtn.textContent = "Saved!"
      setTimeout(() => {
        saveBtn.textContent = "Save Settings"
      }, 1500)
    }
  })
}

// Function to handle Figma authentication
function handleFigmaAuth() {
  debugLog("Handling Figma auth")

  const figmaAuthStatus = document.getElementById("figma-auth-status")
  const figmaAuthBtn = document.getElementById("figma-auth-btn")

  chrome.storage.sync.get("figmaToken", (data) => {
    if (data.figmaToken) {
      // Disconnect from Figma
      chrome.storage.sync.remove("figmaToken", () => {
        if (figmaAuthStatus) figmaAuthStatus.textContent = "Not connected to Figma"
        if (figmaAuthStatus) figmaAuthStatus.classList.remove("connected")
        if (figmaAuthBtn) figmaAuthBtn.textContent = "Connect to Figma"
      })
    } else {
      // Connect to Figma using config values
      chrome.runtime.sendMessage(
        {
          action: "authenticateFigma",
          clientId: FIGMA_CONFIG.CLIENT_ID,
          redirectUri: FIGMA_CONFIG.REDIRECT_URI,
        },
        (response) => {
          if (chrome.runtime.lastError) {
            debugError("Error sending authenticateFigma message:", chrome.runtime.lastError)
            showNotification("Figma Connection Error", "Failed to connect to Figma. Please try again.")
            return
          }

          if (response && response.success) {
            if (figmaAuthStatus) figmaAuthStatus.textContent = "Connected to Figma"
            if (figmaAuthStatus) figmaAuthStatus.classList.add("connected")
            if (figmaAuthBtn) figmaAuthBtn.textContent = "Disconnect"
          }
        },
      )
    }
  })
}

// Function to load saved settings and customizations
function loadSavedSettings() {
  debugLog("Loading saved settings")

  // Load saved settings
  chrome.storage.sync.get("settings", (data) => {
    if (data.settings) {
      const useTypescript = document.getElementById("use-typescript")
      const useTailwind = document.getElementById("use-tailwind")
      const appRouter = document.getElementById("app-router")
      const autoLayout = document.getElementById("auto-layout")
      const componentVariants = document.getElementById("component-variants")

      if (useTypescript) useTypescript.checked = data.settings.useTypescript
      if (useTailwind) useTailwind.checked = data.settings.useTailwind
      if (appRouter) appRouter.checked = data.settings.appRouter
      if (autoLayout) autoLayout.checked = data.settings.autoLayout
      if (componentVariants) componentVariants.checked = data.settings.componentVariants
    }
  })

  // Load saved customizations
  chrome.storage.sync.get("customizations", (data) => {
    if (data.customizations) {
      const c = data.customizations

      // Set color values
      const primaryColor = document.getElementById("primary-color")
      const secondaryColor = document.getElementById("secondary-color")
      const textColor = document.getElementById("text-color")
      const backgroundColor = document.getElementById("background-color")

      if (primaryColor) primaryColor.value = c.colors.primary
      if (secondaryColor) secondaryColor.value = c.colors.secondary
      if (textColor) textColor.value = c.colors.text
      if (backgroundColor) backgroundColor.value = c.colors.background

      // Set typography values
      const headingFont = document.getElementById("heading-font")
      const bodyFont = document.getElementById("body-font")

      if (headingFont) headingFont.value = c.typography.headingFont
      if (bodyFont) bodyFont.value = c.typography.bodyFont

      // Set layout values
      const responsiveLayout = document.getElementById("responsive-layout")
      const optimizeSpacing = document.getElementById("optimize-spacing")
      const containerWidth = document.getElementById("container-width")

      if (responsiveLayout) responsiveLayout.checked = c.layout.responsive
      if (optimizeSpacing) optimizeSpacing.checked = c.layout.optimizeSpacing
      if (containerWidth) containerWidth.value = c.layout.containerWidth
    }
  })

  // Check if we're already authenticated with Figma
  checkFigmaAuthStatus()
}

// Function to check Figma authentication status
function checkFigmaAuthStatus() {
  const figmaAuthStatus = document.getElementById("figma-auth-status")
  const figmaAuthBtn = document.getElementById("figma-auth-btn")

  // First check if we have a token in storage
  chrome.storage.sync.get("figmaToken", (data) => {
    if (data.figmaToken) {
      // We have a token, now verify if it's still valid
      chrome.runtime.sendMessage({ action: "checkFigmaAuth" }, (response) => {
        if (response && response.authenticated) {
          // Token is valid
          if (figmaAuthStatus) {
            figmaAuthStatus.textContent = "Connected to Figma"
            figmaAuthStatus.classList.add("connected")
          }
          if (figmaAuthBtn) figmaAuthBtn.textContent = "Disconnect"
        } else {
          // Token is invalid or expired
          if (figmaAuthStatus) {
            figmaAuthStatus.textContent = "Figma connection expired"
            figmaAuthStatus.classList.remove("connected")
          }
          if (figmaAuthBtn) figmaAuthBtn.textContent = "Connect to Figma"

          // Remove the invalid token
          chrome.storage.sync.remove("figmaToken")
        }
      })
    } else {
      // No token found
      if (figmaAuthStatus) {
        figmaAuthStatus.textContent = "Not connected to Figma"
        figmaAuthStatus.classList.remove("connected")
      }
      if (figmaAuthBtn) figmaAuthBtn.textContent = "Connect to Figma"
    }
  })
}

// Add these functions after the loadSavedSettings function

// Function to initialize plans
function initializePlans() {
  debugLog("Initializing plans")

  // Initialize Stripe
  stripeService
    .initialize()
    .then(() => {
      debugLog("Stripe initialized successfully")
    })
    .catch((error) => {
      debugError("Failed to initialize Stripe:", error)
    })

  // Check subscription status
  checkSubscriptionStatus()

  // Add event listener for upgrade button
  const upgradeBtn = document.getElementById("upgrade-btn")
  if (upgradeBtn) {
    upgradeBtn.addEventListener("click", handleUpgrade)
  }

  // Add event listener for manage subscription button
  const manageSubBtn = document.getElementById("manage-subscription-btn")
  if (manageSubBtn) {
    manageSubBtn.addEventListener("click", handleManageSubscription)
  }
}

// Add this function to check subscription status
async function checkSubscriptionStatus() {
  try {
    // Check if user is authenticated
    if (!authService.isAuthenticated()) {
      updatePlanUI("free", 5)
      return
    }

    // Check if user has active subscription
    const hasSubscription = await stripeService.hasActiveSubscription()

    if (hasSubscription) {
      // Get subscription details
      const details = await stripeService.getSubscriptionDetails()

      // Update UI based on subscription
      updatePlanUI("premium", 0, details)
    } else {
      // Load free plan data
      chrome.storage.sync.get(["extractionsLeft"], (data) => {
        const extractionsLeft = data.extractionsLeft !== undefined ? data.extractionsLeft : 5
        updatePlanUI("free", extractionsLeft)
      })
    }
  } catch (error) {
    debugError("Error checking subscription status:", error)

    // Fallback to free plan
    chrome.storage.sync.get(["extractionsLeft"], (data) => {
      const extractionsLeft = data.extractionsLeft !== undefined ? data.extractionsLeft : 5
      updatePlanUI("free", extractionsLeft)
    })
  }
}

// Update the updatePlanUI function to show subscription details
function updatePlanUI(planType, extractionsLeft, subscriptionDetails = null) {
  const freePlanStatus = document.getElementById("free-plan-status")
  const extractionsLeftElem = document.getElementById("extractions-left")
  const upgradeBtn = document.getElementById("upgrade-btn")
  const manageSubBtn = document.getElementById("manage-subscription-btn")
  const freePlan = document.getElementById("free-plan")
  const premiumPlan = document.getElementById("premium-plan")
  const subscriptionInfo = document.getElementById("subscription-info")

  if (planType === "premium") {
    if (freePlanStatus) freePlanStatus.textContent = "Basic Plan"
    if (extractionsLeftElem) extractionsLeftElem.textContent = "Unlimited extractions"

    if (upgradeBtn) {
      upgradeBtn.style.display = "none"
    }

    if (manageSubBtn) {
      manageSubBtn.style.display = "block"
    }

    if (premiumPlan) premiumPlan.style.border = "2px solid var(--primary)"
    if (freePlan) freePlan.style.border = "1px solid var(--border)"

    // Show subscription details if available
    if (subscriptionInfo && subscriptionDetails) {
      const renewalDate = new Date(subscriptionDetails.currentPeriodEnd * 1000).toLocaleDateString()
      const planName = subscriptionDetails.planName || "Premium"

      subscriptionInfo.innerHTML = `
        <div class="subscription-details">
          <p><strong>Plan:</strong> ${planName}</p>
          <p><strong>Status:</strong> ${subscriptionDetails.status}</p>
          <p><strong>Renews:</strong> ${renewalDate}</p>
        </div>
      `
      subscriptionInfo.style.display = "block"
    }
  } else {
    if (freePlanStatus) freePlanStatus.textContent = "Current Plan"
    if (extractionsLeftElem) extractionsLeftElem.textContent = `${extractionsLeft} extractions left`

    if (upgradeBtn) {
      upgradeBtn.textContent = "Upgrade Now"
      upgradeBtn.style.display = "block"
      upgradeBtn.disabled = false
    }

    if (manageSubBtn) {
      manageSubBtn.style.display = "none"
    }

    if (freePlan) freePlan.style.border = "2px solid var(--primary)"
    if (premiumPlan) premiumPlan.style.border = "1px solid var(--border)"

    // Hide subscription info
    if (subscriptionInfo) {
      subscriptionInfo.style.display = "none"
    }
  }
}

// Update the handleUpgrade function to use Stripe
async function handleUpgrade() {
  debugLog("Handling upgrade")

  // Check if user is authenticated
  if (!authService.isAuthenticated()) {
    showNotification("Authentication Required", "Please sign in to upgrade your plan.")
    return
  }

  try {
    // Show loading state
    const upgradeBtn = document.getElementById("upgrade-btn")
    if (upgradeBtn) {
      upgradeBtn.textContent = "Processing..."
      upgradeBtn.disabled = true
    }

    // Get success and cancel URLs
    const successUrl = chrome.runtime.getURL("popup.html?upgrade=success")
    const cancelUrl = chrome.runtime.getURL("popup.html?upgrade=canceled")

    // Create checkout session
    await stripeService.createCheckoutSession("MONTHLY", successUrl, cancelUrl)

    // Note: The user will be redirected to Stripe checkout
    // The button state will be reset when they return
  } catch (error) {
    debugError("Error during upgrade:", error)
    showNotification("Upgrade Error", error.message || "Failed to process upgrade. Please try again.")

    // Reset button state
    const upgradeBtn = document.getElementById("upgrade-btn")
    if (upgradeBtn) {
      upgradeBtn.textContent = "Upgrade Now"
      upgradeBtn.disabled = false
    }
  }
}

// Add this function to handle managing subscription
async function handleManageSubscription() {
  debugLog("Handling manage subscription")

  try {
    // Show loading state
    const manageSubBtn = document.getElementById("manage-subscription-btn")
    if (manageSubBtn) {
      manageSubBtn.textContent = "Loading..."
      manageSubBtn.disabled = true
    }

    // Get return URL
    const returnUrl = chrome.runtime.getURL("popup.html")

    // Create customer portal session
    await stripeService.createCustomerPortalSession(returnUrl)

    // Note: The user will be redirected to Stripe customer portal
    // The button state will be reset when they return
  } catch (error) {
    debugError("Error opening customer portal:", error)
    showNotification("Error", error.message || "Failed to open subscription management. Please try again.")

    // Reset button state
    const manageSubBtn = document.getElementById("manage-subscription-btn")
    if (manageSubBtn) {
      manageSubBtn.textContent = "Manage Subscription"
      manageSubBtn.disabled = false
    }
  }
}

// Update the canExtract function to check subscription status
async function canExtract() {
  // First check if user has active subscription
  try {
    const hasSubscription = await stripeService.hasActiveSubscription()
    if (hasSubscription) {
      return true
    }
  } catch (error) {
    debugError("Error checking subscription status:", error)
    // Fall back to checking storage
  }

  // If no subscription or error, check free plan extractions
  return new Promise((resolve) => {
    chrome.storage.sync.get(["extractionsLeft"], (data) => {
      const extractionsLeft = data.extractionsLeft !== undefined ? data.extractionsLeft : 5
      resolve(extractionsLeft > 0)
    })
  })
}

// Add this function to check for URL parameters when popup opens
function checkUrlParameters() {
  const urlParams = new URLSearchParams(window.location.search)
  const upgradeStatus = urlParams.get("upgrade")

  if (upgradeStatus === "success") {
    showNotification(
      "Upgrade Successful",
      "Thank you for upgrading to Premium! You now have access to all premium features.",
    )
    checkSubscriptionStatus()
  } else if (upgradeStatus === "canceled") {
    showNotification("Upgrade Canceled", "Your upgrade was canceled. You can try again anytime.")
  }
}

// Update the document.addEventListener("DOMContentLoaded") function
document.addEventListener("DOMContentLoaded", () => {
  debugLog("Popup DOM loaded")

  // Check URL parameters
  checkUrlParameters()

  // Tab switching functionality
  setupTabSwitching()

  // Setup event listeners for buttons
  setupEventListeners()

  // Load saved settings and customizations
  loadSavedSettings()

  // Initialize plans
  initializePlans()

  // Setup authentication
  setupAuthentication()

  // Add notification styles
  const style = document.createElement("style")
  style.textContent = `
    .notification {
      position: fixed;
      bottom: 20px;
      right: 20px;
      background-color: white;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
      width: 300px;
      z-index: 1000;
      overflow: hidden;
      display: flex;
      animation: slideIn 0.3s forwards;
    }
    
    @keyframes slideIn {
      from { transform: translateX(100%); }
      to { transform: translateX(0); }
    }
    
    .notification-content {
      padding: 16px;
      flex-grow: 1;
    }
    
    .notification-content h3 {
      margin: 0 0 8px 0;
      font-size: 16px;
    }
    
    .notification-content p {
      margin: 0;
      font-size: 14px;
      color: var(--text-light);
    }
    
    .notification-close {
      background: none;
      border: none;
      font-size: 20px;
      cursor: pointer;
      padding: 8px;
      align-self: flex-start;
    }

    .subscription-details {
      margin-top: 12px;
      padding: 12px;
      background-color: #f9f9f9;
      border-radius: 4px;
      font-size: 13px;
    }

    .subscription-details p {
      margin: 4px 0;
    }
  `
  document.head.appendChild(style)
})

