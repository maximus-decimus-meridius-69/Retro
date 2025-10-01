import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { auth, getMeetingById, getCourseById } from '../firebase';

// Simple meeting room that uses Jitsi Meet for now
const SimpleMeetingRoom = () => {
  const { meetingId } = useParams();
  const navigate = useNavigate();
  const containerRef = useRef(null);
  const [meeting, setMeeting] = useState(null);
  const [course, setCourse] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const canJoin = useMemo(() => {
    if (!meeting || !course) {
      console.log('Cannot join - missing data:', { meeting: !!meeting, course: !!course });
      return false;
    }
    const uid = auth.currentUser?.uid;
    const isCreator = course.creatorId === uid;
    const isEnrolled = (course.enrolledUsers || []).includes(uid);
    
    console.log('Access check:', {
      uid,
      courseCreatorId: course.creatorId,
      isCreator,
      enrolledUsers: course.enrolledUsers,
      isEnrolled,
      canJoin: isCreator || isEnrolled
    });
    
    return isCreator || isEnrolled;
  }, [meeting, course]);

  useEffect(() => {
    const load = async () => {
      try {
        console.log('Loading meeting with ID:', meetingId);
        const m = await getMeetingById(meetingId);
        console.log('Meeting data:', m);
        
        if (!m) {
          setError('Meeting not found');
          return;
        }
        
        setMeeting(m);
        console.log('Loading course with ID:', m.courseId);
        const c = await getCourseById(m.courseId);
        console.log('Course data:', c);
        console.log('Current user ID:', auth.currentUser?.uid);
        console.log('Course creator ID:', c?.creatorId);
        console.log('Enrolled users:', c?.enrolledUsers);
        
        if (c) {
          setCourse(c);
        }
      } catch (error) {
        console.error('Error loading meeting:', error);
        setError(`Error loading meeting: ${error.message}`);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [meetingId]);

  useEffect(() => {
    console.log('Meeting room effect triggered:', { canJoin, meeting: !!meeting });
    
    if (!canJoin || !meeting) {
      console.log('Skipping Jitsi initialization - access denied or no meeting data');
      return;
    }
    
    console.log('Initializing Jitsi for meeting:', meeting.id);
    
    // Load Jitsi script
    const existing = document.getElementById('jitsi-script');
    const ensureScript = () => new Promise((resolve) => {
      if (existing) {
        console.log('Jitsi script already loaded');
        return resolve();
      }
      
      console.log('Loading Jitsi script...');
      const s = document.createElement('script');
      s.id = 'jitsi-script';
      s.src = 'https://meet.jit.si/external_api.js';
      s.onload = () => {
        console.log('Jitsi script loaded successfully');
        resolve();
      };
      s.onerror = () => {
        console.error('Failed to load Jitsi script');
        setError('Failed to load meeting interface. Please check your internet connection.');
        resolve();
      };
      document.body.appendChild(s);
    });

    let api;
    ensureScript().then(() => {
      if (!window.JitsiMeetExternalAPI) {
        console.error('JitsiMeetExternalAPI not available');
        setError('Meeting interface failed to load. Please refresh and try again.');
        return;
      }
      
      try {
        console.log('Creating Jitsi meeting interface...');
        const roomName = `course-${meeting.courseId}-meeting-${meeting.id}`;
        console.log('Room name:', roomName);
        console.log('Container ref:', containerRef.current);
        
        if (!containerRef.current) {
          console.error('Container element not found');
          setError('Meeting container not ready');
          return;
        }
        
        // eslint-disable-next-line no-undef
        api = new JitsiMeetExternalAPI('meet.jit.si', {
          roomName,
          parentNode: containerRef.current,
          width: '100%',
          height: '100%',
          userInfo: { 
            displayName: auth.currentUser?.displayName || auth.currentUser?.email || 'User' 
          },
          configOverwrite: { 
            prejoinPageEnabled: false,
            disableDeepLinking: true,
            startWithAudioMuted: true,
            startWithVideoMuted: true
          },
          interfaceConfigOverwrite: {
            SHOW_JITSI_WATERMARK: false,
            SHOW_WATERMARK_FOR_GUESTS: false,
            TOOLBAR_BUTTONS: [
              'microphone', 'camera', 'closedcaptions', 'desktop', 'fullscreen',
              'fodeviceselection', 'hangup', 'profile', 'chat', 'recording',
              'livestreaming', 'etherpad', 'sharedvideo', 'settings', 'raisehand',
              'videoquality', 'filmstrip', 'invite', 'feedback', 'stats', 'shortcuts',
              'tileview', 'videobackgroundblur', 'download', 'help', 'mute-everyone'
            ]
          },
        });

        api.addEventListener('readyToClose', () => {
          console.log('Meeting ended, navigating back to courses');
          navigate('/courses');
        });
        
        api.addEventListener('videoConferenceJoined', () => {
          console.log('Successfully joined the meeting');
        });
        
        api.addEventListener('videoConferenceLeft', () => {
          console.log('Left the meeting');
        });
        
        console.log('Jitsi API initialized successfully');

      } catch (err) {
        console.error('Error initializing Jitsi:', err);
        setError(`Failed to initialize meeting: ${err.message}`);
      }
    }).catch(err => {
      console.error('Error in ensureScript:', err);
      setError('Failed to load meeting interface');
    });

    return () => {
      console.log('Cleaning up Jitsi API');
      try { 
        if (api) api.dispose(); 
      } catch (_) {}
    };
  }, [canJoin, meeting, navigate]);

  useEffect(() => {
    if (meeting && course && !canJoin) {
      setError('You must be enrolled in this course to join this meeting.');
    }
  }, [meeting, course, canJoin]);

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
        <div className="text-center">
          <div className="bg-white rounded-lg p-8 max-w-md mx-auto">
            <h2 className="text-2xl font-bold text-red-600 mb-4">Access Denied</h2>
            <p className="text-gray-700 mb-6">{error}</p>
            <button
              onClick={() => navigate('/courses')}
              className="px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
            >
              Back to Courses
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!canJoin) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="bg-white rounded-lg p-8 max-w-md mx-auto">
            <h2 className="text-2xl font-bold text-orange-600 mb-4">Enrollment Required</h2>
            <p className="text-gray-700 mb-6">
              You need to be enrolled in this course to join the meeting.
            </p>
            <button
              onClick={() => navigate(`/course/${course?.id}`)}
              className="px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 mr-3"
            >
              Go to Course
            </button>
            <button
              onClick={() => navigate('/courses')}
              className="px-6 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
            >
              All Courses
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900">
      {/* Header */}
      <div className="bg-gray-800 px-6 py-4 border-b border-gray-700">
        <div className="flex items-center justify-between text-white">
          <div>
            <h1 className="text-xl font-semibold">{meeting?.title}</h1>
            <p className="text-gray-300 text-sm">
              {meeting?.scheduledTime?.toDate ? 
                meeting.scheduledTime.toDate().toLocaleString() : 
                new Date(meeting?.scheduledTime).toLocaleString()
              }
            </p>
          </div>
          
          <button
            onClick={() => navigate('/courses')}
            className="px-4 py-2 bg-red-600 hover:bg-red-700 rounded-lg"
          >
            Leave Meeting
          </button>
        </div>
      </div>

      {/* Meeting Container */}
      <div 
        ref={containerRef} 
        style={{ 
          height: 'calc(100vh - 80px)', 
          width: '100%', 
          background: '#000' 
        }} 
      />
    </div>
  );
};

export default SimpleMeetingRoom;