/**
 * OpenAI Service for Voice Command Chrome Extension
 * Handles sending voice commands and DOM context to OpenAI API
 */

class OpenAIService {
  constructor() {
    this.apiKey = null;
    this.endpoint = 'https://api.openai.com/v1/chat/completions';
    this.model = 'gpt-4-turbo';
    this.initialized = false;
  }

  /**
   * Initialize the service with API key from environment
   * @returns {Promise} - Promise resolving when initialization is complete
   */
  async initialize() {
    if (this.initialized) return;
    
    // Load API key from environment
    await window.envLoader.load();
    this.apiKey = window.envLoader.get('OPENAI_API_KEY');
    
    if (!this.apiKey) {
      console.error('OpenAI API key not found in environment');
    }
    
    this.initialized = true;
  }

  /**
   * Set the OpenAI API key
   * @param {String} apiKey - OpenAI API key
   */
  setApiKey(apiKey) {
    this.apiKey = apiKey;
  }

  /**
   * Prepare the payload for OpenAI with voice command and DOM elements
   * @param {String} voiceCommand - User's voice command
   * @param {Array} domElements - Array of interactive DOM elements
   * @returns {Object} - Prepared payload for OpenAI
   */
  preparePayload(voiceCommand, domElements) {
    // Create a system message that explains the context and task
    const systemMessage = {
      role: "system",
      content: `You are an AI assistant that helps users navigate websites through voice commands. 
      The user will provide a voice command, and you need to determine which action to take based on the available 
      interactive elements on the page. You should respond with a JSON object containing the action to perform.`
    };

    // Create a message with the voice command and DOM elements context
    const userMessage = {
      role: "user",
      content: [
        {
          type: "text",
          text: `Voice command: "${voiceCommand}"\n\nAvailable interactive elements on the page:`
        },
        {
          type: "text",
          text: JSON.stringify(domElements, null, 2)
        }
      ]
    };

    // Create the payload for the OpenAI API
    return {
      model: this.model,
      messages: [systemMessage, userMessage],
      response_format: { type: "json_object" },
      temperature: 0.2,
      max_tokens: 1000,
    };
  }

  /**
   * Send the voice command and DOM elements to OpenAI
   * @param {String} voiceCommand - User's voice command
   * @param {Array} domElements - Array of interactive DOM elements
   * @returns {Promise} - Promise resolving to the OpenAI response
   */
  async processCommand(voiceCommand, domElements) {
    await this.initialize();
    
    if (!this.apiKey) {
      throw new Error('OpenAI API key not set. Please set an API key first.');
    }

    try {
      const payload = this.preparePayload(voiceCommand, domElements);
      
      const response = await fetch(this.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`OpenAI API Error: ${errorData.error?.message || response.statusText}`);
      }

      const data = await response.json();
      return this.parseOpenAIResponse(data);
    } catch (error) {
      console.error('Error sending command to OpenAI:', error);
      throw error;
    }
  }

  /**
   * Parse the OpenAI response to extract the action
   * @param {Object} response - Response from OpenAI API
   * @returns {Object} - Parsed action object
   */
  parseOpenAIResponse(response) {
    try {
      // Extract the content from the response
      const content = response.choices[0]?.message?.content;
      
      if (!content) {
        throw new Error('No content found in OpenAI response');
      }

      console.log('Raw response from OpenAI:', content);
      
      // Parse the JSON content
      let actionData;
      try {
        actionData = JSON.parse(content);
        console.log('Parsed action data:', JSON.stringify(actionData, null, 2));
      } catch (e) {
        console.error('Failed to parse OpenAI response as JSON:', content);
        return { action: 'No action', error: 'Invalid JSON response' };
      }
      
      // Validate the action data structure
      if (!actionData) {
        console.warn('Empty action data received');
        return { action: 'No action', error: 'Empty response' };
      }
      
      // Log action structure details
      console.log('Action structure details:');
      if (actionData.action) {
        console.log('- Action property found:', 
          typeof actionData.action === 'string' 
            ? actionData.action 
            : JSON.stringify(actionData.action));
      }
      
      if (actionData.actions) {
        console.log('- Actions array found with', actionData.actions.length, 'items');
        actionData.actions.forEach((action, index) => {
          console.log(`  - Action[${index}]:`, JSON.stringify(action));
        });
      }
      
      // Check for explicit "No action" response
      if (actionData.action === 'No action' || 
          (typeof actionData.action === 'object' && actionData.action.action === 'No action')) {
        console.log('Explicit "No action" response detected');
        return { action: 'No action' };
      }
      
      // Check if we have a valid action structure
      if (!(actionData.action || (actionData.actions && actionData.actions.length > 0))) {
        console.warn('Response does not contain recognized action format:', actionData);
        return { action: 'No action', error: 'No valid action in response' };
      }
      
      console.log('Valid action structure found, returning action data');
      return actionData;
    } catch (error) {
      console.error('Error parsing OpenAI response:', error);
      return { action: 'No action', error: error.message };
    }
  }
}

// Export the service for use in other modules
window.OpenAIService = OpenAIService; 