// Import necessary modules
import { initFigmaAuth, exchangeCodeForToken } from "./lib/figma-api.js"
import { FIGMA_CONFIG } from "./config.js"
import { initGoogleAuth, getGoogleToken, verifyGoogleToken } from "./lib/google-auth.js"

// Import debug utilities at the top of the file
import { debugLog, debugError } from "./debug.js"

// After the existing imports, add these new imports:
import authService, { AUTH_EVENTS } from "./lib/auth-service.js"
import realTimeService from "./lib/real-time-service.js"
// After the existing imports, add this import:
import stripeWebhookHandler from "./lib/stripe-webhook-handler.js"
// After the existing imports, add these new imports:
import { initSupabase } from "./lib/supabase-client.js"

// Add this code near the top of the file, after the debug imports
// Initialize Supabase
initSupabase().catch((error) => {
  debugError("Error initializing Supabase:", error)
})

// Add this code near the top of the file, after the debug imports

// Listen for extension installation
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === "install") {
    // Initialize plan data for new installations
    chrome.storage.sync.set(
      {
        planType: "free",
        extractionsLeft: 5,
      },
      () => {
        debugLog("Initialized plan data for new installation")
      },
    )

    // Prompt for Google authentication on install
    initGoogleAuth().catch((error) => {
      debugError("Error during initial Google auth:", error)
    })
  }
})

// Add this code after the existing chrome.runtime.onInstalled.addListener function:

// Set up auth event listeners
authService.addEventListener(AUTH_EVENTS.SIGNED_IN, ({ user }) => {
  debugLog("User signed in:", user.email)

  // Connect to real-time service
  realTimeService
    .connect(authService.authToken)
    .then(() => {
      debugLog("Connected to real-time service")
    })
    .catch((error) => {
      debugError("Failed to connect to real-time service:", error)
    })

  // Show welcome notification
  showNotification("Welcome back!", `You are now signed in as ${user.email}`)
})

authService.addEventListener(AUTH_EVENTS.SIGNED_OUT, () => {
  debugLog("User signed out")

  // Disconnect from real-time service
  realTimeService.disconnect()

  // Show notification
  showNotification("Signed out", "You have been signed out successfully")
})

// Set up real-time message handlers
realTimeService.on("notification", (data) => {
  debugLog("Received notification:", data)

  // Show notification to user
  showNotification(data.title, data.message, data.url)
})

realTimeService.on("extraction_complete", (data) => {
  debugLog("Extraction complete:", data)

  // Show notification
  showNotification("Extraction Complete", `Your extraction of ${data.url} is complete!`, data.resultUrl)
})

realTimeService.on("connection", (data) => {
  if (data.status === "connected") {
    debugLog("Real-time connection established")
  } else if (data.status === "disconnected") {
    debugLog("Real-time connection closed")

    if (data.permanent) {
      debugLog("Permanent disconnection:", data.reason)
    }
  }
})

// Declare chrome if it's not already defined (e.g., in a testing environment)
if (typeof chrome === "undefined") {
  global.chrome = {
    runtime: {
      onMessage: {
        addListener: () => {},
      },
      lastError: null,
      onInstalled: {
        addListener: () => {},
      },
    },
    webNavigation: {
      onCompleted: {
        addListener: () => {},
      },
    },
    downloads: {
      download: () => {},
      onChanged: {
        addListener: () => {},
      },
    },
    notifications: {
      create: () => {},
      onClicked: {
        addListener: () => {},
      },
    },
    storage: {
      local: {
        set: () => {},
        get: () => {},
        remove: () => {},
      },
      sync: {
        set: () => {},
        get: () => {},
        remove: () => {},
      },
    },
    tabs: {
      query: () => {},
      create: () => {},
      remove: () => {},
    },
    identity: {
      launchWebAuthFlow: () => {},
      getRedirectURL: () => "https://example.com/redirect",
    },
  }
}

