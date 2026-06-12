'use client';

import React from 'react';
import { ChatProvider } from '../contexts/ChatContext';
import { CallProvider } from '../contexts/CallContext';
import CallFloatingButton from './CallFloatingButton';
import ChatFloatingButton from './ChatFloatingButton';
import IncomingCallModal from './IncomingCallModal';

export default function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <CallProvider>
      <ChatProvider>
        {children}
        <CallFloatingButton />
        <ChatFloatingButton />
        <IncomingCallModal />
      </ChatProvider>
    </CallProvider>
  );
}