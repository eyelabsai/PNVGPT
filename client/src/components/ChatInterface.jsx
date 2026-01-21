import React, { useState, useEffect, useRef } from 'react'
import { Send, Loader2, Sparkles } from 'lucide-react'
import './ChatInterface.css'

const API_BASE = import.meta.env.DEV 
  ? 'http://localhost:3000' 
  : 'https://pnvgpt.onrender.com'

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
  const messagesEndRef = useRef(null)
  const inputRef = useRef(null)

  // Load messages from chat prop
  useEffect(() => {
    if (chat) {
      setMessages(chat.messages || [])
    } else {
      setMessages([])
    }
  }, [chatId, chat])

  // Auto-scroll to bottom
  useEffect(() => {
    scrollToBottom()
  }, [messages])

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  const handleSend = async () => {
    if (!input.trim() || isLoading) return

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
                assistantContent += data.content
                // Update the assistant message in place
                setMessages([...newMessages, { role: 'assistant', content: assistantContent }])
                scrollToBottom()
              } else if (data.type === 'done') {
                setIsStreaming(false)
              } else if (data.type === 'error') {
                throw new Error(data.content)
              }
            } catch (e) {
              // Ignore parse errors
            }
          }
        }
      }

      // Final update with complete message
      const finalMessages = [...newMessages, { role: 'assistant', content: assistantContent }]
      setMessages(finalMessages)
      onUpdateChat(chatId, finalMessages)

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
    "Where are you located?"
  ]

  const handleExampleClick = (prompt) => {
    setInput(prompt)
    inputRef.current?.focus()
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
