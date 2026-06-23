"""Device fingerprinting and zero-trust validation utilities"""

import hashlib
import json
import uuid
from datetime import datetime, timedelta
from typing import Optional, Dict, Any
from user_agents import parse as parse_user_agent
import geoip2.database  # For IP geolocation (optional)


class DeviceFingerprintGenerator:
    """Generate device fingerprints for zero-trust authentication"""
    
    @staticmethod
    def parse_user_agent(user_agent: str) -> Dict[str, Any]:
        """Parse user agent string into structured components"""
        try:
            ua = parse_user_agent(user_agent)
            return {
                "browser": ua.browser.family,
                "browser_version": ua.browser.version_string,
                "os": ua.os.family,
                "os_version": ua.os.version_string,
                "device_family": ua.device.family,
                "is_mobile": ua.is_mobile,
                "is_tablet": ua.is_tablet,
                "is_pc": ua.is_pc,
            }
        except Exception as e:
            return {"error": str(e)}
    
    @staticmethod
    def generate_device_id(user_agent: str, ip_address: str, additional_data: Dict = None) -> str:
        """
        Generate a stable device ID based on fingerprint characteristics.
        Returns a UUID that remains consistent for the same device.
        """
        device_components = {
            "user_agent": user_agent,
            "ip_prefix": ip_address.rsplit(".", 1)[0],  # Ignore last octet for flexibility
        }
        
        if additional_data:
            device_components.update(additional_data)
        
        # Create a stable hash-based UUID
        fingerprint_str = json.dumps(device_components, sort_keys=True)
        fingerprint_hash = hashlib.sha256(fingerprint_str.encode()).digest()
        # Use namespace-based UUID generation for consistency
        return str(uuid.UUID(bytes=fingerprint_hash[:16]))
    
    @staticmethod
    def create_fingerprint_hash(
        user_agent: str,
        ip_address: str,
        additional_data: Dict = None
    ) -> str:
        """Create a SHA256 hash of device characteristics"""
        components = {
            "user_agent": user_agent,
            "ip_address": ip_address,
        }
        
        if additional_data:
            components.update(additional_data)
        
        combined = json.dumps(components, sort_keys=True)
        return hashlib.sha256(combined.encode()).hexdigest()
    
    @staticmethod
    def extract_device_info(user_agent: str) -> Dict[str, str]:
        """Extract device information from user agent"""
        ua_info = DeviceFingerprintGenerator.parse_user_agent(user_agent)
        if "error" in ua_info:
            return {}
        
        device_type = "laptop"
        if ua_info.get("is_mobile"):
            device_type = "phone"
        elif ua_info.get("is_tablet"):
            device_type = "tablet"
        
        return {
            "device_type": device_type,
            "browser": ua_info.get("browser", "Unknown"),
            "browser_version": ua_info.get("browser_version", ""),
            "os": ua_info.get("os", "Unknown"),
            "os_version": ua_info.get("os_version", ""),
        }


