class ThemeEditor {
  constructor() {
    this.editor = document.getElementById('editor');
    this.editorHighlight = document.getElementById('editor-highlight');
    this.lineNumbers = document.getElementById('line-numbers');
    this.statusIndicator = document.getElementById('status-indicator');
    this.editorContainer = document.getElementById('editor-container');
    
    // Form input elements
    this.themeNameInput = document.getElementById('theme-name-input');
    this.websiteUrlInput = document.getElementById('website-url-input');
    
    // Action buttons
    this.exportBtn = document.getElementById('export-btn');
    this.deleteBtn = document.getElementById('delete-btn');
    
    this.isValid = true;
    this.validationTimeout = null;
    this.isHighlighting = false;
    this.autoSaveTimeout = null;
    
    // Theme data
    this.currentThemeId = null;
    this.theme = null;
    this.originalCSS = '';
    
    // Auto-suggestion properties
    this.suggestionBox = null;
    this.suggestions = [];
    this.currentSuggestionIndex = 0;
    this.isShowingSuggestions = false;
    this.suggestionTimeout = null;
    
    this.init();
  }

  init() {
    this.setupEventListeners();
    this.createSuggestionBox();
    this.loadThemeFromURL();
    this.updateLineNumbers();
    this.updateSyntaxHighlighting();
  }

  createSuggestionBox() {
    this.suggestionBox = document.createElement('div');
    this.suggestionBox.className = 'suggestion-box';
    this.suggestionBox.style.cssText = `
      position: absolute;
      background: #2d2d30;
      border: 1px solid #3e3e42;
      border-radius: 6px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
      max-height: 200px;
      overflow-y: auto;
      z-index: 1000;
      display: none;
      font-family: 'SF Mono', Monaco, 'Cascadia Code', 'Roboto Mono', Consolas, 'Courier New', monospace;
      font-size: 13px;
    `;
    document.body.appendChild(this.suggestionBox);
  }

  setupEventListeners() {
    // Action buttons
    this.exportBtn.addEventListener('click', () => {
      this.exportTheme();
    });

    this.deleteBtn.addEventListener('click', () => {
      this.deleteTheme();
    });

    // Form inputs - auto-save on change
    this.themeNameInput.addEventListener('input', () => {
      this.debounceAutoSave();
    });

    this.websiteUrlInput.addEventListener('input', () => {
      this.debounceAutoSave();
    });

    // Keyboard shortcuts
    this.editor.addEventListener('keydown', (e) => {
      // Handle suggestion navigation
      if (this.isShowingSuggestions) {
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          this.navigateSuggestions(1);
          return;
        }
        if (e.key === 'ArrowUp') {
          e.preventDefault();
          this.navigateSuggestions(-1);
          return;
        }
        if (e.key === 'Enter' || e.key === 'Tab') {
          e.preventDefault();
          this.selectSuggestion();
          return;
        }
        if (e.key === 'Escape') {
          e.preventDefault();
          this.hideSuggestions();
          return;
        }
      }
      
      // Handle tab key for indentation
      if (e.key === 'Tab') {
        e.preventDefault();
        this.handleTabKey(e.shiftKey);
      }
      
      // Handle enter key for proper indentation
      if (e.key === 'Enter') {
        e.preventDefault();
        this.handleEnterKey();
      }
      
      // Handle Ctrl+S for save
      if (e.key === 's' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        this.saveTheme();
      }
      
      // Handle Ctrl+/ for comment/uncomment
      if (e.key === '/' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        this.handleCommentToggle();
      }
    });

    // Auto-save on content change (debounced) - only if valid
    let saveTimeout;
    let highlightTimeout;
    this.editor.addEventListener('input', () => {
      clearTimeout(saveTimeout);
      clearTimeout(highlightTimeout);
      this.showStatus('Typing...', 'typing');
      
      // Update line numbers immediately
      this.updateLineNumbers();
      
      // Debounce syntax highlighting to prevent rapid updates
      highlightTimeout = setTimeout(() => {
        this.syncHighlightingLayer();
        this.updateSyntaxHighlighting();
      }, 50);
      
      // Simple validation without interrupting user
      this.simpleValidate();
      
      // Handle auto-suggestions
      this.handleAutoSuggestions();
      
      saveTimeout = setTimeout(() => {
        // Only auto-save if CSS is valid
        if (this.isValid) {
          this.autoSave();
        }
      }, 300); // Reduced from 500ms to 300ms for faster auto-save
    });

    // Handle scroll synchronization
    this.editor.addEventListener('scroll', () => {
      this.editorHighlight.scrollTop = this.editor.scrollTop;
      this.editorHighlight.scrollLeft = this.editor.scrollLeft;
    });
    
    // Ensure highlighting layer stays in sync with textarea dimensions
    const resizeObserver = new ResizeObserver(() => {
      this.syncHighlightingLayer();
    });
    
    resizeObserver.observe(this.editor);
    
