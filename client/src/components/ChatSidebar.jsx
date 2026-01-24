import React from 'react'
import { X, Plus, MessageSquare, ChevronLeft, LogOut, Trash2, Loader2 } from 'lucide-react'
import './ChatSidebar.css'

const ChatSidebar = ({ 
  isOpen, 
  onClose, 
  chats, 
  activeChatId, 
  onSelectChat, 
  onNewChat,
  onDeleteChat,
  isDarkMode,
  onLogout,
  loading,
  user
}) => {
  const formatTime = (timestamp) => {
    if (!timestamp) return ''
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
          {loading ? (
            <div className="flex items-center justify-center p-8">
              <Loader2 className="w-6 h-6 animate-spin text-gray-500" />
            </div>
          ) : chats.length === 0 ? (
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
                  <MessageSquare className="w-4 h-4 shrink-0" />
                  <span className="chat-title">{chat.title || 'New Chat'}</span>
                  <div className="chat-actions">
                    <button 
                      className="delete-chat-btn" 
                      onClick={(e) => onDeleteChat(chat.id, e)}
                      title="Delete chat"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="sidebar-footer">
          <div className="user-profile">
            <div className="user-avatar">
              {user?.email?.charAt(0).toUpperCase() || 'U'}
            </div>
            <div className="user-info">
              <div className="user-name">{user?.email?.split('@')[0] || 'User'}</div>
              <div className="user-email">{user?.email}</div>
            </div>
            {onLogout && (
              <button className="logout-btn" onClick={onLogout} title="Logout">
                <LogOut className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </div>
    </>
  )
}

export default ChatSidebar
