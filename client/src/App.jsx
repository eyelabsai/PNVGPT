import React, { useState, useEffect } from 'react'
import { Moon, Sun, PanelLeftOpen } from 'lucide-react'
import ChatInterface from './components/ChatInterface'
import ChatSidebar from './components/ChatSidebar'
import './App.css'

function App() {
  const [isDarkMode, setIsDarkMode] = useState(() => {
    const saved = localStorage.getItem('pnvgptDarkMode')
    return saved ? JSON.parse(saved) : true
  })
  const [sidebarOpen, setSidebarOpen] = useState(() => {
    // Default to closed on mobile, open on desktop
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

  const activeChat = chats.find(c => c.id === activeChatId)

  return (
    <div className={`app ${isDarkMode ? 'dark' : ''}`}>
      {/* Sidebar Toggle Button - Show when sidebar is closed */}
      {!sidebarOpen && (
        <button
          className="sidebar-toggle"
          onClick={() => setSidebarOpen(true)}
          aria-label="Open sidebar"
        >
          <PanelLeftOpen className="w-5 h-5" />
        </button>
      )}

      {/* Sidebar */}
      <ChatSidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        chats={chats}
        activeChatId={activeChatId}
        onSelectChat={handleSelectChat}
        onNewChat={handleNewChat}
        isDarkMode={isDarkMode}
      />

      {/* Main Chat Area */}
      <div className={`main-content ${sidebarOpen ? 'sidebar-open' : ''}`}>
        {/* Top Bar */}
        <div className="top-bar">
          <button
            className="theme-toggle"
            onClick={() => setIsDarkMode(!isDarkMode)}
            aria-label="Toggle theme"
          >
            {isDarkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
          </button>
        </div>

        {/* Chat Interface */}
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

export default App
