/**
 * Action Executor for Voice Command Chrome Extension
 * Connects DOM parser with OpenAI service and executes actions
 */

class ActionExecutor {
  constructor(apiKey) {
    this.domParser = window.DOMParser;
    this.openAIService = new window.OpenAIService(apiKey);
    this.actionQueue = [];
    this.isExecuting = false;
  }

  /**
   * Set OpenAI API key
   * @param {String} apiKey - OpenAI API key
   */
  setApiKey(apiKey) {
    this.openAIService.setApiKey(apiKey);
  }

  /**
   * Process a voice command by sending it to OpenAI along with DOM elements
   * @param {String} voiceCommand - User's voice command
   * @returns {Promise} - Promise resolving to the result of the action
   */
  async processVoiceCommand(voiceCommand) {
    try {
      console.log(`Processing voice command: "${voiceCommand}"`);
      
      // 1. Get actionable DOM elements (using new lightweight format)
      const actionableElements = this.domParser.getActionableElements();
      console.log(`Found ${actionableElements.length} actionable elements`);
      
      // 2. Send voice command and elements to OpenAI
      const actionPlan = await this.openAIService.processCommand(voiceCommand, actionableElements);
      console.log('OpenAI returned action plan:', JSON.stringify(actionPlan, null, 2));
      
      // 3. Handle "No action" case
      if (actionPlan.action === 'No action' || 
          (actionPlan.actions && actionPlan.actions.length === 0) ||
          (!actionPlan.action && !actionPlan.actions)) {
        console.log('OpenAI found no matching action for the command');
        return { 
          success: true, 
          message: 'No action found for this command',
          action: { action: 'No action' }
        };
      }
      
      // 4. Add actions to the queue
      console.log('Adding actions to queue...');
      this.addActionsToQueue(actionPlan);
      console.log(`Action queue now has ${this.actionQueue.length} actions:`, 
                 JSON.stringify(this.actionQueue, null, 2));
      
      // 5. Start executing the action queue if not already executing
      if (!this.isExecuting && this.actionQueue.length > 0) {
        console.log('Starting execution of action queue...');
        const executionResult = await this.executeActionQueue();
        console.log('Action queue execution completed:', JSON.stringify(executionResult, null, 2));
        
        // Include original action plan in the result
        executionResult.originalAction = actionPlan;
        
        return executionResult;
      } else if (this.actionQueue.length === 0) {
        console.log('No actions were added to the queue');
        return { 
          success: true,
          message: 'No specific actions to execute',
          action: { action: 'No action' }
        };
      }
      
      console.log('Actions queued but not executed (already executing)');
      return { success: true, message: 'Voice command added to queue' };
    } catch (error) {
      console.error('Error processing voice command:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Add actions to the execution queue
   * @param {Object} actionPlan - Plan returned by OpenAI
   */
  addActionsToQueue(actionPlan) {
    console.log('Processing action plan:', JSON.stringify(actionPlan, null, 2));
    
    // Check if the action plan contains a single action or multiple actions
    if (actionPlan.actions && Array.isArray(actionPlan.actions) && actionPlan.actions.length > 0) {
      // Multiple actions
      console.log(`Adding ${actionPlan.actions.length} actions from 'actions' array to queue`);
      this.actionQueue.push(...actionPlan.actions);
    } else if (actionPlan.action && actionPlan.action !== 'No action' && typeof actionPlan.action === 'string') {
      // Single action as string
      console.log(`Adding single action from 'action' string property to queue:`, actionPlan.action);
      this.actionQueue.push(actionPlan);
    } else if (actionPlan.action && typeof actionPlan.action === 'object' && actionPlan.action.type) {
      // Single action as object
      console.log(`Adding single action from 'action' object property to queue:`, JSON.stringify(actionPlan.action, null, 2));
      this.actionQueue.push(actionPlan.action);
    } else {
      console.warn('Received action plan with no recognized actions:', JSON.stringify(actionPlan, null, 2));
    }
  }

  /**
   * Execute the action queue sequentially
   * @returns {Promise} - Promise resolving when all actions are executed
   */
  async executeActionQueue() {
    if (this.isExecuting || this.actionQueue.length === 0) {
      return;
    }

    this.isExecuting = true;
    const results = [];
    
    try {
      while (this.actionQueue.length > 0) {
        const action = this.actionQueue.shift();
        
        // Wait for DOM updates between actions if needed
        if (this.actionQueue.length > 0) {
          await this.waitForDomUpdate();
        }
        
        // Execute the current action
        const actionResult = await this.executeSingleAction(action);
        results.push(actionResult);
        
        // If we have a warning about no visible changes, add it to the overall results
        if (actionResult.warning) {
          console.warn(`Action executed but might not have worked as expected: ${actionResult.warning}`);
        }
      }
      
      // Compile overall execution results
      const anyWarnings = results.some(r => r.warning);
      const allSucceeded = results.every(r => r.success);
      
      return {
        success: allSucceeded,
        message: allSucceeded 
          ? (anyWarnings 
              ? 'Actions executed but some might not have worked as expected'
              : 'Voice command processed successfully')
          : 'Some actions failed to execute',
        results: results,
        warning: anyWarnings ? 'Some actions might not have worked as expected' : null
      };
    } catch (error) {
      console.error('Error executing action queue:', error);
      return {
        success: false,
        error: error.message,
        results: results
      };
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
      
      // Allow actions with just role and name (no selector required)
      if ((!selector && !(role && name)) || !type) {
        throw new Error('Invalid action: missing selector/identifier or type');
      }
      
      // Execute the action on the DOM element
      console.log(`Attempting to execute "${type}"${selector ? ` on selector "${selector}"` : ''}${index !== undefined ? ` at index ${index}` : ''}${role ? ` with role "${role}"` : ''}${name ? ` and name "${name}"` : ''}`);
      const result = await this.domParser.executeAction(selector, type, value, index, role, name);
      
      if (result.success) {
        console.log(`Executed action: ${type}${selector ? ` on ${selector}` : ''}${role ? ` with role "${role}"` : ''}${name ? ` and name "${name}"` : ''} - Success`, result);
        
        // Check for warning about no visible changes
        if (result.warning) {
          console.warn(result.warning);
          console.warn('Possible reasons:', result.possibleReasons);
          
          // Return a more detailed result with the warning
          return {
            success: true,
            action: type,
            selector: selector,
            warning: result.warning,
            possibleReasons: result.possibleReasons,
            elementInfo: result.elementInfo
          };
        }
        
        return {
          success: true,
          action: type,
          selector: selector,
          visibleChange: result.visibleChange
        };
      } else {
        console.error(`Failed to execute action: ${type} on ${selector}`, result.error);
        throw new Error(result.error || 'Unknown error executing action');
      }
    } catch (error) {
      console.error('Error executing action:', error);
      throw error;
    }
  }

  /**
   * Wait for DOM updates between actions
   * @returns {Promise} - Promise resolving after a short delay
   */
  waitForDomUpdate() {
    return new Promise(resolve => setTimeout(resolve, 500));
  }
}

// Export the class for use in other modules
window.ActionExecutor = ActionExecutor; 