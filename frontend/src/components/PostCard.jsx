import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Heart, MessageCircle, Share2, Edit2, Trash2, Check, X, Clock } from 'lucide-react';
import { useAuth, API_BASE, getMediaUrl } from '../context/AuthContext';

export default function PostCard({ post, onUpdate, onCommentClick }) {
  const { user, apiCall } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [editVal, setEditVal] = useState(post.text);
  const [likeState, setLikeState] = useState({
    liked: post.is_liked,
    count: post.likes_count
  });

  const handleLike = async () => {
    if (!user) return;
    try {
      const res = await apiCall(`/api/posts/${post.id}/like`, { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        setLikeState({
          liked: data.liked,
          count: data.count
        });
      }
    } catch (err) {
      console.error("Error liking post:", err);
    }
  };

  const handleShare = () => {
    const shareUrl = `${window.location.origin}/post/${post.id}`;
    navigator.clipboard.writeText(shareUrl);
    alert("Post link copied to clipboard!");
  };

  const handleDelete = async () => {
    if (!window.confirm("Are you sure you want to delete this post?")) return;
    try {
      const res = await apiCall(`/api/posts/${post.id}`, { method: 'DELETE' });
      if (res.ok) {
        onUpdate(); // Trigger parent reload
      }
    } catch (err) {
      console.error("Error deleting post:", err);
    }
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    if (!editVal.trim()) return;
    try {
      const res = await apiCall(`/api/posts/${post.id}`, {
        method: 'PUT',
        body: { text: editVal }
      });
      if (res.ok) {
        setIsEditing(false);
        onUpdate(); // Trigger parent reload
      }
    } catch (err) {
      console.error("Error editing post:", err);
    }
  };

  // Helper to format date
  const formatDate = (dateStr) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  return (
    <article className="p-5 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800/60 rounded-3xl shadow-sm hover:shadow-md dark:hover:shadow-none hover:border-slate-200/60 dark:hover:border-slate-700/60 transition-all duration-200 flex gap-4">
      {/* User Avatar */}
      <Link to={`/profile/${post.user.username}`} className="w-11 h-11 rounded-full overflow-hidden shrink-0 ring-2 ring-slate-100 dark:ring-slate-800/40 hover:scale-105 transition-transform">
        {post.user.avatar ? (
          <img 
            src={getMediaUrl(post.user.avatar)} 
            alt={post.user.username} 
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-indigo-500 to-purple-600 text-white flex items-center justify-center font-bold uppercase text-base">
            {post.user.username.slice(0, 1)}
          </div>
        )}
      </Link>

      <div className="flex-1 min-w-0">
        {/* Post Header */}
        <div className="flex items-center justify-between gap-2 mb-1.5">
          <div className="flex flex-wrap items-center gap-1.5 text-sm">
            <Link to={`/profile/${post.user.username}`} className="font-bold text-slate-800 dark:text-slate-100 hover:text-indigo-600 hover:underline truncate">
              {post.user.username}
            </Link>
            <span className="text-slate-400 dark:text-slate-500 text-xs">@{post.user.username}</span>
            <span className="text-slate-300 dark:text-slate-700 text-xs">•</span>
            <span className="text-slate-400 dark:text-slate-500 text-xs flex items-center gap-1">
              <Clock className="w-3.5 h-3.5" />
              {formatDate(post.created_at)}
            </span>
          </div>

          {/* Author Controls */}
          {user && user.id === post.user_id && !isEditing && (
            <div className="flex items-center gap-1">
              <button 
                onClick={() => setIsEditing(true)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                title="Edit Post"
              >
                <Edit2 className="w-4 h-4" />
              </button>
              <button 
                onClick={handleDelete}
                className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                title="Delete Post"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>

        {/* Post Text Content */}
        {isEditing ? (
          <form onSubmit={handleEditSubmit} className="mt-2 flex flex-col gap-2">
            <textarea
              value={editVal}
              onChange={(e) => setEditVal(e.target.value)}
              className="w-full p-3 rounded-2xl border border-indigo-200 dark:border-indigo-900/60 bg-white dark:bg-slate-950 focus:ring-4 focus:ring-indigo-100 dark:focus:ring-indigo-950/20 outline-none text-slate-800 dark:text-slate-100 text-sm"
              rows="3"
              required
            />
            <div className="flex justify-end gap-2">
              <button 
                type="button" 
                onClick={() => { setIsEditing(false); setEditVal(post.text); }}
                className="p-2 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
              <button 
                type="submit"
                className="p-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg shadow-indigo-600/10 transition-colors"
              >
                <Check className="w-4 h-4" />
              </button>
            </div>
          </form>
        ) : (
          <p className="text-slate-700 dark:text-slate-205 text-[14px] leading-relaxed whitespace-pre-wrap">{post.text}</p>
        )}

        {/* Media Attachments */}
        {post.photo && (
          <div className="mt-3 rounded-2xl overflow-hidden border border-slate-100 dark:border-slate-800/60 max-h-96 shadow-sm bg-slate-50 dark:bg-slate-950">
            <img 
              src={getMediaUrl(post.photo)} 
              alt="Attached Media" 
              className="w-full max-h-96 object-cover"
            />
          </div>
        )}
        
        {post.video && (
          <div className="mt-3 rounded-2xl overflow-hidden border border-slate-100 dark:border-slate-800/60 max-h-96 shadow-sm bg-black">
            <video 
              controls 
              className="w-full max-h-96 object-contain"
            >
              <source src={getMediaUrl(post.video)} />
              Your browser does not support the video tag.
            </video>
          </div>
        )}

        {/* Action Buttons Footer */}
        <div className="flex items-center justify-between max-w-sm mt-4 text-slate-400 dark:text-slate-500">
          {/* Comment Action */}
          <button 
            onClick={() => onCommentClick && onCommentClick(post)}
            className="flex items-center gap-1.5 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors py-1 px-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800"
          >
            <MessageCircle className="w-4.5 h-4.5" />
            <span className="text-xs font-semibold">{post.comments?.length || 0}</span>
          </button>

          {/* Like Action */}
          <button 
            onClick={handleLike}
            className={`flex items-center gap-1.5 transition-colors py-1 px-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 ${likeState.liked ? 'text-rose-500 font-bold' : 'hover:text-rose-500 dark:hover:text-rose-400'}`}
          >
            <Heart className={`w-4.5 h-4.5 ${likeState.liked ? 'fill-rose-500' : ''}`} />
            <span className="text-xs font-semibold">{likeState.count}</span>
          </button>

          {/* Share Action */}
          <button 
            onClick={handleShare}
            className="flex items-center gap-1.5 hover:text-green-500 transition-colors py-1 px-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800"
            title="Copy Link"
          >
            <Share2 className="w-4.5 h-4.5" />
          </button>
        </div>
      </div>
    </article>
  );
}
