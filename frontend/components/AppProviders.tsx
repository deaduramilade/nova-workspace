'use client';

import React from 'react';
import { ChatProvider } from '../contexts/ChatContext';
import { RealtimeProvider } from '../contexts/RealtimeContext';
import CallFloatingButton from './CallFloatingButton';
import ChatFloatingButton from './ChatFloatingButton';
import IncomingCallModal from './IncomingCallModal';
import PresenceStatusBar from './PresenceStatusBar';

export default function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <RealtimeProvider>
      <ChatProvider>
        {children}
        <PresenceStatusBar />
        <CallFloatingButton />
        <ChatFloatingButton />
        <IncomingCallModal />
      </ChatProvider>
    </RealtimeProvider>
  );
}