debugLog("Background script loaded")

// Listen for messages from content script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  debugLog("Message received in background:", request.action)

  if (request.action === "selectionComplete") {
    debugLog("Element selected:", request.elementInfo)
    sendResponse({ success: true })
  } else if (request.action === "processExtractedData") {
    // Check if user is authenticated before processing
    checkGoogleAuth().then((isAuthenticated) => {
      if (isAuthenticated) {
        processExtractedData(request.data)
        sendResponse({ success: true })
      } else {
        promptGoogleAuth()
          .then(() => {
            processExtractedData(request.data)
            sendResponse({ success: true })
          })
          .catch((error) => {
            debugError("Auth error:", error)
            sendResponse({ success: false, error: "Authentication required" })
          })
      }
    })
    return true // Required for async sendResponse
  } else if (request.action === "processComponentLibrary") {
    // Check if user is authenticated before processing
    checkGoogleAuth().then((isAuthenticated) => {
      if (isAuthenticated) {
        processComponentLibrary(request.data)
        sendResponse({ success: true })
      } else {
        promptGoogleAuth()
          .then(() => {
            processComponentLibrary(request.data)
            sendResponse({ success: true })
          })
          .catch((error) => {
            debugError("Auth error:", error)
            sendResponse({ success: false, error: "Authentication required" })
          })
      }
    })
    return true // Required for async sendResponse
  } else if (request.action === "processAssets") {
    // Check if user is authenticated before processing
    checkGoogleAuth().then((isAuthenticated) => {
      if (isAuthenticated) {
        processAssets(request.data)
        sendResponse({ success: true })
      } else {
        promptGoogleAuth()
          .then(() => {
            processAssets(request.data)
            sendResponse({ success: true })
          })
          .catch((error) => {
            debugError("Auth error:", error)
            sendResponse({ success: false, error: "Authentication required" })
          })
      }
    })
    return true // Required for async sendResponse
  } else if (request.action === "authenticateFigma") {
    debugLog("Authenticating with Figma:", request)

    // Use the credentials from config
    initFigmaAuth(FIGMA_CONFIG.CLIENT_ID, FIGMA_CONFIG.REDIRECT_URI)
      .then((token) => {
        debugLog("Figma auth initialized, token:", token ? "present" : "not present")
        sendResponse({ success: true, token: token ? true : false })
      })
      .catch((error) => {
        debugError("Figma auth error:", error)
        sendResponse({ success: false, error: error.message })
      })
    return true // Required for async sendResponse
  } else if (request.action === "authenticateGoogle") {
    debugLog("Authenticating with Google")

    initGoogleAuth()
      .then((token) => {
        debugLog("Google auth initialized, token:", token ? "present" : "not present")
        sendResponse({ success: true, token: token ? true : false })
      })
      .catch((error) => {
        debugError("Google auth error:", error)
        sendResponse({ success: false, error: error.message })
      })
    return true // Required for async sendResponse
  } else if (request.action === "checkGoogleAuth") {
    // Check if the Google token is valid
    checkGoogleAuth().then((isAuthenticated) => {
      sendResponse({ authenticated: isAuthenticated })
    })
    return true // Required for async sendResponse
  } else if (request.action === "figmaAuthCode") {
    debugLog("Received Figma auth code")

    // Handle the authorization code from the redirect
    handleFigmaAuthCode(request.code, sendResponse)
    return true // Required for async sendResponse
  } else if (request.action === "checkFigmaAuth") {
    // Check if the Figma token is valid
    checkFigmaAuth(sendResponse)
    return true // Required for async sendResponse
  }
  // Add this to the chrome.runtime.onMessage.addListener function:
  else if (request.action === "stripeWebhook") {
    debugLog("Received Stripe webhook event:", request.event.type)

    stripeWebhookHandler
      .handleEvent(request.event)
      .then(() => {
        sendResponse({ success: true })
      })
      .catch((error) => {
        debugError("Error handling Stripe webhook:", error)
        sendResponse({ success: false, error: error.message })
      })

    return true // Required for async sendResponse
  }
})

