---
title: "feat: Improve Transcript Generation Pipeline"
type: feat
date: 2026-02-04
---

# Improve Transcript Generation Pipeline

## Overview

Overhaul the Stories transcript generation pipeline to solve three problems: inconsistent tone across topics, cross-chunk repetition from isolated API calls, and missing ElevenLabs TTS formatting. All changes are backend-only in the API route handler — the one-click UX is preserved.

## Problem Statement

The current pipeline at `app/api/stories/generate/route.ts` generates ~7500-word transcripts by making 3-4 independent Claude API calls. Each call receives only a topic name and a focus area string — it has zero context about what the other chunks contain. This causes:

1. **Tone inconsistency**: Some topics produce excessively dry content, others produce genuinely engaging content that keeps people awake. Temperature 0.7 with no reference example means Claude improvises the tone each time.
2. **Cross-chunk repetition**: Parts cover overlapping ground because each call is stateless. A "Roman daily life" lecture might describe the same bath house rituals in two different chunks.
3. **Poor TTS formatting**: Numbers are written as digits ("1423"), paragraphs run long, and there are no deliberate pause markers (ellipses, em-dashes) for ElevenLabs to interpret.

## Proposed Solution

Add an **outline-first, context-chained generation pipeline** with improved prompting and post-processing. The generation flow becomes:

```
Topic
  → Outline generation (Sonnet, structured 3-tier outline)
  → Chunk 1 generation (Sonnet, with outline context)
  → Chunk 1 summary extraction (Haiku)
  → Chunk 2 generation (Sonnet, with outline + chunk 1 summary + last sentences)
  → Chunk 2 summary extraction (Haiku)
  → Chunk 3 generation (Sonnet, with outline + chunk 2 summary + last sentences)
  → Post-processing (paragraph splitting, number formatting, meta-text stripping)
  → Return parts[]
```

## Technical Approach

### File: `app/api/stories/generate/route.ts`

This is the only file that changes significantly. All modifications are within this single route handler.

#### A. Extract Generation Config Constants

Replace inline magic numbers with a config object at the top of the file:

```typescript
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
```

**Why 8192 max_tokens for content**: The current 4000 limit caps output at ~3000 words, which sometimes truncates chunks aiming for 2500-3000 words. 8192 gives headroom. You only pay for tokens actually generated.

**Why 2500 per chunk instead of [3000, 3000, 2500]**: Even chunk sizes simplify the pipeline. 3 x 2500 = 7500 target. The outline ensures coverage distribution instead of front-loading.

#### B. Rewrite System Prompt

Replace the current `SYSTEM_PROMPT` with an improved version that includes:

1. **A reference paragraph** for tone calibration (few-shot example)
2. **Anti-engagement guardrails** (banned words, banned patterns)
3. **ElevenLabs formatting rules** (spell out numbers, use ellipses, paragraph limits)
4. **Removed duplicate instructions** (style rules currently repeated in both system and user prompts)

```typescript
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
```

#### C. Add Outline Generation Step

After receiving the topic, generate a structured outline before any content:

```typescript
const outlinePrompt = `Create a detailed outline for a sleep-inducing history lecture on "${topic}".

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
   ...`;
```

This call uses `CONFIG.models.content` at `CONFIG.temperature.outline` with `CONFIG.maxTokens.outline`.

#### D. Add Inter-Chunk Context Passing

After generating each content chunk, extract a summary using Haiku:

```typescript
const summaryPrompt = `Summarize this lecture section in exactly 3 sentences:
1. The main subtopic and narrative arc covered.
2. Key proper nouns, place names, and dates mentioned.
3. Where the narrative left off (what was the last thing discussed).

Then list all proper nouns and dates mentioned, comma-separated on a new line after "USED:".

Section:
${chunkContent}`;
```

For each subsequent chunk, the user prompt includes:

```typescript
const userPrompt = `Generate section ${i + 1} of a sleep-inducing history lecture on "${topic}".

LECTURE OUTLINE (follow this structure):
${outline}

THIS SECTION COVERS: Section ${i + 1} of the outline above.
TARGET: approximately ${CONFIG.chunkWordTargets[i]} words.

PREVIOUS SECTION SUMMARY (do not repeat this content):
${previousSummary}

ALREADY-USED NAMES AND DATES (do not re-introduce these):
${usedElements}

CONTINUE NATURALLY FROM THESE LAST SENTENCES:
"${lastThreeSentences}"

Write the lecture content for this section only. Flow naturally from where the previous section ended.`;
```

**Context strategy**: Pass only the immediately preceding chunk's summary (not all prior summaries). The outline already provides the global structure, so accumulated summaries add cost without benefit. The "used elements" list does accumulate across all chunks to prevent repetition.

#### E. Revise Content Generation User Prompt

The current user prompt duplicates most of the system prompt instructions. Strip it down to section-specific instructions only:

```typescript
// For chunk 1 (no previous context):
const firstChunkPrompt = `Generate section 1 of a sleep-inducing history lecture on "${topic}".

LECTURE OUTLINE (follow this structure):
${outline}

THIS SECTION COVERS: Section 1 of the outline above.
TARGET: approximately ${CONFIG.chunkWordTargets[0]} words.

Begin the lecture directly with content. No introductions or preambles.`;

// For chunks 2+: use the context-passing prompt from section D above.
```

