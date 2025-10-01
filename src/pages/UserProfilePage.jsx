import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ref, onValue, remove } from 'firebase/database';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  updateDoc,
} from 'firebase/firestore';
import {
  ref as storageRef,
  uploadBytes,
  getDownloadURL,
} from 'firebase/storage';
import { auth, db, rtdb, storage } from '../firebase';
import { signOut, updateProfile } from 'firebase/auth';
import {
  getUserProfile,
  followUser,
  unfollowUser,
  getPosts,
  getCourses,
  createUserProfile
} from '../firebase';
import {
  Bookmark,
  ThumbsUp,
  ThumbsDown,
  TrendingUp,
  Music,
  Clock,
  BarChart2,
  MessageCircle,
  Camera,
  User,
  Home,
  Users,
  BookOpen,
  Calendar,
  Heart,
  Share2,
  UserPlus,
  UserMinus,
  ArrowLeft
} from 'lucide-react';

const instruments = [
  "drums",
  "flute",
  "guitar",
  "tabla",
  "harmonium",
  "saxophone",
  "keyboard",
  "violin",
];

const ProfilePage = () => {
  const { userId } = useParams();
  const navigate = useNavigate();
  const currentUserId = auth.currentUser?.uid;
  const isOwnProfile = !userId || userId === currentUserId;
  const profileUserId = userId || currentUserId;
  
  // Profile states
  const [userProfile, setUserProfile] = useState(null);
  const [posts, setPosts] = useState([]);
  const [userCourses, setUserCourses] = useState([]);
  const [isFollowing, setIsFollowing] = useState(false);
  const [loading, setLoading] = useState(true);
  
  // Learning profile states
  const [interactions, setInteractions] = useState({});
  const [resourcesById, setResourcesById] = useState({});
  const [allResources, setAllResources] = useState({});
  const [userComments, setUserComments] = useState([]);
  const [activeTab, setActiveTab] = useState(isOwnProfile ? "posts" : "posts");
  
  // Profile editing states
  const [profilePic, setProfilePic] = useState(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef(null);

  useEffect(() => {
    loadProfileData();
  }, [profileUserId, currentUserId]);

  const loadProfileData = async () => {
    if (!profileUserId) return;
    
    setLoading(true);
    try {
      // Load user profile
      let profile = await getUserProfile(profileUserId);
      if (!profile && isOwnProfile) {
        // Create profile if it doesn't exist for current user
        await createUserProfile(profileUserId, {
          displayName: auth.currentUser.displayName || auth.currentUser.email,
          profilePic: auth.currentUser.photoURL || null,
          email: auth.currentUser.email
        });
        profile = await getUserProfile(profileUserId);
      }
      setUserProfile(profile);
      setIsFollowing(profile?.followers?.includes(currentUserId) || false);
      setProfilePic(profile?.profilePic || auth.currentUser?.photoURL);

      // Load user posts
      const userPosts = await getPosts(profileUserId);
      setPosts(userPosts);

      // Load user's courses
      const courses = await getCourses(profileUserId);
      setUserCourses(courses);

      // Load learning data only for own profile
      if (isOwnProfile) {
        loadLearningData();
      }
    } catch (error) {
      console.error('Error loading profile:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadLearningData = () => {
    if (!profileUserId) return;
    
    // Load interactions
    const unsub = onValue(ref(rtdb, "userInteractions/" + profileUserId), (snap) => {
      setInteractions(snap.val() || {});
    });

    // Load all resources
    const fetchAll = async () => {
      const grouped = {};
      for (const inst of instruments) {
        const q = query(
          collection(db, "resources"),
          where("instrument", "==", inst)
        );
        const snap = await getDocs(q);
        const byLevel = { beginner: [], intermediate: [], advanced: [] };
        snap.forEach((d) => {
          const data = d.data();
          const lvl = data.level.toLowerCase();
          if (byLevel[lvl])
            byLevel[lvl].push({ id: d.id, ...data });
        });
        grouped[inst] = byLevel;
      }
      setAllResources(grouped);
    };
    fetchAll();

    return () => unsub();
  };

  const handleFollow = async () => {
    try {
      await followUser(currentUserId, profileUserId);
      setIsFollowing(true);
      // Update follower count in UI
      setUserProfile(prev => ({
        ...prev,
        followers: [...(prev.followers || []), currentUserId]
      }));
    } catch (error) {
      console.error('Error following user:', error);
    }
  };

  const handleUnfollow = async () => {
    try {
      await unfollowUser(currentUserId, profileUserId);
      setIsFollowing(false);
      // Update follower count in UI
      setUserProfile(prev => ({
        ...prev,
        followers: (prev.followers || []).filter(id => id !== currentUserId)
      }));
    } catch (error) {
      console.error('Error unfollowing user:', error);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut(auth);
      setTimeout(() => {
        navigate("/");
      }, 100);
    } catch (error) {
      console.error("Sign out failed:", error);
    }
  };

  const handleProfilePicClick = () => {
    if (isOwnProfile) {
      fileInputRef.current.click();
    }
  };

  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const allowedTypes = ["image/jpeg", "image/png", "image/gif"];
    if (!allowedTypes.includes(file.type)) {
      alert("Please select an image file (JPEG, PNG, or GIF)");
      return;
    }

    try {
      setUploading(true);
      const imageRef = storageRef(storage, "profilePics/" + profileUserId);
      await uploadBytes(imageRef, file);
      const downloadUrl = await getDownloadURL(imageRef);
      
      if (isOwnProfile) {
        await updateProfile(auth.currentUser, {
          photoURL: downloadUrl,
        });
      }
      
      await updateDoc(doc(db, "users", profileUserId), {
        profilePic: downloadUrl,
      });
      setProfilePic(downloadUrl);
    } catch (error) {
      console.error("Error uploading profile picture:", error);
      alert("Failed to upload image. Please try again.");
    } finally {
      setUploading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
      </div>
    );
  }

  if (!userProfile) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-700 mb-2">Profile not found</h2>
          <button
            onClick={() => navigate('/home')}
            className="text-purple-600 hover:text-purple-700"
          >
            Back to Feed
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-700 to-indigo-800 py-8 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center">
            <div className="flex items-center mb-4 md:mb-0">
              {!isOwnProfile && (
                <button
                  onClick={() => navigate(-1)}
                  className="text-white hover:text-purple-200 mr-4"
                >
                  <ArrowLeft className="w-6 h-6" />
                </button>
              )}
              <div className="relative">
                <div
                  className={`bg-white h-20 w-20 rounded-full flex items-center justify-center mr-5 overflow-hidden ${isOwnProfile ? 'cursor-pointer group' : ''} relative`}
                  onClick={handleProfilePicClick}
                >
                  {profilePic ? (
                    <img
                      src={profilePic}
                      alt="Profile"
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <User className="h-10 w-10 text-purple-300" />
                  )}
                  {isOwnProfile && (
                    <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-30 flex items-center justify-center transition-all">
                      <Camera className="text-white opacity-0 group-hover:opacity-100 h-8 w-8" />
                    </div>
                  )}
                </div>
                {isOwnProfile && (
                  <input
                    type="file"
                    ref={fileInputRef}
                    accept="image/*"
                    className="hidden"
                    onChange={handleFileChange}
                  />
                )}
                {uploading && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  </div>
                )}
              </div>
              <div>
                <h1 className="text-2xl font-bold text-white">
                  {userProfile.displayName || "Music Enthusiast"}
                </h1>
                <div className="flex items-center gap-6 mt-2 text-purple-200">
                  <span>{userProfile.followers?.length || 0} followers</span>
                  <span>{userProfile.following?.length || 0} following</span>
                  <span>{posts.length} posts</span>
                  <span>{userCourses.length} courses</span>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-wrap gap-2">
              {isOwnProfile ? (
                <>
                  <button
                    onClick={() => navigate("/home")}
                    className="bg-white text-purple-700 hover:bg-gray-100 px-4 py-2 rounded-lg shadow font-medium flex items-center"
                  >
                    <Home className="h-4 w-4 mr-2" />
                    Feed
                  </button>
                  <button
                    onClick={handleSignOut}
                    className="bg-white text-purple-700 hover:bg-gray-100 px-4 py-2 rounded-lg shadow font-medium"
                  >
                    Sign Out
                  </button>
                </>
              ) : (
                <>
                  {isFollowing ? (
                    <button
                      onClick={handleUnfollow}
                      className="bg-gray-200 hover:bg-gray-300 text-gray-800 px-6 py-2 rounded-lg font-medium flex items-center gap-2"
                    >
                      <UserMinus className="w-4 h-4" />
                      Unfollow
                    </button>
                  ) : (
                    <button
                      onClick={handleFollow}
                      className="bg-white hover:bg-gray-100 text-purple-700 px-6 py-2 rounded-lg font-medium flex items-center gap-2"
                    >
                      <UserPlus className="w-4 h-4" />
                      Follow
                    </button>
                  )}
                  <button
                    onClick={() => navigate('/messages')}
                    className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg font-medium"
                  >
                    Message
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Tabs and Content */}
      <div className="max-w-6xl mx-auto py-8 px-6">
        <div className="flex mb-6 overflow-x-auto">
          {[
            { key: "posts", label: "Posts", icon: <MessageCircle className="w-4 h-4 mr-2" /> },
            { key: "courses", label: "Courses", icon: <BookOpen className="w-4 h-4 mr-2" /> },
            ...(isOwnProfile ? [
              { key: "bookmarked", label: "Bookmarked", icon: <Bookmark className="w-4 h-4 mr-2" /> },
              { key: "progress", label: "Progress", icon: <BarChart2 className="w-4 h-4 mr-2" /> }
            ] : [])
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={
                activeTab === tab.key
                  ? "flex items-center px-4 py-2 mr-2 font-medium rounded-lg bg-purple-600 text-white whitespace-nowrap"
                  : "flex items-center px-4 py-2 mr-2 font-medium rounded-lg bg-white text-gray-600 hover:bg-gray-50 whitespace-nowrap"
              }
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content based on active tab */}
        {activeTab === "posts" && (
          <div className="space-y-6">
            {posts.length === 0 ? (
              <div className="bg-white rounded-lg shadow p-8 text-center">
                <MessageCircle className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-700 mb-2">
                  {isOwnProfile ? "You haven't posted yet" : "No posts yet"}
                </h3>
                <p className="text-gray-500 mb-4">
                  {isOwnProfile ? "Share your musical journey with others!" : "This user hasn't shared any posts yet."}
                </p>
                {isOwnProfile && (
                  <button
                    onClick={() => navigate('/home')}
                    className="bg-purple-600 hover:bg-purple-700 text-white px-6 py-2 rounded-lg"
                  >
                    Create First Post
                  </button>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4">
                {posts.map((post) => (
                  <div key={post.id} className="bg-white rounded-lg shadow hover:shadow-md transition-shadow p-6">
                    <div className="flex items-center mb-4">
                      {userProfile.profilePic ? (
                        <img 
                          src={userProfile.profilePic} 
                          alt={userProfile.displayName}
                          className="w-12 h-12 rounded-full object-cover mr-3"
                        />
                      ) : (
                        <div className="w-12 h-12 rounded-full bg-purple-200 flex items-center justify-center mr-3">
                          <User className="w-6 h-6 text-purple-600" />
                        </div>
                      )}
                      <div>
                        <h4 className="font-medium text-gray-800">{userProfile.displayName}</h4>
                        <p className="text-sm text-gray-500">
                          {post.timestamp?.toDate?.()?.toLocaleDateString() || 'Recently'}
                        </p>
                      </div>
                    </div>
                    
                    <p className="text-gray-800 mb-4 whitespace-pre-wrap">{post.content}</p>
                    
                    {post.mediaUrl && (
                      <img 
                        src={post.mediaUrl} 
                        alt="Post media"
                        className="w-full rounded-lg mb-4 max-h-96 object-cover"
                      />
                    )}
                    
                    <div className="flex items-center justify-between pt-4 border-t">
                      <div className="flex items-center gap-6">
                        <button className="flex items-center gap-2 text-gray-600 hover:text-red-500 transition-colors">
                          <Heart className="w-5 h-5" />
                          <span className="text-sm">Like</span>
                        </button>
                        <button className="flex items-center gap-2 text-gray-600 hover:text-blue-500 transition-colors">
                          <MessageCircle className="w-5 h-5" />
                          <span className="text-sm">Comment</span>
                        </button>
                        <button className="flex items-center gap-2 text-gray-600 hover:text-green-500 transition-colors">
                          <Share2 className="w-5 h-5" />
                          <span className="text-sm">Share</span>
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === "courses" && (
          <div className="space-y-6">
            {userCourses.length === 0 ? (
              <div className="bg-white rounded-lg shadow p-8 text-center">
                <BookOpen className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-700 mb-2">
                  {isOwnProfile ? "You haven't created any courses" : "No courses created"}
                </h3>
                <p className="text-gray-500 mb-4">
                  {isOwnProfile ? "Share your knowledge by creating a course!" : "This user hasn't created any courses yet."}
                </p>
                {isOwnProfile && (
                  <button
                    onClick={() => navigate('/courses')}
                    className="bg-purple-600 hover:bg-purple-700 text-white px-6 py-2 rounded-lg"
                  >
                    Create First Course
                  </button>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {userCourses.map((course) => (
                  <div key={course.id} className="bg-white rounded-lg shadow hover:shadow-md transition-shadow p-6">
                    <h3 className="text-xl font-semibold text-gray-800 mb-2">{course.title}</h3>
                    <p className="text-gray-600 text-sm mb-4 line-clamp-3">{course.description}</p>
                    
                    <div className="flex items-center gap-4 text-sm text-gray-500 mb-4">
                      <div className="flex items-center gap-1">
                        <Users className="w-4 h-4" />
                        <span>{course.enrolledUsers?.length || 0} students</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Calendar className="w-4 h-4" />
                        <span>{new Date(course.createdAt?.toDate?.() || Date.now()).toLocaleDateString()}</span>
                      </div>
                    </div>
                    
                    <button
                      onClick={() => navigate(`/course/${course.id}`)}
                      className="w-full bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg"
                    >
                      {isOwnProfile ? 'Manage Course' : 'View Course'}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Learning tabs only for own profile */}
        {isOwnProfile && activeTab === "bookmarked" && (
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-semibold text-gray-800 mb-4 flex items-center">
              <Bookmark className="w-5 h-5 mr-2" />
              Bookmarked Resources
            </h2>
            <p className="text-gray-500 italic">Your bookmarked learning resources will appear here.</p>
          </div>
        )}

        {isOwnProfile && activeTab === "progress" && (
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-semibold text-gray-800 mb-4 flex items-center">
              <TrendingUp className="w-5 h-5 mr-2" />
              Learning Progress
            </h2>
            <p className="text-gray-500 italic">Your learning progress will appear here.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default ProfilePage;

