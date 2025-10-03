import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import Peer from 'peerjs';
import io from 'socket.io-client';

const socket = io.connect('http://localhost:3001'); // Server running on port 3001

const AudioRoomComponent = ({ roomId, userId, userName, isHost }) => {
  const [participants, setParticipants] = useState([]);
  const [chatMessages, setChatMessages] = useState([]);
  const [message, setMessage] = useState('');
  const [isMuted, setIsMuted] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [roomSettings, setRoomSettings] = useState({ allow_media: true, allow_chat: true });
  const [mediaFile, setMediaFile] = useState(null);
  const [isUploadingMedia, setIsUploadingMedia] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [showMediaPanel, setShowMediaPanel] = useState(false);
  const audioRef = useRef();
  const localStreamRef = useRef();
  const peerRef = useRef();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    // Handle browser back button navigation
    const handlePopState = (event) => {
      // When back button is pressed in audio room
      if (location.pathname.includes('/audio-room/')) {
        // Prevent default back navigation
        event.preventDefault();
        
        // Clean up and navigate to audio rooms list
        handleLeaveRoom();
      }
    };

    // Replace current history state to prevent back navigation issues
    window.history.replaceState({ audioRoom: true }, '', window.location.href);
    
    // Add popstate listener
    window.addEventListener('popstate', handlePopState);

    // Cleanup function to stop local tracks
    const cleanup = () => {
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(track => track.stop());
      }
    };

    // Initialize a peer
    peerRef.current = new Peer(userId);

    // When a peer connection is open
    peerRef.current.on('open', (id) => {
      console.log('Peer connection open:', id);
      setIsConnected(true);
    });

    // Get local media stream
    navigator.mediaDevices.getUserMedia({ audio: true }).then((stream) => {
      localStreamRef.current = stream;
      // Don't play local stream to avoid echo/feedback
    }).catch((error) => {
      console.error('Error accessing microphone:', error);
    });

    // Handle incoming call
    peerRef.current.on('call', (call) => {
      call.answer(localStreamRef.current);
      call.on('stream', (remoteStream) => {
        // Only play remote stream
        if (audioRef.current) {
          audioRef.current.srcObject = remoteStream;
        }
      });
    });

    // Handle socket events with updated event names from server
    socket.on('participants-updated', (participantsList) => {
      setParticipants(participantsList);
    });

    socket.on('new-message', (msg) => {
      console.log('Received new message:', msg);
      console.log('Message type:', msg.messageType);
      console.log('Has media data:', !!msg.mediaData);
      console.log('Has media URL:', !!msg.mediaUrl);
      console.log('MIME type:', msg.mimeType);
      
      if (msg.messageType === 'media' && msg.mediaData) {
        console.log('Media data length:', msg.mediaData.length);
        console.log('Media data preview:', msg.mediaData.substring(0, 100) + '...');
        console.log('Media data starts with data:URL:', msg.mediaData.startsWith('data:'));
      }
      
      setChatMessages((prev) => [...prev, msg]);
    });

    socket.on('chat-history', (messages) => {
      console.log('Received chat history:', messages);
      setChatMessages(messages);
    });

    // Listen for room settings updates
    socket.on('room-settings-updated', (settings) => {
      setRoomSettings(settings);
    });

    socket.on('room-media-settings-updated', ({ allow_media }) => {
      setRoomSettings(prev => ({ ...prev, allow_media }));
    });

    // Notify server that the user joined the room
    console.log('Joining room:', { roomId, userId, userName, isHost });
    socket.emit('join-room', { roomId, userId, userName, isHost });
    
    // Listen for message errors
    socket.on('message-error', (error) => {
      console.error('Message error:', error);
      alert('Chat error: ' + error);
    });

    return () => {
      window.removeEventListener('popstate', handlePopState);
      socket.emit('leave-room', { roomId, userId });
      socket.off('participants-updated');
      socket.off('new-message');
      socket.off('chat-history');
      socket.off('room-settings-updated');
      socket.off('room-media-settings-updated');
      cleanup();
      if (peerRef.current) {
        peerRef.current.destroy();
        peerRef.current = null;
      }
    };
  }, [roomId, userId, userName, isHost, location.pathname]);

  const handleLeaveRoom = () => {
    socket.emit('leave-room', { roomId, userId });
    
    // Stop all media tracks (microphone, camera, etc.)
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => {
        console.log('Stopping track:', track.kind);
        track.stop();
      });
      localStreamRef.current = null;
    }
    
    // Clear audio element
    if (audioRef.current) {
      audioRef.current.srcObject = null;
    }
    
    // Disconnect peer connection
    if (peerRef.current) {
      peerRef.current.destroy();
      peerRef.current = null;
    }
    
    // Clear state
    setParticipants([]);
    setChatMessages([]);
    setIsConnected(false);
    setIsMuted(false);
    
    // Navigate back to audio rooms list, replacing current history entry
    navigate('/audio-rooms', { replace: true });
  };

  const handleToggleMute = () => {
    if (localStreamRef.current) {
      localStreamRef.current.getAudioTracks().forEach(track => {
        track.enabled = !track.enabled;
      });
      setIsMuted(!isMuted);
      socket.emit('toggle-mute', { roomId, userId, isMuted: !isMuted });
    }
  };

  const handleSendMessage = () => {
    if (message.trim()) {
      console.log('Sending message:', { roomId, userId, userName, message: message.trim() });
      socket.emit('send-message', { roomId, userId, userName, message: message.trim() });
      setMessage('');
    } else {
      console.log('Message is empty, not sending');
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      handleSendMessage();
    }
  };

  const handleToggleMediaPermissions = () => {
    if (isHost) {
      const newValue = !roomSettings.allow_media;
      socket.emit('host-set-media-permissions', { 
        roomId, 
        hostId: userId, 
        allow_media: newValue 
      });
    }
  };

  const handleMediaFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setMediaFile(file);
    }
  };

  const handleSendMedia = async () => {
    if (mediaFile && roomSettings.allow_media) {
      setIsUploadingMedia(true);
      setUploadProgress(0);
      
      try {
        // Check file size (limit to 5MB for base64 encoding)
        const maxSize = 5 * 1024 * 1024; // 5MB
        const isLargeFile = mediaFile.size > maxSize;
        
        if (isLargeFile) {
          alert('File is too large. Please use files smaller than 5MB for direct sharing.');
          return;
        }
        
                 // Convert file to base64
         const reader = new FileReader();
         
         const fileDataPromise = new Promise((resolve, reject) => {
           reader.onload = () => {
             const base64Data = reader.result;
             resolve(base64Data);
           };
           reader.onerror = () => reject(new Error('Failed to read file'));
         });
         
         // Start reading the file
         reader.readAsDataURL(mediaFile);
         
         // Simulate progress for small files
         const progressInterval = setInterval(() => {
           setUploadProgress(prev => {
             if (prev >= 90) {
               clearInterval(progressInterval);
               return 90;
             }
             return prev + 10;
           });
         }, 100);
         
         const base64Data = await fileDataPromise;
         clearInterval(progressInterval);
         setUploadProgress(100);
        
                 // Send message with file data
         const messageData = {
           roomId,
           userId,
           userName,
           message: `Shared: ${mediaFile.name}`,
           messageType: 'media',
           mediaData: base64Data,
           fileName: mediaFile.name,
           fileSize: mediaFile.size,
           mimeType: mediaFile.type
         };
         
         console.log('Sending media message:', {
           messageType: messageData.messageType,
           hasMediaData: !!messageData.mediaData,
           fileName: messageData.fileName,
           mimeType: messageData.mimeType,
           dataLength: messageData.mediaData ? messageData.mediaData.length : 0,
           dataPreview: messageData.mediaData ? messageData.mediaData.substring(0, 100) + '...' : 'No data'
         });
         
         // Check if data is too large for Socket.IO
         if (base64Data.length > 1000000) { // 1MB limit for Socket.IO
           console.warn('Media data is very large, may cause issues');
         }
         
         socket.emit('send-message', messageData);
        
        setMediaFile(null);
        setShowMediaPanel(false);
        
        // Clear the file input
        const fileInput = document.getElementById('media-file-input');
        if (fileInput) {
          fileInput.value = '';
        }
        
        // Reset progress
        setTimeout(() => setUploadProgress(0), 1000);
      } catch (error) {
        console.error('Media sharing error:', error);
        alert(`Failed to share media: ${error.message}`);
      } finally {
        setIsUploadingMedia(false);
      }
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-100 to-purple-200 p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="bg-white bg-opacity-80 backdrop-blur-lg rounded-2xl shadow-xl p-6 mb-6">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold text-gray-800 mb-2">🎤 Audio Room</h1>
              <p className="text-gray-600">Room ID: {roomId}</p>
              <div className="flex items-center mt-2">
                <div className={`w-3 h-3 rounded-full mr-2 ${isConnected ? 'bg-green-500' : 'bg-red-500'}`}></div>
                <span className="text-sm text-gray-600">
                  {isConnected ? 'Connected' : 'Connecting...'}
                </span>
              </div>
            </div>
            <div className="flex gap-3">
              <button
                onClick={handleToggleMute}
                className={`px-4 py-2 rounded-lg font-semibold transition-colors duration-200 ${
                  isMuted 
                    ? 'bg-red-500 hover:bg-red-600 text-white' 
                    : 'bg-green-500 hover:bg-green-600 text-white'
                }`}
              >
                {isMuted ? '🔇 Unmute' : '🎤 Mute'}
              </button>
              <button
                onClick={handleLeaveRoom}
                className="bg-red-500 hover:bg-red-600 text-white font-semibold px-6 py-2 rounded-lg shadow-md transition-colors duration-200"
              >
                Leave Room
              </button>
            </div>
          </div>
        </div>

        {/* Host Controls */}
        {isHost && (
          <div className="bg-white bg-opacity-80 backdrop-blur-lg rounded-2xl shadow-xl p-6 mb-6">
            <h3 className="text-xl font-bold text-gray-800 mb-4">🔧 Host Controls</h3>
            <div className="flex gap-4">
              <button
                onClick={handleToggleMediaPermissions}
                className={`px-4 py-2 rounded-lg font-semibold transition-colors duration-200 ${
                  roomSettings.allow_media
                    ? 'bg-green-500 hover:bg-green-600 text-white'
                    : 'bg-gray-500 hover:bg-gray-600 text-white'
                }`}
              >
                {roomSettings.allow_media ? '📁 Media Enabled' : '🚫 Media Disabled'}
              </button>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Participants Panel */}
          <div className="lg:col-span-1">
            <div className="bg-white bg-opacity-80 backdrop-blur-lg rounded-2xl shadow-xl p-6">
              <h3 className="text-xl font-bold text-gray-800 mb-4 flex items-center">
                👥 Participants ({participants.length})
              </h3>
              <div className="space-y-3">
                {participants.length === 0 ? (
                  <p className="text-gray-500 text-center py-4">No participants yet...</p>
                ) : (
                  participants.map((participant) => (
                    <div key={participant.userId} className="flex items-center justify-between bg-gray-50 p-3 rounded-lg">
                      <div className="flex items-center">
                        <div className="w-8 h-8 bg-purple-500 rounded-full flex items-center justify-center text-white font-semibold text-sm mr-3">
                          {participant.userName?.charAt(0)?.toUpperCase() || 'U'}
                        </div>
                        <div>
                          <p className="font-medium text-gray-800">{participant.userName}</p>
                          {participant.isHost && (
                            <p className="text-xs text-purple-600 font-medium">Host</p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center">
                        {participant.isMuted && (
                          <span className="text-red-500 text-sm">🔇</span>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Chat Panel */}
          <div className="lg:col-span-2">
            <div className="bg-white bg-opacity-80 backdrop-blur-lg rounded-2xl shadow-xl p-6 h-96 flex flex-col">
              <h3 className="text-xl font-bold text-gray-800 mb-4 flex items-center">
                💬 Chat
              </h3>
              
              {/* Messages */}
              <div className="flex-1 overflow-y-auto bg-gray-50 rounded-lg p-4 mb-4 space-y-3">
                {chatMessages.length === 0 ? (
                  <p className="text-gray-500 text-center">No messages yet. Start the conversation!</p>
                ) : (
                  chatMessages.map((msg, index) => (
                    <div key={index} className="flex items-start space-x-3">
                      <div className="w-8 h-8 bg-indigo-500 rounded-full flex items-center justify-center text-white font-semibold text-xs flex-shrink-0">
                        {msg.userName?.charAt(0)?.toUpperCase() || 'U'}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center space-x-2 mb-1">
                          <span className="font-medium text-gray-800 text-sm">{msg.userName}</span>
                          <span className="text-xs text-gray-500">
                            {new Date(msg.createdAt).toLocaleTimeString()}
                          </span>
                        </div>
                        {msg.messageType === 'media' ? (
                          <div className="text-sm">
                            <p className="text-gray-700">{msg.message}</p>
                            {(msg.mediaData || msg.mediaUrl) && (
                              <div className="mt-2">
                                {/* File info */}
                                <div className="text-xs text-gray-500 mb-2">
                                  {msg.fileName && <span>File: {msg.fileName}</span>}
                                  {msg.fileSize && (
                                    <span className="ml-2">
                                      Size: {(msg.fileSize / 1024 / 1024).toFixed(2)} MB
                                    </span>
                                  )}
                                </div>
                                
                                                                 {/* Media display based on MIME type */}
                                 {msg.mimeType && msg.mimeType.startsWith('image/') ? (
                                   <div className="relative group">
                                     <img 
                                       src={msg.mediaData || msg.mediaUrl} 
                                       alt="Shared image" 
                                       className="max-w-xs max-h-64 rounded-lg border cursor-pointer hover:opacity-90 transition-opacity"
                                       onError={(e) => {
                                         console.error('Failed to load image:', e);
                                         e.target.style.display = 'none';
                                         e.target.nextSibling.style.display = 'block';
                                       }}
                                       onClick={() => {
                                         const url = msg.mediaData || msg.mediaUrl;
                                         const win = window.open();
                                         win.document.write(`<img src="${url}" style="max-width: 100%; height: auto;" />`);
                                       }}
                                     />
                                     <div 
                                       className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-10 transition-all rounded-lg flex items-center justify-center"
                                       style={{ display: 'none' }}
                                     >
                                       <span className="text-white opacity-0 group-hover:opacity-100 text-xs">Click to enlarge</span>
                                     </div>
                                     <div 
                                       className="bg-red-50 border border-red-200 rounded-lg p-3 text-center"
                                       style={{ display: 'none' }}
                                     >
                                       <p className="text-red-600 text-sm">⚠️ Image failed to load</p>
                                       <p className="text-xs text-gray-500 mt-1">Data may be corrupted or too large</p>
                                     </div>
                                   </div>
                                ) : msg.mimeType && msg.mimeType.startsWith('audio/') ? (
                                  <div className="bg-gray-100 p-3 rounded-lg">
                                    <div className="flex items-center space-x-2 mb-2">
                                      <span className="text-blue-600">🎵</span>
                                      <span className="text-sm font-medium">Audio File</span>
                                    </div>
                                    <audio controls className="w-full">
                                      <source src={msg.mediaData || msg.mediaUrl} type={msg.mimeType} />
                                      Your browser does not support audio playback.
                                    </audio>
                                  </div>
                                ) : msg.mimeType && msg.mimeType.startsWith('video/') ? (
                                  <div className="bg-gray-100 p-3 rounded-lg">
                                    <div className="flex items-center space-x-2 mb-2">
                                      <span className="text-red-600">🎬</span>
                                      <span className="text-sm font-medium">Video File</span>
                                    </div>
                                    <video controls className="max-w-xs rounded-lg">
                                      <source src={msg.mediaData || msg.mediaUrl} type={msg.mimeType} />
                                      Your browser does not support video playback.
                                    </video>
                                  </div>
                                ) : msg.mimeType === 'application/pdf' ? (
                                  <div className="bg-gray-100 p-3 rounded-lg">
                                    <div className="flex items-center space-x-2 mb-2">
                                      <span className="text-red-600">📄</span>
                                      <span className="text-sm font-medium">PDF Document</span>
                                    </div>
                                    <a 
                                      href={msg.mediaData || msg.mediaUrl} 
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="inline-flex items-center space-x-2 bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded-lg text-sm transition-colors"
                                    >
                                      <span>📖</span>
                                      <span>View PDF</span>
                                    </a>
                                  </div>
                                ) : (
                                  <div className="bg-gray-100 p-3 rounded-lg">
                                    <div className="flex items-center space-x-2 mb-2">
                                      <span className="text-gray-600">📎</span>
                                      <span className="text-sm font-medium">File Attachment</span>
                                    </div>
                                    <a 
                                      href={msg.mediaData || msg.mediaUrl} 
                                      download={msg.fileName}
                                      className="inline-flex items-center space-x-2 bg-green-600 hover:bg-green-700 text-white px-3 py-2 rounded-lg text-sm transition-colors"
                                    >
                                      <span>⬇️</span>
                                      <span>Download {msg.fileName}</span>
                                    </a>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        ) : (
                          <p className="text-gray-700 text-sm">{msg.message}</p>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
              
                             {/* Message Input */}
               <div className="flex space-x-3">
                 <input
                   type="text"
                   value={message}
                   onChange={(e) => setMessage(e.target.value)}
                   onKeyPress={handleKeyPress}
                   placeholder="Type your message..."
                   className="flex-1 px-4 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-purple-500 transition-colors duration-200"
                 />
                 
                 {/* Media Attachment Button */}
                 <button
                   onClick={() => setShowMediaPanel(!showMediaPanel)}
                   className={`px-4 py-2 rounded-lg font-semibold transition-colors duration-200 flex items-center space-x-2 ${
                     showMediaPanel 
                       ? 'bg-purple-600 text-white' 
                       : roomSettings.allow_media
                         ? 'bg-blue-500 hover:bg-blue-600 text-white'
                         : 'bg-gray-400 text-gray-600 cursor-not-allowed'
                   }`}
                   title={roomSettings.allow_media ? "Attach media" : "Media sharing disabled by host"}
                   disabled={!roomSettings.allow_media}
                 >
                   <span>📎</span>
                   <span className="hidden sm:inline">Media</span>
                 </button>
                 
                 <button
                   onClick={handleSendMessage}
                   disabled={!message.trim()}
                   className="bg-purple-600 hover:bg-purple-700 disabled:bg-gray-400 text-white font-semibold px-6 py-2 rounded-lg transition-colors duration-200"
                 >
                   Send
                 </button>
               </div>
              
                             {/* Quick Media Upload Panel */}
               {showMediaPanel && (
                 <div className="mt-3 p-4 bg-gradient-to-r from-purple-50 to-blue-50 rounded-lg border-2 border-purple-200">
                                        <div className="flex items-center justify-between mb-3">
                       <h4 className="font-semibold text-gray-800 flex items-center">
                         <span className="mr-2">📎</span>
                         Attach Media
                       </h4>
                       <button
                         onClick={() => setShowMediaPanel(false)}
                         className="text-gray-500 hover:text-gray-700 text-sm"
                       >
                         ✕
                       </button>
                     </div>
                     
                     {!roomSettings.allow_media && (
                       <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-3">
                         <div className="flex items-center">
                           <span className="text-yellow-600 mr-2">⚠️</span>
                           <span className="text-yellow-800 text-sm">
                             Media sharing is currently disabled by the host.
                           </span>
                         </div>
                       </div>
                     )}
                   
                                        <div className="flex items-center space-x-3 mb-3">
                       <input
                         type="file"
                         onChange={handleMediaFileChange}
                         accept="image/*,audio/*,video/*,.pdf,.doc,.docx,.txt"
                         disabled={!roomSettings.allow_media}
                         className={`flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-purple-500 ${
                           !roomSettings.allow_media ? 'bg-gray-100 cursor-not-allowed' : ''
                         }`}
                       />
                     {mediaFile && (
                       <button
                         onClick={handleSendMedia}
                         disabled={isUploadingMedia}
                         className="bg-purple-600 hover:bg-purple-700 disabled:bg-gray-400 text-white text-sm px-4 py-2 rounded-lg transition-colors duration-200 flex items-center space-x-2"
                       >
                         {isUploadingMedia ? (
                           <>
                             <span className="animate-spin">⏳</span>
                             <span>Processing...</span>
                           </>
                         ) : (
                           <>
                             <span>📤</span>
                             <span>Send</span>
                           </>
                         )}
                       </button>
                     )}
                   </div>
                   
                   {mediaFile && (
                     <div className="bg-white p-3 rounded-lg border">
                       <div className="flex items-center space-x-3">
                         <div className="text-2xl">
                           {mediaFile.type.startsWith('image/') ? '🖼️' : 
                            mediaFile.type.startsWith('audio/') ? '🎵' : 
                            mediaFile.type.startsWith('video/') ? '🎬' : 
                            mediaFile.type === 'application/pdf' ? '📄' : '📎'}
                         </div>
                         <div className="flex-1">
                           <p className="font-medium text-gray-800 text-sm">{mediaFile.name}</p>
                           <p className="text-xs text-gray-500">
                             {(mediaFile.size / 1024 / 1024).toFixed(2)} MB • {mediaFile.type}
                           </p>
                         </div>
                         <button
                           onClick={() => {
                             setMediaFile(null);
                             const fileInput = document.querySelector('input[type="file"]');
                             if (fileInput) fileInput.value = '';
                           }}
                           className="text-red-500 hover:text-red-700 text-sm"
                         >
                           ✕
                         </button>
                       </div>
                       
                       {/* Upload Progress Bar */}
                       {isUploadingMedia && (
                         <div className="mt-3">
                           <div className="flex justify-between text-xs text-gray-600 mb-1">
                             <span>Processing file...</span>
                             <span>{uploadProgress.toFixed(1)}%</span>
                           </div>
                           <div className="w-full bg-gray-200 rounded-full h-2">
                             <div 
                               className="bg-purple-600 h-2 rounded-full transition-all duration-300"
                               style={{ width: `${uploadProgress}%` }}
                             ></div>
                           </div>
                         </div>
                       )}
                     </div>
                   )}
                   
                   <div className="text-xs text-gray-500 mt-2">
                     <p>Supported: Images, Audio, Video, PDF, Documents (Max 5MB)</p>
                   </div>
                 </div>
               )}
            </div>
          </div>
        </div>

        {/* Media Sharing Section */}
        {roomSettings.allow_media && (
          <div className="bg-white bg-opacity-80 backdrop-blur-lg rounded-2xl shadow-xl p-6 mt-6">
            <h3 className="text-xl font-bold text-gray-800 mb-4 flex items-center">
              📁 Share Media
            </h3>
            
            {/* Drag and Drop Area */}
            <div 
              className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center mb-4 hover:border-purple-500 transition-colors duration-200"
              onDragOver={(e) => {
                e.preventDefault();
                e.currentTarget.classList.add('border-purple-500', 'bg-purple-50');
              }}
              onDragLeave={(e) => {
                e.preventDefault();
                e.currentTarget.classList.remove('border-purple-500', 'bg-purple-50');
              }}
              onDrop={(e) => {
                e.preventDefault();
                e.currentTarget.classList.remove('border-purple-500', 'bg-purple-50');
                const files = e.dataTransfer.files;
                if (files.length > 0) {
                  handleMediaFileChange({ target: { files: [files[0]] } });
                }
              }}
            >
              <div className="text-gray-500">
                <div className="text-4xl mb-2">📁</div>
                <p className="text-lg font-medium mb-2">Drop files here or click to browse</p>
                                 <p className="text-sm">Supports: Images, Audio, Video, PDF, Documents (Max 5MB)</p>
              </div>
            </div>
            
            {/* File Input */}
            <div className="flex items-center space-x-4 mb-4">
              <input
                id="media-file-input"
                type="file"
                onChange={handleMediaFileChange}
                accept="image/*,audio/*,video/*,.pdf,.doc,.docx,.txt"
                className="flex-1 px-3 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-purple-500 transition-colors duration-200"
              />
            </div>
            
            {/* Selected File Info */}
            {mediaFile && (
              <div className="bg-gray-50 rounded-lg p-4 mb-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="text-2xl">
                      {mediaFile.type.startsWith('image/') ? '🖼️' : 
                       mediaFile.type.startsWith('audio/') ? '🎵' : 
                       mediaFile.type.startsWith('video/') ? '🎬' : 
                       mediaFile.type === 'application/pdf' ? '📄' : '📎'}
                    </div>
                    <div>
                      <p className="font-medium text-gray-800">{mediaFile.name}</p>
                      <p className="text-sm text-gray-500">
                        {(mediaFile.size / 1024 / 1024).toFixed(2)} MB • {mediaFile.type}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => {
                        setMediaFile(null);
                        const fileInput = document.getElementById('media-file-input');
                        if (fileInput) fileInput.value = '';
                      }}
                      className="text-red-500 hover:text-red-700 text-sm"
                    >
                      ✕
                    </button>
                    <button
                      onClick={handleSendMedia}
                      disabled={isUploadingMedia}
                      className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-semibold px-4 py-2 rounded-lg transition-colors duration-200 flex items-center space-x-2"
                    >
                      {isUploadingMedia ? (
                        <>
                          <span className="animate-spin">⏳</span>
                          <span>Uploading...</span>
                        </>
                      ) : (
                        <>
                          <span>📤</span>
                          <span>Share</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
                
                {/* Upload Progress Bar */}
                {isUploadingMedia && (
                  <div className="mt-3">
                    <div className="flex justify-between text-xs text-gray-600 mb-1">
                      <span>Uploading...</span>
                      <span>{uploadProgress.toFixed(1)}%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div 
                        className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                        style={{ width: `${uploadProgress}%` }}
                      ></div>
                    </div>
                  </div>
                )}
              </div>
            )}
            
            {/* File Type Info */}
            <div className="text-xs text-gray-500">
              <p>Supported formats: JPG, PNG, GIF, MP3, WAV, MP4, PDF, DOC, TXT (Max 5MB per file)</p>
            </div>
          </div>
        )}

        {/* Hidden audio element for peer connections */}
        <audio ref={audioRef} autoPlay className="hidden" />
      </div>
    </div>
  );
};

export default AudioRoomComponent;

