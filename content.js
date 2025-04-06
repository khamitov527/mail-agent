// Command handler
class VesperCommandHandler {
  constructor() {
    this.setupMessageListener();
    this.setupNotificationSystem();
    // Fixed settings - no longer configurable
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
    this.modal = null;
    this.modalTranscript = null;
    this.cumulativeTranscript = '';
    this.finalTranscript = '';
    
    // Initialize the action executor for DOM parsing and OpenAI integration
    this.actionExecutor = null;
    this.initActionExecutor();
  }
  
  // Initialize the action executor with API key from environment
  async initActionExecutor() {
    try {
      // Wait for the environment loader to load the API key
      await window.envLoader.load();
      const apiKey = window.envLoader.get('OPENAI_API_KEY');
      
      if (!apiKey) {
        console.error('No API key found in .env file');
        return;
      }
      
      // Log the first few characters of the API key for debugging
      console.log(`API Key loaded (first 5 chars): ${apiKey.substring(0, 5)}...`);
      
      this.actionExecutor = new window.ActionExecutor(apiKey);
      console.log('Action executor initialized with API key from environment');
    } catch (error) {
      console.error('Failed to initialize action executor:', error);
    }
  }

  setupMessageListener() {
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      if (message.action === 'processVoiceCommand') {
        // We'll still accept settings from messages for backward compatibility,
        // but we don't rely on it anymore
        if (message.settings) {
          this.settings = message.settings;
        }
        
        // Use the new action executor if available, otherwise fall back to old method
        if (this.actionExecutor) {
          this.actionExecutor.processVoiceCommand(message.command)
            .then(result => {
              if (result.success) {
                this.showNotification(`Processed: ${message.command}`, 'success');
              } else {
                this.showNotification(`Error: ${result.error}`, 'error');
                // Fall back to original processing if OpenAI fails
                this.processCommand(message.command);
              }
            });
        } else {
          // Fall back to original processing if executor not initialized
          this.processCommand(message.command);
        }
        
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
        // Create the modal UI if it doesn't exist
        if (!document.querySelector('.vesper-modal')) {
          this.createModal();
        }
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
      
      // Add API key update message handler
      if (message.action === 'updateApiKey') {
        // Reload API key from environment
        this.initActionExecutor().then(() => {
          sendResponse({status: 'updated'});
        }).catch(error => {
          sendResponse({status: 'error', message: error.message});
        });
        return true;
      }
      
      return true;
    });
  }

  // Create a draggable modal for persistent UI
  createModal() {
    // Check if modal already exists
    if (this.modal) {
      return;
    }
    
    const mainColor = this.settings.mainColor || '#4169E1'; // Royal Blue
    const agentName = this.settings.agentName || 'Vesper';
    
    // Create modal container
    this.modal = document.createElement('div');
    this.modal.className = 'vesper-modal';
    this.modal.style.cssText = `
      position: fixed;
      bottom: 50px;
      left: 20px;
      width: 280px;
      background-color: white;
      border-radius: 12px;
      box-shadow: 0 4px 20px rgba(0,0,0,0.15);
      z-index: 9999;
      overflow: hidden;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
      display: flex;
      flex-direction: column;
      transition: opacity 0.3s ease;
    `;
    
    // Create modal header (draggable part)
    const modalHeader = document.createElement('div');
    modalHeader.className = 'vesper-modal-header';
    modalHeader.style.cssText = `
      padding: 15px;
      background-color: ${mainColor};
      color: white;
      font-weight: 300;
      cursor: move;
      display: flex;
      justify-content: space-between;
      align-items: center;
      letter-spacing: 0.5px;
    `;
    
    // Add logo and title container
    const titleContainer = document.createElement('div');
    titleContainer.style.cssText = `
      display: flex;
      align-items: center;
    `;
    
    // Add logo
    const logo = document.createElement('div');
    logo.className = 'vesper-logo';
    logo.style.cssText = `
      width: 24px;
      height: 24px;
      border-radius: 50%;
      background-color: white;
      color: ${mainColor};
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 14px;
      font-weight: 500;
      margin-right: 10px;
    `;
    logo.textContent = 'V';
    
    // Add title
    const title = document.createElement('span');
    title.style.cssText = `
      font-size: 16px;
    `;
    title.textContent = agentName;
    
    titleContainer.appendChild(logo);
    titleContainer.appendChild(title);
    modalHeader.appendChild(titleContainer);
    
    // Add audio wave animation container
    const waveContainer = document.createElement('div');
    waveContainer.className = 'vesper-wave-container';
    waveContainer.style.cssText = `
      display: flex;
      align-items: center;
      height: 20px;
      margin-right: 15px;
    `;
    
    // Create the audio waves
    for (let i = 0; i < 4; i++) {
      const wave = document.createElement('div');
      wave.className = 'vesper-wave';
      wave.style.cssText = `
        width: 3px;
        height: ${4 + i * 4}px;
        margin: 0 2px;
        background-color: white;
        border-radius: 1px;
        animation: vesperWave 1.2s ease-in-out infinite;
        animation-delay: ${i * 0.15}s;
        opacity: 0;
      `;
      waveContainer.appendChild(wave);
    }
    
    // Add the wave animation
    const style = document.createElement('style');
    style.textContent = `
      @keyframes vesperWave {
        0%, 100% { height: 4px; opacity: 0.3; }
        50% { height: 16px; opacity: 1; }
      }
      
      @keyframes pulse {
        0% { transform: scale(1); opacity: 1; }
        50% { transform: scale(1.1); opacity: 0.8; }
        100% { transform: scale(1); opacity: 1; }
      }
      
      .vesper-modal-transcript::-webkit-scrollbar {
        width: 6px;
      }
      
      .vesper-modal-transcript::-webkit-scrollbar-track {
        background: #f1f1f1;
        border-radius: 3px;
      }
      
      .vesper-modal-transcript::-webkit-scrollbar-thumb {
        background: #ddd;
        border-radius: 3px;
      }
      
      .vesper-modal-transcript::-webkit-scrollbar-thumb:hover {
        background: #ccc;
      }
    `;
    document.head.appendChild(style);
    
    modalHeader.appendChild(waveContainer);
    
    // Create close button
    const closeButton = document.createElement('button');
    closeButton.className = 'vesper-modal-close';
    closeButton.style.cssText = `
      border: none;
      background: none;
      color: white;
      font-size: 20px;
      cursor: pointer;
      padding: 0;
      width: 24px;
      height: 24px;
      display: flex;
      align-items: center;
      justify-content: center;
      opacity: 0.8;
      transition: opacity 0.2s ease;
    `;
    closeButton.innerHTML = '×';
    closeButton.title = 'Close';
    
    closeButton.addEventListener('mouseover', () => {
      closeButton.style.opacity = '1';
    });
    
    closeButton.addEventListener('mouseout', () => {
      closeButton.style.opacity = '0.8';
    });
    
    closeButton.addEventListener('click', () => {
      this.stopSpeechRecognition();
      document.body.removeChild(this.modal);
      this.modal = null;
      this.modalTranscript = null;
    });
    
    modalHeader.appendChild(closeButton);
    
    // Create modal body
    const modalBody = document.createElement('div');
    modalBody.className = 'vesper-modal-body';
    modalBody.style.cssText = `
      padding: 15px;
      max-height: 300px;
      overflow: hidden;
      display: flex;
      flex-direction: column;
    `;
    
    // Create listen button
    this.listenButton = document.createElement('button');
    this.listenButton.className = 'vesper-listen-button';
    this.listenButton.style.cssText = `
      background-color: ${mainColor};
      color: white;
      border: none;
      border-radius: 22px;
      padding: 10px 20px;
      font-size: 14px;
      font-weight: 500;
      cursor: pointer;
      margin: 5px 0 15px 0;
      transition: all 0.2s ease;
      box-shadow: 0 2px 8px rgba(65, 105, 225, 0.3);
      align-self: center;
      width: 90%;
    `;
    this.listenButton.textContent = 'Start Listening';
    
    // Add button event listener
    this.listenButton.addEventListener('click', () => {
      if (this.currentState.isListening) {
        // If already listening, stop and process
        this.finalTranscript = this.cumulativeTranscript || '';
        this.stopSpeechRecognition();
        
        // Only process if we have something to process
        if (this.finalTranscript && this.finalTranscript.trim()) {
          console.log('Processing final transcript:', this.finalTranscript);
          
          // Clear the transcript content and add just the latest speech
          if (this.modalTranscript) {
            this.modalTranscript.innerHTML = '';
            // Add the final speech message (what user said)
            this.addToModalTranscript(this.finalTranscript, false, false);
          }
          
          // Process the full transcript
          if (this.actionExecutor) {
            this.actionExecutor.processVoiceCommand(this.finalTranscript.trim())
              .then(result => {
                console.log(`ActionExecutor result:`, JSON.stringify(result, null, 2));
                
                if (result.success) {
                  // Check if we got a "No action" response
                  if (result.message && result.message.includes('No action') || 
                      (typeof result.action === 'object' && result.action.action === 'No action')) {
                    console.log('No specific action found for command, falling back to default handler');
                    this.processCommand(this.finalTranscript.trim());
                  } else if (result.warning || (result.action && result.action.warning)) {
                    // Handle warning cases (action executed but no visible change)
                    const warning = result.warning || (result.action && result.action.warning);
                    const reasons = result.possibleReasons || (result.action && result.action.possibleReasons) || [];
                    
                    console.warn('Command processed but with warnings:', warning);
                    
                    // Show more detailed notification
                    this.showNotification(`Action might not have worked as expected. ${reasons[0] || ''}`, 'warning');
                    
                    // Add system message about the warning
                    if (this.modalTranscript) {
                      this.addToModalTranscript(`⚠️ ${warning}`, false, true);
                      if (reasons.length > 0) {
                        this.addToModalTranscript(`Possible reason: ${reasons[0]}`, false, true);
                      }
                    }
                  } else {
                    console.log('Command processed successfully by ActionExecutor');
                    this.showNotification(`Command processed: ${this.finalTranscript.trim()}`, 'success');
                    // Add system message about successful processing
                    if (this.modalTranscript) {
                      this.addToModalTranscript('✓ Command processed successfully', false, true);
                    }
                  }
                } else {
                  // If OpenAI processing failed, fall back to original method
                  console.warn('OpenAI processing failed, falling back to default handler');
                  console.warn('Error details:', result.error);
                  this.showNotification(`Action processing failed: ${result.error || 'Unknown error'}`, 'warning');
                  this.processCommand(this.finalTranscript.trim());
                }
              })
              .catch(error => {
                console.error('Error processing with ActionExecutor:', error);
                console.error('Stack trace:', error.stack);
                // Fall back to original processing on error
                this.processCommand(this.finalTranscript.trim());
              });
          } else {
            // Fall back to original processing if no action executor
            this.processCommand(this.finalTranscript.trim());
          }
        }
        
        // Reset for next recording
        this.cumulativeTranscript = '';
      } else {
        // Start listening
        this.cumulativeTranscript = '';
        this.startSpeechRecognition();
      }
    });
    
    modalBody.appendChild(this.listenButton);
    
    // Create transcript container
    const transcriptContainer = document.createElement('div');
    transcriptContainer.className = 'vesper-modal-transcript';
    transcriptContainer.style.cssText = `
      max-height: 250px;
      overflow-y: auto;
      display: flex;
      flex-direction: column;
      gap: 10px;
      padding-right: 5px;
    `;
    
    // Create transcript content
    this.modalTranscript = document.createElement('div');
    this.modalTranscript.className = 'vesper-modal-transcript-content';
    transcriptContainer.appendChild(this.modalTranscript);
    
    // Add default message
    const helpMessage = document.createElement('div');
    helpMessage.className = 'vesper-modal-help';
    helpMessage.style.cssText = `
      color: #666;
      font-size: 14px;
      line-height: 1.4;
      text-align: center;
      padding: 10px;
      margin: 20px 0;
    `;
    helpMessage.innerHTML = `<div style="margin-bottom:10px;">🎤</div>Click <strong style="color:${mainColor};">"Start Listening"</strong> and give a command`;
    this.modalTranscript.appendChild(helpMessage);
    
    modalBody.appendChild(transcriptContainer);
    
    // Add modal parts to the modal
    this.modal.appendChild(modalHeader);
    this.modal.appendChild(modalBody);
    
    // Add to document
    document.body.appendChild(this.modal);
    
    // Make the modal draggable
    this.makeModalDraggable(this.modal, modalHeader);
    
    // Start with active waves off
    this.setWaveAnimation(false);
  }
  
  // Set the wave animation state
  setWaveAnimation(isActive) {
    const waves = this.modal?.querySelectorAll('.vesper-wave');
    if (!waves) return;
    
    waves.forEach(wave => {
      wave.style.opacity = isActive ? '1' : '0';
    });
  }
  
  // Synchronize wave animation with current listening state
  syncWaveAnimationWithState() {
    if (!this.modal) return;
    
    // Only show animation when actively listening
    this.setWaveAnimation(this.currentState.isListening);
  }
  
  // Make the modal draggable
  makeModalDraggable(modal, handle) {
    let offsetX = 0;
    let offsetY = 0;
    let isDragging = false;
    
    handle.addEventListener('mousedown', (e) => {
      isDragging = true;
      offsetX = e.clientX - modal.getBoundingClientRect().left;
      offsetY = e.clientY - modal.getBoundingClientRect().top;
      
      modal.style.userSelect = 'none';
    });
    
    document.addEventListener('mousemove', (e) => {
      if (!isDragging) return;
      
      const x = e.clientX - offsetX;
      const y = e.clientY - offsetY;
      
      // Keep the modal within the viewport
      const maxX = window.innerWidth - modal.offsetWidth;
      const maxY = window.innerHeight - modal.offsetHeight;
      
      modal.style.left = `${Math.max(0, Math.min(x, maxX))}px`;
      modal.style.top = `${Math.max(0, Math.min(y, maxY))}px`;
    });
    
    document.addEventListener('mouseup', () => {
      isDragging = false;
      modal.style.userSelect = '';
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
    
    // Update modal if it exists
    if (this.modal) {
      // Sync wave animation with listening state
      this.syncWaveAnimationWithState();
    }
    
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
    // Add debug logging to verify this function is firing
    console.log('handleRecognitionResult fired', event);
    console.log('Results received:', event.results);
    
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
        console.log('Final transcript:', transcript.trim());
        
        // Instead of processing immediately, accumulate the transcript
        this.cumulativeTranscript += (this.cumulativeTranscript ? ' ' : '') + transcript.trim();
        console.log('Cumulative transcript so far:', this.cumulativeTranscript);
        
        // Send transcript to the popup
        chrome.runtime.sendMessage({
          action: 'transcriptUpdated',
          transcript: transcript.trim(),
          isFinal: true
        });
        
        // Don't add final transcripts to the modal - we'll only show the complete message when done
        // Remove this line to avoid duplicates
        // if (this.modalTranscript) {
        //   this.addToModalTranscript(transcript.trim(), false, false);
        // }
      } else {
        interimTranscript += transcript;
        console.log('Interim transcript:', interimTranscript);
        
        // Send interim transcript to the popup
        chrome.runtime.sendMessage({
          action: 'transcriptUpdated',
          transcript: interimTranscript,
          isFinal: false
        });
        
        // Update modal transcript with interim result
        if (this.modalTranscript) {
          this.addToModalTranscript(interimTranscript, true, false);
        }
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
    
    // Update modal if it exists
    if (this.modalTranscript) {
      this.addToModalTranscript(`Error: ${errorMessage}`, false, true);
    }
    
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
      
      // Update modal if it exists
      if (this.modal) {
        // Sync wave animation with listening state
        this.syncWaveAnimationWithState();
        
        if (this.modalTranscript) {
          this.addToModalTranscript('Stopped listening', false, true);
        }
      }
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
      
      // Update button text if it exists
      if (this.listenButton) {
        this.listenButton.textContent = 'Stop Listening';
        this.listenButton.style.backgroundColor = '#d32f2f'; // Red color
      }
      
      // Update modal status if it exists
      if (this.modal) {
        // Sync wave animation with listening state
        this.syncWaveAnimationWithState();
        
        // Clear transcript and add helper message
        if (this.modalTranscript) {
          // Clear the transcript to remove any previous messages
          this.modalTranscript.innerHTML = '';
          
          const mainColor = this.settings.mainColor || '#4169E1'; // Royal Blue
          
          const helpMessage = document.createElement('div');
          helpMessage.className = 'vesper-modal-help';
          helpMessage.style.cssText = `
            color: #666;
            font-size: 14px;
            line-height: 1.4;
            text-align: center;
            padding: 10px;
            margin: 20px 0;
          `;
          helpMessage.innerHTML = `<div style="margin-bottom:10px;">🎤</div>Say a command like<br><strong style="color:${mainColor};">"compose email to John"</strong>`;
          this.modalTranscript.appendChild(helpMessage);
        }
      }
      
      return true;
    } catch (e) {
      console.error('Error starting speech recognition:', e);
      this.showNotification('Error starting speech recognition: ' + e.message, 'error');
      this.currentState.isListening = false;
      this.syncWaveAnimationWithState(); // Sync after state change
      return false;
    }
  }
  
  stopSpeechRecognition() {
    this.currentState.isListening = false;
    
    if (this.recognition) {
      try {
        this.recognition.stop();
        // Completely recreate the recognition object to ensure we can start fresh next time
        this.recognition = null;
      } catch (e) {
        console.error('Error stopping recognition:', e);
      }
    }
    
    if (this.recognitionTimeout) {
      clearTimeout(this.recognitionTimeout);
      this.recognitionTimeout = null;
    }
    
    // Update button text if it exists
    if (this.listenButton) {
      this.listenButton.textContent = 'Start Listening';
      this.listenButton.style.backgroundColor = this.settings.mainColor || '#4169E1'; // Back to blue
    }
    
    // Notify the popup that recognition stopped
    chrome.runtime.sendMessage({
      action: 'recognitionStatusChanged',
      isListening: false
    });
    
    // Update modal status if it exists
    if (this.modal) {
      // Sync wave animation with listening state
      this.syncWaveAnimationWithState();
      
      if (this.modalTranscript) {
        this.addToModalTranscript('Stopped listening', false, true);
      }
    }
    
    this.showNotification('Speech recognition stopped', 'info');
  }

  setupNotificationSystem() {
    // Create notification container
    this.notificationContainer = document.createElement('div');
    this.notificationContainer.className = 'vesper-notification-container';
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
    
    const mainColor = this.settings.mainColor || '#4169E1'; // Royal Blue
    
    // Create notification element
    const notification = document.createElement('div');
    notification.className = `vesper-notification vesper-notification-${type}`;
    
    // Set the color based on notification type
    let notificationColor = mainColor;
    let iconHtml = '';
    
    switch(type) {
      case 'error':
        notificationColor = '#d32f2f';
        iconHtml = '<span style="margin-right:8px;">❌</span>';
        break;
      case 'warning':
        notificationColor = '#f57c00';
        iconHtml = '<span style="margin-right:8px;">⚠️</span>';
        break;
      case 'success':
        notificationColor = '#43a047';
        iconHtml = '<span style="margin-right:8px;">✅</span>';
        break;
      default: // info
        notificationColor = mainColor;
        iconHtml = '<span style="margin-right:8px;">ℹ️</span>';
    }
    
    notification.style.cssText = `
      background-color: ${type === 'error' ? '#ffebee' : type === 'warning' ? '#fff8e1' : 'white'};
      color: #333;
      border-left: 3px solid ${notificationColor};
      padding: 12px 16px;
      margin-bottom: 10px;
      border-radius: 4px;
      box-shadow: 0 2px 10px rgba(0,0,0,0.1);
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
      font-size: 14px;
      font-weight: 400;
      opacity: 0;
      transition: opacity 0.3s;
      display: flex;
      align-items: center;
    `;
    
    // Add icon and message
    notification.innerHTML = `
      ${iconHtml}<div>
        <strong style="color:${notificationColor};">Vesper:</strong> ${message}
      </div>
    `;
    
    // Add to container
    this.notificationContainer.appendChild(notification);
    
    // Fade in
    setTimeout(() => {
      notification.style.opacity = '1';
    }, 10);
    
    // Remove after notification duration (from settings)
    const duration = (this.settings.notificationDuration || 3) * 1000;
    // Longer duration for warnings and errors
    const adjustedDuration = type === 'warning' || type === 'error' ? duration * 1.5 : duration;
    
    setTimeout(() => {
      notification.style.opacity = '0';
      setTimeout(() => {
        if (this.notificationContainer.contains(notification)) {
          this.notificationContainer.removeChild(notification);
        }
      }, 300);
    }, adjustedDuration);
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

  // Send information about the executed command to the popup
  notifyCommandExecuted(commandType, details) {
    let commandText = '';
    
    switch (commandType) {
      case 'compose':
        commandText = details ? `Composing email to: ${details}` : 'Composing new email';
        break;
      case 'subject':
        commandText = `Setting subject: "${details}"`;
        break;  
      case 'body':
        commandText = `Setting message body`;
        break;
      case 'send':
        commandText = 'Sending email';
        break;
      case 'cancel':
        commandText = 'Discarding email';
        break;
      case 'clear':
        commandText = `Clearing ${details}`;
        break;
      default:
        commandText = 'Executed command';
    }
    
    // Send to popup
    chrome.runtime.sendMessage({
      action: 'commandExecuted',
      command: commandText
    });
    
    // Add to modal transcript if it exists
    if (this.modalTranscript) {
      // Create a command response element (from Vesper)
      const commandDiv = document.createElement('div');
      commandDiv.className = 'vesper-modal-response';
      commandDiv.style.cssText = `
        background-color: #f5f5f5;
        color: #333;
        border-radius: 12px;
        padding: 12px;
        margin: 5px 0;
        font-size: 14px;
        word-wrap: break-word;
        max-width: 85%;
        align-self: flex-start;
      `;
      
      // Add icon based on command type
      let icon = '';
      if (commandText.includes('Composing')) {
        icon = '✉️ ';
      } else if (commandText.includes('Setting subject')) {
        icon = '📝 ';
      } else if (commandText.includes('Setting message')) {
        icon = '📄 ';
      } else if (commandText.includes('Sending')) {
        icon = '📨 ';
      } else if (commandText.includes('Discarding')) {
        icon = '🗑️ ';
      } else if (commandText.includes('Clearing')) {
        icon = '🧹 ';
      }
      
      commandDiv.textContent = icon + commandText;
      this.modalTranscript.appendChild(commandDiv);
      
      // Ensure scrolling to show the latest content
      const container = this.modal.querySelector('.vesper-modal-transcript');
      if (container) {
        container.scrollTop = container.scrollHeight;
      }
    }
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
      const recipient = this.extractRecipient(lowerCommand);
      this.handleComposeCommand(lowerCommand);
      this.notifyCommandExecuted('compose', recipient);
      return;
    }
    
    // Handle subject actions
    if (this.isSubjectCommand(lowerCommand)) {
      const subject = this.extractSubject(lowerCommand);
      this.handleSubjectCommand(lowerCommand);
      this.notifyCommandExecuted('subject', subject);
      return;
    }
    
    // Handle body content actions
    if (this.isBodyCommand(lowerCommand)) {
      this.handleBodyCommand(lowerCommand);
      this.notifyCommandExecuted('body');
      return;
    }
    
    // Handle send actions
    if (this.isSendCommand(lowerCommand)) {
      this.handleSendCommand();
      this.notifyCommandExecuted('send');
      return;
    }
    
    // Handle cancel actions
    if (this.isCancelCommand(lowerCommand)) {
      this.handleCancelCommand();
      this.notifyCommandExecuted('cancel');
      return;
    }
    
    // Handle commands to clear/edit fields
    if (this.isClearCommand(lowerCommand)) {
      let clearTarget = '';
      if (lowerCommand.includes('subject')) clearTarget = 'subject';
      else if (lowerCommand.includes('body') || lowerCommand.includes('message')) clearTarget = 'message';
      else if (lowerCommand.includes('recipient') || lowerCommand.includes('to')) clearTarget = 'recipient';
      
      this.handleClearCommand(lowerCommand);
      this.notifyCommandExecuted('clear', clearTarget);
      return;
    }
    
    console.log('Command not recognized:', command);
    this.showNotification('Command not recognized: ' + command, 'error');
    
    // Send unrecognized command notification
    chrome.runtime.sendMessage({
      action: 'commandExecuted',
      command: 'Command not recognized'
    });
    
    // Add to modal transcript if it exists
    if (this.modalTranscript) {
      // Create an error response element
      const errorDiv = document.createElement('div');
      errorDiv.className = 'vesper-modal-error';
      errorDiv.style.cssText = `
        background-color: #f5f5f5;
        color: #d32f2f;
        border-radius: 12px;
        padding: 12px;
        margin: 5px 0;
        font-size: 14px;
        word-wrap: break-word;
        max-width: 85%;
        align-self: flex-start;
      `;
      
      errorDiv.textContent = `❓ I didn't understand that command`;
      this.modalTranscript.appendChild(errorDiv);
      
      // Ensure scrolling to show the latest content
      const container = this.modal.querySelector('.vesper-modal-transcript');
      if (container) {
        container.scrollTop = container.scrollHeight;
      }
    }
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

  // Add message to the modal transcript
  addToModalTranscript(text, isInterim = false, isSystem = false) {
    if (!this.modalTranscript) return;
    
    const mainColor = this.settings.mainColor || '#4169E1'; // Royal Blue
    
    // Remove any existing interim results
    const interimElements = this.modalTranscript.querySelectorAll('.vesper-modal-interim');
    interimElements.forEach(el => el.remove());
    
    // Remove the helper message if present
    const helpElement = this.modalTranscript.querySelector('.vesper-modal-help');
    if (helpElement) {
      helpElement.remove();
    }
    
    if (isInterim) {
      // For interim results, add with special styling
      const interimDiv = document.createElement('div');
      interimDiv.className = 'vesper-modal-interim';
      interimDiv.style.cssText = `
        color: #666;
        background-color: #f5f5f5;
        border-radius: 12px;
        padding: 10px 12px;
        margin: 5px 0;
        font-size: 14px;
        opacity: 0.8;
      `;
      interimDiv.textContent = text;
      this.modalTranscript.appendChild(interimDiv);
    } else if (isSystem) {
      // For system messages (like errors or status)
      const systemDiv = document.createElement('div');
      systemDiv.className = 'vesper-modal-system';
      systemDiv.style.cssText = `
        color: #666;
        text-align: center;
        font-size: 12px;
        margin: 8px 0;
        padding: 5px;
      `;
      
      if (text.startsWith('Error:')) {
        systemDiv.style.color = '#d32f2f';
      }
      
      systemDiv.textContent = text;
      this.modalTranscript.appendChild(systemDiv);
    } else {
      // For regular user speech
      const speechDiv = document.createElement('div');
      speechDiv.className = 'vesper-modal-speech';
      speechDiv.style.cssText = `
        background-color: ${mainColor};
        color: white;
        border-radius: 12px;
        padding: 12px;
        margin: 5px 0;
        font-size: 14px;
        word-wrap: break-word;
        max-width: 85%;
        align-self: flex-end;
      `;
      
      speechDiv.textContent = text;
      this.modalTranscript.appendChild(speechDiv);
    }
    
    // Ensure scrolling to show the latest content
    const container = this.modal.querySelector('.vesper-modal-transcript');
    if (container) {
      container.scrollTop = container.scrollHeight;
    }
  }
}

// Initialize the command handler
const handler = new VesperCommandHandler();

// Expose the handler to the window object so it can be accessed directly
// This allows recognition.start() to be called directly from a user gesture handler
window.vesperHandler = handler;

// Log that the content script is running
console.log('Vesper Agent content script is running...'); 