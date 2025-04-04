/**
 * DOM Parser for extracting actionable elements from any website
 * and executing actions on them.
 */
class DOMParser {
  /**
   * Creates a new DOMParser instance
   */
  constructor() {
    this.lastSnapshot = null;
    // For simpler element retrieval in executeAction
    this.elementCache = new Map();
  }

  /**
   * Gets actionable elements from the current webpage.
   * This method finds elements that can be interacted with like inputs, buttons, etc.
   * @returns {Promise<Array>} Array of actionable elements with their metadata
   */
  async getActionableElements() {
    console.log("Capturing actionable elements from DOM...");
    
    try {
      // Clear previous cache
      this.elementCache.clear();
      
      // Find all potentially interactive elements
      const actionableElements = this._extractActionableElements();
      
      // Cache elements by their unique ID for later retrieval
      actionableElements.forEach(element => {
        if (element.uniqueId) {
          this.elementCache.set(element.uniqueId, element.domReference);
        }
      });
      
      // Save a snapshot without DOM references for OpenAI
      this.lastSnapshot = actionableElements.map(el => {
        // Create a clean copy without the DOM reference
        const { domReference, ...cleanElement } = el;
        return cleanElement;
      });
      
      return this.lastSnapshot;
    } catch (error) {
      console.error("Error getting actionable elements:", error);
      return [];
    }
  }

  /**
   * Extracts interactive elements from the DOM and formats them for processing
   * @private
   * @returns {Array} Array of element objects with metadata and DOM references
   */
  _extractActionableElements() {
    const elements = [];
    let idCounter = 1;
    
    // Helper function to generate unique IDs
    const generateUniqueId = () => `element_${idCounter++}`;
    
    // Process inputs (text, email, password, etc.)
    this._getElements('input:not([type="hidden"]):not([disabled])').forEach(input => {
      const type = input.type || 'text';
      const uniqueId = generateUniqueId();
      
      elements.push({
        uniqueId,
        type: 'input',
        inputType: type,
        placeholder: input.placeholder || '',
        value: input.value || '',
        name: input.name || '',
        id: input.id || '',
        classes: Array.from(input.classList).join(' '),
        isVisible: this._isElementVisible(input),
        label: this._findLabelForElement(input),
        ariaLabel: input.getAttribute('aria-label') || '',
        domReference: input  // Will be removed before sending to OpenAI
      });
    });
    
    // Process textareas
    this._getElements('textarea:not([disabled])').forEach(textarea => {
      const uniqueId = generateUniqueId();
      
      elements.push({
        uniqueId,
        type: 'textarea',
        placeholder: textarea.placeholder || '',
        value: textarea.value || '',
        name: textarea.name || '',
        id: textarea.id || '',
        classes: Array.from(textarea.classList).join(' '),
        isVisible: this._isElementVisible(textarea),
        label: this._findLabelForElement(textarea),
        ariaLabel: textarea.getAttribute('aria-label') || '',
        domReference: textarea
      });
    });
    
    // Process buttons
    this._getElements('button:not([disabled]), [role="button"]:not([disabled]), input[type="button"]:not([disabled]), input[type="submit"]:not([disabled])').forEach(button => {
      const uniqueId = generateUniqueId();
      
      elements.push({
        uniqueId,
        type: 'button',
        text: button.innerText || button.value || '',
        name: button.name || '',
        id: button.id || '',
        classes: Array.from(button.classList).join(' '),
        isVisible: this._isElementVisible(button),
        ariaLabel: button.getAttribute('aria-label') || '',
        domReference: button
      });
    });
    
    // Process select boxes
    this._getElements('select:not([disabled])').forEach(select => {
      const uniqueId = generateUniqueId();
      
      elements.push({
        uniqueId,
        type: 'select',
        options: Array.from(select.options).map(option => ({ 
          value: option.value, 
          text: option.text,
          selected: option.selected
        })),
        name: select.name || '',
        id: select.id || '',
        classes: Array.from(select.classList).join(' '),
        isVisible: this._isElementVisible(select),
        label: this._findLabelForElement(select),
        ariaLabel: select.getAttribute('aria-label') || '',
        domReference: select
      });
    });
    
    // Process links
    this._getElements('a[href]:not([disabled])').forEach(link => {
      const uniqueId = generateUniqueId();
      
      elements.push({
        uniqueId,
        type: 'link',
        text: link.innerText || '',
        href: link.href || '',
        id: link.id || '',
        classes: Array.from(link.classList).join(' '),
        isVisible: this._isElementVisible(link),
        ariaLabel: link.getAttribute('aria-label') || '',
        domReference: link
      });
    });
    
    // Advanced: add elements with specific ARIA roles (e.g., tabs, menu items)
    this._getElements('[role="tab"], [role="menuitem"], [role="checkbox"], [role="radio"], [role="switch"]').forEach(el => {
      // Only add if not already included (could be a button with role)
      if (!elements.some(existing => existing.domReference === el)) {
        const uniqueId = generateUniqueId();
        
        elements.push({
          uniqueId,
          type: `aria-${el.getAttribute('role')}`,
          text: el.innerText || '',
          id: el.id || '',
          classes: Array.from(el.classList).join(' '),
          isVisible: this._isElementVisible(el),
          ariaLabel: el.getAttribute('aria-label') || '',
          ariaSelected: el.getAttribute('aria-selected') === 'true',
          ariaExpanded: el.getAttribute('aria-expanded') === 'true',
          ariaChecked: el.getAttribute('aria-checked'),
          domReference: el
        });
      }
    });
    
    // Return only visible elements by default
    return elements.filter(el => el.isVisible);
  }
  
