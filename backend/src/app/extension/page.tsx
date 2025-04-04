'use client'

import { useState } from 'react'
import { processVoiceCommand } from '../../utils/extension-helper'

export default function ExtensionPage() {
  const [apiUrl, setApiUrl] = useState('http://localhost:3000')
  const [transcript, setTranscript] = useState('')
  const [result, setResult] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState('')

  const testConnection = async () => {
    if (!transcript.trim()) {
      setError('Please enter a transcript')
      return
    }

    setIsLoading(true)
    setError('')
    setCopied(false)
    
    try {
      const data = await processVoiceCommand(transcript, apiUrl)
      setResult(data)
    } catch (err) {
      setError(`Failed to process: ${err instanceof Error ? err.message : String(err)}`)
      setResult(null)
    } finally {
      setIsLoading(false)
    }
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const extensionCode = `
// Extension code to connect with the voice processing backend
async function processVoiceCommand(text, apiUrl = '${apiUrl}') {
  try {
    const response = await fetch(\`\${apiUrl}/api/voice-processing\`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ rawTranscript: text }),
    });

    if (!response.ok) {
      throw new Error(\`API error: \${response.status}\`);
    }

    const result = await response.json();
    return result;
  } catch (error) {
    console.error('Error processing voice command:', error);
    throw error;
  }
}

// Example command handler
function handleCommands(commands) {
  commands.forEach(command => {
    switch(command.command) {
      case 'compose_email':
        // Implementation to open email composer
        console.log('Opening email composer');
        break;
      case 'add_recipient':
        // Implementation to add recipient
        console.log('Adding recipient:', command.recipient);
        break;
      case 'add_subject':
        // Implementation to add subject
        console.log('Setting subject:', command.subject);
        break;
      case 'add_message':
        // Implementation to add message
        console.log('Adding message content:', command.content);
        break;
      case 'delete_draft':
        // Implementation to delete draft
        console.log('Deleting draft');
        break;
      case 'save_and_close':
        // Implementation to save and close
        console.log('Saving draft and closing');
        break;
      default:
        console.log('Unknown command:', command);
    }
  });
}

// Usage in the extension
async function onVoiceInput(transcript) {
  try {
    const result = await processVoiceCommand(transcript);
    console.log('Corrected text:', result.corrected);
    handleCommands(result.commands);
  } catch (error) {
    console.error('Voice processing failed:', error);
  }
}
`;

  return (
    <main className="flex min-h-screen flex-col items-center justify-between p-10">
      <div className="z-10 max-w-5xl w-full">
        <h1 className="text-4xl font-bold mb-8 text-center">Extension Integration</h1>
        
        <div className="mb-8">
          <label className="block text-lg mb-2">
            Backend API URL:
          </label>
          <input
            type="text"
            className="w-full p-2 border border-gray-300 rounded-md mb-4"
            value={apiUrl}
            onChange={(e) => setApiUrl(e.target.value)}
            placeholder="http://localhost:3000"
          />
          
          <label className="block text-lg mb-2">
            Test Voice Transcript:
          </label>
          <textarea 
            className="w-full p-2 border border-gray-300 rounded-md" 
            rows={4}
            value={transcript}
            onChange={(e) => setTranscript(e.target.value)}
            placeholder="e.g. compose an email to john with subject meeting notes"
          />
          
          <div className="mt-4 flex justify-center">
            <button
              onClick={testConnection}
              disabled={isLoading}
              className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded disabled:opacity-50"
            >
              {isLoading ? 'Testing...' : 'Test Connection'}
            </button>
          </div>
          
          {error && (
            <div className="mt-4 p-2 bg-red-100 border border-red-400 text-red-700 rounded">
              {error}
            </div>
          )}
        </div>

        {result && (
          <div className="mt-8 p-4 border border-gray-200 rounded-md">
            <h2 className="text-2xl font-bold mb-4">Test Results</h2>
            <div className="mb-4">
              <h3 className="text-xl font-semibold mb-2">Corrected Text:</h3>
              <div className="p-2 bg-gray-100 rounded">{result.corrected}</div>
            </div>
            <div>
              <h3 className="text-xl font-semibold mb-2">Detected Commands:</h3>
              <pre className="p-4 bg-gray-100 rounded overflow-auto">
                {JSON.stringify(result.commands, null, 2)}
              </pre>
            </div>
          </div>
        )}
        
        <div className="mt-8 p-4 border border-gray-200 rounded-md">
          <div className="flex justify-between items-center">
            <h2 className="text-2xl font-bold mb-4">Extension Code</h2>
            <button
              onClick={() => copyToClipboard(extensionCode)}
              className="bg-gray-500 hover:bg-gray-700 text-white text-sm font-bold py-1 px-3 rounded"
            >
              {copied ? 'Copied!' : 'Copy Code'}
            </button>
          </div>
          <pre className="p-4 bg-gray-100 rounded overflow-auto text-sm">
            {extensionCode}
          </pre>
        </div>
        
        <div className="mt-8 p-4 border border-gray-200 rounded-md">
          <h2 className="text-2xl font-bold mb-4">Integration Steps</h2>
          <ol className="list-decimal pl-5 space-y-2">
            <li>Start the backend server with <code className="bg-gray-100 px-1">npm run dev</code></li>
            <li>Copy the extension code above into your extension's background script</li>
            <li>Add a speech recognition handler in your extension that calls <code className="bg-gray-100 px-1">onVoiceInput(transcript)</code></li>
            <li>Implement the command handlers to interact with Gmail/email interfaces</li>
            <li>Make sure your extension's manifest.json has the appropriate permissions</li>
          </ol>
        </div>
      </div>
    </main>
  )
} 