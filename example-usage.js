/**
 * Example usage of the StateMachine class for voice command processing
 * 
 * This example demonstrates how to set up a multi-step workflow for sending an email.
 */

import StateMachine from './state-machine.js';
import DOMParser from './dom-parser.js';
import OpenAIService from './openai-service.js';

// Initialize dependencies
const domParser = new DOMParser();

const openaiService = new OpenAIService({
  // Provide your API key here or via environment variables in your extension
  apiKey: 'YOUR_OPENAI_API_KEY', // Best to load from environment
  model: 'gpt-4-1106-preview',
  temperature: 0.2,
  maxTokens: 2048,
  onError: (error) => {
    console.error('OpenAI service error:', error);
    // Implement any UI feedback for errors here
  }
});

/**
 * Process a voice command using the state machine framework
 * @param {string} voiceCommand - The voice command from the user
 */
function processVoiceCommand(voiceCommand) {
  console.log(`Processing voice command: "${voiceCommand}"`);
  
  // Parse the initial intent from the voice command
  // This could be done with a simpler model or even regex patterns for common tasks
  const intent = parseVoiceCommandIntent(voiceCommand);
  
  if (!intent || !intent.type) {
    console.error('Could not parse intent from voice command');
    return;
  }
  
  // Select the appropriate workflow based on the intent type
  switch (intent.type) {
    case 'EMAIL':
      startEmailWorkflow(intent, voiceCommand);
      break;
    case 'SEARCH':
      startSearchWorkflow(intent, voiceCommand);
      break;
    case 'NAVIGATE':
      startNavigationWorkflow(intent, voiceCommand);
      break;
    default:
      console.error(`Unsupported intent type: ${intent.type}`);
      // Provide feedback to user about unsupported command
  }
}

/**
 * Basic parser for extracting intent from voice commands
 * In a real system, you might use a more sophisticated NLP approach
 * or use OpenAI for this initial parsing step
 * @param {string} command - The voice command
 * @returns {object} The parsed intent
 */
