"use client";

import React, { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  AlertCircle,
  Smartphone,
  Laptop,
  Tablet,
  Trash2,
  Lock,
  CheckCircle2,
  AlertTriangle,
  Clock,
} from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface Device {
  id: number;
  device_name: string;
  device_type: string;
  browser: string;
  os: string;
  is_active: boolean;
  last_used_at: string;
  expires_at: string | null;
  location: string | null;
  can_access_sensitive_endpoints: boolean;
  allow_passwordless_login: boolean;
}

interface AdminSession {
  session_id: string;
  device_name: string;
  created_at: string;
  expires_at: string;
  last_activity: string;
  ip_address: string;
  location: string | null;
  auth_method: string;
  mfa_verified: boolean;
}

const getDeviceIcon = (deviceType: string) => {
  switch (deviceType.toLowerCase()) {
    case "phone":
      return <Smartphone className="w-5 h-5" />;
    case "tablet":
      return <Tablet className="w-5 h-5" />;
    default:
      return <Laptop className="w-5 h-5" />;
  }
};

const getTrustBadge = (isActive: boolean, isPrimary: boolean) => {
  if (!isActive) {
    return <Badge variant="outline">Inactive</Badge>;
  }
  if (isPrimary) {
    return (
      <Badge className="bg-green-100 text-green-800">
        <CheckCircle2 className="w-3 h-3 mr-1" />
        Trusted
      </Badge>
    );
  }
  return <Badge variant="secondary">Pending</Badge>;
};

const getRiskLevel = (trustLevel: string) => {
  const config: { [key: string]: { color: string; label: string } } = {
    high: { color: "bg-green-100 text-green-800", label: "High Trust" },
    medium: { color: "bg-yellow-100 text-yellow-800", label: "Medium Trust" },
    low: { color: "bg-orange-100 text-orange-800", label: "Low Trust" },
    untrusted: { color: "bg-red-100 text-red-800", label: "Untrusted" },
  };

  const config_item = config[trustLevel] || config.untrusted;
  return <Badge className={config_item.color}>{config_item.label}</Badge>;
};

