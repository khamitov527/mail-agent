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
      await window.envLoader.load();
      const apiKey = window.envLoader.get('OPENAI_API_KEY');
      
      if (!apiKey) {
        console.error('No API key found in .env file');
        return;
      }
      
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
        if (message.settings) {
          this.settings = message.settings;
        }
        
        if (this.actionExecutor) {
          this.actionExecutor.processVoiceCommand(message.command)
            .then(result => {
              if (result.success) {
                this.showNotification(`Processed: ${message.command}`, 'success');
              } else {
                this.showNotification(`Error: ${result.error}`, 'error');
                // Fallback to generic processing
                this.processCommand(message.command);
              }
            });
        } else {
          this.processCommand(message.command);
        }
        
        chrome.runtime.sendMessage({
          action: 'logCommand',
          command: message.command
        });
        return true;
      }
      
      if (message.action === 'startRecognition') {
        if (message.settings) {
          this.settings = message.settings;
        }
        this.startSpeechRecognition();
        if (!document.querySelector('.vesper-modal')) {
          this.createModal();
        }
        sendResponse({status: 'started'});
        return true;
      }
      
      if (message.action === 'stopRecognition') {
        this.stopSpeechRecognition();
        sendResponse({status: 'stopped'});
        return true;
      }
      
      if (message.action === 'getRecognitionStatus') {
        sendResponse({
          isListening: this.currentState.isListening
        });
        return true;
      }
      
      if (message.action === 'updateApiKey') {
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

  createModal() {
    if (this.modal) return;
    
    const mainColor = this.settings.mainColor || '#4169E1';
    const agentName = this.settings.agentName || 'Vesper';
    
    // Modal container
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
    
    // Modal header
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
    
    const titleContainer = document.createElement('div');
    titleContainer.style.cssText = `display: flex; align-items: center;`;
    
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
    
    const title = document.createElement('span');
    title.style.cssText = `font-size: 16px;`;
    title.textContent = agentName;
    
    titleContainer.appendChild(logo);
    titleContainer.appendChild(title);
    modalHeader.appendChild(titleContainer);
    
    // Audio wave animation
    const waveContainer = document.createElement('div');
    waveContainer.className = 'vesper-wave-container';
    waveContainer.style.cssText = `
      display: flex;
      align-items: center;
      height: 20px;
      margin-right: 15px;
    `;
    
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
    
    // Close button
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
    
    // Modal body
    const modalBody = document.createElement('div');
    modalBody.className = 'vesper-modal-body';
    modalBody.style.cssText = `
      padding: 15px;
      max-height: 300px;
      overflow: hidden;
      display: flex;
      flex-direction: column;
    `;
    
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
    
    this.listenButton.addEventListener('click', () => {
      if (this.currentState.isListening) {
        this.finalTranscript = this.cumulativeTranscript || '';
        this.stopSpeechRecognition();
        
        if (this.finalTranscript && this.finalTranscript.trim()) {
          console.log('Processing final transcript:', this.finalTranscript);
          if (this.modalTranscript) {
            this.modalTranscript.innerHTML = '';
            this.addToModalTranscript(this.finalTranscript, false, false);
          }
          
          if (this.actionExecutor) {
            this.actionExecutor.processVoiceCommand(this.finalTranscript.trim())
              .then(result => {
                if (result.success) {
                  this.showNotification(`Command processed: ${this.finalTranscript.trim()}`, 'success');
                  if (this.modalTranscript) {
                    this.addToModalTranscript('✓ Command processed successfully', false, true);
                  }
                } else {
                  this.showNotification(`Action processing failed: ${result.error || 'Unknown error'}`, 'warning');
                }
              })
              .catch(error => {
                console.error('Error processing with ActionExecutor:', error);
                this.processCommand(this.finalTranscript.trim());
              });
          } else {
            this.processCommand(this.finalTranscript.trim());
          }
        }
        
        this.cumulativeTranscript = '';
      } else {
        this.cumulativeTranscript = '';
        this.startSpeechRecognition();
      }
    });
    
    modalBody.appendChild(this.listenButton);
    
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
    
    this.modalTranscript = document.createElement('div');
    this.modalTranscript.className = 'vesper-modal-transcript-content';
    transcriptContainer.appendChild(this.modalTranscript);
    
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
    
    this.modal.appendChild(modalHeader);
    this.modal.appendChild(modalBody);
    
    document.body.appendChild(this.modal);
    
    this.makeModalDraggable(this.modal, modalHeader);
    
    this.setWaveAnimation(false);
  }
  
  setWaveAnimation(isActive) {
    const waves = this.modal?.querySelectorAll('.vesper-wave');
    if (!waves) return;
    
    waves.forEach(wave => {
      wave.style.opacity = isActive ? '1' : '0';
    });
  }
  
  syncWaveAnimationWithState() {
    if (!this.modal) return;
    this.setWaveAnimation(this.currentState.isListening);
  }
  
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

  initSpeechRecognition() {
    if (this.recognition) return;
    
    this.showNotification('Setting up speech recognition...', 'info');
    
    try {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      
      if (!SpeechRecognition) {
        this.showNotification('Speech recognition not supported in this browser', 'error');
        return false;
      }
      
      this.recognition = new SpeechRecognition();
      this.recognition.continuous = true;
      this.recognition.interimResults = true;
      this.recognition.lang = this.settings.language;
      this.recognition.maxAlternatives = 1;
      
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
    
    chrome.runtime.sendMessage({
      action: 'recognitionStatusChanged',
      isListening: true
    });
    
    this.showNotification('Listening for commands...', 'info');
    
    if (this.modal) {
      this.syncWaveAnimationWithState();
    }
    
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
  }
  
  handleRecognitionResult(event) {
    console.log('handleRecognitionResult fired', event);
    console.log('Results received:', event.results);
    
    if (this.recognitionTimeout) clearTimeout(this.recognitionTimeout);
    
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
        this.cumulativeTranscript += (this.cumulativeTranscript ? ' ' : '') + transcript.trim();
        console.log('Cumulative transcript so far:', this.cumulativeTranscript);
        
        chrome.runtime.sendMessage({
          action: 'transcriptUpdated',
          transcript: transcript.trim(),
          isFinal: true
        });
      } else {
        interimTranscript += transcript;
        console.log('Interim transcript:', interimTranscript);
        
        chrome.runtime.sendMessage({
          action: 'transcriptUpdated',
          transcript: interimTranscript,
          isFinal: false
        });
        
        if (this.modalTranscript) {
          this.addToModalTranscript(interimTranscript, true, false);
        }
      }
    }
  }
  
  handleRecognitionError(event) {
    console.error('Speech recognition error:', event.error);
    
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
    
    if (this.modalTranscript) {
      this.addToModalTranscript(`Error: ${errorMessage}`, false, true);
    }
    
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
      try {
        this.recognition.start();
      } catch (e) {
        console.error('Error restarting recognition:', e);
        this.stopSpeechRecognition();
      }
    } else {
      chrome.runtime.sendMessage({
        action: 'recognitionStatusChanged',
        isListening: false
      });
      
      if (this.modal) {
        this.syncWaveAnimationWithState();
        if (this.modalTranscript) {
          this.addToModalTranscript('Stopped listening', false, true);
        }
      }
    }
  }
  
  startSpeechRecognition() {
    if (!this.initSpeechRecognition()) return;
    
    if (this.currentState.isListening) {
      console.log('Already listening, not starting again');
      return;
    }
    
    try {
      console.log('Starting speech recognition in content script');
      this.currentState.isListening = true;
      this.recognition.start();
      
      if (this.listenButton) {
        this.listenButton.textContent = 'Stop Listening';
        this.listenButton.style.backgroundColor = '#d32f2f';
      }
      
      if (this.modal) {
        this.syncWaveAnimationWithState();
        if (this.modalTranscript) {
          this.modalTranscript.innerHTML = '';
          const mainColor = this.settings.mainColor || '#4169E1';
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
          helpMessage.innerHTML = `<div style="margin-bottom:10px;">🎤</div>Say a command`;
          this.modalTranscript.appendChild(helpMessage);
        }
      }
      
      return true;
    } catch (e) {
      console.error('Error starting speech recognition:', e);
      this.showNotification('Error starting speech recognition: ' + e.message, 'error');
      this.currentState.isListening = false;
      this.syncWaveAnimationWithState();
      return false;
    }
  }
  
  stopSpeechRecognition() {
    this.currentState.isListening = false;
    
    if (this.recognition) {
      try {
        this.recognition.stop();
        this.recognition = null;
      } catch (e) {
        console.error('Error stopping recognition:', e);
      }
    }
    
    if (this.recognitionTimeout) {
      clearTimeout(this.recognitionTimeout);
      this.recognitionTimeout = null;
    }
    
    if (this.listenButton) {
      this.listenButton.textContent = 'Start Listening';
      this.listenButton.style.backgroundColor = this.settings.mainColor || '#4169E1';
    }
    
    chrome.runtime.sendMessage({
      action: 'recognitionStatusChanged',
      isListening: false
    });
    
    if (this.modal) {
      this.syncWaveAnimationWithState();
      if (this.modalTranscript) {
        this.addToModalTranscript('Stopped listening', false, true);
      }
    }
    
    this.showNotification('Speech recognition stopped', 'info');
  }

  setupNotificationSystem() {
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
    if (!this.settings.showNotifications) return;
    
    const mainColor = this.settings.mainColor || '#4169E1';
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
      default:
        notificationColor = mainColor;
        iconHtml = '<span style="margin-right:8px;">ℹ️</span>';
    }
    
    const notification = document.createElement('div');
    notification.className = `vesper-notification vesper-notification-${type}`;
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
    
    notification.innerHTML = `
      ${iconHtml}<div>
        <strong style="color:${notificationColor};">Vesper:</strong> ${message}
      </div>
    `;
    
    this.notificationContainer.appendChild(notification);
    
    setTimeout(() => {
      notification.style.opacity = '1';
    }, 10);
    
    const duration = (this.settings.notificationDuration || 3) * 1000;
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

  // Generic command notification
  notifyCommandExecuted(command) {
    const commandText = `Executed command: ${command}`;
    
    chrome.runtime.sendMessage({
      action: 'commandExecuted',
      command: commandText
    });
    
    if (this.modalTranscript) {
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
      
      commandDiv.textContent = commandText;
      this.modalTranscript.appendChild(commandDiv);
      
      const container = this.modal.querySelector('.vesper-modal-transcript');
      if (container) container.scrollTop = container.scrollHeight;
    }
  }

  // Generic command processing (fallback)
  processCommand(command) {
    this.lastCommand = command;
    console.log('Processing command:', command);
    this.notifyCommandExecuted(command);
    this.showNotification(`Command executed: ${command}`, 'success');
  }
  
  addToModalTranscript(text, isInterim = false, isSystem = false) {
    if (!this.modalTranscript) return;
    
    const mainColor = this.settings.mainColor || '#4169E1';
    
    const interimElements = this.modalTranscript.querySelectorAll('.vesper-modal-interim');
    interimElements.forEach(el => el.remove());
    
    const helpElement = this.modalTranscript.querySelector('.vesper-modal-help');
    if (helpElement) helpElement.remove();
    
    if (isInterim) {
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
      const systemDiv = document.createElement('div');
      systemDiv.className = 'vesper-modal-system';
      systemDiv.style.cssText = `
        color: #666;
        text-align: center;
        font-size: 12px;
        margin: 8px 0;
        padding: 5px;
      `;
      
      if (text.startsWith('Error:')) systemDiv.style.color = '#d32f2f';
      
      systemDiv.textContent = text;
      this.modalTranscript.appendChild(systemDiv);
    } else {
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
    
    const container = this.modal.querySelector('.vesper-modal-transcript');
    if (container) container.scrollTop = container.scrollHeight;
  }
}

const handler = new VesperCommandHandler();
window.vesperHandler = handler;
console.log('Vesper Agent content script is running...');