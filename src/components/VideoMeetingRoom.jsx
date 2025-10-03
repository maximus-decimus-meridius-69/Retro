import React, { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import io from 'socket.io-client';
import {
  Mic,
  MicOff,
  Video,
  VideoOff,
  PhoneOff,
  Monitor,
  MonitorOff,
  MessageSquare,
  Users,
  Settings,
  MoreVertical,
  UserX,
  Volume2,
  VolumeX,
  Lock,
  Unlock,
  Camera,
  Send,
  Paperclip,
  X,
  Hand,
  Smile,
  ThumbsUp,
  Heart,
  Laugh,
  ChevronUp
} from 'lucide-react';
import { auth, getMeetingById, getCourseById } from '../firebase';

const socket = io.connect('http://localhost:3001');

const VideoMeetingRoom = () => {
  const { meetingId } = useParams();
  const navigate = useNavigate();

  // Meeting & User State
  const [meeting, setMeeting] = useState(null);
  const [course, setCourse] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isHost, setIsHost] = useState(false);

  // Participants
  const [participants, setParticipants] = useState([]);
  const [socketConnected, setSocketConnected] = useState(false);

  // Media State
  const [isMuted, setIsMuted] = useState(true);
  const [isVideoOff, setIsVideoOff] = useState(true);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [localStream, setLocalStream] = useState(null);
  const [screenStream, setScreenStream] = useState(null);

  // UI State
  const [showChat, setShowChat] = useState(false);
  const [showParticipants, setShowParticipants] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [chatMessages, setChatMessages] = useState([]);
  const [messageInput, setMessageInput] = useState('');
  const [selectedRecipient, setSelectedRecipient] = useState('everyone'); // 'everyone' or userId
  const [chatLocked, setChatLocked] = useState(false);
  const [showReactions, setShowReactions] = useState(false);
  const [reactions, setReactions] = useState({}); // userId -> { type, timestamp }
  const [raisedHands, setRaisedHands] = useState([]); // array of userIds with raised hands
  const [participantSearch, setParticipantSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(0);
  const [availableDevices, setAvailableDevices] = useState({ audio: [], video: [] });
  const [selectedAudioDevice, setSelectedAudioDevice] = useState('');
  const [selectedVideoDevice, setSelectedVideoDevice] = useState('');
  const [blockedUsers, setBlockedUsers] = useState([]);
  const [showAudioMenu, setShowAudioMenu] = useState(false);
  const [showVideoMenu, setShowVideoMenu] = useState(false);
  const [permissionsSettings, setPermissionsSettings] = useState({
    allowReactions: true,
    allowUnmute: true,
    allowVideo: true
  });
  const [mirrorVideo, setMirrorVideo] = useState(true);

  // Peer Connections
  const [peerConnections, setPeerConnections] = useState({});
  const [remoteStreams, setRemoteStreams] = useState({});

  // Refs
  const localVideoRef = useRef(null);
  const localStreamRef = useRef(null);
  const screenStreamRef = useRef(null);
  const peerConnectionsRef = useRef({});
  const chatEndRef = useRef(null);

  // ICE servers and RTC configuration for high-quality audio
  const iceServers = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
    ],
    sdpSemantics: 'unified-plan'
  };

  // Load meeting data
  useEffect(() => {
    const loadMeetingData = async () => {
      try {
        setLoading(true);
        const meetingData = await getMeetingById(meetingId);

        if (!meetingData) {
          setError('Meeting not found');
          return;
        }

        setMeeting(meetingData);

        const courseData = await getCourseById(meetingData.courseId);
        if (!courseData) {
          setError('Course not found');
          return;
        }

        setCourse(courseData);

        const userId = auth.currentUser?.uid;
        const userEmail = auth.currentUser?.email;

        // Check if user is host
        const isUserHost = meetingData.hostId === userId;
        setIsHost(isUserHost);

        // Check if user can access meeting
        const isEnrolled = courseData.enrolledUsers?.includes(userId);
        const isCreator = courseData.creatorId === userId;

        if (!isEnrolled && !isCreator) {
          setError('You must be enrolled in this course to join this meeting');
          return;
        }

        setLoading(false);

      } catch (err) {
        console.error('Error loading meeting:', err);
        setError('Failed to load meeting data');
        setLoading(false);
      }
    };

    loadMeetingData();
  }, [meetingId]);

  // Socket connection status (separate effect, always active)
  useEffect(() => {
    const handleConnect = () => {
      console.log('Socket connected:', socket.id);
      setSocketConnected(true);
    };

    const handleDisconnect = () => {
      console.log('Socket disconnected');
      setSocketConnected(false);
    };

    // Check initial connection state
    if (socket.connected) {
      setSocketConnected(true);
    }

    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);

    return () => {
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
    };
  }, []);

  // Initialize media and socket connection
  useEffect(() => {
    if (!meeting || loading || error) return;

    const userId = auth.currentUser?.uid;
    const userName = auth.currentUser?.displayName || auth.currentUser?.email;
    const userEmail = auth.currentUser?.email;

    console.log('Initializing meeting room for user:', userId);

    // Get initial media stream with high-quality audio
    navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
        sampleRate: 48000,
        channelCount: 2
      },
      video: false
    })
      .then(stream => {
        localStreamRef.current = stream;
        setLocalStream(stream);

        // Mute audio by default
        stream.getAudioTracks().forEach(track => track.enabled = false);
        console.log('Media stream initialized, audio track:', stream.getAudioTracks()[0]);

        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
        }

        // Join room via socket
        console.log('Joining room:', meetingId, 'as user:', userId);
        socket.emit('join-room', {
          roomId: meetingId,
          userId,
          userName,
          userEmail,
          isHost
        });
        console.log('Join-room event emitted');

        // Listen for duplicate session errors
        socket.on('duplicate-session', ({ message }) => {
          setError(message);
          if (localStreamRef.current) {
            localStreamRef.current.getTracks().forEach(track => track.stop());
          }
        });

      })
      .catch(err => {
        console.error('Error accessing media devices:', err);
        setError('Unable to access camera/microphone. Please check permissions.');
      });

    // Socket event listeners
    socket.on('participants-updated', (participantsList) => {
      console.log('Participants updated:', participantsList);
      setParticipants(participantsList);
    });

    socket.on('participant-joined', async (participant) => {
      console.log('Participant joined:', participant);

      // Create peer connection for new participant
      if (participant.userId !== userId) {
        await createPeerConnection(participant.userId);
      }
    });

    socket.on('participant-left', ({ userId: leftUserId }) => {
      console.log('Participant left:', leftUserId);

      // Close peer connection
      if (peerConnectionsRef.current[leftUserId]) {
        peerConnectionsRef.current[leftUserId].close();
        delete peerConnectionsRef.current[leftUserId];
      }

      // Remove remote stream
      setRemoteStreams(prev => {
        const updated = { ...prev };
        delete updated[leftUserId];
        return updated;
      });
    });

    socket.on('webrtc-offer', async ({ fromUserId, offer }) => {
      console.log('Received offer from:', fromUserId);
      await handleOffer(fromUserId, offer);
    });

    socket.on('webrtc-answer', async ({ fromUserId, answer }) => {
      console.log('Received answer from:', fromUserId);
      await handleAnswer(fromUserId, answer);
    });

    socket.on('webrtc-ice-candidate', async ({ fromUserId, candidate }) => {
      console.log('Received ICE candidate from:', fromUserId);
      await handleIceCandidate(fromUserId, candidate);
    });

    socket.on('new-message', (msg) => {
      console.log('New message received:', msg);
      setChatMessages(prev => [...prev, msg]);
    });

    socket.on('chat-history', (messages) => {
      console.log('Chat history received:', messages);
      setChatMessages(messages);
    });

    socket.on('participant-muted', ({ userId: mutedUserId, isMuted }) => {
      setParticipants(prev =>
        prev.map(p => p.userId === mutedUserId ? { ...p, isMuted } : p)
      );
    });

    socket.on('host-action', ({ action, message }) => {
      alert(message);
      if (action === 'muted') {
        handleToggleMute(true);
      }
    });

    socket.on('kicked-from-room', ({ message }) => {
      alert(message);
      handleLeave();
    });

    socket.on('room-closed', () => {
      // Only show alert and leave for non-hosts (host already left via handleEndMeeting)
      if (!isHost) {
        alert('The meeting has been ended by the host');
        handleLeave();
      }
    });

    socket.on('chat-locked', ({ locked }) => {
      setChatLocked(locked);
      if (locked) {
        alert('Chat has been locked by the host. Only everyone messages are allowed.');
      } else {
        alert('Chat has been unlocked by the host.');
      }
    });

    socket.on('reaction-sent', ({ userId, reaction }) => {
      setReactions(prev => ({ ...prev, [userId]: { type: reaction, timestamp: Date.now() } }));
      setTimeout(() => {
        setReactions(prev => {
          const updated = { ...prev };
          delete updated[userId];
          return updated;
        });
      }, 3000);
    });

    socket.on('hand-raised', ({ userId, raised }) => {
      console.log('👋 Received hand-raised event:', { userId, raised });
      console.log('👋 raised type:', typeof raised, 'raised value:', raised);

      // Only update if raised is explicitly true or false, ignore undefined
      if (raised === true || raised === false) {
        setRaisedHands(prev => {
          if (raised) {
            const newState = prev.includes(userId) ? prev : [...prev, userId];
            console.log('👋 Updated raised hands (adding):', newState);
            return newState;
          } else {
            const newState = prev.filter(id => id !== userId);
            console.log('👋 Updated raised hands (removing):', newState);
            return newState;
          }
        });
      } else {
        console.log('👋 Ignoring event with invalid raised value:', raised);
      }
    });

    socket.on('permissions-updated', (settings) => {
      setPermissionsSettings(settings);
    });

    // Cleanup
    return () => {
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(track => track.stop());
      }
      if (screenStreamRef.current) {
        screenStreamRef.current.getTracks().forEach(track => track.stop());
      }

      Object.values(peerConnectionsRef.current).forEach(pc => pc.close());

      socket.emit('leave-room', { roomId: meetingId, userId });
      socket.off('participants-updated');
      socket.off('participant-joined');
      socket.off('participant-left');
      socket.off('webrtc-offer');
      socket.off('webrtc-answer');
      socket.off('webrtc-ice-candidate');
      socket.off('new-message');
      socket.off('chat-history');
    };
  }, [meeting, loading, error, isHost, meetingId]);

  // Auto-scroll chat
  useEffect(() => {
    console.log('Chat messages updated, count:', chatMessages.length, chatMessages);
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  // Get available devices
  useEffect(() => {
    const getDevices = async () => {
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const audioDevices = devices.filter(d => d.kind === 'audioinput');
        const videoDevices = devices.filter(d => d.kind === 'videoinput');
        setAvailableDevices({ audio: audioDevices, video: videoDevices });
        if (audioDevices.length > 0) setSelectedAudioDevice(audioDevices[0].deviceId);
        if (videoDevices.length > 0) setSelectedVideoDevice(videoDevices[0].deviceId);
      } catch (err) {
        console.error('Error getting devices:', err);
      }
    };
    getDevices();
  }, []);

  // WebRTC Functions
  const createPeerConnection = async (targetUserId) => {
    try {
      const pc = new RTCPeerConnection(iceServers);
      peerConnectionsRef.current[targetUserId] = pc;

      // Add local tracks to peer connection
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(track => {
          pc.addTrack(track, localStreamRef.current);
        });
      }

      // Handle ICE candidates
      pc.onicecandidate = (event) => {
        if (event.candidate) {
          socket.emit('webrtc-ice-candidate', {
            roomId: meetingId,
            targetUserId,
            candidate: event.candidate
          });
        }
      };

      // Handle remote stream
      pc.ontrack = (event) => {
        console.log('Received remote track from:', targetUserId);
        setRemoteStreams(prev => ({
          ...prev,
          [targetUserId]: event.streams[0]
        }));
      };

      // Create and send offer with audio codec preferences
      const offer = await pc.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: true
      });

      // Modify SDP to prefer Opus codec with higher bitrate
      const modifiedOffer = {
        ...offer,
        sdp: offer.sdp.replace(
          'useinbandfec=1',
          'useinbandfec=1; maxaveragebitrate=128000; stereo=1; maxplaybackrate=48000'
        )
      };

      await pc.setLocalDescription(modifiedOffer);

      socket.emit('webrtc-offer', {
        roomId: meetingId,
        targetUserId,
        offer: modifiedOffer
      });

      return pc;
    } catch (err) {
      console.error('Error creating peer connection:', err);
    }
  };

  const handleOffer = async (fromUserId, offer) => {
    try {
      let pc = peerConnectionsRef.current[fromUserId];

      if (!pc) {
        pc = new RTCPeerConnection(iceServers);
        peerConnectionsRef.current[fromUserId] = pc;

        // Add local tracks
        if (localStreamRef.current) {
          localStreamRef.current.getTracks().forEach(track => {
            pc.addTrack(track, localStreamRef.current);
          });
        }

        // Handle ICE candidates
        pc.onicecandidate = (event) => {
          if (event.candidate) {
            socket.emit('webrtc-ice-candidate', {
              roomId: meetingId,
              targetUserId: fromUserId,
              candidate: event.candidate
            });
          }
        };

        // Handle remote stream
        pc.ontrack = (event) => {
          console.log('Received remote track from:', fromUserId);
          setRemoteStreams(prev => ({
            ...prev,
            [fromUserId]: event.streams[0]
          }));
        };
      }

      await pc.setRemoteDescription(new RTCSessionDescription(offer));
      const answer = await pc.createAnswer();

      // Modify SDP for higher audio quality
      const modifiedAnswer = {
        ...answer,
        sdp: answer.sdp.replace(
          'useinbandfec=1',
          'useinbandfec=1; maxaveragebitrate=128000; stereo=1; maxplaybackrate=48000'
        )
      };

      await pc.setLocalDescription(modifiedAnswer);

      socket.emit('webrtc-answer', {
        roomId: meetingId,
        targetUserId: fromUserId,
        answer: modifiedAnswer
      });

    } catch (err) {
      console.error('Error handling offer:', err);
    }
  };

  const handleAnswer = async (fromUserId, answer) => {
    try {
      const pc = peerConnectionsRef.current[fromUserId];
      if (pc) {
        await pc.setRemoteDescription(new RTCSessionDescription(answer));
      }
    } catch (err) {
      console.error('Error handling answer:', err);
    }
  };

  const handleIceCandidate = async (fromUserId, candidate) => {
    try {
      const pc = peerConnectionsRef.current[fromUserId];
      if (pc) {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
      }
    } catch (err) {
      console.error('Error handling ICE candidate:', err);
    }
  };

  // Media Controls
  const handleToggleMute = (forceMute = null) => {
    console.log('Toggle mute called, current state:', isMuted);
    console.log('Socket connected:', socket.connected);
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      console.log('Audio track:', audioTrack);
      if (audioTrack) {
        const newMutedState = forceMute !== null ? forceMute : !isMuted;
        audioTrack.enabled = !newMutedState;
        setIsMuted(newMutedState);
        console.log('New muted state:', newMutedState, 'Track enabled:', audioTrack.enabled);

        if (socket.connected) {
          socket.emit('toggle-mute', {
            roomId: meetingId,
            userId: auth.currentUser?.uid,
            isMuted: newMutedState
          });
          console.log('Emitted toggle-mute event');
        } else {
          console.error('Socket not connected, cannot emit toggle-mute');
        }
      } else {
        console.error('No audio track available');
      }
    } else {
      console.error('No local stream available');
    }
  };

  const handleToggleVideo = async () => {
    if (localStreamRef.current) {
      const videoTrack = localStreamRef.current.getVideoTracks()[0];

      if (!videoTrack && isVideoOff) {
        // No video track exists, request camera permission
        try {
          const videoStream = await navigator.mediaDevices.getUserMedia({ video: true });
          const newVideoTrack = videoStream.getVideoTracks()[0];

          // Add video track to local stream
          localStreamRef.current.addTrack(newVideoTrack);

          // Update video element
          if (localVideoRef.current) {
            localVideoRef.current.srcObject = localStreamRef.current;
          }

          // Add video track to all peer connections
          Object.values(peerConnectionsRef.current).forEach(pc => {
            pc.addTrack(newVideoTrack, localStreamRef.current);
          });

          setIsVideoOff(false);

          socket.emit('toggle-video', {
            roomId: meetingId,
            userId: auth.currentUser?.uid,
            hasVideo: true
          });
        } catch (err) {
          console.error('Error accessing camera:', err);
          alert('Unable to access camera. Please check permissions.');
        }
      } else if (videoTrack) {
        // Video track exists, just toggle it
        const newVideoState = !isVideoOff;
        videoTrack.enabled = !newVideoState;
        setIsVideoOff(newVideoState);

        socket.emit('toggle-video', {
          roomId: meetingId,
          userId: auth.currentUser?.uid,
          hasVideo: !newVideoState
        });
      }
    }
  };

  const handleScreenShare = async () => {
    if (isScreenSharing) {
      // Stop screen sharing
      if (screenStreamRef.current) {
        screenStreamRef.current.getTracks().forEach(track => track.stop());
        screenStreamRef.current = null;
      }
      setIsScreenSharing(false);

      socket.emit('share-screen', {
        roomId: meetingId,
        userId: auth.currentUser?.uid,
        isSharing: false
      });
    } else {
      // Start screen sharing
      try {
        const stream = await navigator.mediaDevices.getDisplayMedia({ video: true });
        screenStreamRef.current = stream;
        setScreenStream(stream);
        setIsScreenSharing(true);

        // Replace video track in all peer connections
        Object.values(peerConnectionsRef.current).forEach(pc => {
          const sender = pc.getSenders().find(s => s.track?.kind === 'video');
          if (sender) {
            sender.replaceTrack(stream.getVideoTracks()[0]);
          }
        });

        // Handle when user stops sharing via browser UI
        stream.getVideoTracks()[0].onended = () => {
          handleScreenShare();
        };

        socket.emit('share-screen', {
          roomId: meetingId,
          userId: auth.currentUser?.uid,
          isSharing: true
        });
      } catch (err) {
        console.error('Error sharing screen:', err);
      }
    }
  };

  // Chat Functions
  const handleSendMessage = (e) => {
    e.preventDefault();
    console.log('Sending message:', messageInput);
    console.log('Socket connected:', socket.connected);

    if (chatLocked && !isHost && selectedRecipient !== 'everyone') {
      alert('Chat is locked. You can only send messages to everyone.');
      return;
    }

    if (messageInput.trim()) {
      const messageData = {
        roomId: meetingId,
        userId: auth.currentUser?.uid,
        userName: auth.currentUser?.displayName || auth.currentUser?.email,
        message: messageInput,
        messageType: selectedRecipient === 'everyone' ? 'public' : 'private',
        recipientId: selectedRecipient === 'everyone' ? null : selectedRecipient
      };
      console.log('Message data:', messageData);

      if (socket.connected) {
        socket.emit('send-message', messageData);
        console.log('Message emitted successfully');
        setMessageInput('');
      } else {
        console.error('Socket not connected, cannot send message');
        alert('Not connected to server. Please refresh and try again.');
      }
    } else {
      console.log('Message is empty, not sending');
    }
  };

  const handleToggleChatLock = () => {
    if (!isHost) return;
    const newLockState = !chatLocked;
    socket.emit('toggle-chat-lock', {
      roomId: meetingId,
      locked: newLockState
    });
    setChatLocked(newLockState);
  };

  // Host Controls
  const handleMuteParticipant = (targetUserId, currentMuteState) => {
    if (!isHost) return;

    socket.emit('host-mute-participant', {
      roomId: meetingId,
      targetUserId,
      isMuted: !currentMuteState,
      hostId: auth.currentUser?.uid
    });
  };

  const handleKickParticipant = (targetUserId) => {
    if (!isHost) return;

    if (window.confirm('Are you sure you want to remove this participant?')) {
      socket.emit('host-kick-participant', {
        roomId: meetingId,
        targetUserId,
        hostId: auth.currentUser?.uid
      });
    }
  };

  const handleEndMeeting = async () => {
    if (!isHost) return;

    if (window.confirm('Are you sure you want to end this meeting for everyone?')) {
      try {
        // Clean up local streams
        if (localStreamRef.current) {
          localStreamRef.current.getTracks().forEach(track => track.stop());
        }
        if (screenStreamRef.current) {
          screenStreamRef.current.getTracks().forEach(track => track.stop());
        }

        // Notify server to end meeting
        socket.emit('end-room', { roomId: meetingId });

        // Navigate to course detail with replace to prevent back navigation to meeting
        navigate(`/course/${meeting?.courseId}`, { replace: true });
      } catch (err) {
        console.error('Error ending meeting:', err);
        alert('Failed to end meeting');
      }
    }
  };

  const handleLeave = () => {
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop());
    }
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach(track => track.stop());
    }

    socket.emit('leave-room', {
      roomId: meetingId,
      userId: auth.currentUser?.uid
    });

    // Navigate to course detail with replace to prevent back to meeting
    navigate(`/course/${meeting?.courseId}`, { replace: true });
  };

  // Reactions & Hand Raise
  const handleSendReaction = (reactionType) => {
    if (!permissionsSettings.allowReactions && !isHost) {
      alert('Reactions are disabled by the host');
      return;
    }
    socket.emit('send-reaction', {
      roomId: meetingId,
      userId: auth.currentUser?.uid,
      reaction: reactionType
    });
    setShowReactions(false);
  };

  const handleRaiseHand = () => {
    const userId = auth.currentUser?.uid;
    const isRaised = raisedHands.includes(userId);
    const newState = !isRaised;

    console.log('Raise hand clicked! Current state:', isRaised, 'New state:', newState);
    console.log('User ID:', userId, 'Meeting ID:', meetingId);

    // Update local state immediately for instant feedback
    setRaisedHands(prev => {
      if (newState) {
        return prev.includes(userId) ? prev : [...prev, userId];
      } else {
        return prev.filter(id => id !== userId);
      }
    });

    console.log('Socket connected?', socket.connected);

    // Emit to server
    socket.emit('raise-hand', {
      roomId: meetingId,
      userId: userId,
      raised: newState
    });

    console.log('Raise hand event emitted to server');
  };

  // Device Selection
  const handleChangeAudioDevice = async (deviceId) => {
    try {
      const newStream = await navigator.mediaDevices.getUserMedia({
        audio: { deviceId: { exact: deviceId }, echoCancellation: true, noiseSuppression: true, autoGainControl: true },
        video: false
      });
      const newAudioTrack = newStream.getAudioTracks()[0];
      newAudioTrack.enabled = !isMuted;

      // Replace audio track in all peer connections
      Object.values(peerConnectionsRef.current).forEach(pc => {
        const sender = pc.getSenders().find(s => s.track?.kind === 'audio');
        if (sender) {
          sender.replaceTrack(newAudioTrack);
        }
      });

      // Stop old audio track
      if (localStreamRef.current) {
        localStreamRef.current.getAudioTracks().forEach(track => track.stop());
        localStreamRef.current.removeTrack(localStreamRef.current.getAudioTracks()[0]);
        localStreamRef.current.addTrack(newAudioTrack);
      }

      setSelectedAudioDevice(deviceId);
    } catch (err) {
      console.error('Error changing audio device:', err);
      alert('Failed to change audio device');
    }
  };

  const handleChangeVideoDevice = async (deviceId) => {
    try {
      const newStream = await navigator.mediaDevices.getUserMedia({
        video: { deviceId: { exact: deviceId } },
        audio: false
      });
      const newVideoTrack = newStream.getVideoTracks()[0];
      newVideoTrack.enabled = !isVideoOff;

      // Replace video track in all peer connections
      Object.values(peerConnectionsRef.current).forEach(pc => {
        const sender = pc.getSenders().find(s => s.track?.kind === 'video');
        if (sender) {
          sender.replaceTrack(newVideoTrack);
        }
      });

      // Stop old video track
      if (localStreamRef.current) {
        const oldVideoTrack = localStreamRef.current.getVideoTracks()[0];
        if (oldVideoTrack) {
          oldVideoTrack.stop();
          localStreamRef.current.removeTrack(oldVideoTrack);
        }
        localStreamRef.current.addTrack(newVideoTrack);
      }

      setSelectedVideoDevice(deviceId);
    } catch (err) {
      console.error('Error changing video device:', err);
      alert('Failed to change video device');
    }
  };

  // Block User
  const handleBlockUser = (userId) => {
    if (blockedUsers.includes(userId)) {
      setBlockedUsers(prev => prev.filter(id => id !== userId));
    } else {
      setBlockedUsers(prev => [...prev, userId]);
    }
  };

  // Permissions (Host Only)
  const handleUpdatePermissions = (newSettings) => {
    if (!isHost) return;
    setPermissionsSettings(newSettings);
    socket.emit('update-permissions', {
      roomId: meetingId,
      settings: newSettings
    });
  };

  // Render Functions
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center text-white">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500 mx-auto mb-4"></div>
          <p>Loading meeting...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="bg-white rounded-lg p-8 max-w-md mx-auto">
          <h2 className="text-2xl font-bold text-red-600 mb-4">Cannot Join Meeting</h2>
          <p className="text-gray-700 mb-6">{error}</p>
          <button
            onClick={() => navigate('/courses')}
            className="px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
          >
            Back to Courses
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen bg-gray-900 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="bg-gray-800 px-6 py-3 border-b border-gray-700 flex-shrink-0">
        <div className="flex items-center justify-between">
          <div className="text-white">
            <h1 className="text-lg font-semibold">{meeting?.title}</h1>
            <p className="text-sm text-gray-400">{course?.title}</p>
          </div>
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${socketConnected ? 'bg-green-500' : 'bg-red-500'}`} title={socketConnected ? 'Connected' : 'Disconnected'}></div>
            {isHost && (
              <span className="px-3 py-1 bg-purple-600 text-white text-sm rounded-full">
                Host
              </span>
            )}
            <span className="text-gray-400 text-sm">
              {participants.length} participant{participants.length !== 1 ? 's' : ''}
            </span>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden min-h-0">
        {/* Video Grid */}
        <div className="flex-1 flex items-center justify-center overflow-auto">
          {(() => {
            const nonBlockedParticipants = participants.filter(p =>
              p.userId !== auth.currentUser?.uid && !blockedUsers.includes(p.userId)
            );
            const participantsPerPage = 9;
            const totalPages = Math.ceil((nonBlockedParticipants.length + 1) / participantsPerPage);
            const startIdx = currentPage * participantsPerPage;
            const currentParticipants = nonBlockedParticipants.slice(startIdx, startIdx + participantsPerPage - 1);
            const showLocal = currentPage === 0;

            // Calculate total visible participants
            const totalVisible = (showLocal ? 1 : 0) + currentParticipants.length;

            // Determine grid layout based on number of participants
            let gridClass = 'grid gap-4 w-full p-4';
            if (totalVisible === 1) {
              gridClass += ' grid-cols-1 auto-rows-[400px]';
            } else if (totalVisible === 2) {
              gridClass += ' grid-cols-1 md:grid-cols-2 auto-rows-[350px]';
            } else if (totalVisible <= 4) {
              gridClass += ' grid-cols-2 auto-rows-[300px]';
            } else if (totalVisible <= 6) {
              gridClass += ' grid-cols-2 md:grid-cols-3 auto-rows-[280px]';
            } else {
              gridClass += ' grid-cols-1 md:grid-cols-2 lg:grid-cols-3 auto-rows-[250px]';
            }

            return (
              <>
                <div className={gridClass}>
                  {/* Local Video - only on first page */}
                  {showLocal && (
                    <div className="w-full h-full flex items-center justify-center p-2">
                      <div style={{ aspectRatio: '1/1', width: 'auto', height: '100%', maxWidth: '100%' }} className="relative bg-gradient-to-br from-gray-800 to-gray-900 rounded-xl overflow-hidden shadow-2xl border border-gray-700 group">
                        <video
                          ref={localVideoRef}
                          autoPlay
                          muted
                          playsInline
                          className={`w-full h-full object-cover ${mirrorVideo ? 'scale-x-[-1]' : ''}`}
                          style={{ display: isVideoOff ? 'none' : 'block' }}
                        />
                        {isVideoOff && (
                          <div className="absolute inset-0 flex items-center justify-center">
                            <div className="w-20 h-20 bg-purple-600 rounded-full flex items-center justify-center text-white text-2xl font-bold">
                              {auth.currentUser?.displayName?.[0] || auth.currentUser?.email?.[0] || 'Y'}
                            </div>
                          </div>
                        )}
                        {/* Mirror Toggle Icon */}
                        <button
                          onClick={() => setMirrorVideo(!mirrorVideo)}
                          className="absolute top-2 right-2 bg-black/50 hover:bg-black/70 p-2 rounded-full opacity-0 group-hover:opacity-100 transition-opacity z-10"
                          title={mirrorVideo ? 'Disable mirror' : 'Enable mirror'}
                        >
                          <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                          </svg>
                        </button>
                      <div className="absolute bottom-2 left-2 bg-black/50 px-3 py-1 rounded text-white text-sm">
                        You {isMuted && <MicOff className="inline w-4 h-4 ml-1" />}
                      </div>
                      {raisedHands.includes(auth.currentUser?.uid) && (
                        <div className="absolute top-2 left-2 bg-yellow-500 px-2 py-1 rounded text-white">
                          <Hand className="w-4 h-4" />
                        </div>
                      )}
                      {reactions[auth.currentUser?.uid] && (
                        <div className="absolute top-2 right-2 text-4xl animate-bounce">
                          {reactions[auth.currentUser?.uid].type}
                        </div>
                      )}
                      {isScreenSharing && (
                        <div className="absolute bottom-2 right-2 bg-green-600 px-2 py-1 rounded text-white text-xs">
                          Sharing Screen
                        </div>
                      )}
                      </div>
                    </div>
                  )}

                  {/* Remote Videos */}
                  {currentParticipants.map(participant => (
                    <RemoteVideo
                      key={participant.userId}
                      participant={participant}
                      stream={remoteStreams[participant.userId]}
                      isHost={isHost}
                      onMute={() => handleMuteParticipant(participant.userId, participant.isMuted)}
                      onKick={() => handleKickParticipant(participant.userId)}
                      onBlock={() => handleBlockUser(participant.userId)}
                      reaction={reactions[participant.userId]}
                      handRaised={raisedHands.includes(participant.userId)}
                    />
                  ))}
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-center gap-2 mt-4">
                    <button
                      onClick={() => setCurrentPage(Math.max(0, currentPage - 1))}
                      disabled={currentPage === 0}
                      className="px-4 py-2 bg-gray-700 text-white rounded disabled:opacity-50"
                    >
                      Previous
                    </button>
                    <span className="text-white">
                      Page {currentPage + 1} of {totalPages}
                    </span>
                    <button
                      onClick={() => setCurrentPage(Math.min(totalPages - 1, currentPage + 1))}
                      disabled={currentPage === totalPages - 1}
                      className="px-4 py-2 bg-gray-700 text-white rounded disabled:opacity-50"
                    >
                      Next
                    </button>
                  </div>
                )}
              </>
            );
          })()}
        </div>

        {/* Sidebar - Chat/Participants */}
        {(showChat || showParticipants) && (
          <div className="w-80 bg-gray-800 border-l border-gray-700 flex flex-col overflow-hidden">
            {/* Sidebar Tabs */}
            <div className="flex border-b border-gray-700">
              <button
                onClick={() => { setShowChat(true); setShowParticipants(false); }}
                className={`flex-1 px-4 py-3 text-sm font-medium ${
                  showChat ? 'text-white border-b-2 border-purple-500' : 'text-gray-400'
                }`}
              >
                Chat
              </button>
              <button
                onClick={() => { setShowParticipants(true); setShowChat(false); }}
                className={`flex-1 px-4 py-3 text-sm font-medium ${
                  showParticipants ? 'text-white border-b-2 border-purple-500' : 'text-gray-400'
                }`}
              >
                Participants ({participants.length})
              </button>
            </div>

            {/* Chat Panel */}
            {showChat && (
              <div className="flex-1 flex flex-col">
                {/* Chat Header with Controls */}
                <div className="p-3 border-b border-gray-700">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-white text-sm font-medium">Messages</span>
                    {isHost && (
                      <button
                        onClick={handleToggleChatLock}
                        className={`px-2 py-1 rounded text-xs ${
                          chatLocked ? 'bg-red-600 hover:bg-red-700' : 'bg-gray-600 hover:bg-gray-700'
                        } text-white`}
                        title={chatLocked ? 'Unlock chat' : 'Lock chat'}
                      >
                        {chatLocked ? <Lock className="w-3 h-3 inline" /> : <Unlock className="w-3 h-3 inline" />}
                        {chatLocked ? ' Locked' : ' Unlocked'}
                      </button>
                    )}
                  </div>

                  {/* Recipient Selector */}
                  {(!chatLocked || isHost) && (
                    <select
                      value={selectedRecipient}
                      onChange={(e) => setSelectedRecipient(e.target.value)}
                      className="w-full bg-gray-700 text-white px-2 py-1 rounded text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                    >
                      <option value="everyone">Everyone</option>
                      {participants
                        .filter(p => p.userId !== auth.currentUser?.uid)
                        .map(p => (
                          <option key={p.userId} value={p.userId}>
                            Private: {p.userName}
                          </option>
                        ))}
                    </select>
                  )}
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                  {chatMessages.length === 0 && (
                    <div className="text-gray-400 text-sm text-center mt-4">
                      No messages yet. Start the conversation!
                    </div>
                  )}
                  {chatMessages
                    .filter(msg => {
                      // Show public messages to everyone
                      if (msg.messageType === 'public') return true;
                      // Show private messages if user is sender or recipient
                      if (msg.messageType === 'private') {
                        return msg.userId === auth.currentUser?.uid || msg.recipientId === auth.currentUser?.uid;
                      }
                      return true;
                    })
                    .map((msg, idx) => (
                      <div key={idx} className={`text-sm ${msg.messageType === 'private' ? 'bg-gray-700/50 p-2 rounded' : ''}`}>
                        <div className="flex items-center gap-2">
                          <div className="font-medium text-purple-400">{msg.userName}</div>
                          {msg.messageType === 'private' && (
                            <span className="text-xs text-yellow-400">(Private)</span>
                          )}
                        </div>
                        <div className="text-gray-300">{msg.message}</div>
                        <div className="text-xs text-gray-500">
                          {new Date(msg.createdAt).toLocaleTimeString()}
                        </div>
                      </div>
                    ))}
                  <div ref={chatEndRef} />
                </div>
                <form onSubmit={handleSendMessage} className="p-4 border-t border-gray-700">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={messageInput}
                      onChange={(e) => setMessageInput(e.target.value)}
                      placeholder={selectedRecipient === 'everyone' ? 'Message everyone...' : `Private message to ${participants.find(p => p.userId === selectedRecipient)?.userName || 'participant'}...`}
                      className="flex-1 bg-gray-700 text-white px-3 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                    <button
                      type="submit"
                      className="bg-purple-600 hover:bg-purple-700 text-white p-2 rounded-lg"
                    >
                      <Send className="w-5 h-5" />
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* Participants Panel */}
            {showParticipants && (
              <div className="flex-1 flex flex-col">
                {/* Participant Search */}
                <div className="p-3 border-b border-gray-700">
                  <input
                    type="text"
                    value={participantSearch}
                    onChange={(e) => setParticipantSearch(e.target.value)}
                    placeholder="Search participants..."
                    className="w-full bg-gray-700 text-white px-3 py-2 rounded focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>
                <div className="flex-1 overflow-y-auto p-4">
                  <div className="space-y-2">
                  {participants
                    .filter(p => p.userName?.toLowerCase().includes(participantSearch.toLowerCase()))
                    .map(participant => (
                    <div
                      key={participant.userId}
                      className="flex items-center justify-between p-3 bg-gray-700 rounded-lg"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-purple-600 rounded-full flex items-center justify-center text-white text-sm font-bold">
                          {participant.userName?.[0] || 'U'}
                        </div>
                        <div>
                          <div className="text-white text-sm font-medium flex items-center gap-2">
                            {participant.userName}
                            {participant.isHost && (
                              <span className="text-xs text-purple-400">(Host)</span>
                            )}
                            {participant.userId === auth.currentUser?.uid && (
                              <span className="text-xs text-gray-400">(You)</span>
                            )}
                            {raisedHands.includes(participant.userId) && (
                              <Hand className="w-4 h-4 text-yellow-400" />
                            )}
                          </div>
                          <div className="flex items-center gap-2 text-xs text-gray-400">
                            {participant.isMuted && <MicOff className="w-3 h-3" />}
                            {!participant.hasVideo && <VideoOff className="w-3 h-3" />}
                          </div>
                        </div>
                      </div>
                      {participant.userId !== auth.currentUser?.uid && (
                        <div className="relative flex items-center gap-1">
                          <button
                            onClick={() => setSelectedRecipient(participant.userId)}
                            className="p-1 hover:bg-gray-600 rounded"
                            title="Send private message"
                          >
                            <MessageSquare className="w-4 h-4 text-blue-400" />
                          </button>
                          {isHost && (
                            <>
                              <button
                                onClick={() => handleMuteParticipant(participant.userId, participant.isMuted)}
                                className="p-1 hover:bg-gray-600 rounded"
                                title={participant.isMuted ? 'Unmute' : 'Mute'}
                              >
                                {participant.isMuted ? (
                                  <VolumeX className="w-4 h-4 text-gray-400" />
                                ) : (
                                  <Volume2 className="w-4 h-4 text-gray-400" />
                                )}
                              </button>
                              <button
                                onClick={() => handleKickParticipant(participant.userId)}
                                className="p-1 hover:bg-gray-600 rounded"
                                title="Remove participant"
                              >
                                <UserX className="w-4 h-4 text-red-400" />
                              </button>
                            </>
                          )}
                          <button
                            onClick={() => handleBlockUser(participant.userId)}
                            className="p-1 hover:bg-gray-600 rounded"
                            title={blockedUsers.includes(participant.userId) ? 'Unblock' : 'Block'}
                          >
                            <X className={`w-4 h-4 ${blockedUsers.includes(participant.userId) ? 'text-red-400' : 'text-gray-400'}`} />
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Bottom Controls */}
      <div className="bg-gray-800 px-6 py-4 border-t border-gray-700 relative flex-shrink-0">
        {/* Reactions Panel */}
        {showReactions && (
          <div className="absolute bottom-full mb-2 left-1/2 transform -translate-x-1/2 bg-gray-700 rounded-lg p-3 flex gap-2 shadow-lg">
            <button onClick={() => handleSendReaction('👍')} className="text-3xl hover:scale-110 transition-transform">👍</button>
            <button onClick={() => handleSendReaction('❤️')} className="text-3xl hover:scale-110 transition-transform">❤️</button>
            <button onClick={() => handleSendReaction('😂')} className="text-3xl hover:scale-110 transition-transform">😂</button>
            <button onClick={() => handleSendReaction('😮')} className="text-3xl hover:scale-110 transition-transform">😮</button>
            <button onClick={() => handleSendReaction('👏')} className="text-3xl hover:scale-110 transition-transform">👏</button>
          </div>
        )}

        {/* Settings Panel - Host Permissions Only */}
        {showSettings && isHost && (
          <div className="absolute bottom-full right-6 mb-2 bg-gray-700 rounded-lg p-4 w-72 shadow-lg">
            <h3 className="text-white font-medium mb-3">Participant Permissions</h3>
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm text-gray-300">
                <input
                  type="checkbox"
                  checked={permissionsSettings.allowReactions}
                  onChange={(e) => handleUpdatePermissions({ ...permissionsSettings, allowReactions: e.target.checked })}
                  className="rounded"
                />
                Allow reactions
              </label>
              <label className="flex items-center gap-2 text-sm text-gray-300">
                <input
                  type="checkbox"
                  checked={permissionsSettings.allowUnmute}
                  onChange={(e) => handleUpdatePermissions({ ...permissionsSettings, allowUnmute: e.target.checked })}
                  className="rounded"
                />
                Allow unmute
              </label>
              <label className="flex items-center gap-2 text-sm text-gray-300">
                <input
                  type="checkbox"
                  checked={permissionsSettings.allowVideo}
                  onChange={(e) => handleUpdatePermissions({ ...permissionsSettings, allowVideo: e.target.checked })}
                  className="rounded"
                />
                Allow video
              </label>
            </div>
          </div>
        )}

        <div className="flex items-center justify-center gap-3 max-w-4xl mx-auto">
          {/* Microphone with Device Menu */}
          <div className="relative group">
            <button
              onClick={() => handleToggleMute()}
              disabled={!permissionsSettings.allowUnmute && !isHost && isMuted}
              className={`p-4 rounded-full ${
                isMuted ? 'bg-red-600 hover:bg-red-700' : 'bg-gray-700 hover:bg-gray-600'
              } text-white transition-colors disabled:opacity-50`}
              title={isMuted ? 'Unmute' : 'Mute'}
            >
              {isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
            </button>
            <button
              onClick={() => setShowAudioMenu(!showAudioMenu)}
              className="absolute -top-2 -right-2 bg-gray-600 hover:bg-gray-500 rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
              title="Select microphone"
            >
              <ChevronUp className="w-3 h-3 text-white" />
            </button>
            {showAudioMenu && (
              <div className="absolute bottom-full mb-2 left-0 bg-gray-700 rounded-lg p-2 w-64 shadow-lg z-10">
                <h4 className="text-white text-sm font-medium mb-2 px-2">Select Microphone</h4>
                <div className="max-h-48 overflow-y-auto">
                  {availableDevices.audio.map(device => (
                    <button
                      key={device.deviceId}
                      onClick={() => {
                        handleChangeAudioDevice(device.deviceId);
                        setShowAudioMenu(false);
                      }}
                      className={`w-full text-left px-3 py-2 text-sm rounded hover:bg-gray-600 ${
                        selectedAudioDevice === device.deviceId ? 'bg-gray-600 text-white' : 'text-gray-300'
                      }`}
                    >
                      {device.label || `Microphone ${device.deviceId.substring(0, 5)}`}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Video with Device Menu */}
          <div className="relative group">
            <button
              onClick={handleToggleVideo}
              disabled={!permissionsSettings.allowVideo && !isHost && isVideoOff}
              className={`p-4 rounded-full ${
                isVideoOff ? 'bg-red-600 hover:bg-red-700' : 'bg-gray-700 hover:bg-gray-600'
              } text-white transition-colors disabled:opacity-50`}
              title={isVideoOff ? 'Turn on camera' : 'Turn off camera'}
            >
              {isVideoOff ? <VideoOff className="w-5 h-5" /> : <Video className="w-5 h-5" />}
            </button>
            <button
              onClick={() => setShowVideoMenu(!showVideoMenu)}
              className="absolute -top-2 -right-2 bg-gray-600 hover:bg-gray-500 rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
              title="Select camera"
            >
              <ChevronUp className="w-3 h-3 text-white" />
            </button>
            {showVideoMenu && (
              <div className="absolute bottom-full mb-2 left-0 bg-gray-700 rounded-lg p-2 w-64 shadow-lg z-10">
                <h4 className="text-white text-sm font-medium mb-2 px-2">Select Camera</h4>
                <div className="max-h-48 overflow-y-auto">
                  {availableDevices.video.map(device => (
                    <button
                      key={device.deviceId}
                      onClick={() => {
                        handleChangeVideoDevice(device.deviceId);
                        setShowVideoMenu(false);
                      }}
                      className={`w-full text-left px-3 py-2 text-sm rounded hover:bg-gray-600 ${
                        selectedVideoDevice === device.deviceId ? 'bg-gray-600 text-white' : 'text-gray-300'
                      }`}
                    >
                      {device.label || `Camera ${device.deviceId.substring(0, 5)}`}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <button
            onClick={handleScreenShare}
            className={`p-4 rounded-full ${
              isScreenSharing ? 'bg-green-600 hover:bg-green-700' : 'bg-gray-700 hover:bg-gray-600'
            } text-white transition-colors`}
            title={isScreenSharing ? 'Stop sharing' : 'Share screen'}
          >
            {isScreenSharing ? <MonitorOff className="w-5 h-5" /> : <Monitor className="w-5 h-5" />}
          </button>

          {/* Raise Hand */}
          <button
            onClick={handleRaiseHand}
            className={`p-4 rounded-full ${
              raisedHands.includes(auth.currentUser?.uid) ? 'bg-yellow-500 hover:bg-yellow-600' : 'bg-gray-700 hover:bg-gray-600'
            } text-white transition-colors`}
            title={raisedHands.includes(auth.currentUser?.uid) ? 'Lower hand' : 'Raise hand'}
          >
            <Hand className="w-5 h-5" />
          </button>

          {/* Reactions */}
          <button
            onClick={() => setShowReactions(!showReactions)}
            className="p-4 rounded-full bg-gray-700 hover:bg-gray-600 text-white transition-colors"
            title="Reactions"
          >
            <Smile className="w-5 h-5" />
          </button>

          <button
            onClick={() => {
              setShowChat(!showChat);
              setShowParticipants(false);
            }}
            className="p-4 rounded-full bg-gray-700 hover:bg-gray-600 text-white transition-colors"
            title="Chat"
          >
            <MessageSquare className="w-5 h-5" />
          </button>

          <button
            onClick={() => {
              setShowParticipants(!showParticipants);
              setShowChat(false);
            }}
            className="p-4 rounded-full bg-gray-700 hover:bg-gray-600 text-white transition-colors"
            title="Participants"
          >
            <Users className="w-5 h-5" />
          </button>

          {/* Settings */}
          <button
            onClick={() => setShowSettings(!showSettings)}
            className="p-4 rounded-full bg-gray-700 hover:bg-gray-600 text-white transition-colors"
            title="Settings"
          >
            <Settings className="w-5 h-5" />
          </button>

          {isHost && (
            <button
              onClick={handleEndMeeting}
              className="px-6 py-3 rounded-full bg-red-700 hover:bg-red-800 text-white font-medium transition-colors flex items-center gap-2"
            >
              <PhoneOff className="w-5 h-5" />
              End Meeting
            </button>
          )}

          <button
            onClick={handleLeave}
            className="px-6 py-3 rounded-full bg-red-600 hover:bg-red-700 text-white font-medium transition-colors flex items-center gap-2"
          >
            <PhoneOff className="w-5 h-5" />
            Leave
          </button>
        </div>
      </div>
    </div>
  );
};

// Remote Video Component
const RemoteVideo = ({ participant, stream, isHost, onMute, onKick, onBlock, reaction, handRaised }) => {
  const videoRef = useRef(null);
  const audioRef = useRef(null);
  const [showMenu, setShowMenu] = useState(false);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
    if (audioRef.current && stream) {
      audioRef.current.srcObject = stream;
    }
  }, [stream]);

  return (
    <div className="w-full h-full flex items-center justify-center p-2">
      <div style={{ aspectRatio: '1/1', width: 'auto', height: '100%', maxWidth: '100%' }} className="relative bg-gradient-to-br from-gray-800 to-gray-900 rounded-xl overflow-hidden shadow-2xl border border-gray-700 group">
        {/* Audio element (always present for audio playback) */}
        <audio ref={audioRef} autoPlay playsInline />

        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="w-full h-full object-cover"
          style={{ display: (stream && participant.hasVideo) ? 'block' : 'none' }}
        />
        {(!stream || !participant.hasVideo) && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-20 h-20 bg-purple-600 rounded-full flex items-center justify-center text-white text-2xl font-bold">
              {participant.userName?.[0] || 'U'}
            </div>
          </div>
        )}

      <div className="absolute bottom-2 left-2 bg-black/50 px-3 py-1 rounded text-white text-sm flex items-center gap-2">
        {participant.userName}
        {participant.isMuted && <MicOff className="w-4 h-4" />}
      </div>

      {/* Raised Hand */}
      {handRaised && (
        <div className="absolute top-2 left-2 bg-yellow-500 px-2 py-1 rounded text-white">
          <Hand className="w-4 h-4" />
        </div>
      )}

      {/* Reaction */}
      {reaction && (
        <div className="absolute top-2 right-2 text-4xl animate-bounce">
          {reaction.type}
        </div>
      )}

      {participant.isScreenSharing && (
        <div className="absolute bottom-2 right-2 bg-green-600 px-2 py-1 rounded text-white text-xs">
          Sharing Screen
        </div>
      )}

      {isHost && (
        <div className="absolute top-2 left-2 opacity-0 group-hover:opacity-100 transition-opacity">
          <div className="relative">
            <button
              onClick={() => setShowMenu(!showMenu)}
              className="p-2 bg-black/50 rounded-full text-white hover:bg-black/70"
            >
              <MoreVertical className="w-4 h-4" />
            </button>

            {showMenu && (
              <div className="absolute top-10 left-0 bg-gray-900 rounded-lg shadow-lg py-1 w-40 z-10">
                <button
                  onClick={() => { onMute(); setShowMenu(false); }}
                  className="w-full px-4 py-2 text-left text-white hover:bg-gray-800 flex items-center gap-2"
                >
                  {participant.isMuted ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
                  {participant.isMuted ? 'Unmute' : 'Mute'}
                </button>
                <button
                  onClick={() => { onKick(); setShowMenu(false); }}
                  className="w-full px-4 py-2 text-left text-red-400 hover:bg-gray-800 flex items-center gap-2"
                >
                  <UserX className="w-4 h-4" />
                  Remove
                </button>
              </div>
            )}
          </div>
        </div>
      )}
      </div>
    </div>
  );
};

export default VideoMeetingRoom;
