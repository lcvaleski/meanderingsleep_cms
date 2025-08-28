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

    const prompt = `Generate 20 boring history lecture topics that would make good sleep content. Focus on mundane daily routines, repetitive tasks, and ordinary life in historical periods. Each topic should be about what specific people did during their ordinary days.

Here are some examples of the style and type of topics to generate:
- Daily routines of a Roman bath house attendant
- What Viking farmers did between raids
- Mundane duties of a pyramid builder
- Life in a monastery scriptorium
- How ancient Mesopotamians kept time
- A night watch in a medieval castle
- Tending sheep in ancient Palestine
- Maintaining a lighthouse in the 1800s
- Brewing ale in a Saxon village
- Fishing routines of Polynesian islanders
- Keeping bees in ancient Crete
- Sweeping chimneys in Georgian London
- Mending nets in a Norse fishing village

Generate 20 NEW topics similar to these examples. Focus on:
- Mundane occupations and their daily tasks
- Repetitive historical processes
- Ordinary life in different time periods
- Routine maintenance and upkeep tasks
- Boring but necessary historical jobs

Provide exactly 20 topics, one per line, no numbering or bullets. Make them diverse across different time periods and cultures.`;

    const message = await anthropic.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 1000,
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