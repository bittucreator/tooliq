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
  
    // Load user plan data
    chrome.storage.sync.get(["planType", "extractionsLeft"], (data) => {
      const planType = data.planType || "free"
      const extractionsLeft = data.extractionsLeft !== undefined ? data.extractionsLeft : 5
  
      updatePlanUI(planType, extractionsLeft)
  
      // Add event listener for upgrade button
      const upgradeBtn = document.getElementById("upgrade-btn")
      if (upgradeBtn) {
        upgradeBtn.addEventListener("click", handleUpgrade)
      }
    })
  }
  
  // Function to update plan UI
  function updatePlanUI(planType, extractionsLeft) {
    const freePlanStatus = document.getElementById("free-plan-status")
    const extractionsLeftElem = document.getElementById("extractions-left")
    const upgradeBtn = document.getElementById("upgrade-btn")
    const freePlan = document.getElementById("free-plan")
    const premiumPlan = document.getElementById("premium-plan")
  
    if (planType === "premium") {
      if (freePlanStatus) freePlanStatus.textContent = "Basic Plan"
      if (extractionsLeftElem) extractionsLeftElem.textContent = "Upgrade for unlimited"
      if (upgradeBtn) {
        upgradeBtn.textContent = "Current Plan"
        upgradeBtn.disabled = true
      }
      if (premiumPlan) premiumPlan.style.border = "2px solid var(--primary)"
    } else {
      if (freePlanStatus) freePlanStatus.textContent = "Current Plan"
      if (extractionsLeftElem) extractionsLeftElem.textContent = `${extractionsLeft} extractions left`
      if (upgradeBtn) {
        upgradeBtn.textContent = "Upgrade Now"
        upgradeBtn.disabled = false
      }
      if (freePlan) freePlan.style.border = "2px solid var(--primary)"
    }
  }
  
  // Function to handle upgrade
  function handleUpgrade() {
    debugLog("Handling upgrade")
  
    // Show a confirmation dialog
    if (confirm("Upgrade to Premium Plan for $15/month?")) {
      // In a real extension, this would redirect to a payment processor
      // For this demo, we'll just update the plan type
      chrome.storage.sync.set({ planType: "premium" }, () => {
        updatePlanUI("premium", 0)
        showNotification("Upgrade Successful", "You now have access to all premium features!")
      })
    }
  }
  
  // Function to check if user can extract
  function canExtract() {
    return new Promise((resolve) => {
      chrome.storage.sync.get(["planType", "extractionsLeft"], (data) => {
        const planType = data.planType || "free"
        const extractionsLeft = data.extractionsLeft !== undefined ? data.extractionsLeft : 5
  
        if (planType === "premium") {
          resolve(true)
        } else {
          resolve(extractionsLeft > 0)
        }
      })
    })
  }
  
  // Function to decrement extractions left
  function decrementExtractions() {
    chrome.storage.sync.get(["planType", "extractionsLeft"], (data) => {
      const planType = data.planType || "free"
  
      if (planType === "free") {
        const extractionsLeft = data.extractionsLeft !== undefined ? data.extractionsLeft : 5
        const newExtractionsLeft = Math.max(0, extractionsLeft - 1)
  
        chrome.storage.sync.set({ extractionsLeft: newExtractionsLeft }, () => {
          updatePlanUI("free", newExtractionsLeft)
        })
      }
    })
  }
  
  // Function to show notification
  function showNotification(title, message) {
    // Create a notification element
    const notification = document.createElement("div")
    notification.className = "notification"
    notification.innerHTML = `
      <div class="notification-content">
        <h3>${title}</h3>
        <p>${message}</p>
      </div>
      <button class="notification-close">&times;</button>
    `
  
    // Add to body
    document.body.appendChild(notification)
  
    // Add close button functionality
    const closeBtn = notification.querySelector(".notification-close")
    if (closeBtn) {
      closeBtn.addEventListener("click", () => {
        notification.remove()
      })
    }
  
    // Auto remove after 5 seconds
    setTimeout(() => {
      if (notification.parentNode) {
        notification.remove()
      }
    }, 5000)
  }
  
  // Add notification styles to the document.addEventListener("DOMContentLoaded") function
  // Update the DOMContentLoaded event listener to initialize plans
  document.addEventListener("DOMContentLoaded", () => {
    debugLog("Popup DOM loaded")
  
    // Tab switching functionality
    setupTabSwitching()
  
    // Setup event listeners for buttons
    setupEventListeners()
  
    // Load saved settings and customizations
    loadSavedSettings()
  
    // Initialize plans
    initializePlans()
  
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
    `
    document.head.appendChild(style)
  })
  
  