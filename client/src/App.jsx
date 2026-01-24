import React, { useState, useEffect } from 'react'
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { Moon, Sun, PanelLeftOpen, LogOut } from 'lucide-react'
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
  const [loadingChats, setLoadingLoadingChats] = useState(true)
  const [user, setUser] = useState(null)
  const [hasAutoCreated, setHasAutoCreated] = useState(false)

  // Load chats and user from Supabase on mount
  useEffect(() => {
    fetchChats()
    fetchUser()
  }, [])

  async function fetchUser() {
    const { data: { user } } = await supabase.auth.getUser()
    setUser(user)
  }

  async function fetchChats() {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data, error } = await supabase
        .from('user_chats')
        .select('*')
        .order('updated_at', { ascending: false })

      if (error) throw error
      setChats(data || [])
    } catch (err) {
      console.error('Error fetching chats:', err.message)
    } finally {
      setLoadingLoadingChats(false)
    }
  }

  // Automatically create a new chat when chats finish loading (like ChatGPT)
  useEffect(() => {
    if (!loadingChats && !hasAutoCreated && !activeChatId) {
      setHasAutoCreated(true)
      handleNewChat()
    }
  }, [loadingChats, hasAutoCreated, activeChatId])

  useEffect(() => {
    localStorage.setItem('pnvgptDarkMode', JSON.stringify(isDarkMode))
    if (isDarkMode) {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
  }, [isDarkMode])

  const handleNewChat = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const newChat = {
        user_id: user.id,
        title: 'New Chat',
        messages: []
      }

      const { data, error } = await supabase
        .from('user_chats')
        .insert([newChat])
        .select()
        .single()

      if (error) throw error

    setChats(prev => [data, ...prev])
    setActiveChatId(data.id)
    // Removed setSidebarOpen(false) to keep sidebar open on desktop
  } catch (err) {
      console.error('Error creating new chat:', err.message)
    }
  }

  const handleSelectChat = (chatId) => {
    setActiveChatId(chatId)
    // Removed setSidebarOpen(false) to keep sidebar open on desktop
  }

  const handleUpdateChat = async (chatId, messages) => {
    // Determine title from first message
    const newTitle = messages.length > 0 
      ? messages[0].content.substring(0, 30) + (messages[0].content.length > 30 ? '...' : '')
      : 'New Chat'

    // Update local state immediately for UI responsiveness
    setChats(prev => prev.map(chat => 
      chat.id === chatId 
        ? { ...chat, messages, title: newTitle }
        : chat
    ))

    // Update database
    try {
      const title = messages.length > 0 ? messages[0].content.substring(0, 30) + (messages[0].content.length > 30 ? '...' : '') : 'New Chat'
      const { error } = await supabase
        .from('user_chats')
        .update({ messages, title, updated_at: new Date().toISOString() })
        .eq('id', chatId)

      if (error) throw error
    } catch (err) {
      console.error('Error updating chat in DB:', err.message)
    }
  }

  const handleDeleteChat = async (chatId, e) => {
    e.stopPropagation() // Prevent selecting the chat when clicking delete
    
    if (!window.confirm('Are you sure you want to delete this chat?')) return

    try {
      const { error } = await supabase
        .from('user_chats')
        .delete()
        .eq('id', chatId)

      if (error) throw error

      setChats(prev => prev.filter(c => c.id !== chatId))
      if (activeChatId === chatId) {
        // If we deleted the active chat, create a new one immediately
        setActiveChatId(null)
        handleNewChat()
      }
    } catch (err) {
      console.error('Error deleting chat:', err.message)
    }
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
        onDeleteChat={handleDeleteChat}
        isDarkMode={isDarkMode}
        onLogout={handleLogout}
        loading={loadingChats}
        user={user}
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

        {activeChatId && activeChat ? (
          <ChatInterface
            chatId={activeChatId}
            chat={activeChat}
            onUpdateChat={handleUpdateChat}
            onNewChat={handleNewChat}
            isDarkMode={isDarkMode}
          />
        ) : (
          <div className="loading-chat-container">
            <div className="loading-spinner"></div>
            <p className="loading-text">Starting new conversation...</p>
          </div>
        )}
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
