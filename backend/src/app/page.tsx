'use client'

import { useState } from 'react'
import type { VoiceProcessingResponse } from '../types/voice-processing'

export default function Home() {
  const [transcript, setTranscript] = useState('')
  const [result, setResult] = useState<VoiceProcessingResponse | null>(null)
  const [debugResult, setDebugResult] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isDebugLoading, setIsDebugLoading] = useState(false)
  const [error, setError] = useState('')

  const processVoice = async () => {
    if (!transcript.trim()) {
      setError('Please enter a transcript')
      return
    }

    setIsLoading(true)
    setError('')
    
    try {
      const response = await fetch('/api/voice-processing', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ rawTranscript: transcript }),
      })

      if (!response.ok) {
        throw new Error(`Error: ${response.status}`)
      }

      const data = await response.json()
      setResult(data)
    } catch (err) {
      setError(`Failed to process: ${err instanceof Error ? err.message : String(err)}`)
      setResult(null)
    } finally {
      setIsLoading(false)
    }
  }

  const debugCommandDetection = async () => {
    if (!transcript.trim()) {
      setError('Please enter a transcript')
      return
    }

    setIsDebugLoading(true)
    setError('')
    
    try {
      const response = await fetch('/api/debug', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ text: transcript }),
      })

      if (!response.ok) {
        throw new Error(`Error: ${response.status}`)
      }

      const data = await response.json()
      setDebugResult(data)
    } catch (err) {
      setError(`Debug failed: ${err instanceof Error ? err.message : String(err)}`)
      setDebugResult(null)
    } finally {
      setIsDebugLoading(false)
    }
  }

  const formatJSON = (obj: any) => {
    return JSON.stringify(obj, null, 2)
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-between p-24">
      <div className="z-10 max-w-5xl w-full">
        <h1 className="text-4xl font-bold mb-8 text-center">Voice Processing API Tester</h1>
        
        <div className="mb-8">
          <label className="block text-lg mb-2">
            Enter Voice Transcript:
          </label>
          <textarea 
            className="w-full p-2 border border-gray-300 rounded-md" 
            rows={4}
            value={transcript}
            onChange={(e) => setTranscript(e.target.value)}
            placeholder="e.g. send email to john about tomorrow meeting"
          />
          
          <div className="mt-4 flex justify-center space-x-4">
            <button
              onClick={processVoice}
              disabled={isLoading}
              className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded disabled:opacity-50"
            >
              {isLoading ? 'Processing...' : 'Process Voice Input'}
            </button>
            
            <button
              onClick={debugCommandDetection}
              disabled={isDebugLoading}
              className="bg-gray-500 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded disabled:opacity-50"
            >
              {isDebugLoading ? 'Debugging...' : 'Debug Command Detection'}
            </button>
          </div>
          
          {error && (
            <div className="mt-4 p-2 bg-red-100 border border-red-400 text-red-700 rounded">
              {error}
            </div>
          )}
        </div>

        {result && (
          <div className="mt-8">
            <h2 className="text-2xl font-bold mb-4">Results</h2>
            
            <div className="mb-4">
              <h3 className="text-xl font-semibold mb-2">Original Text:</h3>
              <div className="p-2 bg-gray-100 rounded">{result.original}</div>
            </div>
            
            <div className="mb-4">
              <h3 className="text-xl font-semibold mb-2">Corrected Text:</h3>
              <div className="p-2 bg-gray-100 rounded">{result.corrected}</div>
            </div>
            
            <div>
              <h3 className="text-xl font-semibold mb-2">Detected Commands:</h3>
              <pre className="p-4 bg-gray-100 rounded overflow-auto">
                {formatJSON(result.commands)}
              </pre>
            </div>
          </div>
        )}
        
        {debugResult && (
          <div className="mt-8 border-t pt-4">
            <h2 className="text-2xl font-bold mb-4">Debug Results</h2>
            <div className="mb-4">
              <h3 className="text-xl font-semibold mb-2">Raw Parsed Response:</h3>
              <pre className="p-4 bg-gray-100 rounded overflow-auto">
                {formatJSON(debugResult.rawParsedResponse)}
              </pre>
            </div>
            <div className="mb-4">
              <h3 className="text-xl font-semibold mb-2">Processed Commands:</h3>
              <pre className="p-4 bg-gray-100 rounded overflow-auto">
                {formatJSON(debugResult.processedCommands)}
              </pre>
            </div>
            <div>
              <h3 className="text-xl font-semibold mb-2">Full OpenAI Response:</h3>
              <pre className="p-4 bg-gray-100 rounded overflow-auto text-xs">
                {formatJSON(debugResult.openaiResponse)}
              </pre>
            </div>
          </div>
        )}
        
        <div className="mt-12">
          <h2 className="text-2xl font-bold mb-4">Example Queries</h2>
          <p className="mb-4">Try these example queries:</p>
          
          <ul className="list-disc pl-5 space-y-2">
            <li className="cursor-pointer text-blue-600 hover:underline" 
                onClick={() => setTranscript("compose an email")}>
              compose an email
            </li>
            <li className="cursor-pointer text-blue-600 hover:underline"
                onClick={() => setTranscript("add john@example.com as recipient")}>
              add john@example.com as recipient
            </li>
            <li className="cursor-pointer text-blue-600 hover:underline"
                onClick={() => setTranscript("set subject to quarterly report")}>
              set subject to quarterly report
            </li>
            <li className="cursor-pointer text-blue-600 hover:underline"
                onClick={() => setTranscript("add message the numbers look good for q3")}>
              add message the numbers look good for q3
            </li>
            <li className="cursor-pointer text-blue-600 hover:underline"
                onClick={() => setTranscript("delete this draft")}>
              delete this draft
            </li>
            <li className="cursor-pointer text-blue-600 hover:underline"
                onClick={() => setTranscript("save and close")}>
              save and close
            </li>
            <li className="cursor-pointer text-blue-600 hover:underline"
                onClick={() => setTranscript("compose an email to marketing team with subject campaign update and message the new campaign metrics look promising")}>
              compose an email to marketing team with subject campaign update and message the new campaign metrics look promising
            </li>
          </ul>
        </div>
      </div>
    </main>
  )
}
