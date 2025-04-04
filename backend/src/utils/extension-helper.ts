/**
 * Helper functions for the browser extension to communicate with the backend API
 */

/**
 * Process voice input through the backend API
 * @param text The raw transcript from voice input
 * @param apiUrl The base URL of the backend API (defaults to localhost in development)
 * @returns Promise with the processed commands
 */
export async function processVoiceCommand(
  text: string, 
  apiUrl: string = 'http://localhost:3000'
): Promise<{
  original: string;
  corrected: string;
  commands: any[];
}> {
  try {
    const response = await fetch(`${apiUrl}/api/voice-processing`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ rawTranscript: text }),
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Error processing voice command:', error);
    throw error;
  }
}

/**
 * Check if the backend API is available
 * @param apiUrl The base URL of the backend API
 * @returns Promise<boolean> indicating if the API is reachable
 */
export async function checkApiAvailability(
  apiUrl: string = 'http://localhost:3000'
): Promise<boolean> {
  try {
    const response = await fetch(`${apiUrl}/api/test`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    
    return response.ok;
  } catch (error) {
    console.error('API availability check failed:', error);
    return false;
  }
} 