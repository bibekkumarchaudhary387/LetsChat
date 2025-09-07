const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

// Serve static files
app.use(express.static(__dirname));

// In-memory storage for groups
const groups = new Map();
const userSockets = new Map();

io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    // Join group
    socket.on('join-group', (data) => {
        const { groupId, groupCode, userName } = data;
        
        let group = null;
        
        // Find group by ID or code
        if (groupId) {
            group = groups.get(groupId);
        } else if (groupCode) {
            for (let [id, g] of groups) {
                if (g.code === groupCode.toUpperCase()) {
                    group = g;
                    break;
                }
            }
        }
        
        if (group) {
            // Add user to group if not already there
            if (!group.members.includes(userName)) {
                group.members.push(userName);
            }
            
            socket.join(group.id);
            userSockets.set(socket.id, { userName, groupId: group.id });
            
            // Send group data to user
            socket.emit('group-joined', {
                success: true,
                group: group
            });
            
            // Notify others in group
            socket.to(group.id).emit('user-joined', {
                userName: userName,
                members: group.members
            });
            
        } else {
            socket.emit('group-joined', {
                success: false,
                message: 'Group does not exist'
            });
        }
    });

    // Create group
    socket.on('create-group', (data) => {
        const { groupId, groupCode, groupName, userName } = data;
        
        const group = {
            id: groupId,
            code: groupCode,
            name: groupName,
            admin: userName,
            members: [userName],
            messages: [],
            created: Date.now()
        };
        
        groups.set(groupId, group);
        socket.join(groupId);
        userSockets.set(socket.id, { userName, groupId });
        
        socket.emit('group-created', {
            success: true,
            group: group
        });
    });

    // Send message
    socket.on('send-message', (data) => {
        const { groupId, message } = data;
        const group = groups.get(groupId);
        
        if (group) {
            group.messages.push(message);
            
            // Broadcast to all users in group
            io.to(groupId).emit('new-message', {
                message: message
            });
        }
    });

    // Get group messages
    socket.on('get-messages', (data) => {
        const { groupId } = data;
        const group = groups.get(groupId);
        
        if (group) {
            socket.emit('messages-loaded', {
                messages: group.messages
            });
        }
    });

    // Disconnect
    socket.on('disconnect', () => {
        const userData = userSockets.get(socket.id);
        if (userData) {
            const { userName, groupId } = userData;
            socket.to(groupId).emit('user-left', {
                userName: userName
            });
            userSockets.delete(socket.id);
        }
        console.log('User disconnected:', socket.id);
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
});