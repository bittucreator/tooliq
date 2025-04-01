// At the beginning of the file, add this check to ensure chrome is defined
if (typeof chrome === "undefined") {
  console.warn("Chrome API not available in this context")
  // Create a mock chrome object for testing
  var chrome = {
    runtime: {
      onMessage: {
        addListener: () => {},
      },
      sendMessage: () => {},
    },
  }
}

// Import asset optimization utilities
import { extractImages, extractSVGs, optimizeImage, convertSvgToPng } from "./lib/asset-optimizer.js"
// Import responsive design analysis utilities
import { detectBreakpoints, generateResponsiveFrames, generateResponsiveCss } from "./lib/responsive-analyzer.js"
// Import code generation utilities
import { generateFigmaData, generateNextJSCode } from "./lib/code-generator.js"

// After the existing imports, add these new imports:
import apiService from "./lib/api-service.js"
import authService from "./lib/auth-service.js"

// Global variables
let selectedElement = null
let selectionMode = false
let highlightOverlay = null
const detectedComponents = new Map() // Store detected components for library extraction

// Listen for messages from popup or background script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log("Content script received message:", request.action)

  if (request.action === "startSelection") {
    console.log("Starting element selection mode")
    startElementSelection()
    sendResponse({ success: true })
  } else if (request.action === "extract") {
    console.log("Extracting website with settings:", request.settings)
    extractWebsite(request.settings)
      .then((data) => sendResponse({ success: true, data: data }))
      .catch((error) => sendResponse({ success: false, error: error.message }))
    return true // Required for async sendResponse
  } else if (request.action === "extractComponentLibrary") {
    console.log("Extracting component library with settings:", request.settings)
    extractComponentLibrary(request.settings)
      .then((data) => sendResponse({ success: true, data: data }))
      .catch((error) => sendResponse({ success: false, error: error.message }))
    return true // Required for async sendResponse
  } else if (request.action === "extractAssets") {
    console.log("Extracting assets with settings:", request.settings)
    extractAssets(request.settings)
      .then((data) => sendResponse({ success: true, data: data }))
      .catch((error) => sendResponse({ success: false, error: error.message }))
    return true // Required for async sendResponse
  } else if (request.action === "analyzeResponsiveDesign") {
    console.log("Analyzing responsive design with settings:", request.settings)
    analyzeResponsiveDesign(request.settings)
      .then((data) => sendResponse({ success: true, data: data }))
      .catch((error) => sendResponse({ success: false, error: error.message }))
    return true // Required for async sendResponse
  } else if (request.action === "stripeWebhook") {
    console.log("Forwarding Stripe webhook event to background script:", request.event.type)

    chrome.runtime.sendMessage(
      {
        action: "stripeWebhook",
        event: request.event,
      },
      (response) => {
        if (chrome.runtime.lastError) {
          console.error("Error forwarding Stripe webhook:", chrome.runtime.lastError)
          sendResponse({ success: false, error: chrome.runtime.lastError.message })
        } else {
          sendResponse(response)
        }
      },
    )

    return true // Required for async sendResponse
  }
})

// Start element selection mode
function startElementSelection() {
  selectionMode = true

  // Create highlight overlay if it doesn't exist
  if (!highlightOverlay) {
    highlightOverlay = document.createElement("div")
    highlightOverlay.style.position = "absolute"
    highlightOverlay.style.border = "2px solid #0070f3"
    highlightOverlay.style.backgroundColor = "rgba(0, 112, 243, 0.1)"
    highlightOverlay.style.pointerEvents = "none"
    highlightOverlay.style.zIndex = "9999"
    highlightOverlay.style.transition = "all 0.2s ease"
    document.body.appendChild(highlightOverlay)
  }

  // Add event listeners
  document.addEventListener("mousemove", handleMouseMove)
  document.addEventListener("click", handleMouseClick)

  // Change cursor
  document.body.style.cursor = "crosshair"

  console.log("Selection mode activated")
}

// Handle mouse move during selection
function handleMouseMove(e) {
  if (!selectionMode) return

  const target = document.elementFromPoint(e.clientX, e.clientY)
  if (!target) return

  // Skip body and html elements
  if (target === document.body || target === document.documentElement) return

  // Update highlight overlay
  const rect = target.getBoundingClientRect()
  highlightOverlay.style.top = `${window.scrollY + rect.top}px`
  highlightOverlay.style.left = `${window.scrollX + rect.left}px`
  highlightOverlay.style.width = `${rect.width}px`
  highlightOverlay.style.height = `${rect.height}px`
  highlightOverlay.style.display = "block"
}

// Handle mouse click during selection
function handleMouseClick(e) {
  if (!selectionMode) return

  e.preventDefault()
  e.stopPropagation()

  // Get the element at click position
  selectedElement = document.elementFromPoint(e.clientX, e.clientY)
  console.log("Element selected:", selectedElement)

  // End selection mode
  endElementSelection()

  // Notify that selection is complete
  chrome.runtime.sendMessage({
    action: "selectionComplete",
    elementInfo: {
      tagName: selectedElement.tagName,
      id: selectedElement.id,
      className: selectedElement.className,
    },
  })
}

