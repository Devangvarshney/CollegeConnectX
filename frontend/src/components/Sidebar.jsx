import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Home, MessageSquare, Sparkles, User, LogOut, GraduationCap, Sun, Moon, Vote } from 'lucide-react';
import { useAuth, API_BASE, getMediaUrl } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';

export default function Sidebar() {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const location = useLocation();

  const menuItems = [
    { name: 'Home', path: '/', icon: Home },
    { name: 'Community', path: '/messages', icon: MessageSquare },
    { name: 'Elections', path: '/elections', icon: Vote },
    { name: 'Trok AI', path: '/trok', icon: Sparkles },
    { name: 'Profile', path: user ? `/profile/${user.username}` : '#', icon: User },
  ];

  const activeClass = "flex items-center gap-3 px-4 py-3.5 rounded-2xl bg-indigo-600 text-white shadow-lg shadow-indigo-600/20 font-semibold scale-[1.02] transition-all duration-200";
  const inactiveClass = "flex items-center gap-3 px-4 py-3.5 rounded-2xl text-slate-600 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-slate-100/80 dark:hover:bg-slate-900/60 transition-all duration-150 font-medium";

  return (
    <>
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex w-64 h-screen sticky top-0 flex flex-col justify-between p-6 border-r border-slate-100 dark:border-slate-800/60 glass-panel shrink-0">
        <div className="flex flex-col gap-8">
          {/* Brand logo */}
          <Link to="/" className="flex items-center gap-2 px-2">
            <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-lg shadow-indigo-600/30">
              <GraduationCap className="w-6 h-6" />
            </div>
            <div>
              <h1 className="font-extrabold text-xl tracking-tight bg-gradient-to-r from-indigo-600 to-indigo-800 bg-clip-text text-transparent">
                CollegeConnect<span className="text-indigo-500">X</span>
              </h1>
              <span className="text-[10px] text-slate-400 dark:text-slate-500 font-semibold uppercase tracking-wider">Campus Hub</span>
            </div>
          </Link>

          {/* Navigation Items */}
          <nav className="flex flex-col gap-1.5">
            {menuItems.map((item) => {
              const Icon = item.icon;
              const isPathActive = location.pathname === item.path || 
                (item.path.startsWith('/profile') && location.pathname.startsWith('/profile'));
              
              return (
                <Link
                  key={item.name}
                  to={item.path}
                  className={isPathActive ? activeClass : inactiveClass}
                >
                  <Icon className="w-5 h-5" />
                  <span>{item.name}</span>
                </Link>
              );
            })}
          </nav>
        </div>

        {/* User profile footer */}
        {user && (
          <div className="flex flex-col gap-4 border-t border-slate-100 dark:border-slate-800/60 pt-4">
            <div className="flex items-center gap-3 px-2">
              <Link to={`/profile/${user.username}`} className="w-10 h-10 rounded-full overflow-hidden shrink-0 ring-2 ring-indigo-500/20 hover:scale-105 transition-all">
                {user.profile?.avatar ? (
                  <img 
                    src={getMediaUrl(user.profile.avatar)} 
                    alt={user.username} 
                    className="w-full h-full object-cover" 
                  />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-indigo-500 to-purple-600 text-white flex items-center justify-center font-bold uppercase text-sm">
                    {user.username.slice(0, 1)}
                  </div>
                )}
              </Link>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-slate-800 dark:text-slate-100 text-sm truncate">{user.username}</p>
                <p className="text-slate-400 dark:text-slate-500 text-xs truncate">@{user.username}</p>
              </div>
            </div>
            
            <button
              onClick={logout}
              className="flex items-center justify-center gap-2 w-full py-2.5 px-4 rounded-xl border border-rose-200 dark:border-rose-955/40 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-955/20 hover:border-rose-300 font-medium text-sm transition-all"
            >
              <LogOut className="w-4 h-4" />
              <span>Logout</span>
            </button>
          </div>
        )}
      </aside>

      {/* Mobile Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 h-16 bg-white/80 dark:bg-slate-950/80 backdrop-blur-lg border-t border-slate-200/50 dark:border-slate-800/60 md:hidden flex justify-around items-center px-4 z-40">
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isPathActive = location.pathname === item.path || 
            (item.path.startsWith('/profile') && location.pathname.startsWith('/profile'));
          
          return (
            <Link
              key={item.name}
              to={item.path}
              className={isPathActive 
                ? "flex flex-col items-center justify-center gap-0.5 text-indigo-600 dark:text-indigo-400 font-bold transition-all duration-200 scale-105" 
                : "flex flex-col items-center justify-center gap-0.5 text-slate-500 dark:text-slate-400 font-medium hover:text-indigo-500 transition-all duration-150"
              }
            >
              <Icon className="w-5 h-5" />
              <span className="text-[10px]">{item.name}</span>
            </Link>
          );
        })}
      </nav>
    </>
  );
}
