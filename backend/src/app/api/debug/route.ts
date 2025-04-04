import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { detectCommands } from '../../../utils/ai-processing';

// Initialize OpenAI client for raw API responses
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(request: NextRequest) {
  try {
    const { text } = await request.json();

    if (!text || typeof text !== 'string') {
      return NextResponse.json(
        { error: 'Text is required and must be a string' },
        { status: 400 }
      );
    }

    // Get the raw OpenAI response for debugging
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: `You are a command detection assistant focusing specifically on email operations. Identify email-related commands in the text and extract relevant details.
        
          ONLY detect these specific email commands:
          - "compose_email": Opens an email composer
          - "add_recipient": Fills in recipient information
          - "add_subject": Fills in email subject
          - "add_message": Fills in email message content
          - "delete_draft": Deletes the current draft
          - "save_and_close": Saves the draft and closes the composer

          Return a JSON object with a "commands" array, where each object represents a command with properties appropriate for that command type:
          
          - For "compose_email": No additional parameters needed
          - For "add_recipient": Include "recipient" (email or name)
          - For "add_subject": Include "subject" (text)
          - For "add_message": Include "content" (text)
          - For "delete_draft": No additional parameters needed
          - For "save_and_close": No additional parameters needed
          
          The same text might contain multiple commands. For example, "compose an email to john with subject hello" should return both a compose_email command and add_recipient and add_subject commands.
          
          If no commands are detected, return an empty array.
          
          The output should be formatted exactly like:
          {"commands": [
            {"command": "compose_email"},
            {"command": "add_recipient", "recipient": "john@example.com"},
            {"command": "add_subject", "subject": "Meeting tomorrow"}
          ]}`
        },
        {
          role: "user",
          content: text
        }
      ],
      response_format: { type: "json_object" },
      temperature: 0.2,
    });

    // Also get the processed commands using our utility function
    const processedCommands = await detectCommands(text);

    // Return debugging information
    return NextResponse.json({
      input: text,
      openaiResponse: response,
      rawParsedResponse: JSON.parse(response.choices[0].message.content || '{"commands": []}'),
      processedCommands: processedCommands
    });
  } catch (error) {
    console.error('Debug error:', error);
    return NextResponse.json(
      { error: 'Debug endpoint error', details: String(error) },
      { status: 500 }
    );
  }
} 