// End element selection mode
function endElementSelection() {
  selectionMode = false
  document.removeEventListener("mousemove", handleMouseMove)
  document.removeEventListener("click", handleMouseClick)
  document.body.style.cursor = ""

  if (highlightOverlay) {
    highlightOverlay.style.display = "none"
  }

  console.log("Selection mode deactivated")
}

// Update the extractWebsite function to use the API service
// Replace the existing extractWebsite function with this:

// Main extraction function
async function extractWebsite(settings) {
  try {
    console.log("Extraction started with settings:", settings)

    // Check if user is authenticated
    if (!authService.isAuthenticated()) {
      throw new Error("Authentication required")
    }

    // Determine the root element to extract
    const rootElement = settings.scope === "fullPage" ? document.body : selectedElement || document.body

    if (settings.scope === "selectedElement" && !selectedElement) {
      console.warn("No element selected, falling back to full page")
    }

    // Extract DOM structure and styles
    const domData = extractDOMStructure(rootElement, settings.detectionLevel)

    // Start a server-side extraction job
    const extractionJob = await apiService.post("extractions", {
      url: window.location.href,
      title: document.title,
      settings: settings,
      timestamp: new Date().toISOString(),
    })

    console.log("Extraction job created:", extractionJob.id)

    // Send the DOM data to the server
    await apiService.post(`extractions/${extractionJob.id}/dom`, {
      domData: domData,
    })

    // Generate Figma design data if requested
    let figmaData = null
    if (settings.figmaExport) {
      figmaData = generateFigmaData(domData, settings)

      // Send Figma data to server
      await apiService.post(`extractions/${extractionJob.id}/figma`, {
        figmaData: figmaData,
      })
    }

    // Generate Next.js code if requested
    let nextjsCode = null
    if (settings.nextjsExport) {
      nextjsCode = generateNextJSCode(domData, settings)

      // Send Next.js code to server
      await apiService.post(`extractions/${extractionJob.id}/nextjs`, {
        nextjsCode: nextjsCode,
      })
    }

    // Extract component library if requested
    let componentLibrary = null
    if (settings.componentLibraryExport) {
      componentLibrary = extractComponentsFromDOM(domData, settings)

      // Send component library to server
      await apiService.post(`extractions/${extractionJob.id}/components`, {
        componentLibrary: componentLibrary,
      })
    }

    // Extract assets if requested
    let assets = null
    if (settings.assetExport) {
      assets = await extractAssets(settings)

      // Send assets metadata to server
      await apiService.post(`extractions/${extractionJob.id}/assets`, {
        assets: {
          images: assets.images.map((img) => ({
            src: img.src,
            filename: img.filename,
            width: img.width,
            height: img.height,
          })),
          svgs: assets.svgs.map((svg) => ({
            id: svg.id,
            filename: svg.filename,
            width: svg.width,
            height: svg.height,
          })),
        },
      })

      // Upload each image
      for (const image of assets.images) {
        if (image.blob) {
          await apiService.uploadFile(`extractions/${extractionJob.id}/assets/upload`, image.blob, {
            filename: image.optimizedFilename,
            type: "image",
          })
        }
      }

      // Upload each SVG
      for (const svg of assets.svgs) {
        const svgBlob = new Blob([svg.content], { type: "image/svg+xml" })
        await apiService.uploadFile(`extractions/${extractionJob.id}/assets/upload`, svgBlob, {
          filename: svg.filename,
          type: "svg",
        })
      }
    }

    // Analyze responsive design if requested
    let responsiveData = null
    if (settings.responsiveAnalysis) {
      responsiveData = await analyzeResponsiveDesign(settings)

      // Send responsive data to server
      await apiService.post(`extractions/${extractionJob.id}/responsive`, {
        responsiveData: responsiveData,
      })

      // Generate responsive variants for Figma if we have figmaData
      if (figmaData && responsiveData.breakpoints) {
        responsiveData.figmaVariants = generateResponsiveFrames(figmaData, responsiveData.breakpoints)

        // Send responsive variants to server
        await apiService.post(`extractions/${extractionJob.id}/responsive/variants`, {
          figmaVariants: responsiveData.figmaVariants,
        })
      }

      // Generate responsive CSS for Next.js
      if (responsiveData.breakpoints) {
        responsiveData.css = generateResponsiveCss(responsiveData.breakpoints)

        // Send responsive CSS to server
        await apiService.post(`extractions/${extractionJob.id}/responsive/css`, {
          css: responsiveData.css,
        })
      }
    }

    // Finalize the extraction job
    await apiService.post(`extractions/${extractionJob.id}/complete`, {
      status: "completed",
    })

    // Send data to background script for processing and download
    chrome.runtime.sendMessage({
      action: "extractionComplete",
      data: {
        jobId: extractionJob.id,
        url: window.location.href,
        title: document.title,
      },
    })

    return {
      jobId: extractionJob.id,
      figmaData: figmaData ? true : false,
      nextjsCode: nextjsCode ? true : false,
      componentLibrary: componentLibrary ? true : false,
      assets: assets ? true : false,
      responsiveAnalysis: responsiveData ? true : false,
    }
  } catch (error) {
    console.error("Extraction error:", error)

    // Notify background script of error
    chrome.runtime.sendMessage({
      action: "extractionError",
      error: error.message,
    })

    throw error
  }
}

