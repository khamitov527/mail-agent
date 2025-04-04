/**
 * Service for communicating with OpenAI API to process voice commands
 * and generate actions based on DOM state and context.
 */
class OpenAIService {
  /**
   * Creates a new OpenAIService
   * @param {string} apiKey - OpenAI API key
   * @param {Object} config - Optional configuration object
   */
  constructor(apiKey, {
    model = 'gpt-4-1106-preview',
    headers = {},
    apiEndpoint = 'https://api.openai.com/v1/chat/completions',
    temperature = 0.2,
    maxTokens = 2048,
    onError = null
  } = {}) {
    this.apiKey = apiKey;
    this.model = model;
    this.headers = headers;
    this.apiEndpoint = apiEndpoint;
    this.temperature = temperature;
    this.maxTokens = maxTokens;
    this.onError = onError;
    
    // Store conversation history to maintain context across sequential calls
    this.conversationHistory = [];
    
    console.log(`OpenAIService initialized with model: ${this.model}`);
  }

  /**
   * Update the OpenAI API key
   * @param {string} apiKey - The new API key to use
   */
  setApiKey(apiKey) {
    this.apiKey = apiKey;
    console.log('API key updated');
  }

  /**
   * Process a voice command with actionable DOM elements
   * @param {string} command - The user's voice command
   * @param {Array} actionableElements - Array of actionable DOM elements
   * @returns {Promise<Object>} - Promise resolving to OpenAI response with actions and context updates
   */
  async processCommand(command, actionableElements) {
    try {
      console.log('Processing command:', command);
      console.log('With actionable elements:', actionableElements);
      
      // Prepare the system message
      const systemMessage = this._generateSystemPrompt('COMMAND');
      
      // Create the user message containing the command and elements
      const userMessage = JSON.stringify({
        command: command,
        elements: actionableElements
      });
      
      // Create or update conversation history
      if (this.conversationHistory.length === 0) {
        // Initialize conversation with system message
        this.conversationHistory = [
          { role: 'system', content: systemMessage }
        ];
      }
      
      // Add user message to history
      this.conversationHistory.push({ role: 'user', content: userMessage });
      
      // Prepare the API request
      const requestBody = {
        model: this.model,
        messages: this.conversationHistory,
        temperature: this.temperature,
        max_tokens: this.maxTokens,
        response_format: { type: 'json_object' }
      };
      
      // Make the API call
      const response = await this._makeApiRequest(requestBody);
      
      // Process and store the assistant's response
      const result = this._processApiResponse(response);
      
      // Add assistant response to history for context
      if (result.rawResponse) {
        this.conversationHistory.push({ 
          role: 'assistant', 
          content: result.rawResponse 
        });
      }
      
      // Keep conversation history to a reasonable size (last 10 messages)
      if (this.conversationHistory.length > 10) {
        // Keep system message and last 9 exchanges
        this.conversationHistory = [
          this.conversationHistory[0],
          ...this.conversationHistory.slice(-9)
        ];
      }
      
      return result;
    } catch (error) {
      console.error('Error processing command:', error);
      
      if (this.onError) {
        this.onError(error);
      }
      
      return {
        error: error.message,
        actions: []
      };
    }
  }
  
  /**
   * Generate the system prompt based on the current state
   * @private
   * @param {string} state - The current state of the state machine
   * @returns {string} - The system prompt
   */
  _generateSystemPrompt(state) {
    // Base system prompt
    let prompt = `You are an AI assistant integrated into a Chrome extension for web browsing automation.

Your task is to help users perform actions on websites via voice commands.
You are currently in state: ${state}.

CAPABILITIES:
- You can analyze the current webpage DOM and identify actionable elements
- You can generate specific actions for the browser extension to execute
- You MUST output valid JSON containing either an 'action' object or an 'actions' array

RESPONSE FORMAT:
You must respond in valid JSON with the following structure:
{
  "action": {
    "type": "click|type|select|clear",
    "elementId": "element_id", // Preferred method if available
    "selector": "css_selector", // Alternative to elementId
    "text": "button_text", // Alternative way to identify elements
    "value": "text_to_type" // Required for type action
  },
  // OR for multiple actions
  "actions": [
    {
      "type": "click",
      "elementId": "element_id"
    },
    {
      "type": "type",
      "elementId": "element_id",
      "value": "text to type"
    }
  ],
  // Optional context updates
  "context": {
    // Any key-value pairs to update in the state machine context
  }
}`;

    // Add state-specific guidance
    switch (state) {
      case 'INIT':
        prompt += `
In the INIT state, you should:
- Understand the user's intent from the prompt
- Identify the first step needed to achieve the goal
- Return actions to navigate to the appropriate starting point`;
        break;
        
      case 'OPEN_COMPOSER':
        prompt += `
In the OPEN_COMPOSER state, you should:
- Look for compose/new/create buttons related to starting a new message/email
- Return a click action on the identified element`;
        break;
        
      case 'FILL_RECIPIENT':
        prompt += `
In the FILL_RECIPIENT state, you should:
- Identify the recipient field (To:, recipient, email address input)
- Return a type action with the recipient's name or email address from context`;
        break;
        
      case 'FILL_BODY':
        prompt += `
In the FILL_BODY state, you should:
- Identify the email body/message textarea
- Return a type action with the message content from context`;
        break;
        
      case 'CONFIRM_SEND':
        prompt += `
In the CONFIRM_SEND state, you should:
- Ask the user to confirm they want to send the message
- Update the context with their confirmation status`;
        break;
        
      case 'SEND_EMAIL':
        prompt += `
In the SEND_EMAIL state, you should:
- Identify the send button
- Return a click action on the send button`;
        break;
        
      case 'DONE':
        prompt += `
In the DONE state, you should:
- Confirm to the user that the task has been completed
- No more actions are needed`;
        break;
        
      default:
        // For any other state
        prompt += `
For the current state, analyze the available UI elements and determine what action would progress toward completing the task stored in the context.`;
    }

    return prompt;
  }
  
