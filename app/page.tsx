'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useDropzone } from 'react-dropzone';
import { CloudArrowUpIcon, CheckCircleIcon, ExclamationCircleIcon } from '@heroicons/react/24/outline';

interface AudioFile {
  name: string;
  size: string;
  contentType: string;
  updated: string;
  url: string;
}

export default function Home() {
  const router = useRouter();
  const [audioFiles, setAudioFiles] = useState<AudioFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState(false);

  useEffect(() => {
    // Check authentication
    const isAuthenticated = localStorage.getItem('isAuthenticated');
    if (!isAuthenticated) {
      router.push('/login');
      return;
    }
    fetchAudioFiles();
  }, [router]);

  const handleLogout = () => {
    localStorage.removeItem('isAuthenticated');
    router.push('/login');
  };

  const fetchAudioFiles = async () => {
    try {
      const res = await fetch('/api/files');
      const data = await res.json();
      if (data.files) {
        setAudioFiles(data.files);
      }
    } catch (error) {
      console.error('Error fetching files:', error);
      setError('Failed to fetch files');
    } finally {
      setLoading(false);
    }
  };

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (!file) return;
    setSelectedFile(file);
    setUploading(true);
    setUploadProgress(0);
    setError(null);
    setUploadSuccess(false);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const response = await fetch('/api/files/upload', {
        method: 'POST',
        body: formData,
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Upload failed');
      }
      setUploadSuccess(true);
      setSelectedFile(null);
      await fetchAudioFiles();
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Upload failed');
    } finally {
      setUploading(false);
      setUploadProgress(0);
      setTimeout(() => setUploadSuccess(false), 2000);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'audio/*': ['.mp3', '.wav', '.m4a', '.ogg']
    },
    maxFiles: 1,
    disabled: uploading
  });

  const formatFileSize = (bytes: string) => {
    const size = parseInt(bytes);
    if (size < 1024) return `${size} B`;
    if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
    return `${(size / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <main className="p-8 max-w-4xl mx-auto">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold">Meandering Sleep CMS</h1>
        <button
          onClick={handleLogout}
          className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
        >
          Logout
        </button>
      </div>
      
      <div className="mb-8">
        <div
          {...getRootProps()}
          className={`flex flex-col items-center justify-center border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-all duration-200
            ${isDragActive ? 'border-blue-500 bg-blue-50 shadow-lg' : 'border-gray-300 bg-gray-50 hover:border-blue-400 hover:bg-blue-50'}
            ${uploading ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          <input {...getInputProps()} />
          <CloudArrowUpIcon className="w-12 h-12 text-blue-400 mb-2" />
          {uploading ? (
            <div className="w-full">
              <p className="mb-2 font-medium">Uploading...</p>
              <div className="w-full bg-gray-200 rounded-full h-2.5 mb-2">
                <div
                  className="bg-blue-600 h-2.5 rounded-full transition-all duration-300"
                  style={{ width: `${uploadProgress}%` }}
                ></div>
              </div>
            </div>
          ) : uploadSuccess ? (
            <div className="flex flex-col items-center">
              <CheckCircleIcon className="w-8 h-8 text-green-500 mb-1" />
              <span className="text-green-600 font-medium">Upload successful!</span>
            </div>
          ) : isDragActive ? (
            <p className="font-medium text-blue-600">Drop the audio file here...</p>
          ) : (
            <>
              <p className="font-medium mb-1">Drag and drop an audio file here, or click to select</p>
              <p className="text-sm text-gray-500 mb-2">MP3, WAV, M4A, OGG up to 100MB</p>
              {selectedFile && (
                <div className="mt-2 text-gray-700 text-sm">Selected: <span className="font-medium">{selectedFile.name}</span></div>
              )}
            </>
          )}
        </div>
        {error && (
          <div className="mt-2 flex items-center text-red-500 text-sm"><ExclamationCircleIcon className="w-5 h-5 mr-1" />{error}</div>
        )}
      </div>

      <div>
        <h2 className="text-xl font-semibold mb-4">Audio Files</h2>
        {loading ? (
          <p>Loading files...</p>
        ) : audioFiles.length === 0 ? (
          <p>No audio files found.</p>
        ) : (
          <div className="grid gap-4">
            {audioFiles.map((file) => (
              <div key={file.name} className="p-4 border rounded-lg">
                <div className="flex justify-between items-center">
                  <div>
                    <h3 className="font-medium">{file.name}</h3>
                    <p className="text-sm text-gray-500">
                      {formatFileSize(file.size)} • {new Date(file.updated).toLocaleDateString()}
                    </p>
                  </div>
                  <audio controls className="w-64">
                    <source src={file.url} type={file.contentType} />
                    Your browser does not support the audio element.
                  </audio>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}