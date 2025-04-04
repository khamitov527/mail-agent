/**
 * Voice Processing Extension Client
 * 
 * A client-side script for connecting a browser extension to the voice processing backend.
 * Include this script in your extension to process voice commands.
 */

class VoiceProcessingClient {
  /**
   * Initialize the voice processing client
   * @param {string} apiUrl - The base URL of the voice processing API
   */
  constructor(apiUrl = 'http://localhost:3000') {
    this.apiUrl = apiUrl;
    this.commandHandlers = {
      compose_email: null,
      add_recipient: null,
      add_subject: null,
      add_message: null,
      delete_draft: null,
      save_and_close: null
    };
    this.lastError = null;
    this.isConnected = false;
    this.retryCount = 0;
    this.maxRetries = 3;
    this.retryDelay = 1000; // 1 second initial delay
  }

  /**
   * Process a voice transcript with retry logic
   * @param {string} transcript - The raw voice transcript
   * @returns {Promise<object>} - The processed result with commands
   */
  async processVoice(transcript) {
    this.lastError = null;
    this.retryCount = 0;
    
    return this._processWithRetry(transcript);
  }
  
  /**
   * Internal method to process voice with retry logic
   */
  async _processWithRetry(transcript) {
    try {
      // Check connectivity first
      if (!this.isConnected) {
        const available = await this.checkApiAvailability();
        if (!available) {
          throw new Error('Backend service is not available. Please make sure it is running.');
        }
      }
      
      // Make the API request
      const response = await fetch(`${this.apiUrl}/api/voice-processing`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ rawTranscript: transcript }),
        // Add timeout to prevent hanging requests
        signal: AbortSignal.timeout(10000) // 10 second timeout
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.status} ${response.statusText}`);
      }

      const result = await response.json();
      
      // Update connected status on success
      this.isConnected = true;
      
      // Auto-execute commands if handlers are defined
      if (result.commands && result.commands.length > 0) {
        await this.executeCommands(result.commands);
      }
      
      return result;
    } catch (error) {
      console.error('Error processing voice input:', error);
      this.lastError = error;
      
      // Check if we should retry
      if (this.retryCount < this.maxRetries) {
        this.retryCount++;
        
        // Exponential backoff 
        const delay = this.retryDelay * Math.pow(2, this.retryCount - 1);
        console.log(`Retrying request (${this.retryCount}/${this.maxRetries}) after ${delay}ms...`);
        
        // Wait before retrying
        await new Promise(resolve => setTimeout(resolve, delay));
        
        // Retry
        return this._processWithRetry(transcript);
      }
      
      // Mark as disconnected if we've exhausted retries
      this.isConnected = false;
      throw error;
    }
  }

  /**
   * Register a handler for a specific command type
   * @param {string} commandType - The type of command
   * @param {Function} handler - The handler function
   */
  registerHandler(commandType, handler) {
    if (typeof handler !== 'function') {
      throw new Error('Handler must be a function');
    }
    
    if (!this.commandHandlers.hasOwnProperty(commandType)) {
      console.warn(`Unknown command type: ${commandType}`);
    }
    
    this.commandHandlers[commandType] = handler;
    return this; // For chaining
  }

  /**
   * Execute commands with the registered handlers
   * @param {Array} commands - The commands to execute
   */
  async executeCommands(commands) {
    if (!Array.isArray(commands)) {
      console.error('Commands must be an array');
      return;
    }
    
    // Process commands sequentially to avoid race conditions
    for (const command of commands) {
      const handler = this.commandHandlers[command.command];
      if (typeof handler === 'function') {
        try {
          // Wait for each handler to complete before processing the next command
          // This prevents issues with multiple commands in sequence
          await Promise.resolve(handler(command));
          console.log(`Command executed successfully: ${command.command}`);
        } catch (error) {
          console.error(`Error executing command ${command.command}:`, error);
        }
      } else {
        console.warn(`No handler registered for command: ${command.command}`);
      }
    }
  }

  /**
   * Check if the backend API is available
   * @returns {Promise<boolean>} - Whether the API is available
   */
  async checkApiAvailability() {
    try {
      console.log('Checking API availability...');
      const response = await fetch(`${this.apiUrl}/api/test`, {
        // Add cache control to prevent cached responses
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        },
        // Add timeout to prevent hanging requests
        signal: AbortSignal.timeout(5000) // 5 second timeout
      });
      
      this.isConnected = response.ok;
      return this.isConnected;
    } catch (error) {
      console.error('API availability check failed:', error);
      this.lastError = error;
      this.isConnected = false;
      return false;
    }
  }
  
  /**
   * Get the last error that occurred
   * @returns {Error|null} The last error or null
   */
  getLastError() {
    return this.lastError;
  }
  
  /**
   * Check if a specific command type has a registered handler
   * @param {string} commandType - The command type to check
   * @returns {boolean} - Whether the command has a handler
   */
  hasHandler(commandType) {
    return typeof this.commandHandlers[commandType] === 'function';
  }
  
  /**
   * Clear all registered handlers
   */
  clearHandlers() {
    Object.keys(this.commandHandlers).forEach(key => {
      this.commandHandlers[key] = null;
    });
  }
}

// Usage example:
/*
const voiceClient = new VoiceProcessingClient('http://localhost:3000');

// Register command handlers
voiceClient.registerHandler('compose_email', () => {
  console.log('Opening email composer');
  // Implementation to open composer
})
.registerHandler('add_recipient', (cmd) => {
  console.log('Adding recipient:', cmd.recipient);
  // Implementation to add recipient
})
.registerHandler('add_subject', (cmd) => {
  console.log('Setting subject:', cmd.subject);
  // Implementation to set subject
})
.registerHandler('add_message', (cmd) => {
  console.log('Adding message:', cmd.content);
  // Implementation to add message
})
.registerHandler('delete_draft', () => {
  console.log('Deleting draft');
  // Implementation to delete draft
})
.registerHandler('save_and_close', () => {
  console.log('Saving and closing');
  // Implementation to save and close
});

// Process voice input
async function handleVoiceInput(transcript) {
  try {
    const result = await voiceClient.processVoice(transcript);
    console.log('Processed voice result:', result);
    // Commands are automatically executed by the registered handlers
  } catch (error) {
    console.error('Failed to process voice input:', error);
  }
}

// Example call
// handleVoiceInput('compose an email to john with subject meeting notes');
*/ 