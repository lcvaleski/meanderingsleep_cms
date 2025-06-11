'use client';

import { useState } from 'react';

export default function Home() {
  const [file, setFile] = useState<File | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0] || null;
    setFile(selected);
  };

  return (
    <main style={{ padding: 40 }}>
      <h1>Meandering Sleep CMS</h1>
      <p>Upload a long audio clip:</p>
      <input type="file" accept="audio/*" onChange={handleFileChange} />
      {file && <p>Selected file: {file.name}</p>}
    </main>
  );
}