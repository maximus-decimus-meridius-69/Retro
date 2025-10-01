import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { auth, getMeetingById, getCourseById } from '../firebase';
import io from 'socket.io-client';
import RecordRTC from 'recordrtc';
import {
  Mic,
  MicOff,
  Video,
  VideoOff,
  Phone,
  PhoneOff,
  MessageSquare,
  Users,
  Settings,
  Share,
  Hand,
  Upload,
  Download,
  Play,
  Pause,
  Volume2,
  VolumeX,
  MoreHorizontal,
  FileText,
  Image,
  Film,
  Paperclip,
  Send,
  X,
  UserX,
  Crown,
  Eye,
  EyeOff,
  Maximize,
  Minimize
} from 'lucide-react';

const CourseMeetingRoom = () => {
  const { meetingId } = useParams();
  const navigate = useNavigate();
  const [socket, setSocket] = useState(null);
  const [meeting, setMeeting] = useState(null);
  const [participants, setParticipants] = useState([]);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [isHost, setIsHost] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Media states
  const [isMuted, setIsMuted] = useState(true);
  const [hasVideo, setHasVideo] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [isHandRaised, setIsHandRaised] = useState(false);
  
  // UI states
  const [showChat, setShowChat] = useState(true);
  const [showParticipants, setShowParticipants] = useState(true);
  const [showMaterials, setShowMaterials] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  
  // File and material states
  const [materials, setMaterials] = useState([]);
  const [uploadFile, setUploadFile] = useState(null);
  const [uploadTitle, setUploadTitle] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  
  // Media refs
  const localVideoRef = useRef(null);
  const localStreamRef = useRef(null);
  const recordingRef = useRef(null);
  const fileInputRef = useRef(null);
  
  const currentUser = auth.currentUser;
  
  useEffect(() => {
    if (!currentUser) {
      navigate('/login');
      return;
    }
    
    initializeSocket();
    loadMeetingData();
    
    return () => {
      cleanup();
    };
  }, [meetingId, currentUser]);
  
  const initializeSocket = () => {
    const newSocket = io('http://localhost:3001');
    
    newSocket.on('connect', () => {
      console.log('Connected to server');
      setSocket(newSocket);
    });
    
    newSocket.on('participant-joined', (participant) => {
      console.log('Participant joined:', participant);
    });
    
    newSocket.on('participant-left', ({ userId }) => {
      setParticipants(prev => prev.filter(p => p.userId !== userId));
    });
    
    newSocket.on('participants-updated', (updatedParticipants) => {
      setParticipants(updatedParticipants);
    });
    
    newSocket.on('new-message', (message) => {
      setMessages(prev => [...prev, message]);
    });
    
    newSocket.on('chat-history', (history) => {
      setMessages(history);
    });
    
    newSocket.on('meeting-materials', (materials) => {
      setMaterials(materials);
    });
    
    newSocket.on('material-uploaded', (material) => {
      setMaterials(prev => [...prev, material]);
    });
    
    newSocket.on('recording-started', () => {
      setIsRecording(true);
    });
    
    newSocket.on('recording-stopped', () => {
      setIsRecording(false);
    });
    
    newSocket.on('meeting-ended', () => {
      alert('The meeting has been ended by the host');
      navigate('/courses');
    });
    
    newSocket.on('kicked-from-room', ({ message }) => {
      alert(message);
      navigate('/courses');
    });
    
    newSocket.on('action-error', (errorMessage) => {
      alert(errorMessage);
    });
    
    newSocket.on('host-action', ({ message }) => {
      alert(message);
    });
  };
  
  const loadMeetingData = async () => {
    try {
      setLoading(true);
      
      // Get meeting data from Firebase
      const meetingData = await getMeetingById(meetingId);
      if (!meetingData) {
        throw new Error('Meeting not found');
      }
      
      // Get course data to check enrollment
      const courseData = await getCourseById(meetingData.courseId);
      if (!courseData) {
        throw new Error('Course not found');
      }
      
      // Check if user can access this meeting
      const isEnrolled = courseData.enrolledUsers?.includes(currentUser.uid) || false;
      const isOwner = courseData.creatorId === currentUser.uid;
      
      if (!isEnrolled && !isOwner) {
        throw new Error('You are not enrolled in this course');
      }
      
      setMeeting(meetingData);
      setIsHost(meetingData.hostId === currentUser.uid);
      
      // Materials will be loaded from Firebase if needed
      setMaterials([]);
      
    } catch (error) {
      console.error('Error loading meeting:', error);
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };
  
  const joinMeeting = useCallback(() => {
    if (socket && meeting) {
      socket.emit('join-room', {
        roomId: meetingId,
        userId: currentUser.uid,
        userName: currentUser.displayName || currentUser.email,
        userEmail: currentUser.email,
        isHost
      });
      
      // Initialize media
      initializeMedia();
    }
  }, [socket, meeting, meetingId, currentUser, isHost]);
  
  useEffect(() => {
    if (!loading && socket && meeting) {
      joinMeeting();
    }
  }, [loading, socket, meeting, joinMeeting]);
  
  const initializeMedia = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true
      });
      
      localStreamRef.current = stream;
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }
      
      // Initially mute audio
      stream.getAudioTracks().forEach(track => {
        track.enabled = false;
      });
      
      // Initially disable video
      stream.getVideoTracks().forEach(track => {
        track.enabled = false;
      });
      
    } catch (error) {
      console.error('Error accessing media devices:', error);
      alert('Error accessing camera/microphone. Please check permissions.');
    }
  };
  
  const toggleMute = () => {
    if (localStreamRef.current) {
      const audioTracks = localStreamRef.current.getAudioTracks();
      audioTracks.forEach(track => {
        track.enabled = !isMuted;
      });
      
      setIsMuted(!isMuted);
      
      if (socket) {
        socket.emit('toggle-mute', {
          roomId: meetingId,
          userId: currentUser.uid,
          isMuted: !isMuted
        });
      }
    }
  };
  
  const toggleVideo = () => {
    if (localStreamRef.current) {
      const videoTracks = localStreamRef.current.getVideoTracks();
      videoTracks.forEach(track => {
        track.enabled = !hasVideo;
      });
      
      setHasVideo(!hasVideo);
      
      if (socket) {
        socket.emit('toggle-video', {
          roomId: meetingId,
          userId: currentUser.uid,
          hasVideo: !hasVideo
        });
      }
    }
  };
  
  const startRecording = async () => {
    if (!isHost) return;
    
    try {
      if (localStreamRef.current) {
        recordingRef.current = new RecordRTC(localStreamRef.current, {
          type: 'video',
          mimeType: 'video/webm'
        });
        
        recordingRef.current.startRecording();
        
        if (socket) {
          socket.emit('start-recording', {
            roomId: meetingId,
            hostId: currentUser.uid
          });
        }
      }
    } catch (error) {
      console.error('Error starting recording:', error);
      alert('Error starting recording');
    }
  };
  
  const stopRecording = () => {
    if (!isHost || !recordingRef.current) return;
    
    recordingRef.current.stopRecording(async () => {
      const blob = recordingRef.current.getBlob();
      
      // Upload recording
      const formData = new FormData();
      formData.append('recording', blob, `meeting-${meetingId}-${Date.now()}.webm`);
      formData.append('duration', '0'); // Would calculate actual duration in real app
      
      try {
        await fetch(`http://localhost:3001/api/meetings/${meetingId}/recording`, {
          method: 'POST',
          body: formData
        });
        
        alert('Recording saved successfully');
      } catch (error) {
        console.error('Error uploading recording:', error);
        alert('Error saving recording');
      }
    });
    
    if (socket) {
      socket.emit('stop-recording', {
        roomId: meetingId,
        hostId: currentUser.uid
      });
    }
  };
  
  const shareScreen = async () => {
    try {
      if (isScreenSharing) {
        // Stop screen sharing
        const stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true
        });
        
        localStreamRef.current = stream;
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
        }
        
        setIsScreenSharing(false);
      } else {
        // Start screen sharing
        const stream = await navigator.mediaDevices.getDisplayMedia({
          video: true,
          audio: true
        });
        
        localStreamRef.current = stream;
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
        }
        
        setIsScreenSharing(true);
        
        // Stop screen sharing when user stops it
        stream.getVideoTracks()[0].addEventListener('ended', () => {
          setIsScreenSharing(false);
          initializeMedia();
        });
      }
      
      if (socket) {
        socket.emit('share-screen', {
          roomId: meetingId,
          userId: currentUser.uid,
          isSharing: !isScreenSharing
        });
      }
      
    } catch (error) {
      console.error('Error with screen sharing:', error);
    }
  };
  
  const raiseHand = () => {
    setIsHandRaised(!isHandRaised);
    
    if (socket) {
      socket.emit('raise-hand', {
        roomId: meetingId,
        userId: currentUser.uid
      });
    }
  };
  
  const sendMessage = () => {
    if (!newMessage.trim() || !socket) return;
    
    socket.emit('send-message', {
      roomId: meetingId,
      userId: currentUser.uid,
      userName: currentUser.displayName || currentUser.email,
      message: newMessage,
      messageType: 'text'
    });
    
    setNewMessage('');
  };
  
  const uploadMaterial = async () => {
    if (!uploadFile || !isHost) return;
    
    setIsUploading(true);
    
    const formData = new FormData();
    formData.append('file', uploadFile);
    formData.append('title', uploadTitle || uploadFile.name);
    formData.append('uploaderId', currentUser.uid);
    formData.append('uploadType', 'materials');
    
    try {
      const response = await fetch(`http://localhost:3001/api/meetings/${meetingId}/materials`, {
        method: 'POST',
        body: formData
      });
      
      if (response.ok) {
        setUploadFile(null);
        setUploadTitle('');
        alert('Material uploaded successfully');
      } else {
        throw new Error('Upload failed');
      }
    } catch (error) {
      console.error('Error uploading material:', error);
      alert('Error uploading material');
    } finally {
      setIsUploading(false);
    }
  };
  
  const leaveMeeting = () => {
    if (socket) {
      socket.emit('leave-room', {
        roomId: meetingId,
        userId: currentUser.uid
      });
    }
    
    cleanup();
    navigate('/courses');
  };
  
  const endMeeting = async () => {
    if (!isHost) return;
    
    try {
      await fetch(`http://localhost:3001/api/meetings/${meetingId}/end`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hostId: currentUser.uid })
      });
      
      cleanup();
      navigate('/courses');
    } catch (error) {
      console.error('Error ending meeting:', error);
      alert('Error ending meeting');
    }
  };
  
  const kickParticipant = (participantId) => {
    if (!isHost || !socket) return;
    
    socket.emit('host-kick-participant', {
      roomId: meetingId,
      targetUserId: participantId,
      hostId: currentUser.uid
    });
  };
  
  const muteParticipant = (participantId, shouldMute) => {
    if (!isHost || !socket) return;
    
    socket.emit('host-mute-participant', {
      roomId: meetingId,
      targetUserId: participantId,
      isMuted: shouldMute,
      hostId: currentUser.uid
    });
  };
  
  const cleanup = () => {
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop());
    }
    
    if (recordingRef.current) {
      recordingRef.current.destroy();
    }
    
    if (socket) {
      socket.disconnect();
    }
  };
  
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };
  
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500 mx-auto mb-4"></div>
          <p className="text-white">Loading meeting...</p>
        </div>
      </div>
    );
  }
  
  if (error) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-red-400 mb-4">Access Denied</h2>
          <p className="text-gray-300 mb-6">{error}</p>
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
    <div className="min-h-screen bg-gray-900 text-white flex flex-col">
      {/* Header */}
      <div className="bg-gray-800 px-6 py-4 flex items-center justify-between border-b border-gray-700">
        <div className="flex items-center space-x-4">
          <h1 className="text-xl font-semibold">{meeting?.title}</h1>
          {isRecording && (
            <div className="flex items-center space-x-2 text-red-400">
              <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
              <span className="text-sm">Recording</span>
            </div>
          )}
        </div>
        
        <div className="flex items-center space-x-2">
          <button
            onClick={toggleFullscreen}
            className="p-2 hover:bg-gray-700 rounded-lg"
            title="Toggle Fullscreen"
          >
            {isFullscreen ? <Minimize className="w-5 h-5" /> : <Maximize className="w-5 h-5" />}
          </button>
          
          <button
            onClick={() => setShowSettings(!showSettings)}
            className="p-2 hover:bg-gray-700 rounded-lg"
            title="Settings"
          >
            <Settings className="w-5 h-5" />
          </button>
          
          {isHost ? (
            <button
              onClick={endMeeting}
              className="px-4 py-2 bg-red-600 hover:bg-red-700 rounded-lg flex items-center space-x-2"
            >
              <PhoneOff className="w-4 h-4" />
              <span>End Meeting</span>
            </button>
          ) : (
            <button
              onClick={leaveMeeting}
              className="px-4 py-2 bg-red-600 hover:bg-red-700 rounded-lg flex items-center space-x-2"
            >
              <PhoneOff className="w-4 h-4" />
              <span>Leave</span>
            </button>
          )}
        </div>
      </div>
      
      <div className="flex-1 flex">
        {/* Main Content */}
        <div className="flex-1 flex flex-col">
          {/* Video Area */}
          <div className="flex-1 relative bg-black">
            <video
              ref={localVideoRef}
              autoPlay
              muted
              className="w-full h-full object-cover"
              style={{ display: hasVideo ? 'block' : 'none' }}
            />
            
            {!hasVideo && (
              <div className="absolute inset-0 flex items-center justify-center bg-gray-800">
                <div className="text-center">
                  <div className="w-24 h-24 bg-purple-600 rounded-full flex items-center justify-center mx-auto mb-4">
                    <span className="text-2xl font-bold">
                      {(currentUser.displayName || currentUser.email)[0].toUpperCase()}
                    </span>
                  </div>
                  <p className="text-gray-300">Camera is off</p>
                </div>
              </div>
            )}
            
            {isScreenSharing && (
              <div className="absolute top-4 left-4 bg-blue-600 px-3 py-1 rounded-lg text-sm">
                Sharing Screen
              </div>
            )}
          </div>
          
          {/* Controls */}
          <div className="bg-gray-800 px-6 py-4 flex items-center justify-center space-x-4">
            <button
              onClick={toggleMute}
              className={`p-3 rounded-full ${isMuted ? 'bg-red-600 hover:bg-red-700' : 'bg-gray-600 hover:bg-gray-700'}`}
              title={isMuted ? 'Unmute' : 'Mute'}
            >
              {isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
            </button>
            
            <button
              onClick={toggleVideo}
              className={`p-3 rounded-full ${!hasVideo ? 'bg-red-600 hover:bg-red-700' : 'bg-gray-600 hover:bg-gray-700'}`}
              title={hasVideo ? 'Turn off camera' : 'Turn on camera'}
            >
              {hasVideo ? <Video className="w-5 h-5" /> : <VideoOff className="w-5 h-5" />}
            </button>
            
            <button
              onClick={shareScreen}
              className={`p-3 rounded-full ${isScreenSharing ? 'bg-blue-600 hover:bg-blue-700' : 'bg-gray-600 hover:bg-gray-700'}`}
              title="Share Screen"
            >
              <Share className="w-5 h-5" />
            </button>
            
            <button
              onClick={raiseHand}
              className={`p-3 rounded-full ${isHandRaised ? 'bg-yellow-600 hover:bg-yellow-700' : 'bg-gray-600 hover:bg-gray-700'}`}
              title="Raise Hand"
            >
              <Hand className="w-5 h-5" />
            </button>
            
            {isHost && (
              <>
                <button
                  onClick={isRecording ? stopRecording : startRecording}
                  className={`p-3 rounded-full ${isRecording ? 'bg-red-600 hover:bg-red-700' : 'bg-gray-600 hover:bg-gray-700'}`}
                  title={isRecording ? 'Stop Recording' : 'Start Recording'}
                >
                  {isRecording ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
                </button>
                
                <button
                  onClick={() => setShowMaterials(!showMaterials)}
                  className={`p-3 rounded-full ${showMaterials ? 'bg-purple-600 hover:bg-purple-700' : 'bg-gray-600 hover:bg-gray-700'}`}
                  title="Materials"
                >
                  <Paperclip className="w-5 h-5" />
                </button>
              </>
            )}
          </div>
        </div>
        
        {/* Right Sidebar */}
        <div className="w-80 bg-gray-800 border-l border-gray-700 flex flex-col">
          {/* Sidebar Tabs */}
          <div className="flex border-b border-gray-700">
            <button
              onClick={() => setShowChat(true)}
              className={`flex-1 px-4 py-3 text-sm font-medium ${showChat ? 'bg-purple-600 text-white' : 'text-gray-400 hover:text-white'}`}
            >
              <MessageSquare className="w-4 h-4 mx-auto mb-1" />
              Chat
            </button>
            
            <button
              onClick={() => setShowChat(false)}
              className={`flex-1 px-4 py-3 text-sm font-medium ${!showChat ? 'bg-purple-600 text-white' : 'text-gray-400 hover:text-white'}`}
            >
              <Users className="w-4 h-4 mx-auto mb-1" />
              Participants ({participants.length})
            </button>
          </div>
          
          {/* Chat Panel */}
          {showChat && (
            <div className="flex-1 flex flex-col">
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {messages.map((message) => (
                  <div key={message.id} className="space-y-1">
                    <div className="flex items-center space-x-2 text-xs text-gray-400">
                      <span className="font-medium">{message.userName}</span>
                      <span>{new Date(message.createdAt).toLocaleTimeString()}</span>
                    </div>
                    <p className="text-sm text-gray-200">{message.message}</p>
                  </div>
                ))}
              </div>
              
              <div className="p-4 border-t border-gray-700">
                <div className="flex space-x-2">
                  <input
                    type="text"
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
                    placeholder="Type a message..."
                    className="flex-1 bg-gray-700 text-white px-3 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                  <button
                    onClick={sendMessage}
                    className="p-2 bg-purple-600 hover:bg-purple-700 rounded-lg"
                  >
                    <Send className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          )}
          
          {/* Participants Panel */}
          {!showChat && (
            <div className="flex-1 overflow-y-auto p-4">
              <div className="space-y-3">
                {participants.map((participant) => (
                  <div key={participant.userId} className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="w-8 h-8 bg-purple-600 rounded-full flex items-center justify-center">
                        <span className="text-xs font-bold">
                          {participant.userName[0].toUpperCase()}
                        </span>
                      </div>
                      
                      <div>
                        <p className="text-sm font-medium flex items-center space-x-1">
                          <span>{participant.userName}</span>
                          {participant.isHost && <Crown className="w-3 h-3 text-yellow-400" />}
                          {participant.isHandRaised && <Hand className="w-3 h-3 text-yellow-400" />}
                        </p>
                        <div className="flex space-x-1">
                          {participant.isMuted && <MicOff className="w-3 h-3 text-red-400" />}
                          {!participant.hasVideo && <VideoOff className="w-3 h-3 text-red-400" />}
                          {participant.isScreenSharing && <Share className="w-3 h-3 text-blue-400" />}
                        </div>
                      </div>
                    </div>
                    
                    {isHost && !participant.isHost && (
                      <div className="flex space-x-1">
                        <button
                          onClick={() => muteParticipant(participant.userId, !participant.isMuted)}
                          className="p-1 hover:bg-gray-700 rounded"
                          title={participant.isMuted ? 'Unmute' : 'Mute'}
                        >
                          {participant.isMuted ? <VolumeX className="w-3 h-3" /> : <Volume2 className="w-3 h-3" />}
                        </button>
                        
                        <button
                          onClick={() => kickParticipant(participant.userId)}
                          className="p-1 hover:bg-gray-700 rounded text-red-400"
                          title="Remove participant"
                        >
                          <UserX className="w-3 h-3" />
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
        
        {/* Materials Panel */}
        {showMaterials && isHost && (
          <div className="w-80 bg-gray-800 border-l border-gray-700 flex flex-col">
            <div className="p-4 border-b border-gray-700">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold">Materials</h3>
                <button
                  onClick={() => setShowMaterials(false)}
                  className="p-1 hover:bg-gray-700 rounded"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              
              <div className="space-y-3">
                <input
                  type="text"
                  value={uploadTitle}
                  onChange={(e) => setUploadTitle(e.target.value)}
                  placeholder="Material title"
                  className="w-full bg-gray-700 text-white px-3 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
                
                <input
                  ref={fileInputRef}
                  type="file"
                  onChange={(e) => setUploadFile(e.target.files[0])}
                  className="hidden"
                />
                
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full py-2 border-2 border-dashed border-gray-600 hover:border-purple-500 rounded-lg text-gray-400 hover:text-white"
                >
                  {uploadFile ? uploadFile.name : 'Choose file'}
                </button>
                
                <button
                  onClick={uploadMaterial}
                  disabled={!uploadFile || isUploading}
                  className="w-full py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 rounded-lg"
                >
                  {isUploading ? 'Uploading...' : 'Upload Material'}
                </button>
              </div>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4">
              <div className="space-y-2">
                {materials.map((material) => (
                  <div key={material.id} className="p-3 bg-gray-700 rounded-lg">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <p className="text-sm font-medium">{material.title}</p>
                        <p className="text-xs text-gray-400 mt-1">
                          {new Date(material.uploadedAt).toLocaleString()}
                        </p>
                      </div>
                      
                      <a
                        href={`http://localhost:3001${material.url}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-1 hover:bg-gray-600 rounded"
                      >
                        <Download className="w-4 h-4" />
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default CourseMeetingRoom;