'use client';

import { useState, useEffect, useCallback } from 'react';
import { signOut } from 'next-auth/react';
import StoriesTab from './components/StoriesTab';

interface AudioFile {
  name: string;
  size: string;
  contentType: string;
  updated: string;
  url: string;
}

interface AudioEntry {
  id: string;
  title?: string;
  voice?: string;
  isNew?: boolean;
}

export default function Home() {
  const [activeTab, setActiveTab] = useState<'meandering' | 'history' | 'stories'>('meandering');
  const [audioFiles, setAudioFiles] = useState<AudioFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [gender, setGender] = useState<'male' | 'female'>('female');
  const [topic, setTopic] = useState<'boring' | 'meandering'>('boring');
  const [voiceName, setVoiceName] = useState('');
  const [selectedVoiceFilter, setSelectedVoiceFilter] = useState<string>('all');
  const [availableVoices, setAvailableVoices] = useState<string[]>([]);
  const [jsonData, setJsonData] = useState<AudioEntry[]>([]);
  const [isNew, setIsNew] = useState(false);

  const fetchAudioFiles = useCallback(async () => {
    try {
      const res = await fetch(`/api/files?folder=${activeTab === 'history' ? 'boringhistory' : ''}`);
      const data = await res.json();
      if (data.files) {
        setAudioFiles(data.files);
      }
      
      if (activeTab === 'history') {
        try {
          const jsonRes = await fetch(`https://storage.googleapis.com/active-audio/history-audio-list.json?t=${Date.now()}`);
          if (jsonRes.ok) {
            const jsonContent = await jsonRes.json();
            if (jsonContent.audios) {
              setJsonData(jsonContent.audios);
              const voices = [...new Set(jsonContent.audios.map((item: AudioEntry) => item.voice).filter((v: string | undefined) => v))] as string[];
              setAvailableVoices(voices);
            }
          }
        } catch (jsonError) {
          console.error('Error fetching JSON data:', jsonError);
        }
      }
    } catch (error) {
      console.error('Error fetching files:', error);
      setError('Failed to fetch files');
    } finally {
      setLoading(false);
    }
  }, [activeTab]);

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
      
      if (activeTab === 'history' && !voiceName.trim()) {
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
          folder: activeTab === 'history' ? 'boringhistory' : null,
          gender: activeTab === 'meandering' ? gender : null,
          topic: activeTab === 'meandering' ? topic : null,
          voiceName: activeTab === 'history' ? voiceName : null,
          isNew: activeTab === 'history' ? isNew : false,
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
          folder: activeTab === 'history' ? 'boringhistory' : null,
          gender: activeTab === 'meandering' ? gender : null,
          topic: activeTab === 'meandering' ? topic : null,
          voiceName: activeTab === 'history' ? voiceName : null,
          isNew: activeTab === 'history' ? isNew : false,
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
      await fetchAudioFiles();
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const formatFileSize = (bytes: string) => {
    const size = parseInt(bytes);
    if (size < 1024) return `${size} B`;
    if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
    return `${(size / (1024 * 1024)).toFixed(1)} MB`;
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
            onClick={(e) => { e.preventDefault(); setActiveTab('meandering'); }}
            style={{ 
              marginRight: '20px', 
              textDecoration: activeTab === 'meandering' ? 'underline' : 'none',
              color: '#000'
            }}
          >
            Meandering Sleep
          </a>
          <a 
            href="#" 
            onClick={(e) => { e.preventDefault(); setActiveTab('history'); }}
            style={{ 
              marginRight: '20px', 
              textDecoration: activeTab === 'history' ? 'underline' : 'none',
              color: '#000'
            }}
          >
            History Sleep
          </a>
          <a 
            href="#" 
            onClick={(e) => { e.preventDefault(); setActiveTab('stories'); }}
            style={{ 
              textDecoration: activeTab === 'stories' ? 'underline' : 'none',
              color: '#000'
            }}
          >
            Stories
          </a>
        </div>
      </div>
      
      {activeTab === 'stories' ? (
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
            
            {activeTab === 'history' && (
              <>
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
              </>
            )}
            
            {activeTab === 'meandering' && (
              <>
                <div style={{ marginBottom: '10px' }}>
                  <label style={{ display: 'block', marginBottom: '5px' }}>Topic:</label>
                  <select
                    value={topic}
                    onChange={(e) => setTopic(e.target.value as 'boring' | 'meandering')}
                    style={{ 
                      width: '100%', 
                      padding: '5px', 
                      border: '1px solid #000',
                      fontSize: '16px',
                      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen, Ubuntu, Cantarell, "Fira Sans", "Droid Sans", "Helvetica Neue", sans-serif'
                    }}
                  >
                    <option value="boring">Boring</option>
                    <option value="meandering">Meandering</option>
                  </select>
                </div>
                
                <div style={{ marginBottom: '10px' }}>
                  <label style={{ display: 'block', marginBottom: '5px' }}>Gender:</label>
                  <div>
                    <label style={{ marginRight: '20px' }}>
                      <input
                        type="radio"
                        value="female"
                        checked={gender === 'female'}
                        onChange={(e) => setGender(e.target.value as 'male' | 'female')}
                        style={{ marginRight: '5px' }}
                      />
                      Female
                    </label>
                    <label>
                      <input
                        type="radio"
                        value="male"
                        checked={gender === 'male'}
                        onChange={(e) => setGender(e.target.value as 'male' | 'female')}
                        style={{ marginRight: '5px' }}
                      />
                      Male
                    </label>
                  </div>
                </div>
              </>
            )}
            
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
            <h2 style={{ fontSize: '18px', marginBottom: '15px' }}>
              {activeTab === 'meandering' ? 'Meandering Sleep' : 'History Sleep'} Files
            </h2>
            
            {activeTab === 'history' && availableVoices.length > 0 && (
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
                    <th style={{ textAlign: 'left', padding: '10px 0' }}>{activeTab === 'history' ? 'Title' : 'Name'}</th>
                    <th style={{ textAlign: 'left', padding: '10px 0' }}>Size</th>
                    <th style={{ textAlign: 'left', padding: '10px 0' }}>Date</th>
                    {activeTab === 'history' && <th style={{ textAlign: 'left', padding: '10px 0' }}>Voice</th>}
                    {activeTab === 'history' && <th style={{ textAlign: 'left', padding: '10px 0' }}>New</th>}
                    <th style={{ textAlign: 'left', padding: '10px 0' }}>Audio</th>
                    {activeTab === 'history' && <th style={{ textAlign: 'left', padding: '10px 0' }}>Actions</th>}
                  </tr>
                </thead>
                <tbody>
                  {audioFiles
                    .filter((file) => {
                      if (activeTab !== 'history' || selectedVoiceFilter === 'all') {
                        return true;
                      }
                      const fileId = file.name.replace('.mp3', '');
                      const jsonEntry = jsonData.find((item: AudioEntry) => item.id === fileId);
                      return jsonEntry && jsonEntry.voice === selectedVoiceFilter;
                    })
                    .map((file) => {
                      const fileId = file.name.replace('.mp3', '');
                      const jsonEntry = activeTab === 'history' ? jsonData.find((item: AudioEntry) => item.id === fileId) : null;
                      
                      return (
                        <tr key={file.name} style={{ borderBottom: '1px solid #eee' }}>
                          <td style={{ padding: '10px 0' }}>
                            <div>
                              {activeTab === 'history' && jsonEntry?.title ? jsonEntry.title : file.name}
                              {activeTab === 'history' && (
                                <div style={{ fontSize: '11px', color: '#666', marginTop: '2px' }}>
                                  {file.url}
                                </div>
                              )}
                            </div>
                          </td>
                          <td style={{ padding: '10px 0' }}>{formatFileSize(file.size)}</td>
                          <td style={{ padding: '10px 0' }}>{new Date(file.updated).toLocaleDateString()}</td>
                          {activeTab === 'history' && (
                            <td style={{ padding: '10px 0' }}>{jsonEntry?.voice || '-'}</td>
                          )}
                          {activeTab === 'history' && (
                            <td style={{ padding: '10px 0' }}>
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
                          )}
                          <td style={{ padding: '10px 0' }}>
                            <audio controls style={{ height: '30px' }}>
                              <source src={file.url} type={file.contentType} />
                            </audio>
                          </td>
                          {activeTab === 'history' && (
                            <td style={{ padding: '10px 0' }}>
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
                          )}
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