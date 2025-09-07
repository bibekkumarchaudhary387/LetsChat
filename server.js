const express = require('express');
const http = require('http');
const socketIo = require('socket.io');

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

// In-memory storage
const groups = new Map();
const userSockets = new Map();

io.on('connection', (socket) => {
    console.log('User connected');

    socket.on('join-group', (data) => {
        try {
            const { groupId, groupCode, userName } = data;
            let group = null;
            
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
                if (!group.members.includes(userName)) {
                    group.members.push(userName);
                    groups.set(group.id, group);
                }
                
                socket.join(group.id);
                userSockets.set(socket.id, { userName, groupId: group.id });
                
                socket.emit('group-joined', { success: true, group });
                socket.to(group.id).emit('user-joined', { userName, members: group.members });
            } else {
                socket.emit('group-joined', { success: false, message: 'Group does not exist' });
            }
        } catch (error) {
            console.error('Join group error:', error);
            socket.emit('group-joined', { success: false, message: 'Server error' });
        }
    });

    socket.on('create-group', (data) => {
        try {
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
            
            socket.emit('group-created', { success: true, group });
        } catch (error) {
            console.error('Create group error:', error);
            socket.emit('group-created', { success: false, message: 'Server error' });
        }
    });

    socket.on('send-message', (data) => {
        try {
            const { groupId, message } = data;
            if (groups.has(groupId)) {
                io.to(groupId).emit('new-message', { message });
            }
        } catch (error) {
            console.error('Send message error:', error);
        }
    });

    socket.on('leave-group', (data) => {
        try {
            const { groupId, userName } = data;
            const group = groups.get(groupId);
            
            if (group) {
                group.members = group.members.filter(member => member !== userName);
                
                if (group.admin === userName || group.members.length === 0) {
                    groups.delete(groupId);
                    socket.to(groupId).emit('group-deleted', { groupId });
                } else {
                    groups.set(groupId, group);
                    socket.to(groupId).emit('user-left', { userName, members: group.members });
                }
            }
            
            socket.leave(groupId);
        } catch (error) {
            console.error('Leave group error:', error);
        }
    });
    
    socket.on('disconnect', () => {
        try {
            const userData = userSockets.get(socket.id);
            if (userData) {
                const { userName, groupId } = userData;
                socket.to(groupId).emit('user-left', { userName });
                userSockets.delete(socket.id);
            }
        } catch (error) {
            console.error('Disconnect error:', error);
        }
    });
});

const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
}).on('error', (err) => {
    console.error('Server error:', err);
});