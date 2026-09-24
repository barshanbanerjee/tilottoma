"use client";

import React, { useEffect, useState } from 'react';
import { ShieldCheck, UserCheck, User, ShieldAlert, Sparkles, CheckCircle2, XCircle, Search, Mail, AlertCircle, UserPlus, Trash2, X, Lock } from 'lucide-react';

interface UserItem {
  id: string;
  name: string;
  email: string;
  role: 'USER' | 'CONTRIBUTOR' | 'MODERATOR' | 'ADMIN';
  contributorRequestStatus: 'NONE' | 'REQUESTED' | 'APPROVED' | 'REJECTED';
  contributorBio?: string | null;
  createdAt: string;
}

export default function UsersRbacTab() {
  const [users, setUsers] = useState<UserItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  // User Creation Modal State
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [createForm, setCreateForm] = useState({
    name: '',
    email: '',
    password: '',
    role: 'USER' as 'USER' | 'CONTRIBUTOR' | 'MODERATOR' | 'ADMIN',
  });
  const [createLoading, setCreateLoading] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/users', { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        setUsers(data);
      }
    } catch (e) {
      console.error('Failed to load users:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError(null);
    setCreateLoading(true);

    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(createForm),
      });

      const data = await res.json();
      if (!res.ok) {
        setCreateError(data.error || 'Failed to create user');
        return;
      }

      setUsers((prev) => [data, ...prev]);
      setIsCreateModalOpen(false);
      setCreateForm({ name: '', email: '', password: '', role: 'USER' });
    } catch (err: any) {
      setCreateError(err.message || 'Network error');
    } finally {
      setCreateLoading(false);
    }
  };

  const handleDeleteUser = async (user: UserItem) => {
    if (!confirm(`Are you sure you want to permanently delete user "${user.name}" (${user.email})? This action cannot be undone.`)) {
      return;
    }

    setActionLoadingId(user.id);
    try {
      const res = await fetch(`/api/admin/users/${user.id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || 'Failed to delete user');
        return;
      }
      setUsers((prev) => prev.filter((u) => u.id !== user.id));
    } catch (err) {
      console.error('Delete error:', err);
      alert('Error deleting user');
    } finally {
      setActionLoadingId(null);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleRoleChange = async (userId: string, newRole: string) => {
    setActionLoadingId(userId);
    try {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: newRole }),
      });
      if (res.ok) {
        const updated = await res.json();
        setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, role: updated.role } : u)));
      }
    } catch (e) {
      console.error('Role update error:', e);
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleContributorRequestDecision = async (userId: string, decision: 'APPROVED' | 'REJECTED') => {
    setActionLoadingId(userId);
    try {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contributorRequestStatus: decision,
          role: decision === 'APPROVED' ? 'CONTRIBUTOR' : undefined,
        }),
      });
      if (res.ok) {
        const updated = await res.json();
        setUsers((prev) =>
          prev.map((u) =>
            u.id === userId
              ? { ...u, role: updated.role, contributorRequestStatus: updated.contributorRequestStatus }
              : u
          )
        );
      }
    } catch (e) {
      console.error('Application decision error:', e);
    } finally {
      setActionLoadingId(null);
    }
  };

  const pendingApplications = users.filter((u) => u.contributorRequestStatus === 'REQUESTED');
  const filteredUsers = users.filter(
    (u) =>
      u.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* RBAC Role Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="p-4 rounded-2xl bg-white border border-zinc-200">
          <div className="flex items-center gap-2 text-zinc-600 text-xs font-bold uppercase tracking-wider">
            <User className="w-4 h-4 text-zinc-500" />
            <span>Readers (User)</span>
          </div>
          <div className="text-2xl font-bold font-mono text-zinc-900 mt-2">
            {users.filter((u) => u.role === 'USER').length}
          </div>
          <p className="text-[11px] text-zinc-400 mt-1">Can browse map & apply to contribute</p>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-zinc-200">
          <div className="flex items-center gap-2 text-emerald-800 text-xs font-bold uppercase tracking-wider">
            <UserCheck className="w-4 h-4 text-emerald-600" />
            <span>Contributors</span>
          </div>
          <div className="text-2xl font-bold font-mono text-zinc-900 mt-2">
            {users.filter((u) => u.role === 'CONTRIBUTOR').length}
          </div>
          <p className="text-[11px] text-zinc-400 mt-1">Verified community researchers</p>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-zinc-200">
          <div className="flex items-center gap-2 text-blue-800 text-xs font-bold uppercase tracking-wider">
            <ShieldCheck className="w-4 h-4 text-blue-600" />
            <span>Moderators</span>
          </div>
          <div className="text-2xl font-bold font-mono text-zinc-900 mt-2">
            {users.filter((u) => u.role === 'MODERATOR').length}
          </div>
          <p className="text-[11px] text-zinc-400 mt-1">Can verify & approve contributions</p>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-zinc-200">
          <div className="flex items-center gap-2 text-purple-800 text-xs font-bold uppercase tracking-wider">
            <ShieldAlert className="w-4 h-4 text-purple-600" />
            <span>Administrators</span>
          </div>
          <div className="text-2xl font-bold font-mono text-zinc-900 mt-2">
            {users.filter((u) => u.role === 'ADMIN').length}
          </div>
          <p className="text-[11px] text-zinc-400 mt-1">Super role: manage roles & platform</p>
        </div>
      </div>

      {/* SECTION 1: Pending Contributor Applications */}
      <div className="bg-white rounded-2xl border border-zinc-200 overflow-hidden shadow-xs">
        <div className="p-4 border-b border-zinc-200 bg-amber-50/50 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-amber-600" />
            <h3 className="font-serif font-bold text-sm text-zinc-900">
              Pending Contributor Applications ({pendingApplications.length})
            </h3>
          </div>
          <span className="text-xs text-zinc-500">
            Review applicant research interest and verify accounts
          </span>
        </div>

        {pendingApplications.length > 0 ? (
          <div className="divide-y divide-zinc-100">
            {pendingApplications.map((applicant) => (
              <div key={applicant.id} className="p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div className="space-y-1.5 flex-1 max-w-2xl">
                  <div className="flex items-center gap-2">
                    <h4 className="font-semibold text-sm text-zinc-900">{applicant.name}</h4>
                    <span className="text-xs text-zinc-400 font-mono">({applicant.email})</span>
                  </div>

                  {applicant.contributorBio ? (
                    <div className="p-3 rounded-xl bg-zinc-50 border border-zinc-200 text-xs text-zinc-700 leading-relaxed">
                      <strong className="block text-[10px] uppercase tracking-wider text-zinc-400 mb-0.5">
                        Applicant Statement:
                      </strong>
                      {applicant.contributorBio}
                    </div>
                  ) : (
                    <p className="text-xs text-zinc-400 italic">No statement provided.</p>
                  )}
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => handleContributorRequestDecision(applicant.id, 'APPROVED')}
                    disabled={actionLoadingId === applicant.id}
                    className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-xs cursor-pointer"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Accept as Contributor
                  </button>

                  <button
                    onClick={() => handleContributorRequestDecision(applicant.id, 'REJECTED')}
                    disabled={actionLoadingId === applicant.id}
                    className="px-3 py-2 bg-zinc-100 hover:bg-red-50 text-red-700 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <XCircle className="w-3.5 h-3.5" />
                    Decline
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-8 text-center text-zinc-400 text-xs">
            No pending contributor applications at this time.
          </div>
        )}
      </div>

      {/* SECTION 2: All Users Directory & Role Management */}
      <div className="bg-white rounded-2xl border border-zinc-200 overflow-hidden shadow-xs">
        <div className="p-4 border-b border-zinc-200 bg-zinc-50 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <h3 className="font-serif font-bold text-sm text-zinc-900">
              Registered Users & Role Assignment ({users.length})
            </h3>
            <button
              onClick={() => setIsCreateModalOpen(true)}
              className="px-3 py-1.5 bg-zinc-900 hover:bg-zinc-800 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-xs cursor-pointer"
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>Create User</span>
            </button>
          </div>

          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by name or email..."
              className="w-full pl-9 pr-3 py-1.5 rounded-xl border border-zinc-200 text-xs text-zinc-900 focus:outline-none focus:ring-2 focus:ring-amber-500 bg-white"
            />
          </div>
        </div>

        {loading ? (
          <div className="py-20 text-center text-zinc-500 text-xs">Loading user registry...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-zinc-50 text-zinc-500 font-bold uppercase tracking-wider text-[10px] border-b border-zinc-100">
                <tr>
                  <th className="py-3 px-4">User</th>
                  <th className="py-3 px-4">Email</th>
                  <th className="py-3 px-4">Current Role</th>
                  <th className="py-3 px-4">Contributor Status</th>
                  <th className="py-3 px-4">Role Assignment</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {filteredUsers.map((u) => (
                  <tr key={u.id} className="hover:bg-zinc-50/70 transition-colors">
                    <td className="py-3.5 px-4 font-semibold text-zinc-900">{u.name}</td>
                    <td className="py-3.5 px-4 text-zinc-500 font-mono">{u.email}</td>
                    <td className="py-3.5 px-4">
                      <span
                        className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                          u.role === 'ADMIN'
                            ? 'bg-purple-100 text-purple-800'
                            : u.role === 'MODERATOR'
                            ? 'bg-blue-100 text-blue-800'
                            : u.role === 'CONTRIBUTOR'
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-zinc-100 text-zinc-600'
                        }`}
                      >
                        {u.role}
                      </span>
                    </td>
                    <td className="py-3.5 px-4">
                      <span
                        className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                          u.contributorRequestStatus === 'APPROVED'
                            ? 'bg-emerald-50 text-emerald-700'
                            : u.contributorRequestStatus === 'REQUESTED'
                            ? 'bg-amber-100 text-amber-800 font-bold'
                            : u.contributorRequestStatus === 'REJECTED'
                            ? 'bg-red-50 text-red-700'
                            : 'text-zinc-400'
                        }`}
                      >
                        {u.contributorRequestStatus}
                      </span>
                    </td>
                    <td className="py-3.5 px-4">
                      <select
                        value={u.role}
                        onChange={(e) => handleRoleChange(u.id, e.target.value)}
                        disabled={actionLoadingId === u.id}
                        className="px-2.5 py-1 text-xs font-semibold rounded-lg border border-zinc-200 bg-white text-zinc-800 focus:outline-none focus:ring-2 focus:ring-amber-500 cursor-pointer"
                      >
                        <option value="USER">User (Reader)</option>
                        <option value="CONTRIBUTOR">Contributor (Verified)</option>
                        <option value="MODERATOR">Moderator</option>
                        <option value="ADMIN">Admin (Super User)</option>
                      </select>
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <button
                        onClick={() => handleDeleteUser(u)}
                        disabled={actionLoadingId === u.id}
                        className="p-1.5 text-zinc-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                        title="Delete user account"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* CREATE USER MODAL */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="bg-white rounded-2xl border border-zinc-200 shadow-2xl max-w-md w-full overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="p-5 border-b border-zinc-100 flex items-center justify-between bg-zinc-50">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-zinc-900 text-white flex items-center justify-center">
                  <UserPlus className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-serif font-bold text-sm text-zinc-900">Create New Account</h3>
                  <p className="text-[11px] text-zinc-500">Add a user with designated system permissions</p>
                </div>
              </div>
              <button
                onClick={() => setIsCreateModalOpen(false)}
                className="p-1.5 text-zinc-400 hover:text-zinc-700 rounded-lg hover:bg-zinc-200 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateUser} className="p-5 space-y-4">
              {createError && (
                <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 text-red-500" />
                  <span>{createError}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-zinc-700 mb-1">
                  Full Name
                </label>
                <input
                  type="text"
                  required
                  value={createForm.name}
                  onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
                  placeholder="e.g. Radhakanta Deb"
                  className="w-full px-3.5 py-2 border border-zinc-200 rounded-xl text-xs text-zinc-900 focus:outline-none focus:ring-2 focus:ring-amber-500 bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-zinc-700 mb-1">
                  Email Address
                </label>
                <input
                  type="email"
                  required
                  value={createForm.email}
                  onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })}
                  placeholder="name@heritage.org"
                  className="w-full px-3.5 py-2 border border-zinc-200 rounded-xl text-xs text-zinc-900 focus:outline-none focus:ring-2 focus:ring-amber-500 bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-zinc-700 mb-1">
                  Password
                </label>
                <div className="relative">
                  <input
                    type="password"
                    required
                    minLength={6}
                    value={createForm.password}
                    onChange={(e) => setCreateForm({ ...createForm, password: e.target.value })}
                    placeholder="Minimum 6 characters"
                    className="w-full px-3.5 py-2 border border-zinc-200 rounded-xl text-xs text-zinc-900 focus:outline-none focus:ring-2 focus:ring-amber-500 bg-white"
                  />
                  <Lock className="w-3.5 h-3.5 text-zinc-400 absolute right-3 top-2.5" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-zinc-700 mb-1">
                  Platform Role & Clearance
                </label>
                <select
                  value={createForm.role}
                  onChange={(e) => setCreateForm({ ...createForm, role: e.target.value as any })}
                  className="w-full px-3 py-2 border border-zinc-200 rounded-xl text-xs font-semibold text-zinc-800 focus:outline-none focus:ring-2 focus:ring-amber-500 bg-white cursor-pointer"
                >
                  <option value="USER">User (Reader - Browse public map)</option>
                  <option value="CONTRIBUTOR">Contributor (Verified researcher)</option>
                  <option value="MODERATOR">Moderator (Review & verify records)</option>
                  <option value="ADMIN">Administrator (Full root privileges)</option>
                </select>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2 border-t border-zinc-100">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-zinc-600 hover:bg-zinc-100 rounded-xl transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createLoading}
                  className="px-4 py-2 bg-zinc-900 hover:bg-zinc-800 disabled:opacity-50 text-white text-xs font-semibold rounded-xl transition-colors shadow-xs cursor-pointer flex items-center gap-1.5"
                >
                  {createLoading ? 'Creating...' : 'Create Account'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

