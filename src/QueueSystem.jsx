import React, { useState, useEffect, useRef } from 'react';
import { Camera, Users, Clock, CheckCircle, QrCode, Bell, Volume2, VolumeX, Wifi, WifiOff } from 'lucide-react';
import { createClient } from '@supabase/supabase-js';

// Read runtime env injected by Vite (VITE_ prefix)
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

export default function QueueSystem() {
  const [currentQueue, setCurrentQueue] = useState(1);
  const [queueData, setQueueData] = useState([]);
  const [userTicket, setUserTicket] = useState(null);
  const [userName, setUserName] = useState('');
  const [userEmail, setUserEmail] = useState('');
  const [toastMessage, setToastMessage] = useState('');
  const [undoAvailable, setUndoAvailable] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState(false);
  const ADMIN_STORAGE_KEY = 'ada_admin_authenticated_v1';
  const ADMIN_ID_KEY = 'ada_admin_id_v1';
  const USER_TICKET_KEY = 'ada_user_ticket_v1';
  const USER_EMAIL_KEY = 'ada_user_email_v1';
  const lastClearedRef = useRef(null);
  const undoTimerRef = useRef(null);

  // Restore admin auth from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(ADMIN_STORAGE_KEY);
      const storedId = localStorage.getItem(ADMIN_ID_KEY);
      if (stored === '1' && storedId) {
        // validate that admin id still exists in the DB
        (async () => {
          try {
            // Try to get the currently authenticated user from Supabase
            const { data: userData, error: userErr } = await supabase.auth.getUser();
            const user = userData?.user || null;
            if (user) {
              // Verify that this auth user is registered as admin (match by auth_uid)
              const { data: adminRow, error: adminErr } = await supabase.from('admin_users').select('id, username, auth_uid').eq('auth_uid', user.id).limit(1);
              if (!adminErr && adminRow && adminRow.length > 0) {
                setIsAdmin(true);
                setIsAdminAuthenticated(true);
                try { localStorage.setItem(ADMIN_STORAGE_KEY, '1'); localStorage.setItem(ADMIN_ID_KEY, adminRow[0].id); } catch (e) {}
              } else {
                // Not an admin — clear persisted state
                localStorage.removeItem(ADMIN_STORAGE_KEY);
                localStorage.removeItem(ADMIN_ID_KEY);
              }
            } else {
              // No active session — clear persisted state to avoid stale flag
              localStorage.removeItem(ADMIN_STORAGE_KEY);
              localStorage.removeItem(ADMIN_ID_KEY);
            }
          } catch (e) {
            // ignore
          }
        })();
      }
    } catch (e) {
      // ignore
    }
  }, []);

  // Restore user's ticket/email from localStorage so the join form doesn't reappear after reload
  useEffect(() => {
    try {
      const t = localStorage.getItem(USER_TICKET_KEY);
      const e = localStorage.getItem(USER_EMAIL_KEY);
      if (t) {
        const n = Number(t);
        if (!Number.isNaN(n)) setUserTicket(n);
      }
      if (e) setUserEmail(e);
    } catch (err) {
      // ignore
    }
  }, []);

  // Reflect current notification permission on mount and watch for changes if Permissions API is available
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      if ('Notification' in window) {
        setNotificationsEnabled(Notification.permission === 'granted');
      }
      if (navigator.permissions && navigator.permissions.query) {
        navigator.permissions.query({ name: 'notifications' }).then((status) => {
          // initial state already set above, but ensure sync
          setNotificationsEnabled(status.state === 'granted');
          // update when permission changes (some browsers support onchange)
          status.onchange = () => setNotificationsEnabled(status.state === 'granted');
        }).catch(() => {
          // ignore permission query errors
        });
      }
    } catch (e) {
      // ignore
    }
  }, []);
  const [showQR, setShowQR] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const audioContextRef = useRef(null);
  const previousQueueRef = useRef(currentQueue);
  const subscriptionRef = useRef(null);

  // Initialize audio context
  useEffect(() => {
    audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
  }, []);

  // Check if Supabase is configured (reads Vite env vars at build time)
  const isSupabaseConfigured = SUPABASE_URL && SUPABASE_ANON_KEY;

  // Load queue data from Supabase
  useEffect(() => {
    if (!isSupabaseConfigured) {
      setIsLoading(false);
      return;
    }

    loadQueueData();
    loadSystemState();

    // Subscribe to real-time updates using Supabase Realtime
    const qSub = supabase
      .channel('public:queue_entries')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'queue_entries' }, payload => {
        // payload.record contains the changed row
        loadQueueData();
      })
      .subscribe();

    const sSub = supabase
      .channel('public:system_state')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'system_state' }, payload => {
        loadSystemState();
      })
      .subscribe();

    return () => {
      // Unsubscribe channels
      try { supabase.removeChannel(qSub); } catch (e) {}
      try { supabase.removeChannel(sSub); } catch (e) {}
    };
  }, [isSupabaseConfigured]);

  const loadQueueData = async () => {
    try {
      const { data, error } = await supabase
        .from('queue_entries')
        .select('*')
        .order('ticket', { ascending: true });
      if (error) throw error;
      setQueueData(data);
      setIsConnected(true);
      setIsLoading(false);
    } catch (error) {
      console.error('Error loading queue:', error);
      setIsConnected(false);
      setIsLoading(false);
    }
  };

  // Email notifications are not sent from the client. The app only validates and stores email addresses.

  const loadSystemState = async () => {
    try {
      const { data, error } = await supabase
        .from('system_state')
        .select('*')
        .limit(1);
      if (error) throw error;
      if (data && data.length > 0) {
        setCurrentQueue(data[0].current_queue);
      }
    } catch (error) {
      console.error('Error loading system state:', error);
    }
  };

  const updateSystemState = async (newQueue) => {
    try {
      const { error } = await supabase
        .from('system_state')
        .update({ current_queue: newQueue })
        .eq('id', 1);
      if (error) throw error;
    } catch (error) {
      console.error('Error updating system state:', error);
    }
  };

  // Request notification permission
  const requestNotificationPermission = async () => {
    if ('Notification' in window) {
      const permission = await Notification.requestPermission();
      setNotificationsEnabled(permission === 'granted');
    }
  };

  // Toggle sound and ensure audio context is resumed on user gesture
  const toggleSound = async () => {
    const next = !soundEnabled;
    setSoundEnabled(next);
    if (next && audioContextRef.current && audioContextRef.current.state === 'suspended') {
      try {
        await audioContextRef.current.resume();
      } catch (e) {
        // ignore
      }
    }
  };

  // Play notification sound
  const playNotificationSound = () => {
    if (!soundEnabled || !audioContextRef.current) return;
    const ctx = audioContextRef.current;
    const baseFreq = 600; // slower (lower pitch)
    const duration = 0.6; // length of each beep (seconds)
    const gap = 0.30; // gap between beeps
    const count = 3; // number of immediate beeps

    const playSequence = () => {
      if (!soundEnabled || !ctx) return;
      for (let i = 0; i < count; i++) {
        const oscillator = ctx.createOscillator();
        const gainNode = ctx.createGain();
        oscillator.type = 'sine';
        oscillator.frequency.value = baseFreq;
        oscillator.connect(gainNode);
        gainNode.connect(ctx.destination);

        const startTime = ctx.currentTime + i * (duration + gap);
        const stopTime = startTime + duration;

        gainNode.gain.setValueAtTime(0.001, startTime);
        gainNode.gain.linearRampToValueAtTime(0.3, startTime + 0.05);
        gainNode.gain.exponentialRampToValueAtTime(0.001, stopTime);

        oscillator.start(startTime);
        oscillator.stop(stopTime + 0.01);
      }
    };

    // Play immediate sequence
    playSequence();

    // Schedule one additional repeat after 10 seconds (10000 ms)
    setTimeout(() => {
      try { playSequence(); } catch (e) { console.error('Error replaying notification sound', e); }
    }, 10000);
  };

  // Send browser notification
  const sendNotification = (message) => {
    if (notificationsEnabled && 'Notification' in window && Notification.permission === 'granted') {
      new Notification('Shoot & Win Queue', {
        body: message,
        icon: '📷',
        badge: '📷',
        vibrate: [200, 100, 200]
      });
    }
  };

  // Check if user's turn and notify
  useEffect(() => {
    if (userTicket && currentQueue === userTicket && previousQueueRef.current !== currentQueue) {
      playNotificationSound();
      sendNotification("It's your turn! Please proceed to Ashraf for camera collection.");
      // email stored at join; we do not send emails from the client.
    }
    previousQueueRef.current = currentQueue;
  }, [currentQueue, userTicket]);

  // Clear persisted ticket when the queue has advanced past the user's ticket
  useEffect(() => {
    try {
      if (userTicket && currentQueue && userTicket < currentQueue) {
        localStorage.removeItem(USER_TICKET_KEY);
        localStorage.removeItem(USER_EMAIL_KEY);
        setUserTicket(null);
      }
    } catch (e) {
      // ignore
    }
  }, [currentQueue]);

  // Allow the user to clear their saved ticket manually
  const clearSavedTicket = () => {
    // Confirm with the user before clearing saved ticket
    try {
      if (!confirm('Clear your saved ticket? This will remove the ticket saved in this browser.')) return;
    } catch (e) {
      // If confirm isn't available, proceed
    }

    // Save last cleared value so user can undo
    try {
      lastClearedRef.current = { ticket: userTicket, email: userEmail };
    } catch (e) {
      lastClearedRef.current = null;
    }

    try {
      localStorage.removeItem(USER_TICKET_KEY);
      localStorage.removeItem(USER_EMAIL_KEY);
    } catch (e) {
      // ignore
    }
    setUserTicket(null);
    setUserEmail('');
    try { setToastMessage('Saved ticket cleared'); } catch (e) {}
    setUndoAvailable(true);
    // allow undo for 8 seconds
    try { clearTimeout(undoTimerRef.current); } catch (e) {}
    undoTimerRef.current = setTimeout(() => {
      setUndoAvailable(false);
      setToastMessage('');
      lastClearedRef.current = null;
    }, 8000);
  };

  const joinQueue = async () => {
    if (!userName.trim()) return;
    if (!userEmail || !userEmail.includes('@')) { alert('Please enter a valid email'); return; }

    const newTicket = queueData.length + 1;
    const newEntry = {
      ticket: newTicket,
      name: userName.trim(),
      email: userEmail.trim().toLowerCase(),
      status: 'waiting',
      created_at: new Date().toISOString()
    };

    if (isSupabaseConfigured) {
      try {
        const { data: inserted, error } = await supabase.from('queue_entries').insert(newEntry).select('*').maybeSingle();
        if (error) {
          // unique constraint on email will surface as a duplicate-key error from Postgres
          if (error?.code === '23505' || (error?.message && error.message.toLowerCase().includes('duplicate'))) {
            alert('An entry with this email already exists. Only one submission per email is allowed.');
            return;
          }
          throw error;
        }

        // Consider the insert successful: set ticket, persist to localStorage, and clear input before attempting refresh.
        const assignedTicket = inserted?.ticket ?? newTicket;
        setUserTicket(assignedTicket);
        try {
          localStorage.setItem(USER_TICKET_KEY, String(assignedTicket));
          localStorage.setItem(USER_EMAIL_KEY, newEntry.email);
        } catch (e) {
          // ignore storage errors
        }
        setUserName('');

        // Refresh data but do not surface a refresh error to the user when insert already succeeded.
        try {
          await loadQueueData();
        } catch (e) {
          console.warn('Warning: failed to refresh queue data after insert (non-fatal):', e);
          // Show subtle toast so user knows the row was saved locally/server-side
          try { setToastMessage('Saved — updating list...'); } catch (ee) {}
          // clear toast after a short time
          setTimeout(() => setToastMessage(''), 4000);
        }

        return;
      } catch (error) {
        console.error('Error joining queue:', error);
        alert('Failed to join queue. Please try again.');
        return;
      }
    }

    // Demo mode (no Supabase)
    setQueueData([...queueData, newEntry]);
    setUserTicket(newTicket);
    setUserName('');
  };

  const nextQueue = async () => {
    if (currentQueue >= queueData.length) return;

    const nextNumber = currentQueue + 1;
    
    try {
      if (isSupabaseConfigured) {
        // Update current entry to completed
        const currentEntry = queueData.find(item => item.ticket === currentQueue);
        if (currentEntry) {
          const { error } = await supabase.from('queue_entries').update({ status: 'completed' }).eq('id', currentEntry.id);
          if (error) throw error;
        }

        // Update next entry to current
        const nextEntry = queueData.find(item => item.ticket === nextNumber);
        if (nextEntry) {
          const { error } = await supabase.from('queue_entries').update({ status: 'current' }).eq('id', nextEntry.id);
          if (error) throw error;
        }

        // Update system state
        await updateSystemState(nextNumber);
        await loadQueueData();
      } else {
        const updatedQueue = queueData.map(item => {
          if (item.ticket === currentQueue) {
            return { ...item, status: 'completed' };
          } else if (item.ticket === nextNumber) {
            return { ...item, status: 'current' };
          }
          return item;
        });
        setQueueData(updatedQueue);
      }
      
      setCurrentQueue(nextNumber);
      playNotificationSound();
    } catch (error) {
      console.error('Error advancing queue:', error);
      alert('Failed to advance queue. Please try again.');
    }
  };

  const resetQueue = async () => {
    if (!confirm('Are you sure you want to reset the entire queue?')) return;

    try {
      if (isSupabaseConfigured) {
  const { error } = await supabase.from('queue_entries').delete().gte('ticket', 0);
  if (error) throw error;
        await updateSystemState(1);
        await loadQueueData();
      } else {
        setQueueData([]);
      }
      setCurrentQueue(1);
      setUserTicket(null);
    } catch (error) {
      console.error('Error resetting queue:', error);
      alert('Failed to reset queue. Please try again.');
    }
  };

  const getQueueStatus = () => {
    if (!userTicket) return null;
    if (userTicket < currentQueue) return 'completed';
    if (userTicket === currentQueue) return 'current';
    return 'waiting';
  };

  const generateQRCode = () => {
    const prodBase = 'https://mzmznasipadang.github.io/ADASayembara/';
    let target = window.location.href;
    try {
      const h = window.location.hostname;
      if (!h || h === 'localhost' || h.startsWith('127.') || h === '::1') {
        target = prodBase;
      }
    } catch (e) {
      target = prodBase;
    }
    return `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(target)}`;
  };

  const queueStatus = getQueueStatus();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-900 via-blue-800 to-blue-900 flex items-center justify-center">
        <div className="text-white text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
          <p>Loading queue system...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 via-blue-800 to-blue-900 p-4">
      {/* Inline styles for toast animation (keeps everything self-contained) */}
      <style>{`
        @keyframes fadeInUp { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
        .animate-fade-in-up { animation: fadeInUp 260ms ease-out both; }
      `}</style>
      <div className="max-w-md mx-auto">
        {/* Header */}
        <div className="text-center mb-6 pt-4">
          <p className="text-blue-200 text-sm mb-2">From The Creator of The Brewers Presents...</p>
          <h1 className="text-3xl font-bold text-white mb-1">#ADASayembara</h1>
          <div className="flex items-center justify-center gap-2 text-white">
            <Camera size={24} />
            <h2 className="text-2xl font-medium">Shoot & Win</h2>
          </div>
          <p className="text-blue-200 text-sm mt-2">Queue System</p>
        </div>

        {/* Connection Status & Settings Bar */}
        <div className="bg-white/10 backdrop-blur-sm rounded-xl p-3 mb-4 flex justify-between items-center">
          <div className="flex items-center gap-2">
            {isSupabaseConfigured ? (
              isConnected ? (
                <>
                  <Wifi size={16} className="text-green-300" />
                  <span className="text-xs text-green-300">Connected</span>
                </>
              ) : (
                <>
                  <WifiOff size={16} className="text-red-300" />
                  <span className="text-xs text-red-300">Offline</span>
                </>
              )
            ) : (
              <span className="text-xs text-yellow-300">Demo Mode</span>
            )}
          </div>
          <div className="flex gap-4">
            <button
              onClick={toggleSound}
              className="flex items-center gap-2 text-white hover:text-blue-200 transition-colors"
              title={soundEnabled ? 'Sound On' : 'Sound Off'}
            >
              {soundEnabled ? <Volume2 size={20} /> : <VolumeX size={20} />}
            </button>
            <button
              onClick={requestNotificationPermission}
              className={`flex items-center gap-2 transition-colors ${
                notificationsEnabled ? 'text-green-300' : 'text-white hover:text-blue-200'
              }`}
              title="Enable Notifications"
            >
              <Bell size={20} />
            </button>
          </div>
        </div>

        {/* Supabase Setup Warning */}
        {!isSupabaseConfigured && (
          <div className="bg-yellow-500/20 border border-yellow-500/50 rounded-xl p-4 mb-4 text-yellow-100 text-sm">
            <p className="font-semibold mb-1">⚙️ Setup Required</p>
            <p className="text-xs">Please configure your Supabase credentials in the code to enable real-time sync.</p>
          </div>
        )}

        {/* Current Queue Display */}
        <div className="bg-white rounded-2xl p-6 mb-4 shadow-xl">
          <div className="text-center">
            <p className="text-gray-600 text-sm mb-2">NOW SERVING</p>
            <div className="text-6xl font-bold text-blue-900 mb-2">
              {currentQueue.toString().padStart(3, '0')}
            </div>
            <div className="flex items-center justify-center gap-2 text-gray-600">
              <Users size={16} />
              <p className="text-sm">{queueData.length} in queue</p>
            </div>
            {queueData[currentQueue - 1] && (
              <p className="text-sm text-gray-500 mt-2">
                {queueData[currentQueue - 1].name}
              </p>
            )}
          </div>
        </div>

        {/* User Queue Status */}
        {userTicket && (
          <div className={`rounded-2xl p-6 mb-4 shadow-xl transition-all ${
            queueStatus === 'completed' ? 'bg-green-500' :
            queueStatus === 'current' ? 'bg-yellow-400 animate-pulse' :
            'bg-blue-600'
          }`}>
            <div className="text-center text-white">
              <p className="text-sm mb-2 opacity-90">Your Queue Number</p>
              <div className="text-5xl font-bold mb-3">
                {userTicket.toString().padStart(3, '0')}
              </div>
              {/* show saved email under the number for clarity */}
              {userEmail && (
                <p className="text-sm opacity-90 mb-2">{userEmail}</p>
              )}
              {queueStatus === 'completed' && (
                <div className="flex items-center justify-center gap-2">
                  <CheckCircle size={20} />
                  <p className="text-sm">Completed</p>
                </div>
              )}
              {queueStatus === 'current' && (
                <div className="flex flex-col items-center gap-2">
                  <Camera size={32} className="animate-bounce" />
                  <p className="text-lg font-bold">IT'S YOUR TURN!</p>
                  <p className="text-sm">Please proceed to the camera station</p>
                </div>
              )}
              {queueStatus === 'waiting' && (
                <div className="flex items-center justify-center gap-2">
                  <Clock size={20} />
                  <p className="text-sm">{userTicket - currentQueue} people ahead</p>
                </div>
              )}

              {/* Clear saved ticket button (high contrast) */}
              <div className="mt-6">
                <button
                  onClick={clearSavedTicket}
                  className="bg-white/10 text-white px-4 py-2 rounded-lg font-semibold hover:bg-white/20"
                >
                  Clear my saved ticket
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Join Queue */}
        {!userTicket && (
          <div className="bg-white rounded-2xl p-6 mb-4 shadow-xl">
            <h3 className="text-xl font-bold text-gray-900 mb-4">Join Queue</h3>
            <input
              type="text"
              placeholder="Enter your name"
              value={userName}
              onChange={(e) => setUserName(e.target.value)}
              className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg mb-3 focus:outline-none focus:border-blue-600"
              onKeyPress={(e) => e.key === 'Enter' && joinQueue()}
            />
            <input
              type="email"
              placeholder="Enter your email (for validation only)"
              value={userEmail}
              onChange={(e) => setUserEmail(e.target.value)}
              className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg mb-3 focus:outline-none focus:border-blue-600"
              onKeyPress={(e) => e.key === 'Enter' && joinQueue()}
            />
            <button
              onClick={joinQueue}
              disabled={!userName.trim()}
              className="w-full bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
            >
              Get Queue Number
            </button>
          </div>
        )}

        {/* Admin Controls */}
        <div className="bg-white rounded-2xl p-6 shadow-xl mb-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-gray-900">Admin Controls</h3>
            <button
              onClick={async () => {
                if (!isAdmin) {
                  // Use Supabase Auth to sign in, then verify admin membership via admin_users table
                  const email = prompt('Admin email:');
                  const pw = prompt('Admin password:');
                  if (!email || !pw) return;
                  try {
                    // Sign in with Supabase Auth
                    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({ email, password: pw });
                    if (authError) {
                      console.error('supabase.auth.signInWithPassword error', authError);
                      alert(`Auth error: ${authError.message || authError.toString()}`);
                      return;
                    }

                    // At this point the user should be authenticated. Inspect returned data.
                    console.debug('signInWithPassword data:', authData);
                    const user = authData?.user || null;
                    const session = authData?.session || null;

                    if (!user) {
                      // Defensive: sign out if no user
                      try { await supabase.auth.signOut(); } catch (e) {}
                      alert('Signed in but no user session found. Check console for details.');
                      return;
                    }

                    console.debug('Authenticated user id:', user.id);
                    console.debug('Session:', session);

                    // Query admin_users by auth_uid (strong binding)
                    const { data: adminRows, error: adminError } = await supabase.from('admin_users').select('id, username, auth_uid').eq('auth_uid', user.id).limit(1);
                    if (adminError) {
                      console.error('admin_users query error', adminError);
                      // This may be caused by RLS blocking the select. Hint: ensure the RLS policy allows auth.uid() = auth_uid
                      alert(`Admin lookup error: ${adminError.message || adminError.toString()}. If RLS is enabled, ensure the policy allows this read for the signed-in user.`);
                      try { await supabase.auth.signOut(); } catch (e) {}
                      return;
                    }

                    console.debug('adminRows:', adminRows);
                    if (adminRows && adminRows.length > 0) {
                      const admin = adminRows[0];
                      setIsAdmin(true);
                      setIsAdminAuthenticated(true);
                      try {
                        localStorage.setItem(ADMIN_STORAGE_KEY, '1');
                        localStorage.setItem(ADMIN_ID_KEY, admin.id);
                      } catch (e) {}
                    } else {
                      // Not an admin: sign out to avoid leaving an authenticated session
                      try { await supabase.auth.signOut(); } catch (e) {}
                      alert(`Signed in as ${email} (uid=${user.id}) but no admin_users row found for that auth UID.`);
                    }
                  } catch (e) {
                    console.error('Admin login error', e);
                    alert(`Admin login failed: ${e?.message || e}`);
                  }
                } else {
                  // Sign out admin
                  try {
                    await supabase.auth.signOut();
                  } catch (e) {}
                  setIsAdmin(false);
                  setIsAdminAuthenticated(false);
                  try { localStorage.removeItem(ADMIN_STORAGE_KEY); localStorage.removeItem(ADMIN_ID_KEY); } catch (e) {}
                }
              }}
              className="text-sm text-blue-600 hover:text-blue-800"
            >
              {isAdmin ? 'Hide' : 'Show'}
            </button>
          </div>
          
          {isAdminAuthenticated && (
            <div className="space-y-3">
              <button
                onClick={() => setShowQR(!showQR)}
                className="w-full bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
              >
                <QrCode size={20} />
                {showQR ? 'Hide QR Code' : 'Show QR Code'}
              </button>
              
              {showQR && (
                <div className="bg-gray-50 p-4 rounded-lg text-center">
                  <p className="text-sm text-gray-600 mb-3">Scan to join queue</p>
                  <img 
                    src={generateQRCode()} 
                    alt="Queue QR Code" 
                    className="mx-auto rounded-lg shadow-md"
                  />
                  <p className="text-xs text-gray-500 mt-2">Share this link or QR code</p>
                </div>
              )}
              
              <button
                onClick={nextQueue}
                disabled={currentQueue >= queueData.length}
                className="w-full bg-green-600 text-white py-3 rounded-lg font-semibold hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
              >
                Next Queue ({currentQueue < queueData.length ? currentQueue + 1 : '-'})
              </button>
              
              <button
                onClick={resetQueue}
                className="w-full bg-red-600 text-white py-3 rounded-lg font-semibold hover:bg-red-700 transition-colors"
              >
                Reset Queue
              </button>

              <button
                onClick={() => {
                  setIsAdmin(false);
                  setIsAdminAuthenticated(false);
                  try { localStorage.removeItem(ADMIN_STORAGE_KEY); } catch (e) {}
                }}
                className="w-full bg-gray-200 text-gray-800 py-2 rounded-lg font-medium hover:bg-gray-300 transition-colors"
              >
                Logout Admin
              </button>

              {/* Queue List */}
              {queueData.length > 0 && (
                <div className="mt-4 max-h-60 overflow-y-auto">
                  <h4 className="text-sm font-semibold text-gray-700 mb-2">Queue List</h4>
                  <div className="space-y-2">
                    {queueData.map((item) => (
                      <div
                        key={item.ticket}
                        className={`p-2 rounded-lg text-sm flex items-center justify-between ${
                          item.ticket === currentQueue
                            ? 'bg-yellow-100 border-2 border-yellow-400'
                            : item.ticket < currentQueue
                            ? 'bg-gray-100 text-gray-500'
                            : 'bg-blue-50'
                        }`}
                      >
                        <span className="font-semibold">#{item.ticket.toString().padStart(3, '0')}</span>
                        <span className="flex-1 mx-3">{item.name}</span>
                        {item.ticket === currentQueue && (
                          <span className="text-xs bg-yellow-400 px-2 py-1 rounded">Current</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Event Info */}
        <div className="text-center mt-6 text-blue-200 text-sm pb-4">
          <p>Registration: HTM 15k</p>
          <p className="mt-1">Contact: Victor & Ashraf (The Brewers)</p>
        </div>
      </div>
      {/* Toast (bottom-right) with optional Undo */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50">
          <div className="bg-black/80 text-white px-4 py-2 rounded-lg shadow-lg animate-fade-in-up flex items-center gap-3">
            <p className="text-sm">{toastMessage}</p>
            {undoAvailable && (
              <button
                onClick={() => {
                  try {
                    const last = lastClearedRef.current;
                    if (last && last.ticket) {
                      setUserTicket(last.ticket);
                      setUserEmail(last.email || '');
                      try { localStorage.setItem(USER_TICKET_KEY, String(last.ticket)); } catch (e) {}
                      try { if (last.email) localStorage.setItem(USER_EMAIL_KEY, last.email); } catch (e) {}
                    }
                  } catch (e) {}
                  setToastMessage('Restored saved ticket');
                  setUndoAvailable(false);
                  try { clearTimeout(undoTimerRef.current); } catch (e) {}
                  lastClearedRef.current = null;
                  setTimeout(() => setToastMessage(''), 2500);
                }}
                className="text-sm underline text-blue-200 hover:text-white"
              >
                Undo
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
