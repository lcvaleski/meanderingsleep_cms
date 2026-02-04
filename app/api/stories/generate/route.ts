import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

export const maxDuration = 300; // 5 minutes max for Vercel Pro

const CONFIG = {
  models: {
    content: 'claude-sonnet-4-5-20250929',
    utility: 'claude-3-5-haiku-20241022',
  },
  temperature: {
    outline: 0.6,
    content: 0.5,
    utility: 0.7,
  },
  maxTokens: {
    outline: 2000,
    content: 8192,
    summary: 500,
  },
  targetWords: 7500,
  chunkWordTargets: [2500, 2500, 2500],
  maxParagraphWords: 150,
};

const SYSTEM_PROMPT = `You are a drowsy history professor giving a detailed bedtime lecture. Your style should induce sleep while remaining mildly engaging — never so boring that it is unpleasant, never so interesting that it keeps the listener awake.

CRITICAL RULES:
1. NO stage directions, asterisk actions, or narration about yourself.
2. NO meta-text: never write [Continued], [End of Part], or any bracketed editorial text.
3. Start directly with lecture content. No introductions about your speaking style.

TONE — match this reference paragraph exactly:
"The Romans, as it happens, were rather particular about their bread. The standard loaf in the second century weighed roughly two pounds, though of course this varied somewhat depending on the region and, well, the general mood of the baker. In Pompeii alone there were something like thirty-three bakeries, each one turning out loaves from before dawn until they were done, really. The flour was ground using rotary mills, which were typically powered by donkeys, and the process of grinding was, if one thinks about it, remarkably similar across most of the Mediterranean. A man named Terentius Neo, who we know about only because his bakery sign survived the eruption, apparently specialized in a round loaf with eight scored sections, each one designed to break off easily, though whether anyone particularly cared about that at the time is anyone's guess."

ANTI-ENGAGEMENT RULES:
- Never use exclamation marks.
- Never use: incredible, amazing, fascinating, remarkable, extraordinary, astonishing, thrilling, stunning, breathtaking, mind-blowing.
- When mentioning a dramatic event, immediately follow it with a mundane detail.
- Never build suspense or use cliffhanger phrasing.
- Never ask rhetorical questions.
- Treat every fact with the same mild, drowsy interest.
- Preferred transitions: "and speaking of which", "which reminds one", "incidentally", "as it happens", "in any case", "one might also note", "though of course".

AUDIO FORMATTING (this text will be read aloud by text-to-speech):
- Keep paragraphs under one hundred and fifty words.
- Use ellipses (...) for trailing-off pauses between thoughts.
- Use em dashes for parenthetical pauses.
- Prefer sentences of fifteen to twenty-five words.
- Spell out ALL numbers as words: "fourteen twenty-three" not "1423", "roughly two hundred" not "~200".
- Spell out abbreviations: "approximately" not "approx.", "Doctor" not "Dr."
- No parenthetical text — rewrite as separate sentences.
- End sentences with periods. Never exclamation marks.

CONTENT:
- Include dates and times, always spelled out as words.
- Mix mundane daily life details with occasional mildly interesting facts, all delivered the same way.
- Describe processes and procedures in soothing detail.
- Add tangential stories about historical figures delivered boringly.
- Occasionally mention something dramatic but immediately move on to something mundane.
- Focus on routines, regulations, and everyday life.

STRUCTURE:
- Long, flowing paragraphs that gently drift between related ideas.
- No lists, bullet points, or formatting.
- Let sentences run on a bit too long sometimes.
- Take scenic routes to get to any point.`;

function getTextContent(message: Anthropic.Message): string {
  return message.content[0].type === 'text' ? message.content[0].text : '';
}

function countWords(text: string): number {
  return text.split(/\s+/).filter(w => w.length > 0).length;
}

function getLastSentences(text: string, count: number): string {
  const sentences = text.match(/[^.!?]+[.!?]+/g);
  if (!sentences) return text.slice(-300);
  return sentences.slice(-count).join('').trim();
}

function postProcess(content: string): string {
  // Strip meta-text markers
  content = content.replace(/\[.*?\]/g, '');

  // Strip asterisk actions
  content = content.replace(/\*[^*]+\*/g, '');

  // Remove exclamation marks (replace with periods)
  content = content.replace(/!/g, '.');

  // Split oversized paragraphs at sentence boundaries
  content = splitLongParagraphs(content, CONFIG.maxParagraphWords);

  return content.trim();
}