// Extract assets (images, SVGs, etc.)
async function extractAssets(settings) {
  try {
    console.log("Asset extraction started with settings:", settings)

    // Extract images
    const images = await extractImages(document, {
      quality: settings.imageQuality || 80,
      maxWidth: settings.maxImageWidth || 1920,
      maxHeight: settings.maxImageHeight || 1080,
    })

    // Extract SVGs
    const svgs = await extractSVGs(document)

    // Optimize images if requested
    if (settings.optimizeImages && images.length > 0) {
      for (const image of images) {
        try {
          // Skip images that are already optimized or have errors
          if (image.optimized || image.error) continue

          // Get original image size
          const response = await fetch(image.src)
          const blob = await response.blob()
          image.originalSize = blob.size

          // Optimize the image
          const optimized = await optimizeImage(image.src, {
            quality: settings.imageQuality || 80,
            maxWidth: settings.maxImageWidth || 1920,
            maxHeight: settings.maxImageHeight || 1080,
          })

          // Update image metadata
          image.width = optimized.width
          image.height = optimized.height
          image.optimizedSize = optimized.size
          image.compressionRatio = image.originalSize > 0 ? 1 - optimized.size / image.originalSize : 0
          image.blob = optimized.blob
          image.optimized = true
        } catch (error) {
          console.error(`Error optimizing image ${image.src}:`, error)
          image.error = error.message
        }
      }
    }

    // Convert SVGs to PNG if requested
    if (settings.convertSvgToPng && svgs.length > 0) {
      for (const svg of svgs) {
        try {
          // Skip SVGs that are already converted or have errors
          if (svg.pngBlob || svg.error) continue

          // Convert SVG to PNG
          svg.pngBlob = await convertSvgToPng(svg.content, svg.width, svg.height)
          svg.pngFilename = svg.filename.replace(".svg", ".png")
        } catch (error) {
          console.error(`Error converting SVG ${svg.id}:`, error)
          svg.error = error.message
        }
      }
    }

    return {
      images: images,
      svgs: svgs,
    }
  } catch (error) {
    console.error("Asset extraction error:", error)
    throw error
  }
}

// Analyze responsive design
async function analyzeResponsiveDesign(settings) {
  try {
    console.log("Responsive design analysis started with settings:", settings)

    // Detect breakpoints
    const breakpoints = await detectBreakpoints(document)

    return {
      breakpoints: breakpoints,
      windowWidth: window.innerWidth,
      windowHeight: window.innerHeight,
      devicePixelRatio: window.devicePixelRatio,
    }
  } catch (error) {
    console.error("Responsive design analysis error:", error)
    throw error
  }
}

// Extract component library specifically
async function extractComponentLibrary(settings) {
  try {
    console.log("Component library extraction started with settings:", settings)

    // Always extract from the full page for component library
    const rootElement = document.body

    // Extract DOM structure with high detection level for components
    const domData = extractDOMStructure(rootElement, "10") // Use highest detection level

    // Extract component library
    const componentLibrary = extractComponentsFromDOM(domData, settings)

    // Generate Figma components if requested
    let figmaComponents = null
    if (settings.figmaExport) {
      figmaComponents = generateFigmaComponentLibrary(componentLibrary, settings)
    }

    // Generate React components if requested
    let reactComponents = null
    if (settings.reactExport) {
      reactComponents = generateReactComponentLibrary(componentLibrary, settings)
    }

    // Send data to background script for processing and download
    chrome.runtime.sendMessage({
      action: "processComponentLibrary",
      data: {
        componentLibrary: componentLibrary,
        figmaComponents: figmaComponents,
        reactComponents: reactComponents,
        url: window.location.href,
        title: document.title,
        timestamp: new Date().toISOString(),
        settings: settings,
      },
    })

    return {
      componentLibrary: true,
      figmaComponents: figmaComponents ? true : false,
      reactComponents: reactComponents ? true : false,
    }
  } catch (error) {
    console.error("Component library extraction error:", error)
    throw error
  }
}

// Extract DOM structure and computed styles
function extractDOMStructure(element, detectionLevel) {
  const sensitivity = Number.parseInt(detectionLevel)

  // Skip invisible elements
  const computedStyle = window.getComputedStyle(element)
  if (computedStyle.display === "none" || computedStyle.visibility === "hidden" || computedStyle.opacity === "0") {
    return null
  }

  // Get element properties
  const rect = element.getBoundingClientRect()

  // Skip elements with no dimensions
  if (rect.width === 0 || rect.height === 0) {
    return null
  }

  // Extract element data
  const elementData = {
    tagName: element.tagName.toLowerCase(),
    id: element.id,
    classes: Array.from(element.classList),
    attributes: {},
    styles: {},
    text: element.tagName === "IMG" ? null : element.textContent.trim(),
    rect: {
      x: rect.left + window.scrollX,
      y: rect.top + window.scrollY,
      width: rect.width,
      height: rect.height,
    },
    children: [],
  }

  // Extract attributes
  for (const attr of element.attributes) {
    if (attr.name !== "id" && attr.name !== "class") {
      elementData.attributes[attr.name] = attr.value
    }
  }

  // Special handling for images
  if (element.tagName === "IMG") {
    elementData.attributes.src = element.src
    elementData.attributes.alt = element.alt
  }

  // Extract computed styles (important ones)
  const importantStyles = [
    "color",
    "backgroundColor",
    "fontSize",
    "fontFamily",
    "fontWeight",
    "lineHeight",
    "textAlign",
    "padding",
    "paddingTop",
    "paddingRight",
    "paddingBottom",
    "paddingLeft",
    "margin",
    "marginTop",
    "marginRight",
    "marginBottom",
    "marginLeft",
    "borderRadius",
    "borderWidth",
    "borderColor",
    "borderStyle",
    "boxShadow",
    "display",
    "flexDirection",
    "justifyContent",
    "alignItems",
    "gap",
    "position",
    "width",
    "height",
    "maxWidth",
    "minWidth",
    "maxHeight",
    "minHeight",
    "overflow",
    "zIndex",
    "opacity",
    "transform",
  ]

  importantStyles.forEach((style) => {
    elementData.styles[style] = computedStyle[style]
  })

  // Process children (if not a leaf node)
  if (element.children.length > 0) {
    for (const child of element.children) {
      const childData = extractDOMStructure(child, detectionLevel)
      if (childData) {
        elementData.children.push(childData)
      }
    }
  }

  // Component detection based on sensitivity
  if (sensitivity >= 5) {
    detectComponent(elementData, sensitivity)
  }

  return elementData
}

