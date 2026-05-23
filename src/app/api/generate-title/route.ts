import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'edge';

export async function POST(req: NextRequest) {
  try {
    const { messageContent } = await req.json();

    if (!messageContent || typeof messageContent !== 'string') {
      return NextResponse.json({ error: 'Invalid request: messageContent string is required.' }, { status: 400 });
    }
    // Check for Anthropic API key
    if (!process.env.ANTHROPIC_API_KEY) {
      console.error("ANTHROPIC_API_KEY is not set in environment variables.");
      return NextResponse.json({ error: 'API key not configured.' }, { status: 500 });
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    const anthropicUrl = 'https://api.anthropic.com/v1/messages';
    const anthropicVersion = '2023-06-01';

    const requestBody = {
      model: 'claude-3-7-sonnet-20250219',
      system: 'Generate a very short, concise title (3-5 words max, plain text only, no quotes or markdown) for a conversation starting with the following user message. Focus on the core subject.',
      messages: [
        { role: 'user', content: messageContent }
      ],
      temperature: 0.3, // Lower temperature for concise titles
      max_tokens: 20,   // Limit tokens for title generation
      stream: false,
    };

    console.log("Sending request to Anthropic API for title generation...");
    const response = await fetch(anthropicUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': anthropicVersion,
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error("Anthropic Title Gen Error:", errorData);
      return NextResponse.json({ error: errorData.error?.message || 'Anthropic title generation failed' }, { status: response.status });
    }

    const data = await response.json();
    let title = data.completion?.message?.content?.trim();

    if (!title) {
      console.error("Could not extract title from Anthropic response:", data);
      title = messageContent.substring(0, 30) + '...'; // Fallback title
    }

    // Clean up potential quotes or extra formatting from the title
    title = title.replace(/["'`]/g, '').trim();

    console.log("Generated title:", title);
    return NextResponse.json({ title });

  } catch (error: unknown) {
    console.error("Error in /api/generate-title handler:", error);
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
} 