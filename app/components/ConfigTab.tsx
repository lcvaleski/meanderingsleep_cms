'use client';

import { useState, useEffect, useCallback } from 'react';
import { AudioEntry, HISTORY_CATEGORIES, Category } from '../types/audio';

interface SectionConfig {
  type: 'daily' | 'free' | 'new' | 'all' | 'category';
  title?: string;
  categoryId?: string;
}

interface AppConfig {
  dailyAudioId?: string;
  freeAudioIds: string[];
  sections: SectionConfig[];
  audioOrder?: Record<string, string[]>;
}

const DEFAULT_SECTIONS: SectionConfig[] = [
  { type: 'daily' },
  { type: 'free', title: 'Free' },
  { type: 'new', title: 'New' },
  { type: 'all', title: 'All Lectures' },
];

const SECTION_LABELS: Record<string, string> = {
  daily: 'Daily Card',
  free: 'Free Section',
  new: 'New Section',
  all: 'All Lectures',
  category: 'Category',
};

export default function ConfigTab() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [audios, setAudios] = useState<AudioEntry[]>([]);
  const [categories, setCategories] = useState<Category[]>(HISTORY_CATEGORIES);

  // Config state
  const [dailyAudioId, setDailyAudioId] = useState<string>('');
  const [freeAudioIds, setFreeAudioIds] = useState<string[]>(['HIST001', 'HIST002', 'HIST005', 'HIST006']);
  const [sections, setSections] = useState<SectionConfig[]>(DEFAULT_SECTIONS);
  const [categoryVisibility, setCategoryVisibility] = useState<Record<string, boolean>>({});
  const [categoryOrder, setCategoryOrder] = useState<Record<string, number>>({});
  const [audioOrder, setAudioOrder] = useState<Record<string, string[]>>({});
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);

  const fetchConfig = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch('/api/config');
      if (!res.ok) throw new Error('Failed to load config');
      const data = await res.json();

      setAudios(data.audios || []);
      if (data.categories) setCategories(data.categories);

      if (data.config) {
        setDailyAudioId(data.config.dailyAudioId || '');
        setFreeAudioIds(data.config.freeAudioIds || ['HIST001', 'HIST002', 'HIST005', 'HIST006']);
        setSections(data.config.sections || DEFAULT_SECTIONS);
        if (data.config.audioOrder) setAudioOrder(data.config.audioOrder);
      }

      // Build visibility/order maps from categories
      const vis: Record<string, boolean> = {};
      const ord: Record<string, number> = {};
      (data.categories || HISTORY_CATEGORIES).forEach((cat: Category & { visible?: boolean; order?: number }, i: number) => {
        vis[cat.id] = cat.visible !== false;
        ord[cat.id] = cat.order ?? i + 1;
      });
      setCategoryVisibility(vis);
      setCategoryOrder(ord);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load config');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchConfig();
  }, [fetchConfig]);

  const handleSave = async () => {
    if (!confirm('Publish this config to all app users?')) return;

    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      // Build updated categories with order/visibility
      const updatedCategories = categories.map(cat => ({
        ...cat,
        order: categoryOrder[cat.id] ?? 1,
        visible: categoryVisibility[cat.id] !== false,
      }));

      const config: AppConfig = {
        dailyAudioId: dailyAudioId || undefined,
        freeAudioIds,
        sections,
        audioOrder,
      };

      const res = await fetch('/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ config, categories: updatedCategories }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save');

      setSuccess('Config published successfully!');
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save config');
    } finally {
      setSaving(false);
    }
  };

  // --- Section management ---
  const addSection = (type: SectionConfig['type']) => {
    const newSection: SectionConfig = { type };
    if (type === 'category') {
      const firstCat = categories[0];
      newSection.categoryId = firstCat?.id || '';
      newSection.title = firstCat?.name || 'Category';
    } else {
      newSection.title = SECTION_LABELS[type] || type;
    }
    setSections([...sections, newSection]);
  };

  const removeSection = (index: number) => {
    setSections(sections.filter((_, i) => i !== index));
  };

  const moveSection = (index: number, direction: -1 | 1) => {
    const newIndex = index + direction;
    if (newIndex < 0 || newIndex >= sections.length) return;
    const newSections = [...sections];
    [newSections[index], newSections[newIndex]] = [newSections[newIndex], newSections[index]];
    setSections(newSections);
  };

  const updateSection = (index: number, updates: Partial<SectionConfig>) => {
    const newSections = [...sections];
    newSections[index] = { ...newSections[index], ...updates };
    setSections(newSections);
  };

  // --- Free track toggle ---
  const toggleFreeTrack = (audioId: string) => {
    setFreeAudioIds(prev =>
      prev.includes(audioId)
        ? prev.filter(id => id !== audioId)
        : [...prev, audioId]
    );
  };

  // --- Category order ---
  const moveCategoryOrder = (catId: string, direction: -1 | 1) => {
    const currentOrder = categoryOrder[catId] ?? 1;
    const newOrder = currentOrder + direction;
    if (newOrder < 1) return;

    // Find the category currently at newOrder and swap
    const swapCatId = Object.entries(categoryOrder).find(([, ord]) => ord === newOrder)?.[0];
    setCategoryOrder(prev => {
      const updated = { ...prev, [catId]: newOrder };
      if (swapCatId) updated[swapCatId] = currentOrder;
      return updated;
    });
  };

  // --- Audio order within category ---
  const getAudiosForCategory = (catId: string): AudioEntry[] => {
    const catAudios = audios.filter(a => a.category === catId);
    const order = audioOrder[catId];
    if (!order) return catAudios;
    return [...catAudios].sort((a, b) => {
      const idxA = order.indexOf(a.id);
      const idxB = order.indexOf(b.id);
      return (idxA === -1 ? 999 : idxA) - (idxB === -1 ? 999 : idxB);
    });
  };

  const moveAudioInCategory = (catId: string, audioId: string, direction: -1 | 1) => {
    const sorted = getAudiosForCategory(catId);
    const ids = sorted.map(a => a.id);
    const idx = ids.indexOf(audioId);
    const newIdx = idx + direction;
    if (newIdx < 0 || newIdx >= ids.length) return;
    [ids[idx], ids[newIdx]] = [ids[newIdx], ids[idx]];
    setAudioOrder(prev => ({ ...prev, [catId]: ids }));
  };

  if (loading) return <p>Loading config...</p>;

  const sortedCategoriesForDisplay = [...categories].sort(
    (a, b) => (categoryOrder[a.id] ?? 99) - (categoryOrder[b.id] ?? 99)
  );

  return (
    <div>
      {error && (
        <div style={{ color: 'red', padding: '10px', border: '1px solid red', marginBottom: '20px' }}>
          {error}
        </div>
      )}
      {success && (
        <div style={{ color: 'green', padding: '10px', border: '1px solid green', marginBottom: '20px' }}>
          {success}
        </div>
      )}

      {/* Daily Audio */}
      <div style={{ marginBottom: '30px' }}>
        <h3 style={{ fontSize: '16px', marginBottom: '10px' }}>Daily Audio</h3>
        <p style={{ fontSize: '13px', color: '#666', marginBottom: '8px' }}>
          Pick which track shows as &quot;Today&apos;s History&quot;. Leave on Auto for date-based rotation.
        </p>
        <select
          value={dailyAudioId}
          onChange={(e) => setDailyAudioId(e.target.value)}
          style={selectStyle}
        >
          <option value="">Auto (date-seeded rotation)</option>
          {audios.map(audio => (
            <option key={audio.id} value={audio.id}>
              {audio.title || audio.id}
            </option>
          ))}
        </select>
      </div>

      {/* Free Tracks */}
      <div style={{ marginBottom: '30px' }}>
        <h3 style={{ fontSize: '16px', marginBottom: '10px' }}>Free Tracks</h3>
        <p style={{ fontSize: '13px', color: '#666', marginBottom: '8px' }}>
          These tracks are available without a subscription. At least one required.
        </p>
        <div style={{ maxHeight: '200px', overflowY: 'auto', border: '1px solid #ddd', padding: '8px' }}>
          {audios.map(audio => (
            <label key={audio.id} style={{ display: 'block', padding: '4px 0', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={freeAudioIds.includes(audio.id)}
                onChange={() => toggleFreeTrack(audio.id)}
                style={{ marginRight: '8px' }}
              />
              <span style={{ fontSize: '14px' }}>
                {audio.title || audio.id}
                <span style={{ color: '#999', marginLeft: '8px' }}>{audio.id}</span>
              </span>
            </label>
          ))}
        </div>
        <div style={{ fontSize: '13px', color: '#666', marginTop: '5px' }}>
          {freeAudioIds.length} free track{freeAudioIds.length !== 1 ? 's' : ''} selected
        </div>
      </div>

      {/* Section Ordering */}
      <div style={{ marginBottom: '30px' }}>
        <h3 style={{ fontSize: '16px', marginBottom: '10px' }}>Home Screen Sections</h3>
        <p style={{ fontSize: '13px', color: '#666', marginBottom: '8px' }}>
          Control which sections appear on the app home screen and in what order.
        </p>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid #000' }}>
              <th style={{ textAlign: 'left', padding: '8px 4px' }}>Order</th>
              <th style={{ textAlign: 'left', padding: '8px 4px' }}>Type</th>
              <th style={{ textAlign: 'left', padding: '8px 4px' }}>Title</th>
              <th style={{ textAlign: 'left', padding: '8px 4px' }}>Category</th>
              <th style={{ textAlign: 'left', padding: '8px 4px' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {sections.map((section, index) => (
              <tr key={index} style={{ borderBottom: '1px solid #eee' }}>
                <td style={{ padding: '8px 4px' }}>
                  <button onClick={() => moveSection(index, -1)} disabled={index === 0} style={smallBtnStyle}>↑</button>
                  <button onClick={() => moveSection(index, 1)} disabled={index === sections.length - 1} style={smallBtnStyle}>↓</button>
                </td>
                <td style={{ padding: '8px 4px', fontSize: '14px' }}>
                  {SECTION_LABELS[section.type] || section.type}
                </td>
                <td style={{ padding: '8px 4px' }}>
                  {section.type !== 'daily' && (
                    <input
                      type="text"
                      value={section.title || ''}
                      onChange={(e) => updateSection(index, { title: e.target.value })}
                      style={{ ...inputStyle, width: '150px' }}
                    />
                  )}
                </td>
                <td style={{ padding: '8px 4px' }}>
                  {section.type === 'category' && (
                    <select
                      value={section.categoryId || ''}
                      onChange={(e) => {
                        const cat = categories.find(c => c.id === e.target.value);
                        updateSection(index, {
                          categoryId: e.target.value,
                          title: cat?.name || e.target.value,
                        });
                      }}
                      style={{ ...selectStyle, width: '180px' }}
                    >
                      {categories.map(cat => (
                        <option key={cat.id} value={cat.id}>{cat.name}</option>
                      ))}
                    </select>
                  )}
                </td>
                <td style={{ padding: '8px 4px' }}>
                  <button onClick={() => removeSection(index)} style={smallBtnStyle}>Remove</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div style={{ marginTop: '10px', display: 'flex', gap: '8px' }}>
          <button onClick={() => addSection('category')} style={btnStyle}>+ Category Section</button>
          <button onClick={() => addSection('daily')} style={btnStyle}>+ Daily</button>
          <button onClick={() => addSection('free')} style={btnStyle}>+ Free</button>
          <button onClick={() => addSection('new')} style={btnStyle}>+ New</button>
          <button onClick={() => addSection('all')} style={btnStyle}>+ All</button>
        </div>
      </div>

      {/* Category Visibility & Order */}
      <div style={{ marginBottom: '30px' }}>
        <h3 style={{ fontSize: '16px', marginBottom: '10px' }}>Categories</h3>
        <p style={{ fontSize: '13px', color: '#666', marginBottom: '8px' }}>
          Toggle visibility and reorder categories. Hidden categories won&apos;t appear in the app.
        </p>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid #000' }}>
              <th style={{ textAlign: 'left', padding: '8px 4px' }}>Order</th>
              <th style={{ textAlign: 'left', padding: '8px 4px' }}>Category</th>
              <th style={{ textAlign: 'left', padding: '8px 4px' }}>Visible</th>
            </tr>
          </thead>
          <tbody>
            {sortedCategoriesForDisplay.map((cat) => {
              const catAudios = getAudiosForCategory(cat.id);
              const isExpanded = expandedCategory === cat.id;
              return (
                <tr key={cat.id} style={{ borderBottom: '1px solid #eee', verticalAlign: 'top' }}>
                  <td style={{ padding: '8px 4px' }}>
                    <button onClick={() => moveCategoryOrder(cat.id, -1)} style={smallBtnStyle}>↑</button>
                    <button onClick={() => moveCategoryOrder(cat.id, 1)} style={smallBtnStyle}>↓</button>
                    <span style={{ marginLeft: '8px', fontSize: '13px', color: '#999' }}>
                      {categoryOrder[cat.id] ?? '—'}
                    </span>
                  </td>
                  <td style={{ padding: '8px 4px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span
                        onClick={() => setExpandedCategory(isExpanded ? null : cat.id)}
                        style={{ cursor: 'pointer', fontSize: '14px' }}
                      >
                        {isExpanded ? '▼' : '▶'}
                      </span>
                      <input
                        type="text"
                        value={cat.name}
                        onChange={(e) => {
                          setCategories(prev => prev.map(c => c.id === cat.id ? { ...c, name: e.target.value } : c));
                        }}
                        style={{ ...inputStyle, width: '180px' }}
                      />
                      <span style={{ fontSize: '12px', color: '#999' }}>
                        {catAudios.length} title{catAudios.length !== 1 ? 's' : ''}
                      </span>
                    </div>
                    {isExpanded && catAudios.length > 0 && (
                      <div style={{ marginTop: '8px', marginLeft: '16px' }}>
                        {catAudios.map((audio, idx) => (
                          <div key={audio.id} style={{ display: 'flex', alignItems: 'center', padding: '3px 0', gap: '6px' }}>
                            <button onClick={() => moveAudioInCategory(cat.id, audio.id, -1)} disabled={idx === 0} style={smallBtnStyle}>↑</button>
                            <button onClick={() => moveAudioInCategory(cat.id, audio.id, 1)} disabled={idx === catAudios.length - 1} style={smallBtnStyle}>↓</button>
                            <span style={{ fontSize: '13px' }}>
                              {audio.title || audio.id}
                              <span style={{ color: '#999', marginLeft: '6px', fontSize: '12px' }}>{audio.id}</span>
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </td>
                  <td style={{ padding: '8px 4px' }}>
                    <button
                      onClick={() => setCategoryVisibility(prev => ({ ...prev, [cat.id]: !prev[cat.id] }))}
                      style={{
                        ...smallBtnStyle,
                        background: categoryVisibility[cat.id] !== false ? '#4CAF50' : '#fff',
                        color: categoryVisibility[cat.id] !== false ? '#fff' : '#000',
                      }}
                    >
                      {categoryVisibility[cat.id] !== false ? 'Visible' : 'Hidden'}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Save Button */}
      <div style={{ borderTop: '1px solid #000', paddingTop: '20px' }}>
        <button
          onClick={handleSave}
          disabled={saving || freeAudioIds.length === 0}
          style={{
            padding: '10px 30px',
            border: '1px solid #000',
            background: saving ? '#ccc' : '#000',
            color: '#fff',
            cursor: saving ? 'default' : 'pointer',
            fontSize: '16px',
          }}
        >
          {saving ? 'Publishing...' : 'Publish Config'}
        </button>
        {freeAudioIds.length === 0 && (
          <span style={{ color: 'red', marginLeft: '10px', fontSize: '13px' }}>
            At least one free track required
          </span>
        )}
      </div>
    </div>
  );
}

// Shared styles
const inputStyle: React.CSSProperties = {
  padding: '4px 8px',
  border: '1px solid #000',
  fontSize: '14px',
  fontFamily: 'inherit',
};

const selectStyle: React.CSSProperties = {
  padding: '5px',
  border: '1px solid #000',
  fontSize: '14px',
  fontFamily: 'inherit',
};

const btnStyle: React.CSSProperties = {
  padding: '5px 12px',
  border: '1px solid #000',
  background: '#fff',
  cursor: 'pointer',
  fontSize: '13px',
};

const smallBtnStyle: React.CSSProperties = {
  padding: '2px 8px',
  border: '1px solid #000',
  background: '#fff',
  cursor: 'pointer',
  fontSize: '13px',
  marginRight: '4px',
};
