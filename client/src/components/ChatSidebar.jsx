import React from 'react'
import { X, Plus, MessageSquare, ChevronLeft } from 'lucide-react'
import './ChatSidebar.css'

const ChatSidebar = ({ 
  isOpen, 
  onClose, 
  chats, 
  activeChatId, 
  onSelectChat, 
  onNewChat,
  isDarkMode 
}) => {
  const formatTime = (timestamp) => {
    const date = new Date(timestamp)
    const now = new Date()
    const diff = now - date
    
    if (diff < 60000) return 'Just now'
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`
    if (diff < 604800000) return `${Math.floor(diff / 86400000)}d ago`
    return date.toLocaleDateString()
  }

  return (
    <>
      {/* Overlay for mobile */}
      {isOpen && (
        <div className="sidebar-overlay" onClick={onClose} />
      )}

      {/* Sidebar */}
      <div className={`sidebar ${isOpen ? 'open' : ''}`}>
        {/* Header */}
        <div className="sidebar-header">
          <button className="new-chat-btn" onClick={onNewChat}>
            <Plus className="w-4 h-4" />
            <span>New chat</span>
          </button>
          <button className="close-sidebar-btn" onClick={onClose}>
            <ChevronLeft className="w-4 h-4" />
          </button>
        </div>

        {/* Chat List */}
        <div className="sidebar-content">
          {chats.length === 0 ? (
            <div className="empty-state">
              <MessageSquare className="w-12 h-12" />
              <p>No chats yet</p>
              <p className="subtitle">Start a new conversation!</p>
            </div>
          ) : (
            <div className="chat-list">
              {chats.map(chat => (
                <div
                  key={chat.id}
                  className={`chat-item ${activeChatId === chat.id ? 'active' : ''}`}
                  onClick={() => onSelectChat(chat.id)}
                >
                  <MessageSquare className="w-4 h-4" />
                  <span className="chat-title">{chat.title || 'New Chat'}</span>
                  <span className="chat-time">{formatTime(chat.createdAt)}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="sidebar-footer">
          <div className="footer-info">
            <div className="footer-name">Parkhurst NuVision</div>
            <div className="footer-subtitle">AI Assistant</div>
          </div>
        </div>
      </div>
    </>
  )
}

export default ChatSidebar
