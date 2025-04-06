/**
 * Action Executor for Voice Command Chrome Extension
 * Connects DOM parser with OpenAI service and executes actions
 */

class ActionExecutor {
  constructor(apiKey) {
    this.domParser = new window.DOMParser();
    this.openAIService = new window.OpenAIService(apiKey);
    this.isExecuting = false;
    this.maxRetries = 2;
    this.maxTotalFailures = 2;
  }

  /**
   * Set OpenAI API key
   * @param {String} apiKey - OpenAI API key
   */
  setApiKey(apiKey) {
    this.openAIService.setApiKey(apiKey);
  }

  /**
   * Process a voice command using the loop-based approach
   * @param {String} voiceCommand - User's voice command
   * @returns {Promise} - Promise resolving to the result of the action execution
   */
  async processVoiceCommand(voiceCommand) {
    if (this.isExecuting) {
      console.log('Already executing a command, please wait');
      return { success: false, message: 'Already executing a command, please wait' };
    }

    try {
      this.isExecuting = true;
      console.log(`Processing voice command: "${voiceCommand}"`);
      
      // Initialize execution state
      const stepsDone = [];
      let totalFailures = 0;
      let isComplete = false;
      
      // Main execution loop
      while (!isComplete) {
        try {
          // 1. Get current actionable DOM elements
          const domElements = await this.domParser.getActionableElements();
          console.log(`Scraped ${domElements.length} actionable elements from DOM`);
          
          // 2. Send current state to OpenAI
          const openAIResponse = await this.openAIService.processCommand({
            command: voiceCommand,
            stepsDone: stepsDone,
            domElements: domElements
          });
          console.log('OpenAI returned:', JSON.stringify(openAIResponse, null, 2));
          
          // 3. Check if we're done
          if (!openAIResponse.actions || openAIResponse.actions.length === 0) {
            console.log('No more actions to execute, command complete');
            isComplete = true;
            break;
          }
          
          // 4. Execute the next action (only the first one in the array)
          const nextAction = openAIResponse.actions[0];
          console.log('Executing next action:', JSON.stringify(nextAction, null, 2));
          
          // Try to execute the action (with retries)
          let actionSuccess = false;
          let retryCount = 0;
          let actionError = null;
          
          while (retryCount <= this.maxRetries && !actionSuccess) {
            try {
              if (retryCount > 0) {
                console.log(`Retry attempt ${retryCount}/${this.maxRetries}...`);
                // Wait before retrying
                await new Promise(resolve => setTimeout(resolve, 500));
              }
              
              // Execute the action
              const { selector, type, value, index, role, name } = nextAction;
              const result = await this.executeSingleAction(nextAction);
              
              if (result.success) {
                console.log(`Action executed successfully: ${type}`);
                actionSuccess = true;
                
                // Add the action to stepsDone
                stepsDone.push({
                  ...nextAction,
                  timestamp: Date.now(),
                  status: 'success'
                });
                
                // Wait for DOM updates before next iteration
                console.log('Waiting for DOM to update...');
                await this.waitForDomUpdate(nextAction);
              } else {
                actionError = result.error;
                console.error(`Action execution failed: ${result.error}`);
                retryCount++;
              }
            } catch (error) {
              actionError = error.message;
              console.error(`Error during action execution: ${error.message}`);
              retryCount++;
            }
          }
          
          // If all retries failed
          if (!actionSuccess) {
            console.error(`Failed to execute action after ${this.maxRetries} retries`);
            totalFailures++;
            
            // Add the failed action to stepsDone
            stepsDone.push({
              ...nextAction,
              timestamp: Date.now(),
              status: 'failed',
              error: actionError
            });
            
            // Check if we should bail out completely
            if (totalFailures >= this.maxTotalFailures) {
              console.error(`Reached maximum total failures (${this.maxTotalFailures}), stopping execution`);
              isComplete = true;
              break;
            }
          }
        } catch (loopError) {
          console.error('Error in execution loop:', loopError);
          totalFailures++;
          
          if (totalFailures >= this.maxTotalFailures) {
            console.error(`Reached maximum total failures (${this.maxTotalFailures}), stopping execution`);
            isComplete = true;
          }
        }
      }
      
      // Return the final result
      const success = totalFailures < this.maxTotalFailures;
      return {
        success: success,
        message: success 
          ? 'Voice command executed successfully' 
          : 'Voice command execution failed',
        steps: stepsDone,
        totalSteps: stepsDone.length,
        completedSteps: stepsDone.filter(step => step.status === 'success').length,
        failedSteps: stepsDone.filter(step => step.status === 'failed').length
      };
    } catch (error) {
      console.error('Error processing voice command:', error);
      return { success: false, error: error.message };
    } finally {
      this.isExecuting = false;
    }
  }