function parseVoiceCommandIntent(command) {
  const lowerCommand = command.toLowerCase();
  
  // Email intent
  if (lowerCommand.includes('send an email') || 
      lowerCommand.includes('write an email') || 
      lowerCommand.includes('compose an email') ||
      lowerCommand.includes('new email')) {
    
    const intent = { type: 'EMAIL' };
    
    // Try to extract recipient
    const recipientMatch = lowerCommand.match(/(?:to|for) ([a-z0-9 ]+)(?:saying|with)/i);
    if (recipientMatch && recipientMatch[1]) {
      intent.recipient = recipientMatch[1].trim();
    }
    
    // Try to extract message content
    const messageMatch = lowerCommand.match(/saying ['"](.+?)['"]|with message ['"](.+?)['"]|with body ['"](.+?)['"]|that says ['"](.+?)['"]/i);
    if (messageMatch) {
      // Find the first non-undefined capturing group
      intent.message = (messageMatch[1] || messageMatch[2] || messageMatch[3] || messageMatch[4]).trim();
    }
    
    return intent;
  }
  
  // Search intent
  if (lowerCommand.includes('search for') || 
      lowerCommand.includes('look up') || 
      lowerCommand.includes('find')) {
    
    const intent = { type: 'SEARCH' };
    
    // Try to extract search query
    const searchMatch = lowerCommand.match(/(?:search for|look up|find) ['"]?([^'"]+?)['"]?(?:$|\son\s|\sin\s)/i);
    if (searchMatch && searchMatch[1]) {
      intent.query = searchMatch[1].trim();
    }
    
    // Try to extract search source
    if (lowerCommand.includes('on google')) {
      intent.source = 'google';
    } else if (lowerCommand.includes('on youtube')) {
      intent.source = 'youtube';
    } else if (lowerCommand.includes('on amazon')) {
      intent.source = 'amazon';
    }
    
    return intent;
  }
  
  // Navigation intent
  if (lowerCommand.includes('go to') || 
      lowerCommand.includes('navigate to') || 
      lowerCommand.includes('open')) {
    
    const intent = { type: 'NAVIGATE' };
    
    // Try to extract destination
    const destinationMatch = lowerCommand.match(/(?:go to|navigate to|open) ([a-z0-9 .]+)/i);
    if (destinationMatch && destinationMatch[1]) {
      intent.destination = destinationMatch[1].trim();
    }
    
    return intent;
  }
  
  // If no specific intent could be determined
  return { 
    type: 'UNKNOWN',
    originalCommand: command
  };
}

/**
 * Start the email workflow based on the parsed intent
 * @param {object} intent - The parsed intent object
 * @param {string} originalCommand - The original voice command
 */
function startEmailWorkflow(intent, originalCommand) {
  console.log('Starting email workflow with intent:', intent);
  
  // Define the email workflow states
  const emailWorkflow = {
    states: ['INIT', 'OPEN_COMPOSER', 'FILL_RECIPIENT', 'FILL_BODY', 'CONFIRM_SEND', 'SEND_EMAIL', 'DONE', 'ERROR'],
    transitions: {
      INIT: 'OPEN_COMPOSER',
      OPEN_COMPOSER: 'FILL_RECIPIENT',
      FILL_RECIPIENT: 'FILL_BODY',
      FILL_BODY: 'CONFIRM_SEND',
      CONFIRM_SEND: 'SEND_EMAIL',
      SEND_EMAIL: 'DONE'
      // No transition from DONE or ERROR (terminal states)
    },
    initialState: 'INIT',
    context: {
      originalCommand,
      intent,
      recipient: intent.recipient || null,
      message: intent.message || null,
      workflow: 'EMAIL'
    },
    dependencies: {
      domParser,
      openaiService
    },
    onStateChange: (state) => {
      console.log(`Email workflow state changed to: ${state}`);
      // Update UI to show current state
      updateWorkflowStateUI(state);
    },
    onComplete: (context) => {
      console.log('Email workflow completed successfully!', context);
      // Show success message to user
      showCompletionMessage('Email sent successfully!');
    },
    maxRetries: 3
  };
  
  // Create and start the state machine
  const machine = new StateMachine(emailWorkflow);
  machine.start();
  
  // Store the machine instance if you need to interact with it later
  // For example, to stop it or update its context
  window.currentWorkflow = machine;
}

/**
 * Start the search workflow based on the parsed intent
 * @param {object} intent - The parsed intent object
 * @param {string} originalCommand - The original voice command
 */
function startSearchWorkflow(intent, originalCommand) {
  console.log('Starting search workflow with intent:', intent);
  
  // Define the search workflow states
  const searchWorkflow = {
    states: ['INIT', 'FIND_SEARCH_BOX', 'ENTER_QUERY', 'SUBMIT_SEARCH', 'DONE', 'ERROR'],
    transitions: {
      INIT: 'FIND_SEARCH_BOX',
      FIND_SEARCH_BOX: 'ENTER_QUERY',
      ENTER_QUERY: 'SUBMIT_SEARCH',
      SUBMIT_SEARCH: 'DONE'
      // No transition from DONE or ERROR (terminal states)
    },
    initialState: 'INIT',
    context: {
      originalCommand,
      intent,
      query: intent.query || null,
      source: intent.source || 'default',
      workflow: 'SEARCH'
    },
    dependencies: {
      domParser,
      openaiService
    },
    onStateChange: (state) => {
      console.log(`Search workflow state changed to: ${state}`);
      updateWorkflowStateUI(state);
    },
    onComplete: (context) => {
      console.log('Search workflow completed successfully!', context);
      showCompletionMessage('Search completed!');
    },
    maxRetries: 3
  };
  
  // Create and start the state machine
  const machine = new StateMachine(searchWorkflow);
  machine.start();
  
  // Store the machine instance if you need to interact with it later
  window.currentWorkflow = machine;
}

/**
 * Start the navigation workflow based on the parsed intent
 * @param {object} intent - The parsed intent object
 * @param {string} originalCommand - The original voice command
 */
function startNavigationWorkflow(intent, originalCommand) {
  console.log('Starting navigation workflow with intent:', intent);
  
  // Define the navigation workflow states
  const navigationWorkflow = {
    states: ['INIT', 'FIND_NAVIGATION_ELEMENT', 'NAVIGATE', 'DONE', 'ERROR'],
    transitions: {
      INIT: 'FIND_NAVIGATION_ELEMENT',
      FIND_NAVIGATION_ELEMENT: 'NAVIGATE',
      NAVIGATE: 'DONE'
      // No transition from DONE or ERROR (terminal states)
    },
    initialState: 'INIT',
    context: {
      originalCommand,
      intent,
      destination: intent.destination || null,
      workflow: 'NAVIGATION'
    },
    dependencies: {
      domParser,
      openaiService
    },
    onStateChange: (state) => {
      console.log(`Navigation workflow state changed to: ${state}`);
      updateWorkflowStateUI(state);
    },
    onComplete: (context) => {
      console.log('Navigation workflow completed successfully!', context);
      showCompletionMessage('Navigation completed!');
    },
    maxRetries: 3
  };
  
  // Create and start the state machine
  const machine = new StateMachine(navigationWorkflow);
  machine.start();
  
  // Store the machine instance if you need to interact with it later
  window.currentWorkflow = machine;
}

/**
 * Update UI to show current workflow state
 * @param {string} state - Current state
 */
function updateWorkflowStateUI(state) {
  // Example implementation - replace with your UI logic
  const statusElement = document.getElementById('workflow-status');
  if (statusElement) {
    statusElement.textContent = `Current state: ${state}`;
    statusElement.classList.remove('error', 'success');
    
    if (state === 'ERROR') {
      statusElement.classList.add('error');
    } else if (state === 'DONE') {
      statusElement.classList.add('success');
    }
  }
}

/**
 * Show completion message to user
 * @param {string} message - Success message to display
 */
function showCompletionMessage(message) {
  // Example implementation - replace with your UI logic
  const statusElement = document.getElementById('workflow-status');
  if (statusElement) {
    statusElement.textContent = message;
    statusElement.classList.add('success');
  }
  
  // You could also use a toast notification or other UI element
  console.log('Task completed:', message);
}

// Export the main processing function
export { processVoiceCommand }; 