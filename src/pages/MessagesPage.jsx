import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { auth, db, getMessages, sendMessageRequest, acceptMessageRequest, rejectMessageRequest, getUserProfile, getPosts, getStoriesGroupedByUser } from '../firebase';
import { collection, onSnapshot, query, where, orderBy } from 'firebase/firestore';
import { 
  Mail, 
  Send, 
  Check, 
  X, 
  MessageCircle, 
  User, 
  Phone, 
  Video, 
  MoreVertical, 
  UserX, 
  Shield, 
  MinusCircle,
  Home,
  Settings,
  EyeOff,
  Volume2,
  VolumeX,
  Maximize,
  Minimize,
  Grid3x3,
  Maximize2,
  Heart,
  Play,
  Camera
} from 'lucide-react';

const MessagesPage = () => {
  const navigate = useNavigate();
  const [conversations, setConversations] = useState([]);
  const [activeChat, setActiveChat] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [activeTab, setActiveTab] = useState('accepted');
  const [showChatOptions, setShowChatOptions] = useState(false);
  const [showFeedSidebar, setShowFeedSidebar] = useState(true); // Default to true for split view
  const [viewMode, setViewMode] = useState('split'); // 'split', 'messages-only', 'feed-focus'
  const [viewModeNotification, setViewModeNotification] = useState('');
  const [feedPosts, setFeedPosts] = useState([]);
  const [loadingFeed, setLoadingFeed] = useState(false);
  const [stories, setStories] = useState({});
  const [isInCall, setIsInCall] = useState(false);
  const [callType, setCallType] = useState(null); // 'audio' or 'video'
  const [callPeer, setCallPeer] = useState(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const currentUserId = auth.currentUser?.uid;

  // Close options menu when clicking elsewhere
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (showChatOptions && !event.target.closest('.options-menu')) {
        setShowChatOptions(false);
      }
    };
    
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [showChatOptions]);

  // Load feed posts when sidebar is shown
  useEffect(() => {
    if (showFeedSidebar && viewMode === 'split') {
      loadFeedPosts();
    }
  }, [showFeedSidebar, viewMode]);

  useEffect(() => {
    if (!currentUserId) return;

    // Listen to messages in real-time
    const q = query(
      collection(db, 'messages'),
      where('participants', 'array-contains', currentUserId),
      orderBy('timestamp', 'desc')
    );

    const unsubscribe = onSnapshot(q, async (snapshot) => {
      const messageGroups = {};
      
      // Group messages by conversation
      for (const doc of snapshot.docs) {
        const data = { id: doc.id, ...doc.data() };
        const otherUserId = data.senderId === currentUserId ? data.receiverId : data.senderId;
        
        if (!messageGroups[otherUserId]) {
          messageGroups[otherUserId] = {
            userId: otherUserId,
            messages: [],
            lastMessage: data,
            status: data.status
          };
        }
        
        messageGroups[otherUserId].messages.push(data);
        
        // If this message is more recent, update last message
        if (!messageGroups[otherUserId].lastMessage.timestamp || 
            data.timestamp > messageGroups[otherUserId].lastMessage.timestamp) {
          messageGroups[otherUserId].lastMessage = data;
          messageGroups[otherUserId].status = data.status;
        }
      }

      // Fetch user info for each conversation
      const conversationsWithUserInfo = await Promise.all(
        Object.values(messageGroups).map(async (convo) => {
          const userProfile = await getUserProfile(convo.userId);
          return {
            ...convo,
            userInfo: userProfile
          };
        })
      );

      setConversations(conversationsWithUserInfo);
    });

    return () => unsubscribe();
  }, [currentUserId]);

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !activeChat) return;

    await sendMessageRequest({
      senderId: currentUserId,
      receiverId: activeChat.userId,
      content: newMessage,
      participants: [currentUserId, activeChat.userId]
    });

    setNewMessage('');
  };

  const handleAcceptRequest = async (messageId) => {
    await acceptMessageRequest(messageId);
  };

  const handleStartCall = (type) => {
    if (!activeChat) return;
    setCallType(type);
    setCallPeer(activeChat.userInfo);
    setIsInCall(true);
    setShowChatOptions(false);
    // In a real implementation, this would initiate WebRTC connection
  };

  const handleEndCall = () => {
    setIsInCall(false);
    setCallType(null);
    setCallPeer(null);
    setIsMuted(false);
    setIsVideoOff(false);
  };

  const handleRemoveFriend = async () => {
    if (!activeChat) return;
    // Implementation would remove from friends list
    console.log('Remove friend:', activeChat.userId);
    setShowChatOptions(false);
  };

  const handleBlockUser = async () => {
    if (!activeChat) return;
    // Implementation would block user
    console.log('Block user:', activeChat.userId);
    setShowChatOptions(false);
  };

  const toggleMute = () => {
    setIsMuted(!isMuted);
  };

  const toggleVideo = () => {
    setIsVideoOff(!isVideoOff);
  };

  const toggleViewMode = () => {
    if (viewMode === 'split') {
      setViewMode('messages-only');
      setShowFeedSidebar(false);
      setViewModeNotification('Switched to Messages Only view');
    } else if (viewMode === 'messages-only') {
      setViewMode('split');
      setShowFeedSidebar(true);
      setViewModeNotification('Switched to Split View (Messages + Feed)');
    }
    
    // Clear notification after 3 seconds
    setTimeout(() => setViewModeNotification(''), 3000);
  };

  const focusOnFeed = () => {
    setViewMode('feed-focus');
    navigate('/home');
  };

  const loadFeedPosts = async () => {
    if (loadingFeed) return;
    setLoadingFeed(true);
    try {
      // Load posts
      const posts = await getPosts(); // Get recent posts
      const postsWithUserInfo = await Promise.all(
        posts.slice(0, 8).map(async (post) => {
          const postUser = await getUserProfile(post.userId);
          return { ...post, userInfo: postUser };
        })
      );
      setFeedPosts(postsWithUserInfo);
      
      // Load stories
      const storiesData = await getStoriesGroupedByUser();
      const storiesWithUserInfo = {};
      for (const [userId, userStories] of Object.entries(storiesData)) {
        const userInfo = await getUserProfile(userId);
        storiesWithUserInfo[userId] = {
          userInfo,
          stories: userStories
        };
      }
      setStories(storiesWithUserInfo);
    } catch (error) {
      console.error('Error loading feed content:', error);
    } finally {
      setLoadingFeed(false);
    }
  };

  const filteredConversations = conversations.filter(convo => {
    if (activeTab === 'accepted') {
      return convo.status === 'accepted';
    } else {
      return convo.status === 'pending' && convo.lastMessage.receiverId === currentUserId;
    }
  });

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <div className="flex justify-between items-center">
            <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
              <Mail className="w-6 h-6 text-purple-600" />
              Messages
            </h1>
            <div className="flex items-center gap-3">
              {/* View Mode Controls */}
              <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
                <button
                  onClick={toggleViewMode}
                  className={`p-2 rounded-md transition-all flex items-center gap-2 text-sm font-medium ${
                    viewMode === 'split' 
                      ? 'bg-white text-purple-600 shadow-sm'
                      : 'text-gray-600 hover:text-gray-800'
                  }`}
                  title={viewMode === 'split' ? 'Messages Only' : 'Split View'}
                >
                  {viewMode === 'split' ? (
                    <>
                      <Maximize2 className="w-4 h-4" />
                      <span className="hidden sm:inline">Split View</span>
                    </>
                  ) : (
                    <>
                      <Maximize className="w-4 h-4" />
                      <span className="hidden sm:inline">Messages Only</span>
                    </>
                  )}
                </button>
                <button
                  onClick={focusOnFeed}
                  className="p-2 rounded-md text-gray-600 hover:text-gray-800 transition-all flex items-center gap-2 text-sm font-medium"
                  title="Focus on Feed"
                >
                  <Home className="w-4 h-4" />
                  <span className="hidden sm:inline">Feed Focus</span>
                </button>
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-4 mt-4 border-b">
            <button
              onClick={() => setActiveTab('accepted')}
              className={`pb-2 px-1 ${
                activeTab === 'accepted'
                  ? 'border-b-2 border-purple-600 text-purple-600 font-medium'
                  : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              Conversations
            </button>
            <button
              onClick={() => setActiveTab('pending')}
              className={`pb-2 px-1 ${
                activeTab === 'pending'
                  ? 'border-b-2 border-purple-600 text-purple-600 font-medium'
                  : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              Message Requests
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className={`mx-auto px-4 py-6 ${
        viewMode === 'messages-only' ? 'max-w-6xl' : 'max-w-7xl'
      }`}>
        <div className={`grid gap-6 h-[600px] ${
          viewMode === 'messages-only' 
            ? 'grid-cols-1 md:grid-cols-3'
            : viewMode === 'split' && showFeedSidebar 
              ? 'grid-cols-1 lg:grid-cols-5' 
              : 'grid-cols-1 md:grid-cols-3'
        }`}>
          {/* Conversations List */}
          <div className={`bg-white rounded-lg shadow overflow-hidden ${
            viewMode === 'messages-only'
              ? 'md:col-span-1'
              : viewMode === 'split' && showFeedSidebar 
                ? 'lg:col-span-1'
                : 'md:col-span-1'
          }`}>
            <div className="p-4 border-b">
              <h2 className="font-semibold text-gray-800">
                {activeTab === 'accepted' ? 'Conversations' : 'Pending Requests'}
              </h2>
            </div>
            <div className="overflow-y-auto h-full">
              {filteredConversations.length === 0 ? (
                <div className="p-8 text-center text-gray-500">
                  <MessageCircle className="w-12 h-12 text-gray-300 mx-auto mb-2" />
                  <p>{activeTab === 'accepted' ? 'No conversations yet' : 'No pending requests'}</p>
                </div>
              ) : (
                filteredConversations.map((convo) => (
                  <div
                    key={convo.userId}
                    onClick={() => setActiveChat(convo)}
                    className={`p-4 border-b cursor-pointer hover:bg-gray-50 ${
                      activeChat?.userId === convo.userId ? 'bg-purple-50' : ''
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      {convo.userInfo?.profilePic ? (
                        <img
                          src={convo.userInfo.profilePic}
                          alt={convo.userInfo.displayName}
                          className="w-12 h-12 rounded-full object-cover"
                        />
                      ) : (
                        <div className="w-12 h-12 rounded-full bg-purple-200 flex items-center justify-center">
                          <User className="w-6 h-6 text-purple-600" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <h3 className="font-medium text-gray-800 truncate">
                          {convo.userInfo?.displayName || 'Unknown User'}
                        </h3>
                        <p className="text-sm text-gray-600 truncate">
                          {convo.lastMessage.content}
                        </p>
                        <p className="text-xs text-gray-500 mt-1">
                          {convo.lastMessage.timestamp?.toDate?.()?.toLocaleDateString() || 'Recently'}
                        </p>
                      </div>
                      {activeTab === 'pending' && (
                        <div className="flex gap-1">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleAcceptRequest(convo.lastMessage.id);
                            }}
                            className="p-1 bg-green-100 text-green-600 rounded hover:bg-green-200"
                          >
                            <Check className="w-4 h-4" />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              rejectMessageRequest(convo.lastMessage.id);
                            }}
                            className="p-1 bg-red-100 text-red-600 rounded hover:bg-red-200"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Chat Area */}
          <div className={`bg-white rounded-lg shadow overflow-hidden flex flex-col ${
            viewMode === 'messages-only'
              ? 'md:col-span-2'
              : viewMode === 'split' && showFeedSidebar 
                ? 'lg:col-span-2'
                : 'md:col-span-2'
          }`}>
            {activeChat ? (
              <>
                {/* Chat Header */}
                <div className="p-4 border-b bg-gray-50">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {activeChat.userInfo?.profilePic ? (
                        <img
                          src={activeChat.userInfo.profilePic}
                          alt={activeChat.userInfo.displayName}
                          className="w-10 h-10 rounded-full object-cover"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-purple-200 flex items-center justify-center">
                          <User className="w-5 h-5 text-purple-600" />
                        </div>
                      )}
                      <div>
                        <h3 className="font-semibold text-gray-800">
                          {activeChat.userInfo?.displayName || 'Unknown User'}
                        </h3>
                        <p className="text-sm text-green-500">Online</p>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      {/* Browse Feed Button */}
                      <button
                        onClick={() => {
                          if (viewMode === 'messages-only') {
                            setViewMode('split');
                            setShowFeedSidebar(true);
                          } else {
                            setShowFeedSidebar(!showFeedSidebar);
                          }
                        }}
                        className={`p-2 rounded-full transition-colors ${
                          showFeedSidebar && viewMode === 'split'
                            ? 'text-purple-600 bg-purple-50'
                            : 'text-gray-600 hover:text-purple-600 hover:bg-purple-50'
                        }`}
                        title={showFeedSidebar && viewMode === 'split' ? 'Hide Feed' : 'Browse Feed'}
                      >
                        <Home className="w-5 h-5" />
                      </button>
                      
                      {/* Audio Call Button */}
                      <button
                        onClick={() => handleStartCall('audio')}
                        className="p-2 text-gray-600 hover:text-green-600 hover:bg-green-50 rounded-full transition-colors"
                        title="Audio Call"
                      >
                        <Phone className="w-5 h-5" />
                      </button>
                      
                      {/* Video Call Button */}
                      <button
                        onClick={() => handleStartCall('video')}
                        className="p-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-full transition-colors"
                        title="Video Call"
                      >
                        <Video className="w-5 h-5" />
                      </button>
                      
                      {/* Options Menu */}
                      <div className="relative options-menu">
                        <button
                          onClick={() => setShowChatOptions(!showChatOptions)}
                          className="p-2 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-full transition-colors"
                        >
                          <MoreVertical className="w-5 h-5" />
                        </button>
                        
                        {showChatOptions && (
                          <div className="absolute right-0 top-full mt-2 bg-white rounded-lg shadow-lg border py-2 z-10 min-w-48">
                            <button
                              onClick={handleRemoveFriend}
                              className="w-full px-4 py-2 text-left text-orange-600 hover:bg-orange-50 flex items-center gap-2"
                            >
                              <MinusCircle className="w-4 h-4" />
                              Remove Friend
                            </button>
                            <button
                              onClick={handleBlockUser}
                              className="w-full px-4 py-2 text-left text-red-600 hover:bg-red-50 flex items-center gap-2"
                            >
                              <Shield className="w-4 h-4" />
                              Block User
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Messages */}
                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                  {activeChat.messages.map((msg) => (
                    <div
                      key={msg.id}
                      className={`flex ${msg.senderId === currentUserId ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className={`max-w-xs md:max-w-md px-4 py-2 rounded-lg ${
                          msg.senderId === currentUserId
                            ? 'bg-purple-600 text-white'
                            : 'bg-gray-200 text-gray-800'
                        }`}
                      >
                        <p>{msg.content}</p>
                        <p className={`text-xs mt-1 ${
                          msg.senderId === currentUserId ? 'text-purple-200' : 'text-gray-500'
                        }`}>
                          {msg.timestamp?.toDate?.()?.toLocaleTimeString() || 'Just now'}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Message Input */}
                {activeChat.status === 'accepted' ? (
                  <div className="p-4 border-t">
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                        placeholder="Type a message..."
                        className="flex-1 px-4 py-2 border rounded-lg focus:outline-none focus:border-purple-500"
                      />
                      <button
                        onClick={handleSendMessage}
                        className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg"
                      >
                        <Send className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="p-4 border-t bg-yellow-50 text-center">
                    <p className="text-yellow-800">Accept this message request to start chatting</p>
                  </div>
                )}
              </>
            ) : (
              <div className="flex items-center justify-center h-full text-gray-500">
                <div className="text-center">
                  <MessageCircle className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                  <p>Select a conversation to start chatting</p>
                </div>
              </div>
            )}
          </div>
          
          {/* Feed Sidebar */}
          {viewMode === 'split' && showFeedSidebar && (
            <div className="lg:col-span-2 bg-white rounded-lg shadow overflow-hidden">
              <div className="p-4 border-b bg-purple-50">
                <h3 className="font-semibold text-gray-800">Browse Feed</h3>
              </div>
              <div className="overflow-y-auto h-full">
                {/* Stories Section */}
                {Object.keys(stories).length > 0 && (
                  <div className="p-4 border-b">
                    <h4 className="text-sm font-medium text-gray-600 mb-3">Stories</h4>
                    <div className="flex gap-3 overflow-x-auto scrollbar-hide">
                      {Object.entries(stories).slice(0, 5).map(([userId, storyData]) => (
                        <div key={userId} className="flex-shrink-0 text-center">
                          <button className="relative w-12 h-12 rounded-full p-0.5 bg-gradient-to-r from-purple-500 via-pink-500 to-red-500 hover:scale-105 transition-transform">
                            {storyData.userInfo?.profilePic ? (
                              <img
                                src={storyData.userInfo.profilePic}
                                alt={storyData.userInfo.displayName}
                                className="w-full h-full rounded-full object-cover border border-white"
                              />
                            ) : (
                              <div className="w-full h-full rounded-full bg-purple-200 flex items-center justify-center border border-white">
                                <User className="w-4 h-4 text-purple-600" />
                              </div>
                            )}
                          </button>
                          <p className="text-xs text-gray-600 mt-1 truncate w-12">
                            {storyData.userInfo?.displayName?.split(' ')[0] || 'User'}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                
                {/* Posts Section */}
                <div className="p-4">
                {loadingFeed ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {feedPosts.length === 0 ? (
                      <div className="text-center py-8 text-gray-500">
                        <MessageCircle className="w-12 h-12 text-gray-300 mx-auto mb-2" />
                        <p className="text-sm">No posts available</p>
                      </div>
                    ) : (
                      feedPosts.map((post) => (
                        <div key={post.id} className="bg-gray-50 rounded-lg p-4 hover:bg-gray-100 transition-colors cursor-pointer"
                             onClick={() => navigate(`/user-profile/${post.userId}`)}>
                          <div className="flex items-center gap-3 mb-3">
                            {post.userInfo?.profilePic ? (
                              <img
                                src={post.userInfo.profilePic}
                                alt={post.userInfo.displayName}
                                className="w-8 h-8 rounded-full object-cover"
                              />
                            ) : (
                              <div className="w-8 h-8 rounded-full bg-purple-200 flex items-center justify-center">
                                <User className="w-4 h-4 text-purple-600" />
                              </div>
                            )}
                            <div>
                              <p className="font-medium text-sm text-gray-800">
                                {post.userInfo?.displayName || post.userName || 'Unknown User'}
                              </p>
                              <p className="text-xs text-gray-500">
                                {post.timestamp?.toDate?.()?.toLocaleDateString() || 'Recently'}
                              </p>
                            </div>
                          </div>
                          <p className="text-sm text-gray-700 mb-2" 
                             style={{
                               display: '-webkit-box',
                               WebkitLineClamp: 3,
                               WebkitBoxOrient: 'vertical',
                               overflow: 'hidden'
                             }}>
                            {post.content}
                          </p>
                          {post.mediaUrl && (
                            <img
                              src={post.mediaUrl}
                              alt="Post media"
                              className="w-full rounded-lg mt-2 max-h-32 object-cover"
                            />
                          )}
                          <div className="flex items-center gap-4 mt-3 text-xs text-gray-500">
                            <div className="flex items-center gap-1">
                              <Heart className="w-3 h-3" />
                              <span>{post.likes?.length || 0}</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <MessageCircle className="w-3 h-3" />
                              <span>{post.comments?.length || 0}</span>
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                    
                    <div className="text-center py-4">
                      <button
                        onClick={() => navigate('/home')}
                        className="text-purple-600 hover:text-purple-700 text-sm font-medium"
                      >
                        View Full Feed →
                      </button>
                    </div>
                  </div>
                )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
      
      {/* View Mode Notification */}
      {viewModeNotification && (
        <div className="fixed top-20 left-1/2 transform -translate-x-1/2 bg-purple-600 text-white px-6 py-3 rounded-lg shadow-lg z-40 transition-all">
          <div className="flex items-center gap-2">
            <Grid3x3 className="w-5 h-5" />
            <span className="font-medium">{viewModeNotification}</span>
          </div>
        </div>
      )}
      
      {/* Call Interface */}
      {isInCall && (
        <div className="fixed inset-0 bg-black bg-opacity-90 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full mx-4">
            {/* Call Header */}
            <div className="p-6 text-center">
              {callPeer?.profilePic ? (
                <img
                  src={callPeer.profilePic}
                  alt={callPeer.displayName}
                  className="w-24 h-24 rounded-full object-cover mx-auto mb-4"
                />
              ) : (
                <div className="w-24 h-24 rounded-full bg-purple-200 flex items-center justify-center mx-auto mb-4">
                  <User className="w-12 h-12 text-purple-600" />
                </div>
              )}
              <h2 className="text-xl font-semibold text-gray-800 mb-2">
                {callPeer?.displayName || 'Unknown User'}
              </h2>
              <p className="text-gray-600">
                {callType === 'video' ? 'Video Call' : 'Audio Call'} • 00:42
              </p>
            </div>
            
            {/* Video Area for Video Calls */}
            {callType === 'video' && (
              <div className="px-6 pb-4">
                <div className="bg-gray-900 rounded-lg aspect-video flex items-center justify-center">
                  {isVideoOff ? (
                    <div className="text-white text-center">
                      <EyeOff className="w-12 h-12 mx-auto mb-2" />
                      <p>Video is off</p>
                    </div>
                  ) : (
                    <div className="text-white text-center">
                      <Video className="w-12 h-12 mx-auto mb-2" />
                      <p>Video call active</p>
                    </div>
                  )}
                </div>
              </div>
            )}
            
            {/* Call Controls */}
            <div className="p-6 border-t">
              <div className="flex justify-center gap-4">
                {/* Mute Button */}
                <button
                  onClick={toggleMute}
                  className={`p-3 rounded-full transition-colors ${
                    isMuted 
                      ? 'bg-red-100 text-red-600 hover:bg-red-200' 
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                  title={isMuted ? 'Unmute' : 'Mute'}
                >
                  {isMuted ? <VolumeX className="w-6 h-6" /> : <Volume2 className="w-6 h-6" />}
                </button>
                
                {/* Video Toggle (for video calls) */}
                {callType === 'video' && (
                  <button
                    onClick={toggleVideo}
                    className={`p-3 rounded-full transition-colors ${
                      isVideoOff 
                        ? 'bg-red-100 text-red-600 hover:bg-red-200' 
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                    title={isVideoOff ? 'Turn on video' : 'Turn off video'}
                  >
                    {isVideoOff ? <EyeOff className="w-6 h-6" /> : <Video className="w-6 h-6" />}
                  </button>
                )}
                
                {/* End Call Button */}
                <button
                  onClick={handleEndCall}
                  className="p-3 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors"
                  title="End Call"
                >
                  <Phone className="w-6 h-6 transform rotate-[135deg]" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MessagesPage;
