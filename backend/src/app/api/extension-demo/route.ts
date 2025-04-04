import { NextRequest, NextResponse } from 'next/server';
import { processVoiceInput } from '../../../utils/ai-processing';

/**
 * Demo endpoint specifically for the browser extension
 * Returns both the processed commands and example handler code
 */
export async function POST(request: NextRequest) {
  try {
    const { rawTranscript } = await request.json();

    if (!rawTranscript || typeof rawTranscript !== 'string') {
      return NextResponse.json(
        { error: 'Raw transcript is required and must be a string' },
        { status: 400 }
      );
    }

    // Process the voice input
    const result = await processVoiceInput(rawTranscript);

    // Add example handler code for the extension
    const exampleHandlerCode = generateExampleCode(result.commands);

    return NextResponse.json({
      ...result,
      exampleHandlerCode,
    });
  } catch (error) {
    console.error('Error in extension demo endpoint:', error);
    return NextResponse.json(
      { error: 'Failed to process voice input for extension' },
      { status: 500 }
    );
  }
}

/**
 * Generate example code to handle the detected commands
 */
function generateExampleCode(commands: any[]): string {
  if (!commands || commands.length === 0) {
    return `// No commands detected in the transcript`;
  }

  const codeLines = [
    `// Example code to handle the detected commands`,
    `function handleVoiceCommands(commands) {`,
    `  // Process each command sequentially`,
    `  commands.forEach(command => {`,
    `    switch(command.command) {`
  ];

  // Add case for each command type
  const commandTypes = new Set(commands.map(cmd => cmd.command));
  
  if (commandTypes.has('compose_email')) {
    codeLines.push(
      `      case 'compose_email':`,
      `        console.log('Opening email composer');`,
      `        // yourExtension.openEmailComposer();`,
      `        break;`
    );
  }

  if (commandTypes.has('add_recipient')) {
    codeLines.push(
      `      case 'add_recipient':`,
      `        console.log('Adding recipient:', command.recipient);`,
      `        // yourExtension.addRecipient(command.recipient);`,
      `        break;`
    );
  }

  if (commandTypes.has('add_subject')) {
    codeLines.push(
      `      case 'add_subject':`,
      `        console.log('Setting subject:', command.subject);`,
      `        // yourExtension.setSubject(command.subject);`,
      `        break;`
    );
  }

  if (commandTypes.has('add_message')) {
    codeLines.push(
      `      case 'add_message':`,
      `        console.log('Adding message content:', command.content);`,
      `        // yourExtension.setMessageContent(command.content);`,
      `        break;`
    );
  }

  if (commandTypes.has('delete_draft')) {
    codeLines.push(
      `      case 'delete_draft':`,
      `        console.log('Deleting draft email');`,
      `        // yourExtension.deleteDraft();`,
      `        break;`
    );
  }

  if (commandTypes.has('save_and_close')) {
    codeLines.push(
      `      case 'save_and_close':`,
      `        console.log('Saving draft and closing composer');`,
      `        // yourExtension.saveAndClose();`,
      `        break;`
    );
  }

  // Add default case
  codeLines.push(
    `      default:`,
    `        console.log('Unknown command:', command);`,
    `    }`,
    `  });`,
    `}`
  );

  // Add example usage
  codeLines.push(
    ``,
    `// Example usage`,
    `handleVoiceCommands(${JSON.stringify(commands, null, 2)});`
  );

  return codeLines.join('\n');
} 