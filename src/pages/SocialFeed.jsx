import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { auth, getUserProfile, getFeedPosts, getPosts, createPost, createUserProfile } from '../firebase';
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
  X
} from 'lucide-react';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from '../firebase';

const SocialFeed = () => {
  const navigate = useNavigate();
  const [feed, setFeed] = useState([]);
  const [userProfile, setUserProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showCreatePost, setShowCreatePost] = useState(false);
  const [postContent, setPostContent] = useState('');
  const [postImage, setPostImage] = useState(null);
  const [uploadingPost, setUploadingPost] = useState(false);
  const [activeTab, setActiveTab] = useState('feed');

  useEffect(() => {
    loadFeedData();
  }, [activeTab]);

  const loadFeedData = async () => {
    const userId = auth.currentUser?.uid;
    if (!userId) {
      navigate('/login');
      return;
    }

    try {
      setLoading(true);
      const profile = await getUserProfile(userId);
      
      if (!profile) {
        // Create user profile if it doesn't exist
        await createUserProfile(userId, {
          displayName: auth.currentUser.displayName || auth.currentUser.email,
          profilePic: auth.currentUser.photoURL || null,
          email: auth.currentUser.email
        });
      }
      
      setUserProfile(profile);

      let posts = [];
      if (activeTab === 'feed' && profile?.following?.length > 0) {
        posts = await getFeedPosts(profile.following);
      } else if (activeTab === 'explore') {
        posts = await getPosts(); // Get all recent posts
      }

      // Fetch user info for each post
      const postsWithUserInfo = await Promise.all(
        posts.map(async (post) => {
          const postUser = await getUserProfile(post.userId);
          return {
            ...post,
            userInfo: postUser
          };
        })
      );

      setFeed(postsWithUserInfo);
    } catch (error) {
      console.error('Error loading feed:', error);
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
      loadFeedData(); // Reload feed
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

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-3">
          <div className="flex justify-between items-center">
            <h1 className="text-2xl font-bold text-purple-800">🎵 Music Network</h1>
            <div className="flex gap-4">
              <button
                onClick={() => setShowCreatePost(true)}
                className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg flex items-center gap-2"
              >
                <PlusCircle className="w-5 h-5" />
                Create Post
              </button>
              <button
                onClick={() => navigate('/home')}
                className="text-gray-600 hover:text-gray-800"
              >
                <Home className="w-6 h-6" />
              </button>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-6 mt-4 border-b">
            <button
              onClick={() => setActiveTab('feed')}
              className={`pb-2 px-1 ${
                activeTab === 'feed'
                  ? 'border-b-2 border-purple-600 text-purple-600 font-medium'
                  : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              Following
            </button>
            <button
              onClick={() => setActiveTab('explore')}
              className={`pb-2 px-1 ${
                activeTab === 'explore'
                  ? 'border-b-2 border-purple-600 text-purple-600 font-medium'
                  : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              Explore
            </button>
          </div>
        </div>
      </div>

      {/* Navigation Bar */}
      <div className="bg-white shadow-sm border-t mt-4">
        <div className="max-w-4xl mx-auto px-4 py-2">
          <div className="flex justify-around">
            <button
              onClick={() => navigate('/social-feed')}
              className="flex flex-col items-center p-2 text-purple-600"
            >
              <Music className="w-6 h-6" />
              <span className="text-xs mt-1">Feed</span>
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
              onClick={() => navigate('/messages')}
              className="flex flex-col items-center p-2 text-gray-600 hover:text-purple-600"
            >
              <Mail className="w-6 h-6" />
              <span className="text-xs mt-1">Messages</span>
            </button>
            <button
              onClick={() => navigate(`/user-profile/${auth.currentUser?.uid}`)}
              className="flex flex-col items-center p-2 text-gray-600 hover:text-purple-600"
            >
              <div className="w-6 h-6 rounded-full bg-purple-200 flex items-center justify-center">
                <span className="text-xs font-bold text-purple-800">
                  {auth.currentUser?.displayName?.charAt(0) || 'U'}
                </span>
              </div>
              <span className="text-xs mt-1">Profile</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-4xl mx-auto px-4 py-6">
        {/* Feed Posts */}
        {feed.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-8 text-center">
            <Music className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-700 mb-2">
              {activeTab === 'feed' ? 'No posts from people you follow' : 'No posts yet'}
            </h3>
            <p className="text-gray-500 mb-4">
              {activeTab === 'feed' 
                ? 'Start following other musicians to see their posts here!' 
                : 'Be the first to share something!'}
            </p>
            <button
              onClick={() => activeTab === 'feed' ? navigate('/users') : setShowCreatePost(true)}
              className="bg-purple-600 hover:bg-purple-700 text-white px-6 py-2 rounded-lg"
            >
              {activeTab === 'feed' ? 'Find People to Follow' : 'Create First Post'}
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {feed.map((post) => (
              <div key={post.id} className="bg-white rounded-lg shadow hover:shadow-md transition-shadow">
                {/* Post Header */}
                <div className="p-4 flex items-center justify-between">
                  <div 
                    className="flex items-center cursor-pointer"
                    onClick={() => navigate(`/user-profile/${post.userId}`)}
                  >
                    {post.userInfo?.profilePic ? (
                      <img 
                        src={post.userInfo.profilePic} 
                        alt={post.userInfo.displayName}
                        className="w-10 h-10 rounded-full object-cover"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-purple-200 flex items-center justify-center">
                        <span className="text-sm font-bold text-purple-800">
                          {post.userName?.charAt(0) || 'U'}
                        </span>
                      </div>
                    )}
                    <div className="ml-3">
                      <h4 className="font-medium text-gray-800 hover:text-purple-600">
                        {post.userName}
                      </h4>
                      <p className="text-xs text-gray-500">
                        {post.timestamp?.toDate ? post.timestamp.toDate().toLocaleDateString() : 'Recently'}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Post Content */}
                <div className="px-4 pb-3">
                  <p className="text-gray-800 whitespace-pre-wrap">{post.content}</p>
                </div>

                {/* Post Media */}
                {post.mediaUrl && (
                  <div className="px-4 pb-3">
                    <img 
                      src={post.mediaUrl} 
                      alt="Post media"
                      className="rounded-lg max-h-96 w-full object-cover"
                    />
                  </div>
                )}

                {/* Post Actions */}
                <div className="px-4 py-3 border-t flex justify-around">
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
            ))}
          </div>
        )}
      </div>

      {/* Create Post Modal */}
      {showCreatePost && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg w-full max-w-lg">
            <div className="p-4 border-b flex justify-between items-center">
              <h2 className="text-lg font-semibold">Create Post</h2>
              <button
                onClick={() => {
                  setShowCreatePost(false);
                  setPostContent('');
                  setPostImage(null);
                }}
                className="text-gray-500 hover:text-gray-700"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="p-4">
              <textarea
                value={postContent}
                onChange={(e) => setPostContent(e.target.value)}
                placeholder="Share your musical journey..."
                className="w-full p-3 border rounded-lg resize-none focus:outline-none focus:border-purple-500"
                rows="4"
              />

              {postImage && (
                <div className="mt-3 relative">
                  <img 
                    src={URL.createObjectURL(postImage)} 
                    alt="Preview"
                    className="rounded-lg max-h-48 w-full object-cover"
                  />
                  <button
                    onClick={() => setPostImage(null)}
                    className="absolute top-2 right-2 bg-black bg-opacity-50 text-white rounded-full p-1"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}

              <div className="mt-4 flex justify-between items-center">
                <label className="cursor-pointer text-purple-600 hover:text-purple-700">
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
                  className="bg-purple-600 hover:bg-purple-700 disabled:bg-gray-400 text-white px-6 py-2 rounded-lg font-medium"
                >
                  {uploadingPost ? 'Posting...' : 'Post'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SocialFeed;
