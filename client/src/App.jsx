import React, { useState, useEffect } from 'react'
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { Moon, Sun, PanelLeftOpen } from 'lucide-react'
import ChatInterface from './components/ChatInterface'
import ChatSidebar from './components/ChatSidebar'
import LandingPage from './pages/LandingPage'
import LoginPage from './pages/LoginPage'
import { supabase } from './lib/supabase'
import './App.css'

// Protected Route Component
const ProtectedRoute = ({ children }) => {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
    })

    return () => subscription.unsubscribe()
  }, [])

  if (loading) return <div className="loading-screen">Loading...</div>

  if (!session) {
    return <Navigate to="/login" replace />
  }

  return children
}

function MainApp() {
  const [isDarkMode, setIsDarkMode] = useState(() => {
    const saved = localStorage.getItem('pnvgptDarkMode')
    return saved ? JSON.parse(saved) : true
  })
  const [sidebarOpen, setSidebarOpen] = useState(() => {
    if (typeof window !== 'undefined') {
      return window.innerWidth >= 768
    }
    return true
  })
  const [chats, setChats] = useState([])
  const [activeChatId, setActiveChatId] = useState(null)

  useEffect(() => {
    localStorage.setItem('pnvgptDarkMode', JSON.stringify(isDarkMode))
    if (isDarkMode) {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
  }, [isDarkMode])

  const handleNewChat = () => {
    const newChatId = `chat-${Date.now()}`
    const newChat = {
      id: newChatId,
      title: 'New Chat',
      messages: [],
      createdAt: Date.now()
    }
    setChats(prev => [newChat, ...prev])
    setActiveChatId(newChatId)
    setSidebarOpen(false)
  }

  const handleSelectChat = (chatId) => {
    setActiveChatId(chatId)
    setSidebarOpen(false)
  }

  const handleUpdateChat = (chatId, messages) => {
    setChats(prev => prev.map(chat => 
      chat.id === chatId 
        ? { ...chat, messages, title: messages.length > 0 ? messages[0].content.substring(0, 50) : 'New Chat' }
        : chat
    ))
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
  }

  const activeChat = chats.find(c => c.id === activeChatId)

  return (
    <div className={`app ${isDarkMode ? 'dark' : ''}`}>
      {!sidebarOpen && (
        <button
          className="sidebar-toggle"
          onClick={() => setSidebarOpen(true)}
          aria-label="Open sidebar"
        >
          <PanelLeftOpen className="w-5 h-5" />
        </button>
      )}

      <ChatSidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        chats={chats}
        activeChatId={activeChatId}
        onSelectChat={handleSelectChat}
        onNewChat={handleNewChat}
        isDarkMode={isDarkMode}
        onLogout={handleLogout}
      />

      <div className={`main-content ${sidebarOpen ? 'sidebar-open' : ''}`}>
        <div className="top-bar">
          <button
            className="theme-toggle"
            onClick={() => setIsDarkMode(!isDarkMode)}
            aria-label="Toggle theme"
          >
            {isDarkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
          </button>
        </div>

        <ChatInterface
          chatId={activeChatId}
          chat={activeChat}
          onUpdateChat={handleUpdateChat}
          onNewChat={handleNewChat}
          isDarkMode={isDarkMode}
        />
      </div>
    </div>
  )
}

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route 
          path="/chat" 
          element={
            <ProtectedRoute>
              <MainApp />
            </ProtectedRoute>
          } 
        />
        {/* Redirect any other path to landing */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  )
}

export default App
