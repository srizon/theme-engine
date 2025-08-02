/*
 * Theme Engine Content Script
 * Applies custom CSS themes to web pages
 */

// Prevent multiple initializations
if (window.themeEngineInitialized) {
  console.log('Theme Engine: Already initialized, skipping...');
} else {
  window.themeEngineInitialized = true;

class ThemeEngineContent {
  constructor() {
    this.styleElement = null;
    this.currentCSS = null;
    this.isInitialized = false;
    this.isReady = false;
    
    this.init();
  }

  // Utility method to check if extension context is valid
  isExtensionContextValid() {
    return !!chrome.runtime?.id;
  }

  // Utility method to log warnings only in debug mode
  logDebugWarning(message) {
    if (chrome.runtime.getManifest().version.includes('dev') || 
        localStorage.getItem('theme-engine-debug') === 'true') {
      console.warn(`Theme Engine: ${message}`);
    }
  }

  init() {
    // Add a small delay to ensure extension context is ready
    setTimeout(() => {
      // Set up message listener
      this.setupMessageListener();
      
      // Wait for DOM to be ready
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
          this.initializeThemeEngine();
        });
      } else {
        this.initializeThemeEngine();
      }
    }, 50);
  }

  setupMessageListener() {
    console.log('Theme Engine: Setting up message listener...');
    
    // Add a small delay to ensure extension context is ready
    setTimeout(() => {
      // Listen for messages from popup
      if (chrome.runtime?.onMessage) {
        chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
                  // Check if extension context is still valid
        if (!this.isExtensionContextValid()) {
          this.logDebugWarning('Extension context invalid, ignoring message');
          sendResponse({ error: 'Extension context invalid' });
          return;
        }
          
          console.log('Theme Engine: Received message:', request.action);
          
          // Mark as ready when we receive our first message
          this.isReady = true;
          
          switch (request.action) {
            case 'applyCSS':
              // Check if theme is enabled before applying CSS
              this.checkAndApplyCSS(request.css);
              sendResponse({ success: true });
              break;
            case 'removeCSS':
              this.removeCSS();
              sendResponse({ success: true });
              break;
            case 'ping':
              // Simple ping to check if content script is ready
              console.log('Theme Engine: Responding to ping');
              sendResponse({ success: true, ready: true });
              break;
            case 'setDebugMode':
              // Update debug mode state
              localStorage.setItem('theme-engine-debug', request.debugMode.toString());
              sendResponse({ success: true });
              break;
            default:
              sendResponse({ error: 'Unknown action' });
          }
        });
      } else {
        console.warn('Theme Engine: Chrome runtime not available, message listener not set up');
      }
    }, 100);
  }

  initializeThemeEngine() {
    // Apply styles on initial load
    this.loadAndApplyCSS();
    
    // Listen for changes in storage and apply them in real-time
    if (chrome.storage?.onChanged) {
      chrome.storage.onChanged.addListener((changes, namespace) => {
        // Check if extension context is still valid
        if (!this.isExtensionContextValid()) {
          this.logDebugWarning('Extension context invalid, ignoring storage changes');
          return;
        }
        
        if (namespace === 'local') {
          // Listen for theme changes
          if (changes.themes || changes.currentThemeId) {
            if (this.isReady) {
              this.loadAndApplyCSS();
            }
          }
          // Also listen for isEnabled changes to toggle theme on/off
          if (changes.isEnabled !== undefined) {
            if (changes.isEnabled.newValue) {
              this.loadAndApplyCSS();
            } else {
              this.removeCSS();
            }
          }
          // Fallback mechanism: when lastApplied changes, reapply current CSS
          if (changes.lastApplied && this.isReady) {
            this.loadAndApplyCSS();
          }
        }
      });
    } else {
      console.warn('Theme Engine: Chrome storage not available, storage listener not set up');
    }

    this.isInitialized = true;
  }

  async loadAndApplyCSS() {
    try {
      // Check if extension context is still valid
      if (!chrome.runtime?.id) {
        console.warn('Theme Engine: Extension context invalid, skipping CSS load');
        return;
      }
      
      const data = await this.getStorageData(['themes', 'currentThemeId', 'isEnabled']);
      if (data.isEnabled && data.themes && data.currentThemeId && data.themes[data.currentThemeId]) {
        const theme = data.themes[data.currentThemeId];
        
        // Check if theme should apply to current URL
        if (!this.shouldApplyThemeToCurrentURL(theme)) {
          console.log('Theme Engine: Theme not applicable to current URL, removing CSS');
          this.removeCSS();
          return;
        }
        
        const processedCSS = this.processCSS(theme.css);
        this.applyCSS(processedCSS);
      }
    } catch (error) {
      console.error('Theme Engine: Error loading CSS:', error);
    }
  }

  async checkAndApplyCSS(css) {
    try {
      const data = await this.getStorageData(['isEnabled', 'themes', 'currentThemeId']);
      if (data.isEnabled) {
        // Check URL matching if we have theme data
        if (data.themes && data.currentThemeId && data.themes[data.currentThemeId]) {
          const theme = data.themes[data.currentThemeId];
          if (!this.shouldApplyThemeToCurrentURL(theme)) {
            console.log('Theme Engine: Theme not applicable to current URL, removing CSS');
            this.removeCSS();
            return;
          }
        }
        this.applyCSS(css);
      } else {
        // If theme is disabled, remove any existing CSS
        this.removeCSS();
      }
    } catch (error) {
      console.error('Theme Engine: Error checking theme state:', error);
    }
  }

  processCSS(rawCSS) {
    const lines = rawCSS.split('\n');
    let applyingStyles = '';
    const cssVariables = lines
      .map(line => {
        const trimmedLine = line.trim();
        if (trimmedLine && trimmedLine.startsWith('--')) {
          applyingStyles += this.generateApplyingCSS(trimmedLine) + '\n';
        }
        return trimmedLine;
      })
      .filter(line => line)
      .join('\n  ');

    // Only add :root block if we have CSS variables
    if (cssVariables.trim()) {
      return `:root {\n  ${cssVariables}\n}\n${applyingStyles}`;
    } else {
      // If no CSS variables, just return the original CSS
      return rawCSS;
    }
  }

  generateApplyingCSS(variable) {
    if (variable.startsWith('--bg-')) {
      const element = variable.substring(5, variable.indexOf(':')).replace(/-/g, ' ');
      const property = 'background-color';
      return `${element} { ${property}: var(${variable.substring(0, variable.indexOf(':'))}); }`;
    }
    return '';
  }

  applyCSS(css) {
    if (!css || typeof css !== 'string') {
      this.removeCSS();
      return;
    }

    // Don't reapply if CSS hasn't changed
    if (this.currentCSS === css) {
      return;
    }

    try {
      // Remove existing style element
      this.removeCSS();

      // Create new style element
      this.styleElement = document.createElement('style');
      this.styleElement.id = 'theme-engine-style';
      this.styleElement.setAttribute('data-theme-engine', 'true');
      
      // Add CSS content with error handling
      this.styleElement.textContent = this.sanitizeCSS(css);
      
      // Insert into document head with retry logic
      this.insertStyleElement();
      
    } catch (error) {
      console.error('Theme Engine: Error applying CSS:', error);
      this.removeCSS();
    }
  }

  insertStyleElement() {
    if (document.head) {
      document.head.appendChild(this.styleElement);
      this.currentCSS = this.styleElement.textContent;
    } else {
      // Retry after a short delay if head is not available
      setTimeout(() => {
        this.insertStyleElement();
      }, 100);
    }
  }

  removeCSS() {
    if (this.styleElement && this.styleElement.parentNode) {
      this.styleElement.parentNode.removeChild(this.styleElement);
    }
    
    // Also remove any existing theme engine styles
    const existingStyles = document.querySelectorAll('style[data-theme-engine="true"]');
    existingStyles.forEach(style => {
      if (style.parentNode) {
        style.parentNode.removeChild(style);
      }
    });
    
    this.styleElement = null;
    this.currentCSS = null;
  }

  sanitizeCSS(css) {
    // Basic CSS sanitization to prevent XSS
    // Remove any script tags or dangerous content
    return css
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/javascript:/gi, '')
      .replace(/expression\(/gi, '')
      .replace(/url\(javascript:/gi, 'url(')
      .trim();
  }

  // Helper method to check if theme should apply to current URL
  shouldApplyThemeToCurrentURL(theme) {
    // If no websiteUrl is specified, apply to all sites
    if (!theme.websiteUrl || theme.websiteUrl.trim() === '') {
      return true;
    }
    
    const currentUrl = window.location.href;
    const targetUrl = theme.websiteUrl.trim();
    
    // Handle special cases
    if (targetUrl.toLowerCase() === 'all sites' || targetUrl.toLowerCase() === 'for all sites') {
      return true;
    }
    
    try {
      // Parse URLs for comparison
      const current = new URL(currentUrl);
      
      // If targetUrl doesn't have protocol, add https://
      let normalizedTargetUrl = targetUrl;
      if (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://')) {
        normalizedTargetUrl = 'https://' + targetUrl;
      }
      
      const target = new URL(normalizedTargetUrl);
      
      // Exact URL match
      if (current.href === target.href) {
        return true;
      }
      
      // Domain match (including subdomains)
      if (current.hostname === target.hostname) {
        return true;
      }
      
      // Subdomain match (e.g., theme for "example.com" should work on "www.example.com")
      if (current.hostname.endsWith('.' + target.hostname) || 
          target.hostname.endsWith('.' + current.hostname)) {
        return true;
      }
      
      // Pattern matching with wildcards
      if (targetUrl.includes('*')) {
        const pattern = this.urlPatternToRegex(targetUrl);
        return pattern.test(currentUrl);
      }
      
    } catch (error) {
      console.warn('Theme Engine: Error parsing URLs for matching:', error);
      // Fall back to simple string matching
      return currentUrl.includes(targetUrl) || targetUrl.includes(current.hostname);
    }
    
    return false;
  }
  
  // Helper method to convert URL pattern with wildcards to regex
  urlPatternToRegex(pattern) {
    // Escape special regex characters except *
    const escaped = pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&');
    // Convert * to regex wildcard
    const regexPattern = escaped.replace(/\*/g, '.*');
    return new RegExp('^' + regexPattern + '$', 'i');
  }

  // Helper method for Chrome storage
  getStorageData(keys) {
    return new Promise((resolve) => {
      // Check if extension context is still valid
      if (!this.isExtensionContextValid()) {
        this.logDebugWarning('Extension context invalid, cannot access storage');
        resolve({});
        return;
      }
      
      chrome.storage.local.get(keys, resolve);
    });
  }

  // Public method to check if theme engine is active
  isActive() {
    return this.styleElement !== null && this.currentCSS !== null;
  }

  // Public method to get current CSS
  getCurrentCSS() {
    return this.currentCSS;
  }

  // Public method to force refresh
  refresh() {
    this.loadAndApplyCSS();
  }
}

