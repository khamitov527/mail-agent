// Listen for installation
chrome.runtime.onInstalled.addListener(() => {
  console.log('Mail Agent extension installed');
  
  // Initialize default settings if not already set
  chrome.storage.sync.get({
    language: 'en-US',
    autoStart: false,
    showNotifications: true,
    notificationDuration: 3,
    contacts: []
  }, function(items) {
    chrome.storage.sync.set(items);
  });
});

// Add a context menu item for direct access
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: 'startVoiceRecognition',
    title: 'Start voice recognition',
    contexts: ['page'],
    documentUrlPatterns: ['*://mail.google.com/*']
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
      message: 'Mail Agent needs microphone access to work. Please check your Chrome settings.',
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