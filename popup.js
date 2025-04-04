document.addEventListener('DOMContentLoaded', function() {
  const startButton = document.getElementById('startButton');
  const stopButton = document.getElementById('stopButton');
  const statusText = document.getElementById('status');
  const indicator = document.getElementById('indicator');
  const transcriptDiv = document.getElementById('transcript');
  
  let isListening = false;

  // Fixed default settings (no longer configurable)
  const settings = {
    language: 'en-US',
    showNotifications: true,
    notificationDuration: 3
  };
  
  // Check if we're already listening (in case popup was reopened)
  checkRecognitionStatus();
  
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
    // Get the active tab (which should be Gmail)
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
      
      // Execute script directly in the page context to start recognition
      // This ensures recognition.start() is called directly from a user gesture handler
      chrome.scripting.executeScript({
        target: {tabId: tabs[0].id},
        function: function() {
          // This code runs in the context of the page
          if (window.mailAgentHandler && typeof window.mailAgentHandler.startSpeechRecognition === 'function') {
            console.log('Starting speech recognition directly from click handler');
            window.mailAgentHandler.startSpeechRecognition();
            return {status: 'started'};
          } else {
            console.error('Mail Agent handler not found in page');
            return {status: 'error', message: 'Mail Agent not initialized in Gmail'};
          }
        }
      }, function(results) {
        if (chrome.runtime.lastError) {
          console.error('Error executing script:', chrome.runtime.lastError);
          showError('Could not communicate with Gmail. Try refreshing the page.');
          return;
        }
        
        if (results && results[0] && results[0].result && results[0].result.status === 'started') {
          updateListeningState(true);
          
          // Clear transcript when starting a new session
          clearTranscript();
          
          // Show a helper message
          showHelperMessage();
        } else if (results && results[0] && results[0].result && results[0].result.status === 'error') {
          showError(results[0].result.message || 'Error starting recognition');
        }
      });
    });
  }
  
  // Clear the transcript
  function clearTranscript() {
    transcriptDiv.innerHTML = '';
  }
  
  // Show a helper message
  function showHelperMessage() {
    const helperElement = document.createElement('div');
    helperElement.className = 'transcript-help';
    helperElement.innerHTML = '<span class="mic-icon">🎤</span> Say a command like <span class="example-command">"compose email to John"</span>';
    transcriptDiv.appendChild(helperElement);
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
        
        // Add a "stopped listening" message
        const stoppedElement = document.createElement('div');
        stoppedElement.className = 'transcript-stopped';
        stoppedElement.innerHTML = 'Stopped listening';
        transcriptDiv.appendChild(stoppedElement);
      });
    });
  }
  
  // Show an error message in the popup
  function showError(message) {
    statusText.textContent = 'Error';
    statusText.style.color = '#c62828';
    transcriptDiv.innerHTML = `<div class="transcript-error"><span class="error-icon">⚠️</span> ${message}</div>`;
  }
  
  // Add a new transcript line with proper styling
  function addTranscriptLine(text, isInterim = false, isCommand = false) {
    // Remove any previous interim result
    const interimElements = transcriptDiv.querySelectorAll('.interim-result');
    interimElements.forEach(el => el.remove());
    
    // Remove helper text if present
    const helpElement = transcriptDiv.querySelector('.transcript-help');
    if (helpElement) {
      helpElement.remove();
    }
    
    if (isInterim) {
      // For interim results, create an interim container or use existing one
      let interimContainer = transcriptDiv.querySelector('.interim-container');
      
      if (!interimContainer) {
        interimContainer = document.createElement('div');
        interimContainer.className = 'interim-container';
        transcriptDiv.appendChild(interimContainer);
      }
      
      // Replace the interim result content
      interimContainer.innerHTML = `
        <div class="interim-result">
          <span class="interim-label">Listening:</span>
          <span class="interim-text">${text}</span>
        </div>
      `;
    } else if (isCommand) {
      // For commands, add under the last user speech
      const lastLine = transcriptDiv.querySelector('.transcript-line:last-child');
      if (lastLine) {
        // Create command container
        const commandElement = document.createElement('div');
        commandElement.className = 'command-executed';
        
        // Add icon based on command type
        let iconHTML = '✅';
        if (text.includes('Composing')) {
          iconHTML = '✉️';
        } else if (text.includes('Setting subject')) {
          iconHTML = '📝';
        } else if (text.includes('Setting message')) {
          iconHTML = '📄';
        } else if (text.includes('Sending')) {
          iconHTML = '📨';
        } else if (text.includes('Discarding')) {
          iconHTML = '🗑️';
        } else if (text.includes('Clearing')) {
          iconHTML = '🧹';
        } else if (text.includes('not recognized')) {
          iconHTML = '❓';
        }
        
        commandElement.innerHTML = `<span class="command-icon">${iconHTML}</span> <span class="command-text">${text}</span>`;
        lastLine.appendChild(commandElement);
      }
    } else {
      // For user speech, add as a new line
      const lineElement = document.createElement('div');
      lineElement.className = 'transcript-line';
      
      // Add timestamp
      const timestamp = new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
      
      const speechElement = document.createElement('div');
      speechElement.className = 'user-speech';
      speechElement.innerHTML = `
        <span class="speech-timestamp">${timestamp}</span>
        <span class="speech-text">${text}</span>
      `;
      
      lineElement.appendChild(speechElement);
      transcriptDiv.appendChild(lineElement);
    }
    
    // Scroll to the bottom
    transcriptDiv.scrollTop = transcriptDiv.scrollHeight;
  }
  
  // Listen for messages from the content script
  chrome.runtime.onMessage.addListener(function(message, sender, sendResponse) {
    // Handle transcript updates
    if (message.action === 'transcriptUpdated') {
      if (message.isFinal) {
        // For final results, add as user speech
        addTranscriptLine(message.transcript, false, false);
      } else {
        // For interim results, show with special styling
        addTranscriptLine(message.transcript, true, false);
      }
    }
    
    // Handle command executed notification
    if (message.action === 'commandExecuted') {
      // Add the command that was executed
      addTranscriptLine(message.command, false, true);
    }
    
    // Handle recognition status changes
    if (message.action === 'recognitionStatusChanged') {
      updateListeningState(message.isListening);
      
      // If turned off, show a message
      if (!message.isListening) {
        const stoppedElement = document.createElement('div');
        stoppedElement.className = 'transcript-stopped';
        stoppedElement.innerHTML = 'Stopped listening';
        transcriptDiv.appendChild(stoppedElement);
      }
    }
    
    // Handle recognition errors
    if (message.action === 'recognitionError') {
      // Just log it here, the content script will show a notification
      console.error('Recognition error:', message.error);
      
      // Add error to transcript
      const errorElement = document.createElement('div');
      errorElement.className = 'transcript-error';
      
      let errorMessage = '';
      switch (message.error) {
        case 'no-speech':
          errorMessage = 'No speech detected. Please try again.';
          break;
        case 'aborted':
          errorMessage = 'Recognition aborted';
          break;
        case 'audio-capture':
          errorMessage = 'Microphone not available';
          break;
        case 'network':
          errorMessage = 'Network error. Check your connection.';
          break;
        case 'not-allowed':
        case 'service-not-allowed':
          errorMessage = 'Microphone access denied';
          break;
        default:
          errorMessage = `Error: ${message.error}`;
      }
      
      errorElement.innerHTML = `<span class="error-icon">⚠️</span> ${errorMessage}`;
      transcriptDiv.appendChild(errorElement);
      
      // If it's a fatal error, update the UI
      if (['not-allowed', 'service-not-allowed', 'audio-capture'].includes(message.error)) {
        showError(`Microphone error: ${message.error}. Check Chrome permissions.`);
        updateListeningState(false);
      }
    }
    
    return true;
  });
  
  // Set up button listeners
  startButton.addEventListener('click', startListening);
  stopButton.addEventListener('click', stopListening);
  
  // Handle popup close to clean up
  window.addEventListener('beforeunload', () => {
    // We don't need to stop listening when popup closes
    // The content script will continue listening
  });
}); 