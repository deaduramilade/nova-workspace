'use client';

import React from 'react';
import { useRouter } from 'next/navigation';

interface PageNavProps {
  title: string;
  subtitle?: string;
  status?: { label: string; active: boolean };
  backLabel?: string;
  backHref?: string;
}

export default function PageNav({
  title,
  subtitle,
  status,
  backLabel = '← Dashboard',
  backHref = '/',
}: PageNavProps) {
  const router = useRouter();

  return (
    <nav className="glass fixed top-0 left-0 right-0 z-50 border-b border-white/10">
      <div className="px-6 lg:px-8 py-3.5 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-9 h-9 bg-gradient-to-br from-sky-400 to-indigo-500 rounded-xl flex items-center justify-center text-base font-bold shadow-lg shadow-sky-500/20">
            N
          </div>
          <div>
            <h1 className="text-lg font-semibold tracking-tight">{title}</h1>
            {(subtitle || status) && (
              <p className="text-xs text-readable-subtle flex items-center gap-1.5">
                {status && (
                  <span className={`w-1.5 h-1.5 rounded-full ${status.active ? 'bg-emerald-400' : 'bg-amber-400'}`} />
                )}
                {status?.label ?? subtitle}
              </p>
            )}
          </div>
        </div>
        <button
          onClick={() => router.push(backHref)}
          className="glass px-5 py-2.5 rounded-xl text-sm font-medium hover:bg-white/5 transition-colors"
        >
          {backLabel}
        </button>
      </div>
    </nav>
  );
}