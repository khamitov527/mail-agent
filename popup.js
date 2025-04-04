document.addEventListener('DOMContentLoaded', function() {
  const startButton = document.getElementById('startButton');
  const stopButton = document.getElementById('stopButton');
  const statusText = document.getElementById('status');
  const indicator = document.getElementById('indicator');
  const transcriptDiv = document.getElementById('transcript');
  
  let isListening = false;
  let settings = {
    language: 'en-US',
    autoStart: false,
    showNotifications: true,
    notificationDuration: 3,
    contacts: []
  };
  
  // Load settings
  function loadSettings() {
    chrome.storage.sync.get(settings, (items) => {
      settings = items;
      
      // Check if we should start listening immediately
      if (settings.autoStart) {
        startListening();
      }
      
      // Check if we're already listening (in case popup was reopened)
      checkRecognitionStatus();
    });
  }
  
  // Check with content script to see if recognition is already running
  function checkRecognitionStatus() {
    // Query the active tab (which should be Gmail)
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
      if (tabs.length === 0) {
        console.error('No active tab found');
        return;
      }
      
      chrome.tabs.sendMessage(tabs[0].id, {
        action: 'getRecognitionStatus'
      }, function(response) {
        if (chrome.runtime.lastError) {
          console.error('Error getting recognition status:', chrome.runtime.lastError);
          return;
        }
        
        if (response && typeof response.isListening !== 'undefined') {
          updateListeningState(response.isListening);
        }
      });
    });
  }
  
  // Update UI to reflect current listening state
  function updateListeningState(listening) {
    isListening = listening;
    
    if (isListening) {
      statusText.textContent = 'Listening...';
      indicator.className = 'on';
      startButton.disabled = true;
      stopButton.disabled = false;
    } else {
      statusText.textContent = 'Ready';
      indicator.className = 'off';
      startButton.disabled = false;
      stopButton.disabled = true;
    }
  }
  
  function startListening() {
    // Send message to content script to start recognition
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
      if (tabs.length === 0) {
        console.error('No active tab found');
        showError('Make sure you are on Gmail to use this extension');
        return;
      }
      
      // Make sure we're on Gmail
      if (!tabs[0].url.includes('mail.google.com')) {
        showError('This extension only works on Gmail. Please navigate to Gmail first.');
        return;
      }
      
      chrome.tabs.sendMessage(tabs[0].id, {
        action: 'startRecognition',
        settings: settings
      }, function(response) {
        if (chrome.runtime.lastError) {
          console.error('Error starting recognition:', chrome.runtime.lastError);
          showError('Could not communicate with Gmail. Try refreshing the page.');
          return;
        }
        
        if (response && response.status === 'started') {
          updateListeningState(true);
          transcriptDiv.textContent = '';
        }
      });
    });
  }
  
  function stopListening() {
    // Send message to content script to stop recognition
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
      if (tabs.length === 0) {
        console.error('No active tab found');
        return;
      }
      
      chrome.tabs.sendMessage(tabs[0].id, {
        action: 'stopRecognition'
      }, function(response) {
        if (chrome.runtime.lastError) {
          console.error('Error stopping recognition:', chrome.runtime.lastError);
          return;
        }
        
        updateListeningState(false);
      });
    });
  }
  
  // Show an error message in the popup
  function showError(message) {
    statusText.textContent = 'Error';
    statusText.style.color = '#c62828';
    transcriptDiv.innerHTML = `<span style="color: #c62828;">${message}</span>`;
  }
  
  // Listen for messages from the content script
  chrome.runtime.onMessage.addListener(function(message, sender, sendResponse) {
    // Handle transcript updates
    if (message.action === 'transcriptUpdated') {
      if (message.isFinal) {
        // For final results, add to transcript history
        const currentText = transcriptDiv.innerHTML;
        transcriptDiv.innerHTML = `${currentText ? currentText + '<br>' : ''}${message.transcript}`;
        
        // Scroll to bottom
        transcriptDiv.scrollTop = transcriptDiv.scrollHeight;
      } else {
        // For interim results, show in italics and replace current line
        const lines = transcriptDiv.innerHTML.split('<br>');
        const allButLast = lines.slice(0, -1).join('<br>');
        transcriptDiv.innerHTML = `${allButLast ? allButLast + '<br>' : ''}<i>${message.transcript}</i>`;
      }
    }
    
    // Handle recognition status changes
    if (message.action === 'recognitionStatusChanged') {
      updateListeningState(message.isListening);
    }
    
    // Handle recognition errors
    if (message.action === 'recognitionError') {
      // Just log it here, the content script will show a notification
      console.error('Recognition error:', message.error);
      
      // If it's a fatal error, update the UI
      if (['not-allowed', 'service-not-allowed', 'audio-capture'].includes(message.error)) {
        showError(`Microphone error: ${message.error}. Check Chrome permissions.`);
        updateListeningState(false);
      }
    }
    
    return true;
  });
  
  // Options link
  document.getElementById('optionsLink').addEventListener('click', function() {
    chrome.runtime.openOptionsPage();
  });
  
  // Set up button listeners
  startButton.addEventListener('click', startListening);
  stopButton.addEventListener('click', stopListening);
  
  // Handle popup close to clean up
  window.addEventListener('beforeunload', () => {
    // We don't need to stop listening when popup closes
    // The content script will continue listening
  });
  
  // Load settings when popup opens
  loadSettings();
}); 