  /**
   * Helper method to query elements safely including shadow DOM
   * @private
   * @param {string} selector - CSS selector
   * @returns {Array} Array of DOM elements
   */
  _getElements(selector) {
    const elements = [];
    
    // Get elements from main document
    elements.push(...Array.from(document.querySelectorAll(selector)));
    
    // Try to get elements from shadow DOM
    this._collectElementsFromShadowDOM(document.documentElement, selector, elements);
    
    return elements;
  }
  
  /**
   * Recursively collects elements from shadow DOM
   * @private
   * @param {Element} root - The root element to search from
   * @param {string} selector - CSS selector
   * @param {Array} results - Array to store results
   */
  _collectElementsFromShadowDOM(root, selector, results) {
    // Check if the element has a shadow root
    if (root.shadowRoot) {
      // Add elements from this shadow root
      results.push(...Array.from(root.shadowRoot.querySelectorAll(selector)));
      
      // Recursively check elements inside this shadow root
      Array.from(root.shadowRoot.querySelectorAll('*')).forEach(el => {
        this._collectElementsFromShadowDOM(el, selector, results);
      });
    }
    
    // Check child elements
    Array.from(root.children).forEach(child => {
      this._collectElementsFromShadowDOM(child, selector, results);
    });
  }
  
  /**
   * Determines if an element is visible on the page
   * @private
   * @param {Element} element - DOM element
   * @returns {boolean} Whether the element is visible
   */
  _isElementVisible(element) {
    // Simple visibility check (can be expanded)
    const style = window.getComputedStyle(element);
    return style.display !== 'none' && 
           style.visibility !== 'hidden' && 
           style.opacity !== '0' &&
           element.offsetWidth > 0 && 
           element.offsetHeight > 0;
  }
  
