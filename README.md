# Mail Agent - Voice-Controlled Gmail Extension

A Chrome extension that allows you to compose and send emails in Gmail using voice commands.

## Features

- **Voice-activated email composition**: Speak commands to create and send emails without typing
- **Simple command recognition**: Uses keyword matching to understand your intent
- **Gmail integration**: Works directly with Gmail's interface

## Installation

### Development Mode

1. Clone this repository or download it as a ZIP file
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable "Developer mode" by toggling the switch in the top-right corner
4. Click "Load unpacked" and select the directory containing the extension files
5. The Mail Agent extension should now appear in your extensions list

## Voice Commands

The extension recognizes the following voice commands:

### Compose Actions
- "Compose email to [name/email]"
- "New email to [name/email]"
- "Send email to [name/email]"
- "Write message to [name/email]"

### Subject Line
- "Subject: [your subject line]"
- "Subject is [your subject line]"
- "Add subject: [your subject line]"

### Email Body
- "Say: [your message content]"
- "Message body: [your message content]"
- "Body says: [your message content]"

### Send Command
- "Send"
- "Send the email"
- "Okay, send it"
- "Go ahead and send"

### Cancel Command
- "Cancel"
- "Nevermind"
- "Discard email"

## Usage

1. Navigate to Gmail in Chrome
2. Click the Mail Agent extension icon in your toolbar
3. Click "Start Listening" to begin voice recognition
4. Speak your commands clearly (the transcript will show what was recognized)
5. Click "Stop Listening" when you're done

## Limitations

- Works only on Gmail in Chrome
- Requires microphone access
- Simple keyword matching (not natural language processing)
- May require adjustments as Gmail's interface changes

## Privacy

Mail Agent processes all voice recognition locally in your browser using Chrome's built-in speech recognition. No voice data is sent to any server except through Chrome's speech recognition service.

## License

MIT 