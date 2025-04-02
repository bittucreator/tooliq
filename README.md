# Tooliq - Website to Figma & Next.js Converter

<p align="center">
  <a href="#features">Features</a> •
  <a href="#installation">Installation</a> •
  <a href="#usage">Usage</a> •
  <a href="#development">Development</a> •
  <a href="#contributing">Contributing</a> •
  <a href="#license">License</a>
</p>

Tooliq is an open-source Chrome extension that converts any website into Figma designs and Next.js code. It bridges the gap between design and development, allowing you to extract, customize, and export complete design systems and functional code from existing websites.

## Features

- **Website Extraction**: Capture entire websites or specific elements
- **Component Detection**: Automatically identify UI components like buttons, cards, and forms
- **Figma Export**: Generate Figma designs with preserved layers and components
- **Next.js Code Generation**: Create production-ready Next.js components and pages
- **Asset Optimization**: Automatically optimize images and extract SVGs
- **Responsive Analysis**: Detect breakpoints and responsive behavior
- **Customization Options**: Modify colors, typography, and layout before export

## Installation

### From Chrome Web Store
1. Visit the [Tooliq Chrome Web Store page](https://chrome.google.com/webstore/detail/tooliq/your-extension-id)
2. Click "Add to Chrome"

### Manual Installation (Development)
1. Clone this repository
2. Copy `lib/config-template.js` to `lib/config.js` and add your API credentials
3. Run `npm install` to install dependencies
4. Run `npm run build` to build the extension
5. Open Chrome and navigate to `chrome://extensions/`
6. Enable "Developer mode"
7. Click "Load unpacked" and select the `dist` directory

## Usage

1. Navigate to any website you want to extract
2. Click the Tooliq extension icon in your browser toolbar
3. Configure extraction options
4. Click "Extract Design & Code"
5. Download the generated files or export directly to Figma

For detailed usage instructions, see the [Documentation](docs/USAGE.md).

## Development

### Prerequisites
- Node.js 16+
- npm or yarn

### Setup
```bash
# Clone the repository
git clone https://github.com/yourusername/tooliq.git
cd tooliq

# Install dependencies
npm install

# Copy config template and add your credentials
cp lib/config-template.js lib/config.js

# Start development server
npm run dev
