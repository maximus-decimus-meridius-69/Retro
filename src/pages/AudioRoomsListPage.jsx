import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth } from '../firebase';
import io from 'socket.io-client';

const AudioRoomsListPage = () => {
  const [audioRooms, setAudioRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [user] = useAuthState(auth);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    // Handle browser back button navigation
    const handlePopState = (event) => {
      // When back button is pressed in audio rooms list
      if (location.pathname === '/audio-rooms') {
        // Navigate to home page
        navigate('/home', { replace: true });
      }
    };

    // Replace current history state
    window.history.replaceState({ audioRoomsList: true }, '', window.location.href);
    
    // Add popstate listener
    window.addEventListener('popstate', handlePopState);

    fetchAudioRooms();
    
    // Connect to socket for real-time updates
    const socket = io.connect('http://localhost:3001');
    
    socket.on('connect', () => {
      console.log('AudioRoomsListPage connected to socket:', socket.id);
    });
    
    // Listen for room closed events
    socket.on('room-closed', ({ roomId }) => {
      console.log(`Room ${roomId} was closed, removing from list`);
      // Remove the closed room from the list
      setAudioRooms(prev => {
        const updated = prev.filter(room => room.id !== roomId);
        console.log(`Rooms updated: ${prev.length} -> ${updated.length}`);
        return updated;
      });
    });
    
    socket.on('disconnect', () => {
      console.log('AudioRoomsListPage disconnected from socket');
    });
    
    // Cleanup socket connection
    return () => {
      window.removeEventListener('popstate', handlePopState);
      console.log('Cleaning up socket connection');
      socket.disconnect();
    };
  }, [location.pathname, navigate]);

  const fetchAudioRooms = async () => {
    try {
      setLoading(true);
      const response = await fetch('http://localhost:3001/api/audio-rooms');
      if (!response.ok) {
        throw new Error('Failed to fetch audio rooms');
      }
      const data = await response.json();
      setAudioRooms(data);
      setError(null);
    } catch (err) {
      setError(err.message);
      console.error('Error fetching audio rooms:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleJoinRoom = (roomId) => {
    // Use replace to avoid creating multiple history entries
    navigate(`/audio-room/${roomId}`, { replace: true });
  };

  const handleCreateRoom = async () => {
    if (!user) {
      navigate('/login');
      return;
    }

    const roomTitle = prompt('Enter room title:');
    if (!roomTitle) return;

    const roomDescription = prompt('Enter room description (optional):') || '';

    try {
      const response = await fetch('http://localhost:3001/api/audio-rooms', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: roomTitle,
          description: roomDescription,
          host_id: user.uid,
          host_name: user.displayName || user.email,
          max_participants: 10,
          allow_chat: true,
          allow_media: false
        })
      });

      if (response.ok) {
        const newRoom = await response.json();
        setAudioRooms(prev => [newRoom, ...prev]);
        navigate(`/audio-room/${newRoom.id}`);
      } else {
        throw new Error('Failed to create room');
      }
    } catch (err) {
      alert('Error creating room: ' + err.message);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen p-8 bg-gradient-to-br from-yellow-50 via-pink-100 to-purple-200">
        <div className="max-w-4xl mx-auto">
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Loading audio rooms...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-8 bg-gradient-to-br from-yellow-50 via-pink-100 to-purple-200">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-4xl font-bold text-purple-800 mb-2">🎤 Audio Rooms</h1>
            <p className="text-gray-600">Join or create audio rooms to collaborate with other musicians</p>
          </div>
          <div className="flex gap-4">
            <button
              onClick={() => navigate('/home')}
              className="bg-white border border-purple-600 text-purple-700 hover:bg-purple-50 font-medium px-4 py-2 rounded-lg shadow"
            >
              ← Back to Home
            </button>
            <button
              onClick={fetchAudioRooms}
              className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-4 py-2 rounded-lg shadow transition"
            >
              🔄 Refresh
            </button>
            <button
              onClick={handleCreateRoom}
              className="bg-green-600 hover:bg-green-700 text-white font-semibold px-6 py-2 rounded-lg shadow transition"
            >
              + Create Room
            </button>
          </div>
        </div>

        {/* Error State */}
        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-6">
            <strong>Error:</strong> {error}
            <button 
              onClick={fetchAudioRooms}
              className="ml-4 text-red-600 underline hover:text-red-800"
            >
              Try Again
            </button>
          </div>
        )}

        {/* Rooms List */}
        {audioRooms.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-6xl mb-4">🎵</div>
            <h3 className="text-xl font-semibold text-gray-700 mb-2">No Audio Rooms Available</h3>
            <p className="text-gray-600 mb-6">Be the first to create an audio room and start collaborating!</p>
            <button
              onClick={handleCreateRoom}
              className="bg-green-600 hover:bg-green-700 text-white font-semibold px-6 py-3 rounded-lg shadow transition"
            >
              Create Your First Room
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {audioRooms.map(room => (
              <div key={room.id} className="bg-white bg-opacity-70 backdrop-blur-md rounded-2xl shadow-md hover:shadow-lg transition duration-300 p-6">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="text-xl font-semibold text-gray-800 mb-1">{room.title}</h3>
                    <p className="text-sm text-gray-600">Host: {room.host_name}</p>
                  </div>
                  <div className="flex items-center space-x-2">
                    {room.allow_chat && <span className="text-green-500" title="Chat enabled">💬</span>}
                    {room.allow_media && <span className="text-blue-500" title="Media sharing enabled">📷</span>}
                  </div>
                </div>
                
                {room.description && (
                  <p className="text-gray-600 text-sm mb-4 line-clamp-2">{room.description}</p>
                )}
                
                <div className="flex items-center justify-between mb-4">
                  <span className="text-xs text-gray-500">
                    Max: {room.max_participants} participants
                  </span>
                  <span className="text-xs text-gray-500">
                    Created: {new Date(room.created_at).toLocaleDateString()}
                  </span>
                </div>
                
                <button
                  onClick={() => handleJoinRoom(room.id)}
                  className="w-full bg-purple-600 hover:bg-purple-700 text-white font-semibold py-2 rounded-lg shadow transition"
                >
                  Join Room
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default AudioRoomsListPage;

