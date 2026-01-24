import React, { useState, useEffect, useRef } from 'react'
import { Send, Loader2, Sparkles, Calculator } from 'lucide-react'
import './ChatInterface.css'

const API_BASE = import.meta.env.VITE_API_URL || (import.meta.env.DEV 
  ? 'http://localhost:3000' 
  : 'https://pnvgpt.onrender.com')

/**
 * Simple markdown to HTML converter
 * Handles: **bold**, *italic*, bullet points, line breaks
 */
function renderMarkdown(text) {
  if (!text) return ''
  
  // Escape HTML first to prevent XSS
  let html = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
  
  // Convert markdown
  // Links: [text](url) - do this BEFORE escaping breaks the URLs
  // We need to handle this specially since we escaped < and >
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>')
  
  // Bold: **text** or __text__
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
  html = html.replace(/__(.+?)__/g, '<strong>$1</strong>')
  
  // Italic: *text* or _text_ (but not inside bold)
  html = html.replace(/(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/g, '<em>$1</em>')
  html = html.replace(/(?<!_)_(?!_)(.+?)(?<!_)_(?!_)/g, '<em>$1</em>')
  
  // Process line by line to handle bullet points better
  const lines = html.split('\n')
  let result = []
  let inList = false
  
  for (let i = 0; i < lines.length; i++) {
    let line = lines[i].trim()
    
    // Check if it's a bullet point
    if (line.match(/^[•\-]\s+/)) {
      if (!inList) {
        result.push('<ul>')
        inList = true
      }
      line = line.replace(/^[•\-]\s+/, '')
      result.push('<li>' + line + '</li>')
    } else {
      // Close list if we were in one
      if (inList) {
        result.push('</ul>')
        inList = false
      }
      
      // Handle empty lines as paragraph breaks
      if (line === '') {
        if (result.length > 0 && !result[result.length - 1].match(/<\/(ul|p)>$/)) {
          result.push('</p><p>')
        }
      } else {
        result.push(line)
      }
    }
  }
  
  // Close any open list
  if (inList) {
    result.push('</ul>')
  }
  
  // Join and clean up
  html = result.join(' ')
  
  // Clean up empty paragraphs and extra spaces
  html = html.replace(/<p>\s*<\/p>/g, '')
  html = html.replace(/\s+/g, ' ')
  html = html.replace(/<\/p>\s*<p>/g, '</p><p>')
  
  // Wrap in paragraph if starts with text
  if (html && !html.startsWith('<')) {
    html = '<p>' + html + '</p>'
  }
  
  return html
}

const ChatInterface = ({ chatId, chat, onUpdateChat, onNewChat, isDarkMode }) => {
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isStreaming, setIsStreaming] = useState(false)
  // Calculator state is tied to a specific message index
  const [calculatorMessageIndex, setCalculatorMessageIndex] = useState(null)
  const [calcAge, setCalcAge] = useState('')
  const [calcCost, setCalcCost] = useState('')
  const [calcResult, setCalcResult] = useState(null)
  const messagesEndRef = useRef(null)
  const inputRef = useRef(null)
  const reflexBufferRef = useRef('')
  const typewriterIntervalRef = useRef(null)

  // Load messages from chat prop and reset calculator when chat changes
  useEffect(() => {
    if (chat) {
      setMessages(chat.messages || [])
    } else {
      setMessages([])
    }
    // Reset calculator state when switching chats
    setCalculatorMessageIndex(null)
    setCalcAge('')
    setCalcCost('')
    setCalcResult(null)
  }, [chatId, chat])

  // Auto-scroll to bottom
  useEffect(() => {
    // Only scroll if we are streaming or if a new message was added
    // Avoid scrolling when calculator state changes unless it's the first time it appears
    scrollToBottom()
  }, [messages])

  // Scroll to bottom when calculator appears for the first time
  useEffect(() => {
    if (calculatorMessageIndex !== null) {
      scrollToBottom()
    }
  }, [calculatorMessageIndex])

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  // Cleanup typewriter interval on unmount
  useEffect(() => {
    return () => {
      if (typewriterIntervalRef.current) {
        clearInterval(typewriterIntervalRef.current)
        typewriterIntervalRef.current = null
      }
    }
  }, [])

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  const handleSend = async () => {
    if (!input.trim() || isLoading) return

    // Clear any running typewriter
    if (typewriterIntervalRef.current) {
      clearInterval(typewriterIntervalRef.current)
      typewriterIntervalRef.current = null
    }

    const userMessage = {
      role: 'user',
      content: input.trim()
    }

    // Add user message and empty assistant message placeholder
    const assistantPlaceholder = { role: 'assistant', content: '' }
    const newMessages = [...messages, userMessage]
    const messagesWithPlaceholder = [...newMessages, assistantPlaceholder]
    
    setMessages(messagesWithPlaceholder)
    setInput('')
    setIsLoading(true)
    setIsStreaming(true)

    // Update parent chat
    onUpdateChat(chatId, newMessages)

    try {
      // Use streaming endpoint
      const response = await fetch(`${API_BASE}/ask/stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          messages: newMessages.map(m => ({ role: m.role, content: m.content }))
        })
      })

      if (!response.ok) throw new Error('Request failed')

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let assistantContent = ''
      reflexBufferRef.current = '' // Reset reflex buffer

      while (true) {
        const { value, done } = await reader.read()
        if (done) break

        const text = decoder.decode(value)
        const lines = text.split('\n')

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6))
              
              if (data.type === 'content') {
                // Normal streaming content - display incrementally
                assistantContent += data.content
                setMessages([...newMessages, { role: 'assistant', content: assistantContent }])
                scrollToBottom()
              } else if (data.type === 'reflex_content') {
                // Reflex response - buffer it, don't display yet (will typewriter on done)
                reflexBufferRef.current += data.content
                // Keep showing typing cursor (empty content)
              } else if (data.type === 'done') {
                setIsStreaming(false)
                
                // If this was a reflex response, use typewriter effect
                if (data.reflex && reflexBufferRef.current) {
                  const fullReflexText = reflexBufferRef.current
                  reflexBufferRef.current = '' // Clear buffer
                  
                  // Typewriter effect: reveal text character by character
                  let typewriterIndex = 0
                  const typewriterSpeed = 15 // milliseconds per character
                  
                  // Clear any existing typewriter interval
                  if (typewriterIntervalRef.current) {
                    clearInterval(typewriterIntervalRef.current)
                  }
                  
                  typewriterIntervalRef.current = setInterval(() => {
                    typewriterIndex++
                    const revealedText = fullReflexText.substring(0, typewriterIndex)
                    setMessages([...newMessages, { role: 'assistant', content: revealedText }])
                    scrollToBottom()
                    
                    if (typewriterIndex >= fullReflexText.length) {
                      clearInterval(typewriterIntervalRef.current)
                      typewriterIntervalRef.current = null
                      // Final update with complete message
                      const finalMessages = [...newMessages, { role: 'assistant', content: fullReflexText }]
                      onUpdateChat(chatId, finalMessages)
                    }
                  }, typewriterSpeed)
                } else {
                  // Normal response - final update with complete message
                  const finalMessages = [...newMessages, { role: 'assistant', content: assistantContent }]
                  setMessages(finalMessages)
                  onUpdateChat(chatId, finalMessages)
                }
                
                // Show savings calculator attached to this message if context detected
                // Only set if not already showing (don't move existing calculator)
                if (data.showSavingsCalculator && calculatorMessageIndex === null) {
                  // The assistant message is at newMessages.length (last position)
                  setCalculatorMessageIndex(newMessages.length)
                  setCalcResult(null) // Reset previous results
                }
              } else if (data.type === 'error') {
                throw new Error(data.content)
              }
            } catch (e) {
              // Ignore parse errors
            }
          }
        }
      }

    } catch (error) {
      console.error('Error:', error)
      const errorMessage = {
        role: 'assistant',
        content: "I'm sorry, I encountered an error. Please try again."
      }
      const finalMessages = [...newMessages, errorMessage]
      setMessages(finalMessages)
      onUpdateChat(chatId, finalMessages)
    } finally {
      setIsLoading(false)
      setIsStreaming(false)
      inputRef.current?.focus()
    }
  }

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const examplePrompts = [
    "What is LASIK? What are other options?",
    "How do I book an appointment?",
    "Where are you located?",
    "What is a cataract?"
  ]

  const handleExampleClick = (prompt) => {
    setInput(prompt)
    inputRef.current?.focus()
  }

  const calculateSavings = () => {
    const age = parseInt(calcAge)
    const annualCost = parseInt(calcCost)
    
    if (isNaN(age) || isNaN(annualCost) || age < 18 || age > 100 || annualCost < 0) {
      alert('Please enter valid numbers for age (18-100) and annual cost.')
      return
    }
    
    // Years until 65 * annual cost
    const yearsUntil65 = Math.max(0, 65 - age)
    const total = yearsUntil65 * annualCost
    
    setCalcResult(total)
  }

  const showEmptyState = messages.length === 0 && !isLoading

  return (
    <div className="chat-interface">
      {/* Messages Container */}
      <div className="messages-container">
        {showEmptyState ? (
          <div className="welcome-screen">
            <div className="welcome-icon">
              <Sparkles className="w-8 h-8" />
            </div>
            <h1 className="welcome-title">
              How can I help?
            </h1>
            
            {/* Centered Input */}
            <div className="welcome-input-container">
              <div className="input-wrapper">
                <input
                  ref={inputRef}
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="Ask anything"
                  className="welcome-input"
                  disabled={isLoading}
                />
                <button
                  onClick={handleSend}
                  disabled={!input.trim() || isLoading}
                  className="send-button"
                >
                  {isLoading ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <Send className="w-5 h-5" />
                  )}
                </button>
              </div>
            </div>

            {/* Example Prompts */}
            <div className="example-prompts">
              {examplePrompts.map((prompt, idx) => (
                <button
                  key={idx}
                  onClick={() => handleExampleClick(prompt)}
                  className="example-prompt"
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <>
            {messages.map((message, idx) => (
              <div
                key={idx}
                className={`message ${message.role === 'user' ? 'user-message' : 'assistant-message'}`}
              >
                <div className="message-content">
                  <div className="message-avatar">
                    {message.role === 'user' ? (
                      <div className="avatar-user">U</div>
                    ) : (
                      <div className="avatar-assistant">
                        <Sparkles className="w-4 h-4" />
                      </div>
                    )}
                  </div>
                  <div className="message-text">
                    {message.role === 'assistant' ? (
                      <>
                        {message.content ? (
                          <div 
                            className="formatted-content"
                            dangerouslySetInnerHTML={{ __html: renderMarkdown(message.content) }} 
                          />
                        ) : (
                          <span className="typing-cursor">▋</span>
                        )}
                        {isStreaming && idx === messages.length - 1 && message.content && (
                          <span className="typing-cursor">▋</span>
                        )}
                        
                        {/* Savings Calculator - shows INSIDE the message that triggered it */}
                        {calculatorMessageIndex === idx && (
                          <div className="savings-calculator-inline">
                            <div className="calculator-header">
                              <Calculator className="w-5 h-5" />
                              <h4>See Your Potential Savings</h4>
                            </div>
                            <div className="calculator-form">
                              <div className="calculator-row">
                                <label>Your Age</label>
                                <input
                                  type="number"
                                  value={calcAge}
                                  onChange={(e) => setCalcAge(e.target.value)}
                                  placeholder="e.g. 25"
                                  min="18"
                                  max="100"
                                />
                              </div>
                              <div className="calculator-row">
                                <label>Annual Cost of Glasses/Contacts ($)</label>
                                <input
                                  type="number"
                                  value={calcCost}
                                  onChange={(e) => setCalcCost(e.target.value)}
                                  placeholder="e.g. 860"
                                  min="0"
                                />
                              </div>
                              <button className="calculate-btn" onClick={calculateSavings}>
                                {calcResult === null ? 'Calculate My Savings' : 'Recalculate'}
                              </button>
                              {calcResult !== null && (
                                <div className="savings-result">
                                  <p>By age 65, your estimated spending on eyewear would be:</p>
                                  <div className="savings-number">${calcResult.toLocaleString()}</div>
                                  <p className="savings-subtitle">That's enough to pay for vision correction several times over!</p>
                                  <a 
                                    href="tel:2105852020" 
                                    className="schedule-btn"
                                  >
                                    📅 Call to Schedule Consultation
                                  </a>
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </>
                    ) : (
                      message.content
                    )}
                  </div>
                </div>
              </div>
            ))}
            
            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* Input Area - Always show when messages exist, allow typing while streaming */}
      {!showEmptyState && (
        <div className="input-area">
          <div className="input-wrapper">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyPress}
              placeholder="Message Parkhurst NuVision GPT..."
              rows={1}
              className="chat-input"
            />
            <button
              onClick={handleSend}
              disabled={!input.trim() || isLoading}
              className="send-button"
            >
              {isLoading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Send className="w-5 h-5" />
              )}
            </button>
          </div>
          <p className="disclaimer">
            Parkhurst NuVision GPT can make mistakes. Check important info.
          </p>
        </div>
      )}
    </div>
  )
}

export default ChatInterface
