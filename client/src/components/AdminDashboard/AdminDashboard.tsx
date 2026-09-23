import { useEffect, useState, useMemo } from 'react';
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

type FilterState = {
  email: string;
  status: string;
};

export function AdminDashboard() {
  const navigate = useNavigate();
  const { profile, signOut } = useAuth();
  const [users, setUsers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [onlineUsers, setOnlineUsers] = useState<{ email: string; connectedAt: string; avatar?: string }[]>([]);
  const { socket } = useSocketContext();
  
  const [filters, setFilters] = useState<FilterState>({ email: '', status: 'all' });
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  useEffect(() => { fetchUsers(); }, []);

  useEffect(() => {
    if (!socket) return;
    socket.emit('admin:request-online-users');
    socket.on('admin:online-users', (users: { email: string; connectedAt: string; avatar?: string }[]) => {
      setOnlineUsers(users);
    });
    return () => { socket.off('admin:online-users'); };
  }, [socket]);

  const fetchUsers = async () => {
    try {
      const { data, error } = await supabase.from('profiles').select('*').order('trial_start_date', { ascending: false });
      if (error) throw error;
      setUsers(data || []);
    } catch (err) {
      console.error('Error fetching users:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleGrantAccess = async (userId: string, tier: 'monthly' | 'yearly' | 'three_years') => {
    try {
      let statusString = 'active';
      if (tier === 'monthly') {
        const expiresAt = new Date(); expiresAt.setDate(expiresAt.getDate() + 30); statusString = `monthly:${expiresAt.toISOString()}`;
      } else if (tier === 'yearly') {
        const expiresAt = new Date(); expiresAt.setFullYear(expiresAt.getFullYear() + 1); statusString = `yearly:${expiresAt.toISOString()}`;
      } else if (tier === 'three_years') {
        const expiresAt = new Date(); expiresAt.setFullYear(expiresAt.getFullYear() + 3); statusString = `three_years:${expiresAt.toISOString()}`;
      }
      const { error } = await supabase.from('profiles').update({ subscription_status: statusString }).eq('id', userId);
      if (error) throw error;
      setUsers(users.map(u => u.id === userId ? { ...u, subscription_status: statusString } : u));
    } catch (err) {
      console.error('Error granting access:', err); alert('Failed to grant access');
    }
  };

  const handleRevoke = async (userId: string) => {
    if (!window.confirm("Are you sure you want to revoke this user's access?")) return;
    try {
      const { error } = await supabase.from('profiles').update({ subscription_status: 'expired' }).eq('id', userId);
      if (error) throw error;
      setUsers(users.map(u => u.id === userId ? { ...u, subscription_status: 'expired' } : u));
    } catch (err) {
      console.error('Error revoking access:', err); alert('Failed to revoke access');
    }
  };

  const handleBulkRevoke = async () => {
    if (!window.confirm(`Are you sure you want to revoke access for ${selectedIds.length} users?`)) return;
    try {
      // Note: In a real app, this should be a bulk RPC call or done in a loop/batch
      for (const id of selectedIds) {
        await supabase.from('profiles').update({ subscription_status: 'expired' }).eq('id', id);
      }
      setUsers(users.map(u => selectedIds.includes(u.id) ? { ...u, subscription_status: 'expired' } : u));
      setSelectedIds([]);
    } catch (err) {
      console.error('Error in bulk revoke:', err); alert('Failed to bulk revoke access');
    }
  };

  const handleForceRefresh = () => {
    if (!socket) return;
    if (!window.confirm("Are you sure you want to force all users to refresh?")) return;
    socket.emit('admin:force-refresh-all');
    alert('Force refresh signal sent to all online users.');
  };
  
  const computedUsers = useMemo(() => {
    return users.map(u => {
      let trialDaysLeft = 0;
      let badgeStatus = u.subscription_status || 'Trialing';

      if (u.subscription_status === 'active') badgeStatus = 'Lifetime';
      else if (u.subscription_status?.startsWith('monthly:')) badgeStatus = 'Monthly';
      else if (u.subscription_status?.startsWith('yearly:')) badgeStatus = 'Yearly';
      else if (u.subscription_status?.startsWith('three_years:')) badgeStatus = '3 Years';
      else {
        const trialStart = new Date(u.trial_start_date).getTime();
        const daysElapsed = Math.floor((new Date().getTime() - trialStart) / (1000 * 60 * 60 * 24));
        trialDaysLeft = Math.max(0, 14 - daysElapsed);
        if (trialDaysLeft === 0 || u.subscription_status === 'expired') badgeStatus = 'Expired';
        else badgeStatus = 'Trialing';
      }
      return { ...u, computedStatus: badgeStatus, trialDaysLeft };
    });
  }, [users]);

  const filteredItems = useMemo(() => {
    const q = filters.email.trim().toLowerCase();
    return computedUsers.filter(item => {
      const matchesEmail = q ? item.email.toLowerCase().includes(q) : true;
      const matchesStatus = filters.status === 'all' ? true : item.computedStatus.toLowerCase() === filters.status.toLowerCase();
      return matchesEmail && matchesStatus;
    });
  }, [computedUsers, filters]);

  const selectedIdSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const visibleIds = filteredItems.map(item => item.id);
  const allSelected = visibleIds.length > 0 && visibleIds.every(id => selectedIdSet.has(id));
  const someSelected = visibleIds.some(id => selectedIdSet.has(id)) && !allSelected;

  const updateFilter = <K extends keyof FilterState>(key: K, value: FilterState[K]) => {
    setFilters(current => ({ ...current, [key]: value }));
  };

  const toggleAll = (checked: boolean) => {
    if (checked) return setSelectedIds(current => Array.from(new Set([...current, ...visibleIds])));
    setSelectedIds(current => current.filter(id => !visibleIds.includes(id)));
  };

  const toggleRow = (id: string, checked: boolean) => {
    setSelectedIds(current => {
      if (checked) return current.includes(id) ? current : [...current, id];
      return current.filter(item => item !== id);
    });
  };

  const getBadgeClass = (status: string) => {
    switch (status) {
      case 'Lifetime': return 'badge-pill purple';
      case 'Monthly': 
      case 'Yearly': 
      case '3 Years': return 'badge-pill cyan';
      case 'Trialing': return 'badge-pill up';
      case 'Expired': return 'badge-pill down';
      default: return 'badge-pill neutral';
    }
  };

  if (!profile?.is_admin) {
    return (
      <div className="admin-container">
        <div className="admin-live-card" style={{ padding: '3rem', textAlign: 'center' }}>
          <h2 style={{ fontFamily: 'var(--font-display)', marginBottom: 16 }}>Access Denied</h2>
          <p style={{ color: 'var(--text-2)', marginBottom: 20 }}>Your account does not have administrative privileges.</p>
          <button className="beast-btn" onClick={() => navigate('/')}>← Return to Scanner</button>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-container">
      {/* Top Action Bar */}
      <div className="admin-toolbar">
        <button className="beast-btn" onClick={() => navigate('/')}>
          ← Back to Scanner
        </button>
        <button className="beast-btn danger" onClick={signOut}>
          Sign Out
        </button>
      </div>

      {/* Live Online Users Card */}
      <div className="admin-live-card">
        <div className="admin-live-head">
          <div className="admin-live-title">
            <span className="telemetry-dot live" />
            <span>Live Concurrent Users · <span style={{ color: 'var(--up)' }}>{onlineUsers.length} Online</span></span>
          </div>
          <button 
            className="beast-btn danger sm"
            onClick={handleForceRefresh}
            style={{ display: 'flex', alignItems: 'center', gap: 6 }}
          >
            <span>↻</span> Force Refresh All Sessions
          </button>
        </div>

        {onlineUsers.length === 0 ? (
          <p style={{ color: 'var(--text-3)', fontSize: 13, marginTop: 14, marginBottom: 0 }}>No active user sessions detected.</p>
        ) : (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginTop: 16 }}>
            {onlineUsers.map((u, i) => (
              <div key={i} className="admin-user-pill">
                {u.avatar ? (
                  <img src={u.avatar} alt="Avatar" style={{ width: 22, height: 22, borderRadius: '50%', objectFit: 'cover' }} />
                ) : (
                  <div style={{ width: 22, height: 22, borderRadius: '50%', background: 'var(--up-dim)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 800, color: 'var(--up)' }}>
                    {u.email.substring(0, 2).toUpperCase()}
                  </div>
                )}
                <span style={{ color: 'var(--text-1)', fontWeight: 600 }}>{u.email}</span>
                <span style={{ fontSize: 10, color: 'var(--text-3)' }}>since {new Date(u.connectedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Users Management Table Card */}
      <div className="admin-table-card">
        <div className="admin-filter-bar">
          <div className="admin-field">
            <label htmlFor="email-filter" className="admin-label">Search Email</label>
            <div className="admin-input-wrap">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
              <input
                id="email-filter"
                className="admin-input"
                value={filters.email}
                onChange={(e) => updateFilter('email', e.target.value)}
                placeholder="Search user email address..."
                type="text"
              />
            </div>
          </div>

          <div className="admin-field">
            <label htmlFor="status-filter" className="admin-label">Subscription Tier</label>
            <select
              id="status-filter"
              className="admin-select"
              value={filters.status}
              onChange={(e) => updateFilter('status', e.target.value)}
            >
              <option value="all">All Subscription Tiers</option>
              <option value="trialing">Trialing</option>
              <option value="monthly">Monthly</option>
              <option value="yearly">Yearly</option>
              <option value="lifetime">Lifetime</option>
              <option value="expired">Expired</option>
            </select>
          </div>

          <div className="admin-field" style={{ justifyContent: 'flex-end', display: 'flex' }}>
            {selectedIdSet.size > 0 && (
              <div style={{ display: 'flex', gap: 12, alignItems: 'center', justifyContent: 'flex-end' }}>
                <span style={{ fontSize: 12, color: 'var(--text-2)', fontFamily: 'var(--font-mono)' }}>{selectedIdSet.size} selected</span>
                <button 
                  onClick={handleBulkRevoke}
                  className="beast-btn danger sm"
                >
                  Bulk Revoke
                </button>
              </div>
            )}
          </div>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table className="admin-table">
            <thead>
              <tr>
                <th style={{ width: 44, textAlign: 'center' }}>
                  <input 
                    type="checkbox" 
                    checked={allSelected} 
                    ref={input => { if (input) input.indeterminate = someSelected; }}
                    onChange={(e) => toggleAll(e.target.checked)}
                    style={{ cursor: 'pointer', accentColor: 'var(--cyan)' }}
                  />
                </th>
                <th>User Account</th>
                <th>Registered</th>
                <th>Access Status</th>
                <th style={{ textAlign: 'right' }}>Manage Access</th>
              </tr>
            </thead>
            <tbody>
              {filteredItems.length > 0 ? (
                filteredItems.map((item) => {
                  const isSelected = selectedIdSet.has(item.id);
                  const date = new Date(item.trial_start_date).toLocaleDateString();

                  // Robust expiry formatting (prevents "Exp: Invalid Date")
                  let expLabel: string | null = null;
                  if (item.computedStatus === 'Trialing' && item.trial_start_date) {
                    const expTime = new Date(item.trial_start_date).getTime() + 14 * 24 * 60 * 60 * 1000;
                    expLabel = `Exp: ${new Date(expTime).toLocaleDateString()} (${item.trialDaysLeft}d)`;
                  } else if (item.subscription_status && item.subscription_status.includes(':')) {
                    const rawDate = item.subscription_status.split(':')[1];
                    if (rawDate) {
                      const parsed = new Date(rawDate);
                      if (!isNaN(parsed.getTime())) {
                        expLabel = `Exp: ${parsed.toLocaleDateString()}`;
                      }
                    }
                  }

                  return (
                    <tr 
                      key={item.id} 
                      className={isSelected ? 'is-selected' : ''}
                    >
                      <td style={{ textAlign: 'center' }}>
                        <input 
                          type="checkbox" 
                          checked={isSelected} 
                          onChange={(e) => toggleRow(item.id, e.target.checked)}
                          style={{ cursor: 'pointer', accentColor: 'var(--cyan)' }}
                        />
                      </td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                          {(() => {
                            const onlineData = onlineUsers.find(u => u.email === item.email);
                            const avatarUrl = onlineData?.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(item.email)}`;
                            const isOnline = !!onlineData;
                            return (
                              <div style={{ position: 'relative', flexShrink: 0 }}>
                                <img src={avatarUrl} alt="Avatar" style={{ width: 34, height: 34, borderRadius: '50%', objectFit: 'cover', border: '1px solid var(--border)' }} />
                                {isOnline && (
                                  <div style={{ position: 'absolute', bottom: 0, right: 0, width: 9, height: 9, background: 'var(--up)', borderRadius: '50%', boxShadow: '0 0 6px var(--up)' }} />
                                )}
                              </div>
                            );
                          })()}
                          <div>
                            <div className="user-email-text">{item.email}</div>
                            <div className="user-id-text">{item.id.substring(0, 12)}...</div>
                          </div>
                        </div>
                      </td>
                      <td>
                        <span className="user-date-text">{date}</span>
                      </td>
                      <td>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'flex-start' }}>
                          <span className={getBadgeClass(item.computedStatus)}>
                            {item.computedStatus}
                          </span>
                          {expLabel && (
                            <span style={{ fontSize: 10, color: 'var(--text-3)', fontFamily: 'var(--font-mono)' }}>
                              {expLabel}
                            </span>
                          )}
                        </div>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 6 }}>
                          <button 
                            onClick={() => handleGrantAccess(item.id, 'monthly')}
                            className="beast-btn sm"
                            style={{ borderColor: 'rgba(0, 212, 255, 0.3)', color: 'var(--cyan)' }}
                            title="Grant 1 Month Access"
                          >
                            + 1M
                          </button>
                          <button 
                            onClick={() => handleGrantAccess(item.id, 'yearly')}
                            className="beast-btn sm"
                            style={{ borderColor: 'rgba(168, 85, 247, 0.3)', color: 'var(--purple)' }}
                            title="Grant 1 Year Access"
                          >
                            + 1Y
                          </button>
                          <button 
                            onClick={() => handleRevoke(item.id)}
                            className="beast-btn danger sm"
                            title="Revoke User Access"
                          >
                            Revoke
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={5} style={{ padding: '40px', textAlign: 'center', color: 'var(--text-3)' }}>
                    No users found matching your search criteria.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

