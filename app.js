// Global variables
let currentUser = '';
let currentGroup = null;
let groups = {};
let crypto = new SimpleCrypto();
let replyingTo = null;

// Initialize app
document.addEventListener('DOMContentLoaded', function() {
    loadUserData();
    if (currentUser) {
        hideNamePopup();
        loadGroups();
        checkGroupFromURL();
    }
});

// User management
function loadUserData() {
    const userData = localStorage.getItem('p2p_user');
    if (userData) {
        const data = JSON.parse(userData);
        currentUser = data.name;
        document.getElementById('currentUser').textContent = currentUser;
    }
}

function setUserName() {
    const name = document.getElementById('userName').value.trim();
    if (!name) {
        alert('Please enter your name');
        return;
    }
    
    currentUser = name;
    const userData = { name: currentUser, id: generateUserIP() };
    localStorage.setItem('p2p_user', JSON.stringify(userData));
    document.getElementById('currentUser').textContent = currentUser;
    
    hideNamePopup();
    loadGroups();
}

function hideNamePopup() {
    document.getElementById('namePopup').classList.add('hidden');
    document.getElementById('app').classList.remove('hidden');
}

function generateUserIP() {
    // Simulate IP-like identifier
    return Math.random().toString(36).substring(2, 15);
}

// Group management
function loadGroups() {
    const savedGroups = localStorage.getItem('p2p_groups');
    if (savedGroups) {
        groups = JSON.parse(savedGroups);
        displayGroups();
    }
}

function saveGroups() {
    localStorage.setItem('p2p_groups', JSON.stringify(groups));
}

function displayGroups() {
    const groupsContainer = document.getElementById('groups');
    groupsContainer.innerHTML = '';
    
    if (Object.keys(groups).length === 0) {
        groupsContainer.innerHTML = '<p style="text-align: center; color: #666; padding: 2rem;">No groups yet. Create or join a group to start chatting!</p>';
        return;
    }
    
    Object.keys(groups).forEach(groupId => {
        const group = groups[groupId];
        const groupElement = document.createElement('div');
        groupElement.className = 'group-item';
        groupElement.onclick = () => openChat(groupId);
        
        const lastMessage = group.messages.length > 0 ? group.messages[group.messages.length - 1] : null;
        const lastMessageText = lastMessage ? `${lastMessage.sender}: ${lastMessage.text.substring(0, 30)}...` : 'No messages yet';
        
        groupElement.innerHTML = `
            <div class="group-info">
                <h4>${group.name} ${group.admin === currentUser ? '👑' : ''}</h4>
                <small>${group.members.length} members • ${lastMessageText}</small>
            </div>
            <div style="font-size: 0.8rem; color: #666;">
                ${lastMessage ? new Date(lastMessage.timestamp).toLocaleDateString() : ''}
            </div>
        `;
        
        groupsContainer.appendChild(groupElement);
    });
}

function createGroup() {
    document.getElementById('createGroupModal').classList.remove('hidden');
}

function hideCreateGroup() {
    document.getElementById('createGroupModal').classList.add('hidden');
    document.getElementById('newGroupNameInput').value = '';
}

function confirmCreateGroup() {
    const groupName = document.getElementById('newGroupNameInput').value.trim();
    if (!groupName) {
        alert('Please enter a group name');
        return;
    }
    
    const groupId = 'group_' + Date.now() + '_' + Math.random().toString(36).substring(2, 15);
    const groupCode = Math.random().toString(36).substring(2, 8).toUpperCase();
    
    const group = {
        id: groupId,
        code: groupCode,
        name: groupName,
        admin: currentUser,
        members: [currentUser],
        messages: [],
        created: Date.now()
    };
    
    groups[groupId] = group;
    saveGroups();
    displayGroups();
    
    // Create group on server
    p2pChat.createGroup(groupId, groupCode, groupName);
    
    // Hide create modal and show link modal
    hideCreateGroup();
    showGroupLink(groupId, groupCode);
}

function showGroupLink(groupId, groupCode) {
    const groupLink = `${window.location.origin}${window.location.pathname}?group=${groupId}`;
    document.getElementById('groupLinkDisplay').value = groupLink;
    document.getElementById('groupCodeDisplay').value = groupCode;
    document.getElementById('groupCode').textContent = groupCode;
    document.getElementById('groupLinkModal').classList.remove('hidden');
}