// Check if Google authentication is valid
async function checkGoogleAuth() {
  try {
    const token = await getGoogleToken()

    if (!token) {
      return false
    }

    const isValid = await verifyGoogleToken(token)
    return isValid
  } catch (error) {
    debugError("Error checking Google auth:", error)
    return false
  }
}

// Prompt for Google authentication
async function promptGoogleAuth() {
  try {
    return await initGoogleAuth()
  } catch (error) {
    debugError("Error prompting for Google auth:", error)
    throw error
  }
}

// Check if Figma authentication is valid
async function checkFigmaAuth(sendResponse) {
  try {
    const { getFigmaToken, verifyFigmaToken } = await import("./lib/figma-api.js")
    const token = await getFigmaToken()

    if (!token) {
      sendResponse({ authenticated: false })
      return
    }

    const isValid = await verifyFigmaToken(token)
    sendResponse({ authenticated: isValid })
  } catch (error) {
    debugError("Error checking Figma auth:", error)
    sendResponse({ authenticated: false, error: error.message })
  }
}

// Handle Figma authorization code
async function handleFigmaAuthCode(code, sendResponse) {
  try {
    debugLog("Exchanging code for token")

    // Exchange the code for a token
    await exchangeCodeForToken(code, FIGMA_CONFIG.CLIENT_ID, FIGMA_CONFIG.CLIENT_SECRET, FIGMA_CONFIG.REDIRECT_URI)

    debugLog("Token exchange successful")

    // Show success notification
    showNotification("Figma Connected", "Successfully connected to Figma!")

    sendResponse({ success: true })
  } catch (error) {
    debugError("Error exchanging code for token:", error)
    showNotification("Figma Connection Failed", error.message)
    sendResponse({ success: false, error: error.message })
  }
}

// Listen for Figma OAuth redirects - specifically for openbase.studio
chrome.webNavigation.onCompleted.addListener(
  (details) => {
    // Check if this is our redirect URI with auth code
    if (details.url.startsWith(FIGMA_CONFIG.REDIRECT_URI) && details.url.includes("code=")) {
      debugLog("Detected OAuth redirect:", details.url)

      // The redirect-handler.js content script will handle extracting the code
      // and sending it back to the background script
    }
  },
  { url: [{ urlPrefix: FIGMA_CONFIG.REDIRECT_URI }] },
)

// Improve error handling for the downloads API
function downloadFile(blob, filename) {
  try {
    const url = URL.createObjectURL(blob)
    chrome.downloads.download(
      {
        url: url,
        filename: filename,
        saveAs: true,
      },
      (downloadId) => {
        if (chrome.runtime.lastError) {
          debugError("Download error:", chrome.runtime.lastError)
          showNotification("Download Error", chrome.runtime.lastError.message)
        }
      },
    )
  } catch (error) {
    debugError("Error creating download:", error)
    showNotification("Download Error", error.message)
  }
}

