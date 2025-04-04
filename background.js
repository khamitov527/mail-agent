// Listen for installation
chrome.runtime.onInstalled.addListener(() => {
  console.log('Voice Command Assistant extension installed');
  
  // Initialize environment variables
  initializeEnvironment();
});

/**
 * Initialize environment variables from .env file
 */
async function initializeEnvironment() {
  try {
    // Use the fetch API to load the .env file
    const response = await fetch(chrome.runtime.getURL('.env'));
    const text = await response.text();
    
    // Parse the .env file content
    const env = {};
    const lines = text.split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      
      const [key, ...valueParts] = trimmed.split('=');
      if (key && valueParts.length) {
        const value = valueParts.join('='); // Rejoin in case value had = symbols
        env[key.trim()] = value.trim();
      }
    }
    
    // Store the API key in memory for this session
    if (env.OPENAI_API_KEY) {
      console.log('API key loaded from .env file');
    } else {
      console.warn('No API key found in .env file');
    }
  } catch (error) {
    console.error('Failed to load environment variables:', error);
  }
}

// Add a context menu item for direct access
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: 'startVoiceRecognition',
    title: 'Start voice recognition',
    contexts: ['page'],
    documentUrlPatterns: ['<all_urls>']
  });
});

// Handle context menu clicks
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === 'startVoiceRecognition') {
    chrome.tabs.sendMessage(tab.id, {
      action: 'startRecognition'
    });
  }
});

// Listen for messages from popup or content script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // Handle messages if needed
  if (message.action === 'logCommand') {
    console.log('Voice command processed:', message.command);
  }
  
  // Handle errors related to microphone access
  if (message.action === 'microphoneAccessError') {
    // Show a notification to the user
    chrome.notifications.create({
      type: 'basic',
      iconUrl: 'icon.png',
      title: 'Microphone Access Required',
      message: 'Voice Command Assistant needs microphone access to work. Please check your Chrome settings.',
      buttons: [
        { title: 'Open Settings' }
      ],
      priority: 2
    });
  }
  
  return true;
});

// Handle notification button clicks
chrome.notifications.onButtonClicked.addListener((notificationId, buttonIndex) => {
  if (buttonIndex === 0) {
    // Open Chrome microphone settings
    chrome.tabs.create({ url: 'chrome://settings/content/microphone' });
  }
}); 