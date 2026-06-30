import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import RightPanel from '../components/RightPanel';
import PostCard from '../components/PostCard';
import CommentModal from '../components/CommentModal';
import { useAuth, API_BASE, getMediaUrl } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { Image, Video, Send, Loader2, Moon, Sun } from 'lucide-react';

export default function Home() {
  const { user, token, apiCall } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [searchParams, setSearchParams] = useSearchParams();
  const query = searchParams.get('q') || '';
  
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  
  // Post inputs
  const [postText, setPostText] = useState('');
  const [postPhoto, setPostPhoto] = useState(null);
  const [postVideo, setPostVideo] = useState(null);
  
  // Previews
  const [photoPreview, setPhotoPreview] = useState('');
  const [videoPreview, setVideoPreview] = useState('');

  // Comment Modal state
  const [activeCommentPost, setActiveCommentPost] = useState(null);

  const fetchPosts = async (searchQuery = query) => {
    setLoading(true);
    try {
      const endpoint = searchQuery ? `/api/posts?q=${encodeURIComponent(searchQuery)}` : '/api/posts';
      const res = await apiCall(endpoint);
      if (res.ok) {
        const data = await res.json();
        setPosts(data);
      }
    } catch (err) {
      console.error("Error fetching posts:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPosts(query);
  }, [query, token]);

  const handleFileChange = (e, type) => {
    const file = e.target.files[0];
    if (!file) return;

    if (type === 'photo') {
      setPostPhoto(file);
      setPhotoPreview(URL.createObjectURL(file));
      // Clear video
      setPostVideo(null);
      setVideoPreview('');
    } else {
      setPostVideo(file);
      setVideoPreview(URL.createObjectURL(file));
      // Clear photo
      setPostPhoto(null);
      setPhotoPreview('');
    }
  };

  const clearAttachments = () => {
    setPostPhoto(null);
    setPhotoPreview('');
    setPostVideo(null);
    setVideoPreview('');
  };

  const handleCreatePost = async (e) => {
    e.preventDefault();
    if (!postText.trim() || submitting) return;

    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('text', postText);
      if (postPhoto) formData.append('photo', postPhoto);
      if (postVideo) formData.append('video', postVideo);

      const res = await apiCall('/api/posts', {
        method: 'POST',
        body: formData
      });

      if (res.ok) {
        setPostText('');
        clearAttachments();
        fetchPosts(query);
      }
    } catch (err) {
      console.error("Error creating post:", err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleSearch = (val) => {
    if (val) {
      setSearchParams({ q: val });
    } else {
      setSearchParams({});
    }
  };

  const refreshActiveCommentPost = async () => {
    if (!activeCommentPost) return;
    try {
      // Re-fetch all posts and find current one to update modal view
      const res = await apiCall('/api/posts');
      if (res.ok) {
        const allPosts = await res.json();
        const updated = allPosts.find(p => p.id === activeCommentPost.id);
        if (updated) {
          setActiveCommentPost(updated);
        }
        // Also refresh feed
        setPosts(allPosts);
      }
    } catch (err) {
      console.error("Error updating comments modal:", err);
    }
  };

  return (
    <div className="min-h-screen flex max-w-7xl mx-auto">
      {/* Left Sidebar */}
      <Sidebar />

      {/* Center Feed */}
      <main className="flex-1 border-r border-slate-100 dark:border-slate-800/60 flex flex-col min-w-0 bg-white dark:bg-slate-950 pb-20 md:pb-0">
        {/* Header */}
        <div className="h-16 px-6 border-b border-slate-100 dark:border-slate-800/60 flex items-center justify-between sticky top-0 bg-white/80 dark:bg-slate-950/80 backdrop-blur-md z-10">
          <h2 className="font-extrabold text-slate-800 dark:text-slate-100 text-lg tracking-tight flex items-center gap-2">
            Home Feed {query && <span className="text-xs bg-indigo-50 dark:bg-indigo-950/35 text-indigo-600 dark:text-indigo-400 py-1 px-2.5 rounded-full font-bold">Search: "{query}"</span>}
          </h2>
          <button
            onClick={toggleTheme}
            className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-900 transition-all duration-300 group"
            title="Toggle Theme"
          >
            {theme === 'dark' ? (
              <Sun className="w-5 h-5 text-amber-500 group-hover:text-amber-600 transition-transform duration-500 group-hover:rotate-45 group-hover:scale-110 active:scale-95" />
            ) : (
              <Moon className="w-5 h-5 text-slate-700 hover:text-indigo-650 transition-transform duration-500 group-hover:-rotate-12 group-hover:scale-110 active:scale-95" />
            )}
          </button>
        </div>

        <div className="p-6 flex flex-col gap-6">
          {/* Create Post Card (Only for authenticated users) */}
          {token && user && (
            <form onSubmit={handleCreatePost} className="p-5 bg-slate-50/50 dark:bg-slate-900/35 border border-slate-200/60 dark:border-slate-800/60 rounded-3xl flex gap-4">
              {/* Avatar */}
              <div className="w-10 h-10 rounded-full overflow-hidden shrink-0 ring-2 ring-indigo-500/20">
                {user.profile?.avatar ? (
                  <img 
                    src={getMediaUrl(user.profile.avatar)} 
                    alt={user.username} 
                    className="w-full h-full object-cover" 
                  />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-indigo-500 to-purple-600 text-white flex items-center justify-center font-bold text-sm uppercase">
                    {user.username.slice(0, 1)}
                  </div>
                )}
              </div>

              {/* Input details */}
              <div className="flex-1 flex flex-col gap-3">
                <textarea
                  value={postText}
                  onChange={(e) => setPostText(e.target.value)}
                  placeholder="What's happening on campus today?"
                  className="w-full bg-transparent border-0 resize-none text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:ring-0 outline-none text-sm leading-relaxed mt-1.5"
                  rows="2"
                  required
                />

                {/* File Previews */}
                {photoPreview && (
                  <div className="relative rounded-2xl overflow-hidden border border-slate-100 dark:border-slate-800 max-h-56 bg-white dark:bg-slate-900">
                    <img src={photoPreview} alt="Upload Preview" className="w-full h-full object-cover" />
                    <button 
                      type="button" 
                      onClick={clearAttachments}
                      className="absolute top-2 right-2 bg-slate-900/60 hover:bg-slate-900/80 text-white p-1 rounded-full"
                    >
                      &times;
                    </button>
                  </div>
                )}
                
                {videoPreview && (
                  <div className="relative rounded-2xl overflow-hidden border border-slate-100 dark:border-slate-800 max-h-56 bg-black">
                    <video src={videoPreview} controls className="w-full h-full object-contain" />
                    <button 
                      type="button" 
                      onClick={clearAttachments}
                      className="absolute top-2 right-2 bg-slate-900/60 hover:bg-slate-900/80 text-white p-1 rounded-full"
                    >
                      &times;
                    </button>
                  </div>
                )}

                <div className="flex justify-between items-center border-t border-slate-200/60 dark:border-slate-800/60 pt-3">
                  {/* File Pickers */}
                  <div className="flex items-center gap-3">
                    <label className="p-2 rounded-xl text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/30 cursor-pointer transition-colors" title="Add Image">
                      <Image className="w-5 h-5" />
                      <input 
                        type="file" 
                        accept="image/*" 
                        onChange={(e) => handleFileChange(e, 'photo')} 
                        hidden 
                      />
                    </label>
                    <label className="p-2 rounded-xl text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-950/30 cursor-pointer transition-colors" title="Add Video">
                      <Video className="w-5 h-5" />
                      <input 
                        type="file" 
                        accept="video/*" 
                        onChange={(e) => handleFileChange(e, 'video')} 
                        hidden 
                      />
                    </label>
                  </div>

                  {/* Submit button */}
                  <button
                    type="submit"
                    disabled={submitting || !postText.trim()}
                    className="py-2 px-5 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-md shadow-indigo-600/10 flex items-center gap-1.5 transition-colors disabled:opacity-50"
                  >
                    {submitting ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <>
                        <span>Post</span>
                        <Send className="w-3.5 h-3.5" />
                      </>
                    )}
                  </button>
                </div>
              </div>
            </form>
          )}

          {/* Feed Content */}
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 text-slate-400 gap-2">
              <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
              <span className="text-sm">Loading campus feed...</span>
            </div>
          ) : posts.length > 0 ? (
            <div className="flex flex-col gap-5">
              {posts.map((post) => (
                <PostCard
                  key={post.id}
                  post={post}
                  onUpdate={fetchPosts}
                  onCommentClick={(p) => setActiveCommentPost(p)}
                />
              ))}
            </div>
          ) : (
            <div className="text-center py-20 border border-dashed border-slate-200 dark:border-slate-800/65 rounded-3xl bg-slate-50/50 dark:bg-slate-900/10">
              <p className="text-slate-500 dark:text-slate-350 font-semibold">No posts found</p>
              <p className="text-slate-400 dark:text-slate-500 text-xs mt-1">Be the first to share something with the campus!</p>
            </div>
          )}
        </div>
      </main>

      {/* Right widgets panel */}
      <RightPanel onSearch={handleSearch} />

      {/* Comment/Reply Modal overlay */}
      {activeCommentPost && (
        <CommentModal
          post={activeCommentPost}
          onClose={() => setActiveCommentPost(null)}
          onCommentAdded={refreshActiveCommentPost}
        />
      )}
    </div>
  );
}
