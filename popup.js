document.addEventListener('DOMContentLoaded', function() {
  const startButton = document.getElementById('startButton');
  const stopButton = document.getElementById('stopButton');
  const statusText = document.getElementById('status');
  const indicator = document.getElementById('indicator');
  const transcriptDiv = document.getElementById('transcript');
  
  let recognition = null;
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
      
      // If autostart is enabled, start listening immediately
      if (settings.autoStart) {
        startListening();
      }
    });
  }
  
  // Initialize speech recognition
  function initRecognition() {
    if (!('webkitSpeechRecognition' in window)) {
      statusText.textContent = 'Speech recognition not supported';
      return;
    }
    
    recognition = new webkitSpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = settings.language;
    
    recognition.onstart = function() {
      isListening = true;
      statusText.textContent = 'Listening...';
      indicator.className = 'on';
      startButton.disabled = true;
      stopButton.disabled = false;
    };
    
    recognition.onresult = function(event) {
      let interimTranscript = '';
      let finalTranscript = '';
      
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscript += transcript;
          processCommand(transcript.trim());
        } else {
          interimTranscript += transcript;
        }
      }
      
      transcriptDiv.textContent = finalTranscript || interimTranscript;
    };
    
    recognition.onerror = function(event) {
      console.error('Speech recognition error', event.error);
      statusText.textContent = `Error: ${event.error}`;
    };
    
    recognition.onend = function() {
      if (isListening) {
        recognition.start();
      } else {
        stopListening();
      }
    };
  }
  
  function startListening() {
    if (!recognition) {
      initRecognition();
    }
    
    isListening = true;
    recognition.start();
  }
  
  function stopListening() {
    isListening = false;
    if (recognition) {
      recognition.stop();
    }
    
    statusText.textContent = 'Ready';
    indicator.className = 'off';
    startButton.disabled = false;
    stopButton.disabled = true;
  }
  
  function processCommand(command) {
    // Process contact names if they exist in the command
    let processedCommand = command;
    
    if (settings.contacts && settings.contacts.length > 0) {
      // Check for compose commands
      const lowerCommand = command.toLowerCase();
      if (
        lowerCommand.startsWith('compose email to') || 
        lowerCommand.startsWith('new email to') || 
        lowerCommand.startsWith('send email to') || 
        lowerCommand.startsWith('write message to')
      ) {
        // Extract the recipient name
        let recipientName = '';
        if (lowerCommand.startsWith('compose email to')) {
          recipientName = command.substring('compose email to'.length).trim().toLowerCase();
        } else if (lowerCommand.startsWith('new email to')) {
          recipientName = command.substring('new email to'.length).trim().toLowerCase();
        } else if (lowerCommand.startsWith('send email to')) {
          recipientName = command.substring('send email to'.length).trim().toLowerCase();
        } else if (lowerCommand.startsWith('write message to')) {
          recipientName = command.substring('write message to'.length).trim().toLowerCase();
        }
        
        // Look for the contact in our contacts list
        const contact = settings.contacts.find(c => 
          c.name.toLowerCase() === recipientName
        );
        
        // If found, replace with the email
        if (contact) {
          const commandPrefix = command.substring(0, command.length - recipientName.length);
          processedCommand = `${commandPrefix}${contact.email}`;
        }
      }
    }
    
    // Send command to content script for processing
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
      chrome.tabs.sendMessage(tabs[0].id, {
        action: 'processVoiceCommand',
        command: processedCommand,
        settings: settings
      });
    });
  }
  
  // Options link
  document.getElementById('optionsLink').addEventListener('click', function() {
    chrome.runtime.openOptionsPage();
  });
  
  // Set up button listeners
  startButton.addEventListener('click', startListening);
  stopButton.addEventListener('click', stopListening);
  
  // Load settings when popup opens
  loadSettings();
}); 