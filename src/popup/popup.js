document.addEventListener('DOMContentLoaded', function() {
  const launchButton = document.getElementById('launchButton');
  
  // Simple event listener for the launch button
  launchButton.addEventListener('click', function() {
    launchVoiceAssistant();
  });
  
  function launchVoiceAssistant() {
    // Get the active tab
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
      if (tabs.length === 0) {
        console.error('No active tab found');
        alert('No active tab found. Please try again.');
        return;
      }
      
      // Check if we need to inject the script or just send a message
      chrome.scripting.executeScript({
        target: {tabId: tabs[0].id},
        function: function() {
          // This code runs in the context of the page
          // First check if our handler is already initialized
          if (window.vesperHandler) {
            console.log('Starting voice assistant');
            
            // Update agent name and styling
            window.vesperHandler.settings = {
              ...window.vesperHandler.settings,
              agentName: 'Voice Assistant',
              mainColor: '#4169E1' // Royal Blue
            };
            
            // Create the modal UI if it doesn't exist
            if (!document.querySelector('.vesper-modal')) {
              window.vesperHandler.createModal();
            } else {
              // Make sure the modal is visible
              const modal = document.querySelector('.vesper-modal');
              modal.style.display = 'flex';
            }
            
            return {status: 'started'};
          } else {
            console.error('Voice assistant handler not found in page');
            return {status: 'error', message: 'Voice assistant not initialized on page'};
          }
        }
      }, function(results) {
        if (chrome.runtime.lastError) {
          console.error('Error executing script:', chrome.runtime.lastError);
          alert('Could not start voice assistant. Try refreshing the page.');
          return;
        }
        
        // Close the popup after launching
        window.close();
      });
    });
  }
}); 