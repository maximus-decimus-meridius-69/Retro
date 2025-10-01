import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  auth, 
  db,
  getUserProfile, 
  createMeeting, 
  getMeetings,
  enrollInCourse 
} from '../firebase';
import { 
  doc, 
  getDoc, 
  updateDoc, 
  arrayUnion,
  arrayRemove 
} from 'firebase/firestore';
import { 
  BookOpen, 
  Users, 
  Calendar, 
  Video, 
  Plus, 
  Clock,
  User,
  ArrowLeft,
  Edit,
  FileText,
  ExternalLink,
  BarChart3,
  PlayCircle
} from 'lucide-react';
import CourseMeetingScheduler from '../components/CourseMeetingScheduler';
import CourseProgressDashboard from '../components/CourseProgressDashboard';

const CoursePage = () => {
  const { courseId } = useParams();
  const navigate = useNavigate();
  const [course, setCourse] = useState(null);
  const [meetings, setMeetings] = useState([]);
  const [creatorProfile, setCreatorProfile] = useState(null);
  const [isEnrolled, setIsEnrolled] = useState(false);
  const [isCreator, setIsCreator] = useState(false);
  const [showCreateMeeting, setShowCreateMeeting] = useState(false);
  const [showAddMaterial, setShowAddMaterial] = useState(false);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  const [newMeeting, setNewMeeting] = useState({
    title: '',
    description: '',
    scheduledTime: ''
  });
  const [newMaterial, setNewMaterial] = useState('');
  
  const currentUserId = auth.currentUser?.uid;

  useEffect(() => {
    loadCourseData();
  }, [courseId, currentUserId]);

  const loadCourseData = async () => {
    if (!courseId) return;

    try {
      setLoading(true);
      
      // Load course details
      const courseDoc = await getDoc(doc(db, 'courses', courseId));
      if (!courseDoc.exists()) {
        navigate('/courses');
        return;
      }

      const courseData = { id: courseDoc.id, ...courseDoc.data() };
      setCourse(courseData);

      // Load creator profile
      const creator = await getUserProfile(courseData.creatorId);
      setCreatorProfile(creator);

      // Check if user is enrolled or creator
      const enrolled = courseData.enrolledUsers?.includes(currentUserId) || false;
      const creator_check = courseData.creatorId === currentUserId;
      setIsEnrolled(enrolled);
      setIsCreator(creator_check);

      // Load meetings if enrolled or creator
      if (enrolled || creator_check) {
        const courseMeetings = await getMeetings(courseId);
        setMeetings(courseMeetings);
      }

    } catch (error) {
      console.error('Error loading course:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleEnroll = async () => {
    try {
      const courseRef = doc(db, 'courses', courseId);
      await updateDoc(courseRef, {
        enrolledUsers: arrayUnion(currentUserId)
      });
      setIsEnrolled(true);
      loadCourseData(); // Reload to get meetings
    } catch (error) {
      console.error('Error enrolling:', error);
      alert('Failed to enroll in course');
    }
  };

  const handleCreateMeeting = async () => {
    if (!newMeeting.title.trim() || !newMeeting.scheduledTime) {
      alert('Please fill in all required fields');
      return;
    }

    try {
      const enrolledUsers = course.enrolledUsers || [];
      const participants = [currentUserId, ...enrolledUsers];

      await createMeeting({
        courseId: courseId,
        title: newMeeting.title,
        description: newMeeting.description,
        scheduledTime: new Date(newMeeting.scheduledTime),
        participants: participants
      });

      setShowCreateMeeting(false);
      setNewMeeting({ title: '', description: '', scheduledTime: '' });
      loadCourseData(); // Reload meetings
    } catch (error) {
      console.error('Error creating meeting:', error);
      alert('Failed to create meeting');
    }
  };

  const handleAddMaterial = async () => {
    if (!newMaterial.trim()) return;

    try {
      const courseRef = doc(db, 'courses', courseId);
      await updateDoc(courseRef, {
        materials: arrayUnion(newMaterial)
      });

      setShowAddMaterial(false);
      setNewMaterial('');
      loadCourseData(); // Reload course data
    } catch (error) {
      console.error('Error adding material:', error);
      alert('Failed to add material');
    }
  };

  const handleRemoveMaterial = async (material) => {
    try {
      const courseRef = doc(db, 'courses', courseId);
      await updateDoc(courseRef, {
        materials: arrayRemove(material)
      });
      loadCourseData(); // Reload course data
    } catch (error) {
      console.error('Error removing material:', error);
      alert('Failed to remove material');
    }
  };

  const joinMeeting = (meetingId) => {
    // Navigate to meeting room for this meeting
    navigate(`/meeting/${meetingId}`);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
      </div>
    );
  }

  if (!course) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-700 mb-2">Course not found</h2>
          <button
            onClick={() => navigate('/courses')}
            className="text-purple-600 hover:text-purple-700"
          >
            Back to Courses
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm">
        <div className="max-w-6xl mx-auto px-4 py-6">
          <div className="flex items-center gap-4 mb-4">
            <button
              onClick={() => navigate('/courses')}
              className="text-gray-600 hover:text-gray-800"
            >
              <ArrowLeft className="w-6 h-6" />
            </button>
            <div className="flex-1">
              <h1 className="text-3xl font-bold text-gray-800">{course.title}</h1>
              <p className="text-gray-600 mt-1">{course.description}</p>
            </div>
          </div>

          <div className="flex items-center gap-6 text-sm text-gray-600">
            <div className="flex items-center gap-2">
              <User className="w-4 h-4" />
              <span>Instructor: {creatorProfile?.displayName || 'Unknown'}</span>
            </div>
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4" />
              <span>{course.enrolledUsers?.length || 0} students enrolled</span>
            </div>
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              <span>Created {new Date(course.createdAt?.toDate?.() || Date.now()).toLocaleDateString()}</span>
            </div>
          </div>

          {!isEnrolled && !isCreator && (
            <div className="mt-4">
              <button
                onClick={handleEnroll}
                className="bg-purple-600 hover:bg-purple-700 text-white px-6 py-3 rounded-lg text-lg font-medium"
              >
                Enroll in Course
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-6xl mx-auto px-4 py-8">
        {!isEnrolled && !isCreator ? (
          <div className="bg-white rounded-lg shadow p-8 text-center">
            <BookOpen className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-xl font-medium text-gray-700 mb-2">Enroll to Access Course Content</h3>
            <p className="text-gray-500 mb-6">Join this course to view materials, attend meetings, and interact with other students.</p>
            <button
              onClick={handleEnroll}
              className="bg-purple-600 hover:bg-purple-700 text-white px-8 py-3 rounded-lg text-lg font-medium"
            >
              Enroll Now
            </button>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Tab Navigation */}
            <div className="bg-white rounded-lg shadow">
              <div className="border-b border-gray-200">
                <nav className="flex space-x-8 px-6" aria-label="Tabs">
                  <button
                    onClick={() => setActiveTab('overview')}
                    className={`py-4 px-1 border-b-2 font-medium text-sm ${
                      activeTab === 'overview'
                        ? 'border-purple-500 text-purple-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    <div className="flex items-center space-x-2">
                      <BookOpen className="w-4 h-4" />
                      <span>Overview</span>
                    </div>
                  </button>
                  
                  <button
                    onClick={() => setActiveTab('meetings')}
                    className={`py-4 px-1 border-b-2 font-medium text-sm ${
                      activeTab === 'meetings'
                        ? 'border-purple-500 text-purple-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    <div className="flex items-center space-x-2">
                      <Video className="w-4 h-4" />
                      <span>Meetings</span>
                    </div>
                  </button>
                  
                  {(isEnrolled || isCreator) && (
                    <button
                      onClick={() => setActiveTab('progress')}
                      className={`py-4 px-1 border-b-2 font-medium text-sm ${
                        activeTab === 'progress'
                          ? 'border-purple-500 text-purple-600'
                          : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                      }`}
                    >
                      <div className="flex items-center space-x-2">
                        <BarChart3 className="w-4 h-4" />
                        <span>Progress</span>
                      </div>
                    </button>
                  )}
                  
                  <button
                    onClick={() => setActiveTab('materials')}
                    className={`py-4 px-1 border-b-2 font-medium text-sm ${
                      activeTab === 'materials'
                        ? 'border-purple-500 text-purple-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    <div className="flex items-center space-x-2">
                      <FileText className="w-4 h-4" />
                      <span>Materials</span>
                    </div>
                  </button>
                </nav>
              </div>
            </div>
            
            {/* Tab Content */}
            {activeTab === 'overview' && (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Course Description */}
                <div className="lg:col-span-2">
                  <div className="bg-white rounded-lg shadow p-6">
                    <h2 className="text-xl font-semibold text-gray-800 mb-4">About This Course</h2>
                    <p className="text-gray-600 leading-relaxed mb-6">{course.description}</p>
                    
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                      <div className="p-4 bg-purple-50 rounded-lg">
                        <div className="text-2xl font-bold text-purple-600">{course.enrolledUsers?.length || 0}</div>
                        <div className="text-sm text-gray-600">Students</div>
                      </div>
                      <div className="p-4 bg-blue-50 rounded-lg">
                        <div className="text-2xl font-bold text-blue-600">{meetings.length}</div>
                        <div className="text-sm text-gray-600">Meetings</div>
                      </div>
                      <div className="p-4 bg-green-50 rounded-lg">
                        <div className="text-2xl font-bold text-green-600">{course.materials?.length || 0}</div>
                        <div className="text-sm text-gray-600">Materials</div>
                      </div>
                      <div className="p-4 bg-yellow-50 rounded-lg">
                        <div className="text-2xl font-bold text-yellow-600">
                          {creatorProfile?.displayName ? creatorProfile.displayName.split(' ').length : 1}
                        </div>
                        <div className="text-sm text-gray-600">Instructor</div>
                      </div>
                    </div>
                  </div>
                </div>
                
                {/* Sidebar */}
                <div className="space-y-6">
                  {/* Course Info */}
                  <div className="bg-white rounded-lg shadow p-6">
                    <h3 className="text-lg font-semibold text-gray-800 mb-4">Course Information</h3>
                    <div className="space-y-3">
                      <div>
                        <span className="text-sm text-gray-600">Instructor:</span>
                        <p className="font-medium">{creatorProfile?.displayName || 'Unknown'}</p>
                      </div>
                      <div>
                        <span className="text-sm text-gray-600">Students:</span>
                        <p className="font-medium">{course.enrolledUsers?.length || 0} enrolled</p>
                      </div>
                      <div>
                        <span className="text-sm text-gray-600">Materials:</span>
                        <p className="font-medium">{course.materials?.length || 0} resources</p>
                      </div>
                      <div>
                        <span className="text-sm text-gray-600">Meetings:</span>
                        <p className="font-medium">{meetings.length} scheduled</p>
                      </div>
                    </div>
                  </div>
                  
                  {/* Quick Actions */}
                  {isCreator && (
                    <div className="bg-white rounded-lg shadow p-6">
                      <h3 className="text-lg font-semibold text-gray-800 mb-4">Quick Actions</h3>
                      <div className="space-y-2">
                        <button
                          onClick={() => setActiveTab('meetings')}
                          className="w-full text-left px-4 py-2 rounded-lg hover:bg-gray-50 flex items-center gap-2"
                        >
                          <Video className="w-4 h-4 text-purple-600" />
                          Manage Meetings
                        </button>
                        <button
                          onClick={() => setActiveTab('materials')}
                          className="w-full text-left px-4 py-2 rounded-lg hover:bg-gray-50 flex items-center gap-2"
                        >
                          <FileText className="w-4 h-4 text-purple-600" />
                          Manage Materials
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
            
            {activeTab === 'meetings' && (
              <CourseMeetingScheduler
                courseId={courseId}
                courseTitle={course.title}
                enrolledEmails={course.enrolledUsers || []} // Pass user IDs for now
                isHost={isCreator}
                onMeetingScheduled={loadCourseData}
              />
            )}
            
            {activeTab === 'progress' && (isEnrolled || isCreator) && (
              <CourseProgressDashboard
                courseId={courseId}
                courseTitle={course.title}
              />
            )}
            
            {activeTab === 'materials' && (
              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-2xl font-semibold text-gray-800 flex items-center gap-2">
                    <FileText className="w-6 h-6" />
                    Course Materials
                  </h2>
                  {isCreator && (
                    <button
                      onClick={() => setShowAddMaterial(true)}
                      className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg flex items-center gap-2"
                    >
                      <Plus className="w-4 h-4" />
                      Add Material
                    </button>
                  )}
                </div>

                {course.materials && course.materials.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {course.materials.map((material, index) => (
                      <div key={index} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                        <div className="flex items-start justify-between">
                          <div className="flex items-start gap-3 flex-1">
                            <FileText className="w-5 h-5 text-purple-600 mt-1" />
                            <div className="flex-1">
                              <span className="text-gray-800 font-medium block">{material}</span>
                              <div className="mt-2 flex items-center gap-2">
                                {material.startsWith('http') && (
                                  <a
                                    href={material}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-purple-600 hover:text-purple-700 flex items-center gap-1 text-sm"
                                  >
                                    <ExternalLink className="w-4 h-4" />
                                    Open
                                  </a>
                                )}
                                {isCreator && (
                                  <button
                                    onClick={() => handleRemoveMaterial(material)}
                                    className="text-red-600 hover:text-red-700 text-sm"
                                  >
                                    Remove
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12 text-gray-500">
                    <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-700 mb-2">No materials added yet</h3>
                    <p className="text-gray-500 mb-6">Course materials will appear here once the instructor adds them.</p>
                    {isCreator && (
                      <button
                        onClick={() => setShowAddMaterial(true)}
                        className="bg-purple-600 hover:bg-purple-700 text-white px-6 py-3 rounded-lg"
                      >
                        Add First Material
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Create Meeting Modal */}
      {showCreateMeeting && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg w-full max-w-md">
            <div className="p-6 border-b">
              <h2 className="text-xl font-semibold text-gray-800">Schedule Meeting</h2>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Meeting Title *
                </label>
                <input
                  type="text"
                  value={newMeeting.title}
                  onChange={(e) => setNewMeeting(prev => ({ ...prev, title: e.target.value }))}
                  placeholder="Enter meeting title..."
                  className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:border-purple-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Description
                </label>
                <textarea
                  value={newMeeting.description}
                  onChange={(e) => setNewMeeting(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Meeting description..."
                  className="w-full px-4 py-2 border rounded-lg resize-none focus:outline-none focus:border-purple-500"
                  rows="3"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Scheduled Time *
                </label>
                <input
                  type="datetime-local"
                  value={newMeeting.scheduledTime}
                  onChange={(e) => setNewMeeting(prev => ({ ...prev, scheduledTime: e.target.value }))}
                  className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:border-purple-500"
                />
              </div>
            </div>

            <div className="p-6 border-t flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowCreateMeeting(false);
                  setNewMeeting({ title: '', description: '', scheduledTime: '' });
                }}
                className="px-6 py-2 text-gray-600 hover:text-gray-800"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateMeeting}
                className="bg-purple-600 hover:bg-purple-700 text-white px-6 py-2 rounded-lg"
              >
                Schedule Meeting
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Material Modal */}
      {showAddMaterial && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg w-full max-w-md">
            <div className="p-6 border-b">
              <h2 className="text-xl font-semibold text-gray-800">Add Course Material</h2>
            </div>

            <div className="p-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Material URL or Description
              </label>
              <input
                type="text"
                value={newMaterial}
                onChange={(e) => setNewMaterial(e.target.value)}
                placeholder="Enter material URL or description..."
                className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:border-purple-500"
              />
            </div>

            <div className="p-6 border-t flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowAddMaterial(false);
                  setNewMaterial('');
                }}
                className="px-6 py-2 text-gray-600 hover:text-gray-800"
              >
                Cancel
              </button>
              <button
                onClick={handleAddMaterial}
                className="bg-purple-600 hover:bg-purple-700 text-white px-6 py-2 rounded-lg"
              >
                Add Material
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CoursePage;