// Process and save extracted data
async function processExtractedData(data) {
  try {
    // Determine export type
    const exportType = data.settings?.exportType || "export-zip"

    // Apply customizations if available
    if (data.settings?.customizations) {
      if (data.figma) {
        const { applyCustomizations } = await import("./lib/figma-exporter.js")
        data.figma = applyCustomizations(data.figma, data.settings.customizations)
      }

      if (data.nextjs) {
        // Apply customizations to Next.js code (colors, fonts, etc.)
        const { applyNextJsCustomizations } = await import("./lib/nextjs-customizations.js")
        data.nextjs = applyNextJsCustomizations(data.nextjs, data.settings.customizations)
      }
    }

    // Generate a timestamp for the filename
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-")
    const hostname = new URL(data.url).hostname.replace("www.", "")
    const filename = `${hostname}-${timestamp}`

    // Handle different export types
    if (exportType === "export-fig" && data.figma) {
      try {
        // Try to use the Figma API if authenticated
        const { getFigmaToken, createFigmaFile, convertToFigmaNodes } = await import("./lib/figma-api.js")
        const token = await getFigmaToken()

        if (token) {
          // Convert our data to Figma format and create a file
          const figmaNodes = convertToFigmaNodes(data.figma)
          const result = await createFigmaFile(`${hostname} - Extracted Design`, figmaNodes)

          // Show success notification with link to Figma file
          showNotification("Figma Export Complete", `Design has been exported to Figma. Click to open.`, result.fileUrl)
          return
        }
      } catch (error) {
        debugError("Error using Figma API:", error)
        // Fall back to local file export
      }

      // Fall back to local .fig file if API fails or not authenticated
      const { convertToFigFile } = await import("./lib/figma-exporter.js")
      const figBlob = await convertToFigFile(data.figma)
      downloadFile(figBlob, `${filename}.fig`)
      showNotification("Figma Export Complete", `Figma file has been saved as ${filename}.fig`)
      return
    }

    if (exportType === "export-nextjs" && data.nextjs) {
      // Export Next.js project only
      const { createZip } = await import("./lib/jszip-utils.js")
      const zip = await createZip()

      // Add Next.js files
      for (const [path, content] of Object.entries(data.nextjs)) {
        zip.file(path, content)
      }

      // Add README
      const { generateReadme } = await import("./lib/readme-generator.js")
      zip.file("README.md", generateReadme(data, "nextjs"))

      // Generate and download the zip
      const zipBlob = await zip.generateAsync({ type: "blob" })
      downloadFile(zipBlob, `${filename}-nextjs.zip`)

      showNotification("Next.js Export Complete", `Next.js project has been saved as ${filename}-nextjs.zip`)
      return
    }

    // Default: Export as zip with both Figma and Next.js
    const { createZip } = await import("./lib/jszip-utils.js")
    const zip = await createZip()

    // Add Figma data if present
    if (data.figma) {
      zip.file("figma-design.json", JSON.stringify(data.figma, null, 2))

      // Add responsive variants if available
      if (data.responsiveVariants) {
        zip.file("figma-responsive-variants.json", JSON.stringify(data.responsiveVariants, null, 2))
      }
    }

    // Add Next.js files if present
    if (data.nextjs) {
      for (const [path, content] of Object.entries(data.nextjs)) {
        zip.file(`nextjs/${path}`, content)
      }

      // Add responsive CSS if available
      if (data.responsiveCss) {
        zip.file("nextjs/tailwind.breakpoints.js", data.responsiveCss.tailwindConfig)
        zip.file("nextjs/app/breakpoints.css", data.responsiveCss.cssVariables)
      }
    }

    // Add component library if present
    if (data.componentLibrary) {
      zip.file("component-library/metadata.json", JSON.stringify(data.componentLibrary.metadata, null, 2))
      zip.file("component-library/components.json", JSON.stringify(data.componentLibrary.components, null, 2))
    }

    // Add optimized assets if present
    if (data.assets) {
      // Add images
      if (data.assets.images) {
        for (const image of data.assets.images) {
          if (image.blob) {
            zip.file(`assets/images/${image.optimizedFilename}`, image.blob)
          }
        }
        zip.file(
          "assets/images/metadata.json",
          JSON.stringify(
            data.assets.images.map((img) => ({
              filename: img.filename,
              optimizedFilename: img.optimizedFilename,
              width: img.width,
              height: img.height,
              originalSize: img.originalSize,
              optimizedSize: img.optimizedSize,
              compressionRatio: img.compressionRatio,
            })),
            null,
            2,
          ),
        )
      }

      // Add SVGs
      if (data.assets.svgs) {
        for (const svg of data.assets.svgs) {
          zip.file(`assets/svgs/${svg.filename}`, svg.content)
        }
        zip.file(
          "assets/svgs/metadata.json",
          JSON.stringify(
            data.assets.svgs.map((svg) => ({
              id: svg.id,
              filename: svg.filename,
              width: svg.width,
              height: svg.height,
            })),
            null,
            2,
          ),
        )
      }
    }

    // Add README
    const { generateReadme } = await import("./lib/readme-generator.js")
    zip.file("README.md", generateReadme(data, "all"))

    // Generate and download the zip
    const zipBlob = await zip.generateAsync({ type: "blob" })
    downloadFile(zipBlob, `${filename}.zip`)

    showNotification("Export Complete", `Files have been saved as ${filename}.zip`)
  } catch (error) {
    debugError("Error processing extracted data:", error)
    showNotification("Export Error", `An error occurred: ${error.message}`)
  }
}

