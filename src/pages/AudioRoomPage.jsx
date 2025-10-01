import React from 'react';
import { useParams } from 'react-router-dom';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth } from '../firebase';
import AudioRoomComponent from '../components/AudioRoomComponent';

const AudioRoomPage = () => {
  const { roomId } = useParams();
  const [user] = useAuthState(auth);
  
  if (!user) {
    return <div>Please log in to join the room.</div>;
  }

  return (
    <div>
      <h1>Audio Room Page</h1>
      <AudioRoomComponent 
        roomId={roomId} 
        userId={user.uid} 
        userName={user.displayName || user.email} 
        isHost={false} 
      />
    </div>
  );
};

export default AudioRoomPage;

