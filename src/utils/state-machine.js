/**
 * Represents a generic state machine for handling multi-step tasks.
 * It manages state transitions, context persistence, action queuing, and interaction with DOM elements.
 */
class StateMachine {
    /**
     * Creates an instance of the StateMachine.
     * @param {object} config - Configuration object for the state machine.
     * @param {string[]} config.states - An array of possible state names.
     * @param {object} config.transitions - An object mapping current states to next states (e.g., { STATE_A: 'STATE_B' }).
     * @param {string} config.initialState - The starting state of the machine.
     * @param {object} [config.context={}] - The initial context object to be maintained across states.
     * @param {function(string): void} [config.onStateChange] - Optional callback executed when the state changes.
     * @param {function(object): void} [config.onComplete] - Optional callback executed when the machine reaches a final state.
     * @param {number} [config.maxRetries=3] - Maximum number of retries for a failed action within a state.
     * @param {object} config.dependencies - Required external dependencies.
     * @param {object} config.dependencies.domParser - Instance of DOMParser.
     * @param {object} config.dependencies.openaiService - Instance of OpenAIService.
     */
    constructor({
        states,
        transitions,
        initialState,
        context = {},
        onStateChange,
        onComplete,
        maxRetries = 3,
        dependencies,
    }) {
        if (!states || !transitions || !initialState || !dependencies || !dependencies.domParser || !dependencies.openaiService) {
            throw new Error("StateMachine requires states, transitions, initialState, and dependencies (domParser, openaiService).");
        }
        if (!states.includes(initialState)) {
            throw new Error(`Initial state "${initialState}" is not defined in states.`);
        }

        this.states = states;
        this.transitions = transitions;
        this.currentState = initialState;
        this.context = { ...context }; // Clone initial context
        this.onStateChange = onStateChange;
        this.onComplete = onComplete;
        this.maxRetries = maxRetries;
        this.domParser = dependencies.domParser;
        this.openaiService = dependencies.openaiService;

        this.actionQueue = [];
        this.retryCount = 0;
        this.isRunning = false;

        console.log(`StateMachine initialized with initial state: ${initialState}`);
    }

    /**
     * Starts the state machine execution from the initial state.
     */
    start() {
        if (this.isRunning) {
            console.warn("StateMachine is already running.");
            return;
        }
        console.log("StateMachine starting...");
        this.isRunning = true;
        this.retryCount = 0;
        this._enterState(this.currentState);
    }

    /**
     * Stops the state machine execution.
     */
    stop() {
         if (!this.isRunning) {
            console.warn("StateMachine is not running.");
            return;
        }
        console.log("StateMachine stopping...");
        this.isRunning = false;
        this.actionQueue = []; // Clear queue on stop
        this.retryCount = 0;
    }

    /**
     * Updates the machine's context with new values.
     * @param {object} contextUpdate - Object with properties to merge into the context.
     */
    updateContext(contextUpdate) {
        if (contextUpdate && typeof contextUpdate === 'object') {
            this.context = { ...this.context, ...contextUpdate };
            console.log("Context updated:", this.context);
        }
    }

