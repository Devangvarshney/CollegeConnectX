import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import RightPanel from '../components/RightPanel';
import PostCard from '../components/PostCard';
import CommentModal from '../components/CommentModal';
import { useAuth, API_BASE, getMediaUrl } from '../context/AuthContext';
import { MapPin, Calendar, Edit3, ArrowLeft, Loader2, Sparkles, Plus, Check, LogOut, X } from 'lucide-react';

export default function Profile() {
  const { username } = useParams();
  const navigate = useNavigate();
  const { user, token, apiCall, fetchCurrentUser, logout } = useAuth();
  
  const [profileData, setProfileData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeCommentPost, setActiveCommentPost] = useState(null);
  
  // Followers/Following modal state
  const [activeStatsModal, setActiveStatsModal] = useState(null); // 'followers', 'following', or null
  const [statsModalUsers, setStatsModalUsers] = useState([]);
  const [loadingStats, setLoadingStats] = useState(false);
  
  // Edit Profile overlay state
  const [isEditing, setIsEditing] = useState(false);
  const [editBio, setEditBio] = useState('');
  const [editLoc, setEditLoc] = useState('');
  const [editAvatar, setEditAvatar] = useState(null);
  const [avatarPreview, setAvatarPreview] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);

  const fetchProfile = async () => {
    setLoading(true);
    try {
      const res = await apiCall(`/api/users/profile/${username}`);
      if (res.ok) {
        const data = await res.json();
        setProfileData(data);
        // Pre-fill edit inputs
        setEditBio(data.profile.bio);
        setEditLoc(data.profile.location);
        setAvatarPreview(data.profile.avatar ? getMediaUrl(data.profile.avatar) : '');
      } else {
        // Redirect to Home if not found
        navigate('/');
      }
    } catch (err) {
      console.error("Error fetching profile:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenStatsModal = async (type) => {
    setActiveStatsModal(type);
    setLoadingStats(true);
    setStatsModalUsers([]);
    try {
      const res = await apiCall(`/api/users/${type}/${username}`);
      if (res.ok) {
        const data = await res.json();
        setStatsModalUsers(data);
      }
    } catch (err) {
      console.error(`Error fetching ${type}:`, err);
    } finally {
      setLoadingStats(false);
    }
  };

  useEffect(() => {
    fetchProfile();
  }, [username, token]);

  const handleFollowToggle = async () => {
    if (!token) return;
    try {
      const res = await apiCall(`/api/users/follow/${username}`, { method: 'POST' });
      if (res.ok) {
        fetchProfile(); // Reload profile details
      }
    } catch (err) {
      console.error("Error toggling follow:", err);
    }
  };

  const handleAvatarChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setEditAvatar(file);
      setAvatarPreview(URL.createObjectURL(file));
    }
  };

  const handleProfileSave = async (e) => {
    e.preventDefault();
    setSavingProfile(true);

    try {
      const formData = new FormData();
      formData.append('bio', editBio);
      formData.append('location', editLoc);
      if (editAvatar) {
        formData.append('avatar', editAvatar);
      }

      const res = await apiCall('/api/users/profile', {
        method: 'PUT',
        body: formData
      });

      if (res.ok) {
        setIsEditing(false);
        await fetchCurrentUser(); // Refresh local auth user state
        fetchProfile(); // Refresh current profile view
      }
    } catch (err) {
      console.error("Error saving profile:", err);
    } finally {
      setSavingProfile(false);
    }
  };

  const handleStartDM = async () => {
    try {
      const res = await apiCall(`/api/messages/start/${username}`, { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        navigate(`/messages?room=${data.convo_id}`);
      }
    } catch (err) {
      console.error("Error starting conversation:", err);
    }
  };

  const refreshActiveCommentPost = async () => {
    if (!activeCommentPost) return;
    try {
      const res = await apiCall(`/api/users/profile/${username}`);
      if (res.ok) {
        const data = await res.json();
        setProfileData(data);
        const updated = data.tweets.find(p => p.id === activeCommentPost.id);
        if (updated) {
          setActiveCommentPost(updated);
        }
      }
    } catch (err) {
      console.error("Error updating comments modal:", err);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex max-w-7xl mx-auto">
        <Sidebar />
        <main className="flex-1 border-r border-slate-100 dark:border-slate-800/60 flex items-center justify-center bg-white dark:bg-slate-950">
          <div className="flex flex-col items-center gap-2 text-slate-400">
            <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
            <span className="text-sm">Loading user profile...</span>
          </div>
        </main>
        <RightPanel onFollowToggle={fetchProfile} />
      </div>
    );
  }

  const isOwner = user && user.username === username;

  return (
    <div className="min-h-screen flex max-w-7xl mx-auto">
      {/* Left Sidebar */}
      <Sidebar />

      {/* Center Profile View */}
      <main className="flex-1 border-r border-slate-100 dark:border-slate-800/60 flex flex-col min-w-0 bg-white dark:bg-slate-950 pb-20 md:pb-0">
        
        {/* Header Bar */}
        <div className="h-16 px-6 border-b border-slate-100 dark:border-slate-800/60 flex items-center gap-4 sticky top-0 bg-white/80 dark:bg-slate-950/80 backdrop-blur-md z-10">
          <button 
            onClick={() => navigate(-1)} 
            className="p-2 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-850 text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h2 className="font-extrabold text-slate-800 dark:text-slate-100 text-base leading-tight">@{profileData.username}</h2>
            <p className="text-[10px] text-slate-400 dark:text-slate-500 font-medium">{profileData.tweets.length} Posts</p>
          </div>
        </div>

        {/* Profile Card Banner */}
        <div className="relative">
          <div className="h-36 bg-gradient-to-r from-indigo-500 to-purple-600"></div>
          
          <div className="px-6 pb-6">
            <div className="flex justify-between items-end -mt-16 mb-4">
              {/* Profile Avatar */}
              <div className="w-28 h-28 rounded-full border-4 border-white dark:border-slate-900 overflow-hidden bg-slate-200 dark:bg-slate-800 shadow-md ring-4 ring-slate-100 dark:ring-slate-800/60">
                {profileData.profile.avatar ? (
                  <img 
                    src={getMediaUrl(profileData.profile.avatar)} 
                    alt={profileData.username} 
                    className="w-full h-full object-cover" 
                  />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-indigo-400 to-purple-600 text-white flex items-center justify-center font-bold text-3xl uppercase">
                    {profileData.username.slice(0, 1)}
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex gap-2">
                {isOwner ? (
                  <>
                    <button
                      onClick={() => setIsEditing(true)}
                      className="py-2 px-4 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-900 font-bold text-xs flex items-center gap-1.5 transition-colors"
                    >
                      <Edit3 className="w-4 h-4" />
                      <span>Edit Profile</span>
                    </button>
                    <button
                      onClick={logout}
                      className="md:hidden py-2 px-4 rounded-xl border border-rose-250 dark:border-rose-955/40 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-955/20 font-bold text-xs flex items-center gap-1.5 transition-colors"
                    >
                      <LogOut className="w-4 h-4" />
                      <span>Logout</span>
                    </button>
                  </>
                ) : token ? (
                  <>
                    <button
                      onClick={handleStartDM}
                      className="py-2 px-4 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-900 font-bold text-xs transition-colors"
                    >
                      Message
                    </button>
                    <button
                      onClick={handleFollowToggle}
                      className={`py-2 px-4 rounded-xl font-bold text-xs transition-all ${
                        profileData.is_following 
                          ? 'border border-indigo-200 dark:border-indigo-900/60 bg-indigo-50 dark:bg-indigo-950/20 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-950/40' 
                          : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-md shadow-indigo-600/10'
                      }`}
                    >
                      {profileData.is_following ? 'Following' : 'Follow'}
                    </button>
                  </>
                ) : null}
              </div>
            </div>

            {/* Profile Info */}
            <div className="flex flex-col gap-2">
              <div>
                <h1 className="font-extrabold text-2xl text-slate-800 dark:text-slate-100 tracking-tight flex items-center gap-1.5">
                  <span>{profileData.username}</span>
                  {profileData.is_mutual && (
                    <span className="text-[9px] font-bold bg-indigo-100 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-400 py-0.5 px-2 rounded-full uppercase tracking-wider">Mutual Connect</span>
                  )}
                </h1>
                <p className="text-slate-400 dark:text-slate-500 text-xs">@{profileData.username}</p>
              </div>

              {profileData.profile.bio ? (
                <p className="text-slate-600 dark:text-slate-300 text-sm mt-1 leading-relaxed">{profileData.profile.bio}</p>
              ) : (
                <p className="text-slate-400 dark:text-slate-500 text-xs italic mt-1">No bio added yet.</p>
              )}

              {/* Metadata */}
              <div className="flex items-center gap-4 text-xs text-slate-400 dark:text-slate-500 mt-2">
                {profileData.profile.location && (
                  <span className="flex items-center gap-1">
                    <MapPin className="w-4 h-4 text-slate-300 dark:text-slate-600" />
                    {profileData.profile.location}
                  </span>
                )}
                <span className="flex items-center gap-1">
                  <Calendar className="w-4 h-4 text-slate-300 dark:text-slate-600" />
                  Classmate
                </span>
              </div>

              {/* Stats */}
              <div className="flex gap-4 mt-3 text-sm text-slate-700 dark:text-slate-400">
                <span onClick={() => handleOpenStatsModal('following')} className="hover:underline cursor-pointer">
                  <strong className="font-bold text-slate-800 dark:text-slate-100">{profileData.following_count}</strong> Following
                </span>
                <span onClick={() => handleOpenStatsModal('followers')} className="hover:underline cursor-pointer">
                  <strong className="font-bold text-slate-800 dark:text-slate-100">{profileData.followers_count}</strong> Followers
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Tab content boundary */}
        <div className="border-t border-slate-100 dark:border-slate-800/60 flex-1 bg-slate-50/30 dark:bg-slate-900/10 p-6 flex flex-col gap-6">
          <h3 className="font-extrabold text-slate-800 dark:text-slate-200 text-sm border-b border-slate-100 dark:border-slate-800/60 pb-2">Timeline</h3>

          {/* Posts Feed */}
          {profileData.tweets.length > 0 ? (
            <div className="flex flex-col gap-5">
              {profileData.tweets.map((post) => (
                <PostCard
                  key={post.id}
                  post={post}
                  onUpdate={fetchProfile}
                  onCommentClick={(p) => setActiveCommentPost(p)}
                />
              ))}
            </div>
          ) : (
            <div className="text-center py-20 border border-dashed border-slate-200 dark:border-slate-800/65 rounded-3xl bg-slate-50/50 dark:bg-slate-900/10">
              <p className="text-slate-500 dark:text-slate-350 font-semibold">No posts yet</p>
              <p className="text-slate-400 dark:text-slate-500 text-xs mt-1">When this classmate shares, it'll show up here.</p>
            </div>
          )}
        </div>
      </main>

      {/* Right widgets panel */}
      <RightPanel onFollowToggle={fetchProfile} />

      {/* Edit Profile Modal */}
      {isEditing && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <form onSubmit={handleProfileSave} className="bg-white dark:bg-slate-900 w-full max-w-md rounded-3xl p-6 shadow-2xl border border-slate-100 dark:border-slate-800 flex flex-col gap-4 animate-fade-in">
            <h3 className="font-bold text-slate-800 dark:text-slate-100 text-lg">Edit Profile Details</h3>
            
            {/* Avatar Selector */}
            <div className="flex items-center gap-4 py-2 border-b border-slate-50 dark:border-slate-800/60">
              <div className="w-16 h-16 rounded-full overflow-hidden bg-slate-100 dark:bg-slate-850 shrink-0">
                {avatarPreview ? (
                  <img src={avatarPreview} alt="Avatar Preview" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full bg-slate-300 dark:bg-slate-800 text-slate-500 dark:text-slate-400 flex items-center justify-center font-bold uppercase text-xl">
                    {user?.username.slice(0, 1)}
                  </div>
                )}
              </div>
              <div>
                <label className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 cursor-pointer">
                  Upload Avatar
                  <input type="file" accept="image/*" onChange={handleAvatarChange} hidden />
                </label>
                <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1">Recommend 200x200 square image</p>
              </div>
            </div>

            {/* Inputs */}
            <div className="flex flex-col gap-1">
              <label className="text-xs font-bold text-slate-500 dark:text-slate-400">Bio</label>
              <textarea
                value={editBio}
                onChange={(e) => setEditBio(e.target.value)}
                placeholder="Share something about yourself (e.g. Major, Hobbies, Clubs)"
                className="w-full p-3 rounded-xl text-xs glass-input"
                rows="3"
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs font-bold text-slate-500 dark:text-slate-400">Location</label>
              <input
                type="text"
                value={editLoc}
                onChange={(e) => setEditLoc(e.target.value)}
                placeholder="e.g. Dorm 4B, Off-campus, library"
                className="w-full px-3 py-2.5 rounded-xl text-xs glass-input"
              />
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-2 border-t border-slate-100 dark:border-slate-800/60 pt-4 mt-2">
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={savingProfile}
                className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-md shadow-indigo-600/10 flex items-center gap-1.5"
              >
                {savingProfile ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    <span>Save Changes</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Reply Modal */}
      {activeCommentPost && (
        <CommentModal
          post={activeCommentPost}
          onClose={() => setActiveCommentPost(null)}
          onCommentAdded={refreshActiveCommentPost}
        />
      )}

      {/* Followers / Following Modal */}
      {activeStatsModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 w-full max-w-sm rounded-3xl p-6 shadow-2xl border border-slate-100 dark:border-slate-800 flex flex-col gap-4 animate-fade-in">
            <div className="flex justify-between items-center border-b border-slate-50 dark:border-slate-800/60 pb-2">
              <h3 className="font-bold text-slate-800 dark:text-slate-100 text-base capitalize">
                {activeStatsModal}
              </h3>
              <button 
                type="button" 
                onClick={() => setActiveStatsModal(null)}
                className="p-1 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-805 text-slate-400 dark:text-slate-550"
              >
                <X className="w-4.5 h-4.5" />
              </button>
            </div>

            <div className="max-h-64 overflow-y-auto min-h-24 flex flex-col gap-2">
              {loadingStats ? (
                <div className="flex items-center justify-center flex-1 py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-indigo-600" />
                </div>
              ) : statsModalUsers.length > 0 ? (
                statsModalUsers.map((u) => (
                  <div 
                    key={u.id}
                    onClick={() => {
                      setActiveStatsModal(null);
                      navigate(`/profile/${u.username}`);
                    }}
                    className="flex items-center gap-3.5 p-2 rounded-2xl hover:bg-slate-50 dark:hover:bg-slate-850/60 cursor-pointer transition-all"
                  >
                    <div className="w-9 h-9 rounded-full overflow-hidden shrink-0 ring-1 ring-slate-100 dark:ring-slate-800/40">
                      {u.avatar ? (
                        <img 
                          src={getMediaUrl(u.avatar)} 
                          alt={u.username} 
                          className="w-full h-full object-cover" 
                        />
                      ) : (
                        <div className="w-full h-full bg-gradient-to-br from-indigo-500 to-purple-600 text-white flex items-center justify-center font-bold text-sm uppercase">
                          {u.username.slice(0, 1)}
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-slate-850 dark:text-slate-205 text-xs font-bold truncate">@{u.username}</p>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-10 text-slate-400 dark:text-slate-500 text-xs italic">
                  No {activeStatsModal} found.
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
