import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

const SYSTEM_PROMPT = `You are a drowsy history professor giving a detailed bedtime lecture. Your style should induce sleep while remaining somewhat engaging.

CRITICAL RULES: 
1. ABSOLUTELY NO stage directions, asterisk actions, or narration about yourself. DO NOT write things like *clears throat*, *adjusts glasses*, *speaking slowly*, or any other action descriptions.
2. ABSOLUTELY NO META-TEXT OR CONTINUATION MARKERS. Never write [Continued in next section], [To be continued], [End of Part 1], or any brackets with editorial/continuation information.
3. Start directly with the lecture content and flow naturally throughout.

TONE & STYLE:
- Speak in a calm, monotonous drone like David Attenborough at 2 AM
- Mix simple explanations with occasional academic terminology
- Include interesting facts but deliver them matter-of-factly
- Meander through topics with gentle, sleepy transitions
- Sound like you find everything mildly fascinating but can't quite muster enthusiasm
- Include some surprising historical details but present them boringly

CONTENT REQUIREMENTS:
- Include dates and times but don't overdo the precision
- Mix mundane daily life details with occasional interesting events
- Describe processes and procedures in soothing detail
- Add tangential stories about random historical figures
- Include both boring and fascinating facts, all delivered the same way
- Focus heavily on routines, regulations, and everyday life
- Occasionally mention something dramatic but immediately move on

STRUCTURE:
- Write in long, flowing paragraphs that gently drift between topics
- No lists or bullet points - everything flows together
- Take scenic routes to get to any point
- Sound like a sleepy museum audio guide
- Let sentences run on a bit too long sometimes
- Mix the mundane with the mildly interesting throughout
- Start IMMEDIATELY with lecture content - no introductions about tone or speaking style`;

