// Global variables
let currentUser = '';
let currentGroup = null;
let groups = {};
let socket = null;
let isConnected = false;

// Initialize app
document.addEventListener('DOMContentLoaded', function() {
    loadUserData();
    if (currentUser) {
        hideNamePopup();
        loadGroups();
        initializeSocket();
    }
});

// User management
function loadUserData() {
    const userData = localStorage.getItem('chat_user');
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
    const userData = { name: currentUser, id: Date.now() };
    localStorage.setItem('chat_user', JSON.stringify(userData));
    document.getElementById('currentUser').textContent = currentUser;
    
    hideNamePopup();
    loadGroups();
    initializeSocket();
}

function hideNamePopup() {
    document.getElementById('namePopup').classList.add('hidden');
    document.getElementById('app').classList.remove('hidden');
}

// Socket connection
function initializeSocket() {
    if (socket) return;
    
    socket = io();
    
    socket.on('connect', () => {
        console.log('Connected to server');
        isConnected = true;
        updateConnectionStatus(true);
    });
    
    socket.on('disconnect', () => {
        console.log('Disconnected from server');
        isConnected = false;
        updateConnectionStatus(false);
    });
    
    socket.on('group-joined', (data) => {
        if (data.success) {
            if (data.group) {
                groups[data.group.id] = data.group;
                saveGroups();
                displayGroups();
            }
        } else {
            alert(data.message || 'Group does not exist');
        }
    });
    
    socket.on('group-created', (data) => {
        if (data.success) {
            console.log('Group created successfully');
        }
    });
    
    socket.on('new-message', (data) => {
        receiveMessage(data.message);
    });
    
    socket.on('user-joined', (data) => {
        if (currentGroup) {
            currentGroup.members = data.members;
            groups[currentGroup.id] = currentGroup;
            saveGroups();
            updateGroupMembers();
        }
    });
    
    socket.on('user-left', (data) => {
        if (currentGroup && data.members) {
            currentGroup.members = data.members;
            groups[currentGroup.id] = currentGroup;
            saveGroups();
            updateGroupMembers();
        }
    });
}

function updateConnectionStatus(connected) {
    const dot = document.getElementById('connectionDot');
    if (connected) {
        dot.classList.add('connected');
    } else {
        dot.classList.remove('connected');
    }
}

// Group management
function loadGroups() {
    const savedGroups = localStorage.getItem('chat_groups');
    if (savedGroups) {
        groups = JSON.parse(savedGroups);
        displayGroups();
    }
}

function saveGroups() {
    localStorage.setItem('chat_groups', JSON.stringify(groups));
}

