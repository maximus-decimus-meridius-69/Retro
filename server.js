import express from 'express';
import http from 'http';
import { Server as SocketIo } from 'socket.io';
import cors from 'cors';
import { v4 as uuidv4 } from 'uuid';

const app = express();
const server = http.createServer(app);
const io = new SocketIo(server, {
  cors: {
    origin: "http://localhost:5173", // Vite default port
    methods: ["GET", "POST"]
  },
  maxHttpBufferSize: 10 * 1024 * 1024, // 10MB limit for messages
  pingTimeout: 60000,
  pingInterval: 25000
});

// Middleware
app.use(cors());
app.use(express.json());

// In-memory storage for rooms and participants
let audioRooms = [];
let lockedRooms = {};
let roomParticipants = {};
let chatMessages = {};
let courseMeetings = {}; // courseId -> meetings
let meetingRecordings = {}; // meetingId -> recording info
let courseMaterials = {}; // courseId -> materials
let userSessions = {}; // email -> socket session info
let meetingProgress = {}; // userId_meetingId -> progress info

// Routes
app.get('/api/audio-rooms', (req, res) => {
  res.json(audioRooms);
});

app.post('/api/audio-rooms', (req, res) => {
  const { title, description, host_id, host_name, max_participants = 10, allow_chat = true, allow_media = false } = req.body;
  
  const newRoom = {
    id: Date.now().toString(),
    title,
    description,
    host_id,
    host_name,
    max_participants,
    is_active: true,
    allow_chat,
    allow_media,
    allow_screen_share: false,
    is_muted_by_default: false,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };
  
  audioRooms.push(newRoom);
  roomParticipants[newRoom.id] = [];
  chatMessages[newRoom.id] = [];
  
  res.json(newRoom);
});

app.get('/api/audio-rooms/:id', (req, res) => {
  const room = audioRooms.find(r => r.id === req.params.id);
  if (!room) {
    return res.status(404).json({ error: 'Room not found' });
  }
  res.json(room);
});

app.get('/api/audio-rooms/:id/participants', (req, res) => {
  const participants = roomParticipants[req.params.id] || [];
  res.json(participants);
});

app.get('/api/audio-rooms/:id/messages', (req, res) => {
  const messages = chatMessages[req.params.id] || [];
  res.json(messages);
});

app.put('/api/audio-rooms/:id/settings', (req, res) => {
  const roomId = req.params.id;
  const room = audioRooms.find(r => r.id === roomId);
  
  if (!room) {
    return res.status(404).json({ error: 'Room not found' });
  }
  
  const { allow_chat, allow_media, allow_screen_share, is_muted_by_default } = req.body;
  
  if (allow_chat !== undefined) room.allow_chat = allow_chat;
  if (allow_media !== undefined) room.allow_media = allow_media;
  if (allow_screen_share !== undefined) room.allow_screen_share = allow_screen_share;
  if (is_muted_by_default !== undefined) room.is_muted_by_default = is_muted_by_default;
  
  room.updated_at = new Date().toISOString();
  
  // Broadcast settings update to all participants in the room
  io.to(roomId).emit('room-settings-updated', {
    allow_chat: room.allow_chat,
    allow_media: room.allow_media,
    allow_screen_share: room.allow_screen_share,
    is_muted_by_default: room.is_muted_by_default
  });
  
  res.json(room);
});

app.delete('/api/audio-rooms/:id', (req, res) => {
  const roomId = req.params.id;
  const roomIndex = audioRooms.findIndex(r => r.id === roomId);
  
  if (roomIndex === -1) {
    return res.status(404).json({ error: 'Room not found' });
  }
  
  // Remove room and associated data
  audioRooms.splice(roomIndex, 1);
      delete roomParticipants[roomId];
      delete chatMessages[roomId];
      delete lockedRooms[roomId];
  
  // Notify all participants that room is closed
  io.to(roomId).emit('room-closed');
  
  res.json({ message: 'Room deleted successfully' });
});

// Course Meeting API Endpoints