export function DeviceManagementPanel() {
  const [devices, setDevices] = useState<Device[]>([]);
  const [sessions, setSessions] = useState<AdminSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);
  const [revokeSession, setRevokeSession] = useState<string | null>(null);

  useEffect(() => {
    fetchDevices();
    fetchSessions();
  }, []);

  const fetchDevices = async () => {
    try {
      const response = await fetch("/api/v1/devices/my-devices", {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("access_token")}`,
        },
      });
      const data = await response.json();
      setDevices(data.devices);
    } catch (error) {
      console.error("Failed to fetch devices:", error);
    }
  };

  const fetchSessions = async () => {
    try {
      const response = await fetch("/api/v1/devices/sessions", {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("access_token")}`,
        },
      });
      const data = await response.json();
      setSessions(data.sessions);
    } catch (error) {
      console.error("Failed to fetch sessions:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleTrustDevice = async (deviceId: number, deviceName: string) => {
    try {
      const response = await fetch(`/api/v1/devices/trust/${deviceId}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("access_token")}`,
        },
        body: JSON.stringify({ device_name: deviceName }),
      });

      if (response.ok) {
        fetchDevices();
      }
    } catch (error) {
      console.error("Failed to trust device:", error);
    }
  };

  const handleUntrust = async (deviceId: number) => {
    try {
      const response = await fetch(`/api/v1/devices/untrust/${deviceId}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${localStorage.getItem("access_token")}`,
        },
      });

      if (response.ok) {
        fetchDevices();
        setDeleteConfirm(null);
      }
    } catch (error) {
      console.error("Failed to untrust device:", error);
    }
  };

  const handleRevokeSession = async (sessionId: string) => {
    try {
      const response = await fetch(`/api/v1/devices/sessions/revoke`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("access_token")}`,
        },
        body: JSON.stringify({
          session_id: sessionId,
          reason: "User revoked session",
        }),
      });

      if (response.ok) {
        fetchSessions();
        setRevokeSession(null);
      }
    } catch (error) {
      console.error("Failed to revoke session:", error);
    }
  };

  if (loading) {
    return <div className="text-center py-8">Loading device information...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Trusted Devices Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lock className="w-5 h-5" />
            Trusted Devices
          </CardTitle>
          <CardDescription>
            Manage devices you trust for zero-trust authentication
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {devices.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              No devices registered yet
            </div>
          ) : (
            <div className="space-y-4">
              {devices.map((device) => (
                <div
                  key={device.id}
                  className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50"
                >
                  <div className="flex items-center gap-4 flex-1">
                    <div className="text-gray-400">
                      {getDeviceIcon(device.device_type)}
                    </div>
                    <div className="flex-1">
                      <div className="font-medium">{device.device_name}</div>
                      <div className="text-sm text-gray-600">
                        {device.browser} on {device.os}
                        {device.location && ` • ${device.location}`}
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        Last used:{" "}
                        {new Date(device.last_used_at).toLocaleDateString()}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    {getRiskLevel("high")}
                    {device.is_active ? (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          setDeleteConfirm(device.id)
                        }
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        onClick={() =>
                          handleTrustDevice(device.id, device.device_name)
                        }
                      >
                        Trust Device
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Active Sessions Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="w-5 h-5" />
            Active Sessions
          </CardTitle>
          <CardDescription>
            Manage your active login sessions across all trusted devices
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {sessions.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              No active sessions
            </div>
          ) : (
            <div className="space-y-4">
              {sessions.map((session) => (
                <div
                  key={session.session_id}
                  className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50"
                >
                  <div className="flex-1">
                    <div className="font-medium">{session.device_name}</div>
                    <div className="text-sm text-gray-600">
                      {session.auth_method}
                      {session.mfa_verified && " • MFA Verified"}
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      IP: {session.ip_address} • Started:{" "}
                      {new Date(session.created_at).toLocaleString()}
                    </div>
                    <div className="text-xs text-gray-500">
                      Expires:{" "}
                      {new Date(session.expires_at).toLocaleString()}
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <Badge
                      variant="outline"
                      className="bg-blue-50"
                    >
                      Active
                    </Badge>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        setRevokeSession(session.session_id)
                      }
                    >
                      Revoke
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <Button
            variant="outline"
            className="w-full mt-4"
            onClick={async () => {
              try {
                const response = await fetch(
                  "/api/v1/devices/sessions/revoke-all",
                  {
                    method: "POST",
                    headers: {
                      Authorization: `Bearer ${localStorage.getItem(
                        "access_token"
                      )}`,
                    },
                  }
                );
                if (response.ok) {
                  fetchSessions();
                }
              } catch (error) {
                console.error("Failed to revoke all sessions:", error);
              }
            }}
          >
            Revoke All Sessions (Except Current)
          </Button>
        </CardContent>
      </Card>

      {/* Security Alert */}
      <Card className="border-orange-200 bg-orange-50">
        <CardContent className="pt-6">
          <div className="flex gap-3">
            <AlertTriangle className="w-5 h-5 text-orange-600 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="font-semibold text-orange-900">
                Security Recommendations
              </h3>
              <ul className="text-sm text-orange-800 mt-2 space-y-1">
                <li>
                  • Regularly review and remove unused devices
                </li>
                <li>
                  • Revoke all sessions if you suspect account compromise
                </li>
                <li>
                  • Enable passwordless authentication on high-trust devices
                </li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteConfirm !== null}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Device?</AlertDialogTitle>
            <AlertDialogDescription>
              This device will be untrusted and will require re-verification on
              the next login. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="flex justify-end gap-2">
            <AlertDialogCancel onClick={() => setDeleteConfirm(null)}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() =>
                deleteConfirm && handleUntrust(deleteConfirm)
              }
              className="bg-red-600 hover:bg-red-700"
            >
              Remove Device
            </AlertDialogAction>
          </div>
        </AlertDialogContent>
      </AlertDialog>

      {/* Revoke Session Dialog */}
      <AlertDialog open={revokeSession !== null}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Revoke Session?</AlertDialogTitle>
            <AlertDialogDescription>
              This will immediately end the session on that device. The user
              will need to log in again.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="flex justify-end gap-2">
            <AlertDialogCancel onClick={() => setRevokeSession(null)}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() =>
                revokeSession && handleRevokeSession(revokeSession)
              }
              className="bg-red-600 hover:bg-red-700"
            >
              Revoke Session
            </AlertDialogAction>
          </div>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