  /**
   * Execute a single action on a DOM element
   * @param {Object} action - Action to execute
   * @returns {Promise} - Promise resolving to the result of the action
   */
  async executeSingleAction(action) {
    try {
      console.log('Executing action:', JSON.stringify(action, null, 2));
      
      // Handle different action formats
      let selector, type, value, index, role, name;
      
      if (typeof action === 'string') {
        // Simple string action (unlikely but handled for completeness)
        console.log('Processing string action');
        type = action;
      } else if (action.action && typeof action.action === 'object') {
        // Format: { action: { type: 'click', selector: '#some-button', value: null } }
        console.log('Processing nested object action');
        selector = action.action.selector;
        type = action.action.type;
        value = action.action.value;
        index = action.action.index;
        role = action.action.role;
        name = action.action.name;
      } else if (action.action && typeof action.action === 'string') {
        // Format: { action: 'click', selector: '#some-button', value: null }
        console.log('Processing object with action string');
        selector = action.selector;
        type = action.action;
        value = action.value;
        index = action.index;
        role = action.role;
        name = action.name;
      } else {
        // Standard format: { type: 'click', selector: '#some-button', value: null }
        console.log('Processing standard action object');
        selector = action.selector;
        type = action.type;
        value = action.value;
        index = action.index;
        role = action.role;
        name = action.name;
      }
      
      console.log(`Action details - Type: ${type}, Selector: ${selector}, Value: ${value}${index !== undefined ? `, Index: ${index}` : ''}${role ? `, Role: ${role}` : ''}${name ? `, Name: ${name}` : ''}`);
      
      // Required fields check
      if (!type) {
        return {
          success: false,
          error: 'Invalid action: missing type'
        };
      }
      
      // Execute the action on the DOM element
      console.log(`Attempting to execute "${type}"${selector ? ` on selector "${selector}"` : ''}${index !== undefined ? ` at index ${index}` : ''}${role ? ` with role "${role}"` : ''}${name ? ` and name "${name}"` : ''}`);
      const result = await this.domParser.executeAction(selector, type, value, index, role, name);
      
      return result;
    } catch (error) {
      console.error('Error executing action:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Wait for DOM updates between actions
   * @param {Object} lastAction - The action that was just executed
   * @returns {Promise} - Promise resolving after a delay
   */
  waitForDomUpdate(lastAction) {
    // Determine wait time based on the type of action just performed
    let waitTime = 500; // Default delay
    
    if (lastAction) {
      // Different wait times for different action types
      switch (lastAction.type) {
        case 'click':
          // Longer wait after clicks as they often trigger API calls or page changes
          waitTime = 800;
          break;
        case 'type':
          // Shorter wait time for typing actions
          waitTime = 300;
          break;
        case 'select':
          // Medium wait time for selection actions
          waitTime = 600;
          break;
        case 'navigation':
        case 'submit':
          // Much longer wait for navigation or form submission
          waitTime = 1500;
          break;
      }
    }
    
    console.log(`Waiting ${waitTime}ms for DOM updates...`);
    return new Promise(resolve => setTimeout(resolve, waitTime));
  }
}

// Expose ActionExecutor to the window object
window.ActionExecutor = ActionExecutor; 