// Command handler for Gmail
class GmailCommandHandler {
  constructor() {
    this.setupMessageListeners();
    this.setupNotificationSystem();
    this.settings = {
      showNotifications: true,
      notificationDuration: 3
    };
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
      }
      return true;
    });
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

  processCommand(command) {
    // Convert to lowercase for easier matching
    const lowerCommand = command.toLowerCase();
    
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
    
    console.log('Command not recognized:', command);
    this.showNotification('Command not recognized: ' + command, 'error');
  }
  
  // Command detection methods
  isComposeCommand(cmd) {
    return (
      cmd.startsWith('compose email to') || 
      cmd.startsWith('new email to') || 
      cmd.startsWith('send email to') || 
      cmd.startsWith('write message to')
    );
  }
  
  isSubjectCommand(cmd) {
    return (
      cmd.startsWith('subject:') ||
      cmd.startsWith('subject is') ||
      cmd.startsWith('add subject:')
    );
  }
  
  isBodyCommand(cmd) {
    return (
      cmd.startsWith('say:') ||
      cmd.startsWith('message body:') ||
      cmd.startsWith('body says:')
    );
  }
  
  isSendCommand(cmd) {
    return (
      cmd === 'send' ||
      cmd === 'send the email' ||
      cmd === 'okay send it' ||
      cmd === 'go ahead and send'
    );
  }
  
  isCancelCommand(cmd) {
    return (
      cmd === 'cancel' ||
      cmd === 'nevermind' ||
      cmd === 'discard email'
    );
  }
  
  // Command handler methods
  handleComposeCommand(cmd) {
    // Click the compose button
    const composeButton = document.querySelector('.T-I.T-I-KE.L3');
    if (composeButton) {
      composeButton.click();
      
      // Extract the recipient
      let recipient = '';
      if (cmd.startsWith('compose email to')) {
        recipient = cmd.substring('compose email to'.length).trim();
      } else if (cmd.startsWith('new email to')) {
        recipient = cmd.substring('new email to'.length).trim();
      } else if (cmd.startsWith('send email to')) {
        recipient = cmd.substring('send email to'.length).trim();
      } else if (cmd.startsWith('write message to')) {
        recipient = cmd.substring('write message to'.length).trim();
      }
      
      if (recipient) {
        // Wait for compose window to open
        setTimeout(() => {
          const toField = document.querySelector('input[name="to"]');
          if (toField) {
            toField.value = recipient;
            toField.dispatchEvent(new Event('input', { bubbles: true }));
            toField.dispatchEvent(new Event('change', { bubbles: true }));
            this.showNotification(`Composing email to: ${recipient}`);
          }
        }, 500);
      } else {
        this.showNotification('Composing new email');
      }
    } else {
      console.log('Compose button not found');
      this.showNotification('Compose button not found', 'error');
    }
  }
  
  handleSubjectCommand(cmd) {
    let subject = '';
    if (cmd.startsWith('subject:')) {
      subject = cmd.substring('subject:'.length).trim();
    } else if (cmd.startsWith('subject is')) {
      subject = cmd.substring('subject is'.length).trim();
    } else if (cmd.startsWith('add subject:')) {
      subject = cmd.substring('add subject:'.length).trim();
    }
    
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
      }
    }
  }
  
  handleBodyCommand(cmd) {
    let body = '';
    if (cmd.startsWith('say:')) {
      body = cmd.substring('say:'.length).trim();
    } else if (cmd.startsWith('message body:')) {
      body = cmd.substring('message body:'.length).trim();
    } else if (cmd.startsWith('body says:')) {
      body = cmd.substring('body says:'.length).trim();
    }
    
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
      }
    }
  }
  
  handleSendCommand() {
    // Click the send button
    const sendButton = document.querySelector('div[role="button"][data-tooltip^="Send"]');
    if (sendButton) {
      sendButton.click();
      this.showNotification('Email sent!');
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
      }, 100);
    } else {
      console.log('Discard button not found');
      this.showNotification('Discard button not found. Is a compose window open?', 'error');
    }
  }
}

// Initialize the command handler
const gmailCommandHandler = new GmailCommandHandler();

// Log that the content script is running
console.log('Mail Agent content script is running on Gmail'); 