import { useMemo, useState } from 'react'
import axios from 'axios'

function App() {
	const [message, setMessage] = useState('')
	const [loading, setLoading] = useState(false)
	const [transcription, setTranscription] = useState('')
	const [selectedFile, setSelectedFile] = useState(null)
	const [transcriptions, setTranscriptions] = useState([])
	const [dragActive, setDragActive] = useState(false)
	const [copied, setCopied] = useState(false)

	const selectedFileInfo = useMemo(() => {
		if (!selectedFile) return ''
		const sizeMb = (selectedFile.size / (1024 * 1024)).toFixed(2)
		return `${selectedFile.name} · ${sizeMb} MB`
	}, [selectedFile])

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

	const handleFileSelect = (event) => {
		const file = event.target.files?.[0]
		if (file) {
			if (file.type.startsWith('audio/')) {
				setSelectedFile(file)
				setMessage(`Selected: ${file.name}`)
			} else {
				setMessage('Please select an audio file')
			}
		}
	}

	const onDragOver = (e) => {
		e.preventDefault()
		setDragActive(true)
	}

	const onDragLeave = () => {
		setDragActive(false)
	}

	const onDrop = (e) => {
		e.preventDefault()
		setDragActive(false)
		const file = e.dataTransfer.files?.[0]
		if (file) {
			if (file.type.startsWith('audio/')) {
				setSelectedFile(file)
				setMessage(`Selected: ${file.name}`)
			} else {
				setMessage('Please drop an audio file')
			}
		}
	}

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
				headers: { 'Content-Type': 'multipart/form-data' }
			})

			setMessage('File uploaded successfully!')
			setTranscription(response.data.transcription)
			setSelectedFile(null)
			const input = document.getElementById('file-input')
			if (input) input.value = ''
		} catch (error) {
			setMessage('Upload failed: ' + error.message)
		}
		setLoading(false)
	}

	const fetchTranscriptions = async () => {
		try {
			const response = await axios.get('http://localhost:5000/api/transcriptions')
			setTranscriptions(response.data)
			setMessage(`Loaded ${response.data.length} transcriptions`)
		} catch (error) {
			setMessage('Failed to load transcriptions')
		}
	}

	const copyTranscription = async () => {
		if (!transcription) return
		try {
			await navigator.clipboard.writeText(transcription)
			setCopied(true)
			setTimeout(() => setCopied(false), 1200)
		} catch {}
	}

	return (
		<div className="app">
			<header className="app-header">
				<div className="app-header-inner">
					<div className="brand" role="img" aria-label="Speech to Text brand">
						<div className="brand-icon">
							<span>🎤</span>
						</div>
						<div>
							<div className="brand-title">Speech to Text</div>
							<div className="brand-subtitle">Upload audio and get instant transcripts</div>
						</div>
					</div>
					<button onClick={testBackend} disabled={loading} className="btn btn-secondary">
						{loading ? 'Testing…' : 'Test Backend'}
					</button>
				</div>
			</header>

			<main className="container">
				<div className="main-grid">
					<section className="card">
						<h2>Upload audio</h2>
						<div className="card-sub">MP3, WAV, M4A and more</div>

						<div
							onDragOver={onDragOver}
							onDragLeave={onDragLeave}
							onDrop={onDrop}
							className={`dropzone${dragActive ? ' drag-active' : ''}`}
						>
							<input
								type="file"
								id="file-input"
								accept="audio/*"
								onChange={handleFileSelect}
								style={{ display: 'none' }}
							/>
							<label htmlFor="file-input" style={{ display: 'block', cursor: 'pointer' }}>
								<div className="upload-icon">🎵</div>
								<div className="dropzone-title">
									{selectedFile ? selectedFileInfo : 'Click to select or drag & drop'}
								</div>
								<div className="dropzone-sub">Max 100MB • One file at a time</div>
							</label>
						</div>

						<button
							onClick={uploadAndTranscribe}
							disabled={loading || !selectedFile}
							className="btn btn-primary upload-action"
						>
							{loading ? 'Uploading…' : 'Upload & Transcribe'}
						</button>

						{message && (
							<div className={`msg ${message.includes('Error') || message.includes('failed') ? 'msg-error' : 'msg-success'}`}>
								{message}
							</div>
						)}
					</section>

					<section className="card">
						<div className="panel-head">
							<div className="panel-title">Transcription</div>
							<button onClick={copyTranscription} disabled={!transcription} className="btn btn-secondary copy-btn">
								{copied ? 'Copied!' : 'Copy'}
							</button>
						</div>

						<div className="transcription-box">
							{transcription
								? <p style={{ whiteSpace: 'pre-wrap', margin: 0 }}>{transcription}</p>
								: <p className="transcription-empty" style={{ margin: 0 }}>Your transcription will appear here.</p>}
						</div>
					</section>
				</div>

				<section className="card" style={{ marginTop: 24 }}>
					<div className="history-head">
						<div className="panel-title">History</div>
						<button onClick={fetchTranscriptions} className="btn btn-secondary">Load History</button>
					</div>

					{transcriptions.length > 0 ? (
						<ul className="history-list">
							{transcriptions.map((item) => (
								<li key={item.id} className="history-item">
									<p className="history-title">{item.audio_filename}</p>
									<p className="history-text">{item.transcription_text}</p>
									<p className="history-time">{new Date(item.created_at).toLocaleString()}</p>
								</li>
							))}
						</ul>
					) : (
						<p className="history-text" style={{ textAlign: 'center', padding: '16px 0' }}>
							No transcriptions yet. Upload some audio files!
						</p>
					)}
				</section>
			</main>

			<footer className="app-footer">
				Built with React and Vite
			</footer>
		</div>
	)
}

export default App