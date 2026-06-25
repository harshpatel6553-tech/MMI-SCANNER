import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../supabaseClient';
import { useAuth } from '../../context/AuthContext';
import { useSocketContext } from '../../context/SocketContext';
import './AdminDashboard.css';

interface Profile {
  id: string;
  email: string;
  trial_start_date: string;
  subscription_status: string;
}

export function AdminDashboard() {
  const navigate = useNavigate();
  const { profile, signOut } = useAuth();
  const [users, setUsers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [onlineUsers, setOnlineUsers] = useState<{ email: string; connectedAt: string }[]>([]);
  const { socket } = useSocketContext();

  useEffect(() => {
    fetchUsers();
  }, []);

  // Listen for live online user updates from the server
  useEffect(() => {
    if (!socket) return;

    // Request the current online user list
    socket.emit('admin:request-online-users');

    // Listen for real-time updates
    socket.on('admin:online-users', (users: { email: string; connectedAt: string }[]) => {
      setOnlineUsers(users);
    });

    return () => {
      socket.off('admin:online-users');
    };
  }, [socket]);

  const fetchUsers = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .order('trial_start_date', { ascending: false });

      if (error) throw error;
      setUsers(data || []);
    } catch (err) {
      console.error('Error fetching users:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleGrantAccess = async (userId: string, tier: 'monthly' | 'yearly' | 'lifetime') => {
    try {
      let statusString = 'active'; // lifetime
      if (tier === 'monthly') {
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 30);
        statusString = `monthly:${expiresAt.toISOString()}`;
      } else if (tier === 'yearly') {
        const expiresAt = new Date();
        expiresAt.setFullYear(expiresAt.getFullYear() + 1);
        statusString = `yearly:${expiresAt.toISOString()}`;
      }

      const { error } = await supabase
        .from('profiles')
        .update({ subscription_status: statusString })
        .eq('id', userId);

      if (error) throw error;
      
      // Update local state
      setUsers(users.map(u => 
        u.id === userId ? { ...u, subscription_status: statusString } : u
      ));
    } catch (err) {
      console.error('Error granting access:', err);
      alert('Failed to grant access');
    }
  };

  const handleRevoke = async (userId: string) => {
    if (!window.confirm("Are you sure you want to revoke this user's access?")) return;
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ subscription_status: 'expired' })
        .eq('id', userId);

      if (error) throw error;
      
      // Update local state
      setUsers(users.map(u => 
        u.id === userId ? { ...u, subscription_status: 'expired' } : u
      ));
    } catch (err) {
      console.error('Error revoking user:', err);
      alert('Failed to revoke user');
    }
  };

  const formatStatus = (status: string) => {
    if (status === 'active') return 'Lifetime';
    if (status.startsWith('monthly:')) return 'Monthly';
    if (status.startsWith('yearly:')) return 'Yearly';
    if (status === 'trialing') return 'Trialing';
    return 'Expired';
  };

  if (!profile?.is_admin) {
    return (
      <div className="admin-container">
        <div className="glass-card" style={{ padding: '2rem', textAlign: 'center' }}>
          <h2>Access Denied</h2>
          <p>You must be an administrator to view this page.</p>
          <button className="signout-btn" onClick={() => navigate('/')}>Go Back</button>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-container">
      <div className="admin-header">
        <h2>Admin Dashboard</h2>
        <div className="admin-actions">
          <button className="signout-btn" onClick={() => navigate('/')}>Back to Scanner</button>
          <button className="signout-btn" onClick={signOut}>Sign Out</button>
        </div>
      </div>

      <div className="admin-card glass-card" style={{ marginBottom: '1.5rem' }}>
        <h3 style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ display: 'inline-block', width: '10px', height: '10px', borderRadius: '50%', background: '#4ade80', boxShadow: '0 0 8px #4ade80', animation: 'pulse 2s infinite' }}></span>
          Live Users — {onlineUsers.length} Online
        </h3>
        {onlineUsers.length === 0 ? (
          <p style={{ color: 'var(--text-secondary)', padding: '1rem 0' }}>No users currently online</p>
        ) : (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', marginTop: '1rem' }}>
            {onlineUsers.map((u, i) => (
              <div key={i} style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '8px 14px',
                borderRadius: '8px',
                background: 'rgba(74, 222, 128, 0.08)',
                border: '1px solid rgba(74, 222, 128, 0.2)',
                fontSize: '0.85rem',
                color: '#4ade80',
              }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#4ade80', flexShrink: 0 }}></span>
                <span style={{ color: 'var(--text-primary)' }}>{u.email}</span>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>
                  since {new Date(u.connectedAt).toLocaleTimeString()}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="admin-card glass-card">
        <h3>User Management</h3>
        
        {loading ? (
          <p>Loading users...</p>
        ) : (
          <div className="table-responsive">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Email</th>
                  <th>Signed Up</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map(u => {
                  const date = new Date(u.trial_start_date).toLocaleDateString();
                  
                  // Calculate trial logic identically to AuthContext
                  let isTrialExpired = false;
                  let trialDaysLeft = 0;
                  let badgeStatus = u.subscription_status;

                  if (u.subscription_status === 'active') {
                    badgeStatus = 'Lifetime';
                  } else if (u.subscription_status?.startsWith('monthly:')) {
                    badgeStatus = 'Monthly';
                  } else if (u.subscription_status?.startsWith('yearly:')) {
                    badgeStatus = 'Yearly';
                  } else {
                    // It's a trial or expired
                    const trialStart = new Date(u.trial_start_date).getTime();
                    const now = new Date().getTime();
                    const daysElapsed = Math.floor((now - trialStart) / (1000 * 60 * 60 * 24));
                    trialDaysLeft = Math.max(0, 14 - daysElapsed);
                    
                    if (trialDaysLeft === 0 || u.subscription_status === 'expired') {
                      isTrialExpired = true;
                      badgeStatus = 'Expired';
                    } else {
                      badgeStatus = 'Trialing';
                    }
                  }

                  return (
                    <tr key={u.id}>
                      <td>{u.email}</td>
                      <td>{date}</td>
                      <td>
                        <div className="status-cell">
                          <span className={`status-badge ${badgeStatus.toLowerCase()}`}>
                            {badgeStatus}
                          </span>
                          {(badgeStatus === 'Monthly' || badgeStatus === 'Yearly') && u.subscription_status && (
                            <span className="expires-date text-muted" style={{ display: 'block', fontSize: '0.75rem', marginTop: '4px' }}>
                              Exp: {new Date(u.subscription_status.split(':')[1]).toLocaleDateString()}
                            </span>
                          )}
                          {badgeStatus === 'Trialing' && (
                            <span className="expires-date text-muted" style={{ display: 'block', fontSize: '0.75rem', marginTop: '4px', color: '#60a5fa' }}>
                              Exp: {new Date(new Date(u.trial_start_date).getTime() + 14 * 24 * 60 * 60 * 1000).toLocaleDateString()} 
                              <br/>
                              ({trialDaysLeft} days left)
                            </span>
                          )}
                        </div>
                      </td>
                      <td>
                        <div className="admin-action-buttons" style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                          <button 
                            className="action-btn approve"
                            onClick={() => handleGrantAccess(u.id, 'monthly')}
                            style={{ background: 'rgba(59, 130, 246, 0.15)', color: '#60a5fa', borderColor: 'rgba(59, 130, 246, 0.3)' }}
                          >
                            + Monthly
                          </button>
                          <button 
                            className="action-btn approve"
                            onClick={() => handleGrantAccess(u.id, 'yearly')}
                            style={{ background: 'rgba(168, 85, 247, 0.15)', color: '#c084fc', borderColor: 'rgba(168, 85, 247, 0.3)' }}
                          >
                            + Yearly
                          </button>
                          <button 
                            className="action-btn approve"
                            onClick={() => handleGrantAccess(u.id, 'lifetime')}
                          >
                            + Lifetime
                          </button>
                          <button 
                            className="action-btn revoke"
                            onClick={() => handleRevoke(u.id)}
                          >
                            Revoke All
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
