/**
 * Background Service Worker for Voice Email Commands Extension
 * 
 * This script runs in the background and manages communication
 * between the popup and content scripts.
 */

// Configuration
const BACKEND_URL = 'http://localhost:3000';

// State management
let backendAvailable = false;
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 3;

// Check backend availability with retry logic
async function checkBackendAvailability() {
  reconnectAttempts++;
  
  try {
    console.log(`Checking backend availability (attempt ${reconnectAttempts})...`);
    const response = await fetch(`${BACKEND_URL}/api/test`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      // Adding cache busting to prevent cached responses
      signal: AbortSignal.timeout(5000) // Timeout after 5 seconds
    });
    
    backendAvailable = response.ok;
    console.log('Backend available:', backendAvailable);
    
    // Reset reconnect attempts on success
    if (backendAvailable) {
      reconnectAttempts = 0;
    }
    
    // Broadcast status update
    broadcastBackendStatus(backendAvailable);
    
    return backendAvailable;
  } catch (error) {
    console.error('Backend not available:', error);
    backendAvailable = false;
    
    // Broadcast status update
    broadcastBackendStatus(false);
    
    return false;
  }
}

// Broadcast backend status to all tabs
function broadcastBackendStatus(isAvailable) {
  chrome.tabs.query({}, (tabs) => {
    tabs.forEach(tab => {
      try {
        chrome.tabs.sendMessage(tab.id, {
          action: 'backendStatusUpdate',
          available: isAvailable
        }).catch(err => {
          // Ignore errors from tabs that don't have our content script
          console.log(`Could not send to tab ${tab.id}:`, err);
        });
      } catch (error) {
        // Ignore errors when sending messages to tabs
      }
    });
  });
}

// Process voice command with proper error handling
async function processVoiceCommand(transcript) {
  console.log('Processing voice command:', transcript);
  
  if (!backendAvailable) {
    // Check backend availability before proceeding
    const available = await checkBackendAvailability();
    if (!available) {
      throw new Error('Backend service is not available. Please make sure it is running.');
    }
  }
  
  try {
    // Find active Gmail tab
    const tabs = await chrome.tabs.query({ 
      active: true, 
      url: '*://mail.google.com/*' 
    });
    
    if (tabs.length === 0) {
      throw new Error('No active Gmail tab found. Please open Gmail to use voice commands.');
    }
    
    // Send message to content script
    return new Promise((resolve, reject) => {
      chrome.tabs.sendMessage(
        tabs[0].id, 
        { action: 'processVoice', transcript },
        (response) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
            return;
          }
          
          if (response && response.success) {
            resolve(response);
          } else {
            reject(new Error(response?.error || 'Failed to process voice command'));
          }
        }
      );
    });
  } catch (error) {
    console.error('Error processing voice command:', error);
    throw error;
  }
}

// Handle messages from popup or content scripts with proper async support
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('Background script received message:', message, 'from:', sender);
  
  // Handle different message types
  if (message.action === 'checkBackendStatus') {
    checkBackendAvailability()
      .then(available => {
        sendResponse({ available });
      })
      .catch(error => {
        sendResponse({ available: false, error: error.message });
      });
    
    // Return true to indicate we'll respond asynchronously
    return true;
  }
  
  if (message.action === 'processVoice' && message.transcript) {
    processVoiceCommand(message.transcript)
      .then(result => {
        sendResponse({ success: true, result });
      })
      .catch(error => {
        sendResponse({ 
          success: false, 
          error: error.message
        });
      });
    
    // Return true to indicate we'll respond asynchronously
    return true;
  }
  
  if (message.action === 'contentScriptReady') {
    backendAvailable = message.backendAvailable;
    sendResponse({ received: true });
    return true;
  }
});

// Handle extension installation or update
chrome.runtime.onInstalled.addListener(async (details) => {
  console.log('Extension installed or updated:', details.reason);
  
  // Show onboarding or update information
  if (details.reason === 'install') {
    // Show welcome page or setup instructions
    chrome.tabs.create({ url: `${BACKEND_URL}/extension` });
  }
  
  // Check backend availability
  await checkBackendAvailability();
});

// Handle tab updates to check if we're in Gmail
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url?.includes('mail.google.com')) {
    console.log('Gmail tab detected:', tabId);
    // Inject the content script if needed (for cases where it wasn't loaded)
    checkBackendAvailability().then(available => {
      chrome.tabs.sendMessage(tabId, { 
        action: 'backendStatusUpdate',
        available
      }).catch(() => {
        // Content script not loaded yet, this is expected
      });
    });
  }
});

// Check backend periodically (every 5 minutes)
setInterval(checkBackendAvailability, 5 * 60 * 1000);

// Initial check on startup
checkBackendAvailability(); 