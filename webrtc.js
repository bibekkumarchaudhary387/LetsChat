// WebRTC P2P Communication
class P2PChat {
    constructor() {
        this.peers = new Map();
        this.dataChannels = new Map();
        this.signalingServer = 'wss://socketsbay.com/wss/v2/1/demo/';
        this.socket = null;
        this.currentGroupId = null;
        this.isConnected = false;
    }

    async connect(groupId) {
        this.currentGroupId = groupId;
        
        try {
            this.socket = new WebSocket(this.signalingServer);
            
            this.socket.onopen = () => {
                console.log('Connected to signaling server');
                this.isConnected = true;
                this.joinRoom(groupId);
            };

            this.socket.onmessage = (event) => {
                this.handleSignalingMessage(JSON.parse(event.data));
            };

            this.socket.onclose = () => {
                console.log('Disconnected from signaling server');
                this.isConnected = false;
            };

        } catch (error) {
            console.log('Using local mode - no real-time sync');
            this.isConnected = false;
        }
    }

    joinRoom(groupId) {
        if (this.socket && this.socket.readyState === WebSocket.OPEN) {
            this.socket.send(JSON.stringify({
                type: 'join-room',
                room: groupId,
                user: currentUser
            }));
        }
    }

    async handleSignalingMessage(message) {
        switch (message.type) {
            case 'user-joined':
                if (message.user !== currentUser) {
                    await this.createPeerConnection(message.user);
                }
                break;
            case 'offer':
                await this.handleOffer(message);
                break;
            case 'answer':
                await this.handleAnswer(message);
                break;
            case 'ice-candidate':
                await this.handleIceCandidate(message);
                break;
            case 'message':
                this.receiveMessage(message);
                break;
        }
    }

    async createPeerConnection(userId) {
        const peerConnection = new RTCPeerConnection({
            iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
        });

        const dataChannel = peerConnection.createDataChannel('messages');
        this.setupDataChannel(dataChannel, userId);

        peerConnection.ondatachannel = (event) => {
            this.setupDataChannel(event.channel, userId);
        };

        peerConnection.onicecandidate = (event) => {
            if (event.candidate) {
                this.sendSignalingMessage({
                    type: 'ice-candidate',
                    candidate: event.candidate,
                    target: userId
                });
            }
        };

        this.peers.set(userId, peerConnection);

        const offer = await peerConnection.createOffer();
        await peerConnection.setLocalDescription(offer);

        this.sendSignalingMessage({
            type: 'offer',
            offer: offer,
            target: userId
        });
    }

    async handleOffer(message) {
        const peerConnection = new RTCPeerConnection({
            iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
        });

        peerConnection.ondatachannel = (event) => {
            this.setupDataChannel(event.channel, message.from);
        };

        peerConnection.onicecandidate = (event) => {
            if (event.candidate) {
                this.sendSignalingMessage({
                    type: 'ice-candidate',
                    candidate: event.candidate,
                    target: message.from
                });
            }
        };

        this.peers.set(message.from, peerConnection);

        await peerConnection.setRemoteDescription(message.offer);
        const answer = await peerConnection.createAnswer();
        await peerConnection.setLocalDescription(answer);

        this.sendSignalingMessage({
            type: 'answer',
            answer: answer,
            target: message.from
        });
    }

    async handleAnswer(message) {
        const peerConnection = this.peers.get(message.from);
        if (peerConnection) {
            await peerConnection.setRemoteDescription(message.answer);
        }
    }

    async handleIceCandidate(message) {
        const peerConnection = this.peers.get(message.from);
        if (peerConnection) {
            await peerConnection.addIceCandidate(message.candidate);
        }
    }

    setupDataChannel(dataChannel, userId) {
        dataChannel.onopen = () => {
            console.log(`Data channel opened with ${userId}`);
        };

        dataChannel.onmessage = (event) => {
            const message = JSON.parse(event.data);
            this.receiveMessage(message);
        };

        this.dataChannels.set(userId, dataChannel);
    }

    sendSignalingMessage(message) {
        if (this.socket && this.socket.readyState === WebSocket.OPEN) {
            this.socket.send(JSON.stringify({
                ...message,
                from: currentUser,
                room: this.currentGroupId
            }));
        }
    }

    broadcastMessage(message) {
        // Send via WebRTC data channels
        this.dataChannels.forEach((channel) => {
            if (channel.readyState === 'open') {
                channel.send(JSON.stringify(message));
            }
        });

        // Fallback: send via signaling server
        if (this.socket && this.socket.readyState === WebSocket.OPEN) {
            this.socket.send(JSON.stringify({
                type: 'message',
                message: message,
                room: this.currentGroupId,
                from: currentUser
            }));
        }
    }

    receiveMessage(data) {
        const message = data.message || data;
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
        this.dataChannels.forEach(channel => channel.close());
        this.peers.forEach(peer => peer.close());
        if (this.socket) {
            this.socket.close();
        }
        this.dataChannels.clear();
        this.peers.clear();
        this.isConnected = false;
    }
}

// Global P2P instance
let p2pChat = new P2PChat();