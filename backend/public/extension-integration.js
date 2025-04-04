/**
 * Browser Extension Integration Example
 * 
 * This example shows how to integrate the Voice Processing Client
 * into a browser extension for controlling email functionality.
 */

// Reference to the VoiceProcessingClient class
// Note: Make sure to include extension-client.js before this script
// or copy the VoiceProcessingClient class implementation directly here

// Configuration
const BACKEND_URL = 'http://localhost:3000'; // Change to your deployed backend URL in production

// Initialize the voice processing client
const voiceClient = new VoiceProcessingClient(BACKEND_URL);

// Setup command handlers for email operations
function setupCommandHandlers() {
  voiceClient
    .registerHandler('compose_email', () => {
      console.log('Command: Opening email composer');
      // Implementation for your email provider:
      // Gmail example: document.querySelector('.compose-button').click();
    })
    .registerHandler('add_recipient', (cmd) => {
      console.log('Command: Adding recipient', cmd.recipient);
      // Implementation for your email provider:
      // Gmail example: document.querySelector('input[name="to"]').value = cmd.recipient;
    })
    .registerHandler('add_subject', (cmd) => {
      console.log('Command: Setting subject', cmd.subject);
      // Implementation for your email provider:
      // Gmail example: document.querySelector('input[name="subjectbox"]').value = cmd.subject;
    })
    .registerHandler('add_message', (cmd) => {
      console.log('Command: Adding message content', cmd.content);
      // Implementation for your email provider:
      // Gmail example: document.querySelector('div[role="textbox"]').innerHTML = cmd.content;
    })
    .registerHandler('delete_draft', () => {
      console.log('Command: Deleting draft email');
      // Implementation for your email provider:
      // Gmail example: document.querySelector('.discard-button').click();
    })
    .registerHandler('save_and_close', () => {
      console.log('Command: Saving draft and closing composer');
      // Implementation for your email provider:
      // Gmail example: document.querySelector('.save-close-button').click();
    });

  console.log('Voice command handlers registered successfully');
}

// Process voice input
async function handleVoiceInput(transcript) {
  try {
    console.log('Processing voice input:', transcript);
    
    // Check if the backend is available
    const isAvailable = await voiceClient.checkApiAvailability();
    if (!isAvailable) {
      console.error('Backend service not available. Make sure it is running at:', BACKEND_URL);
      return;
    }
    
    // Process the voice transcript
    const result = await voiceClient.processVoice(transcript);
    
    console.log('Voice processing result:', result);
    console.log('Corrected text:', result.corrected);
    console.log('Detected commands:', result.commands);
    
    // Commands are automatically executed by the registered handlers
  } catch (error) {
    console.error('Error processing voice command:', error);
  }
}

// Setup Speech Recognition
function setupSpeechRecognition() {
  if (!('webkitSpeechRecognition' in window)) {
    console.error('Speech recognition not supported in this browser');
    return;
  }

  const recognition = new webkitSpeechRecognition();
  recognition.continuous = false;
  recognition.interimResults = false;
  recognition.lang = 'en-US';

  recognition.onresult = function(event) {
    const transcript = event.results[0][0].transcript;
    console.log('Speech recognized:', transcript);
    handleVoiceInput(transcript);
  };

  recognition.onerror = function(event) {
    console.error('Speech recognition error:', event.error);
  };

  return recognition;
}

// Initialize the extension
function initializeExtension() {
  console.log('Initializing Voice Command Extension...');
  
  // Register command handlers
  setupCommandHandlers();
  
  // Setup speech recognition if needed in your extension context
  const recognition = setupSpeechRecognition();
  
  // Example: Add button to start voice recognition
  // This would be added to your extension's popup or UI
  function addVoiceButton() {
    const button = document.createElement('button');
    button.textContent = '🎤 Voice Command';
    button.addEventListener('click', () => {
      recognition.start();
    });
    
    // Add the button to your extension's UI
    // document.querySelector('#extension-container').appendChild(button);
  }
  
  console.log('Voice Command Extension initialized. Backend URL:', BACKEND_URL);
}

// Initialize when the extension is loaded
document.addEventListener('DOMContentLoaded', initializeExtension);

// Export functions for use in other extension scripts
window.voiceCommandExtension = {
  client: voiceClient,
  processVoice: handleVoiceInput,
  setupCommandHandlers: setupCommandHandlers
};

// Manual test function for the extension popup
function testVoiceCommand(transcript) {
  console.log('Testing voice command:', transcript);
  handleVoiceInput(transcript);
} 