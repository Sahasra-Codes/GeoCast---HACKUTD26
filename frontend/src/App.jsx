import { useEffect, useState } from 'react';

export default function App() {
  const [status, setStatus] = useState('Connecting...');

  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/health', { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error('Health check failed');
        return response.json();
      })
      .then((data) => setStatus(data.status === 'ok' ? 'Connected' : 'Unavailable'))
      .catch((error) => {
        if (error.name !== 'AbortError') setStatus('Unavailable — start the backend');
      });
    return () => controller.abort();
  }, []);

  return (
    <main>
      <h1>HackUTD</h1>
      <p>Your React frontend is ready.</p>
      <p role="status">FastAPI backend: {status}</p>
    </main>
  );
}
