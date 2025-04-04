document.addEventListener('DOMContentLoaded', function() {
  const launchButton = document.getElementById('launchButton');
  
  // Simple event listener for the launch button
  launchButton.addEventListener('click', function() {
    launchVesper();
  });
  
  function launchVesper() {
    // Get the active tab (which should be Gmail)
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
      if (tabs.length === 0) {
        console.error('No active tab found');
        alert('Make sure you are on Gmail to use Vesper');
        return;
      }
      
      // Make sure we're on Gmail
      if (!tabs[0].url.includes('mail.google.com')) {
        alert('Vesper only works on Gmail. Please navigate to Gmail first.');
        return;
      }
      
      // Execute script directly in the page context to start recognition
      chrome.scripting.executeScript({
        target: {tabId: tabs[0].id},
        function: function() {
          // This code runs in the context of the page
          if (window.mailAgentHandler) {
            console.log('Starting Vesper voice assistant');
            
            // Update agent name and styling
            window.mailAgentHandler.settings = {
              ...window.mailAgentHandler.settings,
              agentName: 'Vesper',
              mainColor: '#4169E1' // Royal Blue
            };
            
            // Start speech recognition
            window.mailAgentHandler.startSpeechRecognition();
            
            // Create the modal UI if it doesn't exist
            if (!document.querySelector('.mail-agent-modal')) {
              window.mailAgentHandler.createModal();
            }
            return {status: 'started'};
          } else {
            console.error('Vesper handler not found in page');
            return {status: 'error', message: 'Vesper not initialized in Gmail'};
          }
        }
      }, function(results) {
        if (chrome.runtime.lastError) {
          console.error('Error executing script:', chrome.runtime.lastError);
          alert('Could not communicate with Gmail. Try refreshing the page.');
          return;
        }
        
        // Close the popup after launching
        window.close();
      });
    });
  }
}); 