import { NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

export async function GET() {
  try {
    const anthropicKey = process.env.ANTHROPIC_API_KEY;
    
    if (!anthropicKey) {
      return NextResponse.json({ error: 'Anthropic API key not configured' }, { status: 500 });
    }

    const anthropic = new Anthropic({
      apiKey: anthropicKey,
    });

    const prompt = `Generate 20 history lecture topics for sleep audio content. Each topic must be specific enough to fill a fifty-minute lecture but mundane enough to help someone drift off.

CRITICAL: Vary the STRUCTURE of topics across these categories. Do NOT just generate "daily routines of X" twenty times.

Generate exactly 4 topics from each of these 5 categories:

TRADES & CRAFTS (how things were made, step by step):
Examples: "How medieval parchment was made from sheep skin", "The seventeen steps of Japanese sword polishing"

INFRASTRUCTURE & SYSTEMS (how societies organized boring necessities):
Examples: "How the Roman postal system actually worked", "Grain storage regulations in ancient Egypt"

SLOW HISTORICAL PROCESSES (things that took decades or centuries):
Examples: "How the English hedgerow system evolved over four hundred years", "The gradual standardization of weights and measures in medieval Europe"

FORGOTTEN INSTITUTIONS (places and organizations nobody thinks about):
Examples: "The surprisingly complex bureaucracy of Ottoman public fountains", "How medieval toll bridges were managed and maintained"

EVERYDAY LIFE & DOMESTIC ECONOMY (household and community routines):
Examples: "What laundry day actually involved in colonial America", "How a Victorian household managed its coal supply"

RULES:
- Span at least 8 different civilizations or time periods across all 20 topics.
- No two topics should cover the same occupation, trade, or institution.
- Each topic should be a specific, concrete subject — not a broad era or theme.
- Write each topic as a short phrase, not a full sentence.
- No numbering, no bullets, no category labels. Just 20 topics, one per line.`;

    const message = await anthropic.messages.create({
      model: 'claude-3-5-haiku-20241022',
      max_tokens: 1500,
      temperature: 0.8,
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
    });

    const content = message.content[0].type === 'text' ? message.content[0].text : '';
    const topics = content.split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0)
      .slice(0, 20);

    return NextResponse.json({ topics });
  } catch (error) {
    console.error('Error generating topics:', error);
    return NextResponse.json(
      { error: 'Failed to generate topics' },
      { status: 500 }
    );
  }
}