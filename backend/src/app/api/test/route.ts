import { NextResponse } from 'next/server';
import type { VoiceProcessingResponse } from '../../../types/voice-processing';

/**
 * This is a test endpoint that simulates the voice processing API
 * It returns mock responses for different example queries
 */
export async function GET() {
  // Example test data showing how the API works
  const examples: { query: string; response: VoiceProcessingResponse }[] = [
    {
      query: "compose an email",
      response: {
        original: "compose an email",
        corrected: "Compose an email.",
        commands: [
          {
            command: "compose_email"
          }
        ]
      }
    },
    {
      query: "add john as recipient",
      response: {
        original: "add john as recipient",
        corrected: "Add John as recipient.",
        commands: [
          {
            command: "add_recipient",
            recipient: "John"
          }
        ]
      }
    },
    {
      query: "set subject to quarterly report",
      response: {
        original: "set subject to quarterly report",
        corrected: "Set subject to 'Quarterly Report'.",
        commands: [
          {
            command: "add_subject",
            subject: "Quarterly Report"
          }
        ]
      }
    },
    {
      query: "add message the numbers look good for q3",
      response: {
        original: "add message the numbers look good for q3",
        corrected: "Add message: The numbers look good for Q3.",
        commands: [
          {
            command: "add_message",
            content: "The numbers look good for Q3."
          }
        ]
      }
    },
    {
      query: "delete this draft",
      response: {
        original: "delete this draft",
        corrected: "Delete this draft.",
        commands: [
          {
            command: "delete_draft"
          }
        ]
      }
    },
    {
      query: "save and close",
      response: {
        original: "save and close",
        corrected: "Save and close.",
        commands: [
          {
            command: "save_and_close"
          }
        ]
      }
    },
    {
      query: "compose an email to marketing team with subject campaign update and message the new campaign metrics look promising",
      response: {
        original: "compose an email to marketing team with subject campaign update and message the new campaign metrics look promising",
        corrected: "Compose an email to the marketing team with subject 'Campaign Update' and message 'The new campaign metrics look promising.'",
        commands: [
          {
            command: "compose_email"
          },
          {
            command: "add_recipient",
            recipient: "marketing team"
          },
          {
            command: "add_subject",
            subject: "Campaign Update"
          },
          {
            command: "add_message",
            content: "The new campaign metrics look promising."
          }
        ]
      }
    }
  ];

  return NextResponse.json({ examples });
} 