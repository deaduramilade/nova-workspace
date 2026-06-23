"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  AlertCircle,
  Loader,
  CheckCircle2,
  AlertTriangle,
  Shield,
} from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface RiskAssessment {
  risk_score: number;
  risk_level: string;
  anomalies: Record<string, number>;
  requires_additional_mfa: boolean;
  requires_admin_approval: boolean;
}

interface Device {
  device_id: string;
  trust_level: string;
  is_trusted: boolean;
}

interface LoginResponse {
  access_token?: string;
  token_type?: string;
  session_id?: string;
  user?: { id: number; username: string; role: string; display_name: string };
  risk_assessment?: RiskAssessment;
  device?: Device;
  mfa_required?: boolean;
  error?: string;
  status?: number;
}

// Device fingerprinting helper
async function getDeviceFingerprint() {
  return {
    platform: navigator.platform,
    language: navigator.language,
    languages: navigator.languages,
    hardwareConcurrency: navigator.hardwareConcurrency,
    deviceMemory: (navigator as any).deviceMemory,
    maxTouchPoints: navigator.maxTouchPoints,
    vendor: navigator.vendor,
    screen: {
      width: window.screen.width,
      height: window.screen.height,
      colorDepth: window.screen.colorDepth,
    },
  };
}

async function getUserIP() {
  try {
    const response = await fetch("https://api.ipify.org?format=json");
    const data = await response.json();
    return data.ip;
  } catch {
    return "unknown";
  }
}

