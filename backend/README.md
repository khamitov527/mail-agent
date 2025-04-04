# Voice Processing Backend Service

This Next.js backend service handles voice transcript processing, providing grammar correction and command detection for voice interactions, with a focus on email operations.

## Features

- **Grammar Correction**: Converts raw voice transcripts into grammatically correct sentences
- **Email Command Detection**: Identifies email-related commands in the corrected text and extracts structured data
- **Multiple Command Support**: Processes multiple commands from a single voice prompt
- **Extension Integration**: Ready-to-use utilities for browser extension integration
- **Built with TypeScript**: Type-safe code for better reliability

## Getting Started

### Prerequisites

- Node.js 18.x or later
- npm or yarn
- OpenAI API key

### Installation

1. Clone the repository and navigate to the backend directory:

```bash
cd backend
```

2. Install dependencies:

```bash
npm install
# or
yarn install
```

3. Create a `.env.local` file based on the example:

```bash
cp .env.local.example .env.local
```

4. Add your OpenAI API key to the `.env.local` file:

```
OPENAI_API_KEY=your_openai_api_key_here
```

### Running the Development Server

```bash
npm run dev
# or
yarn dev
```

The server will start at http://localhost:3000 by default.

## API Endpoints

### POST /api/voice-processing

Process a voice transcript for grammar correction and command detection.

#### Request

```json
{
  "rawTranscript": "compose an email to john with subject meeting notes"
}
```

#### Response

```json
{
  "original": "compose an email to john with subject meeting notes",
  "corrected": "Compose an email to John with the subject 'Meeting Notes'.",
  "commands": [
    {
      "command": "compose_email"
    },
    {
      "command": "add_recipient",
      "recipient": "John"
    },
    {
      "command": "add_subject",
      "subject": "Meeting Notes"
    }
  ]
}
```

## Supported Email Command Types

The service can detect various email command types:

- **compose_email**: Opens an email composer
- **add_recipient**: Fills in recipient information
- **add_subject**: Fills in email subject
- **add_message**: Fills in email message content
- **delete_draft**: Deletes the current draft
- **save_and_close**: Saves the draft and closes the composer

## Browser Extension Integration

This backend is designed to be easily integrated with browser extensions for voice command processing.

### Integration Options

1. **Client-side Script**: Include `extension-client.js` in your extension
2. **Extension Helper**: Use the utility functions from `src/utils/extension-helper.ts`

### Integration Steps

1. Start the backend server with `npm run dev`
2. Visit http://localhost:3000/extension for extension integration details
3. Choose one of the integration options:
   - Copy the JavaScript code snippet provided
   - Or include the client script directly: `<script src="http://localhost:3000/extension-client.js"></script>`
4. Implement the command handlers in your extension to interact with email interfaces

### Example Extension Code

```javascript
// Initialize the voice client
const voiceClient = new VoiceProcessingClient('http://localhost:3000');

// Register handlers for email commands
voiceClient.registerHandler('compose_email', () => {
  // Implementation to open email composer
})
.registerHandler('add_recipient', (cmd) => {
  // Implementation to add recipient
  document.querySelector('#recipient-field').value = cmd.recipient;
})
.registerHandler('add_subject', (cmd) => {
  // Implementation to add subject
  document.querySelector('#subject-field').value = cmd.subject;
});

// Process voice input from your extension
async function onSpeechRecognized(transcript) {
  await voiceClient.processVoice(transcript);
  // Commands are automatically executed by registered handlers
}
```

## Development

### Project Structure

```
backend/
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── voice-processing/
│   │   │   │   └── route.ts    # Main API endpoint for voice processing
│   │   │   ├── test/
│   │   │   │   └── route.ts    # Test endpoint with examples
│   │   │   └── extension-demo/
│   │   │       └── route.ts    # Demo API for extension integration
│   │   ├── extension/
│   │   │   └── page.tsx        # Extension integration page
│   │   ├── page.tsx            # Main UI for testing
│   │   └── ...
│   ├── utils/
│   │   ├── ai-processing.ts    # AI processing utilities
│   │   └── extension-helper.ts # Extension integration helpers
│   └── types/
│       └── voice-processing.ts # Type definitions
├── public/
│   └── extension-client.js     # Client-side script for extensions
├── .env.local.example          # Example environment variables
└── README.md                   # This file
```

### Technologies Used

- Next.js 14+
- TypeScript
- OpenAI API
- Tailwind CSS

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
