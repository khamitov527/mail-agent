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
    
    // Special case for buttons with text
    if (element.tagName === 'BUTTON' && element.textContent.trim()) {
      return `button:contains("${element.textContent.trim()}")`;
    }
    
    // For links with text
    if (element.tagName === 'A' && element.textContent.trim()) {
      return `a:contains("${element.textContent.trim()}")`;
    }
    
    // For elements with role
    if (element.getAttribute('role')) {
      return `[role="${element.getAttribute('role')}"]`;
    }
    
    // Fallback to more complex selector
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
   * @returns {Boolean} Success status
   */
  static executeAction(selector, action, value = null) {
    console.log(`Looking for element with selector: "${selector}"`);
    const element = document.querySelector(selector);
    
    if (!element) {
      console.error(`Element not found with selector: ${selector}`);
      return false;
    }
    
    console.log(`Found element:`, {
      tagName: element.tagName,
      id: element.id,
      classes: Array.from(element.classList),
      text: element.textContent?.trim().substring(0, 50),
      isVisible: this.isElementVisible(element)
    });
    
    try {
      switch (action) {
        case 'click':
          console.log('Performing click action');
          element.click();
          break;
        case 'input':
          console.log(`Performing input action with value: "${value}"`);
          if (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA') {
            element.value = value;
            // Dispatch input event to trigger any listeners
            element.dispatchEvent(new Event('input', { bubbles: true }));
          }
          break;
        case 'select':
          console.log(`Performing select action with value: "${value}"`);
          if (element.tagName === 'SELECT') {
            element.value = value;
            element.dispatchEvent(new Event('change', { bubbles: true }));
          }
          break;
        default:
          console.error(`Unsupported action: ${action}`);
          return false;
      }
      console.log(`Action "${action}" executed successfully`);
      return true;
    } catch (error) {
      console.error(`Error executing action ${action} on ${selector}:`, error);
      return false;
    }
  }
}

// Export the class for use in other modules
window.DOMParser = DOMParser; 