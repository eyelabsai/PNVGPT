/**
 * Clinician Coach Page
 * 
 * Main page for clinician coaching workflow:
 * 1. Record or upload audio
 * 2. Optionally select a rubric
 * 3. Transcribe and/or analyze
 * 4. View coaching feedback
 */

import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { 
  ArrowLeft, 
  FileAudio, 
  Sparkles, 
  Loader2,
  RefreshCw,
  FileText,
  Zap
} from 'lucide-react'
import AudioRecorder from '../components/AudioRecorder'
import CoachingResults from '../components/CoachingResults'
import { apiRequest, apiUpload } from '../lib/api'
import { supabase } from '../lib/supabase'
import './ClinicianCoachPage.css'

const ClinicianCoachPage = () => {
  const navigate = useNavigate()
  
  // State
  const [user, setUser] = useState(null)
  const [audioFile, setAudioFile] = useState(null)
  const [rubrics, setRubrics] = useState([])
  const [selectedRubric, setSelectedRubric] = useState('')
  const [transcript, setTranscript] = useState('')
  const [analysisResult, setAnalysisResult] = useState(null)
  
  // Loading states
  const [loadingRubrics, setLoadingRubrics] = useState(true)
  const [transcribing, setTranscribing] = useState(false)
  const [analyzing, setAnalyzing] = useState(false)
  const [runningFullCoach, setRunningFullCoach] = useState(false)
  
  // Errors
  const [error, setError] = useState(null)

  // Load user and rubrics on mount
  useEffect(() => {
    fetchUser()
    fetchRubrics()
  }, [])

  async function fetchUser() {
    const { data: { user } } = await supabase.auth.getUser()
    setUser(user)
  }

  async function fetchRubrics() {
    try {
      setLoadingRubrics(true)
      const data = await apiRequest('/api/clinician/rubrics')
      setRubrics(data.rubrics || [])
    } catch (err) {
      console.error('Error fetching rubrics:', err)
      // Non-fatal - we can continue without rubric list
    } finally {
      setLoadingRubrics(false)
    }
  }

  // Handle audio ready from recorder
  const handleAudioReady = (file) => {
    setAudioFile(file)
    // Clear previous results when new audio is selected
    if (file) {
      setTranscript('')
      setAnalysisResult(null)
      setError(null)
    }
  }

  // Transcribe only
  const handleTranscribe = async () => {
    if (!audioFile) {
      setError('Please record or upload an audio file first')
      return
    }

    setError(null)
    setTranscribing(true)

    try {
      const formData = new FormData()
      formData.append('audio', audioFile)

      const result = await apiUpload('/api/clinician/transcribe', formData)
      
      if (result.success) {
        setTranscript(result.transcript)
      } else {
        throw new Error(result.error || 'Transcription failed')
      }
    } catch (err) {
      console.error('Transcription error:', err)
      setError(err.message || 'Transcription failed')
    } finally {
      setTranscribing(false)
    }
  }

  // Analyze only (requires transcript)
  const handleAnalyze = async () => {
    if (!transcript || transcript.trim().length < 50) {
      setError('Please transcribe audio first (transcript must be at least 50 characters)')
      return
    }

    setError(null)
    setAnalyzing(true)

    try {
      const result = await apiRequest('/api/clinician/analyze', {
        method: 'POST',
        body: JSON.stringify({
          transcript,
          rubricId: selectedRubric || undefined
        })
      })

      if (result.success) {
        setAnalysisResult(result.result)
      } else {
        throw new Error(result.error || 'Analysis failed')
      }
    } catch (err) {
      console.error('Analysis error:', err)
      setError(err.message || 'Analysis failed')
    } finally {
      setAnalyzing(false)
    }
  }

  // Full coach: transcribe + analyze in one call
  const handleFullCoach = async () => {
    if (!audioFile) {
      setError('Please record or upload an audio file first')
      return
    }

    setError(null)
    setRunningFullCoach(true)
    setTranscript('')
    setAnalysisResult(null)

    try {
      const formData = new FormData()
      formData.append('audio', audioFile)
      if (selectedRubric) {
        formData.append('rubricId', selectedRubric)
      }

      const result = await apiUpload('/api/clinician/coach', formData)

      if (result.success) {
        setTranscript(result.transcript)
        setAnalysisResult(result.analysis)
      } else {
        throw new Error(result.error || 'Coaching analysis failed')
      }
    } catch (err) {
      console.error('Full coach error:', err)
      setError(err.message || 'Coaching analysis failed')
    } finally {
      setRunningFullCoach(false)
    }
  }

  // Reset everything
  const handleReset = () => {
    setAudioFile(null)
    setTranscript('')
    setAnalysisResult(null)
    setError(null)
    setSelectedRubric('')
  }

  // Logout
  const handleLogout = async () => {
    await supabase.auth.signOut()
    navigate('/login')
  }

  const isProcessing = transcribing || analyzing || runningFullCoach

  return (
    <div className="clinician-coach-page">
      {/* Header */}
      <header className="coach-header">
        <div className="header-left">
          <button className="back-btn" onClick={() => navigate('/')}>
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="header-title">
            <Sparkles className="w-6 h-6" />
            <h1>Clinician Coaching</h1>
          </div>
        </div>
        <div className="header-right">
          {user && (
            <span className="user-email">{user.email}</span>
          )}
          <button className="logout-btn" onClick={handleLogout}>
            Logout
          </button>
        </div>
      </header>

      <main className="coach-main">
        {/* Left Panel: Input */}
        <div className="coach-panel input-panel">
          <div className="panel-header">
            <FileAudio className="w-5 h-5" />
            <h2>Audio Input</h2>
          </div>

          {/* Audio Recorder */}
          <div className="panel-section">
            <AudioRecorder 
              onAudioReady={handleAudioReady}
              disabled={isProcessing}
            />
          </div>

          {/* Rubric Selection */}
          <div className="panel-section">
            <label className="section-label">Coaching Rubric</label>
            <select
              value={selectedRubric}
              onChange={(e) => setSelectedRubric(e.target.value)}
              disabled={isProcessing || loadingRubrics}
              className="rubric-select"
            >
              <option value="">Auto-detect</option>
              {rubrics.map(rubric => (
                <option key={rubric.id} value={rubric.id}>
                  {rubric.title}
                </option>
              ))}
            </select>
            <p className="section-hint">
              Leave as "Auto-detect" to let the system choose based on transcript content.
            </p>
          </div>

          {/* Action Buttons */}
          <div className="panel-section action-buttons">
            <button
              className="action-btn primary"
              onClick={handleFullCoach}
              disabled={!audioFile || isProcessing}
            >
              {runningFullCoach ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <Zap className="w-5 h-5" />
                  Run Full Coach
                </>
              )}
            </button>

            <div className="action-divider">
              <span>or step by step</span>
            </div>

            <div className="step-buttons">
              <button
                className="action-btn secondary"
                onClick={handleTranscribe}
                disabled={!audioFile || isProcessing}
              >
                {transcribing ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <FileText className="w-4 h-4" />
                )}
                Transcribe
              </button>

              <button
                className="action-btn secondary"
                onClick={handleAnalyze}
                disabled={!transcript || transcript.length < 50 || isProcessing}
              >
                {analyzing ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Sparkles className="w-4 h-4" />
                )}
                Analyze
              </button>
            </div>

            {(transcript || analysisResult) && (
              <button
                className="action-btn reset"
                onClick={handleReset}
                disabled={isProcessing}
              >
                <RefreshCw className="w-4 h-4" />
                Start Over
              </button>
            )}
          </div>

          {/* Error Display */}
          {error && (
            <div className="error-message">
              {error}
            </div>
          )}

          {/* Transcript Preview (if step-by-step) */}
          {transcript && !analysisResult && (
            <div className="panel-section transcript-preview">
              <label className="section-label">Transcript Preview</label>
              <div className="transcript-text">
                {transcript.substring(0, 500)}
                {transcript.length > 500 && '...'}
              </div>
              <p className="section-hint">
                {transcript.length} characters. Click "Analyze" to get coaching feedback.
              </p>
            </div>
          )}
        </div>

        {/* Right Panel: Results */}
        <div className="coach-panel results-panel">
          <div className="panel-header">
            <Sparkles className="w-5 h-5" />
            <h2>Coaching Results</h2>
          </div>

          {isProcessing && (
            <div className="processing-state">
              <Loader2 className="w-8 h-8 animate-spin" />
              <p>
                {runningFullCoach && 'Transcribing and analyzing your consultation...'}
                {transcribing && 'Transcribing audio...'}
                {analyzing && 'Analyzing transcript...'}
              </p>
              <p className="processing-hint">This may take a minute for longer recordings.</p>
            </div>
          )}

          {!isProcessing && !analysisResult && (
            <div className="empty-state">
              <Sparkles className="w-12 h-12" />
              <h3>Ready to Coach</h3>
              <p>
                Record or upload a consultation audio, then click "Run Full Coach" 
                to get AI-powered feedback on your communication.
              </p>
              <ul className="feature-list">
                <li>Coverage analysis against coaching rubrics</li>
                <li>Identification of strengths and improvements</li>
                <li>Detection of red flags and missed items</li>
                <li>Suggested better phrasing</li>
                <li>Action plan for your next call</li>
              </ul>
            </div>
          )}

          {!isProcessing && analysisResult && (
            <CoachingResults 
              result={analysisResult}
              transcript={transcript}
            />
          )}
        </div>
      </main>
    </div>
  )
}

export default ClinicianCoachPage