// Enhanced component detection with more component types
function detectComponent(elementData, sensitivity) {
  // Component detection heuristics
  const isButton = (el) => {
    return (
      el.tagName === "button" ||
      (el.tagName === "a" && el.styles.display.includes("inline-block")) ||
      el.classes.some((c) => c.includes("btn") || c.includes("button")) ||
      (el.rect.width <= 200 &&
        el.rect.height <= 60 &&
        (el.styles.backgroundColor !== "rgba(0, 0, 0, 0)" || el.styles.borderWidth !== "0px") &&
        el.text &&
        el.text.length < 30)
    )
  }

  const isCard = (el) => {
    return (
      (el.styles.boxShadow !== "none" || Number.parseInt(el.styles.borderRadius) > 0) &&
      el.children.length > 0 &&
      el.rect.width > 100 &&
      el.rect.height > 100
    )
  }

  const isNavbar = (el) => {
    return (
      (el.tagName === "nav" ||
        el.classes.some((c) => c.includes("nav") || c.includes("header") || c.includes("menu")) ||
        (el.rect.y < 150 && el.rect.width > window.innerWidth * 0.7 && el.rect.height < 150)) &&
      el.children.length > 1
    )
  }

  const isForm = (el) => {
    return (
      el.tagName === "form" ||
      (el.children.some(
        (child) =>
          child.tagName === "input" ||
          child.tagName === "textarea" ||
          child.tagName === "select" ||
          child.tagName === "button",
      ) &&
        el.children.length >= 2)
    )
  }

  const isModal = (el) => {
    return (
      (el.classes.some((c) => c.includes("modal") || c.includes("dialog") || c.includes("popup")) ||
        el.styles.position === "fixed" ||
        el.styles.position === "absolute") &&
      el.rect.width > 200 &&
      el.rect.height > 100 &&
      el.styles.zIndex > 1
    )
  }

  const isAlert = (el) => {
    return (
      el.classes.some((c) => c.includes("alert") || c.includes("notification") || c.includes("toast")) ||
      (el.rect.width > 200 &&
        el.rect.height < 150 &&
        (el.styles.backgroundColor !== "rgba(0, 0, 0, 0)" || el.styles.borderWidth !== "0px"))
    )
  }

  const isBadge = (el) => {
    return (
      el.classes.some((c) => c.includes("badge") || c.includes("tag") || c.includes("chip")) ||
      (el.rect.width < 100 &&
        el.rect.height < 40 &&
        Number.parseInt(el.styles.borderRadius) > 0 &&
        el.text &&
        el.text.length < 15)
    )
  }

  const isAvatar = (el) => {
    return (
      el.classes.some((c) => c.includes("avatar") || c.includes("profile-pic")) ||
      (el.rect.width <= 80 &&
        el.rect.height <= 80 &&
        el.rect.width === el.rect.height &&
        (Number.parseInt(el.styles.borderRadius) > el.rect.width / 4 || el.styles.borderRadius === "50%"))
    )
  }

  // Apply detection based on sensitivity
  if (isButton(elementData)) {
    elementData.component = "Button"
    // Store in component library
    storeComponentInLibrary(elementData, "Button")
  } else if (sensitivity >= 6 && isCard(elementData)) {
    elementData.component = "Card"
    storeComponentInLibrary(elementData, "Card")
  } else if (sensitivity >= 6 && isNavbar(elementData)) {
    elementData.component = "Navbar"
    storeComponentInLibrary(elementData, "Navbar")
  } else if (sensitivity >= 7 && isForm(elementData)) {
    elementData.component = "Form"
    storeComponentInLibrary(elementData, "Form")
  } else if (sensitivity >= 7 && isModal(elementData)) {
    elementData.component = "Modal"
    storeComponentInLibrary(elementData, "Modal")
  } else if (sensitivity >= 7 && isAlert(elementData)) {
    elementData.component = "Alert"
    storeComponentInLibrary(elementData, "Alert")
  } else if (sensitivity >= 8 && isBadge(elementData)) {
    elementData.component = "Badge"
    storeComponentInLibrary(elementData, "Badge")
  } else if (sensitivity >= 8 && isAvatar(elementData)) {
    elementData.component = "Avatar"
    storeComponentInLibrary(elementData, "Avatar")
  }

  // Advanced detection for higher sensitivity
  if (sensitivity >= 9) {
    // Detect more complex components like carousels, tabs, etc.
    const isCarousel = (el) => {
      return (
        el.classes.some((c) => c.includes("carousel") || c.includes("slider") || c.includes("swiper")) ||
        (el.children.length >= 3 &&
          el.styles.overflow === "hidden" &&
          el.children.every((child) => child.rect.width === el.children[0].rect.width))
      )
    }

    const isTabs = (el) => {
      return (
        el.classes.some((c) => c.includes("tab")) ||
        (el.children.length >= 2 &&
          el.children[0].children.length >= 2 &&
          el.children[0].styles.display.includes("flex"))
      )
    }

    const isAccordion = (el) => {
      return (
        el.classes.some((c) => c.includes("accordion") || c.includes("collapse")) ||
        (el.children.length >= 2 &&
          el.children.every((child) => child.children.length >= 2 && child.children[0].styles.display !== "none"))
      )
    }

    const isPagination = (el) => {
      return (
        el.classes.some((c) => c.includes("pagination") || c.includes("pager")) ||
        (el.children.length >= 3 &&
          el.styles.display === "flex" &&
          el.children.every(
            (child) => child.rect.width === child.rect.height || (child.text && !isNaN(Number(child.text))),
          ))
      )
    }

    const isDropdown = (el) => {
      return (
        el.classes.some((c) => c.includes("dropdown") || c.includes("menu") || c.includes("select")) ||
        (el.children.length >= 1 &&
          el.children[0].children &&
          el.children[0].children.length >= 2 &&
          el.styles.position === "relative")
      )
    }

    if (isCarousel(elementData)) {
      elementData.component = "Carousel"
      storeComponentInLibrary(elementData, "Carousel")
    } else if (isTabs(elementData)) {
      elementData.component = "Tabs"
      storeComponentInLibrary(elementData, "Tabs")
    } else if (isAccordion(elementData)) {
      elementData.component = "Accordion"
      storeComponentInLibrary(elementData, "Accordion")
    } else if (isPagination(elementData)) {
      elementData.component = "Pagination"
      storeComponentInLibrary(elementData, "Pagination")
    } else if (isDropdown(elementData)) {
      elementData.component = "Dropdown"
      storeComponentInLibrary(elementData, "Dropdown")
    }
  }
}