export default function ZeroTrustLoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [totpCode, setTotpCode] = useState("");
  const [deviceName, setDeviceName] = useState("");
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [mfaRequired, setMfaRequired] = useState(false);
  const [riskAssessment, setRiskAssessment] = useState<RiskAssessment | null>(null);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [anomalyVerification, setAnomalyVerification] = useState(false);
  const [sessionId, setSessionId] = useState("");

  const getRiskLevelColor = (level: string) => {
    switch (level) {
      case "critical":
        return "bg-red-100 text-red-800 border-red-300";
      case "high":
        return "bg-orange-100 text-orange-800 border-orange-300";
      case "medium":
        return "bg-yellow-100 text-yellow-800 border-yellow-300";
      default:
        return "bg-green-100 text-green-800 border-green-300";
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const fingerprint = await getDeviceFingerprint();
      const ipAddress = await getUserIP();
      const userAgent = navigator.userAgent;

      const response = await fetch("/api/v1/auth/zero-trust/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username,
          password,
          device_name: deviceName || `${navigator.platform} Device`,
          device_fingerprint_data: fingerprint,
          user_agent: userAgent,
          ip_address: ipAddress,
          totp_code: totpCode || undefined,
        }),
      });

      const data: LoginResponse = await response.json();

      if (data.error) {
        setError(data.error);
        return;
      }

      if (data.mfa_required) {
        setMfaRequired(true);
        setCurrentUser(data.user);
        setRiskAssessment(data.risk_assessment || null);
        return;
      }

      if (data.access_token && data.session_id) {
        // Successful login
        localStorage.setItem("access_token", data.access_token);
        localStorage.setItem("session_id", data.session_id);
        localStorage.setItem("user", JSON.stringify(data.user));

        // Store risk assessment for display
        if (data.risk_assessment) {
          localStorage.setItem(
            "last_risk_assessment",
            JSON.stringify(data.risk_assessment)
          );
        }

        router.push("/dashboard");
      }
    } catch (err) {
      setError("Login failed. Please try again.");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleMFASubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!totpCode) {
      setError("Please enter your MFA code");
      return;
    }

    await handleLogin(e);
  };

  const handleAnomalyVerification = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await fetch("/api/v1/auth/zero-trust/verify-anomaly", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          session_id: sessionId,
          verification_code: totpCode,
        }),
      });

      const data = await response.json();

      if (data.verified) {
        localStorage.setItem("access_token", sessionId);
        localStorage.setItem("session_id", sessionId);
        localStorage.setItem("user", JSON.stringify(currentUser));
        router.push("/dashboard");
      }
    } catch (err) {
      setError("Verification failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // Initial login form
  if (!mfaRequired) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="space-y-2">
            <div className="flex items-center gap-2">
              <Shield className="w-6 h-6 text-blue-600" />
              <CardTitle>Zero-Trust Login</CardTitle>
            </div>
            <CardDescription>
              Enhanced security with device verification
            </CardDescription>
          </CardHeader>

          <CardContent>
            {error && (
              <Alert className="mb-4 border-red-300 bg-red-50">
                <AlertCircle className="w-4 h-4 text-red-600" />
                <AlertDescription className="text-red-700">
                  {error}
                </AlertDescription>
              </Alert>
            )}

            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">
                  Username
                </label>
                <Input
                  type="text"
                  placeholder="Enter your username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  disabled={loading}
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">
                  Password
                </label>
                <Input
                  type="password"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={loading}
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">
                  Device Name (Optional)
                </label>
                <Input
                  type="text"
                  placeholder="e.g., Work Laptop"
                  value={deviceName}
                  onChange={(e) => setDeviceName(e.target.value)}
                  disabled={loading}
                />
                <p className="text-xs text-gray-500 mt-1">
                  Give this device a friendly name for easy identification
                </p>
              </div>

              <Button
                type="submit"
                className="w-full"
                disabled={loading}
              >
                {loading ? (
                  <>
                    <Loader className="w-4 h-4 mr-2 animate-spin" />
                    Logging in...
                  </>
                ) : (
                  "Sign In"
                )}
              </Button>
            </form>

            <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
              <p className="text-xs text-blue-700">
                ℹ️ This login uses advanced device verification. Your device
                will be fingerprinted and monitored for security.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // MFA or Anomaly Verification required
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-2">
          <CardTitle className="flex items-center gap-2">
            <Shield className="w-5 h-5" />
            Security Verification
          </CardTitle>

          {riskAssessment && (
            <div className={`mt-3 p-3 rounded-lg border ${getRiskLevelColor(riskAssessment.risk_level)}`}>
              <div className="font-semibold text-sm">
                Risk Level: {riskAssessment.risk_level.toUpperCase()}
              </div>
              <div className="text-xs mt-1">
                Score: {riskAssessment.risk_score}/100
              </div>

              {Object.keys(riskAssessment.anomalies).length > 0 && (
                <div className="mt-2 text-xs">
                  <div className="font-semibold mb-1">Detected:</div>
                  <ul className="space-y-1">
                    {Object.entries(riskAssessment.anomalies).map(
                      ([anomaly, confidence]) => (
                        <li key={anomaly}>
                          • {anomaly.replace(/_/g, " ")} ({(
                            (confidence as number) * 100
                          ).toFixed(0)}%)
                        </li>
                      )
                    )}
                  </ul>
                </div>
              )}
            </div>
          )}
        </CardHeader>

        <CardContent>
          {error && (
            <Alert className="mb-4 border-red-300 bg-red-50">
              <AlertCircle className="w-4 h-4 text-red-600" />
              <AlertDescription className="text-red-700">
                {error}
              </AlertDescription>
            </Alert>
          )}

          <form
            onSubmit={
              riskAssessment?.requires_admin_approval
                ? handleAnomalyVerification
                : handleMFASubmit
            }
            className="space-y-4"
          >
            {riskAssessment?.requires_admin_approval && (
              <Alert className="border-orange-300 bg-orange-50">
                <AlertTriangle className="w-4 h-4 text-orange-600" />
                <AlertDescription className="text-orange-700">
                  This login requires additional verification. An admin will
                  review this shortly.
                </AlertDescription>
              </Alert>
            )}

            <div>
              <label className="block text-sm font-medium mb-2">
                {riskAssessment?.requires_admin_approval
                  ? "Verification Code"
                  : "MFA Code"}
              </label>
              <div className="flex gap-2">
                <Input
                  type="text"
                  placeholder="Enter 6-digit code"
                  value={totpCode}
                  onChange={(e) =>
                    setTotpCode(e.target.value.replace(/\D/g, "").slice(0, 6))
                  }
                  disabled={loading}
                  maxLength={6}
                  className="text-center text-2xl tracking-widest"
                  required
                />
              </div>
              <p className="text-xs text-gray-500 mt-1">
                {riskAssessment?.requires_admin_approval
                  ? "Check your email for a verification code"
                  : "Enter the code from your authenticator app"}
              </p>
            </div>

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? (
                <>
                  <Loader className="w-4 h-4 mr-2 animate-spin" />
                  Verifying...
                </>
              ) : (
                "Verify"
              )}
            </Button>
          </form>

          <div className="mt-4 p-3 bg-blue-50 rounded-lg border border-blue-200 text-xs text-blue-700">
            {riskAssessment?.requires_additional_mfa && (
              <p>
                ✓ Additional MFA required: unusual login pattern detected
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
