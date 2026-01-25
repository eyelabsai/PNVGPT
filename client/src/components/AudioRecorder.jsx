/**
 * Audio Recorder Component
 * 
 * Provides two modes:
 * 1. Record audio using MediaRecorder API
 * 2. Upload an audio file
 * 
 * Returns a File/Blob to the parent component.
 */

import React, { useState, useRef, useCallback } from 'react'
import { Mic, Square, Upload, Trash2, Play, Pause } from 'lucide-react'

const AudioRecorder = ({ onAudioReady, disabled = false }) => {
  const [mode, setMode] = useState('record') // 'record' | 'upload'
  const [isRecording, setIsRecording] = useState(false)
  const [recordingTime, setRecordingTime] = useState(0)
  const [audioBlob, setAudioBlob] = useState(null)
  const [audioUrl, setAudioUrl] = useState(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [error, setError] = useState(null)

  const mediaRecorderRef = useRef(null)
  const audioChunksRef = useRef([])
  const timerRef = useRef(null)
  const audioRef = useRef(null)
  const streamRef = useRef(null)

  // Accepted audio formats
  const acceptedFormats = '.webm,.mp3,.wav,.m4a,.ogg,.flac'

  // Start recording
  const startRecording = useCallback(async () => {
    try {
      setError(null)
      audioChunksRef.current = []

      // Request microphone access
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 44100
        }
      })

      streamRef.current = stream

      // Choose best available MIME type
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : 'audio/webm'

      const mediaRecorder = new MediaRecorder(stream, {
        mimeType,
        audioBitsPerSecond: 128000
      })

      mediaRecorderRef.current = mediaRecorder

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data)
        }
      }

      mediaRecorder.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: mimeType })
        const url = URL.createObjectURL(blob)
        
        setAudioBlob(blob)
        setAudioUrl(url)
        
        // Create a File object for upload
        const file = new File([blob], 'recording.webm', { type: mimeType })
        onAudioReady(file)

        // Stop all tracks
        if (streamRef.current) {
          streamRef.current.getTracks().forEach(track => track.stop())
        }
      }

      mediaRecorder.start()
      setIsRecording(true)
      setRecordingTime(0)

      // Start timer
      timerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1)
      }, 1000)

    } catch (err) {
      console.error('Error starting recording:', err)
      setError(err.message || 'Could not access microphone. Please check permissions.')
    }
  }, [onAudioReady])

  // Stop recording
  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop()
      setIsRecording(false)
      
      if (timerRef.current) {
        clearInterval(timerRef.current)
        timerRef.current = null
      }
    }
  }, [isRecording])

  // Handle file upload
  const handleFileUpload = useCallback((event) => {
    const file = event.target.files?.[0]
    if (!file) return

    setError(null)
    
    // Validate file type
    const validTypes = ['audio/webm', 'audio/mp3', 'audio/mpeg', 'audio/wav', 'audio/x-wav', 'audio/m4a', 'audio/mp4', 'audio/ogg', 'audio/flac']
    if (!validTypes.some(type => file.type.includes(type.split('/')[1]))) {
      setError(`Invalid file type: ${file.type}. Please use webm, mp3, wav, m4a, ogg, or flac.`)
      return
    }

    // Check file size (50MB limit)
    if (file.size > 50 * 1024 * 1024) {
      setError('File too large. Maximum size is 50MB.')
      return
    }

    const url = URL.createObjectURL(file)
    setAudioBlob(file)
    setAudioUrl(url)
    onAudioReady(file)
  }, [onAudioReady])

  // Clear audio
  const clearAudio = useCallback(() => {
    if (audioUrl) {
      URL.revokeObjectURL(audioUrl)
    }
    setAudioBlob(null)
    setAudioUrl(null)
    setRecordingTime(0)
    setIsPlaying(false)
    onAudioReady(null)
  }, [audioUrl, onAudioReady])

  // Toggle playback
  const togglePlayback = useCallback(() => {
    if (!audioRef.current) return

    if (isPlaying) {
      audioRef.current.pause()
    } else {
      audioRef.current.play()
    }
    setIsPlaying(!isPlaying)
  }, [isPlaying])

  // Handle audio ended
  const handleAudioEnded = () => {
    setIsPlaying(false)
  }

  // Format time as MM:SS
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  return (
    <div className="audio-recorder">
      {/* Mode Toggle */}
      <div className="mode-toggle">
        <button
          className={`mode-btn ${mode === 'record' ? 'active' : ''}`}
          onClick={() => setMode('record')}
          disabled={disabled || isRecording}
        >
          <Mic className="w-4 h-4" />
          Record Audio
        </button>
        <button
          className={`mode-btn ${mode === 'upload' ? 'active' : ''}`}
          onClick={() => setMode('upload')}
          disabled={disabled || isRecording}
        >
          <Upload className="w-4 h-4" />
          Upload File
        </button>
      </div>

      {/* Error Display */}
      {error && (
        <div className="recorder-error">
          {error}
        </div>
      )}

      {/* Record Mode */}
      {mode === 'record' && !audioBlob && (
        <div className="record-section">
          {!isRecording ? (
            <button
              className="record-btn"
              onClick={startRecording}
              disabled={disabled}
            >
              <Mic className="w-6 h-6" />
              Start Recording
            </button>
          ) : (
            <div className="recording-active">
              <div className="recording-indicator">
                <span className="recording-dot"></span>
                Recording... {formatTime(recordingTime)}
              </div>
              <button
                className="stop-btn"
                onClick={stopRecording}
              >
                <Square className="w-5 h-5" />
                Stop
              </button>
            </div>
          )}
          <p className="record-hint">
            Record your consultation audio. Click stop when finished.
          </p>
        </div>
      )}

      {/* Upload Mode */}
      {mode === 'upload' && !audioBlob && (
        <div className="upload-section">
          <label className="upload-area">
            <input
              type="file"
              accept={acceptedFormats}
              onChange={handleFileUpload}
              disabled={disabled}
              className="upload-input"
            />
            <Upload className="w-8 h-8" />
            <span>Click to upload or drag and drop</span>
            <span className="upload-formats">WebM, MP3, WAV, M4A, OGG, FLAC (max 50MB)</span>
          </label>
        </div>
      )}

      {/* Audio Preview */}
      {audioBlob && (
        <div className="audio-preview">
          <audio
            ref={audioRef}
            src={audioUrl}
            onEnded={handleAudioEnded}
          />
          <div className="preview-controls">
            <button
              className="play-btn"
              onClick={togglePlayback}
            >
              {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
            </button>
            <div className="preview-info">
              <span className="preview-name">
                {audioBlob.name || `Recording (${formatTime(recordingTime)})`}
              </span>
              <span className="preview-size">
                {(audioBlob.size / 1024).toFixed(1)} KB
              </span>
            </div>
            <button
              className="clear-btn"
              onClick={clearAudio}
              disabled={disabled}
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      <style>{`
        .audio-recorder {
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }

        .mode-toggle {
          display: flex;
          gap: 0.5rem;
          background: rgba(255,255,255,0.05);
          padding: 0.25rem;
          border-radius: 8px;
        }

        .mode-btn {
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.5rem;
          padding: 0.75rem 1rem;
          background: transparent;
          border: none;
          border-radius: 6px;
          color: rgba(255,255,255,0.6);
          cursor: pointer;
          transition: all 0.2s;
          font-size: 0.9rem;
        }

        .mode-btn:hover:not(:disabled) {
          color: white;
          background: rgba(255,255,255,0.1);
        }

        .mode-btn.active {
          background: #3b82f6;
          color: white;
        }

        .mode-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .recorder-error {
          background: rgba(239, 68, 68, 0.2);
          border: 1px solid rgba(239, 68, 68, 0.3);
          color: #fca5a5;
          padding: 0.75rem 1rem;
          border-radius: 8px;
          font-size: 0.9rem;
        }

        .record-section {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 1rem;
          padding: 2rem;
          background: rgba(255,255,255,0.02);
          border: 2px dashed rgba(255,255,255,0.1);
          border-radius: 12px;
        }

        .record-btn {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 1rem 2rem;
          background: #ef4444;
          color: white;
          border: none;
          border-radius: 50px;
          font-size: 1rem;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s;
        }

        .record-btn:hover:not(:disabled) {
          background: #dc2626;
          transform: scale(1.02);
        }

        .record-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .recording-active {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 1rem;
        }

        .recording-indicator {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          font-size: 1.2rem;
          color: #ef4444;
          font-weight: 500;
        }

        .recording-dot {
          width: 12px;
          height: 12px;
          background: #ef4444;
          border-radius: 50%;
          animation: pulse 1s infinite;
        }

        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }

        .stop-btn {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.75rem 1.5rem;
          background: rgba(255,255,255,0.1);
          color: white;
          border: 1px solid rgba(255,255,255,0.2);
          border-radius: 8px;
          cursor: pointer;
          transition: all 0.2s;
        }

        .stop-btn:hover {
          background: rgba(255,255,255,0.2);
        }

        .record-hint {
          color: rgba(255,255,255,0.5);
          font-size: 0.85rem;
          text-align: center;
        }

        .upload-section {
          padding: 0;
        }

        .upload-area {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 0.75rem;
          padding: 2.5rem 2rem;
          background: rgba(255,255,255,0.02);
          border: 2px dashed rgba(255,255,255,0.15);
          border-radius: 12px;
          cursor: pointer;
          transition: all 0.2s;
          color: rgba(255,255,255,0.6);
        }

        .upload-area:hover {
          border-color: #3b82f6;
          background: rgba(59, 130, 246, 0.05);
        }

        .upload-input {
          display: none;
        }

        .upload-formats {
          font-size: 0.8rem;
          color: rgba(255,255,255,0.4);
        }

        .audio-preview {
          background: rgba(255,255,255,0.05);
          border-radius: 12px;
          padding: 1rem;
        }

        .preview-controls {
          display: flex;
          align-items: center;
          gap: 1rem;
        }

        .play-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 44px;
          height: 44px;
          background: #3b82f6;
          color: white;
          border: none;
          border-radius: 50%;
          cursor: pointer;
          transition: all 0.2s;
        }

        .play-btn:hover {
          background: #2563eb;
        }

        .preview-info {
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 0.25rem;
        }

        .preview-name {
          color: white;
          font-weight: 500;
          word-break: break-word;
        }

        .preview-size {
          color: rgba(255,255,255,0.5);
          font-size: 0.85rem;
        }

        .clear-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 36px;
          height: 36px;
          background: rgba(239, 68, 68, 0.2);
          color: #fca5a5;
          border: none;
          border-radius: 8px;
          cursor: pointer;
          transition: all 0.2s;
        }

        .clear-btn:hover:not(:disabled) {
          background: rgba(239, 68, 68, 0.3);
        }

        .clear-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
      `}</style>
    </div>
  )
}

export default AudioRecorder
