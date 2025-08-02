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
    
    this.init();
  }

  init() {
    this.setupEventListeners();
    this.loadThemeFromURL();
    this.updateLineNumbers();
    this.updateSyntaxHighlighting();
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