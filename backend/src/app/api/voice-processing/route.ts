import { NextRequest, NextResponse } from 'next/server';
import { processVoiceInput } from '../../../utils/ai-processing';

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

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error processing voice input:', error);
    return NextResponse.json(
      { error: 'Failed to process voice input' },
      { status: 500 }
    );
  }
} 