// Process and save component library
async function processComponentLibrary(data) {
  try {
    // Generate a timestamp for the filename
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-")
    const hostname = new URL(data.url).hostname.replace("www.", "")
    const filename = `${hostname}-component-library-${timestamp}`

    // Create a zip file
    const { createZip } = await import("./lib/jszip-utils.js")
    const zip = await createZip()

    // Add component library metadata
    zip.file("metadata.json", JSON.stringify(data.componentLibrary.metadata, null, 2))

    // Add Figma components if present
    if (data.figmaComponents) {
      zip.file("figma/components.json", JSON.stringify(data.figmaComponents, null, 2))
    }

    // Add React components if present
    if (data.reactComponents) {
      for (const [path, content] of Object.entries(data.reactComponents)) {
        zip.file(`react/${path}`, content)
      }
    }

    // Add README
    zip.file("README.md", generateComponentLibraryReadme(data))

    // Generate and download the zip
    const zipBlob = await zip.generateAsync({ type: "blob" })
    downloadFile(zipBlob, `${filename}.zip`)

    showNotification("Component Library Export Complete", `Component library has been saved as ${filename}.zip`)
  } catch (error) {
    debugError("Error processing component library:", error)
    showNotification("Export Error", `An error occurred: ${error.message}`)
  }
}

// Process and save optimized assets
async function processAssets(data) {
  try {
    // Generate a timestamp for the filename
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-")
    const hostname = new URL(data.url).hostname.replace("www.", "")
    const filename = `${hostname}-assets-${timestamp}`

    // Create a zip file
    const { createZip } = await import("./lib/jszip-utils.js")
    const zip = await createZip()

    // Add images if present
    if (data.images && data.images.length > 0) {
      // Create a directory for images
      for (const image of data.images) {
        if (image.blob) {
          zip.file(`images/${image.optimizedFilename}`, image.blob)
        }
      }

      // Add metadata
      zip.file(
        "images/metadata.json",
        JSON.stringify(
          data.images.map((img) => ({
            filename: img.filename,
            optimizedFilename: img.optimizedFilename,
            width: img.width,
            height: img.height,
          })),
          null,
          2,
        ),
      )
    }

    // Add SVGs if present
    if (data.svgs && data.svgs.length > 0) {
      // Create a directory for SVGs
      for (const svg of data.svgs) {
        zip.file(`svgs/${svg.filename}`, svg.content)
      }

      // Add metadata
      zip.file(
        "svgs/metadata.json",
        JSON.stringify(
          data.svgs.map((svg) => ({
            id: svg.id,
            filename: svg.filename,
            width: svg.width,
            height: svg.height,
          })),
          null,
          2,
        ),
      )
    }

    // Add README
    zip.file("README.md", generateAssetsReadme(data))

    // Generate and download the zip
    const zipBlob = await zip.generateAsync({ type: "blob" })
    downloadFile(zipBlob, `${filename}.zip`)

    showNotification("Assets Export Complete", `Optimized assets have been saved as ${filename}.zip`)
  } catch (error) {
    debugError("Error processing assets:", error)
    showNotification("Export Error", `An error occurred: ${error.message}`)
  }
}

