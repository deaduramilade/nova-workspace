'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import axios from 'axios';
import toast, { Toaster } from 'react-hot-toast';
import PageNav from '../../components/PageNav';
import { apiUrl, authHeaders } from '../../lib/api';

interface Profile {
  id: number;
  username: string;
  email: string;
  role: string;
  display_name?: string | null;
  bio?: string | null;
  avatar_url?: string | null;
  linked_accounts?: Record<string, any> | null;
  created_at?: string;
}

const SOCIAL_PROVIDERS = [
  { key: 'google', label: 'Google', icon: '🔵' },
  { key: 'github', label: 'GitHub', icon: '🐙' },
  { key: 'discord', label: 'Discord', icon: '💬' },
];

export default function ProfileSettingsPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  // Local form state
  const [displayName, setDisplayName] = useState('');
  const [bio, setBio] = useState('');
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const token = typeof window !== 'undefined' ? localStorage.getItem('access_token') : null;

  // Fetch current profile
  useEffect(() => {
    if (!token) {
      router.push('/login');
      return;
    }

    const fetchProfile = async () => {
      try {
        const res = await axios.get(apiUrl('/users/me'), { headers: authHeaders() });
        const p: Profile = res.data;
        setProfile(p);
        setDisplayName(p.display_name || p.username || '');
        setBio(p.bio || '');
        if (p.avatar_url) {
          setAvatarPreview(apiUrl(p.avatar_url));
        }
      } catch (e: any) {
        toast.error(e?.response?.data?.detail || 'Failed to load profile');
        if (e?.response?.status === 401) {
          localStorage.removeItem('access_token');
          localStorage.removeItem('nova_user');
          router.push('/login');
        }
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, [token, router]);

  const handleAvatarSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Avatar must be smaller than 5MB');
      return;
    }

    setSelectedFile(file);
    const reader = new FileReader();
    reader.onload = (ev) => setAvatarPreview(ev.target?.result as string);
    reader.readAsDataURL(file);
  };

  const uploadAvatar = async () => {
    if (!selectedFile) return;

    setUploadingAvatar(true);
    try {
      const form = new FormData();
      form.append('file', selectedFile);

      const res = await axios.post(apiUrl('/users/me/avatar'), form, {
        headers: { ...authHeaders(), 'Content-Type': 'multipart/form-data' },
      });

      const newUrl = res.data.avatar_url;
      const fullUrl = apiUrl(newUrl);

      setProfile((prev) => (prev ? { ...prev, avatar_url: newUrl } : prev));
      setAvatarPreview(fullUrl);
      setSelectedFile(null);

      // Sync a bit of user data to localStorage for other parts of the app
      const currentUser = localStorage.getItem('nova_user');
      if (currentUser) {
        try {
          const parsed = JSON.parse(currentUser);
          localStorage.setItem('nova_user', JSON.stringify({ ...parsed, avatar_url: newUrl }));
        } catch {}
      }

      toast.success('Profile picture updated!');
    } catch (e: any) {
      toast.error(e?.response?.data?.detail || 'Avatar upload failed');
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleSaveProfile = async () => {
    setSaving(true);
    try {
      const payload: any = {};
      if (displayName.trim()) payload.display_name = displayName.trim();
      payload.bio = bio.trim() || null; // allow clearing bio

      const res = await axios.put(apiUrl('/users/me'), payload, {
        headers: authHeaders(),
      });

      const updated = res.data as Profile;
      setProfile(updated);

      // Update localStorage so chat/presence pick up display_name immediately
      const current = localStorage.getItem('nova_user');
      if (current) {
        try {
          const parsed = JSON.parse(current);
          localStorage.setItem(
            'nova_user',
            JSON.stringify({
              ...parsed,
              display_name: updated.display_name || parsed.username,
              avatar_url: updated.avatar_url || parsed.avatar_url,
            })
          );
        } catch {}
      }

      toast.success('Profile updated');
    } catch (e: any) {
      toast.error(e?.response?.data?.detail || 'Failed to save profile');
    } finally {
      setSaving(false);
    }
  };

  const linkSocial = async (provider: string) => {
    const externalId = prompt(
      `Enter your ${provider} account identifier (email, username, or ID) for demo linking:`,
      `${provider}-demo-user`
    );
    if (!externalId) return;

    try {
      await axios.post(
        apiUrl('/users/me/link-social'),
        {
          provider,
          external_id: externalId.trim(),
          metadata: { demo: true },
        },
        { headers: authHeaders() }
      );

      // Refresh profile
      const res = await axios.get(apiUrl('/users/me'), { headers: authHeaders() });
      setProfile(res.data);
      toast.success(`Linked ${provider}`);
    } catch (e: any) {
      toast.error(e?.response?.data?.detail || 'Failed to link account');
    }
  };

  const unlinkSocial = async (provider: string) => {
    if (!confirm(`Unlink ${provider}?`)) return;

    try {
      await axios.delete(apiUrl('/users/me/unlink-social'), {
        headers: authHeaders(),
        data: { provider },
      });
      const res = await axios.get(apiUrl('/users/me'), { headers: authHeaders() });
      setProfile(res.data);
      toast.success(`Unlinked ${provider}`);
    } catch (e: any) {
      toast.error(e?.response?.data?.detail || 'Failed to unlink');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="nova-spinner" />
      </div>
    );
  }

  const linked = profile?.linked_accounts || {};

  return (
    <div className="min-h-screen text-readable">
      <Toaster position="top-center" />
      <PageNav
        title="Profile & Settings"
        subtitle="Manage your personal information, avatar, and connected accounts"
        backLabel="← Back to Dashboard"
        backHref="/"
      />

      <div className="max-w-3xl mx-auto px-6 pt-20 pb-16 space-y-10">
        {/* Avatar + Basic Info */}
        <section className="glass rounded-3xl p-8">
          <h2 className="text-xl font-semibold mb-6">Profile Picture</h2>

          <div className="flex flex-col sm:flex-row items-start gap-8">
            <div className="relative">
              <div className="w-32 h-32 rounded-2xl overflow-hidden border border-white/10 bg-white/5 flex items-center justify-center">
                {avatarPreview ? (
                  <img
                    src={avatarPreview}
                    alt="Your avatar"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="text-6xl opacity-40">👤</div>
                )}
              </div>
              {uploadingAvatar && (
                <div className="absolute inset-0 bg-black/60 rounded-2xl flex items-center justify-center text-sm">
                  Uploading...
                </div>
              )}
            </div>

            <div className="flex-1 space-y-4">
              <div>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleAvatarSelect}
                  className="block w-full text-sm text-readable-muted file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-semibold file:bg-white/10 file:text-white hover:file:bg-white/20 cursor-pointer"
                />
                <p className="text-xs text-readable-subtle mt-1.5">PNG, JPG or GIF up to 5MB</p>
              </div>

              {selectedFile && (
                <button
                  onClick={uploadAvatar}
                  disabled={uploadingAvatar}
                  className="btn-primary px-5 py-2 rounded-xl text-sm disabled:opacity-60"
                >
                  {uploadingAvatar ? 'Uploading...' : 'Upload & Set as Avatar'}
                </button>
              )}

              <p className="text-xs text-readable-subtle">
                Your avatar is visible to your team in chat, presence, and calls.
              </p>
            </div>
          </div>
        </section>

        {/* Display name + Bio */}
        <section className="glass rounded-3xl p-8">
          <h2 className="text-xl font-semibold mb-6">Public Profile</h2>

          <div className="space-y-6">
            <div>
              <label className="block text-sm mb-2 text-readable-muted">Display Name</label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="How others see you"
                className="w-full px-4 py-3 rounded-2xl bg-white/5 border border-white/10 focus:outline-none focus:border-sky-400/60 text-readable"
              />
              <p className="text-[11px] text-readable-subtle mt-1">Used in chat, presence, and calls. Defaults to your username.</p>
            </div>

            <div>
              <label className="block text-sm mb-2 text-readable-muted">Bio</label>
              <textarea
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                placeholder="Tell your team a little about yourself..."
                rows={4}
                maxLength={500}
                className="w-full px-4 py-3 rounded-2xl bg-white/5 border border-white/10 focus:outline-none focus:border-sky-400/60 text-readable resize-y"
              />
              <div className="text-right text-[10px] text-readable-subtle">{bio.length}/500</div>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                onClick={handleSaveProfile}
                disabled={saving}
                className="btn-primary px-6 py-2.5 rounded-2xl text-sm disabled:opacity-70"
              >
                {saving ? 'Saving...' : 'Save Profile'}
              </button>
              <button
                onClick={() => {
                  if (profile) {
                    setDisplayName(profile.display_name || profile.username);
                    setBio(profile.bio || '');
                  }
                }}
                className="glass px-5 py-2.5 rounded-2xl text-sm"
              >
                Reset
              </button>
            </div>
          </div>
        </section>

        {/* Account info (read-only) */}
        <section className="glass rounded-3xl p-8">
          <h2 className="text-xl font-semibold mb-6">Account</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-4 text-sm">
            <div>
              <div className="text-readable-subtle text-xs tracking-wide">USERNAME</div>
              <div className="font-medium mt-0.5">{profile?.username}</div>
            </div>
            <div>
              <div className="text-readable-subtle text-xs tracking-wide">EMAIL</div>
              <div className="font-medium mt-0.5">{profile?.email}</div>
            </div>
            <div>
              <div className="text-readable-subtle text-xs tracking-wide">ROLE</div>
              <div className="font-medium mt-0.5 capitalize">{profile?.role}</div>
            </div>
            <div>
              <div className="text-readable-subtle text-xs tracking-wide">MEMBER SINCE</div>
              <div className="font-medium mt-0.5">
                {profile?.created_at ? new Date(profile.created_at).toLocaleDateString() : '—'}
              </div>
            </div>
          </div>
          <p className="text-xs text-readable-subtle mt-6">
            Username and email changes are not supported in this demo settings page.
          </p>
        </section>

        {/* Social account linking */}
        <section className="glass rounded-3xl p-8">
          <h2 className="text-xl font-semibold mb-2">Connected Accounts</h2>
          <p className="text-readable-muted text-sm mb-6">
            Link your social accounts for easier sign-in and team recognition (demo implementation).
          </p>

          <div className="space-y-3">
            {SOCIAL_PROVIDERS.map((prov) => {
              const data = linked[prov.key];
              const isLinked = !!data;

              return (
                <div
                  key={prov.key}
                  className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-5 py-4"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{prov.icon}</span>
                    <div>
                      <div className="font-medium">{prov.label}</div>
                      {isLinked && (
                        <div className="text-xs text-emerald-400">
                          Connected as {data.external_id || data.email || 'linked account'}
                        </div>
                      )}
                    </div>
                  </div>

                  {isLinked ? (
                    <button
                      onClick={() => unlinkSocial(prov.key)}
                      className="text-sm px-4 py-1.5 rounded-xl border border-red-400/30 text-red-300 hover:bg-red-500/10"
                    >
                      Unlink
                    </button>
                  ) : (
                    <button
                      onClick={() => linkSocial(prov.key)}
                      className="text-sm px-4 py-1.5 rounded-xl btn-primary text-white"
                    >
                      Link {prov.label}
                    </button>
                  )}
                </div>
              );
            })}
          </div>

          <p className="text-[11px] text-readable-subtle mt-5">
            In a production app these would complete real OAuth flows and store secure tokens.
          </p>
        </section>
      </div>
    </div>
  );
}
