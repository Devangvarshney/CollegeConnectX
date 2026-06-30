import React, { useState } from 'react';
import Sidebar from '../components/Sidebar';
import RightPanel from '../components/RightPanel';
import { Send, Sparkles, Image as ImageIcon, FileText, Newspaper, HelpCircle, Loader2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function Trok() {
  const { apiCall } = useAuth();
  const [chat, setChat] = useState([
    { role: 'assistant', text: "Hello! I'm Trok, your campus AI assistant. Ask me anything about classes, campus events, or drafting emails." }
  ]);
  const [inputVal, setInputVal] = useState('');
  const [isTyping, setIsTyping] = useState(false);

  const suggestionChips = [
    { label: "Latest News", icon: Newspaper, response: "Campus News Alert:\n\n1. Coffee shortage reported at the student center! Library study booths are currently at 100% capacity.\n2. Registration for the CollegeConnectX Hackathon is now live under the Home feed!\n3. Sports Carnival: Basketball finals scheduled tonight at the indoor arena. Go team!" },
    { label: "Draft Professor Email", icon: FileText, response: "Here's a template for you:\n\nSubject: Request for Extension - [Course Name]\n\nDear Professor [Name],\n\nI hope this email finds you well. I am writing to ask if it might be possible to request a short extension on the upcoming [Assignment Name], currently due on [Date]. I want to ensure my work is thorough, and this extra time would greatly help. Thank you for your time and understanding.\n\nBest regards,\n[Your Name]\n[Student ID]" },
    { label: "Create Images", icon: ImageIcon, response: "Image Generation Mode Enabled.\n\nGenerated: A digital painting of a futuristic college campus with glass domes, solar trees, and students study groups collaborating with holographic notebooks.\n\n[Rendered visual asset locally: college_future_dome.webp]" },
  ];

  const handleSend = async (text) => {
    if (!text.trim() || isTyping) return;

    // Append user message
    const userMsg = { role: 'user', text };
    const currentChat = [...chat, userMsg];
    setChat(currentChat);
    setInputVal('');
    setIsTyping(true);

    try {
      const res = await apiCall('/api/trokai/chat', {
        method: 'POST',
        body: {
          message: text,
          history: chat.map(c => ({ role: c.role, text: c.text }))
        }
      });

      if (res.ok) {
        const data = await res.json();
        setChat(prev => [...prev, { role: 'assistant', text: data.reply }]);
      } else {
        setChat(prev => [...prev, { role: 'assistant', text: "I'm having trouble retrieving a response from the campus database. Please try again." }]);
      }
    } catch (err) {
      console.error("Error calling Trok AI endpoint:", err);
      setChat(prev => [...prev, { role: 'assistant', text: "Connection error. Please try again later." }]);
    } finally {
      setIsTyping(false);
    }
  };

  return (
    <div className="min-h-screen flex max-w-7xl mx-auto">
      {/* Left Sidebar */}
      <Sidebar />

      {/* Center AI Search area */}
      <main className="flex-1 border-r border-slate-100 dark:border-slate-800/60 flex flex-col min-w-0 bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-100 pb-20 md:pb-0">
        
        {/* Header */}
        <div className="h-16 px-6 border-b border-slate-100 dark:border-slate-800/60 flex items-center justify-between sticky top-0 bg-white/80 dark:bg-slate-950/80 backdrop-blur-md z-10">
          <h2 className="font-extrabold text-slate-800 dark:text-slate-100 text-lg tracking-tight flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-indigo-500 dark:text-indigo-400" />
            <span>Trok AI</span>
          </h2>
          <span className="text-[10px] font-bold bg-indigo-500/10 text-indigo-600 dark:text-indigo-300 py-1 px-2.5 rounded-full uppercase tracking-wider">Experimental</span>
        </div>

        {/* Chat Area */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {chat.map((msg, idx) => (
            <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div 
                className={`p-4 rounded-2xl max-w-[75%] text-xs leading-relaxed whitespace-pre-wrap shadow-md ${
                  msg.role === 'user'
                    ? 'bg-indigo-600 text-white rounded-tr-none'
                    : 'bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800/60 text-slate-700 dark:text-slate-200 rounded-tl-none'
                }`}
              >
                {msg.text}
              </div>
            </div>
          ))}

          {/* Typing Indicator */}
          {isTyping && (
            <div className="flex justify-start">
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800/60 rounded-tl-none flex items-center gap-1">
                <span className="w-1.5 h-1.5 bg-slate-400 dark:bg-slate-500 rounded-full typing-dot"></span>
                <span className="w-1.5 h-1.5 bg-slate-400 dark:bg-slate-500 rounded-full typing-dot"></span>
                <span className="w-1.5 h-1.5 bg-slate-400 dark:bg-slate-500 rounded-full typing-dot"></span>
              </div>
            </div>
          )}
        </div>

        {/* Action Panel Footer */}
        <div className="p-6 border-t border-slate-100 dark:border-slate-900/80 bg-white dark:bg-slate-950 flex flex-col gap-4">
          
          {/* Suggestion Chips */}
          <div className="flex flex-wrap gap-2.5">
            {suggestionChips.map((chip, idx) => {
              const ChipIcon = chip.icon;
              return (
                <button
                  key={idx}
                  onClick={() => handleSend(chip.label)}
                  className="flex items-center gap-1.5 py-2 px-3.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800 hover:border-indigo-500/50 hover:bg-slate-100/80 dark:hover:bg-slate-850/60 text-[11px] font-semibold text-slate-600 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-slate-100 transition-all shrink-0"
                >
                  <ChipIcon className="w-3.5 h-3.5 text-indigo-500 dark:text-indigo-400" />
                  <span>{chip.label}</span>
                </button>
              );
            })}
          </div>

          {/* Input Form */}
          <form 
            onSubmit={(e) => { e.preventDefault(); handleSend(inputVal); }}
            className="relative flex items-center bg-slate-50 dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 focus-within:border-indigo-500/60 focus-within:bg-white dark:focus-within:bg-slate-900 p-1.5 transition-all"
          >
            <input
              type="text"
              value={inputVal}
              onChange={(e) => setInputVal(e.target.value)}
              placeholder="Ask Trok anything..."
              className="flex-1 bg-transparent px-4 py-2.5 text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:ring-0 outline-none text-xs"
            />
            <button
              type="submit"
              disabled={!inputVal.trim() || isTyping}
              className="p-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold transition-all shadow-md shadow-indigo-600/10 shrink-0 disabled:opacity-40"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>

        </div>

      </main>

      {/* Right widgets panel */}
      <RightPanel />
    </div>
  );
}
