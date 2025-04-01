// Responsive design analysis utilities
import { debugLog, debugError } from "../debug.js"

// Common breakpoints (in pixels)
export const COMMON_BREAKPOINTS = {
  xs: 320, // Extra small devices (phones)
  sm: 576, // Small devices (large phones, small tablets)
  md: 768, // Medium devices (tablets)
  lg: 992, // Large devices (desktops)
  xl: 1200, // Extra large devices (large desktops)
  xxl: 1400, // Extra extra large devices
}

// Detect responsive breakpoints used in a website
export async function detectBreakpoints(document) {
  try {
    debugLog("Detecting responsive breakpoints")

    // Collect all media queries from stylesheets
    const mediaQueries = new Set()
    const breakpoints = []

    // Process all stylesheets
    for (const stylesheet of document.styleSheets) {
      try {
        // Skip cross-origin stylesheets
        if (stylesheet.href && new URL(stylesheet.href).origin !== window.location.origin) {
          continue
        }

        // Get all CSS rules
        const rules = stylesheet.cssRules || stylesheet.rules
        if (!rules) continue

        // Find media queries
        for (const rule of rules) {
          if (rule.type === CSSRule.MEDIA_RULE && rule.conditionText) {
            mediaQueries.add(rule.conditionText)
          }
        }
      } catch (error) {
        // Security error for cross-origin stylesheets
        debugError("Error accessing stylesheet:", error)
      }
    }

    // Process media queries to extract width breakpoints
    for (const query of mediaQueries) {
      const widthMatch = query.match(/$$min-width:\s*(\d+)px$$/i) || query.match(/$$max-width:\s*(\d+)px$$/i)

      if (widthMatch && widthMatch[1]) {
        const width = Number.parseInt(widthMatch[1])
        const type = query.includes("min-width") ? "min" : "max"

        // Add to breakpoints if not already included
        if (!breakpoints.some((bp) => bp.width === width && bp.type === type)) {
          breakpoints.push({
            width,
            type,
            query,
          })
        }
      }
    }

    // Sort breakpoints by width
    breakpoints.sort((a, b) => a.width - b.width)

    // Identify common breakpoints if no custom ones found
    if (breakpoints.length === 0) {
      debugLog("No custom breakpoints found, using common breakpoints")
      for (const [name, width] of Object.entries(COMMON_BREAKPOINTS)) {
        breakpoints.push({
          width,
          type: "min",
          query: `(min-width: ${width}px)`,
          name,
        })
      }
    } else {
      // Try to name the breakpoints based on common values
      for (const bp of breakpoints) {
        for (const [name, width] of Object.entries(COMMON_BREAKPOINTS)) {
          if (Math.abs(bp.width - width) <= 10) {
            bp.name = name
            break
          }
        }

        // If no name assigned, create one
        if (!bp.name) {
          bp.name = bp.type === "min" ? `min${bp.width}` : `max${bp.width}`
        }
      }
    }

    debugLog("Detected breakpoints:", breakpoints)
    return breakpoints
  } catch (error) {
    debugError("Error detecting breakpoints:", error)
    throw error
  }
}

// Generate responsive variants for Figma frames
export function generateResponsiveFrames(figmaData, breakpoints) {
  try {
    debugLog("Generating responsive Figma frames")

    // Create a deep copy of the original data
    const responsiveData = JSON.parse(JSON.stringify(figmaData))

    // Get the main frame/document
    const mainFrame = responsiveData.document.children[0]
    if (!mainFrame) {
      debugError("No main frame found in Figma data")
      return responsiveData
    }

    // Create responsive variants for each breakpoint
    const responsiveFrames = []

    for (const breakpoint of breakpoints) {
      // Skip very small breakpoints
      if (breakpoint.width < 320) continue

      // Create a copy of the main frame
      const frameVariant = JSON.parse(JSON.stringify(mainFrame))

      // Update frame properties
      frameVariant.id = `${frameVariant.id}_${breakpoint.name}`
      frameVariant.name = `${mainFrame.name} - ${breakpoint.name.toUpperCase()} (${breakpoint.width}px)`

      // Adjust frame width to match breakpoint
      const originalWidth = frameVariant.width
      frameVariant.width = Math.min(breakpoint.width, originalWidth)

      // Scale content if needed
      if (frameVariant.width !== originalWidth) {
        const scale = frameVariant.width / originalWidth
        scaleFrameContent(frameVariant, scale)
      }

      // Add to responsive frames
      responsiveFrames.push(frameVariant)
    }

    // Add responsive frames to the document
    responsiveData.document.children = [mainFrame, ...responsiveFrames]

    return responsiveData
  } catch (error) {
    debugError("Error generating responsive frames:", error)
    return figmaData
  }
}

// Helper function to scale frame content
function scaleFrameContent(frame, scale) {
  // Scale frame children
  if (frame.children && frame.children.length > 0) {
    for (const child of frame.children) {
      // Scale position
      if (child.x !== undefined) child.x *= scale
      if (child.y !== undefined) child.y *= scale

      // Scale size
      if (child.width !== undefined) child.width *= scale
      if (child.height !== undefined) child.height *= scale

      // Scale font size for text nodes
      if (child.type === "TEXT" && child.style && child.style.fontSize) {
        child.style.fontSize *= scale
      }

      // Recursively scale children
      if (child.children && child.children.length > 0) {
        scaleFrameContent(child, scale)
      }
    }
  }
}

// Generate responsive CSS for Next.js
export function generateResponsiveCss(breakpoints) {
  try {
    debugLog("Generating responsive CSS")

    // Create Tailwind-compatible breakpoints
    const tailwindBreakpoints = {}

    for (const bp of breakpoints) {
      // Use the name as the key and the width as the value
      tailwindBreakpoints[bp.name] = `${bp.width}px`
    }

    // Generate CSS for different frameworks
    const tailwindConfig = `
module.exports = {
  theme: {
    extend: {
      screens: ${JSON.stringify(tailwindBreakpoints, null, 6)}
    }
  }
}`

    const cssVariables = `
:root {
  ${breakpoints.map((bp) => `--breakpoint-${bp.name}: ${bp.width}px;`).join("\n  ")}
}`

    return {
      tailwindConfig,
      cssVariables,
    }
  } catch (error) {
    debugError("Error generating responsive CSS:", error)
    throw error
  }
}

