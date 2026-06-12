'use client';

import React from 'react';
import { usePathname } from 'next/navigation';
import { useChat } from '../contexts/ChatContext';
import ChatPanel from './ChatPanel';

export default function ChatFloatingButton() {
  const pathname = usePathname();
  const { isOpen, toggleChat, unreadCount, connected } = useChat();

  if (pathname === '/login' || pathname === '/register') return null;
  const isBreakoutPage = pathname.startsWith('/breakout-room/');

  return (
    <div className="chat-floating-root">
      {isOpen && !isBreakoutPage && <ChatPanel />}

      <button
        onClick={toggleChat}
        className={`chat-fab ${unreadCount > 0 ? 'chat-fab-pulse' : ''}`}
        aria-label="Open team chat"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" className="w-6 h-6">
          <path strokeLinecap="round" strokeLinejoin="round" d="M8 10h8M8 14h5M21 12c0 4.418-4.03 8-9 8-1.05 0-2.06-.15-3-.42L3 21l1.42-5.01A8.96 8.96 0 013 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
        </svg>

        {unreadCount > 0 && (
          <span className="chat-fab-badge">{unreadCount > 9 ? '9+' : unreadCount}</span>
        )}

        <span className={`chat-fab-status ${connected ? 'chat-fab-status-live' : ''}`} />
      </button>
    </div>
  );
}