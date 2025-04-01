// Utility for converting our JSON format to Figma .fig format
export async function convertToFigFile(figmaData) {
    try {
      // In a real implementation, this would use the Figma API or a library
      // to convert the JSON data to a .fig file format
      // This is a simplified placeholder implementation
  
      // Create a binary representation of the Figma file
      // Note: This is a simplified mock implementation
      const encoder = new TextEncoder()
      const figmaFileHeader = encoder.encode("Figma1.0")
      const figmaFileContent = encoder.encode(JSON.stringify(figmaData))
  
      // Combine header and content
      const figmaFile = new Uint8Array(figmaFileHeader.length + figmaFileContent.length)
      figmaFile.set(figmaFileHeader)
      figmaFile.set(figmaFileContent, figmaFileHeader.length)
  
      // Return as blob
      return new Blob([figmaFile], { type: "application/octet-stream" })
    } catch (error) {
      console.error("Error converting to .fig file:", error)
      throw error
    }
  }
  
  // Apply customizations to the Figma data
  export function applyCustomizations(figmaData, customizations) {
    if (!customizations) return figmaData
  
    // Create a deep copy to avoid modifying the original
    const customizedData = JSON.parse(JSON.stringify(figmaData))
  
    // Apply color customizations
    if (customizations.colors) {
      // Update document theme colors
      if (!customizedData.document.children[0].styles) {
        customizedData.document.children[0].styles = {}
      }
  
      // Apply primary color to appropriate elements
      applyColorToElements(customizedData.document.children[0], "primary", hexToRgb(customizations.colors.primary))
  
      // Apply text color to text elements
      applyColorToElements(customizedData.document.children[0], "text", hexToRgb(customizations.colors.text))
  
      // Apply background color
      customizedData.document.children[0].fills = [
        {
          type: "SOLID",
          color: hexToRgb(customizations.colors.background),
        },
      ]
    }
  
    // Apply typography customizations
    if (customizations.typography) {
      applyFontToElements(customizedData.document.children[0], "heading", customizations.typography.headingFont)
      applyFontToElements(customizedData.document.children[0], "body", customizations.typography.bodyFont)
    }
  
    // Apply layout customizations
    if (customizations.layout) {
      // Set container width if not full width
      if (customizations.layout.containerWidth !== "full") {
        const containerWidth = Number.parseInt(customizations.layout.containerWidth)
        customizedData.document.children[0].width = containerWidth
  
        // Center the container
        if (customizedData.document.children[0].children.length > 0) {
          const rootFrame = customizedData.document.children[0]
          rootFrame.x = (1440 - containerWidth) / 2 // Assuming 1440px canvas width
        }
      }
    }
  
    return customizedData
  }
  
  // Helper function to apply colors to elements
  function applyColorToElements(node, type, color) {
    if (!node) return
  
    // Apply to current node based on type
    if (
      type === "primary" &&
      node.name &&
      (node.name.toLowerCase().includes("button") ||
        node.name.toLowerCase().includes("primary") ||
        node.name.toLowerCase().includes("accent"))
    ) {
      if (node.fills && node.fills.length > 0) {
        node.fills[0].color = color
      } else {
        node.fills = [{ type: "SOLID", color: color }]
      }
    }
  
    if (type === "text" && node.type === "TEXT") {
      if (node.style) {
        node.style.color = color
      }
    }
  
    // Recursively apply to children
    if (node.children && node.children.length > 0) {
      for (const child of node.children) {
        applyColorToElements(child, type, color)
      }
    }
  }
  
  // Helper function to apply fonts to elements
  function applyFontToElements(node, type, fontFamily) {
    if (!node) return
  
    // Apply to current node based on type
    if (node.type === "TEXT") {
      if (
        type === "heading" &&
        node.style &&
        (node.style.fontSize >= 18 ||
          node.name.toLowerCase().includes("heading") ||
          node.name.toLowerCase().includes("title"))
      ) {
        node.style.fontFamily = fontFamily
      }
  
      if (
        type === "body" &&
        node.style &&
        (node.style.fontSize < 18 ||
          !node.name.toLowerCase().includes("heading") ||
          !node.name.toLowerCase().includes("title"))
      ) {
        node.style.fontFamily = fontFamily
      }
    }
  
    // Recursively apply to children
    if (node.children && node.children.length > 0) {
      for (const child of node.children) {
        applyFontToElements(child, type, fontFamily)
      }
    }
  }
  
  // Helper function to convert hex color to RGB
  function hexToRgb(hex) {
    // Remove # if present
    hex = hex.replace("#", "")
  
    // Parse the hex values
    const r = Number.parseInt(hex.substring(0, 2), 16) / 255
    const g = Number.parseInt(hex.substring(2, 4), 16) / 255
    const b = Number.parseInt(hex.substring(4, 6), 16) / 255
  
    return { r, g, b, a: 1 }
  }
  
  