/**
 * FAQ Assistant Embed Snippet
 * 
 * This is a minimal JavaScript snippet to embed the FAQ chat widget
 * into any website. Add this to your HTML:
 * 
 * <script src="path/to/embed-snippet.js"></script>
 * 
 * Or inline it directly in your page.
 */

(function() {
    'use strict';

    // Configuration - UPDATE THESE VALUES
    const CONFIG = {
        apiUrl: 'https://pnvgpt.onrender.com/ask',  // Your API endpoint
        position: 'bottom-right',              // bottom-right, bottom-left, top-right, top-left
        primaryColor: '#667eea',               // Widget color theme
        buttonText: '💬 Ask a Question'        // Button text
    };

    /**
     * Call the FAQ API
     */
    async function askFAQ(question) {
        try {
            const response = await fetch(CONFIG.apiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ query: question })
            });

            if (!response.ok) {
                throw new Error('Network response was not ok');
            }

            const data = await response.json();
            return data.answer;

        } catch (error) {
            console.error('FAQ Error:', error);
            return "I'm sorry, I'm having trouble connecting right now. Please call our office for assistance.";
        }
    }

    /**
     * Create and inject the chat widget
     */
    function createWidget() {
        // Create widget container
        const widget = document.createElement('div');
        widget.id = 'faq-widget';
        widget.innerHTML = `
            <style>
                #faq-widget {
                    position: fixed;
                    ${CONFIG.position.includes('bottom') ? 'bottom: 20px;' : 'top: 20px;'}
                    ${CONFIG.position.includes('right') ? 'right: 20px;' : 'left: 20px;'}
                    z-index: 9999;
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
                }
                
                #faq-toggle-btn {
                    background: ${CONFIG.primaryColor};
                    color: white;
                    border: none;
                    padding: 15px 25px;
                    border-radius: 50px;
                    font-size: 16px;
                    cursor: pointer;
                    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
                    transition: transform 0.2s;
                }
                
                #faq-toggle-btn:hover {
                    transform: translateY(-2px);
                    box-shadow: 0 6px 16px rgba(0, 0, 0, 0.2);
                }
                
                #faq-chat-box {
                    display: none;
                    position: absolute;
                    ${CONFIG.position.includes('bottom') ? 'bottom: 70px;' : 'top: 70px;'}
                    ${CONFIG.position.includes('right') ? 'right: 0;' : 'left: 0;'}
                    width: 350px;
                    height: 500px;
                    background: white;
                    border-radius: 12px;
                    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.2);
                    flex-direction: column;
                }
                
                #faq-chat-box.open {
                    display: flex;
                }
                
                .faq-header {
                    background: ${CONFIG.primaryColor};
                    color: white;
                    padding: 15px;
                    font-weight: 600;
                    border-radius: 12px 12px 0 0;
                }
                
                .faq-messages {
                    flex: 1;
                    overflow-y: auto;
                    padding: 15px;
                    display: flex;
                    flex-direction: column;
                    gap: 10px;
                }
                
                .faq-message {
                    padding: 10px 14px;
                    border-radius: 12px;
                    max-width: 80%;
                    line-height: 1.4;
                    font-size: 14px;
                }
                
                .faq-message.user {
                    background: ${CONFIG.primaryColor};
                    color: white;
                    align-self: flex-end;
                }
                
                .faq-message.assistant {
                    background: #f0f0f0;
                    color: #333;
                    align-self: flex-start;
                }
                
                .faq-input-area {
                    padding: 15px;
                    border-top: 1px solid #e0e0e0;
                    display: flex;
                    gap: 10px;
                }
                
                .faq-input {
                    flex: 1;
                    padding: 10px;
                    border: 1px solid #e0e0e0;
                    border-radius: 20px;
                    outline: none;
                    font-size: 14px;
                }
                
                .faq-send-btn {
                    background: ${CONFIG.primaryColor};
                    color: white;
                    border: none;
                    padding: 10px 20px;
                    border-radius: 20px;
                    cursor: pointer;
                    font-size: 14px;
                }
            </style>
            
            <button id="faq-toggle-btn">${CONFIG.buttonText}</button>
            
            <div id="faq-chat-box">
                <div class="faq-header">FAQ Assistant</div>
                <div class="faq-messages" id="faq-messages">
                    <div class="faq-message assistant">
                        Hello! How can I help you today?
                    </div>
                </div>
                <div class="faq-input-area">
                    <input type="text" class="faq-input" id="faq-input" placeholder="Ask a question..." />
                    <button class="faq-send-btn" id="faq-send-btn">Send</button>
                </div>
            </div>
        `;

        document.body.appendChild(widget);

        // Event handlers
        const toggleBtn = document.getElementById('faq-toggle-btn');
        const chatBox = document.getElementById('faq-chat-box');
        const input = document.getElementById('faq-input');
        const sendBtn = document.getElementById('faq-send-btn');
        const messages = document.getElementById('faq-messages');

        toggleBtn.addEventListener('click', () => {
            chatBox.classList.toggle('open');
            if (chatBox.classList.contains('open')) {
                input.focus();
            }
        });

        async function sendMessage() {
            const question = input.value.trim();
            if (!question) return;

            // Add user message
            const userMsg = document.createElement('div');
            userMsg.className = 'faq-message user';
            userMsg.textContent = question;
            messages.appendChild(userMsg);

            // Clear input
            input.value = '';

            // Show loading
            const loadingMsg = document.createElement('div');
            loadingMsg.className = 'faq-message assistant';
            loadingMsg.textContent = 'Thinking...';
            messages.appendChild(loadingMsg);

            // Scroll to bottom
            messages.scrollTop = messages.scrollHeight;

            // Get answer
            const answer = await askFAQ(question);

            // Remove loading
            loadingMsg.remove();

            // Add assistant message
            const assistantMsg = document.createElement('div');
            assistantMsg.className = 'faq-message assistant';
            assistantMsg.textContent = answer;
            messages.appendChild(assistantMsg);

            // Scroll to bottom
            messages.scrollTop = messages.scrollHeight;
        }

        sendBtn.addEventListener('click', sendMessage);
        input.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                sendMessage();
            }
        });
    }

    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', createWidget);
    } else {
        createWidget();
    }

    // Export for external use
    window.FAQAPI = { askFAQ };
})();




