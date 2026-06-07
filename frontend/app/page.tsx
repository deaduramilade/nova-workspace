'use client';

import { useState } from 'react';

export default function Home() {
  const [workspaceName, setWorkspaceName] = useState('');

  const createWorkspace = async () => {
    const res = await fetch('http://localhost:8000/api/v1/workspaces', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: workspaceName }),
    });
    const data = await res.json();
    alert(`Workspace created: ${data.name}`);
  };

  return (
    <div className="min-h-screen bg-gray-950 text-white p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-5xl font-bold mb-8">Nova Workspace</h1>
        <p className="text-xl mb-12 text-gray-400">AI-First Collaborative Environment</p>

        <div className="bg-gray-900 p-8 rounded-2xl">
          <h2 className="text-2xl mb-6">Create New Workspace</h2>
          <input
            type="text"
            placeholder="Workspace Name"
            value={workspaceName}
            onChange={(e) => setWorkspaceName(e.target.value)}
            className="w-full p-4 bg-gray-800 rounded-xl mb-4 text-lg"
          />
          <button
            onClick={createWorkspace}
            className="bg-blue-600 hover:bg-blue-700 px-8 py-4 rounded-xl text-lg font-medium"
          >
            Create Workspace
          </button>
        </div>

        <div className="mt-12 text-sm text-gray-500">
          Backend Status: <span className="text-green-400">Connected to http://localhost:8000</span>
        </div>
      </div>
    </div>
  );
}