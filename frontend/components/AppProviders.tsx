'use client';

import React from 'react';
import { ChatProvider } from '../contexts/ChatContext';
import { Phase3Provider } from '../contexts/Phase3Context';
import { RealtimeProvider } from '../contexts/RealtimeContext';
import { RoleProvider } from '../contexts/RoleContext';
import CallFloatingButton from './CallFloatingButton';
import ChatFloatingButton from './ChatFloatingButton';
import IncomingCallModal from './IncomingCallModal';
import OfflineSyncBar from './OfflineSyncBar';
import PresenceStatusBar from './PresenceStatusBar';
import SupervisorFeedbackToast from './SupervisorFeedbackToast';

export default function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <RealtimeProvider>
      <RoleProvider>
        <Phase3Provider>
          <ChatProvider>
            {children}
            <OfflineSyncBar />
            <SupervisorFeedbackToast />
            <PresenceStatusBar />
            <CallFloatingButton />
            <ChatFloatingButton />
            <IncomingCallModal />
          </ChatProvider>
        </Phase3Provider>
      </RoleProvider>
    </RealtimeProvider>
  );
}