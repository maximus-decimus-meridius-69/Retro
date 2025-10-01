import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  auth, 
  getUserProfile, 
  getFeedPosts, 
  getPosts, 
  createPost, 
  createUserProfile,
  createStory,
  getStoriesGroupedByUser,
  markStoryAsViewed 
} from '../firebase';
import { 
  Heart, 
  MessageCircle, 
  Share2, 
  Music, 
  Home,
  Users,
  BookOpen,
  Mail,
  PlusCircle,
  Image,
  X,
  User,
  Mic,
  Camera,
  Play,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from '../firebase';

// Import instrument images
import drumsImg from "../assets/photos/drums.png";
import fluteImg from "../assets/photos/flute.png";
import guitarImg from "../assets/photos/guitar.png";
import tablaImg from "../assets/photos/tabla.png";
import harmoniumImg from "../assets/photos/harmonium.png";
import saxophoneImg from "../assets/photos/saxophone.png";
import keyboardImg from "../assets/photos/keyboard.png";
import violinImg from "../assets/photos/violin.png";

const instruments = [
  { name: "drums", image: drumsImg, virtualLink: "https://www.sessiontown.com/en/music-games-apps/virtual-instrument-play-drums-online" },
  { name: "flute", image: fluteImg, virtualLink: "https://www.virtualmusicalinstruments.com/flute" },
  { name: "guitar", image: guitarImg, virtualLink: "https://www.musicca.com/guitar" },
  { name: "tabla", image: tablaImg, virtualLink: "https://artiumacademy.com/tools/tabla" },
  { name: "harmonium", image: harmoniumImg, virtualLink: "https://music-tools.spardhaschoolofmusic.com/harmonium" },
  { name: "saxophone", image: saxophoneImg, virtualLink: "https://www.trumpetfingering.com/virtual-saxophone" },
  { name: "keyboard", image: keyboardImg, virtualLink: "https://www.sessiontown.com/en/music-games-apps/online-virtual-keyboard-piano" },
  { name: "violin", image: violinImg, virtualLink: "https://www.ecarddesignanimation.com/home/violin_html5.php" },
];

const SocialHomePage = () => {
  const navigate = useNavigate();
  const [feed, setFeed] = useState([]);
  const [userProfile, setUserProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showCreatePost, setShowCreatePost] = useState(false);
  const [postContent, setPostContent] = useState('');
  const [postImage, setPostImage] = useState(null);
  const [uploadingPost, setUploadingPost] = useState(false);
  const [activeTab, setActiveTab] = useState('following');
  const [stories, setStories] = useState({});
  const [showCreateStory, setShowCreateStory] = useState(false);
  const [storyImage, setStoryImage] = useState(null);
  const [storyText, setStoryText] = useState('');
  const [uploadingStory, setUploadingStory] = useState(false);
  const [showStoryViewer, setShowStoryViewer] = useState(false);
  const [currentStoryUser, setCurrentStoryUser] = useState(null);
  const [currentStoryIndex, setCurrentStoryIndex] = useState(0);

  useEffect(() => {
    loadData();
  }, [activeTab]);

  const loadData = async () => {
    const userId = auth.currentUser?.uid;
    if (!userId) {
      navigate('/login');
      return;
    }

    try {
      setLoading(true);
      
      // Get or create user profile
      let profile = await getUserProfile(userId);
      if (!profile) {
        await createUserProfile(userId, {
          displayName: auth.currentUser.displayName || auth.currentUser.email,
          profilePic: auth.currentUser.photoURL || null,
          email: auth.currentUser.email
        });
        profile = await getUserProfile(userId);
      }
      setUserProfile(profile);

      // Load stories
      const storiesData = await getStoriesGroupedByUser(profile?.following || []);
      
      // Add user info to stories
      const storiesWithUserInfo = {};
      for (const [userId, userStories] of Object.entries(storiesData)) {
        const userInfo = await getUserProfile(userId);
        storiesWithUserInfo[userId] = {
          userInfo,
          stories: userStories
        };
      }
      setStories(storiesWithUserInfo);

      // Load feed posts based on active tab
      let posts = [];
      if (activeTab === 'following' && profile?.following?.length > 0) {
        posts = await getFeedPosts(profile.following);
      } else if (activeTab === 'explore') {
        posts = await getPosts(); // Get all recent posts
      } else if (activeTab === 'following') {
        // If following tab but no following, show empty with suggestion
        posts = [];
      }

      // Add user info to posts
      const postsWithUserInfo = await Promise.all(
        posts.slice(0, 10).map(async (post) => {
          const postUser = await getUserProfile(post.userId);
          return { ...post, userInfo: postUser };
        })
      );

      setFeed(postsWithUserInfo);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreatePost = async () => {
    if (!postContent.trim() && !postImage) return;

    setUploadingPost(true);
    try {
      let mediaUrl = null;
      
      if (postImage) {
        const imageRef = storageRef(storage, `posts/${auth.currentUser.uid}/${Date.now()}`);
        await uploadBytes(imageRef, postImage);
        mediaUrl = await getDownloadURL(imageRef);
      }

      await createPost({
        userId: auth.currentUser.uid,
        userName: auth.currentUser.displayName || auth.currentUser.email,
        content: postContent,
        mediaUrl: mediaUrl
      });

      setPostContent('');
      setPostImage(null);
      setShowCreatePost(false);
      await loadData(); // Reload feed
    } catch (error) {
      console.error('Error creating post:', error);
      alert('Failed to create post. Please try again.');
    } finally {
      setUploadingPost(false);
    }
  };

  const handleImageSelect = (e) => {
    const file = e.target.files[0];
    if (file && file.type.startsWith('image/')) {
      setPostImage(file);
    }
  };

  const handleStoryImageSelect = (e) => {
    const file = e.target.files[0];
    if (file && file.type.startsWith('image/')) {
      setStoryImage(file);
    }
  };

  const handleCreateStory = async () => {
    if (!storyText.trim() && !storyImage) return;

    setUploadingStory(true);
    try {
      await createStory({
        userId: auth.currentUser.uid,
        userName: auth.currentUser.displayName || auth.currentUser.email,
        text: storyText
      }, storyImage);

      setStoryText('');
      setStoryImage(null);
      setShowCreateStory(false);
      await loadData(); // Reload to get new stories
    } catch (error) {
      console.error('Error creating story:', error);
      alert('Failed to create story. Please try again.');
    } finally {
      setUploadingStory(false);
    }
  };

  const openStoryViewer = (userId, startIndex = 0) => {
    setCurrentStoryUser(userId);
    setCurrentStoryIndex(startIndex);
    setShowStoryViewer(true);
  };

  const closeStoryViewer = () => {
    setShowStoryViewer(false);
    setCurrentStoryUser(null);
    setCurrentStoryIndex(0);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-yellow-50 via-pink-100 to-purple-200">
      {/* Header */}
      <div className="bg-white/80 backdrop-blur-md shadow-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex justify-between items-center">
            <h1 className="text-3xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
              🎵 Music Universe
            </h1>
            <div className="flex items-center gap-4">
              <button
                onClick={() => navigate('/messages')}
                className="bg-pink-600 hover:bg-pink-700 text-white px-4 py-2 rounded-full flex items-center gap-2 transition-all shadow-lg"
              >
                <Mail className="w-5 h-5" />
                <span className="hidden sm:inline">Messages</span>
              </button>
              <button
                onClick={() => setShowCreatePost(true)}
                className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-full flex items-center gap-2 transition-all shadow-lg"
              >
                <PlusCircle className="w-5 h-5" />
                <span className="hidden sm:inline">Share</span>
              </button>
              <button
                onClick={() => navigate(`/profile`)}
                className="w-10 h-10 rounded-full bg-purple-200 flex items-center justify-center hover:bg-purple-300 transition-colors"
              >
                {userProfile?.profilePic ? (
                  <img 
                    src={userProfile.profilePic} 
                    alt="Profile"
                    className="w-full h-full rounded-full object-cover"
                  />
                ) : (
                  <User className="w-6 h-6 text-purple-700" />
                )}
              </button>
            </div>
          </div>
        </div>
        
        {/* Feed Tabs */}
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex gap-6 mt-4 border-b border-white/20">
            <button
              onClick={() => setActiveTab('following')}
              className={`pb-3 px-1 font-medium transition-all ${
                activeTab === 'following'
                  ? 'border-b-2 border-white text-white'
                  : 'text-white/70 hover:text-white'
              }`}
            >
              Following
            </button>
            <button
              onClick={() => setActiveTab('explore')}
              className={`pb-3 px-1 font-medium transition-all ${
                activeTab === 'explore'
                  ? 'border-b-2 border-white text-white'
                  : 'text-white/70 hover:text-white'
              }`}
            >
              Explore
            </button>
          </div>
        </div>
      </div>

      {/* Stories Section */}
      <div className="bg-white/90 backdrop-blur-md border-b">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center gap-4 overflow-x-auto scrollbar-hide">
            {/* Create Story Button */}
            <div className="flex-shrink-0">
              <button
                onClick={() => setShowCreateStory(true)}
                className="relative w-16 h-16 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 flex items-center justify-center hover:scale-105 transition-transform shadow-lg"
              >
                <Camera className="w-8 h-8 text-white" />
                <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-purple-600 rounded-full flex items-center justify-center">
                  <PlusCircle className="w-4 h-4 text-white" />
                </div>
              </button>
              <p className="text-xs text-center mt-1 text-gray-600 font-medium">Your Story</p>
            </div>

            {/* Stories from other users */}
            {Object.entries(stories).map(([userId, storyData]) => (
              <div key={userId} className="flex-shrink-0">
                <button
                  onClick={() => openStoryViewer(userId)}
                  className="relative w-16 h-16 rounded-full p-0.5 bg-gradient-to-r from-purple-500 via-pink-500 to-red-500 hover:scale-105 transition-transform"
                >
                  {storyData.userInfo?.profilePic ? (
                    <img
                      src={storyData.userInfo.profilePic}
                      alt={storyData.userInfo.displayName}
                      className="w-full h-full rounded-full object-cover border-2 border-white"
                    />
                  ) : (
                    <div className="w-full h-full rounded-full bg-purple-200 flex items-center justify-center border-2 border-white">
                      <User className="w-6 h-6 text-purple-600" />
                    </div>
                  )}
                  <div className="absolute -bottom-1 right-0 w-5 h-5 bg-green-500 rounded-full border-2 border-white flex items-center justify-center">
                    <Play className="w-2 h-2 text-white" />
                  </div>
                </button>
                <p className="text-xs text-center mt-1 text-gray-600 font-medium truncate w-16">
                  {storyData.userInfo?.displayName?.split(' ')[0] || 'User'}
                </p>
              </div>
            ))}

            {Object.keys(stories).length === 0 && (
              <div className="flex items-center justify-center py-4 text-gray-500">
                <p className="text-sm">No stories yet. Be the first to share!</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Bottom Navigation */}
      <div className="fixed bottom-0 left-0 right-0 bg-white/90 backdrop-blur-md border-t z-20 sm:hidden">
        <div className="flex justify-around py-2">
          <button
            onClick={() => navigate('/home')}
            className="flex flex-col items-center p-2 text-purple-600"
          >
            <Home className="w-6 h-6" />
            <span className="text-xs mt-1">Home</span>
          </button>
          <button
            onClick={() => navigate('/users')}
            className="flex flex-col items-center p-2 text-gray-600 hover:text-purple-600"
          >
            <Users className="w-6 h-6" />
            <span className="text-xs mt-1">People</span>
          </button>
          <button
            onClick={() => navigate('/courses')}
            className="flex flex-col items-center p-2 text-gray-600 hover:text-purple-600"
          >
            <BookOpen className="w-6 h-6" />
            <span className="text-xs mt-1">Courses</span>
          </button>
          <button
            onClick={() => navigate('/audio-rooms')}
            className="flex flex-col items-center p-2 text-gray-600 hover:text-purple-600"
          >
            <Mic className="w-6 h-6" />
            <span className="text-xs mt-1">Rooms</span>
          </button>
          <button
            onClick={() => navigate('/messages')}
            className="flex flex-col items-center p-2 text-gray-600 hover:text-purple-600"
          >
            <Mail className="w-6 h-6" />
            <span className="text-xs mt-1">Messages</span>
          </button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6 grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Left Sidebar - Quick Actions */}
        <div className="lg:col-span-1">
          <div className="bg-white/70 backdrop-blur-md rounded-2xl shadow-lg p-6 mb-6">
            <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center">
              <Music className="w-6 h-6 mr-2" />
              Quick Access
            </h2>
            <div className="space-y-3">
              <button
                onClick={() => navigate('/users')}
                className="w-full bg-blue-500 hover:bg-blue-600 text-white px-4 py-3 rounded-lg flex items-center gap-3 transition-colors"
              >
                <Users className="w-5 h-5" />
                Discover Musicians
              </button>
              <button
                onClick={() => navigate('/courses')}
                className="w-full bg-orange-500 hover:bg-orange-600 text-white px-4 py-3 rounded-lg flex items-center gap-3 transition-colors"
              >
                <BookOpen className="w-5 h-5" />
                Browse Courses
              </button>
              <button
                onClick={() => navigate('/audio-rooms')}
                className="w-full bg-green-500 hover:bg-green-600 text-white px-4 py-3 rounded-lg flex items-center gap-3 transition-colors"
              >
                <Mic className="w-5 h-5" />
                Join Audio Rooms
              </button>
              <button
                onClick={() => navigate('/original-home')}
                className="w-full bg-purple-500 hover:bg-purple-600 text-white px-4 py-3 rounded-lg flex items-center gap-3 transition-colors"
              >
                <Music className="w-5 h-5" />
                Practice Instruments
              </button>
              <button
                onClick={() => navigate('/messages')}
                className="w-full bg-pink-500 hover:bg-pink-600 text-white px-4 py-3 rounded-lg flex items-center gap-3 transition-colors"
              >
                <Mail className="w-5 h-5" />
                Messages
              </button>
            </div>
          </div>

          {/* Virtual Instruments Preview */}
          <div className="bg-white/70 backdrop-blur-md rounded-2xl shadow-lg p-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">Practice Online</h3>
            <div className="grid grid-cols-2 gap-3">
              {instruments.slice(0, 4).map((instrument) => (
                <button
                  key={instrument.name}
                  onClick={() => window.open(instrument.virtualLink, '_blank')}
                  className="bg-gradient-to-r from-purple-100 to-pink-100 hover:from-purple-200 hover:to-pink-200 p-3 rounded-lg transition-all transform hover:scale-105 text-center"
                >
                  <img
                    src={instrument.image}
                    alt={instrument.name}
                    className="w-12 h-12 mx-auto mb-2 object-contain"
                  />
                  <p className="text-xs font-medium capitalize text-gray-700">{instrument.name}</p>
                </button>
              ))}
            </div>
            <button
              onClick={() => navigate('/original-home')}
              className="w-full mt-4 text-purple-600 hover:text-purple-700 text-sm font-medium"
            >
              View All Instruments →
            </button>
          </div>
        </div>

        {/* Main Content - Social Feed */}
        <div className="lg:col-span-2">
          <div className="space-y-6">
            {feed.length === 0 ? (
              <div className="bg-white/70 backdrop-blur-md rounded-2xl shadow-lg p-8 text-center">
                <Music className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-gray-700 mb-2">
                  {activeTab === 'following' ? 'No posts from people you follow' : 'Welcome to Music Universe!'}
                </h3>
                <p className="text-gray-500 mb-6">
                  {activeTab === 'following' 
                    ? 'Start following other musicians to see their posts here!' 
                    : 'Be the first to share something with the community!'}
                </p>
                <div className="flex flex-col sm:flex-row gap-3 justify-center">
                  <button
                    onClick={() => activeTab === 'following' ? navigate('/users') : setShowCreatePost(true)}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg"
                  >
                    {activeTab === 'following' ? 'Find Musicians' : 'Create First Post'}
                  </button>
                  <button
                    onClick={() => activeTab === 'following' ? setShowCreatePost(true) : navigate('/users')}
                    className="bg-purple-600 hover:bg-purple-700 text-white px-6 py-3 rounded-lg"
                  >
                    {activeTab === 'following' ? 'Share Your First Post' : 'Find Musicians'}
                  </button>
                </div>
              </div>
            ) : (
              feed.map((post) => (
                <div key={post.id} className="bg-white/70 backdrop-blur-md rounded-2xl shadow-lg hover:shadow-xl transition-all">
                  {/* Post Header */}
                  <div className="p-6 pb-3">
                    <div 
                      className="flex items-center cursor-pointer group"
                      onClick={() => navigate(`/user-profile/${post.userId}`)}
                    >
                      {post.userInfo?.profilePic ? (
                        <img 
                          src={post.userInfo.profilePic} 
                          alt={post.userInfo.displayName}
                          className="w-12 h-12 rounded-full object-cover"
                        />
                      ) : (
                        <div className="w-12 h-12 rounded-full bg-purple-200 flex items-center justify-center">
                          <User className="w-6 h-6 text-purple-600" />
                        </div>
                      )}
                      <div className="ml-4">
                        <h4 className="font-semibold text-gray-800 group-hover:text-purple-600 transition-colors">
                          {post.userName}
                        </h4>
                        <p className="text-sm text-gray-500">
                          {post.timestamp?.toDate ? post.timestamp.toDate().toLocaleDateString() : 'Recently'}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Post Content */}
                  <div className="px-6 pb-4">
                    <p className="text-gray-800 whitespace-pre-wrap leading-relaxed">{post.content}</p>
                  </div>

                  {/* Post Media */}
                  {post.mediaUrl && (
                    <div className="px-6 pb-4">
                      <img 
                        src={post.mediaUrl} 
                        alt="Post media"
                        className="rounded-xl max-h-96 w-full object-cover"
                      />
                    </div>
                  )}

                  {/* Post Actions */}
                  <div className="px-6 py-4 border-t border-gray-200 flex justify-around">
                    <button className="flex items-center gap-2 text-gray-600 hover:text-red-500 transition-colors py-2 px-4 rounded-lg hover:bg-red-50">
                      <Heart className="w-5 h-5" />
                      <span className="text-sm font-medium">Like</span>
                    </button>
                    <button className="flex items-center gap-2 text-gray-600 hover:text-blue-500 transition-colors py-2 px-4 rounded-lg hover:bg-blue-50">
                      <MessageCircle className="w-5 h-5" />
                      <span className="text-sm font-medium">Comment</span>
                    </button>
                    <button className="flex items-center gap-2 text-gray-600 hover:text-green-500 transition-colors py-2 px-4 rounded-lg hover:bg-green-50">
                      <Share2 className="w-5 h-5" />
                      <span className="text-sm font-medium">Share</span>
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
          
          {/* Bottom padding for mobile navigation */}
          <div className="pb-20 sm:pb-0"></div>
        </div>

        {/* Right Sidebar - Trending & Suggestions */}
        <div className="lg:col-span-1">
          <div className="bg-white/70 backdrop-blur-md rounded-2xl shadow-lg p-6 mb-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">🔥 Trending</h3>
            <div className="space-y-3">
              <div className="p-3 bg-gradient-to-r from-purple-50 to-pink-50 rounded-lg">
                <p className="text-sm font-medium text-gray-800">#GuitarTips</p>
                <p className="text-xs text-gray-600">152 posts today</p>
              </div>
              <div className="p-3 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg">
                <p className="text-sm font-medium text-gray-800">#PianoChallenge</p>
                <p className="text-xs text-gray-600">89 posts today</p>
              </div>
              <div className="p-3 bg-gradient-to-r from-green-50 to-teal-50 rounded-lg">
                <p className="text-sm font-medium text-gray-800">#VocalTraining</p>
                <p className="text-xs text-gray-600">64 posts today</p>
              </div>
            </div>
          </div>

          <div className="bg-white/70 backdrop-blur-md rounded-2xl shadow-lg p-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">💡 Quick Tips</h3>
            <div className="space-y-4">
              <div className="p-3 bg-yellow-50 rounded-lg border-l-4 border-yellow-400">
                <p className="text-sm text-gray-700">
                  Practice for 15 minutes daily for better results than 2 hours once a week!
                </p>
              </div>
              <div className="p-3 bg-blue-50 rounded-lg border-l-4 border-blue-400">
                <p className="text-sm text-gray-700">
                  Record yourself playing to identify areas for improvement.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Create Post Modal */}
      {showCreatePost && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200 flex justify-between items-center">
              <h2 className="text-xl font-semibold text-gray-800">Share Your Musical Journey</h2>
              <button
                onClick={() => {
                  setShowCreatePost(false);
                  setPostContent('');
                  setPostImage(null);
                }}
                className="text-gray-500 hover:text-gray-700 p-2 hover:bg-gray-100 rounded-full"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <textarea
                value={postContent}
                onChange={(e) => setPostContent(e.target.value)}
                placeholder="What's happening in your musical world? Share a tip, achievement, or question..."
                className="w-full p-4 border border-gray-200 rounded-xl resize-none focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                rows="4"
              />

              {postImage && (
                <div className="relative">
                  <img 
                    src={URL.createObjectURL(postImage)} 
                    alt="Preview"
                    className="rounded-xl max-h-64 w-full object-cover"
                  />
                  <button
                    onClick={() => setPostImage(null)}
                    className="absolute top-3 right-3 bg-black bg-opacity-50 text-white rounded-full p-2 hover:bg-opacity-70"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}

              <div className="flex justify-between items-center">
                <label className="cursor-pointer text-purple-600 hover:text-purple-700 p-2 hover:bg-purple-50 rounded-full">
                  <Image className="w-6 h-6" />
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageSelect}
                    className="hidden"
                  />
                </label>

                <button
                  onClick={handleCreatePost}
                  disabled={(!postContent.trim() && !postImage) || uploadingPost}
                  className="bg-purple-600 hover:bg-purple-700 disabled:bg-gray-400 text-white px-8 py-3 rounded-xl font-semibold transition-colors"
                >
                  {uploadingPost ? 'Sharing...' : 'Share Post'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Create Story Modal */}
      {showCreateStory && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200 flex justify-between items-center">
              <h2 className="text-xl font-semibold text-gray-800">Share Your Story</h2>
              <button
                onClick={() => {
                  setShowCreateStory(false);
                  setStoryText('');
                  setStoryImage(null);
                }}
                className="text-gray-500 hover:text-gray-700 p-2 hover:bg-gray-100 rounded-full"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <textarea
                value={storyText}
                onChange={(e) => setStoryText(e.target.value)}
                placeholder="What's happening in your musical world? Share a quick update..."
                className="w-full p-4 border border-gray-200 rounded-xl resize-none focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                rows="3"
              />

              {storyImage && (
                <div className="relative">
                  <img 
                    src={URL.createObjectURL(storyImage)} 
                    alt="Story preview"
                    className="rounded-xl max-h-64 w-full object-cover"
                  />
                  <button
                    onClick={() => setStoryImage(null)}
                    className="absolute top-3 right-3 bg-black bg-opacity-50 text-white rounded-full p-2 hover:bg-opacity-70"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}

              <div className="flex justify-between items-center">
                <label className="cursor-pointer text-purple-600 hover:text-purple-700 p-2 hover:bg-purple-50 rounded-full">
                  <Camera className="w-6 h-6" />
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleStoryImageSelect}
                    className="hidden"
                  />
                </label>

                <button
                  onClick={handleCreateStory}
                  disabled={(!storyText.trim() && !storyImage) || uploadingStory}
                  className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 disabled:from-gray-400 disabled:to-gray-400 text-white px-8 py-3 rounded-xl font-semibold transition-all"
                >
                  {uploadingStory ? 'Sharing...' : 'Share Story'}
                </button>
              </div>

              <div className="text-center">
                <p className="text-xs text-gray-500">
                  🔥 Stories disappear after 24 hours
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Story Viewer */}
      {showStoryViewer && currentStoryUser && stories[currentStoryUser] && (
        <div className="fixed inset-0 bg-black z-50 flex items-center justify-center">
          <div className="relative w-full h-full max-w-md mx-auto bg-black">
            {/* Story Header */}
            <div className="absolute top-0 left-0 right-0 z-10 p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {stories[currentStoryUser].userInfo?.profilePic ? (
                    <img
                      src={stories[currentStoryUser].userInfo.profilePic}
                      alt={stories[currentStoryUser].userInfo.displayName}
                      className="w-10 h-10 rounded-full object-cover border-2 border-white"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
                      <User className="w-6 h-6 text-white" />
                    </div>
                  )}
                  <div>
                    <h3 className="text-white font-semibold">
                      {stories[currentStoryUser].userInfo?.displayName || 'User'}
                    </h3>
                    <p className="text-white/70 text-sm">
                      {stories[currentStoryUser].stories[currentStoryIndex]?.timestamp?.toDate?.()?.toLocaleDateString() || 'Recently'}
                    </p>
                  </div>
                </div>
                <button
                  onClick={closeStoryViewer}
                  className="text-white hover:text-gray-300 p-2"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
              
              {/* Progress indicators */}
              <div className="flex gap-1 mt-4">
                {stories[currentStoryUser].stories.map((_, index) => (
                  <div
                    key={index}
                    className={`h-1 flex-1 rounded-full ${
                      index <= currentStoryIndex ? 'bg-white' : 'bg-white/30'
                    }`}
                  />
                ))}
              </div>
            </div>

            {/* Story Content */}
            <div className="relative w-full h-full flex items-center justify-center bg-gradient-to-br from-purple-900 to-pink-900">
              {stories[currentStoryUser].stories[currentStoryIndex]?.mediaUrl ? (
                <img
                  src={stories[currentStoryUser].stories[currentStoryIndex].mediaUrl}
                  alt="Story"
                  className="max-w-full max-h-full object-contain"
                />
              ) : (
                <div className="text-center px-8">
                  <div className="text-2xl mb-4">🎵</div>
                  <p className="text-white text-lg font-medium leading-relaxed">
                    {stories[currentStoryUser].stories[currentStoryIndex]?.text}
                  </p>
                </div>
              )}
              
              {/* Navigation Areas */}
              <button
                onClick={() => {
                  if (currentStoryIndex > 0) {
                    setCurrentStoryIndex(currentStoryIndex - 1);
                  }
                }}
                className="absolute left-0 top-0 w-1/3 h-full bg-transparent"
                disabled={currentStoryIndex === 0}
              />
              
              <button
                onClick={() => {
                  if (currentStoryIndex < stories[currentStoryUser].stories.length - 1) {
                    setCurrentStoryIndex(currentStoryIndex + 1);
                  } else {
                    closeStoryViewer();
                  }
                }}
                className="absolute right-0 top-0 w-2/3 h-full bg-transparent"
              />
            </div>
            
            {/* Navigation Arrows */}
            {currentStoryIndex > 0 && (
              <button
                onClick={() => setCurrentStoryIndex(currentStoryIndex - 1)}
                className="absolute left-4 top-1/2 transform -translate-y-1/2 text-white hover:text-gray-300 p-2 bg-black/20 rounded-full"
              >
                <ChevronLeft className="w-6 h-6" />
              </button>
            )}
            
            {currentStoryIndex < stories[currentStoryUser].stories.length - 1 && (
              <button
                onClick={() => setCurrentStoryIndex(currentStoryIndex + 1)}
                className="absolute right-4 top-1/2 transform -translate-y-1/2 text-white hover:text-gray-300 p-2 bg-black/20 rounded-full"
              >
                <ChevronRight className="w-6 h-6" />
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default SocialHomePage;