// Store component in the library
function storeComponentInLibrary(elementData, componentType) {
  // Generate a unique ID for the component
  const componentId = `${componentType}_${Math.random().toString(36).substring(2, 10)}`

  // Store the component with its type
  if (!detectedComponents.has(componentType)) {
    detectedComponents.set(componentType, [])
  }

  // Add component to the library
  detectedComponents.get(componentType).push({
    id: componentId,
    type: componentType,
    element: elementData,
    // Add similarity score for grouping similar components
    similarityGroup: calculateSimilarityGroup(elementData, componentType),
  })
}

// Calculate a similarity group for components of the same type
function calculateSimilarityGroup(elementData, componentType) {
  // This is a simplified approach - in a real implementation, you would use
  // more sophisticated similarity metrics based on styles, structure, etc.

  let groupKey = ""

  switch (componentType) {
    case "Button":
      // Group buttons by color, size, and border radius
      const bgColor = elementData.styles.backgroundColor
      const borderRadius = elementData.styles.borderRadius
      const width = Math.round(elementData.rect.width / 20) * 20 // Round to nearest 20px
      groupKey = `${bgColor}_${borderRadius}_${width}`
      break

    case "Card":
      // Group cards by shadow, border radius, and aspect ratio
      const shadow = elementData.styles.boxShadow
      const cardRadius = elementData.styles.borderRadius
      const aspectRatio = Math.round((elementData.rect.width / elementData.rect.height) * 10) / 10
      groupKey = `${shadow}_${cardRadius}_${aspectRatio}`
      break

    case "Alert":
    case "Badge":
      // Group by color and border radius
      const color = elementData.styles.backgroundColor
      const badgeRadius = elementData.styles.borderRadius
      groupKey = `${color}_${badgeRadius}`
      break

    default:
      // Default grouping by size and position
      const size = `${Math.round(elementData.rect.width / 50)}_${Math.round(elementData.rect.height / 50)}`
      groupKey = size
  }

  return groupKey
}

// Extract components from DOM data
function extractComponentsFromDOM(domData, settings) {
  // Clear previous components
  detectedComponents.clear()

  // Recursively process the DOM to detect components
  processNodeForComponents(domData, settings.detectionLevel || "8")

  // Convert the Map to a structured object for export
  const componentLibrary = {
    metadata: {
      url: window.location.href,
      title: document.title,
      extractedAt: new Date().toISOString(),
      totalComponents: Array.from(detectedComponents.values()).reduce((acc, arr) => acc + arr.length, 0),
    },
    components: {},
  }

  // Group components by type
  for (const [type, components] of detectedComponents.entries()) {
    componentLibrary.components[type] = components
  }

  return componentLibrary
}

