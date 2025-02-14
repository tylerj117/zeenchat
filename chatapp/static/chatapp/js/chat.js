// chat.js
class ChatManager {
    constructor(currentUser, otherUser) {
        this.currentUser = currentUser;
        this.otherUser = otherUser;
        this.socket = null;
        this.messageInput = document.getElementById('chat-message-input');
        this.messageForm = document.getElementById('chat-form');
        this.messagesDiv = document.getElementById('chat-messages');
        this.csrfToken = document.querySelector('[name=csrfmiddlewaretoken]').value;
        this.typingIndicator = document.getElementById('typing-indicator');
        this.typingUsername = document.getElementById('typing-username');
        this.typingTimeout = null;
        
        this.initializeWebSocket();
        this.setupEventListeners();
        this.setupTypingDetection();
    }

    setupTypingDetection() {
        this.messageInput.addEventListener('input', () => {
            if (!this.typingTimeout) {
                this.socket.send(JSON.stringify({
                    'type': 'typing',
                    'username': this.currentUser
                }));
            }
            
            // Clear existing timeout
            clearTimeout(this.typingTimeout);
            
            // Set new timeout
            this.typingTimeout = setTimeout(() => {
                this.socket.send(JSON.stringify({
                    'type': 'stopped_typing',
                    'username': this.currentUser
                }));
                this.typingTimeout = null;
            }, 1000); // We stop typing indicator after 1 second of no input
        });
    }

    initializeWebSocket() {
        const users = [this.currentUser, this.otherUser].sort();
        const wsSchema = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${wsSchema}//${window.location.host}/ws/chat/${users[0]}/${users[1]}/`;
        
        this.socket = new WebSocket(wsUrl);

        this.socket.onopen = () => {
            console.log('WebSocket connection established');
        };

        this.socket.onmessage = (event) => {
            const data = JSON.parse(event.data);
            this.appendMessage(data.message, data.sender === this.currentUser);
        };

        this.socket.onclose = () => {
            console.log('WebSocket connection closed');
            setTimeout(() => this.initializeWebSocket(), 5000);
        };
        this.socket.onmessage = (event) => {
            const data = JSON.parse(event.data);
            
            if (data.type === 'typing') {
                this.showTypingIndicator(data.username);
            } else if (data.type === 'stopped_typing') {
                this.hideTypingIndicator();
            } else {
                this.appendMessage(data.message, data.sender === this.currentUser);
                this.hideTypingIndicator();
            }
        };
    }

    showTypingIndicator(username) {
        if (username !== this.currentUser) {
            this.typingUsername.textContent = username;
            this.typingIndicator.classList.remove('hidden');
        }
    }

    hideTypingIndicator() {
        this.typingIndicator.classList.add('hidden');
    }

    async saveMessageToDatabase(message) {
        try {
            const response = await fetch('/save-message/', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': this.csrfToken
                },
                body: JSON.stringify({
                    message: message,
                    receiver: this.otherUser
                })
            });

            if (!response.ok) {
                throw new Error('Failed to save message');
            }

            return await response.json();
        } catch (error) {
            console.error('Error saving message:', error);
            throw error;
        }
    }

    setupEventListeners() {
        this.messageForm.addEventListener('submit', async (e) => {
            e.preventDefault(); // Prevent form submission
            
            const message = this.messageInput.value.trim();
            if (!message) return;

            try {
                // First save to database
                await this.saveMessageToDatabase(message);

                // Then send through WebSocket
                if (this.socket.readyState === WebSocket.OPEN) {
                    this.socket.send(JSON.stringify({
                        'type': 'message',
                        'message': message,
                        'sender': this.currentUser
                    }));
                }

                // Clear input only after successful save and send
                this.messageInput.value = '';
            } catch (error) {
                console.error('Error handling message:', error);
                alert('Failed to send message. Please try again.');
            }
        });
    }

    appendMessage(message, isSender) {
        const messageDiv = document.createElement('div');
        messageDiv.className = `flex ${isSender ? 'justify-end' : ''}`;
        messageDiv.innerHTML = `
            <div class="max-w-xs lg:max-w-md p-3 rounded-lg ${isSender ? 'bg-indigo-600 text-white' : 'bg-gray-200'}">
                <p>${this.escapeHtml(message)}</p>
                <span class="text-xs ${isSender ? 'text-indigo-200' : 'text-gray-500'}">
                    ${new Date().toLocaleTimeString([], {hour: 'numeric', minute:'2-digit'})}
                </span>
            </div>
        `;
        this.messagesDiv.appendChild(messageDiv);
        this.messagesDiv.scrollTop = this.messagesDiv.scrollHeight;
    }

    escapeHtml(unsafe) {
        return unsafe
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }
}