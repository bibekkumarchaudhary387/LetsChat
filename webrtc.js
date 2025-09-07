// Socket.IO Real-time Communication
class P2PChat {
    constructor() {
        this.socket = null;
        this.currentGroupId = null;
        this.isConnected = false;
    }

    connect(groupId) {
        this.currentGroupId = groupId;
        
        if (!this.socket) {
            this.socket = io();
            this.setupSocketEvents();
        }
        
        this.socket.emit('join-group', {
            groupId: groupId,
            userName: currentUser
        });
    }

    setupSocketEvents() {
        this.socket.on('connect', () => {
            console.log('Connected to server');
            this.isConnected = true;
        });
        
        this.socket.on('disconnect', () => {
            console.log('Disconnected from server');
            this.isConnected = false;
        });
        
        this.socket.on('new-message', (data) => {
            this.receiveMessage(data.message);
        });
        
        this.socket.on('group-joined', (data) => {
            if (data.success) {
                console.log('Joined group successfully');
                // Update local group data
                if (data.group) {
                    groups[data.group.id] = data.group;
                    saveGroups();
                    displayGroups();
                    if (currentGroup && currentGroup.id === data.group.id) {
                        currentGroup = data.group;
                        displayMessages();
                    }
                }
            } else {
                alert(data.message || 'Failed to join group');
            }
        });
        
        this.socket.on('group-created', (data) => {
            if (data.success) {
                console.log('Group created successfully');
            }
        });
        
        this.socket.on('user-joined', (data) => {
            console.log(`${data.userName} joined the group`);
            if (currentGroup) {
                currentGroup.members = data.members;
                groups[currentGroup.id] = currentGroup;
                saveGroups();
            }
        });
    }

    createGroup(groupId, groupCode, groupName) {
        if (!this.socket) {
            this.socket = io();
            this.setupSocketEvents();
        }
        
        this.socket.emit('create-group', {
            groupId: groupId,
            groupCode: groupCode,
            groupName: groupName,
            userName: currentUser
        });
    }

    joinByCode(groupCode) {
        if (!this.socket) {
            this.socket = io();
            this.setupSocketEvents();
        }
        
        this.socket.emit('join-group', {
            groupCode: groupCode,
            userName: currentUser
        });
    }

    broadcastMessage(message) {
        if (this.socket && this.isConnected) {
            this.socket.emit('send-message', {
                groupId: this.currentGroupId,
                message: message
            });
        }
    }



    receiveMessage(message) {
        if (message.sender !== currentUser) {
            // Add to current group messages
            if (currentGroup && currentGroup.id === this.currentGroupId) {
                currentGroup.messages.push(message);
                groups[currentGroup.id] = currentGroup;
                saveGroups();
                displayMessages();
            }
        }
    }

    disconnect() {
        if (this.socket) {
            this.socket.disconnect();
        }
        this.isConnected = false;
    }
}

// Global P2P instance
let p2pChat = new P2PChat();