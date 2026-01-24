/**
 * Export User Chats - Readable Format
 * 
 * Usage: node scripts/export-user-chats.js <user_id> [format]
 * 
 * Formats: markdown (default), html, json
 * 
 * Example: node scripts/export-user-chats.js 4820f788-e536-48de-89e2-c937de6e60f2 markdown
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_KEY in .env');
  process.exit(1);
}

const userId = process.argv[2];
const format = process.argv[3] || 'markdown';

if (!userId) {
  console.error('❌ Usage: node scripts/export-user-chats.js <user_id> [format]');
  console.error('   Formats: markdown (default), html, json');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function exportChats() {
  try {
    console.log(`📥 Fetching chats for user: ${userId}...`);
    
    const { data: chats, error } = await supabase
      .from('user_chats')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    if (!chats || chats.length === 0) {
      console.log('❌ No chats found for this user');
      return;
    }

    console.log(`✅ Found ${chats.length} chat(s)`);

    // Try to get user email for filename (optional)
    let userEmail = userId.substring(0, 8);
    let userDisplayEmail = `User ${userId.substring(0, 8)}`;
    try {
      const { data: userData } = await supabase.auth.admin.getUserById(userId);
      if (userData?.user?.email) {
        userEmail = userData.user.email.split('@')[0]; // Use email prefix
        userDisplayEmail = userData.user.email;
      }
    } catch (err) {
      // If admin access fails, just use user_id prefix
      console.log('⚠️  Could not fetch user email, using user_id prefix');
    }
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    const filename = `user-chats-${userEmail}-${timestamp}`;

    let output;
    let extension;

    switch (format.toLowerCase()) {
      case 'html':
        output = generateHTML(chats, userDisplayEmail);
        extension = 'html';
        break;
      case 'json':
        output = JSON.stringify(chats, null, 2);
        extension = 'json';
        break;
      case 'markdown':
      default:
        output = generateMarkdown(chats, userDisplayEmail);
        extension = 'md';
        break;
    }

    const filepath = path.join(__dirname, '..', `${filename}.${extension}`);
    fs.writeFileSync(filepath, output, 'utf8');

    console.log(`✅ Exported to: ${filepath}`);
    console.log(`📊 Total chats: ${chats.length}`);
    console.log(`💬 Total messages: ${chats.reduce((sum, chat) => sum + (chat.messages?.length || 0), 0)}`);

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

function generateMarkdown(chats, userEmail) {
  let md = `# User Chats Export\n\n`;
  md += `**User:** ${userEmail}\n`;
  md += `**Export Date:** ${new Date().toLocaleString()}\n`;
  md += `**Total Chats:** ${chats.length}\n\n`;
  md += `---\n\n`;

  chats.forEach((chat, index) => {
    md += `## Chat ${index + 1}: ${chat.title || 'New Chat'}\n\n`;
    md += `**Chat ID:** \`${chat.id}\`\n`;
    md += `**Created:** ${new Date(chat.created_at).toLocaleString()}\n`;
    md += `**Updated:** ${new Date(chat.updated_at).toLocaleString()}\n`;
    md += `**Messages:** ${chat.messages?.length || 0}\n\n`;

    if (chat.messages && chat.messages.length > 0) {
      md += `### Conversation\n\n`;
      chat.messages.forEach((msg, msgIndex) => {
        const role = msg.role === 'user' ? '👤 User' : '🤖 Assistant';
        md += `**${role}** (Message ${msgIndex + 1}):\n\n`;
        md += `${msg.content}\n\n`;
        md += `---\n\n`;
      });
    } else {
      md += `*No messages in this chat*\n\n`;
    }

    md += `\n\n`;
  });

  return md;
}

function generateHTML(chats, userEmail) {
  let html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>User Chats Export - ${userEmail}</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      max-width: 900px;
      margin: 0 auto;
      padding: 2rem;
      background: #f5f5f5;
      line-height: 1.6;
    }
    .header {
      background: white;
      padding: 2rem;
      border-radius: 8px;
      margin-bottom: 2rem;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    .chat {
      background: white;
      padding: 2rem;
      border-radius: 8px;
      margin-bottom: 2rem;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    .chat-header {
      border-bottom: 2px solid #e0e0e0;
      padding-bottom: 1rem;
      margin-bottom: 1.5rem;
    }
    .chat-title {
      font-size: 1.5rem;
      font-weight: bold;
      margin: 0 0 0.5rem 0;
      color: #333;
    }
    .chat-meta {
      color: #666;
      font-size: 0.9rem;
    }
    .message {
      margin-bottom: 1.5rem;
      padding: 1rem;
      border-radius: 6px;
    }
    .message-user {
      background: #e3f2fd;
      border-left: 4px solid #2196f3;
    }
    .message-assistant {
      background: #f1f8e9;
      border-left: 4px solid #4caf50;
    }
    .message-role {
      font-weight: bold;
      margin-bottom: 0.5rem;
      color: #555;
    }
    .message-content {
      color: #333;
      white-space: pre-wrap;
    }
    .empty {
      color: #999;
      font-style: italic;
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>User Chats Export</h1>
    <p><strong>User:</strong> ${userEmail}</p>
    <p><strong>Export Date:</strong> ${new Date().toLocaleString()}</p>
    <p><strong>Total Chats:</strong> ${chats.length}</p>
  </div>
`;

  chats.forEach((chat, index) => {
    html += `
  <div class="chat">
    <div class="chat-header">
      <h2 class="chat-title">Chat ${index + 1}: ${escapeHtml(chat.title || 'New Chat')}</h2>
      <div class="chat-meta">
        <strong>Chat ID:</strong> <code>${chat.id}</code><br>
        <strong>Created:</strong> ${new Date(chat.created_at).toLocaleString()}<br>
        <strong>Updated:</strong> ${new Date(chat.updated_at).toLocaleString()}<br>
        <strong>Messages:</strong> ${chat.messages?.length || 0}
      </div>
    </div>
`;

    if (chat.messages && chat.messages.length > 0) {
      chat.messages.forEach((msg) => {
        const roleClass = msg.role === 'user' ? 'message-user' : 'message-assistant';
        const roleLabel = msg.role === 'user' ? '👤 User' : '🤖 Assistant';
        html += `
    <div class="message ${roleClass}">
      <div class="message-role">${roleLabel}</div>
      <div class="message-content">${escapeHtml(msg.content)}</div>
    </div>
`;
      });
    } else {
      html += `    <p class="empty">No messages in this chat</p>\n`;
    }

    html += `  </div>\n`;
  });

  html += `</body>\n</html>`;
  return html;
}

function escapeHtml(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// Run export
exportChats();
