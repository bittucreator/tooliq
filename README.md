# Tooliq

<p align="center">
  <strong>Convert any website into Figma designs and Next.js code</strong>
</p>

<p align="center">
  <a href="#features">Features</a> •
  <a href="#installation">Installation</a> •
  <a href="#usage">Usage</a> •
  <a href="#development">Development</a> •
  <a href="#contributing">Contributing</a> •
  <a href="#license">License</a>
</p>

## Features

- 🎨 **Extract Designs**: Convert websites into Figma designs with preserved layers and components
- 💻 **Generate Code**: Transform websites into Next.js code with TypeScript and Tailwind CSS
- 🧩 **Component Detection**: Automatically identify UI components like buttons, cards, and forms
- 📱 **Responsive Analysis**: Detect breakpoints and responsive behavior
- 🖼️ **Asset Optimization**: Extract and optimize images and SVGs
- 🎭 **Customization**: Modify colors, typography, and layout before export

## Installation

### Chrome Web Store (Coming Soon)
Tooliq will be available on the Chrome Web Store. Stay tuned!

### Manual Installation
1. Download the latest release from the [Releases page](https://github.com/yourusername/tooliq/releases)
2. Unzip the file
3. Open Chrome and navigate to `chrome://extensions/`
4. Enable "Developer mode" in the top right
5. Click "Load unpacked" and select the unzipped folder

## Usage

1. Navigate to any website you want to extract
2. Click the Tooliq icon in your browser toolbar
3. Configure extraction options:
   - Choose between full page or selected element
   - Select export format (Figma, Next.js, or both)
   - Customize colors, typography, and layout
4. Click "Extract Design & Code"
5. Your extracted design and code will be downloaded as a zip file

Check out the [Documentation](docs/README.md) for detailed usage instructions.

## Development

### Prerequisites
- Node.js 16+
- npm or yarn

### Setup
1. Clone the repository
```bash
git clone https://github.com/yourusername/tooliq.git
cd tooliq
