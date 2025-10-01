import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { auth, db, getUserProfile, followUser, unfollowUser } from '../firebase';
import { collection, getDocs, query, limit } from 'firebase/firestore';
import { Users, Search, UserPlus, UserMinus, Music } from 'lucide-react';

const UsersPage = () => {
  const navigate = useNavigate();
  const [users, setUsers] = useState([]);
  const [currentUserProfile, setCurrentUserProfile] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const currentUserId = auth.currentUser?.uid;

  useEffect(() => {
    loadUsers();
    loadCurrentUserProfile();
  }, []);

  const loadCurrentUserProfile = async () => {
    if (currentUserId) {
      const profile = await getUserProfile(currentUserId);
      setCurrentUserProfile(profile);
    }
  };

  const loadUsers = async () => {
    try {
      setLoading(true);
      const usersQuery = query(collection(db, 'users'), limit(50));
      const snapshot = await getDocs(usersQuery);
      
      const usersList = snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() }))
        .filter(user => user.id !== currentUserId); // Don't show current user
      
      setUsers(usersList);
    } catch (error) {
      console.error('Error loading users:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleFollow = async (targetUserId) => {
    await followUser(currentUserId, targetUserId);
    await loadCurrentUserProfile(); // Reload to update following list
  };

  const handleUnfollow = async (targetUserId) => {
    await unfollowUser(currentUserId, targetUserId);
    await loadCurrentUserProfile(); // Reload to update following list
  };

  const filteredUsers = users.filter(user =>
    user.displayName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const isFollowing = (userId) => {
    return currentUserProfile?.following?.includes(userId) || false;
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
      <div className="bg-white shadow-sm">
        <div className="max-w-6xl mx-auto px-4 py-6">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold text-gray-800 flex items-center gap-3">
                <Users className="w-8 h-8 text-purple-600" />
                Discover Musicians
              </h1>
              <p className="text-gray-600 mt-1">Connect with fellow music enthusiasts</p>
            </div>
            <button
              onClick={() => navigate('/social-feed')}
              className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg flex items-center gap-2"
            >
              <Music className="w-5 h-5" />
              Back to Feed
            </button>
          </div>

          {/* Search Bar */}
          <div className="mt-6 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search users by name or email..."
              className="w-full pl-10 pr-4 py-3 border rounded-lg focus:outline-none focus:border-purple-500"
            />
          </div>
        </div>
      </div>

      {/* Users Grid */}
      <div className="max-w-6xl mx-auto px-4 py-8">
        {filteredUsers.length === 0 ? (
          <div className="text-center py-12">
            <Users className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-700">No users found</h3>
            <p className="text-gray-500 mt-1">Try adjusting your search criteria</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredUsers.map((user) => (
              <div key={user.id} className="bg-white rounded-lg shadow hover:shadow-md transition-shadow p-6">
                <div className="flex items-start justify-between">
                  <div 
                    className="flex items-center cursor-pointer"
                    onClick={() => navigate(`/user-profile/${user.id}`)}
                  >
                    {user.profilePic ? (
                      <img 
                        src={user.profilePic} 
                        alt={user.displayName}
                        className="w-16 h-16 rounded-full object-cover"
                      />
                    ) : (
                      <div className="w-16 h-16 rounded-full bg-purple-200 flex items-center justify-center">
                        <span className="text-xl font-bold text-purple-800">
                          {user.displayName?.charAt(0) || 'U'}
                        </span>
                      </div>
                    )}
                    <div className="ml-4">
                      <h3 className="font-semibold text-gray-800 hover:text-purple-600 transition-colors">
                        {user.displayName || 'Music Lover'}
                      </h3>
                      <p className="text-sm text-gray-500">{user.email}</p>
                      <div className="flex gap-4 mt-1 text-xs text-gray-600">
                        <span>{user.followers?.length || 0} followers</span>
                        <span>{user.following?.length || 0} following</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-4">
                  {isFollowing(user.id) ? (
                    <button
                      onClick={() => handleUnfollow(user.id)}
                      className="w-full bg-gray-200 hover:bg-gray-300 text-gray-800 px-4 py-2 rounded-lg flex items-center justify-center gap-2 transition-colors"
                    >
                      <UserMinus className="w-4 h-4" />
                      Unfollow
                    </button>
                  ) : (
                    <button
                      onClick={() => handleFollow(user.id)}
                      className="w-full bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg flex items-center justify-center gap-2 transition-colors"
                    >
                      <UserPlus className="w-4 h-4" />
                      Follow
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default UsersPage;
