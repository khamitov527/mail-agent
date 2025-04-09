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
    model = 'gpt-4o',
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
   * @param {Object} params - Command parameters
   * @param {string} params.command - The user's voice command
   * @param {Array} params.stepsDone - Steps already completed 
   * @param {Array} params.domElements - Array of actionable DOM elements
   * @returns {Promise<Object>} - Promise resolving to OpenAI response with actions and context updates
   */
  async processCommand(params) {
    try {
      // Handle both old and new format
      let command, stepsDone, domElements;
      
      if (typeof params === 'string') {
        // Old format: processCommand(command, actionableElements)
        command = params;
        stepsDone = [];
        domElements = arguments[1] || [];
        console.warn('Using deprecated processCommand format. Please update to the new object parameter format.');
      } else {
        // New format: processCommand({ command, stepsDone, domElements })
        command = params.command;
        stepsDone = params.stepsDone || [];
        domElements = params.domElements || [];
      }
      
      console.log('Processing command:', command);
      console.log('With completed steps:', stepsDone.length);
      console.log('With actionable elements:', domElements.length);
      
      // Prepare the system message
      const systemMessage = this._generateLoopBasedSystemPrompt();
      
      // Create the user message containing the command, steps done, and elements
      const userMessage = JSON.stringify({
        command: command,
        stepsDone: stepsDone,
        elements: domElements
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
   * Generate the system prompt for loop-based action execution
   * @private
   * @returns {string} - The system prompt
   */
  _generateLoopBasedSystemPrompt() {
    return `You are an AI assistant integrated into a Chrome extension for web browsing automation.

Your task is to help users perform actions on websites via voice commands.
You will be receiving:
1. The user's original voice command
2. A list of steps already completed
3. The current DOM state with actionable elements

CAPABILITIES:
- You can analyze the current webpage DOM and identify actionable elements
- You generate ONE action at a time for the browser extension to execute
- After each action execution, you will be called again with updated DOM and steps
- You determine when the task is complete and no more actions are needed

RESPONSE FORMAT:
You must respond in valid JSON with the following structure:
{
  "actions": [
    {
      "type": "click|type|select|clear",
      "selector": "css_selector", // CSS selector to find the element
      "role": "button|textbox|etc", // Optional ARIA role to identify element
      "name": "button_text_or_name", // Optional name, text or label to identify element
      "value": "text_to_type" // Required for type action
    }
  ],
  "reasoning": "Brief explanation of the action chosen",
  "isDone": false // Set to true when the full task is complete
}

GUIDELINES:
1. Return EXACTLY ONE action in the actions array (or empty array if done)
2. Prioritize using role+name for element identification when available
3. Fall back to selectors if needed for complex elements
4. When the full task is complete, return an empty actions array
5. Use a step-by-step approach, don't try to do too much in one action
6. If an element doesn't exist but should (like a popup that hasn't loaded),
   choose a sensible waiting action or try an alternative approach

IMPORTANT NOTES:
- Your response will be parsed as JSON, so it must be valid JSON format
- If no further actions are needed, return an empty actions array
- The actions array should contain at most ONE action at a time
- If you can't complete the task with the available elements, explain why`;
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