import { useState } from 'react';
import './index.css';

function App() {
  const [url, setUrl] = useState('');
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setResult(null);

    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/fact-check`, {        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ youtube_url: url }),
      });
      const data = await response.json();
      if (response.ok) {
        setResult(data.video);
      } else {
        setError(data.error);
      }
    } catch  {
      setError('Failed to connect to backend');
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col items-center p-4">
      <h1 className="text-3xl font-bold mb-4">Fact-Check YouTube Video</h1>
      <div className="w-full max-w-md">
        <input
          type="text"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="Enter YouTube URL"
          className="w-full p-2 mb-4 border rounded"
        />
        <button
          onClick={handleSubmit}
          className="w-full bg-blue-500 text-white p-2 rounded hover:bg-blue-600"
        >
          Fact-Check
        </button>
      </div>
      {error && <p className="text-red-500 mt-4">{error}</p>}
      {result && (
        <div className="mt-4 w-full max-w-md">
          <h2 className="text-xl font-semibold">Result</h2>
          <p><strong>URL:</strong> {result.youtubeUrl}</p>
          <p><strong>Transcript:</strong> {result.transcript || 'Not available'}</p>
        </div>
      )}
    </div>
  );
}

export default App;