function hideGroupLink() {
    document.getElementById('groupLinkModal').classList.add('hidden');
}

function copyGroupLink() {
    const linkInput = document.getElementById('groupLinkDisplay');
    copyToClipboard(linkInput.value, 'Link copied to clipboard!');
}

function copyGroupCode() {
    const codeInput = document.getElementById('groupCodeDisplay');
    copyToClipboard(codeInput.value, 'Code copied to clipboard!');
}

function copyToClipboard(text, message) {
    try {
        navigator.clipboard.writeText(text).then(() => {
            alert(message);
        }).catch(() => {
            // Fallback
            const textArea = document.createElement('textarea');
            textArea.value = text;
            document.body.appendChild(textArea);
            textArea.select();
            document.execCommand('copy');
            document.body.removeChild(textArea);
            alert(message);
        });
    } catch (err) {
        alert('Please copy manually: ' + text);
    }
}

function showJoinGroup() {
    document.getElementById('joinGroupForm').classList.remove('hidden');
}

function hideJoinGroup() {
    document.getElementById('joinGroupForm').classList.add('hidden');
    document.getElementById('groupLink').value = '';
}

function joinGroup() {
    const input = document.getElementById('groupLink').value.trim();
    if (!input) {
        alert('Please enter a group code or link');
        return;
    }
    
    // Show loading state
    const joinBtn = document.querySelector('#joinGroupForm button:first-of-type');
    const originalText = joinBtn.textContent;
    joinBtn.textContent = 'Joining...';
    joinBtn.disabled = true;
    
    // Check if it's a link or code
    if (input.startsWith('http')) {
        try {
            const url = new URL(input);
            const groupId = url.searchParams.get('group');
            if (groupId) {
                p2pChat.connect(groupId);
            } else {
                alert('Invalid group link');
                resetJoinButton(joinBtn, originalText);
                return;
            }
        } catch (e) {
            alert('Invalid group link');
            resetJoinButton(joinBtn, originalText);
            return;
        }
    } else {
        // It's a code - validate format
        const code = input.toUpperCase().replace(/[^A-Z0-9]/g, '');
        if (code.length < 3) {
            alert('Group code must be at least 3 characters');
            resetJoinButton(joinBtn, originalText);
            return;
        }
        p2pChat.joinByCode(code);
    }
    
    // Reset button after 3 seconds
    setTimeout(() => {
        resetJoinButton(joinBtn, originalText);
    }, 3000);
    
    hideJoinGroup();
}

function resetJoinButton(btn, originalText) {
    btn.textContent = originalText;
    btn.disabled = false;
}

function checkGroupFromURL() {
    const urlParams = new URLSearchParams(window.location.search);
    const groupId = urlParams.get('group');
    
    if (groupId) {
        // Auto-join group from URL
        if (!groups[groupId]) {
            const groupName = prompt('You are joining a group. Enter group name:') || 'New Group';
            groups[groupId] = {
                id: groupId,
                name: groupName,
                admin: 'Unknown',
                members: [currentUser],
                messages: [],
                created: Date.now()
            };
            saveGroups();
            displayGroups();
        }
        openChat(groupId);
    }
}

// Chat functionality
function openChat(groupId) {
    currentGroup = groups[groupId];
    if (!currentGroup) return;
    
    document.getElementById('groupManager').classList.add('hidden');
    document.getElementById('groupsList').classList.add('hidden');
    document.getElementById('chatInterface').classList.remove('hidden');
    
    document.getElementById('groupName').textContent = currentGroup.name;
    
    // Show admin button if user is admin
    if (currentGroup.admin === currentUser) {
        document.getElementById('adminBtn').classList.remove('hidden');
    } else {
        document.getElementById('adminBtn').classList.add('hidden');
    }
    
    displayMessages();
    
    // Connect to P2P network for real-time communication
    p2pChat.connect(groupId);
}

function backToGroups() {
    document.getElementById('chatInterface').classList.add('hidden');
    document.getElementById('groupManager').classList.remove('hidden');
    document.getElementById('groupsList').classList.remove('hidden');
    
    // Don't disconnect - just leave the group room
    currentGroup = null;
    replyingTo = null;
}