class ZeroTrustValidator:
    """Validate logins based on zero-trust principles"""
    
    # Risk thresholds
    RISK_THRESHOLDS = {
        "new_device": 40,
        "unusual_location": 50,
        "unusual_time": 30,
        "suspicious_pattern": 60,
        "failed_attempts": 70,
    }
    
    @staticmethod
    def calculate_risk_score(
        device_trusted: bool,
        device_recently_used: bool,
        location_matches_history: bool,
        time_within_working_hours: bool,
        recent_failed_attempts: int,
        ip_change_pattern: str = "normal"
    ) -> int:
        """
        Calculate risk score for a login attempt (0-100).
        Higher score = higher risk
        """
        risk = 0
        
        if not device_trusted:
            risk += ZeroTrustValidator.RISK_THRESHOLDS["new_device"]
        
        if not device_recently_used:
            risk += 20
        
        if not location_matches_history:
            risk += ZeroTrustValidator.RISK_THRESHOLDS["unusual_location"]
        
        if not time_within_working_hours:
            risk += ZeroTrustValidator.RISK_THRESHOLDS["unusual_time"]
        
        if recent_failed_attempts > 0:
            risk += min(
                recent_failed_attempts * 10,
                ZeroTrustValidator.RISK_THRESHOLDS["failed_attempts"]
            )
        
        if ip_change_pattern == "rapid":
            risk += 40  # IP changed too quickly
        elif ip_change_pattern == "distant":
            risk += 30  # Geographically distant IP
        
        return min(risk, 100)
    
    @staticmethod
    def detect_anomalies(
        login_context: Dict[str, Any],
        user_history: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Detect anomalies in login attempt.
        Returns dict of detected anomalies with confidence scores.
        """
        anomalies = {}
        now = datetime.utcnow()
        
        # Check time anomaly
        if "working_hours" in user_history:
            working_hours = user_history["working_hours"]
            current_hour = now.hour
            if not (working_hours["start"] <= current_hour < working_hours["end"]):
                anomalies["unusual_time"] = 0.75
        
        # Check location anomaly
        if "last_location" in user_history:
            if login_context.get("location") != user_history.get("last_location"):
                anomalies["location_change"] = 0.8
        
        # Check device anomaly
        if "known_devices" in user_history:
            device_id = login_context.get("device_id")
            if device_id not in user_history["known_devices"]:
                anomalies["unknown_device"] = 0.85
        
        # Check IP anomaly
        if "last_ips" in user_history:
            current_ip = login_context.get("ip_address")
            if current_ip not in user_history.get("last_ips", []):
                anomalies["new_ip"] = 0.6
        
        return anomalies
    
    @staticmethod
    def should_require_additional_mfa(risk_score: int, anomalies: Dict) -> bool:
        """Determine if additional MFA is required based on risk"""
        if risk_score >= 70:
            return True
        
        if len(anomalies) >= 2:
            avg_confidence = sum(anomalies.values()) / len(anomalies)
            if avg_confidence >= 0.7:
                return True
        
        return False
    
    @staticmethod
    def should_require_admin_approval(risk_score: int) -> bool:
        """Determine if admin approval is required for this login"""
        return risk_score >= 85


class SessionSecurityManager:
    """Manage admin session security"""
    
    @staticmethod
    def generate_session_id() -> str:
        """Generate a cryptographically secure session ID"""
        return str(uuid.uuid4())
    
    @staticmethod
    def calculate_session_expiry(hours: int = 8) -> datetime:
        """Calculate session expiry time"""
        return datetime.utcnow() + timedelta(hours=hours)
    
    @staticmethod
    def is_session_valid(
        session_expires_at: datetime,
        session_revoked_at: Optional[datetime] = None,
        last_activity: Optional[datetime] = None,
        max_inactivity_minutes: int = 60
    ) -> tuple[bool, Optional[str]]:
        """
        Validate if a session is still active.
        Returns (is_valid, reason_if_invalid)
        """
        now = datetime.utcnow()
        
        # Check if explicitly revoked
        if session_revoked_at and session_revoked_at <= now:
            return False, "Session revoked"
        
        # Check expiry
        if session_expires_at <= now:
            return False, "Session expired"
        
        # Check inactivity
        if last_activity:
            inactivity_duration = now - last_activity
            max_inactivity = timedelta(minutes=max_inactivity_minutes)
            if inactivity_duration > max_inactivity:
                return False, "Session inactive"
        
        return True, None
    
    @staticmethod
    def calculate_remaining_time(expires_at: datetime) -> int:
        """Calculate remaining session time in seconds"""
        remaining = expires_at - datetime.utcnow()
        return max(0, int(remaining.total_seconds()))


class DeviceTrustPolicy:
    """Define and enforce device trust policies"""
    
    # Trust levels
    TRUST_LEVELS = {
        "untrusted": 0,
        "low": 1,
        "medium": 2,
        "high": 3,
    }
    
    @staticmethod
    def calculate_trust_level(
        device_age_days: int,
        usage_frequency: int,
        risk_events: int,
        mfa_verified_logins: int
    ) -> str:
        """
        Calculate device trust level based on usage patterns.
        Older, frequently used devices with few risk events = higher trust.
        """
        score = 0
        
        # Age factor: devices older than 30 days get max points
        score += min(device_age_days // 10, 25)
        
        # Usage factor: more usage = higher trust (max 25 points)
        score += min(usage_frequency * 5, 25)
        
        # Risk factor: penalize for risk events
        score -= risk_events * 10
        
        # MFA factor: verified logins increase trust
        score += min(mfa_verified_logins * 2, 25)
        
        # Normalize to 0-100
        score = max(0, min(100, score))
        
        if score >= 75:
            return "high"
        elif score >= 50:
            return "medium"
        elif score >= 25:
            return "low"
        else:
            return "untrusted"
    
    @staticmethod
    def should_allow_passwordless_login(trust_level: str, is_admin: bool) -> bool:
        """Determine if passwordless login should be allowed"""
        if not is_admin:
            return False
        
        # Only high-trust devices can use passwordless login
        return trust_level == "high"
    
    @staticmethod
    def get_minimum_mfa_requirement(trust_level: str, is_sensitive_operation: bool) -> str:
        """
        Get minimum MFA required.
        Returns: "none", "totp", "webauthn", "multiple"
        """
        if is_sensitive_operation:
            if trust_level in ["untrusted", "low"]:
                return "multiple"  # Require multiple MFA methods
            elif trust_level == "medium":
                return "webauthn"  # Require passwordless
            else:
                return "totp"  # Single MFA sufficient
        
        if trust_level in ["untrusted", "low"]:
            return "totp"
        elif trust_level == "medium":
            return "totp"
        else:
            return "none"  # High-trust devices might skip MFA for regular operations
