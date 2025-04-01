// At the beginning of the file, add this check to ensure chrome is defined
if (typeof chrome === "undefined") {
    console.warn("Chrome API not available in this context")
  }
  
  // This script will be injected into the openbase.studio page after OAuth redirect
  // to capture the authorization code and send it back to the extension
  
  console.log("Redirect handler loaded")
  ;(() => {
    // Check if this page contains an authorization code
    const url = new URL(window.location.href)
    const code = url.searchParams.get("code")
    const state = url.searchParams.get("state")
  
    console.log("Checking for auth code:", { code: code ? "present" : "not present", state })
  
    if (code) {
      // Create a visual indicator that we're processing the auth
      const overlay = document.createElement("div")
      overlay.style.position = "fixed"
      overlay.style.top = "0"
      overlay.style.left = "0"
      overlay.style.width = "100%"
      overlay.style.height = "100%"
      overlay.style.backgroundColor = "rgba(0, 0, 0, 0.7)"
      overlay.style.zIndex = "9999"
      overlay.style.display = "flex"
      overlay.style.alignItems = "center"
      overlay.style.justifyContent = "center"
      overlay.style.flexDirection = "column"
      overlay.style.color = "white"
      overlay.style.fontFamily = "Arial, sans-serif"
  
      const message = document.createElement("h2")
      message.textContent = "Connecting to Figma..."
      message.style.marginBottom = "20px"
  
      const spinner = document.createElement("div")
      spinner.style.border = "5px solid #f3f3f3"
      spinner.style.borderTop = "5px solid #0070f3"
      spinner.style.borderRadius = "50%"
      spinner.style.width = "50px"
      spinner.style.height = "50px"
      spinner.style.animation = "spin 2s linear infinite"
  
      const style = document.createElement("style")
      style.textContent = "@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }"
  
      document.head.appendChild(style)
      overlay.appendChild(message)
      overlay.appendChild(spinner)
      document.body.appendChild(overlay)
  
      console.log("Overlay added to page")
  
      // Verify the state parameter to prevent CSRF attacks
      chrome.storage.local.get("figmaAuthState", (data) => {
        const storedState = data.figmaAuthState
  
        if (state !== storedState) {
          console.error("State mismatch! Possible CSRF attack")
          message.textContent = "Authentication failed: Invalid state parameter"
          spinner.style.borderTop = "5px solid #f44336"
          return
        }
  
        // Send the code back to the extension
        if (typeof chrome !== "undefined" && chrome.runtime) {
          console.log("Sending figmaAuthCode message to background script")
  
          chrome.runtime.sendMessage(
            {
              action: "figmaAuthCode",
              code: code,
              state: state,
            },
            (response) => {
              console.log("Received response from background script:", response)
  
              if (chrome.runtime.lastError) {
                console.error("Error sending message:", chrome.runtime.lastError)
                message.textContent = "Error connecting to Figma: " + chrome.runtime.lastError.message
                spinner.style.borderTop = "5px solid #f44336"
                return
              }
  
              if (response && response.success) {
                message.textContent = "Successfully connected to Figma!"
                spinner.style.borderTop = "5px solid #00c853"
  
                // Close this tab after a short delay
                setTimeout(() => {
                  window.close()
                }, 2000)
              } else {
                message.textContent = "Error connecting to Figma"
                spinner.style.borderTop = "5px solid #f44336"
  
                const errorMsg = document.createElement("p")
                errorMsg.textContent = response ? response.error : "Unknown error"
                errorMsg.style.color = "#f44336"
                overlay.appendChild(errorMsg)
              }
            },
          )
        } else {
          console.warn("Chrome runtime API not available")
  
          // If chrome API is not available, show a message to copy the code manually
          message.textContent = "Please copy this code and paste it in the extension:"
          spinner.style.display = "none"
  
          const codeDisplay = document.createElement("div")
          codeDisplay.textContent = code
          codeDisplay.style.padding = "10px"
          codeDisplay.style.background = "#333"
          codeDisplay.style.borderRadius = "4px"
          codeDisplay.style.marginTop = "20px"
          codeDisplay.style.fontFamily = "monospace"
          codeDisplay.style.fontSize = "16px"
  
          overlay.appendChild(codeDisplay)
        }
      })
    } else {
      console.log("No auth code found in URL")
    }
  })()
  
  