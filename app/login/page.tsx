'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function Login() {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (password === 'hush') {
      localStorage.setItem('isAuthenticated', 'true');
      router.push('/');
    } else {
      setError('Invalid password');
    }
  };

  return (
    <div style={{ 
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen, Ubuntu, Cantarell, "Fira Sans", "Droid Sans", "Helvetica Neue", sans-serif', 
      maxWidth: '400px', 
      margin: '100px auto', 
      padding: '20px' 
    }}>
      <h1 style={{ fontSize: '24px', marginBottom: '5px' }}>Coventry Labs CMS</h1>
      <p style={{ marginBottom: '20px', fontSize: '14px' }}>Sign in to access the CMS</p>
      
      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: '15px' }}>
          <label style={{ display: 'block', marginBottom: '5px' }}>
            Password:
          </label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            style={{ 
              width: '100%', 
              padding: '5px', 
              border: '1px solid #000',
              fontSize: '16px',
              fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen, Ubuntu, Cantarell, "Fira Sans", "Droid Sans", "Helvetica Neue", sans-serif'
            }}
          />
        </div>
        
        {error && (
          <div style={{ color: 'red', marginBottom: '15px', fontSize: '14px' }}>
            {error}
          </div>
        )}
        
        <button
          type="submit"
          style={{ 
            padding: '5px 15px', 
            border: '1px solid #000',
            background: '#fff',
            cursor: 'pointer',
            fontSize: '16px'
          }}
        >
          Sign in
        </button>
      </form>
    </div>
  );
}