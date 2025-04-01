// Helper function to apply customizations to Next.js code
export function applyNextJsCustomizations(nextjsFiles, customizations) {
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
  
  