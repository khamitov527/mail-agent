/**
 * DOM Parser for Voice Command Chrome Extension
 * Finds all interactive elements in the page and prepares them to be sent with the voice prompt to OpenAI.
 */

class DOMParser {
  /**
   * Get all interactive elements on the page using CSS selectors
   * @returns {Array} Array of element data with selectors and relevant attributes
   */
  static getInteractiveElements() {
    // Select all potentially interactive elements
    const elements = document.querySelectorAll(`
      button,
      a[href],
      input:not([type="hidden"]),
      select,
      textarea,
      [tabindex]:not([tabindex="-1"]),
      [role="button"],
      [role="link"],
      [contenteditable="true"]
    `);
    
    // Convert NodeList to Array and map to structured data
    return Array.from(elements).map((element, index) => {
      // Get element attributes and text
      const tagName = element.tagName.toLowerCase();
      const id = element.id;
      const classList = Array.from(element.classList);
      const text = element.textContent?.trim();
      const placeholder = element.placeholder;
      const href = element.href;
      const value = element.value;
      const ariaLabel = element.getAttribute('aria-label');
      const role = element.getAttribute('role');
      const title = element.getAttribute('title');
      const name = element.getAttribute('name');
      
      // Generate a unique selector for this element
      const selector = this.generateUniqueSelector(element);
      
      // Create structured data about this element
      return {
        index,
        selector,
        tagName,
        properties: {
          id: id || undefined,
          classes: classList.length > 0 ? classList : undefined,
          text: text || undefined,
          placeholder: placeholder || undefined,
          href: href || undefined,
          value: value || undefined,
          ariaLabel: ariaLabel || undefined,
          role: role || undefined,
          title: title || undefined,
          name: name || undefined,
          isVisible: this.isElementVisible(element)
        }
      };
    }).filter(el => el.properties.isVisible); // Only include visible elements
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
   * @returns {Boolean} Success status
   */
  static executeAction(selector, action, value = null, index = null) {
    console.log(`Looking for element with selector: "${selector}"`);
    
    let element = null;
    
    // Handle custom selectors that OpenAI might generate but aren't valid CSS
    if (selector.includes(':contains(')) {
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
    if (!element) {
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
            return false;
          }
        } else {
          // Otherwise just get the first match
          element = document.querySelector(selector);
        }
      } catch (selectorError) {
        console.error(`Invalid selector: ${selector}`, selectorError);
        return false;
      }
    }
    
    if (!element) {
      console.error(`Element not found with selector: ${selector}${index !== null ? ` at index ${index}` : ''}`);
      return false;
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
}

// Export the class for use in other modules
window.DOMParser = DOMParser;