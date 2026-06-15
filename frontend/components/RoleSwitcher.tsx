'use client';

import React, { useState, useEffect } from 'react';
import { useRole } from '../contexts/RoleContext';
import toast from 'react-hot-toast';

const TEST_ROLES = ['user', 'supervisor', 'hr', 'lead', 'admin'];

export default function RoleSwitcher() {
  const {
    realRole,
    testingRole,
    effectiveRole,
    setTestingRole,
    clearTestingRole,
    submitRoleRequest,
    isTesting,
    refreshRole,
  } = useRole();

  const [requesting, setRequesting] = useState(false);
  const [pendingRequest, setPendingRequest] = useState<any>(null);

  // Listen for real-time WS updates about role requests (affects this user)
  useEffect(() => {
    const handleUpdate = (event: CustomEvent) => {
      const msg = (event.detail?.message || "").toLowerCase();
      if (msg.includes("role request") && msg.includes(realRole.toLowerCase() || "")) {
        // Refresh or clear testing if approved for current user
        // For demo, we can trigger a global refresh or just toast
        toast("Role request status updated (real-time)", { icon: "🔄" });
        // In full impl, refetch pending for this user
      }
    };
    window.addEventListener("nova-supervisor-feedback", handleUpdate as EventListener);
    return () => window.removeEventListener("nova-supervisor-feedback", handleUpdate as EventListener);
  }, [realRole]);

  const handleSwitch = (role: string) => {
    if (role === realRole) {
      clearTestingRole();
      toast.success('Switched back to your real role');
    } else {
      setTestingRole(role);
      toast.success(`Now testing as ${role.toUpperCase()}. This is temporary.`);
    }
  };

  const handleRequestPermanent = async () => {
    if (!testingRole) {
      toast.error('Select a testing role first');
      return;
    }

    setRequesting(true);
    const success = await submitRoleRequest(testingRole);
    if (success) {
      toast.success(
        `Request to become ${testingRole.toUpperCase()} submitted. An administrator will review it.`
      );
      // Keep testing mode active so user can continue previewing while waiting for approval.
      // Admin will see it in the dashboard.
    } else {
      toast.error('Failed to submit role change request. Please try again or contact an admin.');
    }
    setRequesting(false);
  };

  return (
    <div className="relative group">
      <button
        className={`glass px-3 py-1.5 rounded-xl text-xs font-medium flex items-center gap-1.5 transition-colors ${
          isTesting
            ? 'bg-amber-500/15 text-amber-300 border border-amber-400/30'
            : 'hover:bg-white/10'
        }`}
        title={isTesting ? 'Testing Mode Active' : 'Test different roles (temporary)'}
      >
        <span>🧪</span>
        <span className="hidden sm:inline">Role</span>
        {isTesting && <span className="text-amber-400">({effectiveRole})</span>}
      </button>

      {/* Dropdown */}
      <div className="absolute right-0 mt-2 w-64 rounded-2xl border border-white/10 bg-slate-900/95 backdrop-blur p-2 shadow-xl z-[70] hidden group-hover:block">
        <div className="px-3 py-2 text-[10px] text-readable-subtle uppercase tracking-widest border-b border-white/10 mb-1">
          Testing Role Switcher
        </div>

        <div className="text-xs mb-2 px-1 text-readable-muted">
          Real role: <span className="font-medium capitalize">{realRole}</span>
        </div>

        <div className="space-y-1">
          {TEST_ROLES.map((role) => {
            const isCurrent = effectiveRole === role;
            const isReal = realRole === role;
            return (
              <button
                key={role}
                onClick={() => handleSwitch(role)}
                disabled={isCurrent}
                className={`w-full text-left px-3 py-1.5 rounded-xl text-sm flex items-center justify-between transition-colors ${
                  isCurrent
                    ? 'bg-white/10 font-medium'
                    : 'hover:bg-white/5'
                }`}
              >
                <span className="capitalize">{role}</span>
                {isReal && <span className="text-[10px] text-emerald-400">(real)</span>}
                {isCurrent && !isReal && <span className="text-[10px] text-amber-400">testing</span>}
              </button>
            );
          })}
        </div>

        <div className="border-t border-white/10 mt-2 pt-2 px-1">
          {isTesting && (
            <button
              onClick={handleRequestPermanent}
              disabled={requesting}
              className="w-full text-xs py-1.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 transition-colors mb-1"
            >
              {requesting ? 'Submitting...' : `Request ${effectiveRole.toUpperCase()} permanently`}
            </button>
          )}

          {isTesting && (
            <button
              onClick={clearTestingRole}
              className="w-full text-xs py-1.5 rounded-xl hover:bg-white/5 text-readable-muted"
            >
              Exit Testing Mode
            </button>
          )}

          <div className="text-[10px] text-readable-subtle mt-2 px-1 leading-tight">
            Testing changes are <span className="font-medium">temporary</span> and only affect your UI.
            Permanent role changes require Administrator approval.
          </div>
        </div>
      </div>
    </div>
  );
}
