import React, { useState, useEffect } from 'react';
import { auth } from '../firebase';
import MeetingRecordingPlayer from './MeetingRecordingPlayer';
import {
  BarChart3,
  Calendar,
  Clock,
  CheckCircle,
  PlayCircle,
  Eye,
  Award,
  TrendingUp,
  BookOpen,
  Target,
  Star
} from 'lucide-react';

const CourseProgressDashboard = ({ courseId, courseTitle }) => {
  const [progress, setProgress] = useState(null);
  const [selectedRecording, setSelectedRecording] = useState(null);
  const [loading, setLoading] = useState(true);
  
  const currentUser = auth.currentUser;
  
  useEffect(() => {
    if (courseId && currentUser) {
      loadProgress();
    }
  }, [courseId, currentUser]);
  
  const loadProgress = async () => {
    try {
      setLoading(true);
      const response = await fetch(`http://localhost:3001/api/courses/${courseId}/progress/${currentUser.uid}`);
      if (response.ok) {
        const progressData = await response.json();
        setProgress(progressData);
      }
    } catch (error) {
      console.error('Error loading progress:', error);
    } finally {
      setLoading(false);
    }
  };
  
  const handleProgressUpdate = (meetingId, progressInfo) => {
    setProgress(prev => ({
      ...prev,
      meetings: prev.meetings.map(meeting => 
        meeting.meetingId === meetingId 
          ? { ...meeting, progress: progressInfo }
          : meeting
      )
    }));
  };
  
  const getProgressLevel = (percentage) => {
    if (percentage >= 90) return { level: 'Excellent', color: 'text-green-600', bgColor: 'bg-green-100' };
    if (percentage >= 70) return { level: 'Good', color: 'text-blue-600', bgColor: 'bg-blue-100' };
    if (percentage >= 50) return { level: 'Fair', color: 'text-yellow-600', bgColor: 'bg-yellow-100' };
    return { level: 'Needs Improvement', color: 'text-red-600', bgColor: 'bg-red-100' };
  };
  
  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString();
  };
  
  const formatDuration = (seconds) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    
    if (hours > 0) {
      return `${hours}h ${minutes}m ${remainingSeconds}s`;
    }
    return `${minutes}m ${remainingSeconds}s`;
  };
  
  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <div className="animate-pulse">
          <div className="h-6 bg-gray-200 rounded w-1/3 mb-6"></div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-24 bg-gray-200 rounded"></div>
            ))}
          </div>
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-20 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }
  
  if (!progress) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <div className="text-center py-8">
          <BookOpen className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500">No progress data available yet</p>
        </div>
      </div>
    );
  }
  
  const progressLevel = getProgressLevel(progress.overallProgress);
  
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold text-gray-800">Course Progress</h2>
            <p className="text-gray-600">{courseTitle}</p>
          </div>
          
          <div className={`px-4 py-2 rounded-full ${progressLevel.bgColor}`}>
            <span className={`font-medium ${progressLevel.color}`}>
              {progressLevel.level}
            </span>
          </div>
        </div>
        
        {/* Overall Progress Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="text-center">
            <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-2">
              <Target className="w-8 h-8 text-purple-600" />
            </div>
            <div className="text-2xl font-bold text-gray-800">{progress.overallProgress}%</div>
            <div className="text-sm text-gray-600">Overall Progress</div>
          </div>
          
          <div className="text-center">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-2">
              <CheckCircle className="w-8 h-8 text-green-600" />
            </div>
            <div className="text-2xl font-bold text-gray-800">
              {progress.completedMeetings} / {progress.totalMeetings}
            </div>
            <div className="text-sm text-gray-600">Meetings Completed</div>
          </div>
          
          <div className="text-center">
            <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-2">
              <Clock className="w-8 h-8 text-blue-600" />
            </div>
            <div className="text-2xl font-bold text-gray-800">
              {formatDuration(progress.meetings.reduce((total, m) => total + m.progress.watchedDuration, 0))}
            </div>
            <div className="text-sm text-gray-600">Total Watch Time</div>
          </div>
          
          <div className="text-center">
            <div className="w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-2">
              <TrendingUp className="w-8 h-8 text-yellow-600" />
            </div>
            <div className="text-2xl font-bold text-gray-800">
              {progress.meetings.filter(m => m.progress.progressPercentage > 0).length}
            </div>
            <div className="text-sm text-gray-600">Meetings Started</div>
          </div>
        </div>
        
        {/* Progress Bar */}
        <div className="mt-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-700">Course Completion</span>
            <span className="text-sm text-gray-500">{progress.overallProgress}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-3">
            <div 
              className="bg-purple-600 h-3 rounded-full transition-all duration-500"
              style={{ width: `${progress.overallProgress}%` }}
            />
          </div>
        </div>
      </div>
      
      {/* Meetings Progress */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
          <BarChart3 className="w-5 h-5 mr-2 text-purple-600" />
          Meeting Progress
        </h3>
        
        <div className="space-y-4">
          {progress.meetings.map((meeting) => (
            <div key={meeting.meetingId} className="border border-gray-200 rounded-lg p-4">
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1">
                  <h4 className="font-medium text-gray-800">{meeting.meetingTitle}</h4>
                  <p className="text-sm text-gray-600 flex items-center mt-1">
                    <Calendar className="w-4 h-4 mr-1" />
                    {formatDate(meeting.scheduledTime)}
                  </p>
                </div>
                
                <div className="flex items-center space-x-2">
                  {meeting.progress.completed && (
                    <div className="flex items-center space-x-1 text-green-600">
                      <CheckCircle className="w-4 h-4" />
                      <span className="text-sm">Completed</span>
                    </div>
                  )}
                  
                  {meeting.hasRecording && (
                    <button
                      onClick={() => setSelectedRecording(meeting)}
                      className="flex items-center space-x-1 px-3 py-1 bg-purple-100 text-purple-700 rounded-full hover:bg-purple-200 text-sm"
                    >
                      <PlayCircle className="w-4 h-4" />
                      <span>Watch</span>
                    </button>
                  )}
                </div>
              </div>
              
              {/* Progress Details */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-3">
                <div className="text-center">
                  <div className="text-lg font-bold text-gray-800">
                    {meeting.progress.progressPercentage}%
                  </div>
                  <div className="text-xs text-gray-600">Watched</div>
                </div>
                
                <div className="text-center">
                  <div className="text-lg font-bold text-gray-800">
                    {formatDuration(meeting.progress.watchedDuration)}
                  </div>
                  <div className="text-xs text-gray-600">Watch Time</div>
                </div>
                
                <div className="text-center">
                  <div className="text-lg font-bold text-gray-800">
                    {formatDuration(meeting.progress.totalDuration)}
                  </div>
                  <div className="text-xs text-gray-600">Total Duration</div>
                </div>
              </div>
              
              {/* Progress Bar */}
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div 
                  className={`h-2 rounded-full transition-all duration-300 ${
                    meeting.progress.completed ? 'bg-green-500' : 'bg-purple-600'
                  }`}
                  style={{ width: `${meeting.progress.progressPercentage}%` }}
                />
              </div>
              
              {meeting.progress.progressPercentage === 0 && meeting.hasRecording && (
                <p className="text-sm text-gray-500 mt-2 italic">
                  Click "Watch" to start this meeting recording
                </p>
              )}
            </div>
          ))}
        </div>
      </div>
      
      {/* Achievement Section */}
      {progress.overallProgress >= 100 && (
        <div className="bg-gradient-to-r from-purple-500 to-blue-500 rounded-lg shadow p-6 text-white">
          <div className="flex items-center justify-center mb-4">
            <Award className="w-12 h-12 text-yellow-300" />
          </div>
          <div className="text-center">
            <h3 className="text-xl font-bold mb-2">Congratulations!</h3>
            <p>You have completed the entire course! Keep up the great work!</p>
          </div>
        </div>
      )}
      
      {/* Recording Modal */}
      {selectedRecording && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-4 border-b border-gray-200 flex items-center justify-between">
              <h3 className="text-lg font-semibold">Recording: {selectedRecording.meetingTitle}</h3>
              <button
                onClick={() => setSelectedRecording(null)}
                className="p-2 hover:bg-gray-100 rounded-full"
              >
                <span className="text-2xl">&times;</span>
              </button>
            </div>
            
            <div className="p-6">
              <MeetingRecordingPlayer
                meetingId={selectedRecording.meetingId}
                recordingUrl={`http://localhost:3001/api/meetings/${selectedRecording.meetingId}/recording`}
                title={selectedRecording.meetingTitle}
                onProgressUpdate={(progressInfo) => handleProgressUpdate(selectedRecording.meetingId, progressInfo)}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CourseProgressDashboard;