function displayMessages() {
    const messagesContainer = document.getElementById('messages');
    messagesContainer.innerHTML = '';
    
    currentGroup.messages.forEach((message, index) => {
        const messageElement = createMessageElement(message, index);
        messagesContainer.appendChild(messageElement);
    });
    
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
    
    // Add scroll event listener
    messagesContainer.addEventListener('scroll', checkScrollPosition);
}

// Connection status indicator
function updateConnectionStatus(isConnected, message = '') {
    const indicator = document.querySelector('.online-indicator');
    if (indicator) {
        if (isConnected) {
            indicator.style.background = '#4caf50';
            indicator.title = 'Connected to server';
        } else {
            indicator.style.background = '#f44336';
            indicator.title = message || 'Disconnected from server';
        }
    }
}

// Initialize connection status
document.addEventListener('DOMContentLoaded', function() {
    updateConnectionStatus(false);
});

// Only disconnect when user actually leaves the website
window.addEventListener('beforeunload', function() {
    if (p2pChat.socket) {
        p2pChat.disconnect();
    }
});

// Close emoji picker when clicking outside
document.addEventListener('click', function(event) {
    const emojiPicker = document.getElementById('emojiPicker');
    const emojiBtn = document.querySelector('.emoji-btn');
    
    if (emojiPicker && !emojiPicker.contains(event.target) && event.target !== emojiBtn) {
        emojiPicker.classList.add('hidden');
    }
});

