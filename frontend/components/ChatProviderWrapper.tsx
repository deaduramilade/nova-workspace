'use client';

import React from 'react';
import { ChatProvider } from '../contexts/ChatContext';
import ChatFloatingButton from './ChatFloatingButton';

export default function ChatProviderWrapper({ children }: { children: React.ReactNode }) {
  return (
    <ChatProvider>
      {children}
      <ChatFloatingButton />
    </ChatProvider>
  );
}