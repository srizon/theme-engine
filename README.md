# Theme Engine Pro

A professional browser extension for customizing website themes with CSS variables and real-time theme application. Transform any website's appearance instantly with powerful theming capabilities.

![Theme Engine Pro](https://img.shields.io/badge/Version-3.0.1-blue.svg)
![Chrome Extension](https://img.shields.io/badge/Chrome-Extension-green.svg)
![Manifest V3](https://img.shields.io/badge/Manifest-V3-orange.svg)

## ✨ Features

- **🎨 Real-time Theme Application**: Apply custom CSS themes to any website instantly
- **🎯 CSS Variable Support**: Use CSS custom properties for dynamic theming
- **📁 Theme Management**: Create, edit, and manage multiple themes
- **🔗 URL Pattern Matching**: Apply themes to specific websites or all sites
- **📤 Import/Export**: Import themes from JSON or CSS files
- **⚡ Performance Optimized**: Built with Manifest V3 for better performance
- **🔄 Auto-sync**: Themes automatically sync across browser sessions

## 📋 Changelog

### v3.0.1 (Latest)
- **🎨 Icon Improvements**: Updated extension icons with proper PNG formats for better display
- **🔧 UI Refinements**: Improved button styling and layout in popup interface
- **📁 Asset Organization**: Moved icons to dedicated icons directory for better organization
- **✨ Enhanced UX**: Streamlined import button text for better clarity

### v3.0.0
- Initial release with core theming functionality
- Real-time theme application with CSS variables
- Theme management and URL pattern matching
- Import/export capabilities

## 🚀 Quick Start

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/srizon/theme-engine.git
   cd theme-engine
   ```

2. **Load in Chrome**
   - Open Chrome and navigate to `chrome://extensions/`
   - Enable "Developer mode" (toggle in top right)
   - Click "Load unpacked" and select the `theme-engine` folder
   - The extension icon should appear in your toolbar

### Usage

1. **Enable the Extension**: Click the extension icon and toggle the switch to enable
2. **Create a Theme**: Click "Create New Theme" to start customizing
3. **Edit Themes**: Use the built-in editor to modify CSS variables
4. **Apply to Sites**: Set URL patterns to apply themes to specific websites
5. **Import/Export**: Share themes with others or backup your creations

## 📁 Project Structure

```
theme-engine/
├── manifest.json          # Extension configuration (Manifest V3)
├── background.js          # Background service worker
├── content.js            # Content script for page injection
├── popup.html            # Extension popup interface
├── popup.js              # Popup functionality
├── editor.html           # Theme editor interface
├── editor.js             # Theme editor functionality
├── icons/                # Extension icons and assets
│   ├── icon16.png        # 16x16 extension icon
│   ├── icon32.png        # 32x32 extension icon
│   ├── icon48.png        # 48x48 extension icon
│   ├── icon128.png       # 128x128 extension icon
│   ├── icon-delete.svg
│   ├── icon-download.png
│   ├── icon-edit.svg
│   ├── icon-header.svg
│   ├── icon-reload.svg
│   ├── icon-theme-selected.svg
│   └── icon-theme-unselected.svg
```

## 🛠️ Development

### Prerequisites
- Google Chrome browser
- Basic knowledge of CSS and JavaScript

### Tech Stack
- **Manifest V3** - Modern Chrome extension framework
- **Service Workers** - Background processing
- **Content Scripts** - Page injection and manipulation
- **Chrome Storage API** - Data persistence
- **Chrome Scripting API** - Dynamic script injection

### Building from Source
```bash
# Clone the repository
git clone https://github.com/srizon/theme-engine.git

# Navigate to the project directory
cd theme-engine

# Load in Chrome as described in Installation section
```

## 🔧 Configuration

### Manifest Features
- **Permissions**: `activeTab`, `storage`, `scripting`
- **Host Permissions**: `<all_urls>` for universal theming
- **Content Scripts**: Run at `document_start` for early injection
- **Web Accessible Resources**: Editor interface accessible from any page

### Theme Format
Themes are stored as JSON objects with the following structure:
```json
{
  "name": "Theme Name",
  "description": "Theme description",
  "urlPattern": "*://*/*",
  "cssVariables": {
    "--primary-color": "#007bff",
    "--background-color": "#ffffff",
    "--text-color": "#333333"
  },
  "enabled": true
}
```

## 🐛 Troubleshooting

### Console Warnings
The extension may show console warnings like:
```
Theme Engine: Extension context invalid, skipping visibility change handler
```

**Why This Happens:**
- **Page navigation** - When moving between pages
- **Extension reloading** - During development when the extension is reloaded
- **Tab updates** - When tabs are refreshed or navigated
- **Service worker lifecycle** - Background service worker termination/restart

**How to Handle:**
1. **Normal Usage**: These warnings are harmless and don't affect functionality
2. **Development**: Warnings are automatically shown in development mode

### Common Issues

**Themes Not Applying:**
1. Ensure the extension is enabled (toggle switch is on)
2. Check that the theme is active
3. Verify the URL pattern matches the current site
4. Try refreshing the page

**Extension Not Working:**
1. Check if the extension is properly installed
2. Ensure "Developer mode" is enabled in Chrome extensions
3. Try reloading the extension
4. Check the browser console for errors

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- Built with Chrome Extension Manifest V3
- Inspired by the need for better website customization tools
- Thanks to the Chrome Extensions community for documentation and examples

## 📞 Support

If you encounter any issues or have questions:
1. Check the troubleshooting section above
2. Open an issue on GitHub with detailed information

---

**Made with ❤️ for web developers and designers** 