export async function POST(req: NextRequest) {
  try {
    const { topic, generateFull = false } = await req.json();
    
    console.log('API Route: Received request for topic:', topic, 'generateFull:', generateFull);

    if (!topic) {
      return NextResponse.json({ error: 'Topic is required' }, { status: 400 });
    }

    const anthropicKey = process.env.ANTHROPIC_API_KEY;
    if (!anthropicKey) {
      console.error('API Route: No ANTHROPIC_API_KEY found');
      return NextResponse.json({ error: 'Anthropic API key not configured' }, { status: 500 });
    }
    
    console.log('API Route: API key found, length:', anthropicKey.length);

    const anthropic = new Anthropic({
      apiKey: anthropicKey,
    });

    // If generating focus areas only
    if (!generateFull) {
      const prompt = `Divide the topic "${topic}" into 3 distinct subtopics for a boring history lecture. Each subtopic should be different but related to the main topic.

Provide exactly 3 subtopics, one per line.`;

      const message = await anthropic.messages.create({
        model: 'claude-sonnet-4-5-20250929',
        max_tokens: 300,
        temperature: 0.7,
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
      });

      const content = message.content[0].type === 'text' ? message.content[0].text : '';
      const focusAreas = content.split('\n')
        .map(line => line.trim())
        .filter(line => line.length > 0)
        .slice(0, 3);

      return NextResponse.json({ focusAreas });
    }

    // Generate full 45-minute lecture
    const TARGET_WORDS = 7500; // ~45 minutes at 150 wpm
    const parts: Array<{
      content: string;
      wordCount: number;
      partNumber: number;
      focusArea: string;
    }> = [];
    let totalWords = 0;

    console.log('API Route: Starting full generation, target words:', TARGET_WORDS);

    // First generate focus areas
    const focusAreasPrompt = `Divide the topic "${topic}" into 3 distinct subtopics for a boring history lecture. Each subtopic should be different but related to the main topic.

Provide exactly 3 subtopics, one per line.`;

    console.log('API Route: Generating focus areas...');
    const focusAreasMessage = await anthropic.messages.create({
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 300,
      temperature: 0.7,
      messages: [
        {
          role: 'user',
          content: focusAreasPrompt,
        },
      ],
    });

    const focusAreasContent = focusAreasMessage.content[0].type === 'text' ? focusAreasMessage.content[0].text : '';
    const initialFocusAreas = focusAreasContent.split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0)
      .slice(0, 3);
    
    const allFocusAreas = [...initialFocusAreas];
    
    console.log('API Route: Generated focus areas:', allFocusAreas);

    // Generate initial 3 parts with specified word counts
    const initialWordCounts = [3000, 3000, 2500];
    
    for (let i = 0; i < 3; i++) {
      console.log(`API Route: Generating part ${i + 1} of 3, target words: ${initialWordCounts[i]}`);
      const userPrompt = `Generate Part ${i + 1} of a 45-minute sleep-inducing history lecture on "${topic}". 
This section should be approximately ${initialWordCounts[i]} words and focus on ${allFocusAreas[i]}.

CRITICAL: Do NOT include any stage directions, asterisk actions, or descriptions of how you're speaking. No *clears throat*, *speaking slowly*, etc. Start DIRECTLY with the lecture content.

ABSOLUTELY NO META-TEXT: Do not include ANY of the following:
- [Continued in next section]
- [To be continued]
- [End of Part X]
- [Beginning of Part X]
- Any brackets with meta-information
- Any notes about continuation or section breaks
- Any editorial comments or annotations

Write in a drowsy, meandering style that includes:
- Several dates and times (but keep them reasonable, like "in 1423" or "around 2 in the afternoon")
- Stories about random people from history delivered in a boring way
- Mix genuinely interesting facts with mundane details, all in the same monotone
- Detailed descriptions of everyday processes and routines
- Occasional dramatic events mentioned casually then moving on
- Tangents about related topics that drift back eventually

IMPORTANT: Write in flowing paragraphs like a sleepy audio guide. No lists, formatting, or stage directions. Start immediately with lecture content - don't describe your tone or manner of speaking.`;

      const message = await anthropic.messages.create({
        model: 'claude-sonnet-4-5-20250929',
        max_tokens: 4000,
        temperature: 0.7,
        system: SYSTEM_PROMPT,
        messages: [
          {
            role: 'user',
            content: userPrompt,
          },
        ],
      });

      let content = message.content[0].type === 'text' ? message.content[0].text : '';
      
      // Clean up any continuation markers that shouldn't be in the output
      content = content.replace(/\[Continued in next section\]/gi, '');
      content = content.replace(/\[To be continued\]/gi, '');
      content = content.replace(/\[Continuing from previous section\]/gi, '');
      content = content.trim();
      
      const wordCount = content.split(/\s+/).length;
      
      console.log(`API Route: Part ${i + 1} generated, actual words: ${wordCount}`);
      
      parts.push({
        content,
        wordCount,
        partNumber: i + 1,
        focusArea: allFocusAreas[i],
      });
      
      totalWords += wordCount;
      console.log(`API Route: Total words so far: ${totalWords}`);
    }

    // Keep generating until we reach target word count
    while (totalWords < TARGET_WORDS) {
      console.log(`API Route: Need more content. Current: ${totalWords}, Target: ${TARGET_WORDS}`);
      
      // Generate new focus areas for additional content
      const additionalPrompt = `The lecture on "${topic}" needs more content. We've already covered:
${allFocusAreas.join('\n')}

Provide 3 NEW subtopics that haven't been covered yet, one per line.`;

      console.log('API Route: Generating additional focus areas...');
      const additionalMessage = await anthropic.messages.create({
        model: 'claude-sonnet-4-5-20250929',
        max_tokens: 300,
        temperature: 0.7,
        messages: [
          {
            role: 'user',
            content: additionalPrompt,
          },
        ],
      });

      const newFocusAreasContent = additionalMessage.content[0].type === 'text' ? additionalMessage.content[0].text : '';
      const newFocusAreas = newFocusAreasContent.split('\n')
        .map(line => line.trim())
        .filter(line => line.length > 0)
        .slice(0, 3);

      // Generate content for new focus areas
      for (const focusArea of newFocusAreas) {
        if (totalWords >= TARGET_WORDS) break;

        const remainingWords = TARGET_WORDS - totalWords;
        const wordsForPart = Math.min(2500, remainingWords);

        const userPrompt = `Generate Part ${parts.length + 1} of a 45-minute sleep-inducing history lecture on "${topic}". 
This section should be approximately ${wordsForPart} words and focus on ${focusArea}.

CRITICAL: Do NOT include any stage directions, asterisk actions, or descriptions of how you're speaking. No *clears throat*, *speaking slowly*, etc. Start DIRECTLY with the lecture content.

ABSOLUTELY NO META-TEXT: Do not include ANY of the following:
- [Continued in next section]
- [To be continued]
- [End of Part X]
- [Beginning of Part X]
- Any brackets with meta-information
- Any notes about continuation or section breaks
- Any editorial comments or annotations

Write in a drowsy, meandering style that includes:
- Several dates and times (but keep them reasonable, like "in 1423" or "around 2 in the afternoon")
- Stories about random people from history delivered in a boring way
- Mix genuinely interesting facts with mundane details, all in the same monotone
- Detailed descriptions of everyday processes and routines
- Occasional dramatic events mentioned casually then moving on
- Tangents about related topics that drift back eventually

IMPORTANT: Write in flowing paragraphs like a sleepy audio guide. No lists, formatting, or stage directions. Start immediately with lecture content - don't describe your tone or manner of speaking.`;

        const message = await anthropic.messages.create({
          model: 'claude-sonnet-4-5-20250929',
          max_tokens: 4000,
          temperature: 0.7,
          system: SYSTEM_PROMPT,
          messages: [
            {
              role: 'user',
              content: userPrompt,
            },
          ],
        });

        const content = message.content[0].type === 'text' ? message.content[0].text : '';
        const wordCount = content.split(/\s+/).length;

        parts.push({
          content,
          wordCount,
          partNumber: parts.length + 1,
          focusArea,
        });

        totalWords += wordCount;
        allFocusAreas.push(focusArea);
      }
    }

    console.log(`API Route: Generation complete! Total parts: ${parts.length}, Total words: ${totalWords}`);
    
    return NextResponse.json({
      parts,
      totalWords,
      focusAreas: allFocusAreas,
    });
  } catch (error) {
    console.error('API Route: Error generating story:', error);
    console.error('Error details:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      error: error
    });

    // Return more detailed error for debugging
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return NextResponse.json(
      {
        error: 'Failed to generate story',
        details: errorMessage,
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}