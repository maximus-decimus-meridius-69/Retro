import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { auth, createMeeting, getMeetings } from '../firebase';
import {
  Calendar,
  Clock,
  Users,
  Video,
  Plus,
  Trash2,
  Play,
  Eye,
  AlertCircle,
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
  const [expandedMeeting, setExpandedMeeting] = useState(null);
  const [uploadStates, setUploadStates] = useState({});

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
      const meetingsData = await getMeetings(courseId);
      setMeetings(meetingsData);
    } catch (error) {
      console.error('Error loading meetings:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleScheduleMeeting = async (e) => {
    e.preventDefault();

    if (isCreating) return;

    if (!formData.title.trim() || !formData.scheduledTime) {
      setError('Please fill in all required fields');
      return;
    }

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
        participants: []
      };

      const meetingId = await createMeeting(meetingData);
      const newMeeting = { id: meetingId, ...meetingData };
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

  const startMeeting = (meetingId) => {
    navigate(`/meeting/${meetingId}`);
  };

  const joinMeeting = (meetingId) => {
    navigate(`/meeting/${meetingId}`);
  };

  const deleteMeeting = async (meetingId) => {
    if (!confirm('Are you sure you want to delete this meeting?')) {
      return;
    }

    try {
      const { deleteDoc, doc } = await import('firebase/firestore');
      const { db } = await import('../firebase');

      await deleteDoc(doc(db, 'meetings', meetingId));
      setMeetings(prev => prev.filter(m => m.id !== meetingId));

      alert('Meeting deleted successfully');
    } catch (error) {
      console.error('Error deleting meeting:', error);
      alert('Failed to delete meeting');
    }
  };

  const uploadMaterial = async (meetingId, file, title) => {
    try {
      const { ref, uploadBytes, getDownloadURL } = await import('firebase/storage');
      const { storage } = await import('../firebase');
      const { addDoc, collection, serverTimestamp } = await import('firebase/firestore');
      const { db } = await import('../firebase');

      const filePath = `meetingMaterials/${meetingId}/${Date.now()}-${file.name}`;
      const fileRef = ref(storage, filePath);
      await uploadBytes(fileRef, file);
      const fileUrl = await getDownloadURL(fileRef);

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

      alert('Material uploaded successfully!');
    } catch (error) {
      console.error('Error uploading material:', error);
      alert('Failed to upload material');
    }
  };

  const formatDate = (dateString) => {
    if (dateString && typeof dateString.toDate === 'function') {
      return dateString.toDate().toLocaleString();
    }
    return new Date(dateString).toLocaleString();
  };

  const getMeetingStatus = (meeting) => {
    const now = new Date();
    let scheduledTime;

    if (meeting.scheduledTime && typeof meeting.scheduledTime.toDate === 'function') {
      scheduledTime = meeting.scheduledTime.toDate();
    } else {
      scheduledTime = new Date(meeting.scheduledTime);
    }

    const timeDiff = scheduledTime - now;

    // Check if host has ended the meeting
    if (meeting.endedAt) {
      return { status: 'ended', label: 'Ended', color: 'bg-gray-500' };
    }

    if (meeting.isActive) {
      return { status: 'live', label: 'Live Now', color: 'bg-green-500' };
    } else if (timeDiff > 0 && timeDiff <= 15 * 60 * 1000) {
      return { status: 'starting-soon', label: 'Starting Soon', color: 'bg-yellow-500' };
    } else {
      return { status: 'scheduled', label: 'Scheduled', color: 'bg-blue-500' };
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-1/4 mb-4"></div>
          <div className="space-y-3">
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
                  placeholder="e.g., Week 1: Introduction"
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
                const isExpanded = expandedMeeting === meeting.id;
                const uploadState = uploadStates[meeting.id] || { file: null, title: '', uploading: false };

                const setUploadFile = (file) => {
                  setUploadStates(prev => ({
                    ...prev,
                    [meeting.id]: { ...prev[meeting.id], file }
                  }));
                };

                const setUploadTitle = (title) => {
                  setUploadStates(prev => ({
                    ...prev,
                    [meeting.id]: { ...prev[meeting.id], title }
                  }));
                };

                const setUploading = (uploading) => {
                  setUploadStates(prev => ({
                    ...prev,
                    [meeting.id]: { ...prev[meeting.id], uploading }
                  }));
                };

                return (
                  <div key={meeting.id} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <div className="flex items-center space-x-3 mb-2">
                          <h3 className="font-medium text-gray-800">{meeting.title}</h3>
                          <span className={`text-xs px-2 py-1 rounded-full text-white ${status.color}`}>
                            {status.label}
                          </span>
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
                            <span>{meeting.allowedEmails?.length || 0} invited</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center space-x-2 ml-4">
                        {/* Host can always start */}
                        {isHost && status.status !== 'ended' && (
                          <button
                            onClick={() => startMeeting(meeting.id)}
                            className="flex items-center space-x-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium"
                          >
                            <Play className="w-4 h-4" />
                            <span>Start Meeting</span>
                          </button>
                        )}

                        {/* Students can join when live or starting soon */}
                        {!isHost && (status.status === 'live' || status.status === 'starting-soon') && (
                          <button
                            onClick={() => joinMeeting(meeting.id)}
                            className="flex items-center space-x-1 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 font-medium"
                          >
                            <Video className="w-4 h-4" />
                            <span>Join Meeting</span>
                          </button>
                        )}

                        {/* Delete button */}
                        {isHost && (
                          <button
                            onClick={() => deleteMeeting(meeting.id)}
                            className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                            title="Delete meeting"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Materials Section - Only for host */}
                    {isHost && (
                      <div className="mt-3 pt-3 border-t">
                        <button
                          onClick={() => setExpandedMeeting(isExpanded ? null : meeting.id)}
                          className="text-sm text-purple-600 hover:text-purple-700 font-medium flex items-center gap-1"
                        >
                          {isExpanded ? '− Hide Materials Upload' : '+ Upload Materials'}
                        </button>

                        {isExpanded && (
                          <div className="mt-3 p-4 bg-gray-50 rounded border border-gray-200">
                            <div className="space-y-3">
                              <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                  Material Title (optional)
                                </label>
                                <input
                                  type="text"
                                  value={uploadState.title}
                                  onChange={(e) => setUploadTitle(e.target.value)}
                                  placeholder="e.g., Lecture Slides, Assignment 1"
                                  className="w-full border rounded px-3 py-2 text-sm"
                                />
                              </div>
                              <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                  Select File
                                </label>
                                <input
                                  type="file"
                                  onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                                  className="w-full text-sm"
                                />
                              </div>
                              <button
                                disabled={!uploadState.file || uploadState.uploading}
                                onClick={async () => {
                                  if (!uploadState.file) return;
                                  setUploading(true);
                                  await uploadMaterial(meeting.id, uploadState.file, uploadState.title || uploadState.file.name);
                                  setUploadFile(null);
                                  setUploadTitle('');
                                  setUploading(false);
                                }}
                                className="w-full px-4 py-2 rounded bg-purple-600 text-white disabled:bg-gray-300 text-sm font-medium hover:bg-purple-700"
                              >
                                {uploadState.uploading ? 'Uploading...' : 'Upload Material'}
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
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