#### F. Add Post-Processing Pipeline

After all chunks are generated, run post-processing:

```typescript
function postProcess(content: string): string {
  // 1. Strip meta-text markers (existing + expanded)
  content = content.replace(/\[.*?\]/g, '');

  // 2. Strip asterisk actions
  content = content.replace(/\*[^*]+\*/g, '');

  // 3. Remove exclamation marks (replace with periods)
  content = content.replace(/!/g, '.');

  // 4. Split oversized paragraphs at sentence boundaries
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
    // Split at nearest sentence boundary after maxWords/2
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
```

**Note on number formatting**: Rather than regex-based digit-to-word conversion in post-processing (which is brittle for years, ordinals, and edge cases), the system prompt now instructs Claude to spell out all numbers during generation. The prompt-level instruction with the reference paragraph demonstrating "thirty-three bakeries" and "two pounds" is more reliable than regex post-processing. If digits still slip through occasionally, that is acceptable — ElevenLabs handles simple digit strings adequately.

#### G. Handle the While-Loop Overflow

The current while-loop generates extra chunks if total words fall short. Keep this behavior but integrate it with the context-passing system:

```typescript
while (totalWords < CONFIG.targetWords) {
  const remainingWords = CONFIG.targetWords - totalWords;
  const wordsForPart = Math.min(2500, remainingWords);

  // Generate an overflow chunk using:
  // - The full outline (for context)
  // - Summary of the last generated chunk
  // - Last 3 sentences of the last chunk
  // - Accumulated used-elements list
  // - A new focus area derived from the outline's less-covered subsections
  // ...
}
```

### File: `app/api/stories/topics/route.ts`

**Minor change**: Update model from `claude-sonnet-4-5-20250929` to `claude-3-5-haiku-20241022`. Topic list generation is a simple creative task that doesn't benefit from Sonnet.

### File: `app/components/StoriesTab.tsx`

**Minor change**: Update the timer-based progress messages to reflect the new pipeline stages and adjust timing estimates:

- 0s: "Generating lecture outline..."
- 8s: "Writing section 1..."
- 35s: "Summarizing section 1... Writing section 2..."
- 70s: "Summarizing section 2... Writing section 3..."
- 110s: "Finalizing and formatting for audio..."
- Update the estimate text from "2-3 minutes" to "3-4 minutes"

### File: `app/api/stories/generate/route.ts` (timeout)

Add Vercel function timeout configuration:

```typescript
export const maxDuration = 300; // 5 minutes max for Vercel Pro
```

## Acceptance Criteria

- [x] Outline is generated before content chunks
- [x] Each chunk after the first receives: full outline, previous chunk summary, last 3 sentences, accumulated used-elements list
- [x] System prompt includes reference tone paragraph
- [x] System prompt includes anti-engagement guardrails (banned words list)
- [x] System prompt includes ElevenLabs formatting rules (spell out numbers, ellipses, paragraph limits)
- [x] User prompts no longer duplicate style instructions from system prompt
- [x] Content chunks use temperature 0.5 (down from 0.7)
- [x] Content chunks use max_tokens 8192 (up from 4000)
- [x] Haiku used for topic generation and inter-chunk summaries
- [x] Post-processing strips meta-text, asterisk actions, and exclamation marks
- [x] Post-processing splits paragraphs exceeding 150 words at sentence boundaries
- [x] `maxDuration = 300` exported from the route handler
- [x] Progress messages in StoriesTab.tsx updated to match new pipeline stages
- [x] API response shape unchanged: `{ parts, totalWords, focusAreas }`
- [x] Existing one-click UX preserved — no new UI steps

## Risk Analysis

| Risk | Likelihood | Mitigation |
|------|-----------|------------|
| Vercel function timeout exceeded (>300s) | Medium | Add `maxDuration = 300`. Haiku summary calls are fast (~3-5s each). If still too slow, the overflow while-loop can be capped at 1 extra chunk. |
| Outline format varies between generations | Low | The outline is advisory context, not a parsed structure. Variations in formatting don't break the pipeline — they just change how Claude interprets the section assignment. |
| Mid-pipeline API failure loses all progress | Low | Current behavior (return 500 error) is acceptable for v1. Future improvement: return partial results. |
| Tone still varies despite improvements | Medium | The reference paragraph is the strongest lever. If still inconsistent, the next step would be to curate 3-5 reference paragraphs and rotate them. |
| Haiku produces lower-quality topic lists | Low | Monitor quality. If topics degrade, revert `/api/stories/topics` to Sonnet. |

## Out of Scope

- Streaming responses or server-sent events
- Background job processing
- Multi-step UI with review/approval gates
- Automated quality scoring of generated content
- ElevenLabs API integration (TTS is done separately outside this CMS)
- Changes to History Sleep tab or file management
- Test infrastructure

## References

- Current generation logic: `app/api/stories/generate/route.ts`
- Current topic generation: `app/api/stories/topics/route.ts`
- Frontend component: `app/components/StoriesTab.tsx`
- Previous plan format: `docs/plans/2026-01-31-refactor-remove-meandering-sleep-ui-plan.md`
- WritingPath outline-guided generation: NAACL 2025
- ElevenLabs TTS best practices: paragraphs under 800 chars, spell out numbers, use ellipses for pauses
- Claude prompt engineering: few-shot examples for style consistency, system prompt for persistent rules