// Generate README for assets
function generateAssetsReadme(data) {
  const timestamp = new Date(data.timestamp).toLocaleString()

  let imageStats = ""
  if (data.images && data.images.length > 0) {
    const totalOriginal = data.images.reduce((sum, img) => sum + (img.originalSize || 0), 0)
    const totalOptimized = data.images.reduce((sum, img) => sum + (img.optimizedSize || 0), 0)
    const savingsPercent = totalOriginal > 0 ? Math.round((1 - totalOptimized / totalOriginal) * 100) : 0

    imageStats = `
## Image Optimization Stats

- Total images: ${data.images.length}
- Original size: ${formatBytes(totalOriginal)}
- Optimized size: ${formatBytes(totalOptimized)}
- Space saved: ${formatBytes(totalOriginal - totalOptimized)} (${savingsPercent}%)
`
  }

  let svgStats = ""
  if (data.svgs && data.svgs.length > 0) {
    svgStats = `
## SVG Stats

- Total SVGs: ${data.svgs.length}
`
  }

  return `# Optimized Assets: ${data.title}

This package contains optimized assets extracted from ${data.url}.
Extracted on: ${timestamp}

## How to Use

### Images
${data.images && data.images.length > 0 ? "The images folder contains optimized versions of all extracted images. Use these in your web projects for better performance." : "No images were extracted."}

### SVGs
${data.svgs && data.svgs.length > 0 ? "The SVGs folder contains all extracted SVG icons and graphics. These are resolution-independent and perfect for responsive designs." : "No SVGs were extracted."}

---
Generated by Tooliq Chrome Extension
`
}

// Helper function to format bytes
function formatBytes(bytes, decimals = 2) {
  if (bytes === 0) return "0 Bytes"

  const k = 1024
  const dm = decimals < 0 ? 0 : decimals
  const sizes = ["Bytes", "KB", "MB", "GB", "TB"]

  const i = Math.floor(Math.log(bytes) / Math.log(k))

  return Number.parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + " " + sizes[i]
}

// Generate README for component library
function generateComponentLibraryReadme(data) {
  const timestamp = new Date(data.timestamp).toLocaleString()
  const componentCounts = Object.entries(data.componentLibrary.components)
    .map(([type, components]) => `- ${type}: ${components.length} components`)
    .join("\n")

  return `# Component Library: ${data.title}

This package contains the extracted component library from ${data.url}.
Extracted on: ${timestamp}

## Components

${componentCounts}

## How to Use

### Figma Components
${data.figmaComponents ? 'Import the components.json file into Figma using a plugin like "Figma to JSON".' : "No Figma components were extracted."}

### React Components
${data.reactComponents ? "The React components can be used in a new or existing React project. Copy the files to your project's components directory." : "No React components were extracted."}

---
Generated by Tooliq Chrome Extension
`
}

// Enhanced notification function with optional click URL
function showNotification(title, message, url) {
  const notificationOptions = {
    type: "basic",
    iconUrl: "icons/icon128.png",
    title: title,
    message: message,
  }

  chrome.notifications.create(notificationOptions, (notificationId) => {
    if (url) {
      // Store the URL to open when notification is clicked
      chrome.storage.local.set({ [notificationId]: url })
    }
  })
}

// Listen for notification clicks
chrome.notifications.onClicked.addListener((notificationId) => {
  chrome.storage.local.get(notificationId, (data) => {
    if (data[notificationId]) {
      chrome.tabs.create({ url: data[notificationId] })
      chrome.storage.local.remove(notificationId)
    }
  })
})

