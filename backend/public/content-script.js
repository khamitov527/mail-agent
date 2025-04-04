/**
 * Content Script for Gmail Integration
 * 
 * This script implements the actual email command handlers for Gmail.
 * It uses DOM manipulation to interact with Gmail's interface.
 */

// Create a new instance of the voice processing client
const voiceClient = new VoiceProcessingClient('http://localhost:3000');

// Gmail selectors - updated for current Gmail interface
const GMAIL_SELECTORS = {
  // Updated selectors based on current Gmail UI
  COMPOSE_BUTTON: 'div[role="button"][data-tooltip="Compose"]',
  TO_FIELD: 'input[name="to"]',
  SUBJECT_FIELD: 'input[name="subjectbox"]',
  BODY_FIELD: 'div[role="textbox"][aria-label="Message Body"]',
  DISCARD_BUTTON: 'div[role="button"][data-tooltip^="Discard draft"]',
  CLOSE_BUTTON: 'div[role="button"][data-tooltip^="Save"]'
};

// Wait for an element to be present in the DOM with better error handling
function waitForElement(selector, timeout = 10000) {
  return new Promise((resolve, reject) => {
    // Check if element already exists
    const existingElement = document.querySelector(selector);
    if (existingElement) {
      console.log(`Element found immediately: ${selector}`);
      return resolve(existingElement);
    }
    
    console.log(`Waiting for element: ${selector}`);
    
    // Set up a timeout
    const timeoutId = setTimeout(() => {
      observer.disconnect();
      console.error(`Timeout waiting for element: ${selector}`);
      reject(new Error(`Timeout waiting for element: ${selector}`));
    }, timeout);
    
    // Set up a mutation observer
    const observer = new MutationObserver((mutations, observerInstance) => {
      const element = document.querySelector(selector);
      if (element) {
        observerInstance.disconnect();
        clearTimeout(timeoutId);
        console.log(`Element found via observer: ${selector}`);
        resolve(element);
      }
    });
    
    // Start observing with a broader scope
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['role', 'aria-label', 'data-tooltip']
    });
  });
}

// Fallback function to find elements by alternative selectors
async function findElementByAlternatives(primarySelector, alternativeSelectors) {
  try {
    // Try primary selector first
    return await waitForElement(primarySelector, 3000);
  } catch (error) {
    console.log(`Primary selector failed: ${primarySelector}, trying alternatives...`);
    
    // Try alternatives in sequence
    for (const selector of alternativeSelectors) {
      try {
        return await waitForElement(selector, 2000);
      } catch (fallbackError) {
        console.log(`Alternative selector failed: ${selector}`);
      }
    }
    
    // If all fails, throw error
    throw new Error(`Could not find element with any selector: ${primarySelector} or alternatives`);
  }
}

// Helper function to safely click elements
function safeClick(element) {
  if (!element) {
    console.error('Cannot click null element');
    return false;
  }
  
  try {
    // Try direct click first
    element.click();
    return true;
  } catch (error) {
    console.error('Direct click failed, trying event dispatch', error);
    try {
      // Fallback to dispatching events
      const mouseEvent = new MouseEvent('click', {
        view: window,
        bubbles: true,
        cancelable: true
      });
      element.dispatchEvent(mouseEvent);
      return true;
    } catch (eventError) {
      console.error('Event dispatch failed too', eventError);
      return false;
    }
  }
}