  /**
   * Format the user message with all relevant context
   * @private
   * @param {Object} payload - The payload containing state, context and DOM elements
   * @returns {string} - Formatted message for OpenAI
   */
  _formatUserMessage(payload) {
    // Extract the DOM elements and format them
    const formattedElements = JSON.stringify(payload.domElements, null, 2);
    
    // Create the user message
    return `
Current state: ${payload.state}

Task context:
${JSON.stringify(payload.context, null, 2)}

Available elements on the current page:
${formattedElements}

Based on the current state and context, what action(s) should be performed now?
Respond with valid JSON containing the action(s) to execute.`;
  }
  
  /**
   * Make the API request to OpenAI
   * @private
   * @param {Object} requestBody - The request body to send to OpenAI
   * @returns {Promise<Object>} - Promise resolving to OpenAI API response
   */
  async _makeApiRequest(requestBody) {
    const headers = {
      'Content-Type': 'application/json',
      ...this.headers
    };
    
    // Add API key if provided and not in headers
    if (this.apiKey && !headers['Authorization']) {
      headers['Authorization'] = `Bearer ${this.apiKey}`;
    }
    
    try {
      const response = await fetch(this.apiEndpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify(requestBody)
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          `OpenAI API error (${response.status}): ${errorData.error?.message || response.statusText}`
        );
      }
      
      return await response.json();
    } catch (error) {
      console.error('API request failed:', error);
      throw new Error(`API request failed: ${error.message}`);
    }
  }
  
  /**
   * Process the OpenAI API response
   * @private
   * @param {Object} response - The raw API response
   * @returns {Object} - Processed response with actions and context updates
   */
  _processApiResponse(response) {
    try {
      if (!response.choices || response.choices.length === 0) {
        throw new Error('Invalid API response: No choices returned');
      }
      
      const rawContent = response.choices[0].message.content;
      
      // Try to parse the JSON response
      let parsedResponse;
      try {
        parsedResponse = JSON.parse(rawContent);
      } catch (jsonError) {
        console.error('Failed to parse OpenAI response as JSON:', jsonError);
        
        // Try to extract JSON from the response if it contains other text
        const jsonMatch = rawContent.match(/```json\s*([\s\S]*?)\s*```|(\{[\s\S]*\})/);
        if (jsonMatch && (jsonMatch[1] || jsonMatch[2])) {
          const jsonText = jsonMatch[1] || jsonMatch[2];
          try {
            parsedResponse = JSON.parse(jsonText);
          } catch (extractedJsonError) {
            throw new Error('Could not parse JSON from response');
          }
        } else {
          throw new Error('Response is not valid JSON and could not extract JSON from it');
        }
      }
      
      // Normalize the response structure
      const result = {
        rawResponse: rawContent,
        actions: []
      };
      
      // Handle both action and actions fields
      if (parsedResponse.action) {
        result.actions = [parsedResponse.action];
      } else if (Array.isArray(parsedResponse.actions)) {
        result.actions = parsedResponse.actions;
      }
      
      // Include any context updates
      if (parsedResponse.context) {
        result.context = parsedResponse.context;
      }
      
      return result;
    } catch (error) {
      console.error('Error processing API response:', error);
      return {
        error: `Error processing API response: ${error.message}`,
        actions: []
      };
    }
  }
  
  /**
   * Reset the conversation history
   * This can be called when starting a new user session
   */
  resetConversation() {
    this.conversationHistory = [];
    console.log('Conversation history reset');
  }
}

window.OpenAIService = OpenAIService; 