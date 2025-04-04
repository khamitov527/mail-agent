/**
 * DOM Parser for Voice Command Chrome Extension
 * Finds all interactive elements in the page and prepares them to be sent with the voice prompt to OpenAI.
 */

class DOMParser {
  /**
   * Get all interactive elements on the page
   * @returns {Array} Array of element objects with extracted attributes
   */
  static getInteractiveElements() {
    // Define common selectors for interactive elements.
    const selectors = [
      'button',
      'a[href]',
      'input:not([type="hidden"])',
      '[role="button"]',
      '[role="link"]',
      'select',
      'textarea',
      '[tabindex]:not([tabindex="-1"])',
      '[contenteditable="true"]'
    ];
    let elements = Array.from(document.querySelectorAll(selectors.join(',')));

    // Filter elements that are not visible.
    elements = elements.filter(el => {
      const style = window.getComputedStyle(el);
      return el.offsetParent !== null && style.visibility !== 'hidden' && style.display !== 'none';
    });

    // Map the elements to an object containing useful attributes.
    return elements.map((el, index) => ({
      element: el,
      index,
      tag: el.tagName.toLowerCase(),
      role: el.getAttribute('role'),
      ariaLabel: el.getAttribute('aria-label'),
      innerText: el.innerText.trim(),
      title: el.getAttribute('title'),
      placeholder: el.getAttribute('placeholder'),
      classList: el.className,
      id: el.id,
      name: el.getAttribute('name'),
      href: el.getAttribute('href'),
      selector: this.generateUniqueSelector(el)
    }));
  }
  
  /**
   * Finds the first element matching the given role and partial name.
   * @param {string} role - The semantic role (e.g., "button", "link").
   * @param {string} name - The text or label to match.
   * @returns {HTMLElement|null} - The matched element or null if not found.
   */
  static findElementByRoleAndName(role, name) {
    const candidates = this.getInteractiveElements();
    // Filter by role (either from the role attribute or inferred from tag names).
    const matches = candidates.filter(candidate => {
      if (candidate.role) {
        return candidate.role.toLowerCase() === role.toLowerCase();
      } else {
        // Fallback based on tag names.
        if (role.toLowerCase() === 'button' && candidate.tag.toLowerCase() === 'button') return true;
        if (role.toLowerCase() === 'link' && candidate.tag.toLowerCase() === 'a') return true;
        if (role.toLowerCase() === 'input' && candidate.tag.toLowerCase() === 'input') return true;
        if (role.toLowerCase() === 'select' && candidate.tag.toLowerCase() === 'select') return true;
        if (role.toLowerCase() === 'textarea' && candidate.tag.toLowerCase() === 'textarea') return true;
      }
      return false;
    });

    // Further filter by checking if any text attributes include the provided name.
    const textMatches = matches.filter(candidate => {
      const combinedText = [candidate.ariaLabel, candidate.title, candidate.innerText, candidate.placeholder]
        .filter(Boolean)
        .join(' ');
      return combinedText.toLowerCase().includes(name.toLowerCase());
    });

    return textMatches.length > 0 ? textMatches[0].element : null;
  }
  
