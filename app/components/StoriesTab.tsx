'use client';

import { useState, useEffect } from 'react';

interface GeneratedPart {
  content: string;
  wordCount: number;
  partNumber: number;
  focusArea?: string;
}

export default function StoriesTab() {
  const [topics, setTopics] = useState<string[]>([]);
  const [selectedTopic, setSelectedTopic] = useState<string>('');
  const [customTopic, setCustomTopic] = useState<string>('');
  const [generatingTopics, setGeneratingTopics] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [generatedParts, setGeneratedParts] = useState<GeneratedPart[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [progressMessage, setProgressMessage] = useState<string>('');
  const [currentPart, setCurrentPart] = useState<number>(0);
  const [totalParts, setTotalParts] = useState<number>(0);

  const loadTopics = async () => {
    setGeneratingTopics(true);
    setError(null);
    try {
      const res = await fetch('/api/stories/topics');
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Failed to generate topics');
      }
      const data = await res.json();
      setTopics(data.topics || []);
    } catch (error) {
      console.error('Error loading topics:', error);
      setError('Failed to generate topics. Check ANTHROPIC_API_KEY and credits.');
    } finally {
      setGeneratingTopics(false);
    }
  };

  useEffect(() => {
    loadTopics();
  }, []);

  const generateStory = async () => {
    const topic = customTopic || selectedTopic;
    if (!topic) {
      setError('Select a topic or enter a custom one');
      return;
    }

    console.log('Starting story generation for topic:', topic);
    setGenerating(true);
    setError(null);
    setGeneratedParts([]);
    setProgressMessage('Initializing story generation...');
    setCurrentPart(0);
    setTotalParts(3);

    try {
      // Initial setup
      console.log('Setting initial progress message');
      setProgressMessage('Analyzing topic and generating focus areas...');
      
      // Use refs to track if still generating
      let isStillGenerating = true;
      
      // Setup progress updates
      const timer1 = setTimeout(() => {
        console.log('Timer 1 fired - 5 seconds');
        if (isStillGenerating) {
          setCurrentPart(1);
          setProgressMessage('Writing Part 1: Historical context and background...');
          console.log('Updated to Part 1');
        }
      }, 5000);
      
      const timer2 = setTimeout(() => {
        console.log('Timer 2 fired - 25 seconds');
        if (isStillGenerating) {
          setCurrentPart(2);
          setProgressMessage('Writing Part 2: Daily activities and routines...');
          console.log('Updated to Part 2');
        }
      }, 25000);
      
      const timer3 = setTimeout(() => {
        console.log('Timer 3 fired - 45 seconds');
        if (isStillGenerating) {
          setCurrentPart(3);
          setProgressMessage('Writing Part 3: Cultural impact and legacy...');
          console.log('Updated to Part 3');
        }
      }, 45000);
      
      const timer4 = setTimeout(() => {
        console.log('Timer 4 fired - 65 seconds');
        if (isStillGenerating) {
          setProgressMessage('Checking word count and generating additional content if needed...');
          console.log('Checking word count');
        }
      }, 65000);

      console.log('Making API request to /api/stories/generate');
      const res = await fetch('/api/stories/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic,
          generateFull: true,
        }),
      });

      console.log('API response status:', res.status);
      
      if (!res.ok) {
        const errorData = await res.json();
        console.error('API error response:', errorData);
        throw new Error(errorData.error || 'Failed to generate story');
      }

      const data = await res.json();
      console.log('Story generated successfully. Parts:', data.parts?.length, 'Total words:', data.totalWords);
      
      isStillGenerating = false;
      clearTimeout(timer1);
      clearTimeout(timer2);
      clearTimeout(timer3);
      clearTimeout(timer4);
      
      setGeneratedParts(data.parts || []);
      setProgressMessage('');
      
    } catch (error) {
      console.error('Error generating story:', error);
      setError(error instanceof Error ? error.message : 'Failed to generate story');
      setProgressMessage('');
    } finally {
      console.log('Generation complete, cleaning up');
      setGenerating(false);
      setCurrentPart(0);
      setTotalParts(0);
    }
  };

  const downloadStory = () => {
    if (generatedParts.length === 0) return;

    const topic = customTopic || selectedTopic;
    const fullContent = generatedParts.map(part => part.content).join('\n\n');
    const totalWords = generatedParts.reduce((sum, part) => sum + part.wordCount, 0);
    const estimatedMinutes = Math.round(totalWords / 150);

    const header = `SLEEP-INDUCING HISTORY LECTURE
Topic: ${topic}
Generated: ${new Date().toISOString()}
Total Words: ${totalWords.toLocaleString()}
Total Characters: ${fullContent.length.toLocaleString()}
Estimated Audio Duration: ${estimatedMinutes} minutes (at 150 wpm)
---

`;

    const blob = new Blob([header + fullContent], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `lecture_${topic.replace(/[^a-z0-9]/gi, '_')}_${Date.now()}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div>
      <h2 style={{ fontSize: '18px', marginBottom: '15px' }}>Story Generation</h2>
      
      <div style={{ marginBottom: '20px' }}>
        <h3 style={{ fontSize: '16px', marginBottom: '10px' }}>Select a topic:</h3>
        {generatingTopics ? (
          <p>Loading topics...</p>
        ) : topics.length > 0 ? (
          <div style={{ 
            border: '1px solid #000', 
            padding: '10px',
            maxHeight: '300px',
            overflowY: 'auto',
            marginBottom: '10px'
          }}>
            {topics.map((topic, index) => (
              <div key={index} style={{ marginBottom: '8px' }}>
                <a
                  href="#"
                  onClick={(e) => {
                    e.preventDefault();
                    setSelectedTopic(topic);
                    setCustomTopic('');
                  }}
                  style={{ 
                    color: '#000',
                    textDecoration: selectedTopic === topic ? 'underline' : 'none',
                    display: 'block',
                    padding: '2px 0'
                  }}
                >
                  {topic}
                </a>
              </div>
            ))}
          </div>
        ) : (
          <p>No topics available</p>
        )}
        <button
          onClick={loadTopics}
          disabled={generatingTopics || generating}
          style={{ 
            padding: '5px 15px', 
            border: '1px solid #000',
            background: (generatingTopics || generating) ? '#ccc' : '#fff',
            cursor: (generatingTopics || generating) ? 'default' : 'pointer',
            fontSize: '14px'
          }}
        >
          Refresh Topics
        </button>
      </div>

      <div style={{ marginBottom: '20px' }}>
        <label style={{ display: 'block', marginBottom: '5px' }}>Or enter custom topic:</label>
        <input
          type="text"
          value={customTopic}
          onChange={(e) => {
            setCustomTopic(e.target.value);
            setSelectedTopic('');
          }}
          placeholder="e.g., Daily life of a medieval blacksmith"
          style={{ 
            width: '100%', 
            padding: '5px', 
            border: '1px solid #000',
            fontSize: '16px',
            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen, Ubuntu, Cantarell, "Fira Sans", "Droid Sans", "Helvetica Neue", sans-serif'
          }}
          disabled={generating}
        />
      </div>

      {selectedTopic && (
        <div style={{ marginBottom: '10px', padding: '10px', background: '#f5f5f5', border: '1px solid #000' }}>
          <strong>Selected:</strong> {selectedTopic}
        </div>
      )}

      {error && (
        <div style={{ color: 'red', marginBottom: '10px' }}>
          {error}
        </div>
      )}

      <button
        onClick={generateStory}
        disabled={generating || (!selectedTopic && !customTopic)}
        style={{ 
          padding: '8px 20px', 
          border: '1px solid #000',
          background: (generating || (!selectedTopic && !customTopic)) ? '#ccc' : '#fff',
          cursor: (generating || (!selectedTopic && !customTopic)) ? 'default' : 'pointer',
          fontSize: '16px',
          marginBottom: '20px'
        }}
      >
        {generating ? 'Generating...' : 'Generate 45-Minute Story'}
      </button>

      {generating && progressMessage && (
        <div style={{ 
          padding: '15px', 
          border: '1px solid #000', 
          marginBottom: '20px',
          background: '#f9f9f9'
        }}>
          <div style={{ marginBottom: '10px' }}>
            <strong>{progressMessage}</strong>
          </div>
          {totalParts > 0 && (
            <div>
              <div style={{ marginBottom: '5px' }}>
                Part {currentPart} of {totalParts}
              </div>
              <div style={{ 
                width: '100%', 
                height: '10px', 
                border: '1px solid #000',
                background: '#fff'
              }}>
                <div style={{ 
                  width: `${(currentPart / totalParts) * 100}%`,
                  height: '100%',
                  background: '#000',
                  transition: 'width 0.3s'
                }} />
              </div>
            </div>
          )}
          <div style={{ marginTop: '10px', fontSize: '14px', color: '#666' }}>
            This will take approximately 2-3 minutes to generate a full 45-minute lecture...
          </div>
        </div>
      )}

      {generatedParts.length > 0 && (
        <div style={{ borderTop: '1px solid #000', paddingTop: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
            <h3 style={{ fontSize: '18px', margin: 0 }}>
              Generated Story ({generatedParts.reduce((sum, part) => sum + part.wordCount, 0).toLocaleString()} words / {Math.round(generatedParts.reduce((sum, part) => sum + part.wordCount, 0) / 150)} minutes)
            </h3>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                onClick={() => {
                  const fullContent = generatedParts.map(part => part.content).join('\n\n');
                  navigator.clipboard.writeText(fullContent);
                }}
                style={{ 
                  padding: '5px 15px', 
                  border: '1px solid #000',
                  background: '#fff',
                  cursor: 'pointer',
                  fontSize: '14px'
                }}
              >
                Copy
              </button>
              <button
                onClick={downloadStory}
                style={{ 
                  padding: '5px 15px', 
                  border: '1px solid #000',
                  background: '#fff',
                  cursor: 'pointer',
                  fontSize: '14px'
                }}
              >
                Download
              </button>
            </div>
          </div>
          
          <textarea
            value={generatedParts.map(part => part.content).join('\n\n')}
            readOnly
            style={{ 
              width: '100%', 
              height: '400px',
              padding: '10px',
              border: '1px solid #000',
              fontSize: '14px',
              fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen, Ubuntu, Cantarell, "Fira Sans", "Droid Sans", "Helvetica Neue", sans-serif',
              lineHeight: '1.6',
              resize: 'vertical'
            }}
          />
        </div>
      )}
    </div>
  );
}