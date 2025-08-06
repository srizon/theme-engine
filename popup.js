class ThemeEngine {
  constructor() {
    this.toggleSwitch = document.getElementById('toggle-switch');
    
    // Theme management elements
    this.themeList = document.getElementById('theme-list');
    this.createThemeBtn = document.getElementById('create-theme-btn');
    this.importThemeBtn = document.getElementById('import-theme-btn');
    this.scanButton = document.getElementById('scan-button');
    
    // Modal elements
    this.themeModal = document.getElementById('theme-modal');
    this.modalTitle = document.getElementById('modal-title');
    this.themeNameInput = document.getElementById('theme-name');
    this.themeDescriptionInput = document.getElementById('theme-description');
    this.themeWebsiteUrlInput = document.getElementById('theme-website-url');
    this.modalClose = document.getElementById('modal-close');
    this.modalCancel = document.getElementById('modal-cancel');
    this.modalSave = document.getElementById('modal-save');
    
    this.isEnabled = false;
    
    // Theme management state
    this.themes = {};
    this.currentThemeId = null;
    this.editingThemeId = null;
    this.modalMode = 'create'; // 'create' or 'edit'
    
    this.init();
  }

  init() {
    this.setupEventListeners();
    this.loadThemes();
    this.setupStorageListener();
  }

  setupEventListeners() {
    // Toggle switch
    this.toggleSwitch.addEventListener('click', () => {
      this.toggleTheme();
    });

    // Theme management events
    this.createThemeBtn.addEventListener('click', () => {
      this.openCreateThemeModal();
    });

    this.importThemeBtn.addEventListener('click', () => {
      this.importThemeFromComputer();
    });

    this.scanButton.addEventListener('click', () => {
      this.scanCurrentPage();
    });



    // Modal events
    this.modalClose.addEventListener('click', () => {
      this.closeModal();
    });

    this.modalCancel.addEventListener('click', () => {
      this.closeModal();
    });

    this.modalSave.addEventListener('click', () => {
      this.saveThemeFromModal();
    });

    // Close modal when clicking outside
    this.themeModal.addEventListener('click', (e) => {
      if (e.target === this.themeModal) {
        this.closeModal();
      }
    });
  }

  setupStorageListener() {
    // Listen for changes in chrome storage to update the UI when themes are modified from the editor
    chrome.storage.onChanged.addListener((changes, namespace) => {
      if (namespace === 'local' && changes.themes) {
        // Reload themes and update UI when themes are changed
        this.loadThemes();
      }
    });

    // Refresh timestamps every 30 seconds to keep them accurate
    setInterval(() => {
      this.updateThemeUI();
    }, 30000);
  }

  // Theme Management Methods
  async loadThemes() {
    try {
      const data = await this.getStorageData(['themes', 'currentThemeId', 'isEnabled']);
      
      // Initialize themes structure if it doesn't exist
      if (!data.themes) {
        // Create default themes to match the design
        const defaultThemes = {
          'theme1': {
            id: 'theme1',
            name: 'My first theme',
            description: 'A simple theme for demonstration',
            websiteUrl: 'https://example.com',
            css: '--black: #000;\n--text-color: var(--black);',
            createdAt: new Date(Date.now() - 5 * 60 * 1000).toISOString(), // 5 minutes ago
            updatedAt: new Date(Date.now() - 5 * 60 * 1000).toISOString()
          },
          'theme2': {
            id: 'theme2',
            name: 'Google theme',
            description: 'Custom styling for Google search',
            websiteUrl: 'https://google.com',
            css: '--bg-button: #4285f4;\n--text-color: #202124;',
            createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(), // 1 day ago
            updatedAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
          },
          'theme3': {
            id: 'theme3',
            name: 'Universal dark theme',
            description: 'Dark theme for all websites',
            websiteUrl: '',
            css: '--bg-header: #1a1a1a;\n--text-color: #ffffff;',
            createdAt: new Date(Date.now() - 5 * 60 * 1000).toISOString(), // 5 minutes ago
            updatedAt: new Date(Date.now() - 5 * 60 * 1000).toISOString()
          }
        };
        
        this.themes = defaultThemes;
        this.currentThemeId = 'theme1';
        
        await this.setStorageData({
          themes: this.themes,
          currentThemeId: this.currentThemeId
        });
      } else {
        this.themes = data.themes;
        this.currentThemeId = data.currentThemeId || Object.keys(this.themes)[0];
      }
      
      if (data.isEnabled !== undefined) {
        this.isEnabled = data.isEnabled;
      }
      
      this.updateThemeUI();
      this.updateToggleState();
      
    } catch (error) {
      console.error('Error loading themes:', error);
    }
  }

  updateThemeUI() {
    // Update theme list
    this.themeList.innerHTML = '';
    Object.values(this.themes).forEach((theme, index) => {
      const themeItem = document.createElement('div');
      const isActive = theme.id === this.currentThemeId;
      themeItem.className = `theme-item ${isActive ? 'active' : 'inactive'}`;
      themeItem.dataset.themeId = theme.id;
      
      // Generate URL display for theme
      const themeUrl = theme.websiteUrl ? 
        `for ${theme.websiteUrl}` : 
        'for all sites';
      const updatedTime = this.getRelativeTime(theme.updatedAt);
      
      // Use different icons for selected vs unselected themes
      const themeIconSvg = isActive ? 
        `<img src="icons/icon-theme-seclected.svg" width="24" height="24" alt="Selected theme">` :
        `<img src="icons/icon-theme-unselected.svg" width="24" height="24" alt="Unselected theme">`;

      themeItem.innerHTML = `
        <div class="theme-icon">
          ${themeIconSvg}
        </div>
        <div class="theme-content">
          <div class="theme-name">${theme.name}</div>
          <div class="theme-details">
            <div class="theme-url">${themeUrl}</div>
            <div class="theme-updated">${updatedTime}</div>
          </div>
        </div>
        <div class="theme-edit-button" data-action="edit">
          <img src="icons/icon-edit.svg" width="24" height="24" alt="Edit theme">
        </div>
      `;
      
      // Add click event to switch theme
      themeItem.addEventListener('click', (e) => {
        if (!e.target.closest('.theme-edit-button')) {
          this.switchTheme(theme.id);
        }
      });
      
      // Add edit button event
      const editBtn = themeItem.querySelector('.theme-edit-button');
      editBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.openEditor(theme.id);
      });
      
      this.themeList.appendChild(themeItem);
    });
  }

  async switchTheme(themeId) {
    if (!themeId || !this.themes[themeId]) {
      return;
    }

    this.currentThemeId = themeId;
    await this.setStorageData({ currentThemeId: this.currentThemeId });
    
    this.updateThemeUI();
    
    // Apply the new theme if enabled
    if (this.isEnabled) {
      this.applyCSS();
    }
  }

  getRelativeTime(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const diffInSeconds = Math.floor((now - date) / 1000);
    const diffInMinutes = Math.floor(diffInSeconds / 60);
    
    if (diffInSeconds < 10) {
      return 'Updated just now';
    } else if (diffInSeconds < 60) {
      return `Updated ${diffInSeconds} sec ago`;
    } else if (diffInMinutes < 60) {
      return `Updated ${diffInMinutes} min ago`;
    } else if (diffInMinutes < 1440) {
      const hours = Math.floor(diffInMinutes / 60);
      return `Updated ${hours} hour${hours > 1 ? 's' : ''} ago`;
    } else if (diffInMinutes < 10080) {
      const days = Math.floor(diffInMinutes / 1440);
      return days === 1 ? 'Updated yesterday' : `Updated ${days} days ago`;
    } else {
      return `Updated ${date.toLocaleDateString()}`;
    }
  }

  openEditor(themeId) {
    // Open the editor page in a new window
    const editorUrl = chrome.runtime.getURL('editor.html') + `?theme=${themeId}`;
    chrome.windows.create({
      url: editorUrl,
      type: 'popup',
      width: 500,
      height: 700
    });
  }

  openCreateThemeModal() {
    this.modalMode = 'create';
    this.editingThemeId = null;
    this.modalTitle.textContent = 'Create New Theme';
    this.themeNameInput.value = '';
    this.themeDescriptionInput.value = '';
    this.themeWebsiteUrlInput.value = '';
    this.themeModal.classList.add('show');
    this.themeNameInput.focus();
  }

  closeModal() {
    this.themeModal.classList.remove('show');
    this.editingThemeId = null;
  }

  async saveThemeFromModal() {
    const name = this.themeNameInput.value.trim();
    const description = this.themeDescriptionInput.value.trim();
    const websiteUrl = this.themeWebsiteUrlInput.value.trim();
    
    if (!name) {
      alert('Please enter a theme name');
      return;
    }

    try {
      if (this.modalMode === 'create') {
        // Create new theme
        const newThemeId = 'theme_' + Date.now();
        const newTheme = {
          id: newThemeId,
          name: name,
          description: description,
          websiteUrl: websiteUrl,
          css: '--black: #000;\n--text-color: var(--black);',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
        
        this.themes[newThemeId] = newTheme;
        this.currentThemeId = newThemeId;
        
      } else if (this.modalMode === 'edit' && this.editingThemeId) {
        // Edit existing theme
        this.themes[this.editingThemeId].name = name;
        this.themes[this.editingThemeId].description = description;
        this.themes[this.editingThemeId].websiteUrl = websiteUrl;
        this.themes[this.editingThemeId].updatedAt = new Date().toISOString();
      }
      
      await this.setStorageData({
        themes: this.themes,
        currentThemeId: this.currentThemeId
      });
      
      this.updateThemeUI();
      this.closeModal();
      
      if (this.modalMode === 'create') {
        // Open the editor for the new theme
        this.openEditor(this.currentThemeId);
      }
      
    } catch (error) {
      console.error('Error saving theme:', error);
      alert('Error saving theme');
    }
  }

  async deleteTheme(themeId) {
    if (!themeId || !this.themes[themeId]) {
      return;
    }

    // Don't allow deleting the last theme
    if (Object.keys(this.themes).length <= 1) {
      alert('Cannot delete the last theme. Please create another theme first.');
      return;
    }

    if (!confirm(`Are you sure you want to delete "${this.themes[themeId].name}"?`)) {
      return;
    }

    try {
      delete this.themes[themeId];
      
      // If we deleted the current theme, switch to another one
      if (themeId === this.currentThemeId) {
        const remainingThemes = Object.keys(this.themes);
        this.currentThemeId = remainingThemes[0];
      }
      
      await this.setStorageData({
        themes: this.themes,
        currentThemeId: this.currentThemeId
      });
      
      this.updateThemeUI();
      
    } catch (error) {
      console.error('Error deleting theme:', error);
      alert('Error deleting theme');
    }
  }

  toggleTheme() {
    this.isEnabled = !this.isEnabled;
    this.updateToggleState();
    this.saveToggleState();
    
    if (this.isEnabled) {
      this.applyCSS();
    } else {
      this.removeCSS();
    }
  }

  updateToggleState() {
    if (this.isEnabled) {
      this.toggleSwitch.classList.remove('inactive');
    } else {
      this.toggleSwitch.classList.add('inactive');
    }
  }

  async saveToggleState() {
    try {
      await this.setStorageData({ isEnabled: this.isEnabled });
    } catch (error) {
      console.error('Error saving toggle state:', error);
    }
  }

  async applyCSS() {
    if (!this.isEnabled) return;
    
    try {
      if (this.currentThemeId && this.themes[this.currentThemeId]) {
        const theme = this.themes[this.currentThemeId];
        const processedCSS = this.processCSS(theme.css);
        
        // Send message to content script to apply CSS immediately
        this.sendMessageToContentScript({
          action: 'applyCSS',
          css: processedCSS
        });
      }
    } catch (error) {
      console.error('Error applying CSS:', error);
    }
  }

  async removeCSS() {
    try {
      // Send message to content script to remove CSS
      this.sendMessageToContentScript({
        action: 'removeCSS'
      });
    } catch (error) {
      console.error('Error removing CSS:', error);
    }
  }

  processCSS(rawCSS) {
    // Simple approach: just add !important to all CSS rules to ensure they override webpage styles
    // Extract CSS variables and put them in :root
    const lines = rawCSS.split('\n');
    const cssVariables = [];
    const otherCSS = [];
    
    lines.forEach(line => {
      const trimmedLine = line.trim();
      if (trimmedLine && trimmedLine.startsWith('--') && trimmedLine.includes(':')) {
        // This is a CSS variable definition
        cssVariables.push('  ' + trimmedLine);
      } else if (trimmedLine) {
        // This is regular CSS
        otherCSS.push(line);
      } else {
        // Empty line - preserve in other CSS
        otherCSS.push(line);
      }
    });

    // Process regular CSS to add !important
    const processedCSS = this.addImportantToCSS(otherCSS.join('\n'));
    
    // Combine everything: CSS variables in :root first, then all other CSS
    let result = '';
    if (cssVariables.length > 0) {
      // Use high specificity to ensure our variables override webpage variables
      result += ':root {\n' + cssVariables.join('\n') + '\n}\n';
      // Also add to html and body for extra specificity
      result += 'html, body {\n' + cssVariables.join('\n') + '\n}\n\n';
    }
    if (processedCSS.trim()) {
      result += processedCSS;
    }
    
    return result;
  }

  // Removed complex element generation - let users write their own CSS rules

  addImportantToCSS(css) {
    // Split CSS into rules
    const rules = css.split('}');
    const processedRules = rules.map(rule => {
      if (!rule.trim()) return rule;
      
      // Split rule into selector and properties
      const parts = rule.split('{');
      if (parts.length !== 2) return rule;
      
      const selector = parts[0].trim();
      const properties = parts[1].trim();
      
      if (!properties) return rule;
      
      // Process each property to add !important
      const processedProperties = properties.split(';')
        .map(property => {
          const trimmedProperty = property.trim();
          if (!trimmedProperty) return trimmedProperty;
          
          // Skip if already has !important
          if (trimmedProperty.includes('!important')) {
            return trimmedProperty;
          }
          
          // Add !important to the property
          return trimmedProperty + ' !important';
        })
        .filter(property => property) // Remove empty properties
        .join('; ');
      
      return `${selector} {\n  ${processedProperties}\n}`;
    });
    
    return processedRules.join('\n');
  }

  // Removed automatic CSS generation - variables are just made available in :root

  sendMessageToContentScript(message, callback = null) {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]) {
        chrome.tabs.sendMessage(tabs[0].id, message, (response) => {
          if (chrome.runtime.lastError) {
            console.log('Message send failed:', chrome.runtime.lastError);
            if (callback) callback({ success: false, error: chrome.runtime.lastError });
          } else {
            if (callback) callback(response);
          }
        });
      }
    });
  }

  // Helper methods for Chrome storage
  getStorageData(keys) {
    return new Promise((resolve) => {
      chrome.storage.local.get(keys, resolve);
    });
  }

  setStorageData(data) {
    return new Promise((resolve) => {
      chrome.storage.local.set(data, resolve);
    });
  }

  importThemeFromComputer() {
    // Create file input for importing themes
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,.css';
    input.style.display = 'none';
    
    input.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (event) => {
          try {
            let themeData;
            if (file.type === 'application/json' || file.name.endsWith('.json')) {
              themeData = JSON.parse(event.target.result);
            } else {
              // Assume CSS file
              themeData = {
                name: file.name.replace(/\.[^/.]+$/, ""),
                description: `Imported from ${file.name}`,
                css: event.target.result
              };
            }
            
            this.importTheme(themeData);
          } catch (error) {
            alert('Error reading file: ' + error.message);
          }
        };
        reader.readAsText(file);
      }
      
      // Clean up
      document.body.removeChild(input);
    });
    
    document.body.appendChild(input);
    input.click();
  }

  async importTheme(themeData) {
    try {
      const newThemeId = 'theme_' + Date.now();
      const newTheme = {
        id: newThemeId,
        name: themeData.name || 'Imported Theme',
        description: themeData.description || 'Imported theme',
        websiteUrl: themeData.websiteUrl || '',
        css: themeData.css || '--black: #000;\n--text-color: var(--black);',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      
      this.themes[newThemeId] = newTheme;
      this.currentThemeId = newThemeId;
      
      await this.setStorageData({
        themes: this.themes,
        currentThemeId: this.currentThemeId
      });
      
      this.updateThemeUI();
      
    } catch (error) {
      console.error('Error importing theme:', error);
      alert('Error importing theme');
    }
  }

  scanCurrentPage() {
    // Send message to content script to scan current page
    this.sendMessageToContentScript({
      action: 'scanPage'
    }, (response) => {
      if (response && response.success) {
        // Process scanned data and potentially create a new theme
        console.log('Page scanned successfully:', response.data);
      } else {
        console.log('Failed to scan page');
      }
    });
  }


}

// Initialize the app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  new ThemeEngine();
}); 