// Create a scheduled course meeting
app.post('/api/courses/:courseId/meetings', (req, res) => {
  const { courseId } = req.params;
  const { title, description, scheduledTime, hostId, hostName, hostEmail, allowedEmails = [] } = req.body;
  
  const meeting = {
    id: uuidv4(),
    courseId,
    title,
    description,
    scheduledTime: new Date(scheduledTime),
    hostId,
    hostName,
    hostEmail,
    allowedEmails: [...allowedEmails, hostEmail], // Host is always allowed
    isActive: false,
    isRecording: false,
    recordingUrl: null,
    materials: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  
  if (!courseMeetings[courseId]) {
    courseMeetings[courseId] = [];
  }
  
  courseMeetings[courseId].push(meeting);
  roomParticipants[meeting.id] = [];
  chatMessages[meeting.id] = [];
  
  res.json(meeting);
});

// Get all meetings for a course
app.get('/api/courses/:courseId/meetings', (req, res) => {
  const { courseId } = req.params;
  const meetings = courseMeetings[courseId] || [];
  res.json(meetings);
});

// Get specific meeting details
app.get('/api/meetings/:meetingId', (req, res) => {
  const { meetingId } = req.params;
  let meeting = null;
  
  // Find meeting across all courses
  Object.values(courseMeetings).forEach(courseMeetings => {
    const found = courseMeetings.find(m => m.id === meetingId);
    if (found) meeting = found;
  });
  
  if (!meeting) {
    return res.status(404).json({ error: 'Meeting not found' });
  }
  
  res.json(meeting);
});

// Start a meeting (make it active)
app.post('/api/meetings/:meetingId/start', (req, res) => {
  const { meetingId } = req.params;
  const { hostId } = req.body;
  
  let meeting = null;
  let courseId = null;
  
  // Find and update meeting
  Object.entries(courseMeetings).forEach(([cId, meetings]) => {
    const found = meetings.find(m => m.id === meetingId);
    if (found) {
      meeting = found;
      courseId = cId;
    }
  });
  
  if (!meeting) {
    return res.status(404).json({ error: 'Meeting not found' });
  }
  
  if (meeting.hostId !== hostId) {
    return res.status(403).json({ error: 'Only the host can start the meeting' });
  }
  
  meeting.isActive = true;
  meeting.startedAt = new Date().toISOString();
  meeting.updatedAt = new Date().toISOString();
  
  // Notify all participants that meeting has started
  io.emit('meeting-started', { meetingId, courseId });
  
  res.json(meeting);
});

// End a meeting
app.post('/api/meetings/:meetingId/end', async (req, res) => {
  const { meetingId } = req.params;
  const { hostId } = req.body;

  try {
    // Meeting is in Firebase, so just validate the host and emit event
    // The client will update Firebase
    console.log(`Host ${hostId} ending meeting ${meetingId}`);

    // Notify all participants that meeting has ended
    io.to(meetingId).emit('room-closed');

    // Clear participants from server memory
    if (roomParticipants[meetingId]) {
      roomParticipants[meetingId] = [];
    }

    res.json({ success: true, message: 'Meeting ended' });
  } catch (err) {
    console.error('Error ending meeting:', err);
    res.status(500).json({ error: 'Failed to end meeting' });
  }
});

// Note: Material uploads now handled by Firebase Storage in the frontend
// These endpoints kept for backward compatibility but materials are stored in Firestore

// Track user progress on a meeting recording
app.post('/api/meetings/:meetingId/progress', (req, res) => {
  const { meetingId } = req.params;
  const { userId, watchedDuration, totalDuration, completed } = req.body;
  
  const progressKey = `${userId}_${meetingId}`;
  
  meetingProgress[progressKey] = {
    userId,
    meetingId,
    watchedDuration,
    totalDuration,
    completed: completed || false,
    progressPercentage: Math.round((watchedDuration / totalDuration) * 100),
    lastWatched: new Date().toISOString()
  };
  
  res.json(meetingProgress[progressKey]);
});

// Get user progress for a course
app.get('/api/courses/:courseId/progress/:userId', (req, res) => {
  const { courseId, userId } = req.params;
  
  const meetings = courseMeetings[courseId] || [];
  const progress = meetings.map(meeting => {
    const progressKey = `${userId}_${meeting.id}`;
    const userProgress = meetingProgress[progressKey];
    
    return {
      meetingId: meeting.id,
      meetingTitle: meeting.title,
      scheduledTime: meeting.scheduledTime,
      hasRecording: !!meeting.recordingUrl,
      progress: userProgress || {
        userId,
        meetingId: meeting.id,
        watchedDuration: 0,
        totalDuration: 0,
        completed: false,
        progressPercentage: 0
      }
    };
  });
  
  res.json({
    courseId,
    userId,
    totalMeetings: meetings.length,
    completedMeetings: progress.filter(p => p.progress.completed).length,
    overallProgress: progress.length > 0 
      ? Math.round(progress.reduce((sum, p) => sum + p.progress.progressPercentage, 0) / progress.length)
      : 0,
    meetings: progress
  });
});

// Check if user can join meeting
app.post('/api/meetings/:meetingId/check-access', (req, res) => {
  const { meetingId } = req.params;
  const { userEmail, userId } = req.body;
  
  let meeting = null;
  
  // Find meeting
  Object.values(courseMeetings).forEach(meetings => {
    const found = meetings.find(m => m.id === meetingId);
    if (found) meeting = found;
  });
  
  if (!meeting) {
    return res.status(404).json({ error: 'Meeting not found' });
  }
  
  // Check if user email is allowed
  if (!meeting.allowedEmails.includes(userEmail)) {
    return res.status(403).json({ error: 'You are not enrolled in this course' });
  }
  
  // Check if user is already in a session
  if (userSessions[userEmail] && userSessions[userEmail].isActive) {
    return res.status(409).json({ error: 'You are already in a meeting session' });
  }
  
  res.json({ allowed: true, meeting });
});

// Debug route to check current state
app.get('/api/debug/state', (req, res) => {
  res.json({
    totalRooms: audioRooms.length,
    rooms: audioRooms.map(room => ({
      id: room.id,
      title: room.title,
      participantCount: roomParticipants[room.id] ? roomParticipants[room.id].length : 0,
      participants: roomParticipants[room.id] || []
    })),
    allParticipants: roomParticipants,
    courseMeetings,
    meetingRecordings,
    userSessions
  });
});

// Function to delete empty rooms
const deleteRoom = (roomId) => {
  console.log(`Deleting empty room: ${roomId}`);
  const roomIndex = audioRooms.findIndex(r => r.id === roomId);
  
  if (roomIndex !== -1) {
    audioRooms.splice(roomIndex, 1);
    delete roomParticipants[roomId];
    delete chatMessages[roomId];
    delete lockedRooms[roomId];
    
    // Notify all clients that room is closed
    io.to(roomId).emit('room-closed', { roomId });
    console.log(`Room ${roomId} deleted successfully`);
  }
};

// Socket.IO connection handling
io.on('connection', (socket) => {
  console.log('New client connected:', socket.id);

// Enhanced join room handler for course meetings
  socket.on('join-room', ({ roomId, userId, userName, userEmail, isHost = false }) => {
    if (lockedRooms[roomId]) {
      socket.emit('action-error', 'Room is locked by the host.');
      return;
    }
    
    console.log(`${userName} (${userEmail}) joining room ${roomId}`);
    
    // Check if user is already in a session (prevent multiple logins)
    if (userSessions[userEmail] && userSessions[userEmail].isActive && userSessions[userEmail].socketId !== socket.id) {
      socket.emit('action-error', 'You are already in a meeting session from another device.');
      return;
    }
    
    socket.join(roomId);
    socket.userId = userId;
    socket.userName = userName;
    socket.userEmail = userEmail;
    socket.roomId = roomId;
    socket.isHost = isHost;
    
    // Track user session
    userSessions[userEmail] = {
      socketId: socket.id,
      userId,
      userName,
      roomId,
      isActive: true,
      joinedAt: new Date().toISOString()
    };
    
    // Add participant to room
    if (!roomParticipants[roomId]) {
      roomParticipants[roomId] = [];
    }
    
    // Check for duplicate sessions (same email already in room)
    const duplicateSession = roomParticipants[roomId].find(p => p.userEmail === userEmail && p.userId !== userId);
    if (duplicateSession) {
      socket.emit('duplicate-session', { message: 'You are already in this meeting from another device' });
      return;
    }

    const existingParticipant = roomParticipants[roomId].find(p => p.userId === userId);
    if (!existingParticipant) {
      const participant = {
        userId,
        userName,
        userEmail,
        isHost,
        isMuted: false,
        hasVideo: false,
        isHandRaised: false,
        joinedAt: new Date().toISOString(),
        socketId: socket.id
      };

      roomParticipants[roomId].push(participant);
      console.log(`Added participant ${userId} to room ${roomId}. Total participants: ${roomParticipants[roomId].length}`);

      // Notify all participants in the room
      io.to(roomId).emit('participant-joined', participant);
      io.to(roomId).emit('participants-updated', roomParticipants[roomId]);
    } else {
      console.log(`Participant ${userId} already in room ${roomId}`);
    }

    // Send current participants list to the new user
    console.log(`Sending participants list to ${userId}. Count: ${roomParticipants[roomId].length}`);
    socket.emit('participants-updated', roomParticipants[roomId]);
    
    // Send chat history to the new user
    console.log('Sending chat history to user:', userId, 'Messages:', chatMessages[roomId] ? chatMessages[roomId].length : 0);
    socket.emit('chat-history', chatMessages[roomId] || []);
    
    // Send meeting materials if it's a course meeting
    let meeting = null;
    Object.values(courseMeetings).forEach(meetings => {
      const found = meetings.find(m => m.id === roomId);
      if (found) meeting = found;
    });
    
    if (meeting) {
      socket.emit('meeting-materials', meeting.materials || []);
    }
  });

  socket.on('leave-room', ({ roomId, userId }) => {
    console.log(`${userId} leaving room ${roomId}`);
    
    // Clear user session
    if (socket.userEmail && userSessions[socket.userEmail]) {
      userSessions[socket.userEmail].isActive = false;
    }
    
    if (roomParticipants[roomId]) {
      const beforeCount = roomParticipants[roomId].length;
      roomParticipants[roomId] = roomParticipants[roomId].filter(p => p.userId !== userId);
      const afterCount = roomParticipants[roomId].length;
      
      console.log(`Room ${roomId} participants: ${beforeCount} -> ${afterCount}`);
      
      // Notify remaining participants
      io.to(roomId).emit('participant-left', { userId });
      io.to(roomId).emit('participants-updated', roomParticipants[roomId]);
      
      // Check if room is now empty - delay deletion to allow for reconnections
      if (roomParticipants[roomId].length === 0) {
        console.log(`Room ${roomId} is now empty, scheduling deletion in 30 seconds...`);
        setTimeout(() => {
          // Check again if room is still empty before deleting
          if (roomParticipants[roomId] && roomParticipants[roomId].length === 0) {
            console.log(`Room ${roomId} still empty after delay, deleting now...`);
            deleteRoom(roomId);
          } else {
            console.log(`Room ${roomId} has participants again, canceling deletion`);
          }
        }, 30000); // 30 second delay
      }
    } else {
      console.log(`Room ${roomId} participants not found`);
    }

    socket.leave(roomId);
  });

  socket.on('send-message', ({ roomId, userId, userName, message, messageType = 'public', recipientId = null, mediaUrl = null, mediaData = null, fileName = null, fileSize = null, mimeType = null }) => {
    console.log('Received message:', { roomId, userId, userName, message, messageType, recipientId, hasMediaData: !!mediaData, fileName, fileSize, mimeType });

    if (mediaData) {
      console.log('Media data received - Length:', mediaData.length);
      console.log('Media data starts with data:URL:', mediaData.startsWith('data:'));
      console.log('Media data preview:', mediaData.substring(0, 100) + '...');
    }

    // Check if it's an audio room
    const room = audioRooms.find(r => r.id === roomId);

    // Check if there are participants (valid meeting/room)
    const hasParticipants = roomParticipants[roomId] && roomParticipants[roomId].length > 0;

    console.log('Audio room found:', room ? 'Yes' : 'No');
    console.log('Has participants:', hasParticipants ? 'Yes' : 'No');

    // If it's an audio room, check if chat is allowed
    if (room && !room.allow_chat) {
      console.log('Blocking message - chat disabled in audio room');
      socket.emit('message-error', 'Chat is not allowed in this room');
      return;
    }

    // If there are no participants and it's not an audio room, block it
    if (!room && !hasParticipants) {
      console.log('Blocking message - no participants in room');
      socket.emit('message-error', 'Room not found');
      return;
    }

    const chatMessage = {
      id: Date.now().toString(),
      roomId,
      userId,
      userName,
      message,
      messageType,
      recipientId,
      mediaUrl,
      mediaData,
      fileName,
      fileSize,
      mimeType,
      createdAt: new Date().toISOString()
    };

    if (!chatMessages[roomId]) {
      chatMessages[roomId] = [];
    }

    chatMessages[roomId].push(chatMessage);

    console.log('Broadcasting message to room:', roomId, 'Type:', messageType);
    console.log('Message content:', chatMessage);

    // Handle private vs public messages
    if (messageType === 'private' && recipientId) {
      // Send to sender
      socket.emit('new-message', chatMessage);

      // Send to recipient only
      const recipient = roomParticipants[roomId]?.find(p => p.userId === recipientId);
      if (recipient) {
        io.to(recipient.socketId).emit('new-message', chatMessage);
        console.log('Sent private message to:', recipientId);
      }
    } else {
      // Broadcast public message to all participants in the room
      io.to(roomId).emit('new-message', chatMessage);
    }
  });

  // Toggle chat lock (host only)
  socket.on('toggle-chat-lock', ({ roomId, locked }) => {
    console.log(`Chat lock ${locked ? 'enabled' : 'disabled'} for room ${roomId}`);

    // Broadcast to all participants
    io.to(roomId).emit('chat-locked', { locked });
  });

  socket.on('toggle-mute', ({ roomId, userId, isMuted }) => {
    if (roomParticipants[roomId]) {
      const participant = roomParticipants[roomId].find(p => p.userId === userId);
      if (participant) {
        participant.isMuted = isMuted;
        
        // Notify all participants about mute status change
        io.to(roomId).emit('participant-muted', { userId, isMuted });
        io.to(roomId).emit('participants-updated', roomParticipants[roomId]);
      }
    }
  });

  socket.on('host-mute-participant', ({ roomId, targetUserId, isMuted, hostId }) => {
    const room = audioRooms.find(r => r.id === roomId);
    
    if (!room || room.host_id !== hostId) {
      socket.emit('action-error', 'Only the host can mute participants');
      return;
    }
    
    if (roomParticipants[roomId]) {
      const participant = roomParticipants[roomId].find(p => p.userId === targetUserId);
      if (participant) {
        participant.isMuted = isMuted;
        
        // Notify the specific participant about being muted/unmuted by host
        const targetSocket = [...io.sockets.sockets.values()]
          .find(s => s.userId === targetUserId && s.roomId === roomId);
        
        if (targetSocket) {
          targetSocket.emit('host-action', { 
            action: isMuted ? 'muted' : 'unmuted',
            message: `You have been ${isMuted ? 'muted' : 'unmuted'} by the host`
          });
        }
        
        // Notify all participants about the change
        io.to(roomId).emit('participant-muted', { userId: targetUserId, isMuted });
        io.to(roomId).emit('participants-updated', roomParticipants[roomId]);
      }
    }
  });

  socket.on('host-set-media-permissions', ({ roomId, hostId, allow_media }) => {
    const room = audioRooms.find(r => r.id === roomId);

    if (!room || room.host_id !== hostId) {
      socket.emit('action-error', 'Only the host can change media permissions.');
      return;
    }

    room.allow_media = allow_media;
    room.updated_at = new Date().toISOString();

    io.to(roomId).emit('room-media-settings-updated', { allow_media });
  });

  // Reactions
  socket.on('send-reaction', ({ roomId, userId, reaction }) => {
    io.to(roomId).emit('reaction-sent', { userId, reaction });
  });

  // Raise/Lower Hand
  socket.on('raise-hand', ({ roomId, userId, raised }) => {
    console.log(`📋 Raise hand event received: userId=${userId}, roomId=${roomId}, raised=${raised}`);
    io.to(roomId).emit('hand-raised', { userId, raised });
    console.log(`📋 Broadcasted hand-raised event to room ${roomId}`);
  });

  // Update Permissions
  socket.on('update-permissions', ({ roomId, settings }) => {
    io.to(roomId).emit('permissions-updated', settings);
  });

  socket.on('host-lock-room', ({ roomId, hostId, lock }) => {
    const room = audioRooms.find(r => r.id === roomId);
    
    if (!room || room.host_id !== hostId) {
      socket.emit('action-error', 'Only the host can lock the room.');
      return;
    }

    lockedRooms[roomId] = lock;
    io.to(roomId).emit('room-lock-status', { lock });
  });

  socket.on('host-kick-participant', ({ roomId, targetUserId, hostId }) => {
    const room = audioRooms.find(r => r.id === roomId);
    
    if (!room || room.host_id !== hostId) {
      socket.emit('action-error', 'Only the host can kick participants');
      return;
    }
    
    // Find and remove participant
    if (roomParticipants[roomId]) {
      roomParticipants[roomId] = roomParticipants[roomId].filter(p => p.userId !== targetUserId);
      
      // Notify the kicked participant
      const targetSocket = [...io.sockets.sockets.values()]
        .find(s => s.userId === targetUserId && s.roomId === roomId);
      
      if (targetSocket) {
        targetSocket.emit('kicked-from-room', { 
          message: 'You have been removed from the room by the host'
        });
        targetSocket.leave(roomId);
      }
      
      // Notify remaining participants
      io.to(roomId).emit('participant-left', { userId: targetUserId });
      io.to(roomId).emit('participants-updated', roomParticipants[roomId]);
    }
  });

  socket.on('webrtc-offer', ({ roomId, targetUserId, offer }) => {
    const targetSocket = [...io.sockets.sockets.values()]
      .find(s => s.userId === targetUserId && s.roomId === roomId);
    
    if (targetSocket) {
      targetSocket.emit('webrtc-offer', {
        fromUserId: socket.userId,
        offer
      });
    }
  });

  socket.on('webrtc-answer', ({ roomId, targetUserId, answer }) => {
    const targetSocket = [...io.sockets.sockets.values()]
      .find(s => s.userId === targetUserId && s.roomId === roomId);
    
    if (targetSocket) {
      targetSocket.emit('webrtc-answer', {
        fromUserId: socket.userId,
        answer
      });
    }
  });

  socket.on('webrtc-ice-candidate', ({ roomId, targetUserId, candidate }) => {
    const targetSocket = [...io.sockets.sockets.values()]
      .find(s => s.userId === targetUserId && s.roomId === roomId);
    
    if (targetSocket) {
      targetSocket.emit('webrtc-ice-candidate', {
        fromUserId: socket.userId,
        candidate
      });
    }
  });

  // Course meeting specific handlers
  
  socket.on('start-recording', ({ roomId, hostId }) => {
    let meeting = null;
    Object.values(courseMeetings).forEach(meetings => {
      const found = meetings.find(m => m.id === roomId);
      if (found) meeting = found;
    });
    
    if (!meeting || meeting.hostId !== hostId) {
      socket.emit('action-error', 'Only the host can start recording');
      return;
    }
    
    meeting.isRecording = true;
    meeting.recordingStarted = new Date().toISOString();
    
    io.to(roomId).emit('recording-started');
  });
  
  socket.on('stop-recording', ({ roomId, hostId }) => {
    let meeting = null;
    Object.values(courseMeetings).forEach(meetings => {
      const found = meetings.find(m => m.id === roomId);
      if (found) meeting = found;
    });
    
    if (!meeting || meeting.hostId !== hostId) {
      socket.emit('action-error', 'Only the host can stop recording');
      return;
    }
    
    meeting.isRecording = false;
    meeting.recordingStopped = new Date().toISOString();
    
    io.to(roomId).emit('recording-stopped');
  });
  
  socket.on('raise-hand', ({ roomId, userId }) => {
    if (roomParticipants[roomId]) {
      const participant = roomParticipants[roomId].find(p => p.userId === userId);
      if (participant) {
        participant.isHandRaised = !participant.isHandRaised;
        
        io.to(roomId).emit('hand-raised', { userId, isHandRaised: participant.isHandRaised });
        io.to(roomId).emit('participants-updated', roomParticipants[roomId]);
      }
    }
  });
  
  socket.on('toggle-video', ({ roomId, userId, hasVideo }) => {
    if (roomParticipants[roomId]) {
      const participant = roomParticipants[roomId].find(p => p.userId === userId);
      if (participant) {
        participant.hasVideo = hasVideo;
        
        io.to(roomId).emit('video-toggled', { userId, hasVideo });
        io.to(roomId).emit('participants-updated', roomParticipants[roomId]);
      }
    }
  });
  
  socket.on('share-screen', ({ roomId, userId, isSharing }) => {
    if (roomParticipants[roomId]) {
      const participant = roomParticipants[roomId].find(p => p.userId === userId);
      if (participant) {
        participant.isScreenSharing = isSharing;
        
        io.to(roomId).emit('screen-share-toggled', { userId, isSharing });
        io.to(roomId).emit('participants-updated', roomParticipants[roomId]);
      }
    }
  });

  // Host ends meeting for everyone
  socket.on('end-room', ({ roomId }) => {
    console.log(`Host ending room ${roomId}`);

    // Notify all participants
    io.to(roomId).emit('room-closed');

    // Clear all participants
    if (roomParticipants[roomId]) {
      roomParticipants[roomId] = [];
    }

    // Clear room data
    deleteRoom(roomId);
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
    
    // Clear user session
    if (socket.userEmail && userSessions[socket.userEmail]) {
      console.log(`Clearing session for ${socket.userEmail}`);
      userSessions[socket.userEmail].isActive = false;
    }
    
    if (socket.roomId && socket.userId) {
      console.log(`Disconnected user ${socket.userId} was in room ${socket.roomId}`);
      // Remove participant from room
      if (roomParticipants[socket.roomId]) {
        const beforeCount = roomParticipants[socket.roomId].length;
        roomParticipants[socket.roomId] = roomParticipants[socket.roomId]
          .filter(p => p.userId !== socket.userId);
        const afterCount = roomParticipants[socket.roomId].length;
        
        console.log(`Room ${socket.roomId} participants after disconnect: ${beforeCount} -> ${afterCount}`);
        
        // Notify remaining participants
        io.to(socket.roomId).emit('participant-left', { userId: socket.userId });
        io.to(socket.roomId).emit('participants-updated', roomParticipants[socket.roomId]);
        
        // Check if room is now empty - delay deletion to allow for reconnections
        if (roomParticipants[socket.roomId].length === 0) {
          console.log(`Room ${socket.roomId} is now empty after disconnect, scheduling deletion in 30 seconds...`);
          setTimeout(() => {
            // Check again if room is still empty before deleting
            if (roomParticipants[socket.roomId] && roomParticipants[socket.roomId].length === 0) {
              console.log(`Room ${socket.roomId} still empty after disconnect delay, deleting now...`);
              deleteRoom(socket.roomId);
            } else {
              console.log(`Room ${socket.roomId} has participants again after disconnect, canceling deletion`);
            }
          }, 30000); // 30 second delay
        }
      }
    }
  });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Audio Rooms API available at http://localhost:${PORT}/api/audio-rooms`);
});
