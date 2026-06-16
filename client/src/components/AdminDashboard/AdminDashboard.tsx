import { useEffect, useState } from 'react';
import { supabase } from '../../supabaseClient';
import { useAuth } from '../../context/AuthContext';
import './AdminDashboard.css';

interface Profile {
  id: string;
  email: string;
  trial_start_date: string;
  subscription_status: string;
}

export function AdminDashboard() {
  const { profile, signOut } = useAuth();
  const [users, setUsers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchUsers();
  }, []);

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

  const handleApprove = async (userId: string) => {
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ subscription_status: 'active' })
        .eq('id', userId);

      if (error) throw error;
      
      // Update local state
      setUsers(users.map(u => 
        u.id === userId ? { ...u, subscription_status: 'active' } : u
      ));
    } catch (err) {
      console.error('Error approving user:', err);
      alert('Failed to approve user');
    }
  };

  const handleRevoke = async (userId: string) => {
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

  if (!profile?.is_admin) {
    return (
      <div className="admin-container">
        <div className="glass-card" style={{ padding: '2rem', textAlign: 'center' }}>
          <h2>Access Denied</h2>
          <p>You must be an administrator to view this page.</p>
          <button className="signout-btn" onClick={() => window.location.href = '/'}>Go Back</button>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-container">
      <div className="admin-header">
        <h2>Admin Dashboard</h2>
        <div className="admin-actions">
          <button className="signout-btn" onClick={() => window.location.href = '/'}>Back to Scanner</button>
          <button className="signout-btn" onClick={signOut}>Sign Out</button>
        </div>
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
                  return (
                    <tr key={u.id}>
                      <td>{u.email}</td>
                      <td>{date}</td>
                      <td>
                        <span className={`status-badge ${u.subscription_status}`}>
                          {u.subscription_status}
                        </span>
                      </td>
                      <td>
                        {u.subscription_status !== 'active' ? (
                          <button 
                            className="action-btn approve"
                            onClick={() => handleApprove(u.id)}
                          >
                            Activate Lifetime
                          </button>
                        ) : (
                          <button 
                            className="action-btn revoke"
                            onClick={() => handleRevoke(u.id)}
                          >
                            Revoke
                          </button>
                        )}
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
