# Voice Processing Backend Service

This Next.js backend service handles voice transcript processing, providing grammar correction and command detection for voice interactions.

## Features

- **Grammar Correction**: Converts raw voice transcripts into grammatically correct sentences
- **Command Detection**: Identifies actionable commands in the corrected text and extracts structured data
- **Multiple Command Support**: Processes multiple commands from a single voice prompt
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
  "rawTranscript": "send email john tomorrow meeting"
}
```

#### Response

```json
{
  "original": "send email john tomorrow meeting",
  "corrected": "Send an email to John about tomorrow's meeting.",
  "commands": [
    {
      "command": "draft_email",
      "recipient": "john",
      "content": "about tomorrow's meeting"
    }
  ]
}
```

## Supported Command Types

The service can detect various command types, including:

- **Email Commands**: Draft emails to recipients
- **Calendar Events**: Create calendar appointments
- **Reminders**: Set reminders for tasks

## Development

### Project Structure

```
backend/
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── voice-processing/
│   │   │   │   └── route.ts    # Main API endpoint for voice processing
│   │   │   └── test/
│   │   │       └── route.ts    # Test endpoint with examples
│   │   ├── page.tsx            # Next.js default page
│   │   ├── layout.tsx          # Next.js layout
│   │   └── globals.css         # Global styles
│   └── types/
│       └── voice-processing.ts # Type definitions
├── .env.local.example          # Example environment variables
└── README.md                   # This file
```

### Technologies Used

- Next.js 14+
- TypeScript
- OpenAI API

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