function createMessageElement(message, index) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${message.sender === currentUser ? 'own' : ''}`;
    
    let replyHtml = '';
    if (message.replyTo !== undefined) {
        const repliedMessage = currentGroup.messages[message.replyTo];
        if (repliedMessage) {
            replyHtml = `
                <div class="reply-indicator">
                    Replying to ${repliedMessage.sender}: ${repliedMessage.text.substring(0, 50)}${repliedMessage.text.length > 50 ? '...' : ''}
                </div>
            `;
        }
    }
    
    messageDiv.innerHTML = `
        <div class="message-info">
            ${message.sender} • ${new Date(message.timestamp).toLocaleTimeString()}
        </div>
        <div class="message-bubble" data-index="${index}">
            ${replyHtml}
            <div>${message.text}</div>
            <button class="reply-button" onclick="setReply(${index})">↩️</button>
        </div>
    `;
    
    // Add swipe functionality
    const bubble = messageDiv.querySelector('.message-bubble');
    let startX = 0;
    let currentX = 0;
    
    bubble.addEventListener('touchstart', (e) => {
        startX = e.touches[0].clientX;
    });
    
    bubble.addEventListener('touchmove', (e) => {
        currentX = e.touches[0].clientX;
        const diffX = startX - currentX;
        
        if (diffX > 50) {
            bubble.classList.add('swiped');
        } else {
            bubble.classList.remove('swiped');
        }
    });
    
    bubble.addEventListener('touchend', () => {
        if (bubble.classList.contains('swiped')) {
            setReply(index);
        }
        bubble.classList.remove('swiped');
    });
    
    return messageDiv;
}

function setReply(messageIndex) {
    replyingTo = messageIndex;
    const repliedMessage = currentGroup.messages[messageIndex];
    const input = document.getElementById('messageText');
    input.placeholder = `Replying to ${repliedMessage.sender}: ${repliedMessage.text.substring(0, 30)}...`;
    input.focus();
}

function sendMessage() {
    const messageText = document.getElementById('messageText').value.trim();
    if (!messageText) return;
    
    const message = {
        id: 'msg_' + Date.now() + '_' + Math.random().toString(36).substring(2, 15),
        text: messageText,
        sender: currentUser,
        timestamp: Date.now(),
        replyTo: replyingTo
    };
    
    currentGroup.messages.push(message);
    groups[currentGroup.id] = currentGroup;
    saveGroups();
    
    document.getElementById('messageText').value = '';
    document.getElementById('messageText').placeholder = 'Type a message...';
    replyingTo = null;
    
    displayMessages();
    
    // Broadcast message to other peers
    p2pChat.broadcastMessage(message);
}

function handleEnter(event) {
    if (event.key === 'Enter') {
        sendMessage();
    }
}

// Group settings
function showGroupSettings() {
    if (currentGroup.admin !== currentUser) return;
    
    document.getElementById('newGroupName').value = currentGroup.name;
    displayMembers();
    document.getElementById('groupSettings').classList.remove('hidden');
}

function hideGroupSettings() {
    document.getElementById('groupSettings').classList.add('hidden');
}

function displayMembers() {
    const membersList = document.getElementById('membersList');
    membersList.innerHTML = `
        <h4>Group Code: <span style="background: #f0f0f0; padding: 4px 8px; border-radius: 4px; font-family: monospace;">${currentGroup.code}</span></h4>
        <button onclick="copyText('${currentGroup.code}')" style="margin-bottom: 1rem; padding: 8px 16px; background: #25d366; color: white; border: none; border-radius: 4px; cursor: pointer;">Copy Code</button>
        <h4>Members:</h4>
    `;
    
    currentGroup.members.forEach(member => {
        const memberDiv = document.createElement('div');
        memberDiv.className = 'member-item';
        memberDiv.innerHTML = `
            <span>${member} ${member === currentGroup.admin ? '(Admin)' : ''}</span>
            ${member !== currentGroup.admin && currentGroup.admin === currentUser ? 
                `<button onclick="kickMember('${member}')">Kick</button>` : ''}
        `;
        membersList.appendChild(memberDiv);
    });
}

function copyText(text) {
    navigator.clipboard.writeText(text).then(() => {
        alert('Code copied to clipboard!');
    }).catch(() => {
        const textArea = document.createElement('textarea');
        textArea.value = text;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
        alert('Code copied to clipboard!');
    });
}

function renameGroup() {
    const newName = document.getElementById('newGroupName').value.trim();
    if (!newName) return;
    
    currentGroup.name = newName;
    groups[currentGroup.id] = currentGroup;
    saveGroups();
    
    document.getElementById('groupName').textContent = newName;
    displayGroups();
    hideGroupSettings();
}

function kickMember(memberName) {
    if (currentGroup.admin !== currentUser) return;
    
    currentGroup.members = currentGroup.members.filter(member => member !== memberName);
    groups[currentGroup.id] = currentGroup;
    saveGroups();
    
    displayMembers();
}

function leaveGroup() {
    if (!confirm('Are you sure you want to leave this group?')) return;
    
    // Notify server about leaving
    if (p2pChat.socket && currentGroup) {
        p2pChat.socket.emit('leave-group', {
            groupId: currentGroup.id,
            userName: currentUser
        });
    }
    
    // Remove from local storage
    if (currentGroup.admin === currentUser) {
        delete groups[currentGroup.id];
    } else {
        currentGroup.members = currentGroup.members.filter(member => member !== currentUser);
        groups[currentGroup.id] = currentGroup;
    }
    
    saveGroups();
    backToGroups();
    displayGroups();
}

// Emoji and UI functions
function toggleEmojiPicker() {
    const picker = document.getElementById('emojiPicker');
    picker.classList.toggle('hidden');
}

function addEmoji(emoji) {
    const input = document.getElementById('messageText');
    input.value += emoji;
    input.focus();
    document.getElementById('emojiPicker').classList.add('hidden');
}

function handleTyping() {
    // Simple typing indicator (can be enhanced with socket events)
    const input = document.getElementById('messageText');
    if (input.value.trim()) {
        // Show typing to others (implement with socket if needed)
    }
}

function scrollToBottom() {
    const messages = document.getElementById('messages');
    messages.scrollTop = messages.scrollHeight;
    document.getElementById('scrollBottom').classList.add('hidden');
}

// Auto-hide scroll button when at bottom
function checkScrollPosition() {
    const messages = document.getElementById('messages');
    const scrollBtn = document.getElementById('scrollBottom');
    
    if (messages.scrollTop < messages.scrollHeight - messages.clientHeight - 50) {
        scrollBtn.classList.remove('hidden');
    } else {
        scrollBtn.classList.add('hidden');
    }
}

function showSettings() {
    const action = confirm('Do you want to change your name?');
    if (action) {
        const newName = prompt('Enter new name:', currentUser);
        if (newName && newName.trim()) {
            currentUser = newName.trim();
            const userData = { name: currentUser, id: generateUserIP() };
            localStorage.setItem('p2p_user', JSON.stringify(userData));
            document.getElementById('currentUser').textContent = currentUser;
        }
    }
}