# Voice Email Commands Extension

This Chrome extension allows you to control your email with voice commands, using our Voice Processing Backend to understand and execute commands.

## Features

- **Voice Recognition**: Speak naturally to compose and edit emails
- **Command Detection**: Automatically identifies email commands in your speech
- **Gmail Integration**: Works with Gmail's interface
- **Multiple Commands**: Process multiple commands in a single voice input

## Supported Commands

- **Compose Email**: "compose an email"
- **Add Recipient**: "add [email] as recipient"
- **Set Subject**: "set subject to [subject text]"
- **Add Message**: "add message [message content]"
- **Delete Draft**: "delete this draft"
- **Save and Close**: "save and close"

## Installation

### Prerequisites

1. **Backend Server**: You need to have the Voice Processing Backend running
2. **Chrome Browser**: This extension works with Google Chrome

### Steps

1. **Start the Backend Server**:
   ```bash
   cd backend
   npm run dev
   ```
   This will start the backend at http://localhost:3000

2. **Install the Extension in Chrome**:
   - Open Chrome and go to `chrome://extensions/`
   - Enable "Developer mode" (toggle in top-right)
   - Click "Load unpacked"
   - Select the `public` folder from the backend project

3. **Verify Installation**:
   - The extension icon should appear in your toolbar
   - Click the icon to open the popup
   - The status should show "Connected to backend server" if everything is working

## Usage

1. **Open Gmail**: Navigate to Gmail in your browser
2. **Open the Extension Popup**: Click the extension icon in the toolbar
3. **Start Voice Command**: Click the microphone button and speak your command
4. **Alternative**: Type your command in the text field and click "Process Command"

## Examples

Try these voice commands:

- "Compose an email"
- "Add john@example.com as recipient"
- "Set subject to team meeting agenda"
- "Add message looking forward to our discussion tomorrow"
- "Save and close"

## Troubleshooting

- **Backend Not Connected**: Make sure the backend server is running at http://localhost:3000
- **Commands Not Working**: Check the browser console for errors
- **Voice Recognition Issues**: Try using the text input instead of voice

## Development

### Project Structure

```
public/
├── extension-client.js    # Voice Processing Client library
├── extension-integration.js # Main extension integration logic
├── content-script.js      # Gmail-specific integration
├── background.js          # Extension background script
├── extension-popup.html   # Extension popup UI
├── manifest.json          # Extension manifest
└── icons/                 # Extension icons
```

### Customizing for Other Email Providers

To adapt this extension for other email providers:

1. Modify the selectors in `content-script.js`
2. Update the URL match pattern in `manifest.json`
3. Test thoroughly with the new provider

## License

MIT 