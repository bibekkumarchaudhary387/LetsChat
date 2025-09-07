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

// In-memory storage for groups (no messages stored)
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
            const code = groupCode.toUpperCase();
            for (let [id, g] of groups) {
                if (g.code === code) {
                    group = g;
                    break;
                }
            }
        }
        
        if (group) {
            // Add user to group if not already there
            if (!group.members.includes(userName)) {
                group.members.push(userName);
                groups.set(group.id, group); // Update the group in storage
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
            code: groupCode.toUpperCase(),
            name: groupName,
            admin: userName,
            members: [userName],
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

    // Send message (don't store on server)
    socket.on('send-message', (data) => {
        const { groupId, message } = data;
        const group = groups.get(groupId);
        
        if (group) {
            // Just broadcast to all users in group (don't store)
            io.to(groupId).emit('new-message', {
                message: message
            });
        }
    });



    // Leave group
    socket.on('leave-group', (data) => {
        const { groupId, userName } = data;
        const group = groups.get(groupId);
        
        if (group) {
            // Remove user from group
            group.members = group.members.filter(member => member !== userName);
            
            // If admin leaves or no members left, delete group
            if (group.admin === userName || group.members.length === 0) {
                groups.delete(groupId);
                // Notify others that group is deleted
                socket.to(groupId).emit('group-deleted', { groupId });
            } else {
                groups.set(groupId, group);
                // Notify others about member leaving
                socket.to(groupId).emit('user-left', {
                    userName: userName,
                    members: group.members
                });
            }
        }
        
        socket.leave(groupId);
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

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});