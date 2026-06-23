from sqlalchemy import Column, Integer, String, Boolean, DateTime, Text, ForeignKey, JSON
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from app.core.database import Base


class DeviceFingerprint(Base):
    """Stores device fingerprints for zero-trust authentication"""
    __tablename__ = "device_fingerprints"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    device_id = Column(String, unique=True, nullable=False, index=True)
    fingerprint_hash = Column(String, nullable=False)  # SHA256 hash of device characteristics
    device_name = Column(String, nullable=True)  # User-friendly device name
    device_type = Column(String, nullable=False)  # laptop, phone, tablet, etc.
    browser = Column(String, nullable=True)  # Chrome, Firefox, Safari, etc.
    browser_version = Column(String, nullable=True)
    os = Column(String, nullable=True)  # Windows, macOS, Linux, iOS, Android
    os_version = Column(String, nullable=True)
    
    # Device characteristics
    user_agent = Column(Text, nullable=True)
    ip_address = Column(String, nullable=True)
    
    # Trust status
    is_trusted = Column(Boolean, default=False)  # Admin-approved trusted device
    trust_level = Column(String, default="untrusted")  # untrusted, low, medium, high
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)
    last_used = Column(DateTime(timezone=True), server_default=func.now())
    trusted_until = Column(DateTime(timezone=True), nullable=True)  # Trust expiry date
    
    # Metadata
    risk_score = Column(Integer, default=0)  # 0-100, calculated based on usage patterns
    blocked = Column(Boolean, default=False)
    block_reason = Column(String, nullable=True)
    
    user = relationship("User", back_populates="device_fingerprints")
    sessions = relationship("AdminSession", back_populates="device")


class TrustedDevice(Base):
    """Manages admin-trusted devices for multi-device zero-trust login"""
    __tablename__ = "trusted_devices"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    device_fingerprint_id = Column(Integer, ForeignKey("device_fingerprints.id", ondelete="CASCADE"), nullable=False)
    
    device_name = Column(String, nullable=False)  # "Work MacBook", "Personal iPhone", etc.
    icon = Column(String, nullable=True)  # emoji or icon name
    
    # Trust details
    is_active = Column(Boolean, default=True)
    trusted_at = Column(DateTime(timezone=True), server_default=func.now())
    last_used_at = Column(DateTime(timezone=True), nullable=True)
    expires_at = Column(DateTime(timezone=True), nullable=True)  # When trust expires
    
    # Trust reason and metadata
    trusted_reason = Column(String, nullable=True)  # "Approved via email", "Biometric verified", etc.
    location = Column(String, nullable=True)  # "San Francisco, CA"
    
    # Permissions
    can_access_sensitive_endpoints = Column(Boolean, default=False)
    allow_passwordless_login = Column(Boolean, default=False)
    
    user = relationship("User", back_populates="trusted_devices")
    device_fingerprint = relationship("DeviceFingerprint")
    
    # Tracking
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())


class AdminSession(Base):
    """Tracks admin sessions for audit and zero-trust enforcement"""
    __tablename__ = "admin_sessions"

    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(String, unique=True, nullable=False, index=True)  # UUID
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    device_id = Column(String, ForeignKey("device_fingerprints.device_id"), nullable=False)
    
    # Session metadata
    ip_address = Column(String, nullable=False)
    user_agent = Column(Text, nullable=True)
    location = Column(String, nullable=True)  # Geolocation if available
    
    # Authentication method
    auth_method = Column(String, nullable=False)  # password_totp, webauthn, trusted_device, etc.
    mfa_verified = Column(Boolean, default=False)
    
    # Session lifetime
    created_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)
    expires_at = Column(DateTime(timezone=True), nullable=False, index=True)
    last_activity = Column(DateTime(timezone=True), server_default=func.now())
    revoked_at = Column(DateTime(timezone=True), nullable=True)
    revoke_reason = Column(String, nullable=True)
    
    # Risk assessment
    risk_score = Column(Integer, default=0)
    anomalies_detected = Column(JSON, default={})  # {"type": "unusual_time", "confidence": 0.85}
    
    # Permissions and scope
    scope = Column(String, default="admin")  # admin, hr, supervisor, etc.
    can_approve_role_changes = Column(Boolean, default=False)
    
    user = relationship("User", back_populates="admin_sessions")
    device = relationship("DeviceFingerprint", back_populates="sessions")
    
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())


class LoginAttempt(Base):
    """Audit trail for all login attempts (success and failure)"""
    __tablename__ = "login_attempts"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    
    success = Column(Boolean, default=False, index=True)
    reason = Column(String, nullable=True)  # "invalid_password", "mfa_failed", "device_blocked", etc.
    
    # Request context
    ip_address = Column(String, nullable=False, index=True)
    user_agent = Column(Text, nullable=True)
    device_fingerprint = Column(String, nullable=True)
    
    # Authentication method used
    mfa_method = Column(String, nullable=True)  # totp, email_otp, webauthn, etc.
    mfa_verified = Column(Boolean, default=False)
    
    # Metadata
    location = Column(String, nullable=True)
    risk_score = Column(Integer, default=0)
    anomalies = Column(JSON, nullable=True)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)