    /**
     * Internal method to handle entering a new state.
     * @param {string} state - The state to enter.
     * @private
     */
    async _enterState(state) {
        if (!this.isRunning) return; // Stop processing if machine was stopped

        console.log(`Entering state: ${state}`);
        this.currentState = state;
        this.retryCount = 0; // Reset retries on state entry
        this.actionQueue = []; // Clear queue for the new state's actions

        if (this.onStateChange) {
            try {
                this.onStateChange(this.currentState);
            } catch (error) {
                console.error(`Error in onStateChange callback for state ${state}:`, error);
                // Decide if we should stop the machine on callback errors
                this.stop();
                return;
            }
        }

        // Check if this is a final state (no transitions out)
        if (!this.transitions[this.currentState]) {
            console.log(`Reached final state: ${this.currentState}`);
             if (this.onComplete) {
                try {
                    this.onComplete(this.context);
                } catch (error) {
                     console.error(`Error in onComplete callback:`, error);
                }
            }
            this.stop();
            return;
        }

        try {
            // 1. Get DOM snapshot
            const domElements = await this.domParser.getActionableElements();

            // 2. Construct Payload
            const payload = {
                state: this.currentState,
                context: this.context, // Send current context
                domElements: domElements,
            };

            // 3. Get action(s) from OpenAI
            const result = await this.openaiService.processCommand(payload);

            // Ensure result.actions is always an array
            const actions = Array.isArray(result?.actions) ? result.actions : (result?.action ? [result.action] : []);

             // Update context if OpenAI provided updates
             if (result?.context) {
                this.context = { ...this.context, ...result.context };
                console.log("Context updated by OpenAI:", this.context);
             }


            if (actions.length === 0) {
                 console.warn(`No actions received from OpenAI for state ${this.currentState}. Attempting transition.`);
                 // If no actions, attempt to transition immediately
                 this._transitionToNextState();
                 return;
            }

            // 4. Enqueue actions
            this.actionQueue.push(...actions);
            console.log(`Actions enqueued for state ${this.currentState}:`, this.actionQueue);

            // 5. Start processing the queue
            this._processActionQueue();

        } catch (error) {
            console.error(`Error during state ${this.currentState} execution:`, error);
            // Optional: Implement more sophisticated error handling or state-specific error states
            this.stop(); // Stop the machine on critical errors during state processing
        }
    }

    /**
     * Internal method to process the action queue sequentially.
     * @private
     */
    async _processActionQueue() {
        if (!this.isRunning) return;

        if (this.actionQueue.length === 0) {
            console.log(`Action queue empty for state ${this.currentState}. Transitioning...`);
            this._transitionToNextState();
            return;
        }

        const action = this.actionQueue.shift(); // Dequeue the next action
        console.log(`Executing action:`, action);

        try {
            const success = await this.domParser.executeAction(action);

            if (success) {
                console.log("Action executed successfully.");
                this.retryCount = 0; // Reset retries on success
                // Process next action or transition if queue is empty
                this._processActionQueue();
            } else {
                console.warn(`Action failed:`, action);
                this._handleActionFailure(action);
            }
        } catch (error) {
            console.error(`Error executing action:`, action, error);
            this._handleActionFailure(action);
        }
    }

     /**
     * Handles the failure of an action execution, including retries.
     * @param {object} failedAction - The action that failed.
     * @private
     */
    _handleActionFailure(failedAction) {
        if (!this.isRunning) return;

        this.retryCount++;
        console.log(`Retrying action (${this.retryCount}/${this.maxRetries})...`);

        if (this.retryCount <= this.maxRetries) {
            // Re-queue the failed action at the front
            this.actionQueue.unshift(failedAction);
            // Optional: Add a small delay before retrying
            setTimeout(() => this._processActionQueue(), 500); // 500ms delay
        } else {
            console.error(`Action failed after ${this.maxRetries} retries. Stopping state machine.`);
            // Optional: Implement a specific error state or notification
             this.stop();
        }
    }


    /**
     * Internal method to transition to the next state based on the transitions map.
     * @private
     */
    _transitionToNextState() {
         if (!this.isRunning) return;

        const nextState = this.transitions[this.currentState];

        if (!nextState) {
             // This case should ideally be handled in _enterState, but double-check
             console.log(`No transition defined for state ${this.currentState}. Reached final state.`);
             if (this.onComplete) {
                 try {
                     this.onComplete(this.context);
                 } catch (error) {
                      console.error(`Error in onComplete callback:`, error);
                 }
             }
             this.stop();
        } else if (!this.states.includes(nextState)) {
            console.error(`Transition target state "${nextState}" is not defined in states. Stopping.`);
            this.stop();
        } else {
             console.log(`Transitioning from ${this.currentState} to ${nextState}`);
            this._enterState(nextState);
        }
    }
}

export default StateMachine; 