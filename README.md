# Voice Command Chrome Extension

A general-purpose Chrome extension that uses voice commands to control any website by analyzing the page DOM and using OpenAI to interpret user intent.

## Features

- **Voice Recognition**: Capture voice commands from the user
- **DOM Parsing**: Dynamically identify interactive elements on any webpage
- **OpenAI Integration**: Send voice command and page elements to OpenAI to determine the user's intent
- **Action Execution**: Perform actions on the page based on OpenAI's interpretation
- **Fallback Mechanism**: Falls back to original Gmail-specific commands if OpenAI processing fails

## How It Works

1. The extension listens for voice commands using Chrome's SpeechRecognition API
2. When a command is received, it parses the DOM to find all interactive elements (buttons, links, inputs, etc.)
3. The voice command and interactive elements are sent to OpenAI
4. OpenAI interprets the command and determines which element to interact with and how
5. The extension executes the action on the selected element

## Setup

1. Clone this repository
2. Copy `.env-example` to `.env` and add your OpenAI API key
3. Open Chrome and navigate to `chrome://extensions/`
4. Enable "Developer mode" in the top-right corner
5. Click "Load unpacked" and select the repository folder
6. Click on the extension icon in your toolbar to open the popup

## Usage

1. Navigate to any website
2. Click the extension icon to activate the voice assistant
3. When the listening indicator appears, speak your command
4. The extension will process your command and perform the appropriate action on the page

## Example Commands

- "Click the login button"
- "Fill email field with john@example.com"
- "Scroll down"
- "Submit the form"
- "Open the first search result"

## Technical Details

The extension consists of several key components:

- **DOM Parser**: Identifies interactive elements and creates selectors to access them
- **OpenAI Service**: Communicates with OpenAI to interpret commands
- **Action Executor**: Executes the actions returned by OpenAI
- **UI Components**: Popup and in-page modal for interaction

## Privacy

- Your voice data is processed locally for speech-to-text conversion
- Text commands and page structure are sent to OpenAI for processing
- Your OpenAI API key is stored in a local `.env` file that is excluded from version control

## License

MIT License

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request. 