  /**
   * Finds the associated label for an input element
   * @private
   * @param {Element} element - DOM element
   * @returns {string} Label text or empty string
   */
  _findLabelForElement(element) {
    let label = '';
    
    // Check for explicit label (for="id")
    if (element.id) {
      const labelElement = document.querySelector(`label[for="${element.id}"]`);
      if (labelElement) {
        return labelElement.textContent.trim();
      }
    }
    
    // Check for wrapper label
    const parentLabel = element.closest('label');
    if (parentLabel) {
      // Get text excluding the input's own text
      const clone = parentLabel.cloneNode(true);
      const inputs = clone.querySelectorAll('input, select, textarea');
      inputs.forEach(input => input.remove());
      return clone.textContent.trim();
    }
    
    // Check for aria-labelledby
    const labelledBy = element.getAttribute('aria-labelledby');
    if (labelledBy) {
      const ids = labelledBy.split(' ');
      return ids.map(id => {
        const el = document.getElementById(id);
        return el ? el.textContent.trim() : '';
      }).join(' ');
    }
    
    return label;
  }

  /**
   * Executes an action on a DOM element
   * @param {string} selector - CSS selector to find the element
   * @param {string} type - Type of action to execute
   * @param {string} value - Value for the action (e.g., text to type)
   * @param {number} index - Optional index if multiple elements match
   * @param {string} role - Optional ARIA role to identify element
   * @param {string} name - Optional name or text to identify element
   * @returns {Object} - Result with success status and any additional data
   */
  async executeAction(selector, type, value, index, role, name) {
    try {
      console.log(`executeAction called with:`, { selector, type, value, index, role, name });
      
      if (!type) {
        return { success: false, error: "Action type is required" };
      }
      
      // First determine the target element
      let targetElement = null;
      
      // Find by selector
      if (selector) {
        const elements = Array.from(document.querySelectorAll(selector));
        
        if (elements.length === 0) {
          return { 
            success: false, 
            error: `No elements found matching selector: ${selector}`,
            possibleReasons: ["Element may not be visible in DOM", "Selector may be incorrect"] 
          };
        }
        
        // If index is specified, use it
        if (index !== undefined && index >= 0 && index < elements.length) {
          targetElement = elements[index];
        } else {
          // Otherwise use the first element
          targetElement = elements[0];
        }
      } 
      // Find by role and name
      else if (role && name) {
        const roleElements = Array.from(document.querySelectorAll(`[role="${role}"]`));
        targetElement = roleElements.find(el => 
          el.textContent.includes(name) || 
          el.getAttribute('name') === name ||
          el.getAttribute('aria-label') === name
        );
        
        if (!targetElement) {
          return { 
            success: false, 
            error: `No elements found with role "${role}" and name "${name}"`,
            possibleReasons: ["Element may not be visible in DOM", "Role or name may be incorrect"] 
          };
        }
      } else {
        return { 
          success: false, 
          error: "Either selector or role+name must be provided",
          possibleReasons: ["Missing identifier for the element"] 
        };
      }
      
      // Execute the action based on its type
      const actionType = type.toLowerCase();
      let actionResult;
      
      switch (actionType) {
        case 'click':
          actionResult = this._executeClickAction(targetElement);
          break;
          
        case 'type':
        case 'input':
          actionResult = this._executeTypeAction(targetElement, value);
          break;
          
        case 'select':
          actionResult = this._executeSelectAction(targetElement, value);
          break;
          
        case 'clear':
          actionResult = this._executeClearAction(targetElement);
          break;
          
        default:
          return { 
            success: false, 
            error: `Unsupported action type: ${type}`,
            possibleReasons: ["Action type not implemented"] 
          };
      }
      
      if (actionResult) {
        return { 
          success: true, 
          visibleChange: true,
          elementInfo: {
            tagName: targetElement.tagName,
            id: targetElement.id,
            className: targetElement.className
          }
        };
      } else {
        return { 
          success: false, 
          error: `Failed to execute ${type} action`,
          possibleReasons: ["Element may be disabled", "Element may not support the action"]
        };
      }
    } catch (error) {
      console.error("Error executing action:", error);
      return { 
        success: false, 
        error: error.message,
        possibleReasons: ["Unexpected error during execution"]
      };
    }
  }
  
