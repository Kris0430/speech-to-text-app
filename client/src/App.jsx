import { useState } from 'react'
import axios from 'axios'

function App() {
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const [transcription, setTranscription] = useState('')
  const [selectedFile, setSelectedFile] = useState(null)
  const [transcriptions, setTranscriptions] = useState([])

  // Test backend connection
  const testBackend = async () => {
    setLoading(true)
    try {
      const response = await axios.get('http://localhost:5000')
      setMessage(response.data.message)
    } catch (error) {
      setMessage('Error connecting to backend: ' + error.message)
    }
    setLoading(false)
  }

  // Handle file selection
  const handleFileSelect = (event) => {
    const file = event.target.files[0]
    if (file) {
      // Check if it's an audio file
      if (file.type.startsWith('audio/')) {
        setSelectedFile(file)
        setMessage(`Selected: ${file.name}`)
      } else {
        setMessage('Please select an audio file')
      }
    }
  }

  // Upload and transcribe file
  const uploadAndTranscribe = async () => {
    if (!selectedFile) {
      setMessage('Please select a file first')
      return
    }

    setLoading(true)
    setMessage('')
    setTranscription('')

    const formData = new FormData()
    formData.append('audio', selectedFile)

    try {
      const response = await axios.post('http://localhost:5000/api/transcribe', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      })

      setMessage('File uploaded successfully!')
      setTranscription(response.data.transcription)
      
      // Reset file input
      setSelectedFile(null)
      document.getElementById('file-input').value = ''

    } catch (error) {
      setMessage('Upload failed: ' + error.message)
    }
    setLoading(false)
  }

  // Fetch transcription history
  const fetchTranscriptions = async () => {
    try {
      const response = await axios.get('http://localhost:5000/api/transcriptions')
      setTranscriptions(response.data)
      setMessage(`Loaded ${response.data.length} transcriptions`)
    } catch (error) {
      setMessage('Failed to load transcriptions')
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-100 p-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-800 mb-2">
            🎤 Speech to Text
          </h1>
          <p className="text-gray-600">Upload audio files and get transcriptions</p>
        </div>

        {/* Connection Test */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-xl font-semibold mb-2">Connection Status</h2>
              <p className="text-sm text-gray-600">
                Backend: http://localhost:5000
              </p>
            </div>
            <button 
              onClick={testBackend}
              disabled={loading}
              className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded disabled:opacity-50"
            >
              {loading ? 'Testing...' : 'Test Connection'}
            </button>
          </div>
        </div>

        {/* File Upload Section */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Upload Audio File</h2>
          
          <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center mb-4">
            <input
              type="file"
              id="file-input"
              accept="audio/*"
              onChange={handleFileSelect}
              className="hidden"
            />
            <label 
              htmlFor="file-input"
              className="cursor-pointer block"
            >
              <div className="text-4xl mb-2">🎵</div>
              <p className="text-gray-600 mb-2">
                {selectedFile ? selectedFile.name : 'Click to select audio file'}
              </p>
              <p className="text-sm text-gray-500">MP3, WAV, M4A, etc.</p>
            </label>
          </div>

          <button 
            onClick={uploadAndTranscribe}
            disabled={loading || !selectedFile}
            className="w-full bg-green-500 hover:bg-green-700 text-white font-bold py-3 px-4 rounded-lg disabled:opacity-50"
          >
            {loading ? 'Uploading...' : 'Upload & Transcribe'}
          </button>
        </div>

        {/* Transcription Result */}
        {transcription && (
          <div className="bg-white rounded-lg shadow-md p-6 mb-6">
            <h2 className="text-xl font-semibold mb-4">Transcription Result</h2>
            <div className="bg-gray-50 p-4 rounded border">
              <p className="text-gray-800 whitespace-pre-wrap">{transcription}</p>
            </div>
          </div>
        )}

        {/* History Section */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold">Transcription History</h2>
            <button 
              onClick={fetchTranscriptions}
              className="bg-purple-500 hover:bg-purple-700 text-white font-bold py-2 px-4 rounded"
            >
              Load History
            </button>
          </div>
          
          {transcriptions.length > 0 ? (
            <div className="space-y-4">
              {transcriptions.map((item) => (
                <div key={item.id} className="border rounded-lg p-4">
                  <p className="font-semibold">{item.audio_filename}</p>
                  <p className="text-gray-600 mt-2">{item.transcription_text}</p>
                  <p className="text-sm text-gray-400 mt-2">
                    {new Date(item.created_at).toLocaleString()}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500 text-center py-4">
              No transcriptions yet. Upload some audio files!
            </p>
          )}
        </div>

        {/* Messages */}
        {message && (
          <div className={`mt-4 p-3 rounded-lg ${
            message.includes('Error') || message.includes('failed') 
              ? 'bg-red-100 border-red-400 text-red-700' 
              : 'bg-green-100 border-green-400 text-green-700'
          }`}>
            {message}
          </div>
        )}
      </div>
    </div>
  )
}

export default App