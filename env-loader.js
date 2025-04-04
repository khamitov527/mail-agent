/**
 * Environment Variable Loader
 * Loads environment variables from .env file for browser extensions
 */

class EnvLoader {
  constructor() {
    this.env = {};
    this.loaded = false;
  }

  /**
   * Load environment variables from .env file
   * @returns {Promise} - Promise resolving when environment is loaded
   */
  async load() {
    if (this.loaded) return this.env;

    try {
      const response = await fetch(chrome.runtime.getURL('.env'));
      const text = await response.text();
      
      // Parse the .env file content
      const lines = text.split('\n');
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        
        const [key, ...valueParts] = trimmed.split('=');
        if (key && valueParts.length) {
          const value = valueParts.join('='); // Rejoin in case value had = symbols
          this.env[key.trim()] = value.trim();
        }
      }
      
      this.loaded = true;
      return this.env;
    } catch (error) {
      console.error('Failed to load environment variables:', error);
      throw error;
    }
  }

  /**
   * Get an environment variable
   * @param {String} key - Environment variable key
   * @param {String} defaultValue - Default value if key not found
   * @returns {String} - Environment variable value or default
   */
  get(key, defaultValue = null) {
    return this.env[key] || defaultValue;
  }
}

// Export singleton instance
window.envLoader = new EnvLoader();
