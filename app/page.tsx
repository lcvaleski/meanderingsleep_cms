'use client';

import { useState, useEffect, useCallback } from 'react';
import { signOut } from 'next-auth/react';
import StoriesTab from './components/StoriesTab';
import ConfigTab from './components/ConfigTab';
import { AudioFile, AudioEntry, Category, HISTORY_CATEGORIES } from './types/audio';

export default function Home() {
  const [activeTab, setActiveTab] = useState<'history' | 'stories' | 'config'>('history');
  const [audioFiles, setAudioFiles] = useState<AudioFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [voiceName, setVoiceName] = useState('');
  const [selectedVoiceFilter, setSelectedVoiceFilter] = useState<string>('all');
  const [availableVoices, setAvailableVoices] = useState<string[]>([]);
  const [jsonData, setJsonData] = useState<AudioEntry[]>([]);
  const [isNew, setIsNew] = useState(false);
  const [category, setCategory] = useState<string>('');
  const [editingCategory, setEditingCategory] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState<string | null>(null);
  const [categories, setCategories] = useState<Category[]>(HISTORY_CATEGORIES);
  const [creatingCategory, setCreatingCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newCategoryId, setNewCategoryId] = useState('');
  const [audioDuration, setAudioDuration] = useState<number | null>(null);

  const fetchAudioFiles = useCallback(async () => {
    try {
      const res = await fetch('/api/files?folder=boringhistory');
      const data = await res.json();
      if (data.files) {
        setAudioFiles(data.files);
      }

      try {
        const jsonRes = await fetch(`https://storage.googleapis.com/active-audio/history-audio-list.json?t=${Date.now()}`);
        if (jsonRes.ok) {
          const jsonContent = await jsonRes.json();
          if (jsonContent.audios) {
            setJsonData(jsonContent.audios);
            const voices = [...new Set(jsonContent.audios.map((item: AudioEntry) => item.voice).filter((v: string | undefined) => v))] as string[];
            setAvailableVoices(voices);
          }
          if (jsonContent.categories && Array.isArray(jsonContent.categories)) {
            setCategories(jsonContent.categories);
          }
        }
      } catch (jsonError) {
        console.error('Error fetching JSON data:', jsonError);
      }
    } catch (error) {
      console.error('Error fetching files:', error);
      setError('Failed to fetch files');
    } finally {
      setLoading(false);
    }
  }, []);

  const handleToggleNew = async (fileName: string, currentIsNew: boolean) => {
    try {
      const res = await fetch('/api/files/toggle-new', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          fileName,
          isNew: !currentIsNew,
        }),
      });
      
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to toggle new status');
      }
      
      await fetchAudioFiles();
    } catch (error) {
      console.error('Error toggling new status:', error);
      setError(error instanceof Error ? error.message : 'Failed to toggle new status');
    }
  };

  const handleTitleUpdate = async (fileName: string, newTitle: string) => {
    try {
      const res = await fetch('/api/files/update-title', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileName, title: newTitle }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to update title');
      }
      setEditingTitle(null);
      await fetchAudioFiles();
    } catch (error) {
      console.error('Error updating title:', error);
      setError(error instanceof Error ? error.message : 'Failed to update title');
    }
  };

  const handleCategoryUpdate = async (fileName: string, newCategory: string) => {
    try {
      const res = await fetch('/api/files/update-category', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          fileName,
          category: newCategory,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to update category');
      }

      setEditingCategory(null);
      await fetchAudioFiles();
    } catch (error) {
      console.error('Error updating category:', error);
      setError(error instanceof Error ? error.message : 'Failed to update category');
    }
  };

  const handleImageUpdate = async (fileName: string, newImageUrl: string) => {
    try {
      const res = await fetch('/api/files/update-image', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          fileName,
          imageUrl: newImageUrl,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to update image URL');
      }

      await fetchAudioFiles();
    } catch (error) {
      console.error('Error updating image URL:', error);
      setError(error instanceof Error ? error.message : 'Failed to update image URL');
    }
  };

  const handleImageDrop = async (fileName: string, file: File) => {
    setUploadingImage(fileName);
    try {
      // Get signed URL for image upload
      const ext = file.name.split('.').pop() || 'jpg';
      const imageFileName = `${fileName.replace('.mp3', '')}_${Date.now()}.${ext}`;
      const res = await fetch('/api/files/upload-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileName: imageFileName, contentType: file.type }),
      });

      if (!res.ok) throw new Error('Failed to get upload URL');

      const { signedUrl, publicUrl } = await res.json();

      // Upload image to GCS
      const uploadRes = await fetch(signedUrl, {
        method: 'PUT',
        body: file,
        headers: {
          'Content-Type': file.type,
          'x-goog-acl': 'public-read',
        },
      });

      if (!uploadRes.ok) throw new Error('Failed to upload image');

      // Update the JSON with the new image URL
      await handleImageUpdate(fileName, publicUrl);
    } catch (error) {
      console.error('Error uploading image:', error);
      setError(error instanceof Error ? error.message : 'Failed to upload image');
    } finally {
      setUploadingImage(null);
      setDragOver(null);
    }
  };

  const handleDelete = async (fileName: string) => {
    if (!confirm(`Delete ${fileName}?`)) {
      return;
    }
    
    try {
      const res = await fetch(`/api/files?fileName=${encodeURIComponent(fileName)}&folder=boringhistory`, {
        method: 'DELETE',
      });
      
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to delete file');
      }
      
      await fetchAudioFiles();
    } catch (error) {
      console.error('Error deleting file:', error);
      setError(error instanceof Error ? error.message : 'Failed to delete file');
    }
  };

  useEffect(() => {
    if (activeTab !== 'stories') {
      fetchAudioFiles();
    }
  }, [activeTab, fetchAudioFiles]);

  const handleLogout = async () => {
    await signOut({ callbackUrl: '/login' });
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setError(null);
      setAudioDuration(null);
      // Extract duration using HTML Audio element
      const url = URL.createObjectURL(file);
      const audio = new Audio(url);
      audio.addEventListener('loadedmetadata', () => {
        if (audio.duration && isFinite(audio.duration)) {
          setAudioDuration(Math.round(audio.duration));
        }
        URL.revokeObjectURL(url);
      });
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) return;
    
    setUploading(true);
    setError(null);
    
    try {
      if (!title.trim()) {
        setError('Title required');
        setUploading(false);
        return;
      }
      
      if (!voiceName.trim()) {
        setError('Voice name required');
        setUploading(false);
        return;
      }

      const signedUrlResponse = await fetch('/api/files/signed-url', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title,
          folder: 'boringhistory',
          voiceName,
          isNew,
          category,
        }),
      });

      if (!signedUrlResponse.ok) {
        const errorData = await signedUrlResponse.json();
        throw new Error(errorData.error || 'Failed to get upload URL');
      }

      const { signedUrl, uploadPath, id } = await signedUrlResponse.json();

      const uploadResponse = await fetch(signedUrl, {
        method: 'PUT',
        body: selectedFile,
        headers: {
          'Content-Type': 'audio/mpeg',
          'x-goog-acl': 'public-read',
        },
      });

      if (!uploadResponse.ok) {
        throw new Error('Failed to upload file to storage');
      }

      const updateJsonResponse = await fetch('/api/files/update-json', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          id,
          uploadPath,
          title,
          folder: 'boringhistory',
          voiceName,
          isNew,
          category,
          categories,
          duration: audioDuration,
        }),
      });

      if (!updateJsonResponse.ok) {
        const errorData = await updateJsonResponse.json();
        throw new Error(errorData.error || 'Failed to update JSON');
      }

      setSelectedFile(null);
      setTitle('');
      setVoiceName('');
      setIsNew(false);
      setCategory('');
      setAudioDuration(null);
      await fetchAudioFiles();
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  };


  return (
    <div style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen, Ubuntu, Cantarell, "Fira Sans", "Droid Sans", "Helvetica Neue", sans-serif', maxWidth: '1200px', margin: '0 auto', padding: '20px' }}>
      <div style={{ borderBottom: '1px solid #000', paddingBottom: '10px', marginBottom: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h1 style={{ fontSize: '24px', margin: 0 }}>Sleep CMS</h1>
          <button 
            onClick={handleLogout}
            style={{ 
              background: 'none', 
              border: '1px solid #000', 
              padding: '5px 10px', 
              cursor: 'pointer',
              fontSize: '14px'
            }}
          >
            Logout
          </button>
        </div>
        <div style={{ marginTop: '15px' }}>
          <a
            href="#"
            onClick={(e) => { e.preventDefault(); setActiveTab('history'); }}
            style={{
              marginRight: '20px',
              textDecoration: activeTab === 'history' ? 'underline' : 'none',
              color: '#000'
            }}
          >
            Upload
          </a>
          <a
            href="#"
            onClick={(e) => { e.preventDefault(); setActiveTab('config'); }}
            style={{
              textDecoration: activeTab === 'config' ? 'underline' : 'none',
              color: '#000'
            }}
          >
            App Config
          </a>
        </div>
      </div>
      
      {activeTab === 'config' ? (
        <ConfigTab />
      ) : activeTab === 'stories' ? (
        <StoriesTab />
      ) : (
        <>
          <div style={{ marginBottom: '30px' }}>
            <h2 style={{ fontSize: '18px', marginBottom: '15px' }}>Upload New Audio</h2>
            
            <div style={{ marginBottom: '10px' }}>
              <label style={{ display: 'block', marginBottom: '5px' }}>Title:</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                style={{ 
                  width: '100%', 
                  padding: '5px', 
                  border: '1px solid #000',
                  fontSize: '16px',
                  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen, Ubuntu, Cantarell, "Fira Sans", "Droid Sans", "Helvetica Neue", sans-serif'
                }}
              />
            </div>
            
            <div style={{ marginBottom: '10px' }}>
              <label style={{ display: 'block', marginBottom: '5px' }}>Voice Name:</label>
              <input
                type="text"
                value={voiceName}
                onChange={(e) => setVoiceName(e.target.value)}
                style={{
                  width: '100%',
                  padding: '5px',
                  border: '1px solid #000',
                  fontSize: '16px',
                  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen, Ubuntu, Cantarell, "Fira Sans", "Droid Sans", "Helvetica Neue", sans-serif'
                }}
              />
            </div>
            <div style={{ marginBottom: '10px' }}>
              <label style={{ display: 'block', marginBottom: '5px' }}>Category:</label>
              {creatingCategory ? (
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <input
                    type="text"
                    placeholder="Category name"
                    value={newCategoryName}
                    onChange={(e) => {
                      setNewCategoryName(e.target.value);
                      setNewCategoryId(e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''));
                    }}
                    autoFocus
                    style={{
                      flex: 1,
                      padding: '5px',
                      border: '1px solid #000',
                      fontSize: '16px',
                      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen, Ubuntu, Cantarell, "Fira Sans", "Droid Sans", "Helvetica Neue", sans-serif'
                    }}
                  />
                  <button
                    onClick={async () => {
                      if (newCategoryName.trim() && newCategoryId.trim()) {
                        const newCat = { id: newCategoryId, name: newCategoryName.trim() };
                        const updated = [...categories, newCat];
                        setCategories(updated);
                        setCategory(newCategoryId);
                        setCreatingCategory(false);
                        setNewCategoryName('');
                        setNewCategoryId('');
                        // Persist to JSON file immediately
                        try {
                          await fetch('/api/config', {
                            method: 'PUT',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ categories: updated }),
                          });
                        } catch (err) {
                          console.error('Failed to save new category:', err);
                        }
                      }
                    }}
                    disabled={!newCategoryName.trim()}
                    style={{
                      padding: '5px 10px',
                      border: '1px solid #000',
                      background: newCategoryName.trim() ? '#fff' : '#ccc',
                      cursor: newCategoryName.trim() ? 'pointer' : 'default',
                      fontSize: '16px'
                    }}
                  >
                    Add
                  </button>
                  <button
                    onClick={() => {
                      setCreatingCategory(false);
                      setNewCategoryName('');
                      setNewCategoryId('');
                    }}
                    style={{
                      padding: '5px 10px',
                      border: '1px solid #000',
                      background: '#fff',
                      cursor: 'pointer',
                      fontSize: '16px'
                    }}
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <select
                  value={category}
                  onChange={(e) => {
                    if (e.target.value === '__new__') {
                      setCreatingCategory(true);
                    } else {
                      setCategory(e.target.value);
                    }
                  }}
                  style={{
                    width: '100%',
                    padding: '5px',
                    border: '1px solid #000',
                    fontSize: '16px',
                    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen, Ubuntu, Cantarell, "Fira Sans", "Droid Sans", "Helvetica Neue", sans-serif'
                  }}
                >
                  <option value="">Select a category</option>
                  {categories.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.name}
                    </option>
                  ))}
                  <option value="__new__">+ Create new category</option>
                </select>
              )}
            </div>
            <div style={{ marginBottom: '10px' }}>
              <label style={{ display: 'block', marginBottom: '5px' }}>
                <input
                  type="checkbox"
                  checked={isNew}
                  onChange={(e) => setIsNew(e.target.checked)}
                  style={{ marginRight: '5px' }}
                />
                Mark as New
              </label>
            </div>
            
            <div style={{ marginBottom: '10px' }}>
              <label style={{ display: 'block', marginBottom: '5px' }}>Audio File:</label>
              <input
                type="file"
                accept="audio/*"
                onChange={handleFileSelect}
                disabled={uploading}
                style={{ fontSize: '16px' }}
              />
            </div>
            
            {selectedFile && (
              <div style={{ marginBottom: '10px' }}>
                Selected: {selectedFile.name}
                {audioDuration && (
                  <span style={{ marginLeft: '10px', color: '#666' }}>
                    ({Math.floor(audioDuration / 60)}:{String(audioDuration % 60).padStart(2, '0')})
                  </span>
                )}
              </div>
            )}
            
            {error && (
              <div style={{ color: 'red', marginBottom: '10px' }}>
                {error}
              </div>
            )}
            
            <button
              onClick={handleUpload}
              disabled={!selectedFile || !title.trim() || uploading}
              style={{ 
                padding: '5px 15px', 
                border: '1px solid #000',
                background: (!selectedFile || !title.trim() || uploading) ? '#ccc' : '#fff',
                cursor: (!selectedFile || !title.trim() || uploading) ? 'default' : 'pointer',
                fontSize: '16px'
              }}
            >
              {uploading ? 'Uploading...' : 'Upload'}
            </button>
          </div>

          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '15px', marginBottom: '15px' }}>
              <h2 style={{ fontSize: '18px', margin: 0 }}>
                History Sleep Files
              </h2>
              {jsonData.some(a => !a.duration) && (
                <button
                  onClick={async () => {
                    const missing = jsonData.filter(a => !a.duration);
                    if (missing.length === 0) return;
                    setError(null);
                    const durations: Record<string, number> = {};
                    let done = 0;

                    for (const audio of missing) {
                      try {
                        const dur = await new Promise<number>((resolve, reject) => {
                          const el = new Audio(`https://storage.googleapis.com/active-audio/boringhistory/${audio.id}.mp3`);
                          el.addEventListener('loadedmetadata', () => {
                            if (el.duration && isFinite(el.duration)) {
                              resolve(Math.round(el.duration));
                            } else {
                              reject(new Error('No duration'));
                            }
                          });
                          el.addEventListener('error', () => reject(new Error('Load failed')));
                        });
                        durations[audio.id] = dur;
                        done++;
                      } catch {
                        console.warn(`Could not get duration for ${audio.id}`);
                      }
                    }

                    if (done > 0) {
                      const res = await fetch('/api/files/backfill-durations', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ durations }),
                      });
                      if (res.ok) {
                        await fetchAudioFiles();
                      } else {
                        setError('Failed to save durations');
                      }
                    }
                  }}
                  style={{
                    padding: '4px 12px',
                    border: '1px solid #000',
                    background: '#fff',
                    cursor: 'pointer',
                    fontSize: '13px',
                  }}
                >
                  Backfill Durations ({jsonData.filter(a => !a.duration).length} missing)
                </button>
              )}
            </div>

            {availableVoices.length > 0 && (
              <div style={{ marginBottom: '15px' }}>
                <label style={{ marginRight: '10px' }}>Filter by voice:</label>
                <select
                  value={selectedVoiceFilter}
                  onChange={(e) => setSelectedVoiceFilter(e.target.value)}
                  style={{ 
                    padding: '5px', 
                    border: '1px solid #000',
                    fontSize: '16px',
                    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen, Ubuntu, Cantarell, "Fira Sans", "Droid Sans", "Helvetica Neue", sans-serif'
                  }}
                >
                  <option value="all">All voices</option>
                  {availableVoices.map((voice) => (
                    <option key={voice} value={voice}>
                      {voice}
                    </option>
                  ))}
                </select>
              </div>
            )}
            
            {loading ? (
              <p>Loading...</p>
            ) : audioFiles.length === 0 ? (
              <p>No files found.</p>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #000' }}>
                    <th style={{ textAlign: 'left', padding: '12px 8px 12px 0' }}>Title</th>
                    <th style={{ textAlign: 'left', padding: '12px 8px' }}>Date</th>
                    <th style={{ textAlign: 'left', padding: '12px 8px' }}>Voice</th>
                    <th style={{ textAlign: 'left', padding: '12px 8px' }}>Category</th>
                    <th style={{ textAlign: 'left', padding: '12px 8px' }}>Image</th>
                    <th style={{ textAlign: 'left', padding: '12px 8px' }}>New</th>
                    <th style={{ textAlign: 'left', padding: '12px 8px' }}>Audio</th>
                    <th style={{ textAlign: 'left', padding: '12px 8px 12px 8px' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {audioFiles
                    .filter((file) => {
                      if (selectedVoiceFilter === 'all') {
                        return true;
                      }
                      const fileId = file.name.replace('.mp3', '');
                      const jsonEntry = jsonData.find((item: AudioEntry) => item.id === fileId);
                      return jsonEntry && jsonEntry.voice === selectedVoiceFilter;
                    })
                    .map((file) => {
                      const fileId = file.name.replace('.mp3', '');
                      const jsonEntry = jsonData.find((item: AudioEntry) => item.id === fileId);
                      
                      return (
                        <tr key={file.name} style={{ borderBottom: '1px solid #eee' }}>
                          <td style={{ padding: '12px 8px 12px 0' }}>
                            <div>
                              {editingTitle === file.name ? (
                                <input
                                  type="text"
                                  autoFocus
                                  defaultValue={jsonEntry?.title || file.name}
                                  onBlur={(e) => {
                                    const val = e.target.value.trim();
                                    if (val && val !== (jsonEntry?.title || '')) {
                                      handleTitleUpdate(file.name, val);
                                    } else {
                                      setEditingTitle(null);
                                    }
                                  }}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                      const val = (e.target as HTMLInputElement).value.trim();
                                      if (val) handleTitleUpdate(file.name, val);
                                    } else if (e.key === 'Escape') {
                                      setEditingTitle(null);
                                    }
                                  }}
                                  style={{
                                    width: '100%',
                                    padding: '4px',
                                    border: '1px solid #000',
                                    fontSize: '14px',
                                    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen, Ubuntu, Cantarell, "Fira Sans", "Droid Sans", "Helvetica Neue", sans-serif'
                                  }}
                                />
                              ) : (
                                <span
                                  onClick={() => setEditingTitle(file.name)}
                                  style={{ cursor: 'pointer', textDecoration: 'underline' }}
                                >
                                  {jsonEntry?.title || file.name}
                                </span>
                              )}
                              <div style={{ fontSize: '11px', color: '#666', marginTop: '2px' }}>
                                {file.url}
                              </div>
                            </div>
                          </td>
                          <td style={{ padding: '12px 8px' }}>{new Date(file.updated).toLocaleDateString()}</td>
                          <td style={{ padding: '12px 8px' }}>{jsonEntry?.voice || '-'}</td>
                          <td style={{ padding: '12px 8px' }}>
                              {editingCategory === file.name ? (
                                <select
                                  autoFocus
                                  defaultValue={jsonEntry?.category || ''}
                                  onBlur={(e) => {
                                    if (e.target.value !== (jsonEntry?.category || '')) {
                                      handleCategoryUpdate(file.name, e.target.value);
                                    } else {
                                      setEditingCategory(null);
                                    }
                                  }}
                                  onChange={(e) => {
                                    if (e.target.value !== (jsonEntry?.category || '')) {
                                      handleCategoryUpdate(file.name, e.target.value);
                                    }
                                  }}
                                  style={{ 
                                    padding: '2px', 
                                    border: '1px solid #000',
                                    fontSize: '14px',
                                    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen, Ubuntu, Cantarell, "Fira Sans", "Droid Sans", "Helvetica Neue", sans-serif'
                                  }}
                                >
                                  <option value="">No category</option>
                                  {categories.map((cat) => (
                                    <option key={cat.id} value={cat.id}>
                                      {cat.name}
                                    </option>
                                  ))}
                                </select>
                              ) : (
                                <div 
                                  onClick={() => setEditingCategory(file.name)}
                                  style={{ cursor: 'pointer', textDecoration: 'underline' }}
                                >
                                  {jsonEntry?.category ? categories.find(c => c.id === jsonEntry.category)?.name || jsonEntry.category : 'No category'}
                                </div>
                              )}
                            </td>
                          <td style={{ padding: '12px 8px' }}>
                            <div
                              onDragOver={(e) => { e.preventDefault(); setDragOver(file.name); }}
                              onDragLeave={() => setDragOver(null)}
                              onDrop={(e) => {
                                e.preventDefault();
                                setDragOver(null);
                                const droppedFile = e.dataTransfer.files[0];
                                if (droppedFile && droppedFile.type.startsWith('image/')) {
                                  handleImageDrop(file.name, droppedFile);
                                }
                              }}
                              onClick={() => {
                                const input = document.createElement('input');
                                input.type = 'file';
                                input.accept = 'image/*';
                                input.onchange = (e) => {
                                  const picked = (e.target as HTMLInputElement).files?.[0];
                                  if (picked) handleImageDrop(file.name, picked);
                                };
                                input.click();
                              }}
                              style={{
                                cursor: 'pointer',
                                border: dragOver === file.name ? '2px dashed #000' : '1px dashed #ccc',
                                borderRadius: '4px',
                                padding: '4px',
                                minWidth: '50px',
                                minHeight: '40px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '5px',
                                background: dragOver === file.name ? '#f0f0f0' : 'transparent',
                              }}
                            >
                              {uploadingImage === file.name ? (
                                <span style={{ fontSize: '12px', color: '#666' }}>Uploading...</span>
                              ) : jsonEntry?.imageUrl ? (
                                <>
                                  {/* eslint-disable-next-line @next/next/no-img-element */}
                                  <img
                                    src={jsonEntry.imageUrl}
                                    alt=""
                                    style={{
                                      width: '30px',
                                      height: '30px',
                                      objectFit: 'cover',
                                      border: '1px solid #ccc'
                                    }}
                                    onError={(e) => {
                                      (e.target as HTMLImageElement).style.display = 'none';
                                    }}
                                  />
                                  <span style={{ fontSize: '11px', color: '#666' }}>Drop to replace</span>
                                </>
                              ) : (
                                <span style={{ fontSize: '11px', color: '#999' }}>Drop image</span>
                              )}
                            </div>
                            </td>
                          <td style={{ padding: '12px 8px' }}>
                            <button
                              onClick={() => handleToggleNew(file.name, jsonEntry?.isNew || false)}
                              style={{
                                border: '1px solid #000',
                                background: jsonEntry?.isNew ? '#4CAF50' : '#fff',
                                color: jsonEntry?.isNew ? '#fff' : '#000',
                                padding: '2px 8px',
                                cursor: 'pointer',
                                fontSize: '14px'
                              }}
                            >
                              {jsonEntry?.isNew ? 'New' : 'Not New'}
                            </button>
                          </td>
                          <td style={{ padding: '12px 8px' }}>
                            <audio controls style={{ height: '30px' }}>
                              <source src={file.url} type={file.contentType} />
                            </audio>
                          </td>
                          <td style={{ padding: '12px 8px' }}>
                            <button
                              onClick={() => handleDelete(file.name)}
                              style={{
                                border: '1px solid #000',
                                background: '#fff',
                                padding: '2px 8px',
                                cursor: 'pointer',
                                fontSize: '14px'
                              }}
                            >
                              Delete
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}
    </div>
  );
}