// Helper function to generate README content
async function generateReadme(data, type) {
  const timestamp = new Date(data.timestamp).toLocaleString()

  if (type === "nextjs") {
    return `# Extracted Next.js Project: ${data.title}

This package contains the extracted Next.js code from ${data.url}.
Extracted on: ${timestamp}

## How to Use

1. Extract the contents of this zip file
2. Navigate to the extracted directory
3. Install dependencies with \`npm install\` or \`yarn\`
4. Run the development server with \`npm run dev\` or \`yarn dev\`
5. Open http://localhost:3000 in your browser

---
Generated by Tooliq Chrome Extension
`
  }

  // Build sections based on what was extracted
  const sections = []

  if (data.figma) {
    sections.push("- Figma design (figma-design.json)")
  }

  if (data.nextjs) {
    sections.push("- Next.js code (nextjs folder)")
  }

  if (data.componentLibrary) {
    sections.push("- Component library (component-library folder)")
  }

  if (data.assets) {
    if (data.assets.images) {
      sections.push("- Optimized images (assets/images folder)")
    }
    if (data.assets.svgs) {
      sections.push("- SVG icons (assets/svgs folder)")
    }
  }

  if (data.responsiveVariants) {
    sections.push("- Responsive design variants (figma-responsive-variants.json)")
  }

  return `# Extracted Website: ${data.title}

This package contains the extracted design and code from ${data.url}.
Extracted on: ${timestamp}

## Contents

${sections.join("\n")}

## How to use

### Figma Design
${data.figma ? 'Import the figma-design.json file into Figma using a plugin like "Figma to JSON".' : "No Figma design was extracted."}

### Next.js Code
${data.nextjs ? "The Next.js code can be used in a new or existing Next.js project. Copy the files to your project directory." : "No Next.js code was extracted."}

### Component Library
${data.componentLibrary ? "The component library contains reusable UI components extracted from the website. You can use these in your own projects." : "No component library was extracted."}

### Optimized Assets
${data.assets ? "The assets folder contains optimized images and SVGs extracted from the website. These are ready to use in your projects." : "No assets were extracted."}

### Responsive Design
${data.responsiveVariants ? "The package includes responsive design variants for different screen sizes. Check the figma-responsive-variants.json file." : "No responsive design variants were extracted."}

---
Generated by Tooliq Chrome Extension
`
}

// Helper function to apply customizations to Next.js code
async function applyNextJsCustomizations(nextjsFiles, customizations) {
  const customizedFiles = { ...nextjsFiles }

  // Apply color customizations to tailwind config
  if (customizations.colors && customizedFiles["tailwind.config.js"]) {
    customizedFiles["tailwind.config.js"] = customizedFiles["tailwind.config.js"].replace(
      "theme: {\n    extend: {},",
      `theme: {
    extend: {
      colors: {
        primary: "${customizations.colors.primary}",
        secondary: "${customizations.colors.secondary}",
        text: "${customizations.colors.text}",
        background: "${customizations.colors.background}"
      },`,
    )
  }

  // Apply font customizations to tailwind config
  if (customizations.typography && customizedFiles["tailwind.config.js"]) {
    const fontConfig = `fontFamily: {
        heading: ["${customizations.typography.headingFont}", "sans-serif"],
        body: ["${customizations.typography.bodyFont}", "sans-serif"],
      },`

    customizedFiles["tailwind.config.js"] = customizedFiles["tailwind.config.js"].replace(
      "theme: {\n    extend: {",
      `theme: {\n    extend: {\n      ${fontConfig}`,
    )
  }

  // Apply container width to layout if not full width
  if (customizations.layout && customizations.layout.containerWidth !== "full") {
    // Find layout files and add max-width
    for (const [path, content] of Object.entries(customizedFiles)) {
      if (path.includes("layout") && !path.includes("globals.css")) {
        const containerWidth = customizations.layout.containerWidth
        customizedFiles[path] = content.replace(
          "<body>",
          `<body className="mx-auto" style={{ maxWidth: '${containerWidth}px' }}>`,
        )
      }
    }
  }

  return customizedFiles
}

