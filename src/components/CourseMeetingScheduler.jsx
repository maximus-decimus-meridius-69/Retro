import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { auth, createMeeting, getMeetings } from '../firebase';
import {
  Calendar,
  Clock,
  Users,
  Video,
  Plus,
  Edit3,
  Trash2,
  Play,
  Eye,
  AlertCircle,
  CheckCircle,
  X
} from 'lucide-react';

const CourseMeetingScheduler = ({ courseId, courseTitle, enrolledEmails = [], isHost = false, onMeetingScheduled }) => {
  const [meetings, setMeetings] = useState([]);
  const [showScheduleForm, setShowScheduleForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    scheduledTime: ''
  });
  const [error, setError] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [uploadingMeeting, setUploadingMeeting] = useState(null);
  const [meetingMaterials, setMeetingMaterials] = useState({});
  
  const currentUser = auth.currentUser;
  const navigate = useNavigate();
  
  useEffect(() => {
    if (courseId) {
      loadMeetings();
    }
  }, [courseId]);
  
  const loadMeetings = async () => {
    try {
      setLoading(true);
      console.log('Loading meetings for course:', courseId);
      const meetingsData = await getMeetings(courseId);
      console.log('Loaded meetings:', meetingsData);
      setMeetings(meetingsData);
    } catch (error) {
      console.error('Error loading meetings:', error);
    } finally {
      setLoading(false);
    }
  };
  
  const handleScheduleMeeting = async (e) => {
    e.preventDefault();
    
    if (isCreating) return; // Prevent double submission
    
    if (!formData.title.trim() || !formData.scheduledTime) {
      setError('Please fill in all required fields');
      return;
    }
    
    // Check if scheduled time is in the future
    const scheduledDate = new Date(formData.scheduledTime);
    if (scheduledDate <= new Date()) {
      setError('Scheduled time must be in the future');
      return;
    }
    
    try {
      setIsCreating(true);
      const meetingData = {
        courseId: courseId,
        title: formData.title,
        description: formData.description,
        scheduledTime: scheduledDate,
        hostId: currentUser.uid,
        hostName: currentUser.displayName || currentUser.email,
        hostEmail: currentUser.email,
        allowedEmails: enrolledEmails,
        isActive: false,
        participants: [currentUser.uid, ...enrolledEmails.map((email, index) => `user_${index}`)] // Placeholder for user IDs
      };
      
      console.log('Creating meeting with data:', meetingData);
      const meetingId = await createMeeting(meetingData);
      console.log('Meeting created with ID:', meetingId);
      
      // Add the new meeting to the list with the ID
      const newMeeting = { id: meetingId, ...meetingData };
      console.log('Adding new meeting to list:', newMeeting);
      setMeetings(prev => [...prev, newMeeting]);
      setShowScheduleForm(false);
      setFormData({ title: '', description: '', scheduledTime: '' });
      setError('');
      
      if (onMeetingScheduled) {
        onMeetingScheduled(newMeeting);
      }
    } catch (error) {
      console.error('Error scheduling meeting:', error);
      setError('Failed to schedule meeting. Please try again.');
    } finally {
      setIsCreating(false);
    }
  };
  
  const startMeeting = async (meetingId) => {
    try {
      // Navigate to meeting room directly - the meeting room will handle starting the meeting
      navigate(`/meeting/${meetingId}`);
    } catch (error) {
      console.error('Error starting meeting:', error);
      alert('Failed to start meeting. Please try again.');
    }
  };
  
  const joinMeeting = (meetingId) => {
    navigate(`/meeting/${meetingId}`);
  };
  
  const deleteMeeting = async (meetingId) => {
    if (!confirm('Are you sure you want to delete this meeting?')) {
      return;
    }
    
    try {
      // Import deleteDoc and doc from firebase/firestore
      const { deleteDoc, doc } = await import('firebase/firestore');
      const { db } = await import('../firebase');
      
      // Delete from Firebase
      await deleteDoc(doc(db, 'meetings', meetingId));
      
      // Remove from UI
      setMeetings(prev => prev.filter(m => m.id !== meetingId));
      
      alert('Meeting deleted successfully');
    } catch (error) {
      console.error('Error deleting meeting:', error);
      alert('Failed to delete meeting');
    }
  };
  
  const formatDate = (dateString) => {
    // Handle Firebase Timestamp objects
    if (dateString && typeof dateString.toDate === 'function') {
      return dateString.toDate().toLocaleString();
    }
    return new Date(dateString).toLocaleString();
  };
  
  const uploadMaterialToMeeting = async (meetingId, file, title) => {
    try {
      setUploadingMeeting(meetingId);
      
      // Import Firebase storage functions
      const { ref, uploadBytes, getDownloadURL } = await import('firebase/storage');
      const { storage } = await import('../firebase');
      const { addDoc, collection, serverTimestamp } = await import('firebase/firestore');
      const { db } = await import('../firebase');
      
      // Upload file to Firebase Storage
      const filePath = `meetingMaterials/${meetingId}/${Date.now()}-${file.name}`;
      const fileRef = ref(storage, filePath);
      await uploadBytes(fileRef, file);
      const fileUrl = await getDownloadURL(fileRef);
      
      // Save material info to Firestore
      await addDoc(collection(db, 'meetingMaterials'), {
        meetingId,
        title: title || file.name,
        fileName: file.name,
        fileUrl,
        filePath,
        uploaderId: currentUser.uid,
        uploaderName: currentUser.displayName || currentUser.email,
        createdAt: serverTimestamp()
      });
      
      // Update local state
      if (!meetingMaterials[meetingId]) {
        setMeetingMaterials(prev => ({ ...prev, [meetingId]: [] }));
      }
      
      alert('Material uploaded successfully');
      
    } catch (error) {
      console.error('Error uploading material:', error);
      alert('Failed to upload material');
    } finally {
      setUploadingMeeting(null);
    }
  };
  
  const handleFileUpload = (meetingId) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '*/*';
    input.onchange = (e) => {
      const file = e.target.files[0];
      if (file) {
        const title = prompt('Enter a title for this material (optional):');
        uploadMaterialToMeeting(meetingId, file, title);
      }
    };
    input.click();
  };
  
  const getMeetingStatus = (meeting) => {
    const now = new Date();
    let scheduledTime;
    
    // Handle Firebase Timestamp objects
    if (meeting.scheduledTime && typeof meeting.scheduledTime.toDate === 'function') {
      scheduledTime = meeting.scheduledTime.toDate();
    } else {
      scheduledTime = new Date(meeting.scheduledTime);
    }
    
    const timeDiff = scheduledTime - now;
    
    if (meeting.isActive) {
      return { status: 'live', label: 'Live Now', color: 'text-green-400' };
    } else if (timeDiff > 0 && timeDiff <= 15 * 60 * 1000) { // Within 15 minutes
      return { status: 'starting-soon', label: 'Starting Soon', color: 'text-yellow-400' };
    } else if (timeDiff > 0) {
      return { status: 'scheduled', label: 'Scheduled', color: 'text-blue-400' };
    } else {
      return { status: 'ended', label: 'Ended', color: 'text-gray-400' };
    }
  };
  
  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-1/4 mb-4"></div>
          <div className="space-y-3">
            <div className="h-20 bg-gray-200 rounded"></div>
            <div className="h-20 bg-gray-200 rounded"></div>
          </div>
        </div>
      </div>
    );
  }
  
  return (
    <div className="bg-white rounded-lg shadow">
      {/* Header */}
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Video className="w-5 h-5 text-purple-600" />
            <h2 className="text-lg font-semibold text-gray-800">Course Meetings</h2>
          </div>
          
          {isHost && (
            <button
              onClick={() => setShowScheduleForm(true)}
              className="flex items-center space-x-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
            >
              <Plus className="w-4 h-4" />
              <span>Schedule Meeting</span>
            </button>
          )}
        </div>
      </div>
      
      {/* Meeting Schedule Form */}
      {showScheduleForm && (
        <div className="p-6 border-b border-gray-200 bg-gray-50">
          <form onSubmit={handleScheduleMeeting} className="space-y-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium text-gray-800">Schedule New Meeting</h3>
              <button
                type="button"
                onClick={() => {
                  setShowScheduleForm(false);
                  setError('');
                  setFormData({ title: '', description: '', scheduledTime: '' });
                }}
                className="p-2 hover:bg-gray-200 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            
            {error && (
              <div className="flex items-center space-x-2 p-3 bg-red-100 border border-red-300 rounded-lg text-red-700">
                <AlertCircle className="w-4 h-4" />
                <span className="text-sm">{error}</span>
              </div>
            )}
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Meeting Title *
                </label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                  placeholder="e.g., Week 1: Introduction to React"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Scheduled Time *
                </label>
                <input
                  type="datetime-local"
                  value={formData.scheduledTime}
                  onChange={(e) => setFormData(prev => ({ ...prev, scheduledTime: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                  required
                  min={new Date().toISOString().slice(0, 16)}
                />
              </div>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Description
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Optional meeting description or agenda..."
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>
            
            <div className="flex items-center justify-between pt-4">
              <div className="text-sm text-gray-600">
                <Users className="w-4 h-4 inline mr-1" />
                {enrolledEmails.length} students will be notified
              </div>
              
              <div className="flex space-x-3">
                <button
                  type="button"
                  onClick={() => setShowScheduleForm(false)}
                  className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isCreating}
                  className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:bg-gray-400"
                >
                  {isCreating ? 'Creating...' : 'Schedule Meeting'}
                </button>
              </div>
            </div>
          </form>
        </div>
      )}
      
      {/* Meetings List */}
      <div className="p-6">
        {meetings.length === 0 ? (
          <div className="text-center py-8">
            <Video className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500 mb-2">No meetings scheduled yet</p>
            {isHost && (
              <p className="text-sm text-gray-400">
                Click "Schedule Meeting" to create your first meeting
              </p>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {meetings
              .sort((a, b) => {
                const dateA = a.scheduledTime?.toDate ? a.scheduledTime.toDate() : new Date(a.scheduledTime);
                const dateB = b.scheduledTime?.toDate ? b.scheduledTime.toDate() : new Date(b.scheduledTime);
                return dateA - dateB;
              })
              .map((meeting) => {
                const status = getMeetingStatus(meeting);
                return (
                  <div key={meeting.id} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-3 mb-2">
                          <h3 className="font-medium text-gray-800">{meeting.title}</h3>
                          <span className={`text-xs px-2 py-1 rounded-full bg-opacity-10 ${
                            status.status === 'live' ? 'bg-green-500 text-green-700' :
                            status.status === 'starting-soon' ? 'bg-yellow-500 text-yellow-700' :
                            status.status === 'scheduled' ? 'bg-blue-500 text-blue-700' :
                            'bg-gray-500 text-gray-700'
                          }`}>
                            {status.label}
                          </span>
                          
                          {meeting.isRecording && (
                            <div className="flex items-center space-x-1 text-red-500">
                              <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
                              <span className="text-xs">Recording</span>
                            </div>
                          )}
                        </div>
                        
                        {meeting.description && (
                          <p className="text-gray-600 text-sm mb-2">{meeting.description}</p>
                        )}
                        
                        <div className="flex items-center space-x-4 text-sm text-gray-500">
                          <div className="flex items-center space-x-1">
                            <Calendar className="w-4 h-4" />
                            <span>{formatDate(meeting.scheduledTime)}</span>
                          </div>
                          
                          <div className="flex items-center space-x-1">
                            <Users className="w-4 h-4" />
                            <span>{meeting.allowedEmails.length} invited</span>
                          </div>
                          
                          {meeting.recordingUrl && (
                            <div className="flex items-center space-x-1 text-purple-600">
                              <Eye className="w-4 h-4" />
                              <span>Recording available</span>
                            </div>
                          )}
                        </div>
                      </div>
                      
                      <div className="flex items-center space-x-2 ml-4">
                        {/* Upload Material Button - Always visible for hosts */}
                        {isHost && (
                          <button
                            onClick={() => handleFileUpload(meeting.id)}
                            disabled={uploadingMeeting === meeting.id}
                            className="p-2 text-purple-600 hover:bg-purple-50 rounded-lg disabled:opacity-50"
                            title="Upload material to meeting"
                          >
                            {uploadingMeeting === meeting.id ? (
                              <div className="animate-spin w-4 h-4 border-2 border-purple-600 border-t-transparent rounded-full"></div>
                            ) : (
                              <Plus className="w-4 h-4" />
                            )}
                          </button>
                        )}
                        
                        {/* Meeting Action Buttons */}
                        {isHost && status.status === 'scheduled' && (
                          <>
                            <button
                              onClick={() => startMeeting(meeting.id)}
                              className="flex items-center space-x-1 px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                            >
                              <Play className="w-4 h-4" />
                              <span>Start</span>
                            </button>
                            
                            <button
                              onClick={() => deleteMeeting(meeting.id)}
                              className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                              title="Delete meeting"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </>
                        )}
                        
                        {/* Delete button for ended meetings */}
                        {isHost && status.status === 'ended' && (
                          <button
                            onClick={() => deleteMeeting(meeting.id)}
                            className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                            title="Delete meeting"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                        
                        {isHost && status.status === 'live' && (
                          <button
                            onClick={() => joinMeeting(meeting.id)}
                            className="flex items-center space-x-1 px-3 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
                          >
                            <Video className="w-4 h-4" />
                            <span>Join</span>
                          </button>
                        )}
                        
                        {!isHost && (status.status === 'live' || status.status === 'starting-soon') && (
                          <button
                            onClick={() => joinMeeting(meeting.id)}
                            className="flex items-center space-x-1 px-3 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
                          >
                            <Video className="w-4 h-4" />
                            <span>Join</span>
                          </button>
                        )}
                        
                        {meeting.recordingUrl && (
                          <a
                            href={`http://localhost:3001${meeting.recordingUrl}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center space-x-1 px-3 py-2 border border-purple-600 text-purple-600 rounded-lg hover:bg-purple-50"
                          >
                            <Eye className="w-4 h-4" />
                            <span>Watch</span>
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
          </div>
        )}
      </div>
    </div>
  );
};

export default CourseMeetingScheduler;