// Process a node recursively to detect components
function processNodeForComponents(node, sensitivity) {
  // Skip if node is null
  if (!node) return

  // Detect components in this node
  detectComponent(node, Number.parseInt(sensitivity))

  // Process children recursively
  if (node.children && node.children.length > 0) {
    for (const child of node.children) {
      processNodeForComponents(child, sensitivity)
    }
  }
}

// Generate Figma component library
function generateFigmaComponentLibrary(componentLibrary, settings) {
  const figmaComponents = {
    name: "Component Library - " + document.title,
    document: {
      children: [],
    },
  }

  // Create a frame for each component type
  let yOffset = 0
  const FRAME_PADDING = 100

  for (const [componentType, components] of Object.entries(componentLibrary.components)) {
    // Skip if no components of this type
    if (components.length === 0) continue

    // Create a frame for this component type
    const frame = {
      id: `frame_${componentType}`,
      name: `${componentType} Components`,
      type: "FRAME",
      x: 0,
      y: yOffset,
      width: 1200,
      height: 0, // Will be calculated based on components
      fills: [{ type: "SOLID", color: { r: 1, g: 1, b: 1 } }],
      strokes: [],
      children: [],
    }

    // Group components by similarity
    const groupedComponents = {}
    components.forEach((comp) => {
      if (!groupedComponents[comp.similarityGroup]) {
        groupedComponents[comp.similarityGroup] = []
      }
      groupedComponents[comp.similarityGroup].push(comp)
    })

    // Add components to the frame
    let maxHeight = 0
    let xPos = FRAME_PADDING
    let yPos = FRAME_PADDING

    // For each similarity group
    Object.values(groupedComponents).forEach((group, groupIndex) => {
      // Take the first component as the representative for this group
      const component = group[0]

      // Convert the component to a Figma node
      const componentNode = convertElementToFigmaComponent(component.element, componentType)

      // Position the component
      componentNode.x = xPos
      componentNode.y = yPos

      // Add to frame
      frame.children.push(componentNode)

      // Update position for next component
      xPos += componentNode.width + FRAME_PADDING

      // If we've reached the edge of the frame, move to the next row
      if (xPos > 1200 - FRAME_PADDING) {
        xPos = FRAME_PADDING
        yPos += maxHeight + FRAME_PADDING
        maxHeight = 0
      }

      // Update max height for this row
      maxHeight = Math.max(maxHeight, componentNode.height)
    })

    // Update frame height
    frame.height = yPos + maxHeight + FRAME_PADDING

    // Add frame to document
    figmaComponents.document.children.push(frame)

    // Update yOffset for next frame
    yOffset += frame.height + FRAME_PADDING
  }

  return figmaComponents
}

