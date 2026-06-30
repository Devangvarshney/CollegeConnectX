import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import { useAuth, API_BASE } from '../context/AuthContext';
import { Plus, Users, Trash2, Send, Edit2, CheckCheck, Check, Smile, Loader2, ArrowLeft, X } from 'lucide-react';

export default function Inbox() {
  const { user, token, apiCall } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const activeRoomId = searchParams.get('room');

  // Lists
  const [conversations, setConversations] = useState([]);
  const [mutualFriends, setMutualFriends] = useState([]);
  
  // Room state
  const [activeConvo, setActiveConvo] = useState(null);
  const [messages, setMessages] = useState([]);
  const [otherUser, setOtherUser] = useState(null);
  const [participants, setParticipants] = useState([]);
  const [msgInput, setMsgInput] = useState('');
  
  // Modals & triggers
  const [isGroupModalOpen, setIsGroupModalOpen] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [selectedFriends, setSelectedFriends] = useState([]);
  const [loadingInbox, setLoadingInbox] = useState(true);
  const [loadingRoom, setLoadingRoom] = useState(false);

  // DM Modal state
  const [isDmModalOpen, setIsDmModalOpen] = useState(false);
  const [dmSearchQuery, setDmSearchQuery] = useState('');
  const [dmSearchResults, setDmSearchResults] = useState([]);
  const [searchingDm, setSearchingDm] = useState(false);
  
  // Auto-scroll helper
  const chatEndRef = useRef(null);

  const fetchInbox = async () => {
    if (!token) return;
    try {
      const res = await apiCall('/api/messages/inbox');
      if (res.ok) {
        const data = await res.json();
        setConversations(data.conversations);
        setMutualFriends(data.mutual_friends);
      }
    } catch (err) {
      console.error("Error fetching inbox:", err);
    } finally {
      setLoadingInbox(false);
    }
  };

  const fetchRoom = async (roomId) => {
    if (!token || !roomId) return;
    setLoadingRoom(true);
    try {
      const res = await apiCall(`/api/messages/room/${roomId}`);
      if (res.ok) {
        const data = await res.json();
        setActiveConvo(data.convo);
        setMessages(data.messages);
        setOtherUser(data.other_user);
        setParticipants(data.participants);
        
        // Mark read
        apiCall(`/api/messages/room/${roomId}/read`, { method: 'POST' });
      } else {
        // Clear param if error
        setSearchParams({});
      }
    } catch (err) {
      console.error("Error fetching room details:", err);
    } finally {
      setLoadingRoom(false);
    }
  };

  useEffect(() => {
    fetchInbox();
  }, [token]);

  useEffect(() => {
    if (activeRoomId) {
      fetchRoom(activeRoomId);
    } else {
      setActiveConvo(null);
      setMessages([]);
      setOtherUser(null);
    }
  }, [activeRoomId]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Debounced search for DM classmates
  useEffect(() => {
    if (!dmSearchQuery.trim()) {
      setDmSearchResults([]);
      return;
    }
    const delayDebounce = setTimeout(async () => {
      setSearchingDm(true);
      try {
        const res = await apiCall(`/api/users/search?q=${encodeURIComponent(dmSearchQuery)}`);
        if (res.ok) {
          const data = await res.json();
          setDmSearchResults(data);
        }
      } catch (err) {
        console.error("Error searching users:", err);
      } finally {
        setSearchingDm(false);
      }
    }, 300);

    return () => clearTimeout(delayDebounce);
  }, [dmSearchQuery]);

  const handleStartDM = async (username) => {
    try {
      const res = await apiCall(`/api/messages/start/${username}`, { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        setIsDmModalOpen(false);
        setDmSearchQuery('');
        setDmSearchResults([]);
        setSearchParams({ room: data.convo_id });
        fetchInbox();
      }
    } catch (err) {
      console.error("Error starting direct message:", err);
    }
  };

  const scrollToBottom = () => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!msgInput.trim() || !activeRoomId) return;

    const val = msgInput;
    setMsgInput('');

    try {
      const res = await apiCall(`/api/messages/room/${activeRoomId}/send`, {
        method: 'POST',
        body: { text: val }
      });
      if (res.ok) {
        const newMsg = await res.json();
        setMessages(prev => [...prev, newMsg]);
        fetchInbox(); // Refresh sidebar order and last msg
      }
    } catch (err) {
      console.error("Error sending message:", err);
    }
  };

  const handleEditMessage = async (msgId, oldText) => {
    const newText = prompt("Edit your message:", oldText);
    if (!newText || newText.trim() === oldText) return;

    try {
      const res = await apiCall(`/api/messages/message/${msgId}`, {
        method: 'PUT',
        body: { text: newText }
      });
      if (res.ok) {
        setMessages(prev => prev.map(m => m.id === msgId ? { ...m, text: newText } : m));
        fetchInbox();
      }
    } catch (err) {
      console.error("Error editing message:", err);
    }
  };

  const handleDeleteMessage = async (msgId) => {
    if (!window.confirm("Delete this message?")) return;
    try {
      const res = await apiCall(`/api/messages/message/${msgId}`, { method: 'DELETE' });
      if (res.ok) {
        setMessages(prev => prev.filter(m => m.id !== msgId));
        fetchInbox();
      }
    } catch (err) {
      console.error("Error deleting message:", err);
    }
  };

  const handleDeleteConvo = async (e, convoId) => {
    e.preventDefault();
    e.stopPropagation();
    if (!window.confirm("Delete this entire conversation?")) return;

    try {
      const res = await apiCall(`/api/messages/room/${convoId}`, { method: 'DELETE' });
      if (res.ok) {
        if (activeRoomId === String(convoId)) {
          setSearchParams({});
        }
        fetchInbox();
      }
    } catch (err) {
      console.error("Error deleting conversation:", err);
    }
  };

  const handleToggleFriendSelect = (friendId) => {
    setSelectedFriends(prev => 
      prev.includes(friendId) ? prev.filter(id => id !== friendId) : [...prev, friendId]
    );
  };

  const handleCreateGroup = async (e) => {
    e.preventDefault();
    if (!groupName.trim() || selectedFriends.length === 0) return;

    try {
      const res = await apiCall('/api/messages/group/create', {
        method: 'POST',
        body: {
          name: groupName,
          users: selectedFriends
        }
      });
      if (res.ok) {
        const data = await res.json();
        setIsGroupModalOpen(false);
        setGroupName('');
        setSelectedFriends([]);
        setSearchParams({ room: data.group_id });
        fetchInbox();
      }
    } catch (err) {
      console.error("Error creating group:", err);
    }
  };

  const formatMsgDate = (dateStr) => {
    const d = new Date(dateStr);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="min-h-screen flex max-w-7xl mx-auto bg-slate-50 dark:bg-slate-950">
      {/* Left Sidebar */}
      <Sidebar />

      {/* Main double column box */}
      <main className="flex-1 flex border-r border-slate-100 dark:border-slate-800/60 bg-white dark:bg-slate-950 pb-16 md:pb-0">
        
        {/* Left Pane: Active Threads */}
        <div className={`w-full md:w-80 border-r border-slate-100 dark:border-slate-800/60 flex flex-col ${activeRoomId ? 'hidden md:flex' : 'flex'}`}>
          <div className="h-16 px-5 border-b border-slate-100 dark:border-slate-800/60 flex items-center justify-between sticky top-0 bg-white dark:bg-slate-950 z-10">
            <h2 className="font-extrabold text-slate-800 dark:text-slate-100 text-lg tracking-tight">Messages</h2>
            <div className="flex gap-2">
              <button
                onClick={() => setIsDmModalOpen(true)}
                className="py-1.5 px-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs flex items-center gap-1 transition-all shadow-md shadow-indigo-600/10"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Chat</span>
              </button>
              <button
                onClick={() => setIsGroupModalOpen(true)}
                className="py-1.5 px-3 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 hover:bg-indigo-100 dark:hover:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 font-bold text-xs flex items-center gap-1 transition-all"
              >
                <Users className="w-3.5 h-3.5" />
                <span>Group</span>
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto divide-y divide-slate-50 dark:divide-slate-850/40">
            {loadingInbox ? (
              <div className="flex items-center justify-center py-10">
                <Loader2 className="w-6 h-6 animate-spin text-indigo-600" />
              </div>
            ) : conversations.length > 0 ? (
              conversations.map((convo) => {
                const isActive = activeRoomId === String(convo.id);
                return (
                  <div
                    key={convo.id}
                    onClick={() => setSearchParams({ room: convo.id })}
                    className={`flex items-center gap-3.5 px-5 py-4 cursor-pointer hover:bg-slate-50/80 dark:hover:bg-slate-900/60 transition-all ${
                      isActive ? 'bg-indigo-50/40 dark:bg-indigo-950/20 border-l-4 border-indigo-600' : ''
                    }`}
                  >
                    {/* Avatar Letter */}
                    <div className="w-11 h-11 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 text-white flex items-center justify-center font-bold text-base shadow-sm shrink-0">
                      {convo.avatar_letter}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-baseline gap-1.5">
                        <span className={`text-xs truncate ${isActive ? 'font-bold text-indigo-900 dark:text-indigo-200' : 'font-semibold text-slate-700 dark:text-slate-200'}`}>
                          {convo.title}
                        </span>
                        
                        <div className="flex items-center gap-1 shrink-0">
                          {convo.unread_count > 0 && (
                            <span className="w-4.5 h-4.5 bg-indigo-600 text-white text-[9px] font-extrabold rounded-full flex items-center justify-center">
                              {convo.unread_count}
                            </span>
                          )}
                          <button
                            onClick={(e) => handleDeleteConvo(e, convo.id)}
                            className="p-1 rounded text-slate-300 dark:text-slate-650 hover:text-rose-500 dark:hover:text-rose-400 transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      <p className="text-slate-400 dark:text-slate-500 text-xs truncate mt-0.5">{convo.last_message || "No messages yet"}</p>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="text-center py-16 text-slate-400 dark:text-slate-500 text-xs">
                No active conversations yet
              </div>
            )}
          </div>
        </div>

        {/* Right Pane: Chat Room details */}
        <div className={`flex-1 flex flex-col bg-slate-50/50 dark:bg-slate-900/10 ${!activeRoomId ? 'hidden md:flex justify-center items-center text-slate-400 dark:text-slate-500 text-xs' : 'flex'}`}>
          {activeRoomId ? (
            loadingRoom ? (
              <div className="flex flex-col items-center justify-center flex-1 gap-2">
                <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
                <span className="text-slate-400 dark:text-slate-500 text-xs">Loading chat room...</span>
              </div>
            ) : activeConvo ? (
              <>
                {/* Chat Room Header */}
                <div className="h-16 px-6 border-b border-slate-100 dark:border-slate-800/60 bg-white dark:bg-slate-950 flex items-center gap-4 shrink-0">
                  <button
                    onClick={() => setSearchParams({})}
                    className="p-1.5 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-900 text-slate-400 dark:text-slate-500 md:hidden transition-colors"
                  >
                    <ArrowLeft className="w-5 h-5" />
                  </button>

                  <div className="w-9 h-9 rounded-full bg-indigo-600 text-white flex items-center justify-center font-bold text-sm shadow-sm shrink-0">
                    {activeConvo.is_group ? "G" : otherUser?.username.slice(0, 1).toUpperCase()}
                  </div>

                  <div>
                    <h3 className="font-extrabold text-slate-800 dark:text-slate-100 text-sm">
                      {activeConvo.is_group ? `👥 ${activeConvo.name || 'Group Chat'}` : otherUser?.username}
                    </h3>
                    <p className="text-[10px] text-slate-400 dark:text-slate-500 font-medium">
                      {activeConvo.is_group ? `${participants.length} members` : 'Direct message'}
                    </p>
                  </div>
                </div>

                {/* Messages Timeline */}
                <div className="flex-1 overflow-y-auto p-6 space-y-4">
                  {messages.length > 0 ? (
                    messages.map((msg) => {
                      const isMe = msg.sender_id === user?.id;
                      return (
                        <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'} group`}>
                          <div className="flex flex-col max-w-[70%] gap-1">
                            {!isMe && activeConvo.is_group && (
                              <span className="text-[9px] font-bold text-slate-400 dark:text-slate-500 pl-2">@{msg.sender_username}</span>
                            )}
                            
                            <div
                              className={`p-3.5 rounded-2xl relative shadow-sm border ${
                                isMe 
                                  ? 'bg-indigo-600 dark:bg-indigo-700 border-indigo-700 dark:border-indigo-800 text-white rounded-tr-none' 
                                  : 'bg-white dark:bg-slate-900 border-slate-200/80 dark:border-slate-805/40 text-slate-800 dark:text-slate-200 rounded-tl-none'
                              }`}
                            >
                              <p className="text-[13px] leading-relaxed whitespace-pre-wrap">{msg.text}</p>
                              
                              <div className="flex items-center justify-end gap-1.5 mt-1.5">
                                <span className={`text-[8px] ${isMe ? 'text-indigo-200 dark:text-indigo-300' : 'text-slate-400 dark:text-slate-500'}`}>
                                  {formatMsgDate(msg.created_at)}
                                </span>
                                {isMe && (
                                  msg.is_read ? (
                                    <CheckCheck className="w-3 h-3 text-indigo-205" />
                                  ) : (
                                    <Check className="w-3 h-3 text-indigo-300" />
                                  )
                                )}
                              </div>
                            </div>
                            
                            {/* Message actions on hover */}
                            {isMe && (
                              <div className="flex justify-end gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity pr-1">
                                <button 
                                  onClick={() => handleEditMessage(msg.id, msg.text)}
                                  className="text-[10px] text-slate-400 dark:text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 font-bold"
                                >
                                  Edit
                                </button>
                                <span className="text-slate-200 dark:text-slate-800 text-[10px]">•</span>
                                <button 
                                  onClick={() => handleDeleteMessage(msg.id)}
                                  className="text-[10px] text-slate-400 dark:text-slate-500 hover:text-rose-600 dark:hover:text-rose-400 font-bold"
                                >
                                  Delete
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div className="text-center py-20 text-slate-400 dark:text-slate-550 text-xs">
                      No messages in this chat. Start typing below!
                    </div>
                  )}
                  <div ref={chatEndRef} />
                </div>

                {/* Input form */}
                <form onSubmit={handleSendMessage} className="p-4 border-t border-slate-100 dark:border-slate-800/60 bg-white dark:bg-slate-950 flex gap-2 shrink-0">
                  <input
                    type="text"
                    value={msgInput}
                    onChange={(e) => setMsgInput(e.target.value)}
                    placeholder="Type a message..."
                    className="flex-1 px-4 py-3 rounded-2xl text-xs glass-input"
                    required
                  />
                  <button
                    type="submit"
                    className="p-3 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold transition-colors shadow-md shadow-indigo-600/10"
                  >
                    <Send className="w-4 h-4" />
                  </button>
                </form>
              </>
            ) : null
          ) : (
            <div className="flex flex-col items-center gap-3">
              <Users className="w-12 h-12 text-slate-300 dark:text-slate-700" />
              <p className="font-semibold text-slate-500 dark:text-slate-400">Select a conversation</p>
              <p className="text-slate-400 dark:text-slate-500 mt-1 max-w-[200px] text-center leading-relaxed">
                Choose a classmate or start a group chat to exchange notes or chat.
              </p>
            </div>
          )}
        </div>
      </main>

      {/* Group Chat Modal */}
      {isGroupModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <form onSubmit={handleCreateGroup} className="bg-white dark:bg-slate-900 w-full max-w-sm rounded-3xl p-6 shadow-2xl border border-slate-100 dark:border-slate-800 flex flex-col gap-4 animate-fade-in">
            <div className="flex justify-between items-center border-b border-slate-50 dark:border-slate-800/60 pb-2">
              <h3 className="font-bold text-slate-800 dark:text-slate-100 text-base">Create Group Chat</h3>
              <button 
                type="button" 
                onClick={() => setIsGroupModalOpen(false)}
                className="p-1 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-400 dark:text-slate-550"
              >
                <X className="w-4.5 h-4.5" />
              </button>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs font-bold text-slate-500 dark:text-slate-400">Group Name</label>
              <input
                type="text"
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
                placeholder="e.g. Study Group, Coding Club"
                className="w-full px-3 py-2.5 rounded-xl text-xs glass-input"
                required
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs font-bold text-slate-500 dark:text-slate-400">Select Classmates (Mutual Friends)</label>
              {mutualFriends.length > 0 ? (
                <div className="max-h-44 overflow-y-auto border border-slate-100 dark:border-slate-800 rounded-2xl p-2.5 space-y-1.5 bg-slate-50/50 dark:bg-slate-950/30">
                  {mutualFriends.map((f) => (
                    <label key={f.id} className="flex items-center gap-3 p-2 rounded-xl hover:bg-white dark:hover:bg-slate-900 border border-transparent hover:border-slate-100 dark:hover:border-slate-800/60 cursor-pointer transition-all">
                      <input
                        type="checkbox"
                        checked={selectedFriends.includes(f.id)}
                        onChange={() => handleToggleFriendSelect(f.id)}
                        className="rounded text-indigo-600 focus:ring-indigo-500 accent-indigo-600"
                      />
                      <div className="w-7 h-7 rounded-full bg-indigo-100 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold text-xs">
                        {f.username.slice(0, 1).toUpperCase()}
                      </div>
                      <span className="text-slate-700 dark:text-slate-300 text-xs font-semibold">@{f.username}</span>
                    </label>
                  ))}
                </div>
              ) : (
                <div className="text-center py-6 border border-dashed border-slate-200 dark:border-slate-800/60 rounded-2xl bg-slate-50/50 dark:bg-slate-900/10 text-[10px] text-slate-400 dark:text-slate-550">
                  No mutual connections found. Follow back classmates to start messaging!
                </div>
              )}
            </div>

            <button
              type="submit"
              disabled={!groupName.trim() || selectedFriends.length === 0}
              className="w-full mt-2 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-md shadow-indigo-600/10 transition-colors disabled:opacity-50"
            >
              Create Group
            </button>
          </form>
        </div>
      )}

      {/* New Direct Message Modal */}
      {isDmModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 w-full max-w-sm rounded-3xl p-6 shadow-2xl border border-slate-100 dark:border-slate-800 flex flex-col gap-4 animate-fade-in">
            <div className="flex justify-between items-center border-b border-slate-50 dark:border-slate-800/60 pb-2">
              <h3 className="font-bold text-slate-800 dark:text-slate-100 text-base">New Message</h3>
              <button 
                type="button" 
                onClick={() => {
                  setIsDmModalOpen(false);
                  setDmSearchQuery('');
                  setDmSearchResults([]);
                }}
                className="p-1 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-400 dark:text-slate-550"
              >
                <X className="w-4.5 h-4.5" />
              </button>
            </div>

            {/* Search Input */}
            <div className="flex flex-col gap-1">
              <label className="text-xs font-bold text-slate-500 dark:text-slate-400">Search classmate by username</label>
              <input
                type="text"
                value={dmSearchQuery}
                onChange={(e) => setDmSearchQuery(e.target.value)}
                placeholder="e.g. akash, devang"
                className="w-full px-3 py-2.5 rounded-xl text-xs glass-input"
                autoFocus
              />
            </div>

            {/* Results list */}
            <div className="flex flex-col gap-1">
              <label className="text-xs font-bold text-slate-500 dark:text-slate-400">
                {dmSearchQuery.trim() ? "Search Results" : "Suggested Connections"}
              </label>

              <div className="max-h-48 overflow-y-auto border border-slate-100 dark:border-slate-800 rounded-2xl p-2 bg-slate-50/50 dark:bg-slate-950/30 min-h-24 flex flex-col gap-1 justify-start">
                {searchingDm ? (
                  <div className="flex items-center justify-center flex-1 py-6 text-slate-400">
                    <Loader2 className="w-5 h-5 animate-spin text-indigo-600" />
                  </div>
                ) : dmSearchQuery.trim() ? (
                  dmSearchResults.length > 0 ? (
                    dmSearchResults.map((u) => (
                      <div 
                        key={u.id}
                        onClick={() => handleStartDM(u.username)}
                        className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-white dark:hover:bg-slate-900 border border-transparent hover:border-slate-150/40 dark:hover:border-slate-800 cursor-pointer transition-all"
                      >
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 text-white flex items-center justify-center font-bold text-xs shrink-0 shadow-sm">
                          {u.username.slice(0, 1).toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-slate-700 dark:text-slate-200 text-xs font-bold truncate">@{u.username}</p>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-8 text-slate-400 dark:text-slate-500 text-xs italic">
                      No classmates found matching "{dmSearchQuery}"
                    </div>
                  )
                ) : mutualFriends.length > 0 ? (
                  mutualFriends.map((u) => (
                    <div 
                      key={u.id}
                      onClick={() => handleStartDM(u.username)}
                      className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-white dark:hover:bg-slate-900 border border-transparent hover:border-slate-150/40 dark:hover:border-slate-800 cursor-pointer transition-all"
                    >
                      <div className="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold text-xs shrink-0">
                        {u.username.slice(0, 1).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-slate-700 dark:text-slate-300 text-xs font-semibold truncate">@{u.username}</p>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-8 text-slate-400 dark:text-slate-500 text-[10px] leading-relaxed">
                    Type a username to start a direct message chat.
                  </div>
                )}
              </div>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}
