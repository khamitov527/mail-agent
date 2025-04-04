# State Machine for Voice Command Processing

A generic, reusable state machine with an action queue designed for Chrome extensions to handle multi-step voice commands while preserving context across sequential OpenAI API calls.

## Overview

This system implements a flexible state machine framework that enables complex multi-step interactions with web pages via voice commands. The state machine:

1. Manages state transitions through predefined workflows
2. Preserves context between states
3. Integrates with OpenAI to determine appropriate actions for each state
4. Handles DOM interaction in a website-agnostic way
5. Provides a retry mechanism for failed actions

## Components

### StateMachine

The core component that manages states, transitions, and action execution:

- Customizable states and transitions
- Context persistence across states
- Action queuing and sequential execution
- Retry mechanism for failed actions
- Hooks for state changes and completion

### DOMParser

Handles website DOM interaction:

- Extracts actionable elements from any website
- Finds elements across shadow DOM boundaries
- Executes actions like clicking, typing, and selecting
- Implements different strategies for finding elements (by ID, text, ARIA attributes, etc.)

### OpenAIService

Manages communication with the OpenAI API:

- Formats payloads with current state, context, and DOM snapshot
- Maintains conversation history for better context
- Processes responses into actionable instructions
- Handles error conditions gracefully

## Usage Example

```javascript
import StateMachine from './state-machine.js';
import DOMParser from './dom-parser.js';
import OpenAIService from './openai-service.js';

// Initialize dependencies
const domParser = new DOMParser();
const openaiService = new OpenAIService({
  apiKey: 'YOUR_API_KEY',
  model: 'gpt-4-1106-preview'
});

// Define a workflow (e.g., sending an email)
const emailWorkflow = {
  states: ['INIT', 'OPEN_COMPOSER', 'FILL_RECIPIENT', 'FILL_BODY', 'SEND_EMAIL', 'DONE', 'ERROR'],
  transitions: {
    INIT: 'OPEN_COMPOSER',
    OPEN_COMPOSER: 'FILL_RECIPIENT',
    FILL_RECIPIENT: 'FILL_BODY',
    FILL_BODY: 'SEND_EMAIL',
    SEND_EMAIL: 'DONE'
  },
  initialState: 'INIT',
  context: {
    recipient: 'tony',
    message: 'hey, what\'s up with the dinner?'
  },
  dependencies: {
    domParser,
    openaiService
  },
  onStateChange: (state) => {
    console.log(`State changed to: ${state}`);
  },
  onComplete: (context) => {
    console.log('Workflow completed successfully!', context);
  }
};

// Create and start the state machine
const machine = new StateMachine(emailWorkflow);
machine.start();
```

See `example-usage.js` for more detailed examples including different workflow types.

## State Machine Payload Example

For each state, the state machine sends a payload to OpenAI that looks like:

```json
{
  "state": "FILL_RECIPIENT",
  "context": {
    "recipient": "tony",
    "message": "hey what's up with the dinner?"
  },
  "domElements": [
    {
      "uniqueId": "element_1",
      "type": "input",
      "inputType": "text",
      "placeholder": "To",
      "value": "",
      "name": "to",
      "id": "recipient-field",
      "classes": "input-field recipient",
      "isVisible": true,
      "label": "Recipient",
      "ariaLabel": "Email recipient"
    },
    // ...other elements
  ]
}
```

## OpenAI Response Format

OpenAI should respond with an action or array of actions:

```json
{
  "action": {
    "type": "type",
    "elementId": "element_1",
    "value": "tony@example.com"
  },
  "context": {
    "recipientResolved": true
  }
}
```

Or multiple actions:

```json
{
  "actions": [
    {
      "type": "click",
      "elementId": "element_5"
    },
    {
      "type": "type",
      "elementId": "element_8",
      "value": "Subject line"
    }
  ]
}
```

## Integration in Chrome Extension

To use this framework in a Chrome extension:

1. Include these files in your extension's content scripts
2. Set up appropriate permissions in your manifest.json
3. Initialize the components on page load or when activating voice commands
4. Configure your workflows based on common user tasks

## Extending

You can extend this framework by:

1. Adding new action types to DOMParser
2. Creating custom workflows for different voice commands
3. Enhancing the intent parsing system
4. Adding specialized state handling for specific websites

## License

MIT 