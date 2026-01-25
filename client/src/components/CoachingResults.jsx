/**
 * Coaching Results Component
 * 
 * Displays the analysis results from the clinician coaching API.
 * Shows scores, transcript, strengths, improvements, and more.
 */

import React, { useState } from 'react'
import { 
  ChevronDown, 
  ChevronUp, 
  CheckCircle, 
  AlertTriangle, 
  Target,
  MessageSquare,
  Lightbulb,
  TrendingUp,
  FileText,
  AlertCircle
} from 'lucide-react'

const CoachingResults = ({ result, transcript }) => {
  const [transcriptExpanded, setTranscriptExpanded] = useState(false)
  
  if (!result) return null

  const { hardChecks, llmFeedback, score, rubricTitle } = result

  // Score color based on value
  const getScoreColor = (value) => {
    if (value >= 80) return '#22c55e' // green
    if (value >= 60) return '#eab308' // yellow
    if (value >= 40) return '#f97316' // orange
    return '#ef4444' // red
  }

  // Score label
  const getScoreLabel = (value) => {
    if (value >= 80) return 'Excellent'
    if (value >= 60) return 'Good'
    if (value >= 40) return 'Needs Work'
    return 'Poor'
  }

  return (
    <div className="coaching-results">
      {/* Score Overview */}
      <div className="scores-section">
        <h2>Coaching Score</h2>
        <div className="scores-grid">
          <div className="score-card overall">
            <div 
              className="score-circle"
              style={{ borderColor: getScoreColor(score.overall) }}
            >
              <span className="score-value">{score.overall}</span>
              <span className="score-max">/100</span>
            </div>
            <div className="score-label">Overall</div>
            <div className="score-status" style={{ color: getScoreColor(score.overall) }}>
              {getScoreLabel(score.overall)}
            </div>
          </div>
          
          <div className="score-card">
            <div className="score-mini" style={{ color: getScoreColor(score.coverageScore) }}>
              {score.coverageScore}%
            </div>
            <div className="score-label">Coverage</div>
            <div className="score-detail">
              {hardChecks.mustSay.hit}/{hardChecks.mustSay.total} items covered
            </div>
          </div>
          
          <div className="score-card">
            <div className="score-mini" style={{ color: getScoreColor(score.safetyScore) }}>
              {score.safetyScore}%
            </div>
            <div className="score-label">Safety</div>
            <div className="score-detail">
              {hardChecks.mustNotSay.violated} violations found
            </div>
          </div>
        </div>
        
        {rubricTitle && (
          <div className="rubric-used">
            Evaluated against: <strong>{rubricTitle}</strong>
          </div>
        )}
      </div>

      {/* Summary */}
      {llmFeedback?.summary && (
        <div className="result-section summary-section">
          <div className="section-header">
            <FileText className="w-5 h-5" />
            <h3>Summary</h3>
            {llmFeedback.roleDetected && (
              <span className="role-badge">
                {llmFeedback.roleDetected === 'surgeon' ? '👨‍⚕️ Surgeon' : 
                 llmFeedback.roleDetected === 'counselor' ? '💬 Counselor' : '❓ Unknown'}
              </span>
            )}
          </div>
          <p className="summary-text">{llmFeedback.summary}</p>
        </div>
      )}

      {/* Transcript Accordion */}
      {transcript && (
        <div className="result-section transcript-section">
          <button 
            className="section-header clickable"
            onClick={() => setTranscriptExpanded(!transcriptExpanded)}
          >
            <MessageSquare className="w-5 h-5" />
            <h3>Transcript</h3>
            <span className="transcript-length">{transcript.length} chars</span>
            {transcriptExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
          </button>
          {transcriptExpanded && (
            <div className="transcript-content">
              {transcript}
            </div>
          )}
        </div>
      )}

      {/* Strengths */}
      {llmFeedback?.strengths?.length > 0 && (
        <div className="result-section strengths-section">
          <div className="section-header">
            <CheckCircle className="w-5 h-5 text-green" />
            <h3>Strengths</h3>
            <span className="count-badge green">{llmFeedback.strengths.length}</span>
          </div>
          <ul className="result-list green">
            {llmFeedback.strengths.map((item, idx) => (
              <li key={idx}>{item}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Improvements */}
      {llmFeedback?.improvements?.length > 0 && (
        <div className="result-section improvements-section">
          <div className="section-header">
            <TrendingUp className="w-5 h-5 text-blue" />
            <h3>Areas for Improvement</h3>
            <span className="count-badge blue">{llmFeedback.improvements.length}</span>
          </div>
          <ul className="result-list blue">
            {llmFeedback.improvements.map((item, idx) => (
              <li key={idx}>{item}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Missed Items */}
      {(llmFeedback?.missedItems?.length > 0 || hardChecks?.mustSay?.missed?.length > 0) && (
        <div className="result-section missed-section">
          <div className="section-header">
            <Target className="w-5 h-5 text-yellow" />
            <h3>Missed Items</h3>
            <span className="count-badge yellow">
              {llmFeedback?.missedItems?.length || hardChecks?.mustSay?.missed?.length || 0}
            </span>
          </div>
          <ul className="result-list yellow">
            {(llmFeedback?.missedItems || hardChecks?.mustSay?.missed || []).map((item, idx) => (
              <li key={idx}>{item}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Red Flags */}
      {(llmFeedback?.redFlags?.length > 0 || hardChecks?.mustNotSay?.violations?.length > 0) && (
        <div className="result-section redflags-section">
          <div className="section-header">
            <AlertTriangle className="w-5 h-5 text-red" />
            <h3>Red Flags</h3>
            <span className="count-badge red">
              {llmFeedback?.redFlags?.length || hardChecks?.mustNotSay?.violations?.length || 0}
            </span>
          </div>
          <ul className="result-list red">
            {(llmFeedback?.redFlags || hardChecks?.mustNotSay?.violations || []).map((item, idx) => (
              <li key={idx}>{item}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Suggested Phrases */}
      {llmFeedback?.suggestedPhrases?.length > 0 && (
        <div className="result-section phrases-section">
          <div className="section-header">
            <Lightbulb className="w-5 h-5 text-purple" />
            <h3>Suggested Phrases</h3>
            <span className="count-badge purple">{llmFeedback.suggestedPhrases.length}</span>
          </div>
          <div className="phrases-table">
            <div className="phrases-header">
              <span>Situation</span>
              <span>Better Phrasing</span>
            </div>
            {llmFeedback.suggestedPhrases.map((phrase, idx) => (
              <div key={idx} className="phrase-row">
                <div className="phrase-situation">{phrase.situation}</div>
                <div className="phrase-rewrite">{phrase.rewrite}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Next Call Plan */}
      {llmFeedback?.nextCallPlan?.length > 0 && (
        <div className="result-section nextcall-section">
          <div className="section-header">
            <AlertCircle className="w-5 h-5 text-cyan" />
            <h3>Next Call Action Plan</h3>
          </div>
          <ol className="result-list numbered cyan">
            {llmFeedback.nextCallPlan.map((item, idx) => (
              <li key={idx}>{item}</li>
            ))}
          </ol>
        </div>
      )}

      <style>{`
        .coaching-results {
          display: flex;
          flex-direction: column;
          gap: 1.5rem;
        }

        .scores-section {
          background: rgba(255,255,255,0.05);
          border-radius: 16px;
          padding: 1.5rem;
        }

        .scores-section h2 {
          margin: 0 0 1.5rem 0;
          font-size: 1.25rem;
          color: white;
        }

        .scores-grid {
          display: grid;
          grid-template-columns: 1fr 1fr 1fr;
          gap: 1rem;
        }

        @media (max-width: 600px) {
          .scores-grid {
            grid-template-columns: 1fr;
          }
        }

        .score-card {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 0.5rem;
          padding: 1rem;
          background: rgba(255,255,255,0.03);
          border-radius: 12px;
        }

        .score-card.overall {
          background: rgba(59, 130, 246, 0.1);
        }

        .score-circle {
          width: 80px;
          height: 80px;
          border: 4px solid;
          border-radius: 50%;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
        }

        .score-value {
          font-size: 1.75rem;
          font-weight: 700;
          color: white;
          line-height: 1;
        }

        .score-max {
          font-size: 0.75rem;
          color: rgba(255,255,255,0.5);
        }

        .score-mini {
          font-size: 2rem;
          font-weight: 700;
        }

        .score-label {
          font-weight: 500;
          color: rgba(255,255,255,0.8);
        }

        .score-status {
          font-size: 0.85rem;
          font-weight: 600;
        }

        .score-detail {
          font-size: 0.8rem;
          color: rgba(255,255,255,0.5);
          text-align: center;
        }

        .rubric-used {
          margin-top: 1rem;
          padding-top: 1rem;
          border-top: 1px solid rgba(255,255,255,0.1);
          font-size: 0.85rem;
          color: rgba(255,255,255,0.6);
          text-align: center;
        }

        .result-section {
          background: rgba(255,255,255,0.03);
          border-radius: 12px;
          padding: 1.25rem;
        }

        .section-header {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          margin-bottom: 1rem;
        }

        .section-header.clickable {
          cursor: pointer;
          background: none;
          border: none;
          width: 100%;
          text-align: left;
          padding: 0;
          margin-bottom: 0;
        }

        .section-header.clickable:hover {
          opacity: 0.9;
        }

        .section-header h3 {
          margin: 0;
          font-size: 1rem;
          color: white;
          flex: 1;
        }

        .text-green { color: #22c55e; }
        .text-blue { color: #3b82f6; }
        .text-yellow { color: #eab308; }
        .text-red { color: #ef4444; }
        .text-purple { color: #a855f7; }
        .text-cyan { color: #06b6d4; }

        .count-badge {
          padding: 0.25rem 0.5rem;
          border-radius: 12px;
          font-size: 0.75rem;
          font-weight: 600;
        }

        .count-badge.green { background: rgba(34, 197, 94, 0.2); color: #22c55e; }
        .count-badge.blue { background: rgba(59, 130, 246, 0.2); color: #3b82f6; }
        .count-badge.yellow { background: rgba(234, 179, 8, 0.2); color: #eab308; }
        .count-badge.red { background: rgba(239, 68, 68, 0.2); color: #ef4444; }
        .count-badge.purple { background: rgba(168, 85, 247, 0.2); color: #a855f7; }

        .role-badge {
          padding: 0.25rem 0.75rem;
          background: rgba(255,255,255,0.1);
          border-radius: 12px;
          font-size: 0.8rem;
          color: rgba(255,255,255,0.8);
        }

        .summary-text {
          margin: 0;
          color: rgba(255,255,255,0.9);
          line-height: 1.6;
        }

        .transcript-length {
          font-size: 0.8rem;
          color: rgba(255,255,255,0.5);
        }

        .transcript-content {
          margin-top: 1rem;
          padding: 1rem;
          background: rgba(0,0,0,0.2);
          border-radius: 8px;
          font-family: monospace;
          font-size: 0.85rem;
          color: rgba(255,255,255,0.8);
          white-space: pre-wrap;
          max-height: 300px;
          overflow-y: auto;
        }

        .result-list {
          margin: 0;
          padding-left: 1.5rem;
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }

        .result-list li {
          color: rgba(255,255,255,0.85);
          line-height: 1.5;
        }

        .result-list.green li::marker { color: #22c55e; }
        .result-list.blue li::marker { color: #3b82f6; }
        .result-list.yellow li::marker { color: #eab308; }
        .result-list.red li::marker { color: #ef4444; }
        .result-list.cyan li::marker { color: #06b6d4; }

        .result-list.numbered {
          list-style-type: decimal;
        }

        .phrases-table {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }

        .phrases-header {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 1rem;
          padding: 0.5rem 0.75rem;
          font-size: 0.75rem;
          font-weight: 600;
          color: rgba(255,255,255,0.5);
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        .phrase-row {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 1rem;
          padding: 0.75rem;
          background: rgba(255,255,255,0.03);
          border-radius: 8px;
        }

        .phrase-situation {
          color: rgba(255,255,255,0.7);
          font-size: 0.9rem;
        }

        .phrase-rewrite {
          color: #a855f7;
          font-size: 0.9rem;
          font-style: italic;
        }

        @media (max-width: 600px) {
          .phrases-header {
            display: none;
          }
          .phrase-row {
            grid-template-columns: 1fr;
            gap: 0.5rem;
          }
          .phrase-situation::before {
            content: 'Situation: ';
            font-weight: 600;
            color: rgba(255,255,255,0.5);
          }
          .phrase-rewrite::before {
            content: 'Try: ';
            font-weight: 600;
            color: rgba(255,255,255,0.5);
          }
        }
      `}</style>
    </div>
  )
}

export default CoachingResults
