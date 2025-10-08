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
  const [isAdmin, setIsAdmin] = useState(false);
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

  // Play notification sound
  const playNotificationSound = () => {
    if (!soundEnabled || !audioContextRef.current) return;
    
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
      sendNotification("It's your turn! Please proceed to the camera station.");
    }
    previousQueueRef.current = currentQueue;
  }, [currentQueue, userTicket]);

  const joinQueue = async () => {
    if (!userName.trim()) return;

    const newTicket = queueData.length + 1;
    const newEntry = {
      ticket: newTicket,
      name: userName.trim(),
      status: 'waiting',
      created_at: new Date().toISOString()
    };

    try {
      if (isSupabaseConfigured) {
        const { error } = await supabase.from('queue_entries').insert(newEntry);
        if (error) throw error;
        await loadQueueData();
      } else {
        setQueueData([...queueData, newEntry]);
      }
      setUserTicket(newTicket);
      setUserName('');
    } catch (error) {
      console.error('Error joining queue:', error);
      alert('Failed to join queue. Please try again.');
    }
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
    return `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(window.location.href)}`;
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
              onChange={(e) => setUserName(e.target.value)}
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
              onClick={() => setIsAdmin(!isAdmin)}
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
          <p className="mt-1">Contact: Ilsa (SGA), Victor & Ashraf</p>
        </div>
      </div>
    </div>
  );
}
