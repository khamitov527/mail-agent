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
   * Infers ARIA role from tag name for accessibility
   * @private
   * @param {Element} el - DOM element
   * @returns {string} Inferred role or empty string
   */
  _inferRoleFromTagName(el) {
    // Map common HTML elements to their implicit ARIA roles
    const tagToRoleMap = {
      'a': 'link',
      'button': 'button',
      'input': (() => {
        // Input type determines role
        switch(el.type) {
          case 'button':
          case 'submit':
          case 'reset': return 'button';
          case 'checkbox': return 'checkbox';
          case 'radio': return 'radio';
          case 'range': return 'slider';
          case 'search': return 'searchbox';
          default: return 'textbox';
        }
      })(),
      'textarea': 'textbox',
      'select': 'combobox',
      'table': 'table',
      'th': 'columnheader',
      'tr': 'row',
      'img': 'img',
      'ul': 'list',
      'ol': 'list',
      'li': 'listitem',
      'form': 'form',
      'header': 'banner',
      'nav': 'navigation',
      'main': 'main',
      'footer': 'contentinfo',
      'aside': 'complementary',
      'section': 'region'
    };
    
    return tagToRoleMap[el.tagName.toLowerCase()] || '';
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
        ariaRole: input.getAttribute('role') || this._inferRoleFromTagName(input),
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
        ariaRole: textarea.getAttribute('role') || this._inferRoleFromTagName(textarea),
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
        ariaRole: button.getAttribute('role') || this._inferRoleFromTagName(button),
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
        ariaRole: select.getAttribute('role') || this._inferRoleFromTagName(select),
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
        ariaRole: link.getAttribute('role') || this._inferRoleFromTagName(link),
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
          ariaRole: el.getAttribute('role'),
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
      
      // Prioritize role and name if provided
      if (role && name) {
        // Get elements with explicit role attribute
        let roleElements = Array.from(document.querySelectorAll(`[role="${role}"]`));
        
        // If no elements found with explicit role, try finding elements with implicit role
        if (roleElements.length === 0) {
          // Look for elements with the corresponding tag names that might have this implicit role
          const tagSelectors = this._getTagsWithImplicitRole(role);
          if (tagSelectors) {
            roleElements = Array.from(document.querySelectorAll(tagSelectors));
          }
        }
        
        // Find element with matching name/text
        targetElement = roleElements.find(el => 
          el.textContent.includes(name) || 
          el.value === name ||
          el.getAttribute('name') === name ||
          el.getAttribute('aria-label') === name ||
          el.getAttribute('placeholder') === name
        );
        
        if (!targetElement) {
          // Try fuzzy matching if exact match fails
          targetElement = roleElements.find(el => {
            const elText = el.textContent.toLowerCase();
            const elName = (el.getAttribute('name') || '').toLowerCase();
            const elAriaLabel = (el.getAttribute('aria-label') || '').toLowerCase();
            const elPlaceholder = (el.getAttribute('placeholder') || '').toLowerCase();
            const searchName = name.toLowerCase();
            
            return elText.includes(searchName) || 
                   elName.includes(searchName) || 
                   elAriaLabel.includes(searchName) ||
                   elPlaceholder.includes(searchName);
          });
        }
        
        if (targetElement) {
          console.log(`Found element by role "${role}" and name "${name}"`, targetElement);
        } else {
          console.warn(`No elements found with role "${role}" and name "${name}"`);
          
          // If role+name failed, fallback to selector if provided
          if (selector) {
            console.log(`Falling back to selector: ${selector}`);
          } else {
            return { 
              success: false, 
              error: `No elements found with role "${role}" and name "${name}"`,
              possibleReasons: ["Element may not be visible in DOM", "Role or name may be incorrect"] 
            };
          }
        }
      } 
      
      // Find by selector if no element found yet
      if (!targetElement && selector) {
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
      
      // If no element found, return error
      if (!targetElement) {
        return { 
          success: false, 
          error: "Could not find target element",
          possibleReasons: ["Element may not be visible in DOM", "Identifiers (selector/role/name) may be incorrect"] 
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
            className: targetElement.className,
            role: targetElement.getAttribute('role') || this._inferRoleFromTagName(targetElement)
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

  /**
   * Get tag selectors that have the specified implicit role
   * @private
   * @param {string} role - The ARIA role to find matching tags for
   * @returns {string} CSS selector for tags with this implicit role
   */
  _getTagsWithImplicitRole(role) {
    const roleToTagsMap = {
      'button': 'button, input[type="button"], input[type="submit"], input[type="reset"]',
      'link': 'a[href]',
      'textbox': 'input:not([type]), input[type="text"], input[type="email"], input[type="password"], input[type="tel"], input[type="url"], textarea',
      'checkbox': 'input[type="checkbox"]',
      'radio': 'input[type="radio"]',
      'combobox': 'select',
      'slider': 'input[type="range"]',
      'searchbox': 'input[type="search"]',
      'list': 'ul, ol',
      'listitem': 'li',
      'table': 'table',
      'row': 'tr',
      'columnheader': 'th'
    };
    
    return roleToTagsMap[role] || null;
  }
}

window.DOMParser = DOMParser;