  /**
   * Generate a specific CSS selector for an element
   * @param {Element} element - DOM element
   * @returns {String} CSS selector string
   */
  static generateUniqueSelector(element) {
    // Try using ID if available
    if (element.id) {
      return `#${element.id}`;
    }
    
    // For inputs with name attributes
    if (element.name && (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA' || element.tagName === 'SELECT')) {
      return `${element.tagName.toLowerCase()}[name="${element.name}"]`;
    }
    
    // For elements with type attributes (inputs)
    if (element.type && (element.tagName === 'INPUT')) {
      if (element.placeholder) {
        return `input[type="${element.type}"][placeholder="${element.placeholder}"]`;
      }
      return `input[type="${element.type}"]`;
    }
    
    // For buttons with text
    if ((element.tagName === 'BUTTON' || element.getAttribute('role') === 'button') && element.textContent.trim()) {
      // Instead of using :contains, we'll create a data attribute selector
      // and let our executeAction method handle finding by text
      return `${element.tagName.toLowerCase()}`;
    }
    
    // For links with text
    if (element.tagName === 'A' && element.textContent.trim()) {
      // Instead of using :contains, we'll create a simple tag selector
      // and let our executeAction method handle finding by text
      return `a`;
    }
    
    // For elements with aria attributes
    if (element.getAttribute('aria-label')) {
      return `[aria-label="${element.getAttribute('aria-label')}"]`;
    }
    
    // For elements with role
    if (element.getAttribute('role')) {
      return `[role="${element.getAttribute('role')}"]`;
    }
    
    // For elements with title
    if (element.getAttribute('title')) {
      return `[title="${element.getAttribute('title')}"]`;
    }
    
    // For elements with specific classes that might be useful
    if (element.classList.length > 0) {
      // Check if there's a non-generated class (no numbers or very long hashes)
      const usefulClasses = Array.from(element.classList).filter(cls => 
        !cls.match(/^\d/) && // Doesn't start with a number
        !cls.match(/^[a-z0-9]{8,}$/i) && // Not a hash-like class
        cls.length < 30 // Not too long
      );
      
      if (usefulClasses.length > 0) {
        return `.${usefulClasses.join('.')}`;
      }
    }
    
    // Fallback to tag name with all classes, even if not ideal
    let selector = element.tagName.toLowerCase();
    if (element.classList.length > 0) {
      selector += `.${Array.from(element.classList).join('.')}`;
    }
    
    return selector;
  }
  
  /**
   * Check if an element is visible in the viewport
   * @param {Element} element - DOM element
   * @returns {Boolean} True if element is visible
   */
  static isElementVisible(element) {
    const style = window.getComputedStyle(element);
    return style.display !== 'none' && 
           style.visibility !== 'hidden' && 
           style.opacity !== '0' &&
           element.offsetWidth > 0 &&
           element.offsetHeight > 0;
  }
  
  /**
   * Format interactive elements for sending with prompt to OpenAI
   * @param {String} prompt - The user's voice prompt
   * @returns {Object} Formatted data with prompt and actionable elements
   */
  static formatPromptWithElements(prompt) {
    const elements = this.getInteractiveElements();
    
    return {
      prompt,
      actionElements: elements,
      timestamp: new Date().toISOString(),
      url: window.location.href,
      pageTitle: document.title
    };
  }
  
  /**
   * Execute an action on a DOM element based on selector
   * @param {String} selector - CSS selector for the element
   * @param {String} action - Action to perform (click, input, etc.)
   * @param {String} value - Value to use for input actions
   * @param {Number} index - Optional index if multiple elements match selector
   * @param {String} role - Optional role for finding by role and name
   * @param {String} name - Optional name for finding by role and name
   * @returns {Boolean} Success status
   */
  static executeAction(selector, action, value = null, index = null, role = null, name = null) {
    console.log(`Looking for element with selector: "${selector}"${role ? `, role: "${role}"` : ''}${name ? `, name: "${name}"` : ''}`);
    
    let element = null;
    
    // Try finding element by role and name if provided
    if (role && name) {
      console.log(`Attempting to find element by role: "${role}" and name: "${name}"`);
      element = this.findElementByRoleAndName(role, name);
      if (element) {
        console.log('Element found using role and name match');
      }
    }
    
    // If element wasn't found by role and name, try regular selector methods
    if (!element) {
      // Handle custom selectors that OpenAI might generate but aren't valid CSS
      if (selector && selector.includes(':contains(')) {
        console.log('Detected custom :contains() selector, using alternative approach');
        try {
          // Extract the tag name and the text to search for
          const tagMatch = selector.match(/^([a-z]+):contains\("(.+)"\)$/i);
          if (tagMatch) {
            const [_, tagName, searchText] = tagMatch;
            // Find all elements of that tag type
            const elements = document.querySelectorAll(tagName);
            // Filter to find the one containing the text
            const matchingElements = Array.from(elements).filter(el => 
              el.textContent.trim().includes(searchText));
            
            console.log(`Found ${matchingElements.length} elements containing "${searchText}"`);
            
            if (matchingElements.length > 0) {
              // If index is provided use it, otherwise use the first match
              if (index !== null && index !== undefined && index < matchingElements.length) {
                element = matchingElements[index];
              } else {
                element = matchingElements[0];
              }
            }
          }
        } catch (error) {
          console.error('Error parsing custom selector:', error);
        }
      }
      
      // If we haven't found a specific element yet, try the normal selector
      if (!element && selector) {
        try {
          // If index is provided, get the element at that specific index
          if (index !== null && index !== undefined) {
            console.log(`Looking for element at index ${index} of all matches`);
            const allMatches = document.querySelectorAll(selector);
            console.log(`Found ${allMatches.length} matching elements`);
            
            if (allMatches.length > index) {
              element = allMatches[index];
            } else {
              console.error(`Index ${index} out of range (found ${allMatches.length} elements)`);
              return {
                success: false,
                error: `Index ${index} out of range (found ${allMatches.length} elements)`
              };
            }
          } else {
            // Otherwise just get the first match
            element = document.querySelector(selector);
          }
        } catch (selectorError) {
          console.error(`Invalid selector: ${selector}`, selectorError);
          return {
            success: false,
            error: `Invalid selector: ${selector}`
          };
        }
      }
    }
    
    if (!element) {
      const errorMsg = `Element not found${selector ? ` with selector: ${selector}` : ''}${role ? `, role: ${role}` : ''}${name ? `, name: ${name}` : ''}${index !== null ? ` at index ${index}` : ''}`;
      console.error(errorMsg);
      return {
        success: false,
        error: errorMsg
      };
    }
    
    console.log(`Found element:`, {
      tagName: element.tagName,
      id: element.id,
      classes: Array.from(element.classList),
      text: element.textContent?.trim().substring(0, 50),
      isVisible: this.isElementVisible(element)
    });
    
    // Save the current state of the page for comparison after the action
    const beforeState = {
      url: window.location.href,
      bodyHTML: document.body.innerHTML.length,
      activeElement: document.activeElement,
      elementRect: element.getBoundingClientRect(),
      scrollTop: window.scrollY,
      dialogCount: document.querySelectorAll('div[role="dialog"]').length,
      modalCount: document.querySelectorAll('.modal, [role="dialog"], [aria-modal="true"]').length,
      timestamp: Date.now()
    };
    
    try {
      switch (action) {
        case 'click':
          console.log('Performing click action');
          
          // First try regular click
          element.click();
          
          // If regular click might not trigger event listeners, use dispatchEvent
          // Create and dispatch MouseEvents for more reliable clicking
          console.log('Dispatching mouse events for more reliable clicking');
          const events = ['mousedown', 'mouseup', 'click'];
          
          events.forEach(eventType => {
            const event = new MouseEvent(eventType, {
              view: window,
              bubbles: true,
              cancelable: true,
              buttons: 1
            });
            element.dispatchEvent(event);
          });
          break;
        case 'input':
          console.log(`Performing input action with value: "${value}"`);
          if (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA') {
            // Clear existing value first
            element.value = '';
            
            // Set the new value
            element.value = value;
            
            // Dispatch multiple events to ensure all listeners capture the input
            ['input', 'change', 'keyup', 'keydown', 'keypress'].forEach(eventType => {
              element.dispatchEvent(new Event(eventType, { bubbles: true }));
            });
            
            // Focus the element to trigger any focus-dependent behavior
            element.focus();
          }
          break;
        case 'select':
          console.log(`Performing select action with value: "${value}"`);
          if (element.tagName === 'SELECT') {
            element.value = value;
            element.dispatchEvent(new Event('change', { bubbles: true }));
            element.focus();
          }
          break;
        default:
          console.error(`Unsupported action: ${action}`);
          return false;
      }
      
      // Wait for possible DOM changes after the action
      return new Promise(resolve => {
        setTimeout(() => {
          // Get state after action
          const afterState = {
            url: window.location.href,
            bodyHTML: document.body.innerHTML.length,
            activeElement: document.activeElement,
            scrollTop: window.scrollY,
            dialogCount: document.querySelectorAll('div[role="dialog"]').length,
            modalCount: document.querySelectorAll('.modal, [role="dialog"], [aria-modal="true"]').length,
            timestamp: Date.now()
          };
          
          // Check if any observable change happened
          const urlChanged = beforeState.url !== afterState.url;
          const contentChanged = Math.abs(beforeState.bodyHTML - afterState.bodyHTML) > 100; // Significant DOM change
          const focusChanged = beforeState.activeElement !== afterState.activeElement;
          const scrollChanged = Math.abs(beforeState.scrollTop - afterState.scrollTop) > 50;
          const dialogChanged = beforeState.dialogCount !== afterState.dialogCount;
          const modalChanged = beforeState.modalCount !== afterState.modalCount;
          const timeElapsed = afterState.timestamp - beforeState.timestamp;
          
          // Log the observed changes
          console.log('Action effect analysis:', {
            urlChanged,
            contentChanged,
            focusChanged,
            scrollChanged,
            dialogChanged,
            modalChanged,
            timeElapsed
          });
          
          const anyVisibleChange = urlChanged || contentChanged || focusChanged || 
                                  scrollChanged || dialogChanged || modalChanged;
          
          if (!anyVisibleChange && action === 'click') {
            console.warn('Click executed but no visible change detected.');
            // Still return true since the action technically succeeded
            return resolve({
              success: true,
              warning: 'Click executed but no visible change detected.',
              possibleReasons: [
                'The click was registered but did not trigger any visible change.',
                'The element might not have the expected listener attached.',
                'The website might require a trusted user event which automated clicks cannot trigger.',
                'The element might be disabled or non-interactive despite appearing clickable.'
              ],
              elementInfo: {
                tagName: element.tagName,
                id: element.id,
                className: element.className,
                textContent: element.textContent?.trim().substring(0, 100) || null
              }
            });
          }
          
          console.log(`Action "${action}" executed successfully with${anyVisibleChange ? '' : 'out'} visible changes`);
          return resolve({
            success: true,
            visibleChange: anyVisibleChange,
            action: action
          });
        }, 500); // Wait 500ms to observe changes
      });
    } catch (error) {
      console.error(`Error executing action ${action} on ${selector}:`, error);
      return Promise.resolve({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Example helper method to click an element by role and name
   * This demonstrates the recommended way to interact with elements
   * @param {String} role - The semantic role (e.g., "button", "link")
   * @param {String} name - The text or label to match
   * @returns {Promise} - Promise resolving to the result of the click action
   */
  static clickByRoleAndName(role, name) {
    console.log(`Looking for ${role} with name "${name}" to click`);
    const element = this.findElementByRoleAndName(role, name);
    
    if (!element) {
      console.error(`No ${role} found with name "${name}"`);
      return Promise.resolve({
        success: false,
        error: `No ${role} found with name "${name}"`
      });
    }
    
    console.log(`Found ${role}:`, {
      tagName: element.tagName,
      id: element.id,
      classes: Array.from(element.classList),
      text: element.textContent?.trim().substring(0, 50)
    });
    
    // Same state comparison logic as in executeAction
    const beforeState = {
      url: window.location.href,
      bodyHTML: document.body.innerHTML.length,
      activeElement: document.activeElement,
      elementRect: element.getBoundingClientRect(),
      scrollTop: window.scrollY,
      dialogCount: document.querySelectorAll('div[role="dialog"]').length,
      modalCount: document.querySelectorAll('.modal, [role="dialog"], [aria-modal="true"]').length,
      timestamp: Date.now()
    };
    
    try {
      // Click the element
      element.click();
      
      // For more reliable clicking, dispatch mouse events
      const events = ['mousedown', 'mouseup', 'click'];
      events.forEach(eventType => {
        const event = new MouseEvent(eventType, {
          view: window,
          bubbles: true,
          cancelable: true,
          buttons: 1
        });
        element.dispatchEvent(event);
      });
      
      // Wait for possible DOM changes after the action
      return new Promise(resolve => {
        setTimeout(() => {
          // Get state after action
          const afterState = {
            url: window.location.href,
            bodyHTML: document.body.innerHTML.length,
            activeElement: document.activeElement,
            scrollTop: window.scrollY,
            dialogCount: document.querySelectorAll('div[role="dialog"]').length,
            modalCount: document.querySelectorAll('.modal, [role="dialog"], [aria-modal="true"]').length,
            timestamp: Date.now()
          };
          
          // Check if any observable change happened
          const urlChanged = beforeState.url !== afterState.url;
          const contentChanged = Math.abs(beforeState.bodyHTML - afterState.bodyHTML) > 100;
          const focusChanged = beforeState.activeElement !== afterState.activeElement;
          const scrollChanged = Math.abs(beforeState.scrollTop - afterState.scrollTop) > 50;
          const dialogChanged = beforeState.dialogCount !== afterState.dialogCount;
          const modalChanged = beforeState.modalCount !== afterState.modalCount;
          
          const anyVisibleChange = urlChanged || contentChanged || focusChanged || 
                                  scrollChanged || dialogChanged || modalChanged;
          
          if (!anyVisibleChange) {
            console.warn(`Click on ${role} "${name}" executed but no visible change detected.`);
            return resolve({
              success: true,
              warning: `Click on ${role} "${name}" executed but no visible change detected.`,
              possibleReasons: [
                'The click was registered but did not trigger any visible change.',
                'The element might not have the expected listener attached.',
                'The website might require a trusted user event which automated clicks cannot trigger.',
                'The element might be disabled or non-interactive despite appearing clickable.'
              ],
              elementInfo: {
                tagName: element.tagName,
                id: element.id,
                className: element.className,
                textContent: element.textContent?.trim().substring(0, 100) || null
              }
            });
          }
          
          console.log(`Click on ${role} "${name}" executed successfully with visible changes`);
          return resolve({
            success: true,
            visibleChange: true,
            action: 'click'
          });
        }, 500);
      });
    } catch (error) {
      console.error(`Error clicking ${role} "${name}":`, error);
      return Promise.resolve({
        success: false,
        error: error.message
      });
    }
  }
}

// Export the class for use in other modules
window.DOMParser = DOMParser;