function splitLongParagraphs(text: string, maxWords: number): string {
  const paragraphs = text.split(/\n\n+/);
  const result: string[] = [];

  for (const para of paragraphs) {
    const words = para.split(/\s+/);
    if (words.length <= maxWords) {
      result.push(para);
      continue;
    }
    const sentences = para.match(/[^.!?]+[.!?]+/g) || [para];
    let current = '';
    let currentWords = 0;
    for (const sentence of sentences) {
      const sentenceWords = sentence.trim().split(/\s+/).length;
      if (currentWords + sentenceWords > maxWords && current) {
        result.push(current.trim());
        current = sentence;
        currentWords = sentenceWords;
      } else {
        current += sentence;
        currentWords += sentenceWords;
      }
    }
    if (current.trim()) result.push(current.trim());
  }

  return result.join('\n\n');
}

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

    const anthropic = new Anthropic({
      apiKey: anthropicKey,
    });

    // If generating focus areas only (legacy path)
    if (!generateFull) {
      const prompt = `Divide the topic "${topic}" into 3 distinct subtopics for a boring history lecture. Each subtopic should be different but related to the main topic.

Provide exactly 3 subtopics, one per line.`;

      const message = await anthropic.messages.create({
        model: CONFIG.models.utility,
        max_tokens: 300,
        temperature: CONFIG.temperature.utility,
        messages: [{ role: 'user', content: prompt }],
      });

      const content = getTextContent(message);
      const focusAreas = content.split('\n')
        .map(line => line.trim())
        .filter(line => line.length > 0)
        .slice(0, 3);

      return NextResponse.json({ focusAreas });
    }

    // === Full generation pipeline ===
    const parts: Array<{
      content: string;
      wordCount: number;
      partNumber: number;
      focusArea: string;
    }> = [];
    let totalWords = 0;
    let allUsedElements: string[] = [];
    let previousSummary = '';
    let previousLastSentences = '';

    console.log('API Route: Starting full generation, target words:', CONFIG.targetWords);

    // Step 1: Generate structured outline
    console.log('API Route: Generating outline...');
    const outlineMessage = await anthropic.messages.create({
      model: CONFIG.models.content,
      max_tokens: CONFIG.maxTokens.outline,
      temperature: CONFIG.temperature.outline,
      messages: [{
        role: 'user',
        content: `Create a detailed outline for a sleep-inducing history lecture on "${topic}".

Structure it as exactly 3 major sections of roughly equal scope.
For each section, provide:
- A section title (a specific subtopic, not just "Introduction" or "Conclusion")
- 3 subsection topics that meander between related ideas
- For each subsection, 2-3 specific historical details, dates, or anecdotes to include

The outline should be deliberately meandering. Subsections should drift between related ideas rather than following a rigid logical progression. Each section should feel like a sleepy tangent that eventually circles back.

Format as a numbered outline:
1. Section Title
   1.1 Subsection topic
       - Detail/anecdote
       - Detail/anecdote
   1.2 Subsection topic
       - Detail/anecdote
       - Detail/anecdote
   ...
2. Section Title
   ...
3. Section Title
   ...`,
      }],
    });

    const outline = getTextContent(outlineMessage);
    console.log('API Route: Outline generated, length:', outline.length);

    // Extract section titles as focus areas from outline
    const sectionTitleMatches = outline.match(/^\d+\.\s+(.+)$/gm) || [];
    const allFocusAreas = sectionTitleMatches
      .map(line => line.replace(/^\d+\.\s+/, '').trim())
      .slice(0, 3);

    if (allFocusAreas.length === 0) {
      allFocusAreas.push(topic);
    }

    console.log('API Route: Extracted focus areas:', allFocusAreas);

    // Step 2: Generate content chunks with context chaining
    for (let i = 0; i < CONFIG.chunkWordTargets.length; i++) {
      const targetWordsForChunk = CONFIG.chunkWordTargets[i];
      console.log(`API Route: Generating chunk ${i + 1} of ${CONFIG.chunkWordTargets.length}, target words: ${targetWordsForChunk}`);

      let userPrompt: string;

      if (i === 0) {
        // First chunk: outline context only
        userPrompt = `Generate section 1 of a sleep-inducing history lecture on "${topic}".

LECTURE OUTLINE (follow this structure):
${outline}

THIS SECTION COVERS: Section 1 of the outline above.
TARGET: approximately ${targetWordsForChunk} words.

Begin the lecture directly with content. No introductions or preambles.`;
      } else {
        // Subsequent chunks: outline + previous context
        userPrompt = `Generate section ${i + 1} of a sleep-inducing history lecture on "${topic}".

LECTURE OUTLINE (follow this structure):
${outline}

THIS SECTION COVERS: Section ${i + 1} of the outline above.
TARGET: approximately ${targetWordsForChunk} words.

PREVIOUS SECTION SUMMARY (do not repeat this content):
${previousSummary}

ALREADY-USED NAMES AND DATES (do not re-introduce these):
${allUsedElements.join(', ')}

CONTINUE NATURALLY FROM THESE LAST SENTENCES:
"${previousLastSentences}"

Write the lecture content for this section only. Flow naturally from where the previous section ended.`;
      }

      const chunkMessage = await anthropic.messages.create({
        model: CONFIG.models.content,
        max_tokens: CONFIG.maxTokens.content,
        temperature: CONFIG.temperature.content,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: userPrompt }],
      });

      let chunkContent = getTextContent(chunkMessage);
      chunkContent = postProcess(chunkContent);

      const wordCount = countWords(chunkContent);
      console.log(`API Route: Chunk ${i + 1} generated, actual words: ${wordCount}`);

      parts.push({
        content: chunkContent,
        wordCount,
        partNumber: i + 1,
        focusArea: allFocusAreas[i] || `Section ${i + 1}`,
      });

      totalWords += wordCount;
      console.log(`API Route: Total words so far: ${totalWords}`);

      // Step 3: Generate inter-chunk summary (skip after last chunk)
      if (i < CONFIG.chunkWordTargets.length - 1) {
        console.log(`API Route: Generating summary for chunk ${i + 1}...`);
        const summaryMessage = await anthropic.messages.create({
          model: CONFIG.models.utility,
          max_tokens: CONFIG.maxTokens.summary,
          temperature: 0.3,
          messages: [{
            role: 'user',
            content: `Summarize this lecture section in exactly 3 sentences:
1. The main subtopic and narrative arc covered.
2. Key proper nouns, place names, and dates mentioned.
3. Where the narrative left off (what was the last thing discussed).

Then list all proper nouns and dates mentioned, comma-separated on a new line after "USED:".

Section:
${chunkContent}`,
          }],
        });

        const summaryContent = getTextContent(summaryMessage);

        // Extract the summary (everything before USED:)
        const usedIndex = summaryContent.indexOf('USED:');
        if (usedIndex !== -1) {
          previousSummary = summaryContent.slice(0, usedIndex).trim();
          const usedLine = summaryContent.slice(usedIndex + 5).trim();
          const newElements = usedLine.split(',').map(e => e.trim()).filter(e => e.length > 0);
          allUsedElements = [...allUsedElements, ...newElements];
        } else {
          previousSummary = summaryContent.trim();
        }

        previousLastSentences = getLastSentences(chunkContent, 3);
        console.log(`API Route: Summary generated. Used elements count: ${allUsedElements.length}`);
      }
    }

    // Step 4: Overflow loop — generate additional chunks if needed
    while (totalWords < CONFIG.targetWords) {
      console.log(`API Route: Need more content. Current: ${totalWords}, Target: ${CONFIG.targetWords}`);

      const remainingWords = CONFIG.targetWords - totalWords;
      const wordsForPart = Math.min(2500, remainingWords);

      // Get summary of last chunk if we don't have one
      if (!previousSummary && parts.length > 0) {
        const lastContent = parts[parts.length - 1].content;
        previousLastSentences = getLastSentences(lastContent, 3);
      }

      const overflowPrompt = `Generate an additional section of a sleep-inducing history lecture on "${topic}".

LECTURE OUTLINE (for context on what has been covered):
${outline}

TARGET: approximately ${wordsForPart} words.

PREVIOUS SECTION SUMMARY (do not repeat this content):
${previousSummary}

ALREADY-USED NAMES AND DATES (do not re-introduce these):
${allUsedElements.join(', ')}

CONTINUE NATURALLY FROM THESE LAST SENTENCES:
"${previousLastSentences}"

Explore a new angle of the topic that hasn't been covered in the outline sections above. Continue the drowsy, meandering tone.`;

      const overflowMessage = await anthropic.messages.create({
        model: CONFIG.models.content,
        max_tokens: CONFIG.maxTokens.content,
        temperature: CONFIG.temperature.content,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: overflowPrompt }],
      });

      let overflowContent = getTextContent(overflowMessage);
      overflowContent = postProcess(overflowContent);

      const wordCount = countWords(overflowContent);
      const focusArea = `Additional section ${parts.length + 1}`;

      parts.push({
        content: overflowContent,
        wordCount,
        partNumber: parts.length + 1,
        focusArea,
      });

      totalWords += wordCount;
      allFocusAreas.push(focusArea);

      // Generate summary for this overflow chunk in case we need another
      if (totalWords < CONFIG.targetWords) {
        const summaryMessage = await anthropic.messages.create({
          model: CONFIG.models.utility,
          max_tokens: CONFIG.maxTokens.summary,
          temperature: 0.3,
          messages: [{
            role: 'user',
            content: `Summarize this lecture section in exactly 3 sentences:
1. The main subtopic and narrative arc covered.
2. Key proper nouns, place names, and dates mentioned.
3. Where the narrative left off (what was the last thing discussed).

Then list all proper nouns and dates mentioned, comma-separated on a new line after "USED:".

Section:
${overflowContent}`,
          }],
        });

        const summaryContent = getTextContent(summaryMessage);
        const usedIndex = summaryContent.indexOf('USED:');
        if (usedIndex !== -1) {
          previousSummary = summaryContent.slice(0, usedIndex).trim();
          const usedLine = summaryContent.slice(usedIndex + 5).trim();
          const newElements = usedLine.split(',').map(e => e.trim()).filter(e => e.length > 0);
          allUsedElements = [...allUsedElements, ...newElements];
        } else {
          previousSummary = summaryContent.trim();
        }

        previousLastSentences = getLastSentences(overflowContent, 3);
      }

      console.log(`API Route: Overflow chunk generated. Total words: ${totalWords}`);
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