  /**
   * Clicks an element
   * @private
   * @param {Element} element - DOM element to click
   * @returns {boolean} Success status
   */
  _executeClickAction(element) {
    if (!element) return false;
    
    try {
      // First scroll the element into view if needed
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      
      // Trigger events in sequence for max compatibility
      // MouseDown
      const mouseDownEvent = new MouseEvent('mousedown', {
        bubbles: true,
        cancelable: true,
        view: window
      });
      element.dispatchEvent(mouseDownEvent);
      
      // MouseUp
      const mouseUpEvent = new MouseEvent('mouseup', {
        bubbles: true,
        cancelable: true,
        view: window
      });
      element.dispatchEvent(mouseUpEvent);
      
      // Click
      const clickEvent = new MouseEvent('click', {
        bubbles: true,
        cancelable: true,
        view: window
      });
      element.dispatchEvent(clickEvent);
      
      // If the element is a form element, try to trigger change and blur events
      if (element.form) {
        const changeEvent = new Event('change', { bubbles: true });
        element.dispatchEvent(changeEvent);
        
        const blurEvent = new Event('blur', { bubbles: true });
        element.dispatchEvent(blurEvent);
      }
      
      return true;
    } catch (error) {
      console.error("Error clicking element:", error);
      return false;
    }
  }
  
  /**
   * Types text into an input or textarea
   * @private
   * @param {Element} element - DOM element to type into
   * @param {string} value - Text to type
   * @returns {boolean} Success status
   */
  _executeTypeAction(element, value) {
    if (!element || !('value' in element)) return false;
    
    try {
      // Focus the element
      element.focus();
      
      // Clear existing value
      element.value = '';
      
      // Dispatch focus event
      const focusEvent = new Event('focus', { bubbles: true });
      element.dispatchEvent(focusEvent);
      
      // Set the new value
      element.value = value;
      
      // Trigger input event
      const inputEvent = new Event('input', { bubbles: true });
      element.dispatchEvent(inputEvent);
      
      // Trigger change event
      const changeEvent = new Event('change', { bubbles: true });
      element.dispatchEvent(changeEvent);
      
      return true;
    } catch (error) {
      console.error("Error typing into element:", error);
      return false;
    }
  }
  
  /**
   * Selects an option in a select element
   * @private
   * @param {Element} element - Select DOM element
   * @param {string} value - Value to select
   * @returns {boolean} Success status
   */
  _executeSelectAction(element, value) {
    if (!element || element.tagName !== 'SELECT') return false;
    
    try {
      // Try to find the option by value, text, or index
      let found = false;
      
      // Try by value
      for (let i = 0; i < element.options.length; i++) {
        if (
          element.options[i].value === value || 
          element.options[i].textContent.trim() === value
        ) {
          element.selectedIndex = i;
          found = true;
          break;
        }
      }
      
      // If no match found and value is a number, try as index
      if (!found && !isNaN(value)) {
        const index = parseInt(value);
        if (index >= 0 && index < element.options.length) {
          element.selectedIndex = index;
          found = true;
        }
      }
      
      if (found) {
        // Trigger change event
        const changeEvent = new Event('change', { bubbles: true });
        element.dispatchEvent(changeEvent);
        return true;
      }
      
      return false;
    } catch (error) {
      console.error("Error selecting option:", error);
      return false;
    }
  }
  
  /**
   * Clears an input or textarea
   * @private
   * @param {Element} element - DOM element to clear
   * @returns {boolean} Success status
   */
  _executeClearAction(element) {
    if (!element || !('value' in element)) return false;
    
    try {
      // Focus the element
      element.focus();
      
      // Clear the value
      element.value = '';
      
      // Trigger input event
      const inputEvent = new Event('input', { bubbles: true });
      element.dispatchEvent(inputEvent);
      
      // Trigger change event
      const changeEvent = new Event('change', { bubbles: true });
      element.dispatchEvent(changeEvent);
      
      return true;
    } catch (error) {
      console.error("Error clearing element:", error);
      return false;
    }
  }
}

window.DOMParser = DOMParser;