// Register handlers for email operations with improved error handling
function registerEmailHandlers() {
  console.log('Registering email command handlers for Gmail');
  
  // Open email composer
  voiceClient.registerHandler('compose_email', async () => {
    console.log('Command: Opening email composer');
    try {
      const composeButton = await findElementByAlternatives(
        GMAIL_SELECTORS.COMPOSE_BUTTON,
        [
          'div[gh="cm"]', // Alternative selector
          'div.T-I.T-I-KE.L3', // Class-based selector
          'div[role="button"]:not([aria-disabled="true"]):not([style*="display: none"]):not(.hidden)'
        ]
      );
      
      if (safeClick(composeButton)) {
        console.log('Compose button clicked successfully');
      } else {
        console.error('Failed to click compose button');
      }
    } catch (error) {
      console.error('Failed to open composer:', error);
    }
  });
  
  // Add recipient to email
  voiceClient.registerHandler('add_recipient', async (cmd) => {
    console.log('Command: Adding recipient', cmd.recipient);
    try {
      const toField = await findElementByAlternatives(
        GMAIL_SELECTORS.TO_FIELD,
        [
          'input[aria-label*="To"]',
          'input.agP.aFw'
        ]
      );
      
      toField.value = cmd.recipient;
      toField.dispatchEvent(new Event('input', { bubbles: true }));
      toField.dispatchEvent(new Event('change', { bubbles: true }));
      toField.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, cancelable: true, key: 'Tab' }));
      
      console.log('Recipient added');
    } catch (error) {
      console.error('Failed to add recipient:', error);
    }
  });
  
  // Set email subject
  voiceClient.registerHandler('add_subject', async (cmd) => {
    console.log('Command: Setting subject', cmd.subject);
    try {
      const subjectField = await findElementByAlternatives(
        GMAIL_SELECTORS.SUBJECT_FIELD,
        [
          'input[placeholder="Subject"]',
          'input.aoT'
        ]
      );
      
      subjectField.value = cmd.subject;
      subjectField.dispatchEvent(new Event('input', { bubbles: true }));
      subjectField.dispatchEvent(new Event('change', { bubbles: true }));
      
      console.log('Subject set');
    } catch (error) {
      console.error('Failed to set subject:', error);
    }
  });
  
  // Add email message content
  voiceClient.registerHandler('add_message', async (cmd) => {
    console.log('Command: Adding message content', cmd.content);
    try {
      const bodyField = await findElementByAlternatives(
        GMAIL_SELECTORS.BODY_FIELD,
        [
          'div[contenteditable="true"][g_editable="true"]',
          'div.Am.Al.editable'
        ]
      );
      
      bodyField.innerHTML = cmd.content;
      bodyField.dispatchEvent(new Event('input', { bubbles: true }));
      bodyField.dispatchEvent(new Event('change', { bubbles: true }));
      
      console.log('Message content added');
    } catch (error) {
      console.error('Failed to add message content:', error);
    }
  });
  
  // Delete draft email
  voiceClient.registerHandler('delete_draft', async () => {
    console.log('Command: Deleting draft email');
    try {
      const discardButton = await findElementByAlternatives(
        GMAIL_SELECTORS.DISCARD_BUTTON,
        [
          'div.T-I.J-J5-Ji.aoO.T-I-ax7.L3',
          'div[role="button"][aria-label*="Discard"]',
          'div[data-tooltip*="Discard"]'
        ]
      );
      
      if (safeClick(discardButton)) {
        console.log('Draft discarded successfully');
        
        // Handle confirmation dialog if it appears
        try {
          setTimeout(async () => {
            const confirmButton = await waitForElement(
              'div[role="button"][name="ok"]', 
              2000
            );
            safeClick(confirmButton);
            console.log('Discard confirmation clicked');
          }, 500);
        } catch (confirmError) {
          // No confirmation dialog appeared, which is fine
          console.log('No confirmation dialog appeared');
        }
      } else {
        console.error('Failed to click discard button');
      }
    } catch (error) {
      console.error('Failed to discard draft:', error);
    }
  });
  
  // Save and close email
  voiceClient.registerHandler('save_and_close', async () => {
    console.log('Command: Saving draft and closing composer');
    try {
      const closeButton = await findElementByAlternatives(
        GMAIL_SELECTORS.CLOSE_BUTTON,
        [
          'div[aria-label*="Save"]',
          'div[data-tooltip*="Save"]',
          'img[aria-label="Save & close"]',
          'div.T-I.J-J5-Ji.aoO.T-I-ax7.L3[role="button"]'
        ]
      );
      
      if (safeClick(closeButton)) {
        console.log('Draft saved and closed successfully');
      } else {
        console.error('Failed to click save and close button');
      }
    } catch (error) {
      console.error('Failed to save and close:', error);
    }
  });
}

// Process natural language commands
async function processNaturalLanguageCommand(transcript) {
  console.log('Processing natural language command:', transcript);
  
  try {
    // Send to backend for processing
    const response = await fetch('http://localhost:3000/api/voice-processing', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ rawTranscript: transcript }),
    });
    
    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }
    
    const result = await response.json();
    console.log('Natural language processing result:', result);
    
    if (result.commands && result.commands.length > 0) {
      // Process the identified commands
      for (const command of result.commands) {
        const handler = voiceClient.commandHandlers[command.command];
        if (typeof handler === 'function') {
          try {
            await handler(command);
          } catch (error) {
            console.error(`Error executing command ${command.command}:`, error);
          }
        } else {
          console.warn(`No handler registered for command: ${command.command}`);
        }
      }
      return true;
    } else {
      console.log('No commands detected in transcript');
      return false;
    }
  } catch (error) {
    console.error('Error processing natural language command:', error);
    return false;
  }
}

// Function to handle messages from background script or popup
function handleMessage(message, sender, sendResponse) {
  console.log('Content script received message:', message);
  
  if (message.action === 'processVoice' && message.transcript) {
    console.log('Received voice transcript from popup:', message.transcript);
    
    // Process the voice command
    processNaturalLanguageCommand(message.transcript)
      .then(success => {
        sendResponse({ success });
      })
      .catch(error => {
        console.error('Error processing voice command:', error);
        sendResponse({ success: false, error: error.message });
      });
    
    // Return true to indicate we're handling this asynchronously
    return true;
  }
}

// Initialize the content script
function initialize() {
  console.log('Voice Email Commands: Content script loaded for Gmail');
  
  // Register command handlers
  registerEmailHandlers();
  
  // Listen for messages from popup or background script with proper async handling
  chrome.runtime.onMessage.addListener(handleMessage);
  
  // Check if backend is available
  voiceClient.checkApiAvailability()
    .then(available => {
      console.log('Backend available:', available);
      
      // Notify the extension popup that content script is ready
      try {
        chrome.runtime.sendMessage({
          action: 'contentScriptReady',
          backendAvailable: available
        });
      } catch (error) {
        console.error('Failed to send message to extension popup:', error);
      }
    })
    .catch(error => {
      console.error('Failed to check backend availability:', error);
    });
}

// Start the initialization process
initialize(); 