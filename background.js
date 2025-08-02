/**
 * Theme Engine Background Service Worker
 * Handles extension lifecycle and management
 */

// Extension installation handler
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    console.log('Theme Engine Pro installed successfully');
    
    // Set default settings
    chrome.storage.local.set({
      version: '3.0.0',
      installedAt: new Date().toISOString(),
      settings: {
        autoSave: true,
        enableNotifications: true,
        theme: 'dark'
      }
    });
  } else if (details.reason === 'update') {
    console.log('Theme Engine Pro updated to version 3.0.0');
    
    // Update version in storage
    chrome.storage.local.set({
      version: '3.0.0',
      updatedAt: new Date().toISOString()
    });
  }
});

// Handle extension startup
chrome.runtime.onStartup.addListener(() => {
  console.log('Theme Engine Pro started');
});

// Ensure content script is injected when tabs are updated
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url && tab.url.startsWith('http')) {
    // Inject content script if not already present
    chrome.scripting.executeScript({
      target: { tabId: tabId },
      files: ['content.js']
    }).catch(() => {
      // Content script might already be injected, ignore error
    });
  }
});

// Handle messages from content scripts or popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  switch (request.action) {
    case 'getStatus':
      sendResponse({ status: 'active', version: '3.0.0' });
      break;
      
    case 'getSettings':
      chrome.storage.local.get('settings', (data) => {
        sendResponse(data.settings || {});
      });
      return true; // Keep message channel open for async response
      
    case 'updateSettings':
      chrome.storage.local.set({ settings: request.settings }, () => {
        sendResponse({ success: true });
      });
      return true;
      
    case 'clearData':
      chrome.storage.local.clear(() => {
        sendResponse({ success: true });
      });
      return true;
      
    case 'ensureContentScript':
      // Ensure content script is injected in the current tab
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0]) {
          chrome.scripting.executeScript({
            target: { tabId: tabs[0].id },
            files: ['content.js']
          }).then(() => {
            sendResponse({ success: true });
          }).catch(() => {
            sendResponse({ success: false, error: 'Failed to inject content script' });
          });
        } else {
          sendResponse({ success: false, error: 'No active tab found' });
        }
      });
      return true;
      
    default:
      sendResponse({ error: 'Unknown action' });
  }
});

// Handle storage changes
chrome.storage.onChanged.addListener((changes, namespace) => {
  if (namespace === 'local') {
    // Log important changes
    Object.keys(changes).forEach(key => {
      console.log(`Storage changed: ${key}`, changes[key]);
    });
  }
}); 