# Vesper: Voice Command Browser Automation

Vesper is a Chrome extension that lets you control your browser using voice commands. Initially built as a mail agent (hence some legacy names), it has pivoted to support general browser automation. The extension leverages voice recognition, DOM parsing, and OpenAI-powered command interpretation to execute actions on any website.

---

## Key Features

- **Voice-Activated Control:** Use voice commands to click, type, select, and clear elements on any webpage.
- **AI-Powered Command Processing:** Commands are sent to OpenAI to generate an actionable plan based on the current DOM state.
- **State Machine Workflows:** Supports multi-step tasks (e.g., sending an email, performing searches, navigating) with a robust state machine.
- **Dynamic DOM Parsing:** Scans the webpage for actionable elements (inputs, buttons, links, etc.) and interacts with them reliably.
- **Customizable UI:** Includes a draggable modal for visual feedback and notifications.
- **Contextual Command Handling:** Integrates legacy mail commands while supporting broader browser actions.

---

## Architecture Overview

- **Content Scripts:**  
  - **`action-executor.js`** – Bridges the DOM parser with the OpenAI service, executing actions from voice commands.
  - **`dom-parser.js`** – Extracts actionable DOM elements and provides methods to execute interactions (click, type, etc.).
  - **`env-loader.js`** – Loads environment variables (e.g., your OpenAI API key) from a local `.env` file.
  - **`content.js`** – Sets up the voice command handler (initially for Gmail, now repurposed for broader use).

- **Background & Popup:**  
  - **`background.js`** – Listens for installation and context menu events.
  - **`popup.html` & `popup.js`** – Provides a simple UI to launch the voice assistant.
  
- **State Machine:**  
  - **`state-machine.js`** – Implements a generic state machine to manage multi-step workflows.
  - **Workflow Scripts:** Define specific workflows for tasks such as email composition, search, and navigation.

- **OpenAI Integration:**  
  - **`openai-service.js`** – Handles API calls to OpenAI, manages conversation context, and parses responses into actionable JSON.

---

## Setup & Installation

1. **Clone or Download the Repository.**

2. **Create a `.env` File:**  
   In the extension root, add a `.env` file containing:
   OPENAI_API_KEY=your_openai_api_key_here

This key is used by the OpenAI service for processing voice commands.

3. **Load the Extension in Chrome:**
- Open `chrome://extensions/` and enable Developer Mode.
- Click on "Load unpacked" and select the extension’s directory.

4. **Permissions:**  
The manifest declares permissions for `activeTab`, `scripting`, `audioCapture`, `notifications`, `contextMenus`, and `storage`. Ensure these are granted.

---

## Usage

- **Launching Vesper:**  
Click the extension icon or use the context menu ("Start voice recognition") to activate voice control.

- **Voice Commands:**  
Speak commands like:
- _"Click the login button"_
- _"Type my password"_
- _"Select the third option"_

Vesper processes the command, sends it along with the current DOM snapshot to OpenAI, and executes the returned actions.

- **Modal Interface:**  
A draggable modal provides visual feedback, displaying the transcript, notifications, and command responses.

- **Fallback Handling:**  
If the AI returns “No action” or the command isn’t recognized, Vesper falls back to legacy command processing.

---

## Code Structure & Concepts

- **ActionExecutor:**  
Central class that handles:
- Parsing voice commands.
- Queuing actions.
- Executing them sequentially with built-in error handling and DOM update delays.

- **DOMParser:**  
Scans the webpage (including shadow DOM) to identify interactive elements. It returns a lightweight snapshot for OpenAI processing and executes actions on the actual DOM.

- **State Machine:**  
Manages complex multi-step workflows by transitioning between states (e.g., INIT → OPEN_COMPOSER → FILL_RECIPIENT) based on OpenAI-generated actions.

- **OpenAIService:**  
Formats a system prompt that describes capabilities and desired JSON response. It maintains conversation history to provide context across multiple commands and parses responses robustly.

- **Voice Recognition & UI:**  
Uses the Web Speech API for continuous listening. The modal interface displays interim and final transcripts, and provides notifications (errors, status updates, etc.).

---

## Alternatives & Considerations

- **Voice Recognition:**  
The extension uses the Web Speech API. Consider alternatives if targeting browsers that lack support or if you need more robust offline speech recognition.

- **OpenAI Integration:**  
The current implementation is geared toward GPT-4 via the OpenAI API. Other NLP providers or models could be integrated with minor modifications.

- **State Machine Workflows:**  
The state machine is generic; you can add or modify workflows to support additional tasks.

---

## Development & Contribution

- **Modularity:**  
Each component (DOMParser, ActionExecutor, OpenAIService, StateMachine) is modular, allowing independent testing and future extension.

- **Customization:**  
Update styling via the provided CSS files and modify workflows or UI behavior in the state machine callbacks.

- **Testing:**  
The extension includes extensive console logging to help trace command processing and DOM interactions during development.

---

## License

Distributed under the MIT License. See the [LICENSE](LICENSE) file for details.

---

Vesper empowers users to automate web interactions using natural language. Its flexible architecture, state machine-driven workflows, and integration with AI make it a powerful tool for browser automation. Enjoy building, customizing, and extending Vesper to suit your needs!