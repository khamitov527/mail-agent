/**
 * Types for Voice Processing Service
 */

// Request to the voice processing API
export interface VoiceProcessingRequest {
  rawTranscript: string;
}

// Email composer command
export interface ComposeEmailCommand {
  command: 'compose_email';
}

// Add recipient command
export interface AddRecipientCommand {
  command: 'add_recipient';
  recipient: string;
}

// Add subject command
export interface AddSubjectCommand {
  command: 'add_subject';
  subject: string;
}

// Add message command
export interface AddMessageCommand {
  command: 'add_message';
  content: string;
}

// Delete draft command
export interface DeleteDraftCommand {
  command: 'delete_draft';
}

// Save and close command
export interface SaveAndCloseCommand {
  command: 'save_and_close';
}

// Union type for all command types
export type Command = 
  | ComposeEmailCommand
  | AddRecipientCommand
  | AddSubjectCommand
  | AddMessageCommand
  | DeleteDraftCommand
  | SaveAndCloseCommand
  | { command: string; [key: string]: any };

// Response from the voice processing API
export interface VoiceProcessingResponse {
  original: string;
  corrected: string;
  commands: Command[];
} 