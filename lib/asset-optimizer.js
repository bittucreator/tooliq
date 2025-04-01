// Asset optimization utilities
import { debugLog, debugError } from "../debug.js"

// Constants for image optimization
const MAX_IMAGE_WIDTH = 1920
const MAX_IMAGE_HEIGHT = 1080
const DEFAULT_QUALITY = 80

// Extract and optimize images from a webpage
export async function extractImages(document, options = {}) {
  try {
    const quality = options.quality || DEFAULT_QUALITY
    const maxWidth = options.maxWidth || MAX_IMAGE_WIDTH
    const maxHeight = options.maxHeight || MAX_IMAGE_HEIGHT

    debugLog("Extracting images with options:", { quality, maxWidth, maxHeight })

    // Find all images in the document
    const imgElements = document.querySelectorAll("img")
    const images = []

    for (const img of imgElements) {
      try {
        // Skip tiny images, placeholders, and data URLs
        if (img.naturalWidth < 50 || img.naturalHeight < 50) continue
        if (!img.src || img.src.startsWith("data:") || img.src.includes("placeholder")) continue

        // Create a unique filename based on the image path
        const urlObj = new URL(img.src)
        const pathname = urlObj.pathname
        const filename = pathname.split("/").pop() || `image-${images.length + 1}.jpg`

        // Get image metadata
        const metadata = {
          src: img.src,
          alt: img.alt || "",
          width: img.naturalWidth,
          height: img.naturalHeight,
          filename: filename,
          optimizedFilename: `optimized-${filename}`,
          originalSize: 0,
          optimizedSize: 0,
          compressionRatio: 0,
        }

        // Add to collection
        images.push(metadata)
      } catch (error) {
        debugError("Error processing image:", error)
      }
    }

    debugLog(`Found ${images.length} images to optimize`)
    return images
  } catch (error) {
    debugError("Error extracting images:", error)
    throw error
  }
}

// Extract SVGs from a webpage
export async function extractSVGs(document) {
  try {
    // Find all SVG elements
    const svgElements = document.querySelectorAll("svg")
    const svgs = []

    for (const [index, svg] of Array.from(svgElements).entries()) {
      try {
        // Clone the SVG to avoid modifying the original
        const clonedSvg = svg.cloneNode(true)

        // Generate SVG content
        const svgContent = new XMLSerializer().serializeToString(clonedSvg)

        // Create metadata
        const metadata = {
          id: `svg-${index + 1}`,
          filename: `icon-${index + 1}.svg`,
          content: svgContent,
          width: svg.width?.baseVal?.value || Number.parseInt(svg.getAttribute("width")) || 24,
          height: svg.height?.baseVal?.value || Number.parseInt(svg.getAttribute("height")) || 24,
        }

        svgs.push(metadata)
      } catch (error) {
        debugError("Error processing SVG:", error)
      }
    }

    debugLog(`Found ${svgs.length} SVGs`)
    return svgs
  } catch (error) {
    debugError("Error extracting SVGs:", error)
    throw error
  }
}

// Optimize an image using the Canvas API
export async function optimizeImage(imageUrl, options = {}) {
  try {
    const quality = options.quality || DEFAULT_QUALITY
    const maxWidth = options.maxWidth || MAX_IMAGE_WIDTH
    const maxHeight = options.maxHeight || MAX_IMAGE_HEIGHT

    // Load the image
    const img = await loadImage(imageUrl)

    // Calculate new dimensions while maintaining aspect ratio
    let width = img.width
    let height = img.height

    if (width > maxWidth || height > maxHeight) {
      const ratio = Math.min(maxWidth / width, maxHeight / height)
      width = Math.floor(width * ratio)
      height = Math.floor(height * ratio)
    }

    // Create canvas and draw image
    const canvas = document.createElement("canvas")
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext("2d")
    ctx.drawImage(img, 0, 0, width, height)

    // Get optimized image as blob
    const blob = await new Promise((resolve) => {
      canvas.toBlob(resolve, "image/jpeg", quality / 100)
    })

    return {
      blob,
      width,
      height,
      size: blob.size,
    }
  } catch (error) {
    debugError("Error optimizing image:", error)
    throw error
  }
}

// Helper function to load an image
function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = "anonymous"
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error(`Failed to load image: ${url}`))
    img.src = url
  })
}

// Convert SVG to PNG for use in Figma
export async function convertSvgToPng(svgContent, width = 24, height = 24) {
  try {
    // Create a blob URL for the SVG
    const blob = new Blob([svgContent], { type: "image/svg+xml" })
    const url = URL.createObjectURL(blob)

    // Load the SVG as an image
    const img = await loadImage(url)

    // Create canvas and draw SVG
    const canvas = document.createElement("canvas")
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext("2d")
    ctx.drawImage(img, 0, 0, width, height)

    // Get PNG as blob
    const pngBlob = await new Promise((resolve) => {
      canvas.toBlob(resolve, "image/png")
    })

    // Clean up
    URL.revokeObjectURL(url)

    return pngBlob
  } catch (error) {
    debugError("Error converting SVG to PNG:", error)
    throw error
  }
}

