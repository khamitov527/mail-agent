import OpenAI from 'openai';
import type { Command } from '../types/voice-processing';

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * Corrects grammar in the provided text using OpenAI
 */
export async function correctGrammar(text: string): Promise<string> {
  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      {
        role: "system",
        content: "You are a grammar correction assistant. Convert the user's informal speech into grammatically correct sentences while preserving the meaning. Make it sound natural."
      },
      {
        role: "user",
        content: text
      }
    ],
    temperature: 0.3,
    max_tokens: 256,
  });

  return response.choices[0].message.content?.trim() || text;
}

/**
 * Detects commands in the provided text using OpenAI
 */
export async function detectCommands(text: string): Promise<Command[]> {
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
        ]}
        `
      },
      {
        role: "user",
        content: text
      }
    ],
    response_format: { type: "json_object" },
    temperature: 0.2,
  });

  try {
    const content = response.choices[0].message.content || '{"commands": []}';
    const parsedResponse = JSON.parse(content);
    return Array.isArray(parsedResponse.commands) ? parsedResponse.commands : [];
  } catch (error) {
    console.error('Error parsing command detection response:', error);
    return [];
  }
}

/**
 * Processes voice input: corrects grammar and detects commands
 */
export async function processVoiceInput(text: string) {
  // Step 1: Grammar correction
  const correctedText = await correctGrammar(text);
  
  // Step 2: Command detection
  const detectedCommands = await detectCommands(correctedText);

  return {
    original: text,
    corrected: correctedText,
    commands: detectedCommands,
  };
} 