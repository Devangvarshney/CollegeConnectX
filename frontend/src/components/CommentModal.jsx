import React, { useState } from 'react';
import { X, Send, User } from 'lucide-react';
import { useAuth, API_BASE, getMediaUrl } from '../context/AuthContext';

export default function CommentModal({ post, onClose, onCommentAdded }) {
  const { apiCall } = useAuth();
  const [commentText, setCommentText] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!commentText.trim() || submitting) return;

    setSubmitting(true);
    try {
      const res = await apiCall(`/api/posts/${post.id}/comment`, {
        method: 'POST',
        body: { text: commentText }
      });

      if (res.ok) {
        setCommentText('');
        onCommentAdded(); // Refresh post comments
      }
    } catch (err) {
      console.error("Error adding comment:", err);
    } finally {
      setSubmitting(false);
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    let formattedStr = dateStr;
    if (!dateStr.endsWith('Z') && !dateStr.includes('+')) {
      formattedStr = dateStr + 'Z';
    }
    const d = new Date(formattedStr);
    return d.toLocaleString('en-IN', {
      timeZone: 'Asia/Kolkata',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-3xl overflow-hidden shadow-2xl border border-slate-100 dark:border-slate-800 flex flex-col max-h-[85vh] animate-fade-in">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800/60">
          <h3 className="font-bold text-slate-800 dark:text-slate-100 text-base">Discussion</h3>
          <button 
            onClick={onClose}
            className="p-1.5 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-6">
          
          {/* Target Post Preview */}
          <div className="flex gap-3.5 bg-slate-50 dark:bg-slate-950/40 p-4 rounded-2xl border border-slate-100 dark:border-slate-800/40">
            <div className="w-9 h-9 rounded-full overflow-hidden shrink-0">
              {post.user.avatar ? (
                <img 
                  src={getMediaUrl(post.user.avatar)} 
                  alt={post.user.username} 
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full bg-slate-400 text-white flex items-center justify-center font-bold text-sm">
                  {post.user.username.slice(0, 1).toUpperCase()}
                </div>
              )}
            </div>
            <div>
              <p className="font-semibold text-slate-800 dark:text-slate-250 text-xs">@{post.user.username}</p>
              <p className="text-slate-600 dark:text-slate-350 text-sm mt-1 leading-relaxed">{post.text}</p>
            </div>
          </div>

          {/* Comment List */}
          <div className="flex flex-col gap-4">
            <h4 className="font-bold text-slate-400 dark:text-slate-500 text-xs uppercase tracking-wider">Replies ({post.comments?.length || 0})</h4>
            
            {post.comments && post.comments.length > 0 ? (
              <div className="flex flex-col gap-4">
                {post.comments.map((c) => (
                  <div key={c.id} className="flex gap-3 text-sm">
                    <div className="w-8 h-8 rounded-full overflow-hidden shrink-0 ring-1 ring-slate-100 dark:ring-slate-800/40">
                      {c.user.avatar ? (
                        <img 
                          src={getMediaUrl(c.user.avatar)} 
                          alt={c.user.username} 
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full bg-slate-200 dark:bg-slate-800 text-slate-500 dark:text-slate-400 flex items-center justify-center font-bold text-xs">
                          {c.user.username.slice(0, 1).toUpperCase()}
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <span className="font-bold text-slate-700 dark:text-slate-200 text-xs">@{c.user.username}</span>
                        <span className="text-[10px] text-slate-400 dark:text-slate-500">{formatDate(c.created_at)}</span>
                      </div>
                      <p className="text-slate-600 dark:text-slate-300 text-xs leading-relaxed">{c.text}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-slate-400 dark:text-slate-500 text-xs text-center py-6">Be the first to reply!</p>
            )}
          </div>
        </div>

        {/* Input Footer Form */}
        <form onSubmit={handleSubmit} className="p-4 border-t border-slate-100 dark:border-slate-800/60 bg-slate-50/50 dark:bg-slate-950/20 flex gap-2 items-center">
          <input
            type="text"
            value={commentText}
            onChange={(e) => setCommentText(e.target.value)}
            placeholder="Write a reply..."
            className="flex-1 px-4 py-2.5 rounded-xl text-xs glass-input"
            required
            disabled={submitting}
          />
          <button 
            type="submit"
            className="p-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold flex items-center justify-center shadow-md shadow-indigo-600/10 transition-colors shrink-0 disabled:opacity-50"
            disabled={submitting || !commentText.trim()}
          >
            <Send className="w-4 h-4" />
          </button>
        </form>

      </div>
    </div>
  );
}
