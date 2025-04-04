# Mail Agent Installation Guide

This guide will help you install and use the Mail Agent Chrome extension for voice-controlled Gmail.

## Installation Steps

1. **Download the Extension**
   - Download this entire folder/repository to your computer

2. **Set Up Your API Key**
   - Copy the `.env-example` file to a new file named `.env`
   - Open the `.env` file in any text editor
   - Replace the example API key with your actual OpenAI API key

3. **Open Chrome Extensions Page**
   - Open Chrome and navigate to `chrome://extensions/`
   - Or click the three-dot menu → More Tools → Extensions

4. **Enable Developer Mode**
   - Toggle on "Developer mode" in the top-right corner of the Extensions page

5. **Load the Extension**
   - Click "Load unpacked"
   - Select the folder containing the Mail Agent extension files
   - You should see "Mail Agent" appear in your extensions list

6. **Pin the Extension (Optional)**
   - Click the puzzle piece icon in Chrome toolbar
   - Find Mail Agent and click the pin icon to keep it visible

## Using Mail Agent

1. **Navigate to Gmail**
   - Go to [https://mail.google.com/](https://mail.google.com/)
   - Make sure you're signed in

2. **Activate the Extension**
   - Click the Mail Agent icon in your browser toolbar
   - A popup will appear with available commands

3. **Start Voice Recognition**
   - Click "Start Listening"
   - Allow microphone access when prompted
   - The indicator will turn green when active

4. **Speak Commands**
   - Try commands like:
     - "Compose email to John"
     - "Subject: Weekly update"
     - "Say: Here's the report you requested"
     - "Send"

5. **Stop Listening**
   - Click "Stop Listening" when finished
   - Or close the popup window

## Troubleshooting

- **Microphone Not Working?**
  - Check Chrome settings → Privacy and Security → Site Settings → Microphone
  - Make sure Gmail has permission to use your microphone

- **Commands Not Recognized?**
  - Speak clearly and use the exact command patterns shown
  - Review the available commands in the popup window

- **Extension Not Working?**
  - Make sure you're on Gmail and signed in
  - Try refreshing the Gmail page
  - Verify your API key is correctly set in the `.env` file
  - Reinstall the extension if necessary

## Privacy Note

Mail Agent processes all voice recognition locally in your browser using Chrome's built-in speech recognition. Your voice data and page structure are sent to OpenAI for command interpretation using the API key you provided in the `.env` file. The API key is stored locally and never shared. 