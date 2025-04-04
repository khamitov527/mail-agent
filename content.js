// Command handler for Gmail
class GmailCommandHandler {
  constructor() {
    this.setupMessageListeners();
    this.setupNotificationSystem();
    this.settings = {
      showNotifications: true,
      notificationDuration: 3,
      language: 'en-US'
    };
    this.lastCommand = null;
    this.currentState = {
      isComposing: false,
      lastRecipient: null,
      isListening: false
    };
    this.recognition = null;
    this.recognitionTimeout = null;
  }

  setupMessageListeners() {
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      if (message.action === 'processVoiceCommand') {
        // Update settings if they were passed
        if (message.settings) {
          this.settings = message.settings;
        }
        
        this.processCommand(message.command);
        // Log the command to background script
        chrome.runtime.sendMessage({
          action: 'logCommand',
          command: message.command
        });
        return true;
      }
      
      // Handle start/stop voice recognition
      if (message.action === 'startRecognition') {
        if (message.settings) {
          this.settings = message.settings;
        }
        this.startSpeechRecognition();
        // Send response to confirm
        sendResponse({status: 'started'});
        return true;
      }
      
      if (message.action === 'stopRecognition') {
        this.stopSpeechRecognition();
        // Send response to confirm
        sendResponse({status: 'stopped'});
        return true;
      }
      
      if (message.action === 'getRecognitionStatus') {
        sendResponse({
          isListening: this.currentState.isListening
        });
        return true;
      }
      
      return true;
    });
  }

  // Setup speech recognition in the content script
  initSpeechRecognition() {
    if (this.recognition) {
      return;
    }
    
    // Create a notification to tell the user we're setting up
    this.showNotification('Setting up speech recognition...', 'info');
    
    try {
      // Use the standard SpeechRecognition or the webkit prefixed version
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      
      if (!SpeechRecognition) {
        this.showNotification('Speech recognition not supported in this browser', 'error');
        return false;
      }
      
      this.recognition = new SpeechRecognition();
      
      // Configure recognition
      this.recognition.continuous = true;
      this.recognition.interimResults = true;
      this.recognition.lang = this.settings.language;
      this.recognition.maxAlternatives = 1;
      
      // Set up event handlers
      this.recognition.onstart = this.handleRecognitionStart.bind(this);
      this.recognition.onresult = this.handleRecognitionResult.bind(this);
      this.recognition.onerror = this.handleRecognitionError.bind(this);
      this.recognition.onend = this.handleRecognitionEnd.bind(this);
      
      return true;
    } catch (e) {
      console.error('Error initializing speech recognition:', e);
      this.showNotification('Error initializing speech recognition: ' + e.message, 'error');
      return false;
    }
  }
  
  handleRecognitionStart() {
    console.log('Speech recognition started');
    this.currentState.isListening = true;
    
    // Notify the popup that recognition started
    chrome.runtime.sendMessage({
      action: 'recognitionStatusChanged',
      isListening: true
    });
    
    this.showNotification('Listening for commands...', 'info');
    
    // Clear any existing timeout
    if (this.recognitionTimeout) {
      clearTimeout(this.recognitionTimeout);
    }
    
    // Set a timeout to restart recognition if no speech is detected
    this.recognitionTimeout = setTimeout(() => {
      if (this.recognition && this.currentState.isListening) {
        try {
          this.recognition.stop();
          // Will restart in onend handler
        } catch (e) {
          console.error('Error stopping recognition for restart:', e);
        }
      }
    }, 10000); // 10 seconds timeout
  }
  
  handleRecognitionResult(event) {
    // Reset the timeout on receiving results
    if (this.recognitionTimeout) {
      clearTimeout(this.recognitionTimeout);
    }
    
    this.recognitionTimeout = setTimeout(() => {
      if (this.recognition && this.currentState.isListening) {
        try {
          this.recognition.stop();
        } catch (e) {
          console.error('Error stopping recognition for restart:', e);
        }
      }
    }, 10000);
    
    let interimTranscript = '';
    let finalTranscript = '';
    
    for (let i = event.resultIndex; i < event.results.length; i++) {
      const transcript = event.results[i][0].transcript;
      if (event.results[i].isFinal) {
        finalTranscript += transcript;
        this.processCommand(transcript.trim());
        
        // Send transcript to the popup
        chrome.runtime.sendMessage({
          action: 'transcriptUpdated',
          transcript: transcript.trim(),
          isFinal: true
        });
      } else {
        interimTranscript += transcript;
        
        // Send interim transcript to the popup
        chrome.runtime.sendMessage({
          action: 'transcriptUpdated',
          transcript: interimTranscript,
          isFinal: false
        });
      }
    }
  }
  
  handleRecognitionError(event) {
    console.error('Speech recognition error:', event.error);
    
    // Send error to popup
    chrome.runtime.sendMessage({
      action: 'recognitionError',
      error: event.error
    });
    
    let errorMessage = '';
    
    switch (event.error) {
      case 'no-speech':
        errorMessage = 'No speech detected. Try again.';
        break;
      case 'aborted':
        errorMessage = 'Recognition aborted';
        break;
      case 'audio-capture':
        errorMessage = 'Microphone not available or not connected';
        break;
      case 'network':
        errorMessage = 'Network error. Check your connection.';
        break;
      case 'not-allowed':
      case 'service-not-allowed':
        errorMessage = 'Microphone access denied. Check Chrome permissions.';
        break;
      default:
        errorMessage = `Error: ${event.error}`;
    }
    
    this.showNotification(errorMessage, 'error');
    
    // Only try to restart on temporary errors
    if (['no-speech', 'aborted', 'network'].includes(event.error) && this.currentState.isListening) {
      setTimeout(() => {
        if (this.currentState.isListening) {
          try {
            this.recognition.start();
          } catch (e) {
            console.error('Error restarting recognition after error:', e);
            this.stopSpeechRecognition();
          }
        }
      }, 1000);
    } else {
      this.stopSpeechRecognition();
    }
  }
  
  handleRecognitionEnd() {
    console.log('Speech recognition ended');
    
    if (this.recognitionTimeout) {
      clearTimeout(this.recognitionTimeout);
      this.recognitionTimeout = null;
    }
    
    if (this.currentState.isListening) {
      // If we're still supposed to be listening, restart
      try {
        this.recognition.start();
      } catch (e) {
        console.error('Error restarting recognition:', e);
        this.stopSpeechRecognition();
      }
    } else {
      // If we intentionally stopped, update state
      // Notify the popup that recognition stopped
      chrome.runtime.sendMessage({
        action: 'recognitionStatusChanged',
        isListening: false
      });
    }
  }
  
  startSpeechRecognition() {
    if (!this.initSpeechRecognition()) {
      return;
    }
    
    if (this.currentState.isListening) {
      console.log('Already listening, not starting again');
      return;
    }
    
    try {
      console.log('Starting speech recognition in content script');
      this.currentState.isListening = true;
      this.recognition.start();
      return true;
    } catch (e) {
      console.error('Error starting speech recognition:', e);
      this.showNotification('Error starting speech recognition: ' + e.message, 'error');
      this.currentState.isListening = false;
      return false;
    }
  }
  
  stopSpeechRecognition() {
    this.currentState.isListening = false;
    
    if (this.recognition) {
      try {
        this.recognition.stop();
      } catch (e) {
        console.error('Error stopping recognition:', e);
      }
    }
    
    if (this.recognitionTimeout) {
      clearTimeout(this.recognitionTimeout);
      this.recognitionTimeout = null;
    }
    
    // Notify the popup that recognition stopped
    chrome.runtime.sendMessage({
      action: 'recognitionStatusChanged',
      isListening: false
    });
    
    this.showNotification('Speech recognition stopped', 'info');
  }

  setupNotificationSystem() {
    // Create notification container
    this.notificationContainer = document.createElement('div');
    this.notificationContainer.className = 'mail-agent-notification-container';
    this.notificationContainer.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      z-index: 9999;
      max-width: 300px;
    `;
    document.body.appendChild(this.notificationContainer);
  }

  showNotification(message, type = 'info') {
    // Check if notifications are enabled in settings
    if (!this.settings.showNotifications) {
      return;
    }
    
    // Create notification element
    const notification = document.createElement('div');
    notification.className = `mail-agent-notification mail-agent-notification-${type}`;
    notification.style.cssText = `
      background-color: ${type === 'error' ? '#ffebee' : '#e8f5e9'};
      color: ${type === 'error' ? '#c62828' : '#2e7d32'};
      border-left: 4px solid ${type === 'error' ? '#c62828' : '#2e7d32'};
      padding: 12px 16px;
      margin-bottom: 10px;
      border-radius: 4px;
      box-shadow: 0 2px 5px rgba(0,0,0,0.1);
      font-family: Arial, sans-serif;
      font-size: 14px;
      opacity: 0;
      transition: opacity 0.3s;
    `;
    
    // Add icon and message
    notification.innerHTML = `
      <strong>Mail Agent:</strong> ${message}
    `;
    
    // Add to container
    this.notificationContainer.appendChild(notification);
    
    // Fade in
    setTimeout(() => {
      notification.style.opacity = '1';
    }, 10);
    
    // Remove after notification duration (from settings)
    const duration = (this.settings.notificationDuration || 3) * 1000;
    
    setTimeout(() => {
      notification.style.opacity = '0';
      setTimeout(() => {
        if (this.notificationContainer.contains(notification)) {
          this.notificationContainer.removeChild(notification);
        }
      }, 300);
    }, duration);
  }

  // Track email compose state
  updateComposeState(isComposing) {
    this.currentState.isComposing = isComposing;
    
    // Observe for compose window closing
    if (isComposing) {
      this.observeComposeWindow();
    }
  }
  
  // Set up observer to detect when compose window is closed
  observeComposeWindow() {
    // MutationObserver to detect when compose window is removed
    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.type === 'childList' && mutation.removedNodes.length) {
          // Check if compose window is still present
          const composeWindow = document.querySelector('div[role="dialog"]');
          if (!composeWindow) {
            this.updateComposeState(false);
            observer.disconnect();
          }
        }
      }
    });
    
    observer.observe(document.body, { childList: true, subtree: true });
  }

  processCommand(command) {
    // Store last command for context-aware commands
    this.lastCommand = command;
    
    // Convert to lowercase for easier matching
    const lowerCommand = command.toLowerCase();
    
    // Check if compose window is open to help with context
    const composeWindow = document.querySelector('div[role="dialog"]');
    this.currentState.isComposing = !!composeWindow;
    
    // Handle compose actions
    if (this.isComposeCommand(lowerCommand)) {
      this.handleComposeCommand(lowerCommand);
      return;
    }
    
    // Handle subject actions
    if (this.isSubjectCommand(lowerCommand)) {
      this.handleSubjectCommand(lowerCommand);
      return;
    }
    
    // Handle body content actions
    if (this.isBodyCommand(lowerCommand)) {
      this.handleBodyCommand(lowerCommand);
      return;
    }
    
    // Handle send actions
    if (this.isSendCommand(lowerCommand)) {
      this.handleSendCommand();
      return;
    }
    
    // Handle cancel actions
    if (this.isCancelCommand(lowerCommand)) {
      this.handleCancelCommand();
      return;
    }
    
    // Handle commands to clear/edit fields
    if (this.isClearCommand(lowerCommand)) {
      this.handleClearCommand(lowerCommand);
      return;
    }
    
    console.log('Command not recognized:', command);
    this.showNotification('Command not recognized: ' + command, 'error');
  }
  
  // Command detection methods
  isComposeCommand(cmd) {
    return (
      cmd.startsWith('compose email to') || 
      cmd.startsWith('new email to') || 
      cmd.startsWith('send email to') || 
      cmd.startsWith('write message to') ||
      cmd.startsWith('compose to') ||
      cmd.startsWith('email to') ||
      cmd.startsWith('write to')
    );
  }
  
  isSubjectCommand(cmd) {
    return (
      cmd.startsWith('subject:') ||
      cmd.startsWith('subject is') ||
      cmd.startsWith('add subject:') ||
      cmd.startsWith('set subject:') ||
      cmd.startsWith('set subject to')
    );
  }
  
  isBodyCommand(cmd) {
    return (
      cmd.startsWith('say:') ||
      cmd.startsWith('message body:') ||
      cmd.startsWith('body says:') ||
      cmd.startsWith('add message:') ||
      cmd.startsWith('type:') ||
      cmd.startsWith('write:')
    );
  }
  
  isSendCommand(cmd) {
    return (
      cmd === 'send' ||
      cmd === 'send the email' ||
      cmd === 'okay send it' ||
      cmd === 'go ahead and send' ||
      cmd === 'send it' ||
      cmd === 'send now' ||
      cmd === 'send this' ||
      cmd === 'send message'
    );
  }
  
  isCancelCommand(cmd) {
    return (
      cmd === 'cancel' ||
      cmd === 'nevermind' ||
      cmd === 'discard email' ||
      cmd === 'discard' ||
      cmd === 'close email' ||
      cmd === 'delete draft'
    );
  }
  
  isClearCommand(cmd) {
    return (
      cmd.startsWith('clear') ||
      cmd.startsWith('delete') ||
      cmd.startsWith('remove')
    );
  }
  
  // Extract recipient from compose command
  extractRecipient(cmd) {
    let recipient = '';
    const composePrefixes = [
      'compose email to',
      'new email to',
      'send email to',
      'write message to',
      'compose to',
      'email to',
      'write to'
    ];
    
    for (const prefix of composePrefixes) {
      if (cmd.startsWith(prefix)) {
        recipient = cmd.substring(prefix.length).trim();
        break;
      }
    }
    
    return recipient;
  }
  
  // Extract subject from subject command
  extractSubject(cmd) {
    let subject = '';
    const subjectPrefixes = [
      'subject:',
      'subject is',
      'add subject:',
      'set subject:',
      'set subject to'
    ];
    
    for (const prefix of subjectPrefixes) {
      if (cmd.startsWith(prefix)) {
        subject = cmd.substring(prefix.length).trim();
        break;
      }
    }
    
    return subject;
  }
  
  // Extract body text from body command
  extractBodyText(cmd) {
    let body = '';
    const bodyPrefixes = [
      'say:',
      'message body:',
      'body says:',
      'add message:',
      'type:',
      'write:'
    ];
    
    for (const prefix of bodyPrefixes) {
      if (cmd.startsWith(prefix)) {
        body = cmd.substring(prefix.length).trim();
        break;
      }
    }
    
    return body;
  }
  
  // Command handler methods
  handleComposeCommand(cmd) {
    // Click the compose button
    const composeButton = document.querySelector('.T-I.T-I-KE.L3');
    if (composeButton) {
      composeButton.click();
      
      // Extract the recipient
      const recipient = this.extractRecipient(cmd);
      this.currentState.lastRecipient = recipient;
      
      if (recipient) {
        // Wait for compose window to open
        setTimeout(() => {
          const toField = document.querySelector('input[name="to"]');
          if (toField) {
            toField.value = recipient;
            toField.dispatchEvent(new Event('input', { bubbles: true }));
            toField.dispatchEvent(new Event('change', { bubbles: true }));
            this.showNotification(`Composing email to: ${recipient}`);
            this.updateComposeState(true);
          }
        }, 500);
      } else {
        this.showNotification('Composing new email');
        this.updateComposeState(true);
      }
    } else {
      console.log('Compose button not found');
      this.showNotification('Compose button not found', 'error');
    }
  }
  
  handleSubjectCommand(cmd) {
    const subject = this.extractSubject(cmd);
    
    if (subject) {
      const subjectField = document.querySelector('input[name="subjectbox"]');
      if (subjectField) {
        subjectField.value = subject;
        subjectField.dispatchEvent(new Event('input', { bubbles: true }));
        subjectField.dispatchEvent(new Event('change', { bubbles: true }));
        this.showNotification(`Subject set to: ${subject}`);
      } else {
        console.log('Subject field not found');
        this.showNotification('Subject field not found. Is a compose window open?', 'error');
        
        // If no compose window is open, try to open one first
        if (!this.currentState.isComposing) {
          this.showNotification('Opening compose window first...', 'info');
          const composeButton = document.querySelector('.T-I.T-I-KE.L3');
          if (composeButton) {
            composeButton.click();
            setTimeout(() => {
              const subjectField = document.querySelector('input[name="subjectbox"]');
              if (subjectField) {
                subjectField.value = subject;
                subjectField.dispatchEvent(new Event('input', { bubbles: true }));
                subjectField.dispatchEvent(new Event('change', { bubbles: true }));
                this.showNotification(`Subject set to: ${subject}`);
                this.updateComposeState(true);
              }
            }, 500);
          }
        }
      }
    }
  }
  
  handleBodyCommand(cmd) {
    const body = this.extractBodyText(cmd);
    
    if (body) {
      // Gmail's compose body is in a div with contenteditable=true
      const bodyField = document.querySelector('div[role="textbox"][aria-label="Message Body"]');
      if (bodyField) {
        bodyField.textContent = body;
        bodyField.dispatchEvent(new Event('input', { bubbles: true }));
        this.showNotification('Email body updated');
      } else {
        console.log('Body field not found');
        this.showNotification('Body field not found. Is a compose window open?', 'error');
        
        // If no compose window is open, try to open one first
        if (!this.currentState.isComposing) {
          this.showNotification('Opening compose window first...', 'info');
          const composeButton = document.querySelector('.T-I.T-I-KE.L3');
          if (composeButton) {
            composeButton.click();
            setTimeout(() => {
              const bodyField = document.querySelector('div[role="textbox"][aria-label="Message Body"]');
              if (bodyField) {
                bodyField.textContent = body;
                bodyField.dispatchEvent(new Event('input', { bubbles: true }));
                this.showNotification('Email body updated');
                this.updateComposeState(true);
              }
            }, 500);
          }
        }
      }
    }
  }
  
  handleSendCommand() {
    // Click the send button
    const sendButton = document.querySelector('div[role="button"][data-tooltip^="Send"]');
    if (sendButton) {
      sendButton.click();
      this.showNotification('Email sent!');
      this.updateComposeState(false);
    } else {
      console.log('Send button not found');
      this.showNotification('Send button not found. Is a compose window open?', 'error');
    }
  }
  
  handleCancelCommand() {
    // Click the discard button (×) or find cancel/close in the compose window
    const discardButton = document.querySelector('img[aria-label="Discard draft"]');
    if (discardButton) {
      discardButton.click();
      
      // Sometimes Gmail shows a confirmation dialog for discard
      setTimeout(() => {
        const confirmDiscard = document.querySelector('button[name="ok"]');
        if (confirmDiscard) {
          confirmDiscard.click();
        }
        this.showNotification('Email discarded');
        this.updateComposeState(false);
      }, 100);
    } else {
      console.log('Discard button not found');
      this.showNotification('Discard button not found. Is a compose window open?', 'error');
    }
  }
  
  handleClearCommand(cmd) {
    const lowerCommand = cmd.toLowerCase();
    
    if (lowerCommand.includes('subject')) {
      // Clear subject field
      const subjectField = document.querySelector('input[name="subjectbox"]');
      if (subjectField) {
        subjectField.value = '';
        subjectField.dispatchEvent(new Event('input', { bubbles: true }));
        subjectField.dispatchEvent(new Event('change', { bubbles: true }));
        this.showNotification('Subject cleared');
      } else {
        this.showNotification('Subject field not found', 'error');
      }
    } else if (lowerCommand.includes('body') || lowerCommand.includes('message')) {
      // Clear body field
      const bodyField = document.querySelector('div[role="textbox"][aria-label="Message Body"]');
      if (bodyField) {
        bodyField.textContent = '';
        bodyField.dispatchEvent(new Event('input', { bubbles: true }));
        this.showNotification('Message body cleared');
      } else {
        this.showNotification('Message body not found', 'error');
      }
    } else if (lowerCommand.includes('recipient') || lowerCommand.includes('to')) {
      // Clear to field
      const toField = document.querySelector('input[name="to"]');
      if (toField) {
        toField.value = '';
        toField.dispatchEvent(new Event('input', { bubbles: true }));
        toField.dispatchEvent(new Event('change', { bubbles: true }));
        this.showNotification('Recipient cleared');
      } else {
        this.showNotification('Recipient field not found', 'error');
      }
    } else {
      this.showNotification('Please specify what to clear (subject, body, or recipient)', 'error');
    }
  }
}

// Initialize the command handler
const gmailCommandHandler = new GmailCommandHandler();

// Log that the content script is running
console.log('Mail Agent content script is running on Gmail'); 