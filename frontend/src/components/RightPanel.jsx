import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, UserPlus, Check, Flame, Trophy } from 'lucide-react';
import { useAuth, API_BASE, getMediaUrl } from '../context/AuthContext';

export default function RightPanel({ onSearch }) {
  const { token, apiCall } = useAuth();
  const [suggestions, setSuggestions] = useState([]);
  const [searchVal, setSearchVal] = useState('');
  const navigate = useNavigate();

  const fetchSuggestions = async () => {
    if (!token) return;
    try {
      const res = await apiCall('/api/users/suggested');
      if (res.ok) {
        const data = await res.json();
        setSuggestions(data);
      }
    } catch (err) {
      console.error("Error fetching suggestions:", err);
    }
  };

  useEffect(() => {
    fetchSuggestions();
  }, [token]);

  const handleFollowToggle = async (username) => {
    try {
      const res = await apiCall(`/api/users/follow/${username}`, { method: 'POST' });
      if (res.ok) {
        // Remove user from suggestions list
        setSuggestions(prev => prev.filter(u => u.username !== username));
        // If profile details page is open, let's refresh or rely on their state
        if (onSearch) {
          onSearch(); // Refresh parent if needed
        }
      }
    } catch (err) {
      console.error("Error toggling follow:", err);
    }
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    if (onSearch) {
      onSearch(searchVal);
    } else {
      navigate(`/?q=${encodeURIComponent(searchVal)}`);
    }
  };

  return (
    <aside className="hidden lg:flex w-80 h-screen sticky top-0 flex-col gap-6 p-6 border-l border-slate-100 dark:border-slate-800/60 overflow-y-auto shrink-0">
      {/* Search Input */}
      <form onSubmit={handleSearchSubmit} className="relative w-full">
        <input
          type="text"
          value={searchVal}
          onChange={(e) => setSearchVal(e.target.value)}
          placeholder="Search Campus Feed..."
          className="w-full pl-11 pr-4 py-3 rounded-2xl text-sm glass-input"
        />
        <Search className="w-5 h-5 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
      </form>

      {/* Premium Subscription */}
      <div className="p-5 rounded-3xl bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-indigo-950/25 dark:to-purple-950/25 border border-indigo-100/50 dark:border-indigo-900/30 shadow-sm relative overflow-hidden">
        <div className="absolute right-0 bottom-0 translate-x-3 translate-y-3 opacity-10">
          <Trophy className="w-24 h-24 text-indigo-600 dark:text-indigo-400" />
        </div>
        <h3 className="font-bold text-slate-800 dark:text-slate-200 text-base mb-1">Upgrade to ConnectX Gold</h3>
        <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed mb-4">
          Get verified, unlock custom profile themes, and enjoy early access to internship boards.
        </p>
        <button className="w-full py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs shadow-md shadow-indigo-600/10 transition-all">
          Explore Premium
        </button>
      </div>

      {/* Suggestions List */}
      {token && suggestions.length > 0 && (
        <div className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800/60 shadow-sm flex flex-col gap-4">
          <h3 className="font-bold text-slate-800 dark:text-slate-200 text-sm">Suggested Peers</h3>
          <div className="flex flex-col gap-3.5">
            {suggestions.map((u) => (
              <div key={u.id} className="flex items-center justify-between gap-2">
                <div 
                  className="flex items-center gap-2.5 cursor-pointer"
                  onClick={() => navigate(`/profile/${u.username}`)}
                >
                  <div className="w-8.5 h-8.5 rounded-full overflow-hidden shrink-0">
                    {u.avatar ? (
                      <img 
                        src={getMediaUrl(u.avatar)} 
                        alt={u.username} 
                        className="w-full h-full object-cover" 
                      />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-blue-500 to-indigo-500 text-white flex items-center justify-center font-bold text-xs uppercase">
                        {u.username.slice(0, 1)}
                      </div>
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-slate-700 dark:text-slate-200 text-xs truncate hover:underline">{u.username}</p>
                    <p className="text-slate-400 dark:text-slate-500 text-[10px] truncate">@p/{u.username}</p>
                  </div>
                </div>
                
                <button
                  onClick={() => handleFollowToggle(u.username)}
                  className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-slate-800 hover:border-indigo-100 dark:hover:border-slate-700 transition-all shrink-0"
                >
                  <UserPlus className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Campus Highlights / News */}
      <div className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800/60 shadow-sm flex flex-col gap-4">
        <h3 className="font-bold text-slate-800 dark:text-slate-200 text-sm">Campus Highlights</h3>
        <div className="flex flex-col gap-3">
          <div className="flex gap-3 text-xs leading-relaxed">
            <Flame className="w-5 h-5 text-orange-500 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-slate-700 dark:text-slate-200">Hackathon Registrations Open</p>
              <p className="text-slate-400 dark:text-slate-400">Join the annual 48-hour build contest. Prizes up to $5k!</p>
            </div>
          </div>
          <div className="border-t border-slate-100 dark:border-slate-800/60 my-1"></div>
          <div className="flex gap-3 text-xs leading-relaxed">
            <Trophy className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-slate-700 dark:text-slate-200">Sports Carnival Finals</p>
              <p className="text-slate-400 dark:text-slate-400">Basketball finals tonight at the main indoor arena.</p>
            </div>
          </div>
        </div>
      </div>

      {/* Footer info */}
      <div className="px-2 text-[10px] text-slate-400 dark:text-slate-500 leading-normal flex flex-wrap gap-x-1.5 gap-y-1">
        <span>Terms</span>
        <span>•</span>
        <span>Privacy Policy</span>
        <span>•</span>
        <span>Cookies</span>
        <span>•</span>
        <span>Ads Info</span>
        <span>•</span>
        <span>© 2026 CollegeConnectX</span>
      </div>
    </aside>
  );
}
