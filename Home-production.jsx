import React, { useState, useEffect, useRef } from 'react';
import { Camera, Users, Clock, CheckCircle, QrCode, Bell, Volume2, VolumeX, Wifi, WifiOff, AlertCircle } from 'lucide-react';
import { createClient } from '@supabase/supabase-js';

// ============================================================================
// ISSUE 1: ENVIRONMENT VARIABLES - Move credentials to .env file
// ============================================================================
const SUPABASE_URL = process.env.REACT_APP_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.REACT_APP_SUPABASE_ANON_KEY || '';
const ADMIN_PASSWORD = process.env.REACT_APP_ADMIN_PASSWORD || 'admin123';

// Check if Supabase is configured
const isSupabaseConfigured = SUPABASE_URL && SUPABASE_ANON_KEY &&
                             SUPABASE_URL.startsWith('https://');

// Initialize Supabase client with proper configuration (only if configured)
const supabase = isSupabaseConfigured
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
      },
      realtime: {
        params: {
          eventsPerSecond: 10,
        },
      },
    })
  : null;

// ============================================================================
// ISSUE 2: ERROR BOUNDARY COMPONENT
// ============================================================================
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('Error caught by boundary:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-gradient-to-br from-blue-900 via-blue-800 to-blue-900 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md">
            <div className="flex items-center gap-3 text-red-600 mb-4">
              <AlertCircle size={24} />
              <h2 className="text-xl font-bold">Something went wrong</h2>
            </div>
            <p className="text-gray-600 mb-4">
              The application encountered an error. Please refresh the page to try again.
            </p>
            <button
              onClick={() => window.location.reload()}
              className="w-full bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700"
            >
              Refresh Page
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

// ============================================================================
// ISSUE 6: INPUT VALIDATION AND RATE LIMITING
// ============================================================================
class RateLimiter {
  constructor() {
    this.attempts = new Map();
  }

  checkLimit(key, maxAttempts = 5, windowMs = 60000) {
    const now = Date.now();
    const userAttempts = this.attempts.get(key) || [];

    // Filter out old attempts
    const recentAttempts = userAttempts.filter(time => now - time < windowMs);

    if (recentAttempts.length >= maxAttempts) {
      return {
        allowed: false,
        remainingTime: Math.ceil((windowMs - (now - recentAttempts[0])) / 1000),
      };
    }

    recentAttempts.push(now);
    this.attempts.set(key, recentAttempts);

    return { allowed: true };
  }

  clear(key) {
    this.attempts.delete(key);
  }
}

const rateLimiter = new RateLimiter();

// Input validation utilities
const validateName = (name) => {
  const trimmed = name.trim();

  if (!trimmed) {
    return { valid: false, error: 'Name cannot be empty' };
  }

  if (trimmed.length < 2) {
    return { valid: false, error: 'Name must be at least 2 characters' };
  }

  if (trimmed.length > 50) {
    return { valid: false, error: 'Name must be less than 50 characters' };
  }

  // Allow letters, numbers, spaces, and basic punctuation
  const validNameRegex = /^[a-zA-Z0-9\s\-'.]+$/;
  if (!validNameRegex.test(trimmed)) {
    return { valid: false, error: 'Name contains invalid characters' };
  }

  return { valid: true, name: trimmed };
};

// ============================================================================
// ISSUE 3: AUTHENTICATION FOR ADMIN CONTROLS
// ============================================================================
const AdminAuthModal = ({ onAuthenticate, onCancel }) => {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (password === ADMIN_PASSWORD) {
      onAuthenticate();
    } else {
      setError('Incorrect password');
      setPassword('');
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl p-6 max-w-sm w-full">
        <h3 className="text-xl font-bold text-gray-900 mb-4">Admin Authentication</h3>
        <form onSubmit={handleSubmit}>
          <input
            type="password"
            placeholder="Enter admin password"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              setError('');
            }}
            className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg mb-3 focus:outline-none focus:border-blue-600"
            autoFocus
          />
          {error && (
            <p className="text-red-600 text-sm mb-3">{error}</p>
          )}
          <div className="flex gap-3">
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 bg-gray-300 text-gray-700 py-3 rounded-lg font-semibold hover:bg-gray-400"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700"
            >
              Login
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ============================================================================
// MAIN QUEUE SYSTEM COMPONENT
// ============================================================================
function QueueSystem() {
  const [currentQueue, setCurrentQueue] = useState(1);
  const [queueData, setQueueData] = useState([]);
  const [userTicket, setUserTicket] = useState(null);
  const [userName, setUserName] = useState('');
  const [isAdmin, setIsAdmin] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showQR, setShowQR] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [validationError, setValidationError] = useState('');

  const audioContextRef = useRef(null);
  const previousQueueRef = useRef(currentQueue);
  const channelRef = useRef(null);
  const stateChannelRef = useRef(null);

  // Initialize audio context
  useEffect(() => {
    try {
      audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
    } catch (err) {
      console.error('Audio context not supported:', err);
    }
  }, []);

  // Supabase configuration check is done at module level

  // ============================================================================
  // ISSUE 4: REALTIME SUBSCRIPTIONS (replacing polling)
  // ============================================================================
  useEffect(() => {
    if (!isSupabaseConfigured) {
      setIsLoading(false);
      return;
    }

    const initializeData = async () => {
      try {
        await loadQueueData();
        await loadSystemState();
        setIsConnected(true);
      } catch (err) {
        setError('Failed to load initial data');
        console.error('Initialization error:', err);
        setIsConnected(false);
      } finally {
        setIsLoading(false);
      }
    };

    initializeData();

    // Subscribe to queue_entries changes
    if (supabase) {
      channelRef.current = supabase
        .channel('queue_entries_channel')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'queue_entries',
          },
          (payload) => {
            console.log('Queue change received:', payload);
            loadQueueData();
          }
        )
        .subscribe((status) => {
          console.log('Queue subscription status:', status);
          setIsConnected(status === 'SUBSCRIBED');
        });

      // Subscribe to system_state changes
      stateChannelRef.current = supabase
        .channel('system_state_channel')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'system_state',
          },
          (payload) => {
            console.log('System state change received:', payload);
            if (payload.new?.current_queue) {
              setCurrentQueue(payload.new.current_queue);
            }
          }
        )
        .subscribe((status) => {
          console.log('State subscription status:', status);
        });
    }

    return () => {
      if (supabase && channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }
      if (supabase && stateChannelRef.current) {
        supabase.removeChannel(stateChannelRef.current);
      }
    };
  }, [isSupabaseConfigured]);

  // ============================================================================
  // DATABASE OPERATIONS WITH ERROR HANDLING
  // ============================================================================
  const loadQueueData = async () => {
    if (!supabase) return;
    try {
      const { data, error } = await supabase
        .from('queue_entries')
        .select('*')
        .order('ticket', { ascending: true });

      if (error) throw error;
      setQueueData(data || []);
      setError(null);
    } catch (err) {
      console.error('Error loading queue:', err);
      setError('Failed to load queue data');
      throw err;
    }
  };

  const loadSystemState = async () => {
    if (!supabase) return;
    try {
      const { data, error } = await supabase
        .from('system_state')
        .select('*')
        .eq('id', 1)
        .single();

      if (error) throw error;
      if (data) {
        setCurrentQueue(data.current_queue);
      }
      setError(null);
    } catch (err) {
      console.error('Error loading system state:', err);
      setError('Failed to load system state');
      throw err;
    }
  };

  const updateSystemState = async (newQueue) => {
    if (!supabase) return;
    try {
      const { error } = await supabase
        .from('system_state')
        .update({ current_queue: newQueue })
        .eq('id', 1);

      if (error) throw error;
      setError(null);
    } catch (err) {
      console.error('Error updating system state:', err);
      setError('Failed to update system state');
      throw err;
    }
  };

  // Request notification permission
  const requestNotificationPermission = async () => {
    if ('Notification' in window) {
      try {
        const permission = await Notification.requestPermission();
        setNotificationsEnabled(permission === 'granted');
      } catch (err) {
        console.error('Notification permission error:', err);
      }
    }
  };

  // Play notification sound
  const playNotificationSound = () => {
    if (!soundEnabled || !audioContextRef.current) return;

    try {
      const ctx = audioContextRef.current;
      const oscillator = ctx.createOscillator();
      const gainNode = ctx.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(ctx.destination);

      oscillator.frequency.value = 800;
      oscillator.type = 'sine';

      gainNode.gain.setValueAtTime(0.3, ctx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);

      oscillator.start(ctx.currentTime);
      oscillator.stop(ctx.currentTime + 0.5);
    } catch (err) {
      console.error('Sound playback error:', err);
    }
  };

  // Send browser notification
  const sendNotification = (message) => {
    if (notificationsEnabled && 'Notification' in window && Notification.permission === 'granted') {
      try {
        new Notification('Shoot & Win Queue', {
          body: message,
          icon: '📷',
          badge: '📷',
          vibrate: [200, 100, 200],
        });
      } catch (err) {
        console.error('Notification error:', err);
      }
    }
  };

  // Check if user's turn and notify
  useEffect(() => {
    if (userTicket && currentQueue === userTicket && previousQueueRef.current !== currentQueue) {
      playNotificationSound();
      sendNotification("It's your turn! Please proceed to the camera station.");
    }
    previousQueueRef.current = currentQueue;
  }, [currentQueue, userTicket]);

  // ============================================================================
  // ISSUE 6: JOIN QUEUE WITH VALIDATION AND RATE LIMITING
  // ============================================================================
  const joinQueue = async () => {
    // Validate input
    const validation = validateName(userName);
    if (!validation.valid) {
      setValidationError(validation.error);
      return;
    }

    // Check rate limit
    const ipKey = 'user_join'; // In production, use actual IP address
    const rateCheck = rateLimiter.checkLimit(ipKey, 3, 60000); // 3 attempts per minute

    if (!rateCheck.allowed) {
      setValidationError(`Too many attempts. Please wait ${rateCheck.remainingTime} seconds.`);
      return;
    }

    const newTicket = queueData.length + 1;
    const newEntry = {
      ticket: newTicket,
      name: validation.name,
      status: 'waiting',
      created_at: new Date().toISOString(),
    };

    try {
      if (isSupabaseConfigured) {
        const { error } = await supabase
          .from('queue_entries')
          .insert([newEntry]);

        if (error) throw error;
        await loadQueueData();
      } else {
        setQueueData([...queueData, newEntry]);
      }

      setUserTicket(newTicket);
      setUserName('');
      setValidationError('');
      setError(null);
    } catch (err) {
      console.error('Error joining queue:', err);
      setError('Failed to join queue. Please try again.');
      setValidationError('Unable to join queue. Please try again.');
    }
  };

  // ============================================================================
  // ISSUE 3: ADMIN CONTROLS WITH AUTHENTICATION
  // ============================================================================
  const handleAdminToggle = () => {
    if (!isAdmin) {
      // Trying to open admin panel
      if (!isAuthenticated) {
        setShowAuthModal(true);
      } else {
        setIsAdmin(true);
      }
    } else {
      // Closing admin panel
      setIsAdmin(false);
    }
  };

  const handleAuthenticate = () => {
    setIsAuthenticated(true);
    setIsAdmin(true);
    setShowAuthModal(false);
  };

  const nextQueue = async () => {
    if (!isAuthenticated) {
      setError('Admin authentication required');
      return;
    }

    if (currentQueue >= queueData.length) return;

    const nextNumber = currentQueue + 1;

    try {
      if (isSupabaseConfigured) {
        // Update current entry to completed
        const currentEntry = queueData.find(item => item.ticket === currentQueue);
        if (currentEntry) {
          const { error: updateError } = await supabase
            .from('queue_entries')
            .update({ status: 'completed' })
            .eq('id', currentEntry.id);

          if (updateError) throw updateError;
        }

        // Update next entry to current
        const nextEntry = queueData.find(item => item.ticket === nextNumber);
        if (nextEntry) {
          const { error: updateError } = await supabase
            .from('queue_entries')
            .update({ status: 'current' })
            .eq('id', nextEntry.id);

          if (updateError) throw updateError;
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
      setError(null);
    } catch (err) {
      console.error('Error advancing queue:', err);
      setError('Failed to advance queue. Please try again.');
    }
  };

  const resetQueue = async () => {
    if (!isAuthenticated) {
      setError('Admin authentication required');
      return;
    }

    if (!window.confirm('Are you sure you want to reset the entire queue?')) return;

    try {
      if (isSupabaseConfigured) {
        const { error: deleteError } = await supabase
          .from('queue_entries')
          .delete()
          .gte('ticket', 0);

        if (deleteError) throw deleteError;

        await updateSystemState(1);
        await loadQueueData();
      } else {
        setQueueData([]);
      }

      setCurrentQueue(1);
      setUserTicket(null);
      setError(null);
    } catch (err) {
      console.error('Error resetting queue:', err);
      setError('Failed to reset queue. Please try again.');
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

  // ============================================================================
  // RENDER LOADING STATE
  // ============================================================================
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

  // ============================================================================
  // RENDER MAIN UI
  // ============================================================================
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 via-blue-800 to-blue-900 p-4">
      <div className="max-w-md mx-auto">
        {/* Header */}
        <div className="text-center mb-6 pt-4">
          <p className="text-blue-200 text-sm mb-2">From The Creator of The Brewers Presents...</p>
          <h1 className="text-3xl font-bold text-white mb-1">#ADASayembara</h1>
          <div className="flex items-center justify-center gap-2 text-white">
            <Camera size={24} />
            <h2 className="text-2xl font-semibold">Shoot & Win</h2>
          </div>
          <p className="text-blue-200 text-sm mt-2">MDL-9 Queue System</p>
        </div>

        {/* Error Display */}
        {error && (
          <div className="bg-red-500/20 border border-red-500/50 rounded-xl p-4 mb-4 text-red-100 text-sm flex items-start gap-2">
            <AlertCircle size={20} className="flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold mb-1">Error</p>
              <p className="text-xs">{error}</p>
            </div>
          </div>
        )}

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
              onClick={() => setSoundEnabled(!soundEnabled)}
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
            <p className="text-xs">Please configure your Supabase credentials in .env to enable real-time sync.</p>
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
              onChange={(e) => {
                setUserName(e.target.value);
                setValidationError('');
              }}
              className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg mb-2 focus:outline-none focus:border-blue-600"
              onKeyPress={(e) => e.key === 'Enter' && joinQueue()}
              maxLength={50}
            />
            {validationError && (
              <p className="text-red-600 text-sm mb-3">{validationError}</p>
            )}
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
              onClick={handleAdminToggle}
              className="text-sm text-blue-600 hover:text-blue-800"
            >
              {isAdmin ? 'Hide' : 'Show'}
            </button>
          </div>

          {isAdmin && (
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

              {/* Queue List */}
              {queueData.length > 0 && (
                <div className="mt-4 max-h-60 overflow-y-auto">
                  <h4 className="text-sm font-semibold text-gray-700 mb-2">Queue List</h4>
                  <div className="space-y-2">
                    {queueData.map((item) => (
                      <div
                        key={item.id || item.ticket}
                        className={`p-2 rounded-lg text-sm flex items-center justify-between ${
                          item.ticket === currentQueue
                            ? 'bg-yellow-100 border-2 border-yellow-400'
                            : item.ticket < currentQueue
                            ? 'bg-gray-100 text-gray-500'
                            : 'bg-blue-50'
                        }`}
                      >
                        <span className="font-semibold">#{item.ticket.toString().padStart(3, '0')}</span>
                        <span className="flex-1 mx-3 truncate">{item.name}</span>
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
          <p className="mt-1">Contact: Ilsa (SGA), Victor & Ashraf</p>
        </div>
      </div>

      {/* Admin Auth Modal */}
      {showAuthModal && (
        <AdminAuthModal
          onAuthenticate={handleAuthenticate}
          onCancel={() => setShowAuthModal(false)}
        />
      )}
    </div>
  );
}

// ============================================================================
// EXPORT WITH ERROR BOUNDARY
// ============================================================================
export default function App() {
  return (
    <ErrorBoundary>
      <QueueSystem />
    </ErrorBoundary>
  );
}
