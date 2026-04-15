import { useState, useMemo, useEffect } from 'react';
import { Users, UserPlus, Copy, CheckCircle, AlertCircle } from 'lucide-react';
import useAppStore from '../store/appStore';
import { updateUserRole, updateUserStudies, createUserAccount, loadProfiles } from '../services/dataService';

const ROLES = ['admin', 'coordinator', 'provider'];

export default function UserManagement() {
  const profiles = useAppStore(s => s.profiles);
  const studies  = useAppStore(s => s.studies);

  // Fetch profiles on mount in case the initial load returned empty
  useEffect(() => { loadProfiles(); }, []);
  const user     = useAppStore(s => s.user);

  const [showInvite, setShowInvite]     = useState(false);
  const [inviteEmail, setInviteEmail]   = useState('');
  const [inviteName, setInviteName]     = useState('');
  const [invitePass, setInvitePass]     = useState('');
  const [inviting, setInviting]         = useState(false);
  const [inviteResult, setInviteResult] = useState(null);
  const [inviteError, setInviteError]   = useState(null);
  const [copied, setCopied]             = useState('');
  const [error, setError]               = useState(null);

  const studyList = useMemo(
    () => Object.values(studies).sort((a, b) => a.id.localeCompare(b.id)),
    [studies]
  );

  const handleRoleChange = async (profileId, role) => {
    if (profileId === user?.id) return; // can't change own role
    setError(null);
    try {
      await updateUserRole(profileId, role);
    } catch (e) {
      setError(e.message);
    }
  };

  const handleStudyToggle = async (profile, studyId) => {
    setError(null);
    const current = profile.assigned_studies ?? [];
    const next = current.includes(studyId)
      ? current.filter(s => s !== studyId)
      : [...current, studyId];
    try {
      await updateUserStudies(profile.id, next);
    } catch (e) {
      setError(e.message);
    }
  };

  const handleInvite = async (e) => {
    e.preventDefault();
    if (invitePass.length < 6) {
      setInviteError('Password must be at least 6 characters.');
      return;
    }
    setInviting(true);
    setInviteError(null);
    setInviteResult(null);
    try {
      const result = await createUserAccount(inviteEmail, inviteName, invitePass);
      setInviteResult(result);
      setInviteEmail('');
      setInviteName('');
      setInvitePass('');
    } catch (err) {
      setInviteError(err.message);
    }
    setInviting(false);
  };

  const copyValue = async (value, key) => {
    if (!value) return;
    await navigator.clipboard.writeText(value);
    setCopied(key);
    setTimeout(() => setCopied(''), 2000);
  };

  const copyBoth = async () => {
    if (!inviteResult) return;
    const text = `Email: ${inviteResult.email}\nTemporary Password: ${inviteResult.password}`;
    await navigator.clipboard.writeText(text);
    setCopied('both');
    setTimeout(() => setCopied(''), 2000);
  };

  return (
    <div className="p-4 md:p-8 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">User Management</h1>
          <p className="text-gray-500 text-sm mt-1">{profiles.length} user{profiles.length !== 1 ? 's' : ''} registered</p>
        </div>
        <button
          onClick={() => { setShowInvite(true); setInviteResult(null); setInviteError(null); }}
          className="flex items-center gap-2 px-4 py-2 bg-teal-700 text-white rounded-xl text-sm font-semibold hover:bg-teal-800 transition-colors"
        >
          <UserPlus size={15} /> Create User
        </button>
      </div>

      {error && (
        <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          <AlertCircle size={15} className="shrink-0 mt-0.5" />
          {error}
        </div>
      )}

      {/* Users table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide">Name</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide">Email</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide">Role</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide">Assigned Studies</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide">Created</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {profiles.map(profile => {
                const isMe = profile.id === user?.id;
                return (
                  <tr key={profile.id} className={isMe ? 'bg-teal-50' : 'hover:bg-gray-50'}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-gray-900">{profile.name || '—'}</span>
                        {isMe && (
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-teal-100 text-teal-700">You</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-600 font-mono text-xs">{profile.email || '—'}</td>
                    <td className="px-4 py-3">
                      {isMe ? (
                        <span className="inline-block px-2 py-1 rounded-lg bg-gray-100 text-gray-700 text-xs font-medium capitalize">
                          {profile.role || 'none'}
                        </span>
                      ) : (
                        <select
                          value={profile.role || 'provider'}
                          onChange={e => handleRoleChange(profile.id, e.target.value)}
                          className="border border-gray-300 rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-teal-500"
                        >
                          {ROLES.map(r => (
                            <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>
                          ))}
                        </select>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {studyList.map(study => {
                          const assigned = (profile.assigned_studies ?? []).includes(study.id);
                          return (
                            <button
                              key={study.id}
                              onClick={() => handleStudyToggle(profile, study.id)}
                              className={`px-2 py-0.5 rounded-full text-[10px] font-medium transition-colors ${
                                assigned
                                  ? 'bg-teal-100 text-teal-800 hover:bg-teal-200'
                                  : 'bg-gray-100 text-gray-400 hover:bg-gray-200 hover:text-gray-600'
                              }`}
                            >
                              {study.shortName || study.id}
                            </button>
                          );
                        })}
                        {studyList.length === 0 && <span className="text-xs text-gray-400">No studies</span>}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap">
                      {profile.created_at ? new Date(profile.created_at).toLocaleDateString() : '—'}
                    </td>
                  </tr>
                );
              })}
              {profiles.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center text-gray-400">
                    <Users size={32} className="mx-auto mb-2 opacity-50" />
                    No users found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create account modal */}
      {showInvite && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6 space-y-4">
            <h2 className="text-lg font-bold text-gray-900">Create User Account</h2>

            {inviteResult ? (
              <div className="space-y-4">
                <div className="flex items-start gap-2 p-3 bg-teal-50 border border-teal-200 rounded-lg text-sm text-teal-800">
                  <CheckCircle size={15} className="shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold">Account created.</p>
                    <p className="text-xs mt-0.5">Share these credentials with the user directly — no email will be sent.</p>
                  </div>
                </div>
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Email</p>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 px-3 py-2 bg-gray-100 rounded-lg text-sm font-mono select-all break-all">
                      {inviteResult.email}
                    </code>
                    <button
                      type="button"
                      onClick={() => copyValue(inviteResult.email, 'email')}
                      className="p-2 rounded-lg hover:bg-gray-100 text-gray-500"
                    >
                      {copied === 'email' ? <CheckCircle size={16} className="text-teal-600" /> : <Copy size={16} />}
                    </button>
                  </div>
                </div>
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Temporary Password</p>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 px-3 py-2 bg-gray-100 rounded-lg text-sm font-mono select-all break-all">
                      {inviteResult.password}
                    </code>
                    <button
                      type="button"
                      onClick={() => copyValue(inviteResult.password, 'password')}
                      className="p-2 rounded-lg hover:bg-gray-100 text-gray-500"
                    >
                      {copied === 'password' ? <CheckCircle size={16} className="text-teal-600" /> : <Copy size={16} />}
                    </button>
                  </div>
                  <p className="text-xs text-gray-400 mt-1">The user should change it on first login.</p>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={copyBoth}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
                  >
                    {copied === 'both' ? <><CheckCircle size={14} className="text-teal-600" /> Copied</> : <><Copy size={14} /> Copy Both</>}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowInvite(false)}
                    className="flex-1 px-4 py-2 bg-teal-700 text-white rounded-lg text-sm font-semibold hover:bg-teal-800 transition-colors"
                  >
                    Done
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleInvite} className="space-y-3">
                {inviteError && (
                  <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                    <AlertCircle size={15} className="shrink-0 mt-0.5" />
                    {inviteError}
                  </div>
                )}
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Name</label>
                  <input
                    type="text"
                    value={inviteName}
                    onChange={e => setInviteName(e.target.value)}
                    placeholder="Dr. Jane Smith"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Email</label>
                  <input
                    type="email"
                    required
                    value={inviteEmail}
                    onChange={e => setInviteEmail(e.target.value)}
                    placeholder="user@example.com"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Temporary Password</label>
                  <input
                    type="text"
                    required
                    value={invitePass}
                    onChange={e => setInvitePass(e.target.value)}
                    placeholder="Min 6 characters"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-teal-500"
                  />
                  <p className="text-xs text-gray-400 mt-1">You'll share this with the user yourself.</p>
                </div>
                <div className="flex gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowInvite(false)}
                    className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={inviting || !inviteEmail || !invitePass}
                    className="flex-1 px-4 py-2 bg-teal-700 text-white rounded-lg text-sm font-semibold hover:bg-teal-800 disabled:opacity-50 transition-colors"
                  >
                    {inviting ? 'Creating…' : 'Create Account'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