    // Hide suggestions when clicking outside
    document.addEventListener('click', (e) => {
      if (this.isShowingSuggestions && !this.suggestionBox.contains(e.target) && e.target !== this.editor) {
        this.hideSuggestions();
      }
    });
  }

  handleAutoSuggestions() {
    if (this.suggestionTimeout) {
      clearTimeout(this.suggestionTimeout);
    }
    
    this.suggestionTimeout = setTimeout(() => {
      const cursorPos = this.editor.selectionStart;
      const value = this.editor.value;
      const beforeCursor = value.substring(0, cursorPos);
      
      // Check if we're typing a CSS property (after a selector, before a colon)
      const propertyMatch = this.getPropertySuggestions(beforeCursor);
      if (propertyMatch) {
        this.showPropertySuggestions(propertyMatch.suggestions, propertyMatch.prefix, propertyMatch.isVariable);
        return;
      }
      
      // Check if we're typing a CSS value (after a colon)
      const valueMatch = this.getValueSuggestions(beforeCursor);
      if (valueMatch) {
        this.showValueSuggestions(valueMatch.suggestions, valueMatch.prefix, valueMatch.property);
        return;
      }
      
      // Hide suggestions if no match
      this.hideSuggestions();
    }, 100);
  }

  getPropertySuggestions(beforeCursor) {
    // Look for the start of a property (after a closing brace or newline)
    const lines = beforeCursor.split('\n');
    const currentLine = lines[lines.length - 1];
    
    // Check if we're defining a CSS variable (--variable-name)
    const variableMatch = currentLine.match(/^(\s*)(--[a-zA-Z0-9-]*)$/);
    if (variableMatch) {
      const prefix = variableMatch[2];
      const suggestions = this.getCSSVariableNames(prefix);
      
      if (suggestions.length > 0) {
        return { suggestions, prefix, isVariable: true };
      }
    }
    
    // Check if we're in a property context (after a selector, before a colon)
    const propertyMatch = currentLine.match(/^(\s*)([a-zA-Z-]*)$/);
    if (propertyMatch) {
      const prefix = propertyMatch[2];
      const suggestions = this.getCSSProperties(prefix);
      
      if (suggestions.length > 0) {
        return { suggestions, prefix };
      }
    }
    
    return null;
  }

  getCSSVariableNames(prefix = '') {
    // Common CSS variable naming patterns
    const commonVariableNames = [
      '--bg-primary', '--bg-secondary', '--bg-tertiary',
      '--text-primary', '--text-secondary', '--text-muted',
      '--color-primary', '--color-secondary', '--color-accent',
      '--border-color', '--border-radius', '--border-width',
      '--font-family', '--font-size', '--font-weight',
      '--spacing-xs', '--spacing-sm', '--spacing-md', '--spacing-lg', '--spacing-xl',
      '--shadow-sm', '--shadow-md', '--shadow-lg',
      '--transition-duration', '--transition-timing',
      '--z-index-dropdown', '--z-index-modal', '--z-index-tooltip',
      '--header-height', '--sidebar-width', '--footer-height',
      '--container-max-width', '--grid-gap', '--border-radius-sm', '--border-radius-md', '--border-radius-lg'
    ];
    
    if (!prefix) return commonVariableNames.slice(0, 15);
    
    return commonVariableNames
      .filter(name => name.toLowerCase().includes(prefix.toLowerCase()))
      .sort((a, b) => {
        const aStarts = a.toLowerCase().startsWith(prefix.toLowerCase());
        const bStarts = b.toLowerCase().startsWith(prefix.toLowerCase());
        if (aStarts && !bStarts) return -1;
        if (!aStarts && bStarts) return 1;
        return a.localeCompare(b);
      })
      .slice(0, 15);
  }

  getValueSuggestions(beforeCursor) {
    // Look for a colon followed by potential value
    const lines = beforeCursor.split('\n');
    const currentLine = lines[lines.length - 1];
    
    // Check if we're after a colon (property: value)
    const valueMatch = currentLine.match(/^(\s*[a-zA-Z-]+:\s*)([a-zA-Z0-9#\-\(\)]*)$/);
    if (valueMatch) {
      const property = valueMatch[1].replace(/:\s*$/, '').trim();
      const prefix = valueMatch[2];
      const suggestions = this.getCSSValues(property, prefix);
      
      if (suggestions.length > 0) {
        return { suggestions, prefix, property };
      }
    }
    
    return null;
  }

  getCSSProperties(prefix = '') {
    const allProperties = [
      'background', 'background-color', 'background-image', 'background-repeat', 'background-position', 'background-size',
      'border', 'border-width', 'border-style', 'border-color', 'border-radius', 'border-top', 'border-right', 'border-bottom', 'border-left',
      'color', 'font', 'font-family', 'font-size', 'font-weight', 'font-style', 'font-variant', 'line-height',
      'margin', 'margin-top', 'margin-right', 'margin-bottom', 'margin-left',
      'padding', 'padding-top', 'padding-right', 'padding-bottom', 'padding-left',
      'width', 'height', 'min-width', 'min-height', 'max-width', 'max-height',
      'display', 'position', 'top', 'right', 'bottom', 'left', 'z-index',
      'float', 'clear', 'overflow', 'overflow-x', 'overflow-y',
      'text-align', 'text-decoration', 'text-transform', 'text-indent', 'text-shadow',
      'box-shadow', 'opacity', 'visibility', 'cursor', 'outline',
      'transition', 'animation', 'transform', 'filter',
      'flex', 'flex-direction', 'flex-wrap', 'flex-basis', 'flex-grow', 'flex-shrink',
      'grid', 'grid-template', 'grid-template-columns', 'grid-template-rows', 'grid-gap',
      'justify-content', 'align-items', 'align-content', 'justify-self', 'align-self',
      'object-fit', 'object-position', 'vertical-align', 'white-space', 'word-wrap',
      'list-style', 'list-style-type', 'list-style-position', 'list-style-image',
      'table-layout', 'border-collapse', 'border-spacing', 'empty-cells',
      'content', 'quotes', 'counter-reset', 'counter-increment',
      'page-break-before', 'page-break-after', 'page-break-inside',
      'orphans', 'widows', 'tab-size', 'hyphens', 'direction',
      'unicode-bidi', 'writing-mode', 'text-orientation', 'text-combine-upright'
    ];
    
    if (!prefix) return allProperties.slice(0, 20); // Show first 20 if no prefix
    
    return allProperties
      .filter(prop => prop.toLowerCase().includes(prefix.toLowerCase()))
      .sort((a, b) => {
        const aStarts = a.toLowerCase().startsWith(prefix.toLowerCase());
        const bStarts = b.toLowerCase().startsWith(prefix.toLowerCase());
        if (aStarts && !bStarts) return -1;
        if (!aStarts && bStarts) return 1;
        return a.localeCompare(b);
      })
      .slice(0, 15); // Limit to 15 suggestions
  }

  getCSSValues(property, prefix = '') {
    const propertyValues = {
      'display': ['block', 'inline', 'inline-block', 'flex', 'grid', 'table', 'none', 'contents'],
      'position': ['static', 'relative', 'absolute', 'fixed', 'sticky'],
      'color': ['transparent', 'currentColor', 'inherit', 'initial', 'unset'],
      'background-color': ['transparent', 'currentColor', 'inherit', 'initial', 'unset'],
      'border-style': ['solid', 'dashed', 'dotted', 'double', 'groove', 'ridge', 'inset', 'outset', 'none', 'hidden'],
      'text-align': ['left', 'right', 'center', 'justify', 'start', 'end'],
      'font-weight': ['normal', 'bold', 'bolder', 'lighter', '100', '200', '300', '400', '500', '600', '700', '800', '900'],
      'font-style': ['normal', 'italic', 'oblique'],
      'text-decoration': ['none', 'underline', 'overline', 'line-through', 'blink'],
      'text-transform': ['none', 'capitalize', 'uppercase', 'lowercase', 'full-width'],
      'overflow': ['visible', 'hidden', 'scroll', 'auto', 'clip'],
      'visibility': ['visible', 'hidden', 'collapse'],
      'cursor': ['auto', 'default', 'pointer', 'text', 'move', 'not-allowed', 'help', 'wait', 'crosshair'],
      'float': ['left', 'right', 'none'],
      'clear': ['left', 'right', 'both', 'none'],
      'white-space': ['normal', 'nowrap', 'pre', 'pre-wrap', 'pre-line', 'break-spaces'],
      'word-wrap': ['normal', 'break-word', 'break-all', 'keep-all'],
      'vertical-align': ['baseline', 'sub', 'super', 'top', 'text-top', 'middle', 'bottom', 'text-bottom'],
      'list-style-type': ['disc', 'circle', 'square', 'decimal', 'decimal-leading-zero', 'lower-roman', 'upper-roman', 'lower-alpha', 'upper-alpha', 'none'],
      'list-style-position': ['inside', 'outside'],
      'border-collapse': ['separate', 'collapse'],
      'table-layout': ['auto', 'fixed'],
      'empty-cells': ['show', 'hide'],
      'direction': ['ltr', 'rtl'],
      'unicode-bidi': ['normal', 'embed', 'isolate', 'bidi-override', 'isolate-override', 'plaintext']
    };
    
    // Common values for any property
    const commonValues = ['inherit', 'initial', 'unset', 'auto', 'none', 'transparent', 'currentColor'];
    
    let values = propertyValues[property] || commonValues;
    
    // Add existing CSS variables if user is typing 'var' or variable names
    if (prefix.toLowerCase().includes('var') || prefix.startsWith('--')) {
      const existingVariables = this.getExistingCSSVariables();
      values = [...existingVariables, ...values];
    }
    
    if (prefix) {
      values = values.filter(value => 
        value.toLowerCase().includes(prefix.toLowerCase())
      ).sort((a, b) => {
        const aStarts = a.toLowerCase().startsWith(prefix.toLowerCase());
        const bStarts = b.toLowerCase().startsWith(prefix.toLowerCase());
        if (aStarts && !bStarts) return -1;
        if (!aStarts && bStarts) return 1;
        return a.localeCompare(b);
      });
    }
    
    return values.slice(0, 15); // Limit to 15 suggestions
  }

  getExistingCSSVariables() {
    const css = this.editor.value;
    const variables = [];
    
    // Extract CSS custom properties (variables)
    const variableRegex = /--[a-zA-Z0-9-]+/g;
    const matches = css.match(variableRegex);
    
    if (matches) {
      // Remove duplicates and sort
      const uniqueVariables = [...new Set(matches)].sort();
      
      // Format as var(--variable-name) for suggestions
      uniqueVariables.forEach(variable => {
        variables.push(`var(${variable})`);
      });
    }
    
    return variables;
  }

  showPropertySuggestions(suggestions, prefix, isVariable = false) {
    this.suggestions = suggestions;
    this.currentSuggestionIndex = 0;
    this.isShowingSuggestions = true;
    
    this.suggestionBox.innerHTML = '';
    suggestions.forEach((suggestion, index) => {
      const item = document.createElement('div');
      item.className = 'suggestion-item';
      item.style.cssText = `
        padding: 8px 12px;
        cursor: pointer;
        color: #f0f0f0;
        border-bottom: 1px solid #3e3e42;
        transition: background 0.2s ease;
        display: flex;
        align-items: center;
        gap: 8px;
      `;
      
      if (index === 0) {
        item.style.backgroundColor = '#007acc';
        item.style.color = '#ffffff';
      }
      
      // Check if this is a variable suggestion
      const isVariableSuggestion = suggestion.startsWith('--');
      if (isVariableSuggestion) {
        // Add variable icon/indicator
        const icon = document.createElement('span');
        icon.textContent = '🎨';
        icon.style.fontSize = '12px';
        icon.style.opacity = '0.7';
        item.appendChild(icon);
      }
      
      const textSpan = document.createElement('span');
      textSpan.textContent = suggestion;
      if (isVariableSuggestion) {
        textSpan.style.color = '#4fc1ff'; // Variable color
      }
      item.appendChild(textSpan);
      
      item.addEventListener('mouseenter', () => {
        this.currentSuggestionIndex = index;
        this.updateSuggestionSelection();
      });
      item.addEventListener('click', () => {
        this.selectSuggestion();
      });
      
      this.suggestionBox.appendChild(item);
    });
    
    this.positionSuggestionBox();
    this.suggestionBox.style.display = 'block';
  }

  showValueSuggestions(suggestions, prefix, property) {
    this.suggestions = suggestions;
    this.currentSuggestionIndex = 0;
    this.isShowingSuggestions = true;
    
    this.suggestionBox.innerHTML = '';
    suggestions.forEach((suggestion, index) => {
      const item = document.createElement('div');
      item.className = 'suggestion-item';
      item.style.cssText = `
        padding: 8px 12px;
        cursor: pointer;
        color: #f0f0f0;
        border-bottom: 1px solid #3e3e42;
        transition: background 0.2s ease;
        display: flex;
        align-items: center;
        gap: 8px;
      `;
      
      if (index === 0) {
        item.style.backgroundColor = '#007acc';
        item.style.color = '#ffffff';
      }
      
      // Check if this is a variable suggestion
      const isVariable = suggestion.startsWith('var(--');
      if (isVariable) {
        // Add variable icon/indicator
        const icon = document.createElement('span');
        icon.textContent = '🔗';
        icon.style.fontSize = '12px';
        icon.style.opacity = '0.7';
        item.appendChild(icon);
      }
      
      const textSpan = document.createElement('span');
      textSpan.textContent = suggestion;
      if (isVariable) {
        textSpan.style.color = '#4fc1ff'; // Variable color
      }
      item.appendChild(textSpan);
      
      item.addEventListener('mouseenter', () => {
        this.currentSuggestionIndex = index;
        this.updateSuggestionSelection();
      });
      item.addEventListener('click', () => {
        this.selectSuggestion();
      });
      
      this.suggestionBox.appendChild(item);
    });
    
    this.positionSuggestionBox();
    this.suggestionBox.style.display = 'block';
  }

  positionSuggestionBox() {
    const rect = this.editor.getBoundingClientRect();
    const cursorPos = this.editor.selectionStart;
    const value = this.editor.value;
    const beforeCursor = value.substring(0, cursorPos);
    const lines = beforeCursor.split('\n');
    const currentLineIndex = lines.length - 1;
    const currentLineText = lines[currentLineIndex];
    
    // Calculate line height (approximately 19.5px based on CSS)
    const lineHeight = 19.5;
    
    // Calculate horizontal position based on current line text
    const tempDiv = document.createElement('div');
    tempDiv.style.cssText = `
      position: absolute;
      visibility: hidden;
      white-space: pre;
      font-family: 'SF Mono', Monaco, 'Cascadia Code', 'Roboto Mono', Consolas, 'Courier New', monospace;
      font-size: 13px;
      padding: 12px;
    `;
    tempDiv.textContent = currentLineText;
    document.body.appendChild(tempDiv);
    
    const lineWidth = tempDiv.offsetWidth;
    document.body.removeChild(tempDiv);
    
    // Position the suggestion box
    const top = rect.top + (currentLineIndex + 1) * lineHeight + 12;
    let left = rect.left + lineWidth + 12;
    
    // Ensure the suggestion box doesn't go off-screen
    const suggestionWidth = 200; // Minimum width
    if (left + suggestionWidth > window.innerWidth) {
      left = window.innerWidth - suggestionWidth - 10;
    }
    
    this.suggestionBox.style.top = `${top}px`;
    this.suggestionBox.style.left = `${left}px`;
  }

  navigateSuggestions(direction) {
    if (!this.isShowingSuggestions || this.suggestions.length === 0) return;
    
    this.currentSuggestionIndex = (this.currentSuggestionIndex + direction + this.suggestions.length) % this.suggestions.length;
    this.updateSuggestionSelection();
  }

  updateSuggestionSelection() {
    const items = this.suggestionBox.querySelectorAll('.suggestion-item');
    items.forEach((item, index) => {
      if (index === this.currentSuggestionIndex) {
        item.style.backgroundColor = '#007acc';
        item.style.color = '#ffffff';
      } else {
        item.style.backgroundColor = 'transparent';
        item.style.color = '#f0f0f0';
      }
    });
  }

  selectSuggestion() {
    if (!this.isShowingSuggestions || this.suggestions.length === 0) return;
    
    const selectedSuggestion = this.suggestions[this.currentSuggestionIndex];
    const cursorPos = this.editor.selectionStart;
    const value = this.editor.value;
    const beforeCursor = value.substring(0, cursorPos);
    const afterCursor = value.substring(cursorPos);
    
    // Find the word being typed and replace it
    const lines = beforeCursor.split('\n');
    const currentLine = lines[lines.length - 1];
    
    // Check if we're in a property context
    const propertyMatch = currentLine.match(/^(\s*)([a-zA-Z-]*)$/);
    if (propertyMatch) {
      const prefix = propertyMatch[2];
      const newLine = currentLine.substring(0, currentLine.length - prefix.length) + selectedSuggestion;
      const newValue = lines.slice(0, -1).join('\n') + (lines.length > 1 ? '\n' : '') + newLine + afterCursor;
      this.editor.value = newValue;
      this.editor.setSelectionRange(cursorPos - prefix.length + selectedSuggestion.length, cursorPos - prefix.length + selectedSuggestion.length);
    } else {
      // Check if we're in a value context
      const valueMatch = currentLine.match(/^(\s*[a-zA-Z-]+:\s*)([a-zA-Z0-9#\-\(\)]*)$/);
      if (valueMatch) {
        const prefix = valueMatch[2];
        const newLine = currentLine.substring(0, currentLine.length - prefix.length) + selectedSuggestion;
        const newValue = lines.slice(0, -1).join('\n') + (lines.length > 1 ? '\n' : '') + newLine + afterCursor;
        this.editor.value = newValue;
        this.editor.setSelectionRange(cursorPos - prefix.length + selectedSuggestion.length, cursorPos - prefix.length + selectedSuggestion.length);
      }
    }
    
    this.hideSuggestions();
    this.updateLineNumbers();
    this.updateSyntaxHighlighting();
  }

  hideSuggestions() {
    this.isShowingSuggestions = false;
    this.suggestionBox.style.display = 'none';
  }

  // Cleanup method to remove suggestion box when editor is destroyed
  destroy() {
    if (this.suggestionBox && this.suggestionBox.parentNode) {
      this.suggestionBox.parentNode.removeChild(this.suggestionBox);
    }
  }

  loadThemeFromURL() {
    const urlParams = new URLSearchParams(window.location.search);
    const themeId = urlParams.get('theme');
    
    if (!themeId) {
      this.showError('No theme ID provided');
      return;
    }
    
    this.currentThemeId = themeId;
    this.loadTheme();
  }

  async loadTheme() {
    try {
      const data = await this.getStorageData(['themes', 'isEnabled']);
      
      if (!data.themes || !data.themes[this.currentThemeId]) {
        this.showError('Theme not found');
        return;
      }
      
      this.theme = data.themes[this.currentThemeId];
      this.originalCSS = this.theme.css;
      
      // Update UI
      this.themeNameInput.value = this.theme.name || '';
      this.websiteUrlInput.value = this.theme.websiteUrl || '';
      
      // Load CSS into editor
      this.editor.value = this.theme.css;
      this.updateLineNumbers();
      this.updateSyntaxHighlighting();
      this.simpleValidate();
      
    } catch (error) {
      console.error('Error loading theme:', error);
      this.showError('Failed to load theme');
    }
  }

  hasUnsavedChanges() {
    return this.editor.value !== this.originalCSS || 
           this.themeNameInput.value !== (this.theme.name || '') ||
           this.websiteUrlInput.value !== (this.theme.websiteUrl || '');
  }

  async previewTheme() {
    try {
      const processedCSS = this.processCSS(this.editor.value);
      
      // Apply CSS to the current tab for preview
      this.sendMessageToContentScript({
        action: 'applyCSS',
        css: processedCSS
      }, (response) => {
        if (response && response.success) {
          this.showStatus('Preview applied', 'saved');
          setTimeout(() => this.hideStatus(), 2000);
        }
      });
      
    } catch (error) {
      console.error('Error previewing theme:', error);
      this.showStatus('Error applying preview', 'error');
      setTimeout(() => this.hideStatus(), 2000);
    }
  }

  async saveTheme() {
    try {
      this.showStatus('Saving...', 'saving');
      
      // Get current themes
      const data = await this.getStorageData('themes');
      const themes = data.themes || {};
      
      if (!themes[this.currentThemeId]) {
        this.showError('Theme not found');
        return;
      }
      
      // Update theme with precise timestamp
      const now = new Date();
      themes[this.currentThemeId].name = this.themeNameInput.value;
      themes[this.currentThemeId].websiteUrl = this.websiteUrlInput.value;
      themes[this.currentThemeId].css = this.editor.value;
      themes[this.currentThemeId].updatedAt = now.toISOString();
      
      // Save to storage
      await this.setStorageData({ themes: themes });
      
      // Update original values reference
      this.originalCSS = this.editor.value;
      this.theme.name = this.themeNameInput.value;
      this.theme.websiteUrl = this.websiteUrlInput.value;
      this.theme.updatedAt = now.toISOString();
      
      // Apply changes if theme is enabled
      const enabledData = await this.getStorageData('isEnabled');
      if (enabledData.isEnabled) {
        const processedCSS = this.processCSS(this.editor.value);
        this.sendMessageToContentScript({
          action: 'applyCSS',
          css: processedCSS
        });
      }
      
      this.showStatus('Saved', 'saved');
      setTimeout(() => this.hideStatus(), 2000);
      
    } catch (error) {
      console.error('Error saving theme:', error);
      this.showStatus('Error saving theme', 'error');
      setTimeout(() => this.hideStatus(), 2000);
    }
  }

  async deleteTheme() {
    if (!confirm(`Are you sure you want to delete "${this.theme.name}"? This action cannot be undone.`)) {
      return;
    }

    try {
      this.showStatus('Deleting...', 'saving');
      
      // Get current themes
      const data = await this.getStorageData(['themes', 'currentThemeId']);
      const themes = data.themes || {};
      
      if (!themes[this.currentThemeId]) {
        this.showError('Theme not found');
        return;
      }
      
      // Don't allow deleting the last theme
      if (Object.keys(themes).length <= 1) {
        this.showError('Cannot delete the last theme. Please create another theme first.');
        return;
      }
      
      // Delete the theme
      delete themes[this.currentThemeId];
      
      // If we deleted the current theme, switch to another one
      if (data.currentThemeId === this.currentThemeId) {
        const remainingThemes = Object.keys(themes);
        const newCurrentThemeId = remainingThemes[0];
        
        await this.setStorageData({
          themes: themes,
          currentThemeId: newCurrentThemeId
        });
        
        // Apply the new current theme
        const newTheme = themes[newCurrentThemeId];
        const processedCSS = this.processCSS(newTheme.css);
        this.sendMessageToContentScript({
          action: 'applyCSS',
          css: processedCSS
        });
      } else {
        await this.setStorageData({ themes: themes });
      }
      
      this.showStatus('Theme deleted', 'saved');
      setTimeout(() => {
        this.hideStatus();
        window.close();
      }, 2000);
      
    } catch (error) {
      console.error('Error deleting theme:', error);
      this.showStatus('Error deleting theme', 'error');
      setTimeout(() => this.hideStatus(), 2000);
    }
  }

  async autoSave() {
    try {
      // Don't save if CSS is invalid
      if (!this.isValid) {
        return;
      }
      
      this.showStatus('Auto-saving...', 'saving');
      
      // Get current themes
      const data = await this.getStorageData('themes');
      const themes = data.themes || {};
      
      if (!themes[this.currentThemeId]) {
        return;
      }
      
      // Update theme with precise timestamp
      const now = new Date();
      themes[this.currentThemeId].name = this.themeNameInput.value;
      themes[this.currentThemeId].websiteUrl = this.websiteUrlInput.value;
      themes[this.currentThemeId].css = this.editor.value;
      themes[this.currentThemeId].updatedAt = now.toISOString();
      
      // Save to storage
      await this.setStorageData({ themes: themes });
      
      // Update original values reference
      this.originalCSS = this.editor.value;
      this.theme.name = this.themeNameInput.value;
      this.theme.websiteUrl = this.websiteUrlInput.value;
      this.theme.updatedAt = now.toISOString();
      
      this.showStatus('Auto-saved', 'saved');
      setTimeout(() => {
        this.hideStatus();
      }, 1000);
      
    } catch (error) {
      console.error('Error auto-saving:', error);
      this.showStatus('Auto-save error', 'error');
      setTimeout(() => {
        this.hideStatus();
      }, 2000);
    }
  }

  showError(message) {
    this.showStatus(message, 'error');
    setTimeout(() => this.hideStatus(), 3000);
  }

  // Helper methods (simplified versions)
  handleTabKey(shiftKey) {
    const start = this.editor.selectionStart;
    const end = this.editor.selectionEnd;
    const value = this.editor.value;
    
    if (shiftKey) {
      const beforeCursor = value.substring(0, start);
      const afterCursor = value.substring(end);
      const lineStart = beforeCursor.lastIndexOf('\n') + 1;
      const lineEnd = afterCursor.indexOf('\n');
      const line = value.substring(lineStart, end + (lineEnd === -1 ? value.length : lineEnd));
      
      if (line.startsWith('  ')) {
        const newValue = value.substring(0, lineStart) + line.substring(2) + value.substring(end + (lineEnd === -1 ? value.length : lineEnd));
        this.editor.value = newValue;
        this.editor.setSelectionRange(start - 2, end - 2);
      }
    } else {
      const newValue = value.substring(0, start) + '  ' + value.substring(end);
      this.editor.value = newValue;
      this.editor.setSelectionRange(start + 2, start + 2);
    }
    
    this.updateLineNumbers();
    this.updateSyntaxHighlighting();
  }

  handleEnterKey() {
    const cursorPos = this.editor.selectionStart;
    const value = this.editor.value;
    const beforeCursor = value.substring(0, cursorPos);
    const afterCursor = value.substring(cursorPos);
    
    const lineStart = beforeCursor.lastIndexOf('\n') + 1;
    const currentLine = value.substring(lineStart, cursorPos);
    const match = currentLine.match(/^(\s*)/);
    const currentIndent = match ? match[1] : '';
    
    let newIndent = currentIndent;
    if (currentLine.trim().endsWith('{')) {
      newIndent += '  ';
    } else if (afterCursor.trim().startsWith('}')) {
      newIndent = newIndent.substring(0, Math.max(0, newIndent.length - 2));
    }
    
    const newValue = beforeCursor + '\n' + newIndent + afterCursor;
    this.editor.value = newValue;
    this.editor.setSelectionRange(cursorPos + 1 + newIndent.length, cursorPos + 1 + newIndent.length);
    
    this.updateLineNumbers();
    this.updateSyntaxHighlighting();
  }

  handleCommentToggle() {
    const start = this.editor.selectionStart;
    const end = this.editor.selectionEnd;
    const value = this.editor.value;
    
    // If there's a selection, handle multiple lines
    if (start !== end) {
      this.toggleMultiLineComment(start, end, value);
    } else {
      // Handle single line comment
      this.toggleSingleLineComment(start, value);
    }
  }

  toggleSingleLineComment(cursorPos, value) {
    const beforeCursor = value.substring(0, cursorPos);
    const afterCursor = value.substring(cursorPos);
    
    // Find the current line
    const lineStart = beforeCursor.lastIndexOf('\n') + 1;
    const lineEnd = afterCursor.indexOf('\n');
    const lineEndPos = lineEnd === -1 ? value.length : cursorPos + lineEnd;
    const currentLine = value.substring(lineStart, lineEndPos);
    
    // Check if line is already commented
    const trimmedLine = currentLine.trim();
    const isCommented = trimmedLine.startsWith('//');
    
    if (isCommented) {
      // Uncomment the line
      const newLine = currentLine.replace(/^(\s*)\/\//, '$1');
      const newValue = value.substring(0, lineStart) + newLine + value.substring(lineEndPos);
      this.editor.value = newValue;
      
      // Adjust cursor position
      const removedChars = currentLine.length - newLine.length;
      this.editor.setSelectionRange(cursorPos - removedChars, cursorPos - removedChars);
    } else {
      // Comment the line
      const match = currentLine.match(/^(\s*)/);
      const indent = match ? match[1] : '';
      const newLine = indent + '//' + currentLine.substring(indent.length);
      const newValue = value.substring(0, lineStart) + newLine + value.substring(lineEndPos);
      this.editor.value = newValue;
      
      // Adjust cursor position
      const addedChars = newLine.length - currentLine.length;
      this.editor.setSelectionRange(cursorPos + addedChars, cursorPos + addedChars);
    }
    
    this.updateLineNumbers();
    this.updateSyntaxHighlighting();
  }

  toggleMultiLineComment(start, end, value) {
    const beforeSelection = value.substring(0, start);
    const selectedText = value.substring(start, end);
    const afterSelection = value.substring(end);
    
    // Split selected text into lines
    const lines = selectedText.split('\n');
    const isAllCommented = lines.every(line => line.trim().startsWith('//') || line.trim() === '');
    
    if (isAllCommented) {
      // Uncomment all lines
      const uncommentedLines = lines.map(line => {
        if (line.trim() === '') return line;
        return line.replace(/^(\s*)\/\//, '$1');
      });
      const newSelectedText = uncommentedLines.join('\n');
      const newValue = beforeSelection + newSelectedText + afterSelection;
      this.editor.value = newValue;
      
      // Adjust selection
      const removedChars = selectedText.length - newSelectedText.length;
      this.editor.setSelectionRange(start, end - removedChars);
    } else {
      // Comment all lines
      const commentedLines = lines.map(line => {
        if (line.trim() === '') return line;
        const match = line.match(/^(\s*)/);
        const indent = match ? match[1] : '';
        return indent + '//' + line.substring(indent.length);
      });
      const newSelectedText = commentedLines.join('\n');
      const newValue = beforeSelection + newSelectedText + afterSelection;
      this.editor.value = newValue;
      
      // Adjust selection
      const addedChars = newSelectedText.length - selectedText.length;
      this.editor.setSelectionRange(start, end + addedChars);
    }
    
    this.updateLineNumbers();
    this.updateSyntaxHighlighting();
  }

  updateLineNumbers() {
    const lines = this.editor.value.split('\n');
    const lineCount = lines.length;
    
    this.lineNumbers.innerHTML = '';
    
    for (let i = 1; i <= lineCount; i++) {
      const lineNumber = document.createElement('span');
      lineNumber.className = 'line-number';
      lineNumber.textContent = i;
      this.lineNumbers.appendChild(lineNumber);
    }
    
    if (lineCount === 0) {
      const lineNumber = document.createElement('span');
      lineNumber.className = 'line-number';
      lineNumber.textContent = '1';
      this.lineNumbers.appendChild(lineNumber);
    }
  }

  syncHighlightingLayer() {
    this.editorHighlight.style.height = this.editor.scrollHeight + 'px';
    this.editorHighlight.style.width = this.editor.scrollWidth + 'px';
    this.editorHighlight.scrollTop = this.editor.scrollTop;
    this.editorHighlight.scrollLeft = this.editor.scrollLeft;
  }

  updateSyntaxHighlighting() {
    if (this.isHighlighting) {
      return;
    }
    
    this.isHighlighting = true;
    
    const code = this.editor.value;
    const errors = this.validateCSS(code);
    const invalidLines = this.getInvalidLineNumbers(errors);
    const highlighted = this.highlightCSS(code, invalidLines);
    
    this.editorHighlight.innerHTML = '';
    
    requestAnimationFrame(() => {
      this.editorHighlight.innerHTML = highlighted;
      this.isHighlighting = false;
    });
  }

  getInvalidLineNumbers(errors) {
    const invalidLines = new Set();
    errors.forEach(error => {
      const match = error.match(/Line (\d+):/);
      if (match) {
        invalidLines.add(parseInt(match[1]));
      }
    });
    return invalidLines;
  }

  highlightCSS(code, invalidLines = new Set()) {
    const lines = code.split('\n');
    const highlightedLines = lines.map((line, lineIndex) => {
      const lineNumber = lineIndex + 1;
      const isInvalid = invalidLines.has(lineNumber);
      return this.highlightLine(line, lineIndex, isInvalid);
    });
    
    return highlightedLines.join('\n');
  }

  highlightLine(line, lineIndex, isInvalid = false) {
    if (isInvalid) {
      return `<span class="invalid-line">${this.tokenizeCSS(line)}</span>`;
    }
    return this.tokenizeCSS(line);
  }

  tokenizeCSS(line) {
    // Skip empty lines
    if (!line.trim()) {
      return line;
    }

    let result = '';
    let current = 0;
    const length = line.length;
    let inValue = false;
    let afterColon = false;

    while (current < length) {
      const char = line[current];

      // Handle comments
      if (char === '/' && current + 1 < length && line[current + 1] === '*') {
        const commentEnd = line.indexOf('*/', current + 2);
        if (commentEnd !== -1) {
          result += `<span class="token comment">${line.substring(current, commentEnd + 2)}</span>`;
          current = commentEnd + 2;
          continue;
        }
      }

      // Handle single-line comments
      if (char === '/' && current + 1 < length && line[current + 1] === '/') {
        result += `<span class="token comment">${line.substring(current)}</span>`;
        break;
      }

      // Handle strings
      if (char === '"' || char === "'") {
        const quote = char;
        let stringEnd = current + 1;
        while (stringEnd < length && line[stringEnd] !== quote) {
          if (line[stringEnd] === '\\') {
            stringEnd += 2; // Skip escaped character
          } else {
            stringEnd++;
          }
        }
        if (stringEnd < length) {
          result += `<span class="token string">${line.substring(current, stringEnd + 1)}</span>`;
          current = stringEnd + 1;
          continue;
        }
      }

      // Handle CSS variables (custom properties)
      if (char === '-' && current + 1 < length && line[current + 1] === '-') {
        const varEnd = line.indexOf(':', current);
        if (varEnd !== -1) {
          result += `<span class="token variable">${line.substring(current, varEnd)}</span>`;
          current = varEnd;
          continue;
        }
      }

      // Handle var() function calls
      if (char === 'v' && current + 2 < length && line.substring(current, current + 3) === 'var') {
        if (line[current + 3] === '(') {
          result += `<span class="token function">var</span>`;
          current += 3;
          continue;
        }
      }

      // Handle hex colors
      if (char === '#' && afterColon) {
        let hexEnd = current + 1;
        while (hexEnd < length && /[0-9a-fA-F]/.test(line[hexEnd])) {
          hexEnd++;
        }
        if (hexEnd - current > 1) {
          result += `<span class="token value-hex">${line.substring(current, hexEnd)}</span>`;
          current = hexEnd;
          continue;
        }
      }

      // Handle URLs
      if (char === 'u' && current + 2 < length && line.substring(current, current + 3) === 'url') {
        if (line[current + 3] === '(') {
          result += `<span class="token value-url">url</span>`;
          current += 3;
          continue;
        }
      }

      // Handle numbers
      if (/\d/.test(char)) {
        let numEnd = current + 1;
        while (numEnd < length && /[\d.]/.test(line[numEnd])) {
          numEnd++;
        }
        // Check if it's followed by a unit
        if (numEnd < length && /[a-z%]/.test(line[numEnd])) {
          // Handle multi-character units like 'px', 'em', 'rem', etc.
          if (line[numEnd] === 'p' && line[numEnd + 1] === 'x') {
            numEnd += 2;
          } else if (line[numEnd] === 'e' && line[numEnd + 1] === 'm') {
            numEnd += 2;
          } else if (line[numEnd] === 'r' && line[numEnd + 1] === 'e' && line[numEnd + 2] === 'm') {
            numEnd += 3;
          } else if (line[numEnd] === 'v' && line[numEnd + 1] === 'h') {
            numEnd += 2;
          } else if (line[numEnd] === 'v' && line[numEnd + 1] === 'w') {
            numEnd += 2;
          } else if (line[numEnd] === 'c' && line[numEnd + 1] === 'h') {
            numEnd += 2;
          } else if (line[numEnd] === 'e' && line[numEnd + 1] === 'x') {
            numEnd += 2;
          } else if (line[numEnd] === 'p' && line[numEnd + 1] === 't') {
            numEnd += 2;
          } else if (line[numEnd] === 'p' && line[numEnd + 1] === 'c') {
            numEnd += 2;
          } else if (line[numEnd] === 'i' && line[numEnd + 1] === 'n') {
            numEnd += 2;
          } else if (line[numEnd] === 'c' && line[numEnd + 1] === 'm') {
            numEnd += 2;
          } else if (line[numEnd] === 'm' && line[numEnd + 1] === 'm') {
            numEnd += 2;
          } else if (line[numEnd] === 'd' && line[numEnd + 1] === 'p' && line[numEnd + 2] === 'i') {
            numEnd += 3;
          } else if (line[numEnd] === 'd' && line[numEnd + 1] === 'p' && line[numEnd + 2] === 'p' && line[numEnd + 3] === 'x') {
            numEnd += 4;
          } else if (line[numEnd] === 't' && line[numEnd + 1] === 'u' && line[numEnd + 2] === 'r' && line[numEnd + 3] === 'n') {
            numEnd += 4;
          } else if (line[numEnd] === 'd' && line[numEnd + 1] === 'e' && line[numEnd + 2] === 'g') {
            numEnd += 3;
          } else if (line[numEnd] === 'r' && line[numEnd + 1] === 'a' && line[numEnd + 2] === 'd') {
            numEnd += 3;
          } else if (line[numEnd] === 'g' && line[numEnd + 1] === 'r' && line[numEnd + 2] === 'a' && line[numEnd + 3] === 'd') {
            numEnd += 4;
          } else {
            numEnd++;
          }
        }
        
        // If we're after a colon, treat numbers as values
        if (afterColon) {
          result += `<span class="token value">${line.substring(current, numEnd)}</span>`;
        } else {
          result += `<span class="token number">${line.substring(current, numEnd)}</span>`;
        }
        current = numEnd;
        continue;
      }

      // Handle CSS selectors and properties
      if (/[a-zA-Z_-]/.test(char)) {
        let wordEnd = current + 1;
        while (wordEnd < length && /[a-zA-Z0-9_-]/.test(line[wordEnd])) {
          wordEnd++;
        }
        const word = line.substring(current, wordEnd);
        
        // Check if it's a CSS property
        if (line[wordEnd] === ':') {
          result += `<span class="token property">${word}</span>`;
        } else if (afterColon && this.isCSSValue(word)) {
          result += `<span class="token value">${word}</span>`;
          inValue = true;
        } else if (this.isCSSKeyword(word)) {
          result += `<span class="token keyword">${word}</span>`;
        } else if (this.isCSSFunction(word)) {
          result += `<span class="token function">${word}</span>`;
        } else if (this.isCSSSelector(word)) {
          result += `<span class="token selector">${word}</span>`;
        } else if (word === '!important') {
          result += `<span class="token important">${word}</span>`;
        } else {
          result += `<span class="token">${word}</span>`;
        }
        current = wordEnd;
        continue;
      }

      // Handle punctuation
      if (/[{}();:,]/.test(char)) {
        if (char === ':') {
          afterColon = true;
        } else if (char === ';') {
          afterColon = false;
          inValue = false;
        }
        result += `<span class="token punctuation">${char}</span>`;
        current++;
        continue;
      }

      // Handle operators
      if (/[=+-><*\/]/.test(char)) {
        result += `<span class="token operator">${char}</span>`;
        current++;
        continue;
      }

      // Handle whitespace
      if (/\s/.test(char)) {
        result += char;
        current++;
        continue;
      }

      // Default case
      result += `<span class="token">${char}</span>`;
      current++;
    }

    return result;
  }

  isCSSKeyword(word) {
    const keywords = [
      'important', 'inherit', 'initial', 'unset', 'revert', 'auto', 'none',
      'block', 'inline', 'inline-block', 'flex', 'grid', 'table', 'absolute',
      'relative', 'fixed', 'sticky', 'static', 'visible', 'hidden', 'collapse',
      'solid', 'dashed', 'dotted', 'double', 'groove', 'ridge', 'inset', 'outset',
      'normal', 'bold', 'bolder', 'lighter', 'italic', 'oblique', 'underline',
      'overline', 'line-through', 'blink', 'capitalize', 'uppercase', 'lowercase',
      'left', 'right', 'center', 'justify', 'top', 'bottom', 'middle', 'baseline',
      'repeat', 'no-repeat', 'repeat-x', 'repeat-y', 'cover', 'contain', 'scroll',
      'fixed', 'local', 'transparent', 'currentColor', 'var', 'calc', 'url',
      'rgb', 'rgba', 'hsl', 'hsla', 'linear-gradient', 'radial-gradient',
      'conic-gradient', 'repeating-linear-gradient', 'repeating-radial-gradient'
    ];
    return keywords.includes(word.toLowerCase());
  }

  isCSSFunction(word) {
    const functions = [
      'var', 'calc', 'url', 'rgb', 'rgba', 'hsl', 'hsla', 'linear-gradient',
      'radial-gradient', 'conic-gradient', 'repeating-linear-gradient',
      'repeating-radial-gradient', 'cubic-bezier', 'steps', 'matrix', 'translate',
      'translateX', 'translateY', 'translateZ', 'translate3d', 'rotate', 'rotateX',
      'rotateY', 'rotateZ', 'rotate3d', 'scale', 'scaleX', 'scaleY', 'scaleZ',
      'scale3d', 'skew', 'skewX', 'skewY', 'perspective', 'matrix3d'
    ];
    return functions.includes(word.toLowerCase());
  }

  isCSSSelector(word) {
    // Basic selector detection - can be enhanced
    return word.startsWith('.') || word.startsWith('#') || word.startsWith('[') || word.startsWith(':');
  }

  isCSSValue(word) {
    const values = [
      'auto', 'none', 'inherit', 'initial', 'unset', 'revert', 'transparent',
      'black', 'white', 'red', 'green', 'blue', 'yellow', 'cyan', 'magenta',
      'gray', 'grey', 'orange', 'purple', 'brown', 'pink', 'lime', 'navy',
      'teal', 'silver', 'gold', 'maroon', 'olive', 'fuchsia', 'aqua',
      'block', 'inline', 'inline-block', 'flex', 'grid', 'table',
      'absolute', 'relative', 'fixed', 'sticky', 'static',
      'visible', 'hidden', 'collapse',
      'solid', 'dashed', 'dotted', 'double', 'groove', 'ridge', 'inset', 'outset',
      'normal', 'bold', 'bolder', 'lighter', 'italic', 'oblique',
      'underline', 'overline', 'line-through', 'blink',
      'capitalize', 'uppercase', 'lowercase',
      'left', 'right', 'center', 'justify', 'top', 'bottom', 'middle', 'baseline',
      'repeat', 'no-repeat', 'repeat-x', 'repeat-y', 'cover', 'contain',
      'scroll', 'fixed', 'local', 'currentColor'
    ];
    return values.includes(word.toLowerCase());
  }

  simpleValidate() {
    if (this.validationTimeout) {
      clearTimeout(this.validationTimeout);
    }
    
    this.validationTimeout = setTimeout(() => {
      const css = this.editor.value;
      const errors = this.validateCSS(css);
      
      this.isValid = errors.length === 0;
      
      if (errors.length > 0) {
        this.editorContainer.classList.add('error');
        this.showStatus(`${errors.length} CSS error${errors.length > 1 ? 's' : ''} - not saving`, 'error');
        setTimeout(() => {
          this.hideStatus();
        }, 3000);
      } else {
        this.editorContainer.classList.remove('error');
        this.hideStatus();
      }
      
      this.updateSyntaxHighlighting();
    }, 1000);
  }

  validateCSS(css) {
    // Simplified validation - just check for basic syntax
    const errors = [];
    const lines = css.split('\n');
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (line.startsWith('--') && !line.includes(':')) {
        errors.push(`Line ${i + 1}: Missing colon in CSS variable`);
      }
    }
    
    return errors;
  }

  processCSS(rawCSS) {
    // Simplified processing - just return the CSS as is
    return rawCSS;
  }

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

  showStatus(message, type = '') {
    if (this.statusIndicator) {
      this.statusIndicator.textContent = message;
      this.statusIndicator.className = `status-indicator ${type}`;
    }
  }

  hideStatus() {
    if (this.statusIndicator) {
      this.statusIndicator.textContent = '';
      this.statusIndicator.className = 'status-indicator';
    }
  }

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

  debounceAutoSave() {
    if (this.autoSaveTimeout) {
      clearTimeout(this.autoSaveTimeout);
    }
    
    this.autoSaveTimeout = setTimeout(() => {
      if (this.isValid) {
        this.autoSave();
      }
    }, 500); // Reduced from 1000ms to 500ms for more responsive saving
  }

  async exportTheme() {
    try {
      const themeData = {
        name: this.themeNameInput.value,
        websiteUrl: this.websiteUrlInput.value,
        css: this.editor.value,
        createdAt: this.theme.createdAt,
        updatedAt: new Date().toISOString()
      };

      const dataStr = JSON.stringify(themeData, null, 2);
      const dataBlob = new Blob([dataStr], { type: 'application/json' });
      
      const url = URL.createObjectURL(dataBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${themeData.name || 'theme'}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      this.showStatus('Theme exported', 'saved');
      setTimeout(() => this.hideStatus(), 2000);
    } catch (error) {
      console.error('Error exporting theme:', error);
      this.showStatus('Export failed', 'error');
      setTimeout(() => this.hideStatus(), 2000);
    }
  }
}

// Initialize the editor when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  new ThemeEditor();
}); 