function displayGroups() {
    const groupsContainer = document.getElementById('groups');
    groupsContainer.innerHTML = '';
    
    if (Object.keys(groups).length === 0) {
        groupsContainer.innerHTML = '<div style="text-align: center; padding: 2rem; color: #8696a0;">No groups yet. Create or join a group to start chatting!</div>';
        return;
    }
    
    Object.keys(groups).forEach(groupId => {
        const group = groups[groupId];
        const groupElement = document.createElement('div');
        groupElement.className = 'wa-chat-item';
        groupElement.onclick = () => openChat(groupId);
        
        const lastMessage = group.messages && group.messages.length > 0 ? 
            group.messages[group.messages.length - 1] : null;
        const lastMessageText = lastMessage ? 
            `${lastMessage.sender}: ${lastMessage.text.substring(0, 30)}...` : 
            'No messages yet';
        
        const isAdmin = group.admin === currentUser;
        
        groupElement.innerHTML = `
            <div class="wa-chat-avatar">${group.name.charAt(0).toUpperCase()}</div>
            <div class="wa-chat-info">
                <div class="wa-chat-name">
                    ${group.name}
                    ${isAdmin ? '<span class="wa-admin-badge">Admin</span>' : ''}
                </div>
                <div class="wa-chat-last">${lastMessageText}</div>
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
    document.getElementById('newGroupName').value = '';
}

function confirmCreateGroup() {
    const groupName = document.getElementById('newGroupName').value.trim();
    if (!groupName) {
        alert('Please enter a group name');
        return;
    }
    
    const groupId = 'group_' + Date.now() + '_' + Math.random().toString(36).substring(2, 8);
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
    
    if (socket && isConnected) {
        socket.emit('create-group', {
            groupId: groupId,
            groupCode: groupCode,
            groupName: groupName,
            userName: currentUser
        });
    }
    
    hideCreateGroup();
    alert(`Group created! Code: ${groupCode}`);
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
    
    if (input.startsWith('http')) {
        try {
            const url = new URL(input);
            const groupId = url.searchParams.get('group');
            if (groupId && socket && isConnected) {
                socket.emit('join-group', {
                    groupId: groupId,
                    userName: currentUser
                });
            }
        } catch (e) {
            alert('Invalid group link');
        }
    } else {
        const code = input.toUpperCase();
        if (socket && isConnected) {
            socket.emit('join-group', {
                groupCode: code,
                userName: currentUser
            });
        }
    }
    
    hideJoinGroup();
}

// Chat functionality
function openChat(groupId) {
    currentGroup = groups[groupId];
    if (!currentGroup) return;
    
    document.getElementById('groupsList').classList.add('hidden');
    document.getElementById('chatInterface').classList.remove('hidden');
    
    document.getElementById('groupName').textContent = currentGroup.name;
    updateGroupMembers();
    displayMessages();
    
    if (socket && isConnected) {
        socket.emit('join-group', {
            groupId: groupId,
            userName: currentUser
        });
    }
}

function backToGroups() {
    document.getElementById('chatInterface').classList.add('hidden');
    document.getElementById('groupsList').classList.remove('hidden');
    currentGroup = null;
    hideGroupMenu();
}

function updateGroupMembers() {
    if (currentGroup) {
        const membersText = `${currentGroup.members.length} members`;
        document.getElementById('groupMembers').textContent = membersText;
    }
}

function displayMessages() {
    const messagesContainer = document.getElementById('messages');
    messagesContainer.innerHTML = '';
    
    if (currentGroup.messages) {
        currentGroup.messages.forEach(message => {
            const messageElement = createMessageElement(message);
            messagesContainer.appendChild(messageElement);
        });
    }
    
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

function createMessageElement(message) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `wa-message ${message.sender === currentUser ? 'own' : ''}`;
    
    const time = new Date(message.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
    
    messageDiv.innerHTML = `
        ${message.sender !== currentUser ? `<div class="wa-message-info">${message.sender}</div>` : ''}
        <div class="wa-message-bubble">
            <div class="wa-message-text">${message.text}</div>
            <div class="wa-message-time">${time}</div>
        </div>
    `;
    
    return messageDiv;
}

function sendMessage() {
    const messageText = document.getElementById('messageText').value.trim();
    if (!messageText) return;
    
    const message = {
        id: 'msg_' + Date.now() + '_' + Math.random().toString(36).substring(2, 8),
        text: messageText,
        sender: currentUser,
        timestamp: Date.now()
    };
    
    // Add to local storage
    if (!currentGroup.messages) currentGroup.messages = [];
    currentGroup.messages.push(message);
    groups[currentGroup.id] = currentGroup;
    saveGroups();
    
    document.getElementById('messageText').value = '';
    displayMessages();
    
    // Send to server
    if (socket && isConnected && currentGroup) {
        socket.emit('send-message', {
            groupId: currentGroup.id,
            message: message
        });
    }
}

function receiveMessage(message) {
    if (message.sender !== currentUser && currentGroup) {
        if (!currentGroup.messages) currentGroup.messages = [];
        currentGroup.messages.push(message);
        groups[currentGroup.id] = currentGroup;
        saveGroups();
        displayMessages();
    }
}

function handleEnter(event) {
    if (event.key === 'Enter') {
        sendMessage();
    }
}

// Group menu
function showGroupMenu() {
    document.getElementById('groupMenu').classList.remove('hidden');
}

function hideGroupMenu() {
    document.getElementById('groupMenu').classList.add('hidden');
}

function showGroupInfo() {
    hideGroupMenu();
    if (currentGroup) {
        document.getElementById('displayGroupCode').textContent = currentGroup.code;
        displayMembers();
        document.getElementById('groupInfo').classList.remove('hidden');
    }
}

function hideGroupInfo() {
    document.getElementById('groupInfo').classList.add('hidden');
}

function displayMembers() {
    const membersList = document.getElementById('membersList');
    membersList.innerHTML = '';
    
    if (currentGroup.members) {
        currentGroup.members.forEach(member => {
            const memberDiv = document.createElement('div');
            memberDiv.className = 'wa-member-item';
            memberDiv.innerHTML = `
                <span>${member} ${member === currentGroup.admin ? '(Admin)' : ''}</span>
            `;
            membersList.appendChild(memberDiv);
        });
    }
}

function copyGroupCode() {
    const code = currentGroup.code;
    navigator.clipboard.writeText(code).then(() => {
        alert('Group code copied!');
    }).catch(() => {
        const textArea = document.createElement('textarea');
        textArea.value = code;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
        alert('Group code copied!');
    });
}

function leaveGroup() {
    if (!confirm('Are you sure you want to leave this group?')) return;
    
    hideGroupMenu();
    
    // Notify server
    if (socket && isConnected && currentGroup) {
        socket.emit('leave-group', {
            groupId: currentGroup.id,
            userName: currentUser
        });
    }
    
    // Remove from local storage
    delete groups[currentGroup.id];
    saveGroups();
    
    backToGroups();
    displayGroups();
}

// Emoji functionality
function toggleEmoji() {
    const picker = document.getElementById('emojiPicker');
    picker.classList.toggle('hidden');
}

function addEmoji(emoji) {
    const input = document.getElementById('messageText');
    input.value += emoji;
    input.focus();
    document.getElementById('emojiPicker').classList.add('hidden');
}

// Close menus when clicking outside
document.addEventListener('click', function(event) {
    const groupMenu = document.getElementById('groupMenu');
    const menuBtn = document.querySelector('.wa-menu-btn');
    
    if (groupMenu && !groupMenu.contains(event.target) && event.target !== menuBtn) {
        hideGroupMenu();
    }
    
    const emojiPicker = document.getElementById('emojiPicker');
    const emojiBtn = document.querySelector('.wa-emoji-btn');
    
    if (emojiPicker && !emojiPicker.contains(event.target) && event.target !== emojiBtn) {
        emojiPicker.classList.add('hidden');
    }
});

// Disconnect only when leaving website
window.addEventListener('beforeunload', function() {
    if (socket) {
        socket.disconnect();
    }
});