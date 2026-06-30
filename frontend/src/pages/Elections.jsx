import React, { useState, useEffect } from 'react';
import Sidebar from '../components/Sidebar';
import RightPanel from '../components/RightPanel';
import { useAuth, API_BASE, getMediaUrl } from '../context/AuthContext';
import { Vote, CheckSquare, UserPlus, BarChart3, User, Image as ImageIcon, Info, Check, Award, AlertCircle, Loader2, Trash2, X } from 'lucide-react';

export default function Elections() {
  const { user, apiCall } = useAuth();
  
  // Tab state: 'vote', 'nominate', 'results'
  const [activeTab, setActiveTab] = useState('vote');
  
  // Data states
  const [candidates, setCandidates] = useState([]);
  const [stats, setStats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedPoster, setSelectedPoster] = useState(null);
  
  // Nomination form states
  const [position, setPosition] = useState('President');
  const [manifesto, setManifesto] = useState('');
  const [photoFile, setPhotoFile] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);
  
  // Status states
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  const fetchElectionData = async () => {
    try {
      setLoading(true);
      const candidatesRes = await apiCall('/api/elections/candidates');
      if (candidatesRes.ok) {
        const candidatesData = await candidatesRes.json();
        setCandidates(candidatesData);
      }
      
      const statsRes = await apiCall('/api/elections/stats');
      if (statsRes.ok) {
        const statsData = await statsRes.json();
        setStats(statsData);
      }
    } catch (err) {
      console.error("Error fetching elections data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchElectionData();
  }, []);

  const handlePhotoChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setPhotoFile(file);
      setPhotoPreview(URL.createObjectURL(file));
    }
  };

  const handleNominateSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    
    if (!photoFile) {
      setError("Please upload a campaign photo.");
      return;
    }

    setActionLoading(true);
    try {
      const formData = new FormData();
      formData.append('position', position);
      formData.append('manifesto', manifesto);
      formData.append('photo', photoFile);

      const res = await apiCall('/api/elections/nominate', {
        method: 'POST',
        body: formData
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || "Nomination failed.");
      }

      setSuccess("Congratulations! You have nominated yourself successfully.");
      setManifesto('');
      setPhotoFile(null);
      setPhotoPreview(null);
      
      // Refresh candidates list
      await fetchElectionData();
      
      // Redirect to candidate list
      setTimeout(() => {
        setActiveTab('vote');
        setSuccess('');
      }, 2000);

    } catch (err) {
      setError(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleCastVote = async (candidateId) => {
    setError('');
    setSuccess('');
    
    try {
      const res = await apiCall(`/api/elections/candidates/${candidateId}/vote`, {
        method: 'POST'
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || "Failed to cast vote.");
      }

      setSuccess("Your vote has been cast successfully!");
      
      // Refresh database records
      await fetchElectionData();

      setTimeout(() => {
        setSuccess('');
      }, 3000);
    } catch (err) {
      setError(err.message);
    }
  };

  const handleWithdrawNomination = async (candidateId) => {
    if (!window.confirm("Are you sure you want to withdraw your nomination? All your votes will be lost.")) {
      return;
    }
    
    setError('');
    setSuccess('');
    setActionLoading(true);
    
    try {
      const res = await apiCall(`/api/elections/candidates/${candidateId}`, {
        method: 'DELETE'
      });
      
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || "Failed to withdraw nomination.");
      }
      
      setSuccess("Your nomination has been withdrawn successfully.");
      setSelectedPoster(null);
      await fetchElectionData();
      
      setTimeout(() => {
        setSuccess('');
      }, 3000);
    } catch (err) {
      setError(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  // Check if current user is already a candidate
  const userCandidate = candidates.find(c => c.user_id === user?.id);

  // Group candidates by position
  const positionsGrouped = {
    'President': candidates.filter(c => c.position === 'President'),
    'Vice President': candidates.filter(c => c.position === 'Vice President'),
    'Secretary': candidates.filter(c => c.position === 'Secretary'),
    'Treasurer': candidates.filter(c => c.position === 'Treasurer')
  };

  return (
    <div className="min-h-screen flex max-w-7xl mx-auto">
      {/* Left Sidebar */}
      <Sidebar />

      {/* Main Election Area */}
      <main className="flex-1 border-r border-slate-100 dark:border-slate-800/60 flex flex-col min-w-0 bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-100 pb-20 md:pb-0">
        
        {/* Header */}
        <div className="h-16 px-6 border-b border-slate-100 dark:border-slate-800/60 flex items-center justify-between sticky top-0 bg-white/80 dark:bg-slate-950/80 backdrop-blur-md z-10">
          <h2 className="font-extrabold text-slate-800 dark:text-slate-100 text-lg tracking-tight flex items-center gap-2">
            <Vote className="w-5 h-5 text-indigo-500 dark:text-indigo-400" />
            <span>Campus Elections</span>
          </h2>
          <span className="text-[10px] font-bold bg-indigo-500/10 text-indigo-655 dark:text-indigo-300 py-1 px-2.5 rounded-full uppercase tracking-wider">Active Polls</span>
        </div>

        {/* Alerts */}
        {(error || success) && (
          <div className="px-6 pt-4">
            {error && (
              <div className="p-3.5 rounded-2xl bg-rose-50 dark:bg-rose-950/20 border border-rose-100 dark:border-rose-950/45 text-rose-600 dark:text-rose-400 text-xs flex items-center gap-2">
                <AlertCircle className="w-4.5 h-4.5 shrink-0" />
                <span>{error}</span>
              </div>
            )}
            {success && (
              <div className="p-3.5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-950/45 text-emerald-600 dark:text-emerald-400 text-xs flex items-center gap-2">
                <Check className="w-4.5 h-4.5 shrink-0" />
                <span>{success}</span>
              </div>
            )}
          </div>
        )}

        {/* Tab Switcher */}
        <div className="flex border-b border-slate-100 dark:border-slate-800/60 px-6 py-3 gap-2 overflow-x-auto scrollbar-none whitespace-nowrap">
          <button
            onClick={() => setActiveTab('vote')}
            className={`shrink-0 flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
              activeTab === 'vote'
                ? 'bg-indigo-50 dark:bg-indigo-950/30 text-indigo-600 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-900/40'
                : 'text-slate-500 hover:bg-slate-50 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
            }`}
          >
            <CheckSquare className="w-4 h-4" />
            <span>Contending Nominees</span>
          </button>
          
          <button
            onClick={() => setActiveTab('nominate')}
            className={`shrink-0 flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
              activeTab === 'nominate'
                ? 'bg-indigo-50 dark:bg-indigo-950/30 text-indigo-600 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-900/40'
                : 'text-slate-500 hover:bg-slate-50 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
            }`}
          >
            <UserPlus className="w-4 h-4" />
            <span>Nominate Yourself</span>
          </button>
          
          <button
            onClick={() => setActiveTab('results')}
            className={`shrink-0 flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
              activeTab === 'results'
                ? 'bg-indigo-50 dark:bg-indigo-950/30 text-indigo-600 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-900/40'
                : 'text-slate-500 hover:bg-slate-55/60 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
            }`}
          >
            <BarChart3 className="w-4 h-4" />
            <span>Live Standings</span>
          </button>
        </div>

        {/* Tab Content Area */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex flex-col items-center justify-center h-64 gap-2">
              <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
              <span className="text-xs text-slate-400">Loading election hub...</span>
            </div>
          ) : activeTab === 'vote' ? (
            // ================== VOTE TAB ==================
            <div className="space-y-8">
              {Object.keys(positionsGrouped).map(pos => {
                const nominees = positionsGrouped[pos];
                return (
                  <div key={pos} className="space-y-4">
                    <div className="flex items-center gap-2 border-b border-slate-100 dark:border-slate-800/45 pb-2">
                      <Award className="w-4.5 h-4.5 text-indigo-600 dark:text-indigo-400" />
                      <h3 className="font-extrabold text-sm uppercase tracking-wider text-slate-700 dark:text-slate-350">{pos} Candidates</h3>
                      <span className="text-[10px] bg-slate-100 dark:bg-slate-900 px-2 py-0.5 rounded-full font-bold text-slate-400">
                        {nominees.length} {nominees.length === 1 ? 'candidate' : 'candidates'}
                      </span>
                    </div>

                    {nominees.length === 0 ? (
                      <div className="p-6 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 text-center text-xs text-slate-400 dark:text-slate-500 bg-slate-50/30 dark:bg-slate-950/20">
                        No candidates have registered for the position of {pos} yet.
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 gap-2.5">
                        {nominees.map(candidate => (
                          <div 
                            key={candidate.id} 
                            className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-2xl border border-slate-150 dark:border-slate-850/60 bg-white/90 dark:bg-slate-900/50 shadow-sm hover:shadow-md hover:border-indigo-500/20 transition-all duration-200 backdrop-blur-md"
                          >
                            {/* Left section: Candidate Profile, Slogan & Poster */}
                            <div className="flex items-center gap-3.5 flex-1 min-w-0">
                              {/* Candidate Profile Photo */}
                              <div className="w-10 h-10 rounded-full overflow-hidden shrink-0 border border-slate-200 dark:border-slate-800 bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-extrabold text-xs uppercase shadow-sm">
                                {candidate.avatar ? (
                                  <img 
                                    src={getMediaUrl(candidate.avatar)} 
                                    alt={candidate.username} 
                                    className="w-full h-full object-cover" 
                                  />
                                ) : (
                                  <span>{candidate.username.slice(0, 1)}</span>
                                )}
                              </div>

                              {/* Slogan and details */}
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-1.5 mb-0.5">
                                  <span className="font-extrabold text-sm text-slate-800 dark:text-slate-100">
                                    {candidate.username}
                                  </span>
                                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                                </div>
                                <p className="text-xs text-slate-500 dark:text-slate-400 italic line-clamp-2">
                                  "{candidate.manifesto}"
                                </p>
                              </div>

                              {/* Campaign Poster */}
                              <div className="flex flex-col items-center gap-0.5 shrink-0 px-1">
                                <span className="text-[7px] font-extrabold uppercase tracking-wider text-slate-450 dark:text-slate-500">Poster</span>
                                <div 
                                  onClick={() => setSelectedPoster(candidate)}
                                  className="w-11 h-11 rounded-lg overflow-hidden bg-slate-100 dark:bg-slate-950 border border-slate-200/40 dark:border-slate-850 cursor-pointer hover:opacity-90 shrink-0 relative group"
                                  title="View Campaign Poster"
                                >
                                  {candidate.photo ? (
                                    <img 
                                      src={getMediaUrl(candidate.photo)} 
                                      alt="Poster" 
                                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                    />
                                  ) : (
                                    <div className="w-full h-full flex items-center justify-center bg-indigo-50 dark:bg-slate-900 text-indigo-500">
                                      <ImageIcon className="w-4 h-4" />
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>

                            {/* Right section: Vote tally & Action Button */}
                            <div className="flex items-center justify-between sm:justify-end gap-3 border-t sm:border-t-0 border-slate-100 dark:border-slate-800/40 pt-3 sm:pt-0 shrink-0">
                              {/* Votes Count Badge */}
                              <div className="flex items-center gap-1 bg-indigo-500/5 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 px-3 py-1.5 rounded-xl border border-indigo-500/10 text-xs font-bold">
                                <Vote className="w-3.5 h-3.5" />
                                <span>{candidate.votes_count} {candidate.votes_count === 1 ? 'vote' : 'votes'}</span>
                              </div>

                              {/* Action controls */}
                              {candidate.user_id === user?.id ? (
                                <div className="flex items-center gap-1.5">
                                  <span className="px-2.5 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-900 text-slate-450 dark:text-slate-500 font-bold text-[9px] uppercase tracking-wider border border-slate-150/40 dark:border-slate-800">
                                    Me
                                  </span>
                                  <button
                                    onClick={() => handleWithdrawNomination(candidate.id)}
                                    className="p-2 rounded-xl bg-rose-500/10 hover:bg-rose-500 text-rose-500 hover:text-white transition-all cursor-pointer border border-rose-500/20"
                                    title="Withdraw Nomination"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </div>
                              ) : candidate.has_voted_for_this ? (
                                <button
                                  disabled
                                  className="flex items-center gap-1 px-4 py-2 rounded-xl bg-emerald-500/10 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 font-bold text-xs border border-emerald-500/30"
                                >
                                  <Check className="w-3.5 h-3.5" />
                                  <span>Voted</span>
                                </button>
                              ) : candidate.has_voted_for_position ? (
                                <button
                                  disabled
                                  className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-950 text-slate-400 dark:text-slate-500 font-semibold text-xs border border-slate-200/40 dark:border-slate-850/60"
                                >
                                  Voted Other
                                </button>
                              ) : (
                                <button
                                  onClick={() => handleCastVote(candidate.id)}
                                  className="px-5 py-2 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-extrabold text-xs shadow-sm hover:from-indigo-700 hover:to-purple-700 hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer"
                                >
                                  Vote
                                </button>
                              )}
                            </div>

                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : activeTab === 'nominate' ? (
            // ================== NOMINATE TAB ==================
            <div className="max-w-xl mx-auto">
              {userCandidate ? (
                // Already contesting
                <div className="p-8 rounded-3xl border border-indigo-100 dark:border-indigo-950/45 bg-indigo-50/15 dark:bg-indigo-950/5 flex flex-col items-center text-center gap-5 backdrop-blur-sm">
                  <div className="w-16 h-16 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-lg shadow-indigo-600/35">
                    <Award className="w-9 h-9" />
                  </div>
                  <div>
                    <h3 className="font-extrabold text-lg text-slate-800 dark:text-slate-100">You are Contesting!</h3>
                    <p className="text-xs text-slate-400 dark:text-slate-500 mt-1.5 max-w-sm">
                      You stand registered as a candidate for the position of <strong className="font-bold text-indigo-600 dark:text-indigo-400">{userCandidate.position}</strong>.
                    </p>
                  </div>

                  <div className="w-full border-t border-slate-200/50 dark:border-slate-800/40 pt-5 flex flex-col items-center gap-4">
                    <div className="h-40 w-40 rounded-2xl overflow-hidden shadow-md bg-slate-100 dark:bg-slate-900 border border-slate-200/40 dark:border-slate-800">
                      <img src={getMediaUrl(userCandidate.photo)} className="w-full h-full object-cover" alt="Campaign Profile" />
                    </div>
                    <div className="w-full max-w-md p-4 rounded-2xl bg-white dark:bg-slate-955 border border-slate-100 dark:border-slate-855 text-xs text-slate-500 italic">
                      "{userCandidate.manifesto}"
                    </div>
                    <button
                      onClick={() => handleWithdrawNomination(userCandidate.id)}
                      className="mt-2 flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-rose-500 hover:bg-rose-600 text-white font-bold text-xs shadow-lg shadow-rose-600/20 hover:scale-[1.01] active:scale-[0.99] transition-all cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                      <span>Withdraw Nomination</span>
                    </button>
                  </div>
                </div>
              ) : (
                // Nomination form
                <div className="space-y-6">
                  <div>
                    <h3 className="font-extrabold text-base text-slate-800 dark:text-slate-100">Nomination Center</h3>
                    <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                      Submit your application to contest in student elections. Fill in your manifesto and upload a campaign poster/photo.
                    </p>
                  </div>

                  <form onSubmit={handleNominateSubmit} className="flex flex-col gap-5 border border-slate-100 dark:border-slate-800/60 p-6 rounded-3xl bg-slate-50/20 dark:bg-slate-900/10">
                    
                    {/* Position Selector */}
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider pl-1">Contesting Position</label>
                      <select 
                        value={position} 
                        onChange={(e) => setPosition(e.target.value)}
                        className="w-full px-4 py-3 rounded-2xl text-xs bg-slate-55 dark:bg-slate-900 border border-slate-205 dark:border-slate-800/70 focus:outline-none focus:border-indigo-500 font-medium text-slate-700 dark:text-slate-200"
                      >
                        <option value="President">President</option>
                        <option value="Vice President">Vice President</option>
                        <option value="Secretary">Secretary</option>
                        <option value="Treasurer">Treasurer</option>
                      </select>
                    </div>

                    {/* Manifesto Description */}
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider pl-1">Campaign Manifesto / Bio</label>
                      <textarea
                        value={manifesto}
                        onChange={(e) => setManifesto(e.target.value.slice(0, 500))}
                        placeholder="State your campaign promises and manifesto here. Why should students vote for you?"
                        rows={4}
                        className="w-full px-4 py-3 rounded-2xl text-xs glass-input focus:outline-none resize-none leading-relaxed"
                        required
                      />
                      <span className="text-[10px] text-slate-450 dark:text-slate-500 font-semibold self-end pr-1">
                        {manifesto.length}/500 characters
                      </span>
                    </div>

                    {/* Photo upload */}
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider pl-1">Campaign Photo / Poster</label>
                      <div className="border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-3xl p-6 flex flex-col items-center justify-center gap-3 bg-slate-55/40 dark:bg-slate-950/20 relative">
                        {photoPreview ? (
                          <div className="flex flex-col items-center gap-3 w-full">
                            <div className="w-28 h-28 rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800 shadow-md">
                              <img src={photoPreview} className="w-full h-full object-cover" alt="Campaign Preview" />
                            </div>
                            <button
                              type="button"
                              onClick={() => { setPhotoFile(null); setPhotoPreview(null); }}
                              className="text-[10px] font-bold text-rose-500 hover:underline"
                            >
                              Remove and select another
                            </button>
                          </div>
                        ) : (
                          <>
                            <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-slate-900 text-indigo-500 dark:text-indigo-400 flex items-center justify-center shadow-sm">
                              <ImageIcon className="w-6 h-6" />
                            </div>
                            <div className="text-center">
                              <p className="text-[11px] font-bold text-slate-655 dark:text-slate-350">Upload a Campaign Photo</p>
                              <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">PNG, JPG, or WEBP (Max 5MB)</p>
                            </div>
                            <input
                              type="file"
                              accept="image/*"
                              onChange={handlePhotoChange}
                              className="absolute inset-0 opacity-0 cursor-pointer"
                              required
                            />
                          </>
                        )}
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={actionLoading}
                      className="w-full mt-3 py-3 px-4 rounded-2xl bg-indigo-650 hover:bg-indigo-700 text-white font-bold text-xs shadow-lg shadow-indigo-600/20 hover:scale-[1.01] active:scale-[0.99] transition-all disabled:opacity-55 flex items-center justify-center gap-2"
                    >
                      {actionLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                      <span>{actionLoading ? "Submitting Application..." : "Submit Nomination Application"}</span>
                    </button>

                  </form>
                </div>
              )}
            </div>
          ) : (
            // ================== RESULTS TAB ==================
            <div className="space-y-8 max-w-2xl mx-auto">
              <div className="flex items-start gap-3 p-4 rounded-2xl bg-indigo-50/30 dark:bg-indigo-950/10 border border-indigo-100/50 dark:border-indigo-900/35">
                <Info className="w-4.5 h-4.5 text-indigo-500 dark:text-indigo-400 shrink-0 mt-0.5" />
                <div className="text-[11px] text-slate-555 dark:text-slate-400 leading-relaxed">
                  <strong className="font-bold text-slate-700 dark:text-slate-300">Live Election Standings:</strong> Results update in real-time as users cast votes. The candidate with the highest percentage of votes is displayed at the top of each poll.
                </div>
              </div>

              {stats.map(positionStats => (
                <div key={positionStats.position} className="border border-slate-100 dark:border-slate-800/60 p-6 rounded-3xl bg-slate-50/15 dark:bg-slate-900/5 space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-850 pb-2">
                    <span className="font-black text-sm text-slate-700 dark:text-slate-300 uppercase tracking-wider">{positionStats.position} Standings</span>
                    <span className="text-[10px] font-bold text-slate-450 bg-slate-100 dark:bg-slate-900/60 py-1 px-3 rounded-full">
                      Total Votes: {positionStats.total_votes}
                    </span>
                  </div>

                  {positionStats.candidates.length === 0 ? (
                    <p className="text-center text-xs text-slate-450 py-4">No candidates registered for this position.</p>
                  ) : (
                    <div className="space-y-4 pt-1">
                      {positionStats.candidates.map((c, index) => {
                        const percent = positionStats.total_votes > 0 
                          ? Math.round((c.votes_count / positionStats.total_votes) * 100) 
                          : 0;
                        
                        return (
                          <div key={c.candidate_id} className="space-y-1.5">
                            <div className="flex items-center justify-between text-xs font-semibold">
                              <div className="flex items-center gap-1.5">
                                {index === 0 && positionStats.total_votes > 0 && (
                                  <span className="text-[10px] bg-amber-500/10 text-amber-600 dark:text-amber-400 py-0.5 px-2 rounded-full font-bold uppercase tracking-wider">Leader</span>
                                )}
                                <span className="font-bold text-slate-800 dark:text-slate-100">@{c.username}</span>
                              </div>
                              <span className="text-slate-500 dark:text-slate-400 font-bold">
                                {c.votes_count} votes ({percent}%)
                              </span>
                            </div>
                            
                            {/* Custom progress bar */}
                            <div className="h-3 w-full bg-slate-100 dark:bg-slate-950 rounded-full overflow-hidden">
                              <div 
                                className={`h-full rounded-full transition-all duration-500 ${
                                  index === 0 && positionStats.total_votes > 0 
                                    ? 'bg-gradient-to-r from-indigo-500 to-purple-600 shadow-sm' 
                                    : 'bg-indigo-650 bg-indigo-600/65'
                                }`}
                                style={{ width: `${percent}%` }}
                              ></div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

      </main>

      {/* Right widgets panel */}
      <RightPanel />

      {/* Poster Modal */}
      {selectedPoster && (
        <div 
          className="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 z-50 transition-all duration-300 animate-fadeIn"
          onClick={() => setSelectedPoster(null)}
        >
          <div 
            className="relative max-w-lg w-full rounded-3xl overflow-hidden border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xl flex flex-col animate-scaleUp"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close button */}
            <button 
              onClick={() => setSelectedPoster(null)}
              className="absolute top-4 right-4 p-2 rounded-full bg-slate-100/80 dark:bg-slate-955/80 text-slate-700 dark:text-slate-300 hover:scale-105 active:scale-95 transition-all z-10 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Poster Image */}
            <div className="w-full aspect-[4/3] sm:aspect-square bg-slate-100 dark:bg-slate-950 overflow-hidden relative border-b border-slate-100 dark:border-slate-800/60">
              {selectedPoster.photo ? (
                <img 
                  src={getMediaUrl(selectedPoster.photo)} 
                  alt={selectedPoster.username} 
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-indigo-500/10 to-purple-500/10 text-indigo-500">
                  <User className="w-16 h-16" />
                </div>
              )}
              {/* Position badge */}
              <span className="absolute bottom-4 left-4 text-[10px] font-black tracking-widest uppercase bg-indigo-650 text-white py-1.5 px-3.5 rounded-full shadow-lg">
                {selectedPoster.position}
              </span>
            </div>

            {/* Poster Details */}
            <div className="p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-extrabold text-lg text-slate-800 dark:text-slate-100">
                    {selectedPoster.username}
                  </h4>
                  <p className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider mt-0.5">
                    Candidate for {selectedPoster.position}
                  </p>
                </div>

                <div className="flex items-center gap-1.5 bg-indigo-500/5 dark:bg-indigo-500/10 text-indigo-655 dark:text-indigo-400 px-3 py-1.5 rounded-full border border-indigo-500/10 text-xs font-bold">
                  <Vote className="w-4 h-4" />
                  <span>{selectedPoster.votes_count} votes</span>
                </div>
              </div>

              {/* Manifesto Quote */}
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950/40 border border-slate-100 dark:border-slate-800/40 text-xs text-slate-655 dark:text-slate-350 leading-relaxed italic">
                "{selectedPoster.manifesto}"
              </div>

              {/* Modal footer action */}
              <div className="flex items-center justify-end gap-3 pt-2">
                {selectedPoster.user_id === user?.id ? (
                  <button
                    onClick={() => handleWithdrawNomination(selectedPoster.id)}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-rose-50 dark:bg-rose-950/20 hover:bg-rose-100 text-rose-600 dark:text-rose-400 font-bold text-xs border border-rose-200/50 dark:border-rose-900/30 cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                    <span>Withdraw Nomination</span>
                  </button>
                ) : selectedPoster.has_voted_for_this ? (
                  <button
                    disabled
                    className="flex items-center gap-1 px-4 py-2 rounded-xl bg-emerald-500/10 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 font-extrabold text-xs border border-emerald-500/30"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>Voted</span>
                  </button>
                ) : selectedPoster.has_voted_for_position ? (
                  <button
                    disabled
                    className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-950 text-slate-400 dark:text-slate-500 font-bold text-xs border border-slate-200/40 dark:border-slate-850/60"
                  >
                    Voted Other
                  </button>
                ) : (
                  <button
                    onClick={() => {
                      handleCastVote(selectedPoster.id);
                      setSelectedPoster(null);
                    }}
                    className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-extrabold text-xs shadow-md shadow-indigo-600/15 hover:from-indigo-700 hover:to-purple-700 transition-all cursor-pointer"
                  >
                    Cast Vote
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
