'use client';

import React, { useEffect, useRef, useState } from 'react';
import axios from 'axios';
import { useChat } from '../contexts/ChatContext';
import { usePresence } from '../contexts/RealtimeContext';
import { Attachment, ChatTargetType, TEAM_OPTIONS } from '../lib/chatTypes';
import { presenceDotClass } from '../lib/presenceUtils';
import { apiUrl, authHeaders } from '../lib/api';

function formatTimestamp(iso: string) {
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function initials(name: string) {
  return name.split(' ').map((n) => n[0]).join('').slice(0, 2);
}

interface ChatPanelProps {
  embedded?: boolean;
}

export default function ChatPanel({ embedded = false }: ChatPanelProps) {
  const {
    connected, messages, displayName, team, setTeam,
    sendMessage, sendNotice, sendAttachment, closeChat, roomId, authenticated,
  } = useChat();
  const { onlineUsers, offlineUsers } = usePresence();

  const [input, setInput] = useState('');
  const [targetType, setTargetType] = useState<ChatTargetType>('all');
  const [targetValue, setTargetValue] = useState('');
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;
    const ok = targetType === 'all'
      ? sendMessage(input.trim())
      : sendMessage(input.trim(), targetType, targetValue);
    if (ok) setInput('');
  };

  const handleQuickNotice = () => {
    const text = input.trim() || `Team notice from ${displayName}`;
    sendNotice(text, targetType, targetType === 'all' ? undefined : targetValue);
    setInput('');
  };

  const triggerFileUpload = () => {
    if (!uploading) fileInputRef.current?.click();
  };

  const performUpload = async (file: File) => {
    if (!file || uploading) return;
    setUploading(true);
    try {
      const form = new FormData();
      form.append('file', file);
      const res = await axios.post(apiUrl('/files/upload'), form, {
        headers: { ...authHeaders(), 'Content-Type': 'multipart/form-data' },
      });
      const data = res.data;
      const attachment: Attachment = {
        id: data.id,
        filename: data.filename,
        url: apiUrl(data.download_path),
        size: data.size,
        content_type: data.content_type,
      };
      const caption = input.trim();
      const ok = sendAttachment(attachment, caption, targetType, targetType === 'all' ? undefined : targetValue);
      if (ok) setInput('');
    } catch (e: any) {
      // eslint-disable-next-line no-alert
      alert(e?.response?.data?.detail || 'Upload failed. Check file size or connection.');
    } finally {
      setUploading(false);
      // reset input so same file can be picked again
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) performUpload(f);
  };

  return (
    <div className={`chat-panel glass-dark card-accent card-accent-sky flex flex-col ${embedded ? 'chat-panel-embedded' : ''}`}>
      <div className="chat-panel-header">
        <div className="flex items-center gap-3">
          <div className="chat-panel-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" className="w-5 h-5 text-sky-300">
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 10h8M8 14h5M21 12c0 4.418-4.03 8-9 8-1.05 0-2.06-.15-3-.42L3 21l1.42-5.01A8.96 8.96 0 013 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
          </div>
          <div>
            <h3 className="text-sm font-semibold">Team Chat</h3>
            <p className="text-[10px] text-readable-subtle flex items-center gap-1.5">
              <span className={`w-1.5 h-1.5 rounded-full ${connected ? 'bg-emerald-400' : 'bg-amber-400'}`} />
              {connected ? 'Live' : 'Reconnecting...'} · {onlineUsers.length} online · {roomId}
            </p>
          </div>
        </div>
        {!embedded && (
          <button onClick={closeChat} className="text-readable-subtle hover:text-readable text-lg leading-none" aria-label="Close chat">
            ×
          </button>
        )}
      </div>

      <div className="px-4 py-2 border-b border-white/5 flex flex-wrap gap-2">
        <select
          value={team}
          onChange={(e) => setTeam(e.target.value)}
          className="text-xs px-2 py-1 rounded-lg bg-white/5 border border-white/10 focus:outline-none"
        >
          {TEAM_OPTIONS.map((t) => <option key={t} value={t} className="bg-slate-900">{t}</option>)}
        </select>
        <select
          value={targetType}
          onChange={(e) => {
            setTargetType(e.target.value as ChatTargetType);
            setTargetValue('');
          }}
          className="text-xs px-2 py-1 rounded-lg bg-white/5 border border-white/10 focus:outline-none"
        >
          <option value="all" className="bg-slate-900">Everyone</option>
          <option value="team" className="bg-slate-900">Team</option>
          <option value="user" className="bg-slate-900">Person</option>
        </select>
        {targetType === 'team' && (
          <select
            value={targetValue}
            onChange={(e) => setTargetValue(e.target.value)}
            className="text-xs px-2 py-1 rounded-lg bg-white/5 border border-white/10 focus:outline-none"
          >
            <option value="" className="bg-slate-900">Select team</option>
            {TEAM_OPTIONS.map((t) => <option key={t} value={t} className="bg-slate-900">{t}</option>)}
          </select>
        )}
        {targetType === 'user' && (
          <select
            value={targetValue}
            onChange={(e) => setTargetValue(e.target.value)}
            className="text-xs px-2 py-1 rounded-lg bg-white/5 border border-white/10 focus:outline-none"
          >
            <option value="" className="bg-slate-900">Select person</option>
            {onlineUsers.map((u) => (
              <option key={u.username} value={u.username} className="bg-slate-900">
                {u.display_name} (online)
              </option>
            ))}
            {offlineUsers.map((u) => (
              <option key={u.username} value={u.username} className="bg-slate-900" disabled>
                {u.display_name} (offline)
              </option>
            ))}
          </select>
        )}
      </div>

      {onlineUsers.length > 0 && (
        <div className="px-4 py-2 border-b border-white/5 flex gap-2 overflow-x-auto">
          {onlineUsers.slice(0, 6).map((u) => (
            <span key={u.username} className="flex items-center gap-1 text-[10px] stat-pill px-2 py-1 shrink-0">
              <span className={`w-1.5 h-1.5 rounded-full ${presenceDotClass(u.status, u.is_online)}`} />
              {u.display_name.split(' ')[0]}
            </span>
          ))}
        </div>
      )}

      <div className="chat-panel-messages">
        {!authenticated && (
          <p className="text-center text-readable-subtle text-xs py-8">Sign in to join real-time team chat.</p>
        )}
        {authenticated && messages.length === 0 && (
          <p className="text-center text-readable-subtle text-xs py-8">No messages yet. Say hello to your team.</p>
        )}
        {messages.map((msg, i) => {
          const isNotice = msg.type === 'notice';
          const isOwn = msg.sender_name === displayName;
          const isTargeted = msg.target_type !== 'all' && msg.target_value;

          return (
            <div
              key={`${msg.timestamp}-${i}`}
              className={`chat-message ${isNotice ? 'chat-message-notice' : ''} ${isOwn ? 'chat-message-own' : ''}`}
            >
              {!isNotice && (
                <div className="w-7 h-7 shrink-0 bg-gradient-to-br from-sky-400 to-indigo-500 rounded-full flex items-center justify-center text-[9px] font-semibold">
                  {initials(msg.sender_name)}
                </div>
              )}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-medium">{msg.sender_name}</span>
                  <span className="text-[10px] text-readable-subtle">{formatTimestamp(msg.timestamp)}</span>
                  {isTargeted && (
                    <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-violet-500/15 text-violet-300 border border-violet-500/20">
                      → {msg.target_type === 'user' ? msg.target_value : `team ${msg.target_value}`}
                    </span>
                  )}
                  {isNotice && (
                    <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/20">
                      Notice
                    </span>
                  )}
                </div>
                <p className="text-sm text-readable-muted break-words">{msg.content}</p>
                {msg.attachment && (
                  <>
                    {msg.attachment.content_type?.startsWith('image/') && (
                      <a href={msg.attachment.url} target="_blank" rel="noopener noreferrer" className="block mt-1.5">
                        <img
                          src={msg.attachment.url}
                          alt={msg.attachment.filename}
                          className="max-h-40 max-w-[240px] rounded-lg border border-white/10 object-contain bg-black/20"
                          loading="lazy"
                        />
                      </a>
                    )}
                    <a
                      href={msg.attachment.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      download={msg.attachment.filename}
                      className="mt-1.5 inline-flex items-center gap-2 text-xs rounded-lg border border-white/10 bg-white/5 px-2.5 py-1 hover:bg-white/10 hover:border-sky-400/30 max-w-full"
                      title={`Download ${msg.attachment.filename}`}
                    >
                      <span className="text-base leading-none">📎</span>
                      <span className="truncate max-w-[220px]">{msg.attachment.filename}</span>
                      {msg.attachment.size != null && (
                        <span className="text-[10px] text-readable-subtle ml-1 shrink-0">
                          {(msg.attachment.size / 1024).toFixed(msg.attachment.size > 1024 * 1024 ? 1 : 0)}k
                        </span>
                      )}
                    </a>
                  </>
                )}
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      <form onSubmit={handleSend} className="chat-panel-input">
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          onChange={onFileChange}
          disabled={uploading}
        />
        <button
          type="button"
          onClick={triggerFileUpload}
          disabled={uploading}
          className="glass px-2.5 py-2 rounded-xl text-sm border border-white/10 hover:border-white/20 disabled:opacity-50"
          title="Attach file (uploads and shares in chat)"
        >
          {uploading ? '⏳' : '📎'}
        </button>
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={
            targetType === 'all' ? 'Message everyone...' :
            targetType === 'user' ? `Message ${targetValue || 'person'}...` :
            `Notice to ${targetValue || 'team'}...`
          }
          className="flex-1 px-3 py-2 rounded-xl bg-white/5 border border-white/10 focus:outline-none focus:border-sky-400/60 text-sm"
          disabled={uploading}
        />
        <button type="submit" disabled={uploading} className="btn-primary px-4 py-2 rounded-xl text-xs font-semibold text-white disabled:opacity-50">
          Send
        </button>
        <button
          type="button"
          onClick={handleQuickNotice}
          disabled={uploading}
          className="glass px-3 py-2 rounded-xl text-xs font-medium border border-amber-500/20 text-amber-300 disabled:opacity-50"
          title="Send as notice"
        >
          Notice
        </button>
      </form>
    </div>
  );
}