// Socket.IO Real-time Communication
class P2PChat {
    constructor() {
        this.socket = null;
        this.currentGroupId = null;
        this.isConnected = false;
    }

    connect(groupId) {
        this.currentGroupId = groupId;
        
        if (!this.socket || !this.socket.connected) {
            this.socket = io({
                reconnection: true,
                reconnectionDelay: 1000,
                reconnectionAttempts: 10,
                timeout: 20000,
                forceNew: true
            });
            this.setupSocketEvents();
        }
        
        // Wait for connection before joining
        if (this.socket.connected) {
            this.socket.emit('join-group', {
                groupId: groupId,
                userName: currentUser
            });
        } else {
            this.socket.on('connect', () => {
                this.socket.emit('join-group', {
                    groupId: groupId,
                    userName: currentUser
                });
            });
        }
    }

    setupSocketEvents() {
        this.socket.on('connect', () => {
            console.log('Connected to server');
            this.isConnected = true;
            updateConnectionStatus(true);
        });
        
        this.socket.on('disconnect', (reason) => {
            console.log('Disconnected from server:', reason);
            this.isConnected = false;
            updateConnectionStatus(false);
            
            // Auto-reconnect after 2 seconds
            setTimeout(() => {
                if (!this.socket.connected) {
                    console.log('Attempting to reconnect...');
                    this.socket.connect();
                }
            }, 2000);
        });
        
        this.socket.on('connect_error', (error) => {
            console.log('Connection error:', error);
            this.isConnected = false;
            updateConnectionStatus(false);
        });
        
        this.socket.on('reconnect', () => {
            console.log('Reconnected to server');
            this.isConnected = true;
            updateConnectionStatus(true);
            
            // Rejoin current group if in chat
            if (this.currentGroupId && currentGroup) {
                this.socket.emit('join-group', {
                    groupId: this.currentGroupId,
                    userName: currentUser
                });
            }
        });
        
        this.socket.on('new-message', (data) => {
            this.receiveMessage(data.message);
        });
        
        this.socket.on('group-joined', (data) => {
            if (data.success) {
                console.log('Joined group successfully');
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
                alert(data.message || 'Group does not exist');
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
        if (!this.socket || !this.socket.connected) {
            this.socket = io({
                reconnection: true,
                reconnectionDelay: 1000,
                reconnectionAttempts: 10,
                timeout: 20000,
                forceNew: true
            });
            this.setupSocketEvents();
        }
        
        const createGroupData = {
            groupId: groupId,
            groupCode: groupCode,
            groupName: groupName,
            userName: currentUser
        };
        
        if (this.socket.connected) {
            this.socket.emit('create-group', createGroupData);
        } else {
            this.socket.on('connect', () => {
                this.socket.emit('create-group', createGroupData);
            });
        }
    }

    joinByCode(groupCode) {
        if (!this.socket || !this.socket.connected) {
            this.socket = io({
                reconnection: true,
                reconnectionDelay: 1000,
                reconnectionAttempts: 10,
                timeout: 20000,
                forceNew: true
            });
            this.setupSocketEvents();
        }
        
        const joinData = {
            groupCode: groupCode.toUpperCase(),
            userName: currentUser
        };
        
        if (this.socket.connected) {
            this.socket.emit('join-group', joinData);
        } else {
            this.socket.on('connect', () => {
                this.socket.emit('join-group', joinData);
            });
        }
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