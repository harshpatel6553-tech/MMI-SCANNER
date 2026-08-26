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
  const [onlineUsers, setOnlineUsers] = useState<{ email: string; connectedAt: string }[]>([]);
  const { socket } = useSocketContext();
  
  const [filters, setFilters] = useState<FilterState>({ email: '', status: 'all' });
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  useEffect(() => { fetchUsers(); }, []);

  useEffect(() => {
    if (!socket) return;
    socket.emit('admin:request-online-users');
    socket.on('admin:online-users', (users: { email: string; connectedAt: string }[]) => {
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

  const getBadgeStyle = (status: string) => {
    switch(status) {
      case 'Lifetime': return 'border-none bg-purple-600/10 text-purple-600';
      case 'Monthly': 
      case 'Yearly': 
      case '3 Years': return 'border-none bg-blue-600/10 text-blue-600';
      case 'Trialing': return 'border-none bg-green-600/10 text-green-600';
      case 'Expired': return 'border-none bg-red-600/10 text-red-600';
      default: return 'border-none bg-gray-600/10 text-gray-600';
    }
  };

  if (!profile?.is_admin) {
    return (
      <div className="admin-container">
        <div className="glass-card" style={{ padding: '2rem', textAlign: 'center' }}>
          <h2>Access Denied</h2>
          <button className="signout-btn" onClick={() => navigate('/')}>Go Back</button>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-container pb-20">
      <div className="admin-header">
        <h2>Admin Dashboard</h2>
        <div className="admin-actions">
          <button className="signout-btn" onClick={() => navigate('/')}>Back to Scanner</button>
          <button className="signout-btn" onClick={signOut}>Sign Out</button>
        </div>
      </div>

      <div className="admin-card glass-card mb-8">
        <div className="flex justify-between items-center mb-4">
          <h3 className="flex items-center gap-2 m-0 text-lg font-semibold">
            <span className="inline-block w-2.5 h-2.5 rounded-full bg-green-400 shadow-[0_0_8px_#4ade80] animate-pulse"></span>
            Live Users — {onlineUsers.length} Online
          </h3>
          <button 
            className="px-4 py-1.5 rounded-md text-sm font-medium border transition-colors bg-red-500/15 border-red-500/40 text-red-500 hover:bg-red-500/20"
            onClick={handleForceRefresh}
          >
            ? Force Refresh All Users
          </button>
        </div>
        {onlineUsers.length === 0 ? (
          <p className="text-gray-400 py-4">No users currently online</p>
        ) : (
          <div className="flex flex-wrap gap-2 mt-4">
            {onlineUsers.map((u, i) => (
              <div key={i} className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-green-400/10 border border-green-400/20 text-sm text-green-400">
                <span className="w-2 h-2 rounded-full bg-green-400 shrink-0"></span>
                <span className="text-gray-200">{u.email}</span>
                <span className="text-xs text-gray-500">since {new Date(u.connectedAt).toLocaleTimeString()}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="overflow-hidden rounded-xl border border-white/10 shadow-sm mb-12" style={{ background: '#0b0b0d' }}>
        <div className="grid gap-4 border-b border-dashed border-white/10 px-4 py-5 md:grid-cols-2 lg:grid-cols-4">
          
          <div className="space-y-2">
            <label htmlFor="email-filter" className="text-sm font-medium text-gray-300">Email Address</label>
            <div className="relative">
              <input
                id="email-filter"
                className="flex h-10 w-full rounded-md border border-white/10 bg-transparent px-3 py-2 text-sm placeholder:text-gray-500 focus:outline-none focus:ring-1 focus:ring-sky-500 pl-9"
                value={filters.email}
                onChange={(e) => updateFilter('email', e.target.value)}
                placeholder="Search user email"
                type="text"
              />
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-gray-500">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <label htmlFor="status-filter" className="text-sm font-medium text-gray-300">Subscription Status</label>
            <select
              id="status-filter"
              className="flex h-10 w-full rounded-md border border-white/10 bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-sky-500 appearance-none"
              style={{ backgroundColor: '#131316', color: '#fff' }}
              value={filters.status}
              onChange={(e) => updateFilter('status', e.target.value)}
            >
              <option value="all">All Statuses</option>
              <option value="trialing">Trialing</option>
              <option value="monthly">Monthly</option>
              <option value="yearly">Yearly</option>
              <option value="lifetime">Lifetime</option>
              <option value="expired">Expired</option>
            </select>
          </div>
          
          <div className="space-y-2 flex flex-col justify-end lg:col-span-2">
             {selectedIdSet.size > 0 && (
                <div className="flex gap-4 items-center justify-end">
                   <span className="text-sm text-gray-400">{selectedIdSet.size} selected</span>
                   <button 
                     onClick={handleBulkRevoke}
                     className="h-10 px-4 rounded-md bg-red-500/10 text-red-500 border border-red-500/20 text-sm hover:bg-red-500/20"
                   >
                     Bulk Revoke
                   </button>
                </div>
             )}
          </div>
          
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap [&_td]:align-middle">
            <thead>
              <tr className="border-b border-dashed border-white/10 hover:bg-white/5">
                <th className="h-12 w-12 px-4 font-medium text-gray-400">
                  <input 
                    type="checkbox" 
                    checked={allSelected} 
                    ref={input => { if (input) input.indeterminate = someSelected; }}
                    onChange={(e) => toggleAll(e.target.checked)}
                    className="rounded border-white/20 bg-transparent accent-sky-500" 
                  />
                </th>
                <th className="h-12 px-4 text-[11px] font-medium uppercase tracking-[0.14em] text-gray-500">User Email</th>
                <th className="h-12 px-4 text-[11px] font-medium uppercase tracking-[0.14em] text-gray-500">Signed Up</th>
                <th className="h-12 px-4 text-[11px] font-medium uppercase tracking-[0.14em] text-gray-500">Status</th>
                <th className="h-12 px-4 text-[11px] font-medium uppercase tracking-[0.14em] text-gray-500 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredItems.length > 0 ? (
                filteredItems.map((item) => {
                  const isSelected = selectedIdSet.has(item.id);
                  const date = new Date(item.trial_start_date).toLocaleDateString();

                  return (
                    <tr 
                      key={item.id} 
                      className={`border-b border-white/5 transition-colors hover:bg-white/5 ${isSelected ? 'bg-sky-500/10' : ''}`}
                    >
                      <td className="py-3 px-4">
                        <input 
                          type="checkbox" 
                          checked={isSelected} 
                          onChange={(e) => toggleRow(item.id, e.target.checked)}
                          className="rounded border-white/20 bg-transparent accent-sky-500" 
                        />
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-medium text-gray-200">{item.email}</div>
                        <div className="text-xs text-gray-500">{item.id.substring(0,8)}...</div>
                      </td>
                      <td className="py-3 px-4 text-gray-400">{date}</td>
                      <td className="py-3 px-4">
                        <div className="flex flex-col gap-1 items-start">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${getBadgeStyle(item.computedStatus)}`}>
                            {item.computedStatus}
                          </span>
                          
                          {(item.computedStatus === 'Monthly' || item.computedStatus === 'Yearly' || item.computedStatus === '3 Years') && item.subscription_status && (
                            <span className="text-[10px] text-gray-500">
                              Exp: {new Date(item.subscription_status.split(':')[1]).toLocaleDateString()}
                            </span>
                          )}
                          
                          {item.computedStatus === 'Trialing' && (
                            <span className="text-[10px] text-sky-400">
                              Exp: {new Date(new Date(item.trial_start_date).getTime() + 14 * 24 * 60 * 60 * 1000).toLocaleDateString()} ({item.trialDaysLeft} days)
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button 
                            onClick={() => handleGrantAccess(item.id, 'monthly')}
                            className="px-2 py-1 text-xs rounded bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 transition-colors border border-blue-500/20"
                          >
                            + 1M
                          </button>
                          <button 
                            onClick={() => handleGrantAccess(item.id, 'yearly')}
                            className="px-2 py-1 text-xs rounded bg-purple-500/10 text-purple-400 hover:bg-purple-500/20 transition-colors border border-purple-500/20"
                          >
                            + 1Y
                          </button>
                          <button 
                            onClick={() => handleRevoke(item.id)}
                            className="px-2 py-1 text-xs rounded bg-red-500/10 text-red-500 hover:bg-red-500/20 transition-colors border border-red-500/20"
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
                  <td colSpan={5} className="py-12 text-center text-gray-500">
                    No users found matching your filters.
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