// Initialize the content script with error handling
let themeEngine;
try {
  // Add a small delay to ensure extension context is ready
  setTimeout(() => {
    try {
      themeEngine = new ThemeEngineContent();
    } catch (error) {
      console.error('Theme Engine: Failed to initialize:', error);
    }
  }, 100);
} catch (error) {
  console.error('Theme Engine: Failed to set up initialization:', error);
}

// Handle page visibility changes to reapply styles if needed
document.addEventListener('visibilitychange', () => {
  // Check if extension context is still valid
  if (!chrome.runtime?.id) {
    // Only log warning in development mode or if debugging is enabled
    if (chrome.runtime.getManifest().version.includes('dev') || 
        localStorage.getItem('theme-engine-debug') === 'true') {
      console.warn('Theme Engine: Extension context invalid, skipping visibility change handler');
    }
    return;
  }
  
  if (!document.hidden && themeEngine?.isInitialized) {
    // Small delay to ensure DOM is ready
    setTimeout(() => {
      if (themeEngine && themeEngine.isExtensionContextValid()) {
        themeEngine.refresh();
      }
    }, 100);
  }
});

// Handle dynamic content changes (for SPAs)
let observer;
if (typeof MutationObserver !== 'undefined') {
  observer = new MutationObserver((mutations) => {
    // Check if head was modified and our style was removed
    mutations.forEach((mutation) => {
      if (mutation.type === 'childList' && mutation.target === document.head) {
        const removedNodes = Array.from(mutation.removedNodes);
        const wasThemeStyleRemoved = removedNodes.some(node => 
          node.id === 'theme-engine-style' || 
          (node.getAttribute && node.getAttribute('data-theme-engine') === 'true')
        );
        
        if (wasThemeStyleRemoved && themeEngine?.isActive()) {
          // Check if extension context is still valid before refreshing
          if (themeEngine.isExtensionContextValid()) {
            // Reapply the CSS if it was removed
            setTimeout(() => {
              themeEngine.refresh();
            }, 50);
          }
        }
      }
    });
  });

  // Start observing
  if (document.head) {
    observer.observe(document.head, {
      childList: true,
      subtree: false
    });
  }
}

// Close the initialization check
}