// Convert element to Figma component
function convertElementToFigmaComponent(element, componentType) {
  // Create a component node
  const componentNode = {
    id: `component_${Math.random().toString(36).substring(2, 10)}`,
    name: componentType,
    type: "COMPONENT",
    x: 0,
    y: 0,
    width: element.rect.width,
    height: element.rect.height,
    fills: [],
    strokes: [],
    children: [],
    componentPropertyDefinitions: {},
  }

  // Add background color if present
  if (element.styles.backgroundColor && element.styles.backgroundColor !== "rgba(0, 0, 0, 0)") {
    componentNode.fills.push({
      type: "SOLID",
      color: parseColor(element.styles.backgroundColor),
    })
  }

  // Add border if present
  if (element.styles.borderWidth && element.styles.borderWidth !== "0px") {
    componentNode.strokes.push({
      type: "SOLID",
      color: parseColor(element.styles.borderColor),
    })
    componentNode.strokeWeight = Number.parseInt(element.styles.borderWidth)
  }

  // Add border radius if present
  if (element.styles.borderRadius && element.styles.borderRadius !== "0px") {
    componentNode.cornerRadius = Number.parseInt(element.styles.borderRadius)
  }

  // Add text if present
  if (element.text) {
    const textNode = {
      id: `text_${Math.random().toString(36).substring(2, 10)}`,
      name: "Text",
      type: "TEXT",
      x: 0,
      y: 0,
      width: element.rect.width,
      height: element.rect.height,
      characters: element.text,
      style: {
        fontFamily: element.styles.fontFamily.split(",")[0].replace(/['"]/g, ""),
        fontSize: Number.parseInt(element.styles.fontSize),
        fontWeight: Number.parseInt(element.styles.fontWeight),
        textAlignHorizontal: element.styles.textAlign.toUpperCase(),
        textAlignVertical: "CENTER",
        fills: [{ type: "SOLID", color: parseColor(element.styles.color) }],
      },
    }

    componentNode.children.push(textNode)
  }

  // Add component properties based on component type
  switch (componentType) {
    case "Button":
      componentNode.componentPropertyDefinitions = {
        text: {
          type: "TEXT",
          defaultValue: element.text || "Button",
        },
        variant: {
          type: "VARIANT",
          defaultValue: "default",
          variantOptions: ["default", "primary", "secondary", "outline", "ghost"],
        },
        size: {
          type: "VARIANT",
          defaultValue: "md",
          variantOptions: ["sm", "md", "lg"],
        },
        disabled: {
          type: "BOOLEAN",
          defaultValue: false,
        },
      }
      break

    case "Card":
      componentNode.componentPropertyDefinitions = {
        shadow: {
          type: "VARIANT",
          defaultValue: "default",
          variantOptions: ["none", "sm", "default", "lg"],
        },
        padding: {
          type: "VARIANT",
          defaultValue: "default",
          variantOptions: ["none", "sm", "default", "lg"],
        },
      }
      break

    case "Alert":
      componentNode.componentPropertyDefinitions = {
        variant: {
          type: "VARIANT",
          defaultValue: "default",
          variantOptions: ["default", "info", "success", "warning", "error"],
        },
        title: {
          type: "TEXT",
          defaultValue: element.text || "Alert Title",
        },
      }
      break
  }

  return componentNode
}

// Parse color from CSS color string
function parseColor(colorStr) {
  // Handle rgba format
  if (colorStr.startsWith("rgba")) {
    const matches = colorStr.match(/rgba$$(\d+),\s*(\d+),\s*(\d+),\s*([\d.]+)$$/)
    if (matches) {
      return {
        r: Number.parseInt(matches[1]) / 255,
        g: Number.parseInt(matches[2]) / 255,
        b: Number.parseInt(matches[3]) / 255,
        a: Number.parseFloat(matches[4]),
      }
    }
  }

  // Handle rgb format
  if (colorStr.startsWith("rgb")) {
    const matches = colorStr.match(/rgb$$(\d+),\s*(\d+),\s*(\d+)$$/)
    if (matches) {
      return {
        r: Number.parseInt(matches[1]) / 255,
        g: Number.parseInt(matches[2]) / 255,
        b: Number.parseInt(matches[3]) / 255,
        a: 1,
      }
    }
  }

  // Handle hex format
  if (colorStr.startsWith("#")) {
    const hex = colorStr.substring(1)
    const r = Number.parseInt(hex.substring(0, 2), 16) / 255
    const g = Number.parseInt(hex.substring(2, 4), 16) / 255
    const b = Number.parseInt(hex.substring(4, 6), 16) / 255
    return { r, g, b, a: 1 }
  }

  // Default fallback
  return { r: 0, g: 0, b: 0, a: 1 }
}

// Generate React component library
function generateReactComponentLibrary(componentLibrary, settings) {
  const reactComponents = {}

  // For each component type
  for (const [componentType, components] of Object.entries(componentLibrary.components)) {
    // Skip if no components of this type
    if (components.length === 0) continue

    // Group components by similarity
    const groupedComponents = {}
    components.forEach((comp) => {
      if (!groupedComponents[comp.similarityGroup]) {
        groupedComponents[comp.similarityGroup] = []
      }
      groupedComponents[comp.similarityGroup].push(comp)
    })

    // Take one representative component from each group
    const uniqueComponents = Object.values(groupedComponents).map((group) => group[0])

    // Generate React component for each unique component
    uniqueComponents.forEach((component, index) => {
      const componentName = `${componentType}${uniqueComponents.length > 1 ? index + 1 : ""}`
      const reactCode = generateReactComponentCode(component.element, componentType, componentName, settings)
      reactComponents[`${componentName}.${settings.useTypescript ? "tsx" : "jsx"}`] = reactCode
    })
  }

  // Generate index file to export all components
  const indexContent = generateComponentIndexFile(reactComponents, settings)
  reactComponents[`index.${settings.useTypescript ? "ts" : "js"}`] = indexContent

  return reactComponents
}

// Generate React component code
function generateReactComponentCode(element, componentType, componentName, settings) {
  const useTypescript = settings.useTypescript
  const useTailwind = settings.useTailwind

  // Generate props interface for TypeScript
  let propsInterface = ""
  if (useTypescript) {
    propsInterface = generatePropsInterface(componentType, componentName)
  }

  // Generate component JSX
  const componentJSX = generateComponentJSX(element, componentType, useTailwind)

  // Generate component function
  const componentFunction = useTypescript
    ? `export default function ${componentName}({ ${getPropsDestructuring(componentType)} }: ${componentName}Props) {`
    : `export default function ${componentName}({ ${getPropsDestructuring(componentType)} }) {`

  // Combine everything
  return `${useTypescript ? "'use client';\n\n" : "'use client';\n\n"}${propsInterface}

${componentFunction}
  return (
${componentJSX}
  );
}`
}

// Generate props interface for TypeScript
function generatePropsInterface(componentType, componentName) {
  switch (componentType) {
    case "Button":
      return `interface ${componentName}Props {
  children?: React.ReactNode;
  variant?: 'default' | 'primary' | 'secondary' | 'outline' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  onClick?: () => void;
  className?: string;
}`

    case "Card":
      return `interface ${componentName}Props {
  children?: React.ReactNode;
  className?: string;
}`

    case "Alert":
      return `interface ${componentName}Props {
  title?: string;
  children?: React.ReactNode;
  variant?: 'default' | 'info' | 'success' | 'warning' | 'error';
  onClose?: () => void;
  className?: string;
}`

    case "Badge":
      return `interface ${componentName}Props {
  children?: React.ReactNode;
  variant?: 'default' | 'primary' | 'secondary';
  className?: string;
}`

    case "Avatar":
      return `interface ${componentName}Props {
  src?: string;
  alt?: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}`

    default:
      return `interface ${componentName}Props {
  children?: React.ReactNode;
  className?: string;
}`
  }
}

// Get props destructuring based on component type
function getPropsDestructuring(componentType) {
  switch (componentType) {
    case "Button":
      return "children, variant = 'default', size = 'md', disabled = false, onClick, className = ''"

    case "Card":
      return "children, className = ''"

    case "Alert":
      return "title, children, variant = 'default', onClose, className = ''"

    case "Badge":
      return "children, variant = 'default', className = ''"

    case "Avatar":
      return "src, alt = '', size = 'md', className = ''"

    default:
      return "children, className = ''"
  }
}

// Generate component JSX
function generateComponentJSX(element, componentType, useTailwind) {
  // Convert element styles to Tailwind classes if using Tailwind
  const tailwindClasses = useTailwind ? convertStylesToTailwind(element.styles, componentType) : ""

  // Generate className prop
  const classNameProp = useTailwind
    ? ` className={\`${tailwindClasses} \${className}\`}`
    : ` className={\`${componentType.toLowerCase()} \${className}\`}`

  // Generate component JSX based on type
  switch (componentType) {
    case "Button":
      return `    <button
      type="button"${classNameProp}
      disabled={disabled}
      onClick={onClick}
    >
      {children}
    </button>`

    case "Card":
      return `    <div${classNameProp}>
      {children}
    </div>`

    case "Alert":
      return `    <div${classNameProp} role="alert">
      {title && <h5 className="font-medium">{title}</h5>}
      <div>{children}</div>
      {onClose && (
        <button 
          onClick={onClose}
          className="absolute top-2 right-2 p-1 rounded-md"
          aria-label="Close"
        >
          <svg width="15" height="15" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M11.7816 4.03157C12.0062 3.80702 12.0062 3.44295 11.7816 3.2184C11.5571 2.99385 11.193 2.99385 10.9685 3.2184L7.50005 6.68682L4.03164 3.2184C3.80708 2.99385 3.44301 2.99385 3.21846 3.2184C2.99391 3.44295 2.99391 3.80702 3.21846 4.03157L6.68688 7.49999L3.21846 10.9684C2.99391 11.193 2.99391 11.557 3.21846 11.7816C3.44301 12.0061 3.80708 12.0061 4.03164 11.7816L7.50005 8.31316L10.9685 11.7816C11.193 12.0061 11.5571 12.0061 11.7816 11.7816C12.0062 11.557 12.0062 11.193 11.7816 10.9684L8.31322 7.49999L11.7816 4.03157Z" fill="currentColor" fillRule="evenodd" clipRule="evenodd"></path>
          </svg>
        </button>
      )}
    </div>`

    case "Badge":
      return `    <span${classNameProp}>
      {children}
    </span>`

    case "Avatar":
      return `    <div${classNameProp}>
      <img
        src={src || "/placeholder.svg"}
        alt={alt}
        className="rounded-full object-cover w-full h-full"
      />
    </div>`

    default:
      return `    <div${classNameProp}>
      {children}
    </div>`
  }
}

// Convert styles to Tailwind classes
function convertStylesToTailwind(styles, componentType) {
  const classes = []

  // Base component classes
  switch (componentType) {
    case "Button":
      classes.push(
        "inline-flex items-center justify-center rounded-md font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none",
      )

      // Size classes
      classes.push("h-10 py-2 px-4 text-sm")

      // Color classes
      classes.push("bg-gray-900 text-white hover:bg-gray-800")
      break

    case "Card":
      classes.push("rounded-lg border bg-card text-card-foreground shadow-sm")
      classes.push("p-6")
      break

    case "Alert":
      classes.push("relative w-full rounded-lg border p-4")
      classes.push("bg-background text-foreground")
      break

    case "Badge":
      classes.push(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2",
      )
      classes.push("bg-primary text-primary-foreground hover:bg-primary/80")
      break

    case "Avatar":
      classes.push("relative flex h-10 w-10 shrink-0 overflow-hidden rounded-full")
      break

    default:
      // Generic container
      classes.push("rounded-md p-4")
      break
  }

  // Add specific style classes based on the element's actual styles
  if (styles.backgroundColor && styles.backgroundColor !== "rgba(0, 0, 0, 0)") {
    // Skip for components that already have background color in their base classes
    if (!["Button", "Badge"].includes(componentType)) {
      classes.push("bg-background")
    }
  }

  if (styles.borderRadius && styles.borderRadius !== "0px") {
    const radius = Number.parseInt(styles.borderRadius)
    if (radius <= 2) classes.push("rounded-sm")
    else if (radius <= 4) classes.push("rounded")
    else if (radius <= 6) classes.push("rounded-md")
    else if (radius <= 8) classes.push("rounded-lg")
    else if (radius <= 12) classes.push("rounded-xl")
    else if (radius <= 16) classes.push("rounded-2xl")
    else if (radius <= 24) classes.push("rounded-3xl")
    else classes.push("rounded-full")
  }

  if (styles.boxShadow && styles.boxShadow !== "none") {
    classes.push("shadow-sm")
  }

  return classes.join(" ")
}

// Generate index file to export all components
function generateComponentIndexFile(components, settings) {
  const componentNames = Object.keys(components)
    .filter((filename) => filename !== `index.${settings.useTypescript ? "ts" : "js"}`)
    .map((filename) => filename.split(".")[0])

  const exports = componentNames.map((name) => `export { default as ${name} } from './${name}';`).join("\n")

  return `${exports}\n`
}

