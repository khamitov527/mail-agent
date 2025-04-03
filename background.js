// Listen for installation
chrome.runtime.onInstalled.addListener(() => {
  console.log('Mail Agent extension installed');
});

// Listen for messages from popup or content script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // Handle messages if needed
  if (message.action === 'logCommand') {
    console.log('Voice command processed:', message.command);
  }
  
  return true;
}); 