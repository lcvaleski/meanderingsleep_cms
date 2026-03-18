'use client';

import { useState, useEffect, useCallback } from 'react';
import { AudioEntry, HISTORY_CATEGORIES, Category } from '../types/audio';

interface SectionConfig {
  type: 'daily' | 'free' | 'new' | 'all' | 'category';
  title?: string;
  categoryId?: string;
}


const DEFAULT_SECTIONS: SectionConfig[] = [
  { type: 'daily' },
  { type: 'free', title: 'Free' },
  { type: 'new', title: 'New' },
  { type: 'all', title: 'All Lectures' },
];


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
  const [sectionNames, setSectionNames] = useState<Record<string, string>>({
    '__free__': 'Complimentary',
    '__new__': 'New',
    '__all__': 'All Lectures',
  });

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
        if (data.config.sectionNames) setSectionNames(prev => ({ ...prev, ...data.config.sectionNames }));
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

      const config = {
        dailyAudioId: dailyAudioId || undefined,
        freeAudioIds,
        sections,
        audioOrder,
        sectionNames,
        sectionOrder: categoryOrder,
        sectionVisibility: categoryVisibility,
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

  // --- Free track toggle ---
  const toggleFreeTrack = (audioId: string) => {
    setFreeAudioIds(prev =>
      prev.includes(audioId)
        ? prev.filter(id => id !== audioId)
        : [...prev, audioId]
    );
  };



  // --- Audio order within any section ---
  const getAudiosForSection = (sectionId: string): AudioEntry[] => {
    let sectionAudios: AudioEntry[];
    if (sectionId === '__free__') {
      sectionAudios = audios.filter(a => freeAudioIds.includes(a.id));
    } else if (sectionId === '__new__') {
      sectionAudios = audios.filter(a => a.isNew);
    } else if (sectionId === '__all__') {
      sectionAudios = [...audios];
    } else {
      sectionAudios = audios.filter(a => a.category === sectionId);
    }
    const order = audioOrder[sectionId];
    if (!order) return sectionAudios;
    return [...sectionAudios].sort((a, b) => {
      const idxA = order.indexOf(a.id);
      const idxB = order.indexOf(b.id);
      return (idxA === -1 ? 999 : idxA) - (idxB === -1 ? 999 : idxB);
    });
  };

  const moveAudioInSection = (sectionId: string, audioId: string, direction: -1 | 1) => {
    const sorted = getAudiosForSection(sectionId);
    const ids = sorted.map(a => a.id);
    const idx = ids.indexOf(audioId);
    const newIdx = idx + direction;
    if (newIdx < 0 || newIdx >= ids.length) return;
    [ids[idx], ids[newIdx]] = [ids[newIdx], ids[idx]];
    setAudioOrder(prev => ({ ...prev, [sectionId]: ids }));
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

      {/* Home Screen Sections */}
      <div style={{ marginBottom: '30px' }}>
        <h3 style={{ fontSize: '16px', marginBottom: '10px' }}>Home Screen Sections</h3>
        <p style={{ fontSize: '13px', color: '#666', marginBottom: '8px' }}>
          Reorder sections and toggle visibility. Hidden sections won&apos;t appear in the app.
        </p>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid #000' }}>
              <th style={{ textAlign: 'left', padding: '8px 4px' }}>Order</th>
              <th style={{ textAlign: 'left', padding: '8px 4px' }}>Section</th>
              <th style={{ textAlign: 'left', padding: '8px 4px' }}>Visible</th>
            </tr>
          </thead>
          <tbody>
            {(() => {
              // Build unified list of all sections: built-in + categories
              const builtInSections = [
                { id: '__daily__', name: 'Daily Card', isBuiltIn: true },
                { id: '__free__', name: sectionNames['__free__'] || 'Complimentary', isBuiltIn: true },
                { id: '__new__', name: sectionNames['__new__'] || 'New', isBuiltIn: true },
                { id: '__all__', name: sectionNames['__all__'] || 'All Lectures', isBuiltIn: true },
              ];
              const allItems = [
                ...builtInSections.map(s => ({
                  ...s,
                  order: categoryOrder[s.id] ?? (s.id === '__daily__' ? -4 : s.id === '__free__' ? -3 : s.id === '__new__' ? -2 : -1),
                })),
                ...sortedCategoriesForDisplay.map(cat => ({
                  id: cat.id,
                  name: cat.name,
                  isBuiltIn: false,
                  order: categoryOrder[cat.id] ?? 99,
                })),
              ].sort((a, b) => a.order - b.order);

              return allItems.map((item, idx) => {
                const isCategory = !item.isBuiltIn;
                const isDaily = item.id === '__daily__';
                const sectionAudios = isDaily ? [] : getAudiosForSection(item.id);
                const isExpanded = expandedCategory === item.id;
                const isVisible = categoryVisibility[item.id] !== false;

                return (
                  <tr key={item.id} style={{ borderBottom: '1px solid #eee', verticalAlign: 'top' }}>
                    <td style={{ padding: '8px 4px' }}>
                      <button onClick={() => {
                        // Move in unified order
                        const currentOrder = categoryOrder[item.id] ?? item.order;
                        const newOrder = currentOrder - 1;
                        const swapItem = allItems.find(a => (categoryOrder[a.id] ?? a.order) === newOrder);
                        setCategoryOrder(prev => {
                          const updated = { ...prev, [item.id]: newOrder };
                          if (swapItem) updated[swapItem.id] = currentOrder;
                          return updated;
                        });
                      }} disabled={idx === 0} style={smallBtnStyle}>↑</button>
                      <button onClick={() => {
                        const currentOrder = categoryOrder[item.id] ?? item.order;
                        const newOrder = currentOrder + 1;
                        const swapItem = allItems.find(a => (categoryOrder[a.id] ?? a.order) === newOrder);
                        setCategoryOrder(prev => {
                          const updated = { ...prev, [item.id]: newOrder };
                          if (swapItem) updated[swapItem.id] = currentOrder;
                          return updated;
                        });
                      }} disabled={idx === allItems.length - 1} style={smallBtnStyle}>↓</button>
                    </td>
                    <td style={{ padding: '8px 4px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        {!isDaily && sectionAudios.length > 0 && (
                          <span
                            onClick={() => setExpandedCategory(isExpanded ? null : item.id)}
                            style={{ cursor: 'pointer', fontSize: '14px' }}
                          >
                            {isExpanded ? '▼' : '▶'}
                          </span>
                        )}
                        {item.id === '__daily__' ? (
                          <span style={{ fontSize: '14px', fontWeight: 500 }}>{item.name}</span>
                        ) : isCategory ? (
                          <input
                            type="text"
                            value={item.name}
                            onChange={(e) => {
                              setCategories(prev => prev.map(c => c.id === item.id ? { ...c, name: e.target.value } : c));
                            }}
                            style={{ ...inputStyle, width: '180px' }}
                          />
                        ) : (
                          <input
                            type="text"
                            value={sectionNames[item.id] || item.name}
                            onChange={(e) => {
                              setSectionNames(prev => ({ ...prev, [item.id]: e.target.value }));
                            }}
                            style={{ ...inputStyle, width: '180px' }}
                          />
                        )}
                        {!isDaily && sectionAudios.length > 0 && (
                          <span style={{ fontSize: '12px', color: '#999' }}>
                            {sectionAudios.length} title{sectionAudios.length !== 1 ? 's' : ''}
                          </span>
                        )}
                      </div>
                      {!isDaily && isExpanded && sectionAudios.length > 0 && (
                        <div style={{ marginTop: '8px', marginLeft: '16px' }}>
                          {sectionAudios.map((audio, audioIdx) => (
                            <div key={audio.id} style={{ display: 'flex', alignItems: 'center', padding: '3px 0', gap: '6px' }}>
                              <button onClick={() => moveAudioInSection(item.id, audio.id, -1)} disabled={audioIdx === 0} style={smallBtnStyle}>↑</button>
                              <button onClick={() => moveAudioInSection(item.id, audio.id, 1)} disabled={audioIdx === sectionAudios.length - 1} style={smallBtnStyle}>↓</button>
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
                        onClick={() => setCategoryVisibility(prev => ({ ...prev, [item.id]: !isVisible }))}
                        style={{
                          ...smallBtnStyle,
                          background: isVisible ? '#4CAF50' : '#fff',
                          color: isVisible ? '#fff' : '#000',
                        }}
                      >
                        {isVisible ? 'Visible' : 'Hidden'}
                      </button>
                    </td>
                  </tr>
                );
              });
            })()}
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

const smallBtnStyle: React.CSSProperties = {
  padding: '2px 8px',
  border: '1px solid #000',
  background: '#fff',
  cursor: 'pointer',
  fontSize: '13px',
  marginRight: '4px',
};
