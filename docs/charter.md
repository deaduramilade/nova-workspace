# Nova Project Charter

**Version**: 4.0  
**Phase**: Production Ready (Enterprise Security & Zero-Trust Authentication)  
**Date**: June 23, 2026  
**Repository**: https://github.com/deaduramilade/nova-workspace  
**License**: Apache-2.0

----

## 1. Project Overview & Vision

**Nova** is an open-source AI-native collaborative browser workspace. It combines Docker container isolation, high-performance WebRTC streaming (Neko), and native AI agents powered by local LLMs.

**Core Idea**: Turn any self-hosted or cloud server into a persistent, multi-user, browser-based workspace where multiple humans and AI agents can simultaneously edit code, design UIs, run applications, and collaborate in real-time inside isolated Docker environments.

Nova delivers a unified experience comparable to “Google Docs + VS Code + Cursor + Figma + Zoom”, but fully private, containerized, and AI-first.

**Current Status (June 2026)**: Nova has matured into a production-ready enterprise platform featuring:
- Advanced **Role-Based Access Control (RBAC)** with granular governance
- **Multi-Factor Authentication (TOTP)** with enhanced Zero-Trust capabilities
- **Device-Based Zero-Trust Authentication** with automatic risk assessment
- Comprehensive audit logging and anomaly detection
- Automated **Meeting Intelligence** with transcription and reporting
- Optimized for cost-effective hosting on entry-level cloud infrastructure (Oracle Cloud Always Free Tier)

---

## 2. Key Capabilities

### Workspace & Collaboration

### Core Collaboration Features
- Real-time collaborative browser sessions via WebRTC (Neko)
- Working hours tracker with supervisor visibility and HR reporting
- Breakout rooms for focused team discussions
- Break timer with binaural audio support
- Light team game module for productive breaks
- Personal Profile Settings (PFP upload + LinkedIn, X, Discord linking)
- Mobile View Indicator for users on mobile devices

### Storage & Data Management
- **Workspace-Scoped Storage**: Isolated file libraries per workspace/organization.
- **Authenticated Uploads/Downloads**: Secure file handling with unguessable internal filenames and owner tracking.

### Role-Based Access Control (RBAC)
- Five defined roles: **Worker**, **Supervisor**, **HR Personnel**, **Administrator**, and **AI Agent**
- Role change request system with Administrator approval workflow
- Audit logging for all role changes
- Role-based API route guards and middleware
- Pydantic validation for role enums

### Security & Authentication
- JWT authentication with embedded role claims
- Google Authenticator (TOTP) support for login
- MFA enforcement for sensitive administrative actions (role approvals)
- Failed access protection with forced data deletion
- AES-256-GCM encryption for sensitive data

### Advanced MFA & Device Security (Zero-Trust Architecture)
- **Device Fingerprinting**: Automatic recognition of devices via browser/OS characteristics
- **Adaptive MFA**: Risk-based authentication that adjusts requirements based on threat level
- **Real-time Risk Scoring**: Calculates login risk (0-100) based on device trust, location, time, and usage patterns
- **Trusted Device Management**: Users can mark devices as trusted for streamlined multi-daily logins
- **Anomaly Detection**: Automatic detection of unusual login patterns (time, location, device, IP changes)
- **Per-Device Sessions**: Independent session tracking for each device with granular revocation
- **Device Trust Lifecycle**: Auto-registration → Risk assessment → User approval → Trust level increases with usage
- **Immediate Device Revocation**: Block compromised devices with single action, instant session termination
- **Admin Device Controls**: System administrators can approve, block, or monitor devices across all users
- **Login Audit Trail**: Complete logging of all authentication attempts (success/failure/reason) with device fingerprint tracking

### Meeting & Documentation Intelligence
- Meeting recording initiation
- AI-generated meeting transcripts
- Automated executive meeting report generation
- Automated dissemination of reports via email and workspace group chat to absent participants

### Real-time & Notification Systems
- WebSocket real-time updates for role requests and approvals
- Async email notifications for role change approvals and rejections
- In-app notification system

### Offline & Resource Efficiency
- Offline-first architecture with CRDT synchronization
- Optimized for low-memory and low-data environments
- Production-tuned profiles for **Oracle Cloud Always Free Tier** (~1.6 GB RAM budget for core containers).

---

## 3. Roles and Responsibilities

| Role                    | Access Level   | Primary Responsibilities                              | AI Assistant      |
|-------------------------|----------------|-------------------------------------------------------|-------------------|
| **Worker**              | Standard       | Daily collaboration and task execution                | Nova Worker       |
| **Supervisor**          | Elevated       | Team oversight, monitoring, and feedback              | Nova Supervisor   |
| **HR Personnel**        | Elevated       | Work log management, attendance, and reporting        | Nova HR           |
| **Administrator**       | Highest        | User management, role governance, and system config   | Nova Admin        |
| **AI Agent**            | Participant    | Collaborative task execution within workspaces        | —                 |

Each role has access to a dedicated, context-aware AI assistant triggered by typing **“Nova”** in the workspace chat.

---

## 4. Design & Architecture

- **Frontend**: Next.js 15 + TypeScript + Tailwind CSS with subtle Glassmorphism
- **Backend**: Python 3.12 + FastAPI + SQLAlchemy 2.0 + Alembic
- **Streaming**: Neko WebRTC
- **Database**: PostgreSQL + Redis (with optimized indexing for device queries)
- **Authentication**: JWT + TOTP (Google Authenticator) + Zero-Trust Device Verification
- **Device Management**: Device fingerprinting, risk scoring, trust level calculation
- **Real-time**: WebSocket + custom CRDT engine for background delta sync
- **Audit System**: Comprehensive logging of authentication, device, and session events
- **Deployment**: Docker Compose (with Oracle Cloud Always Free profile)

---

## 5. Security, Privacy, Compliance, and Governance

Nova is built for enterprise-grade privacy and global compliance standards (GDPR, CCPA, ISO 27001).

### 5.1 Security Framework
- **Data Retention**: 7-day automatic silent deletion for ephemeral data
- **Encryption**: AES-256-GCM with Argon2 key derivation
- **Access Control**: RBAC + Attribute-Based Access Control (ABAC) for fine-grained file/workspace permissions
- **Authentication**: JWT with role claims + optional TOTP 2FA + Zero-Trust device verification
- **MFA Enforcement**: Required for high-privilege actions (role approvals)
- **Zero-Trust Model**: Continuous device verification with risk-adaptive authentication
- **Risk Assessment**: Real-time risk scoring (0-100) with anomaly detection
  - Factors: Device trust level, usage history, login location, time of day, failed attempts, IP changes
  - Low Risk (0-30): Password only for trusted devices
  - Medium Risk (31-50): TOTP MFA required
  - High Risk (51-80): Additional email OTP verification
  - Critical Risk (81-100): Admin approval required
- **Device Management**: Complete device lifecycle management with user trust controls and admin oversight
- **Session Security**: Per-device session tracking with immediate revocation capabilities
- **Behavioral Analytics**: Detects unusual patterns (unusual times, new devices, location changes, rapid IP changes)
- **Rate Limiting**: 10 login attempts per minute per IP to prevent brute force attacks

### 5.2 Privacy & Compliance
- Designed for GDPR, CCPA/CPRA, ISO 27001/27701, and SOC 2 alignment
- Zero-Trust principles with continuous verification
- Automated Privacy Impact Assessments ready

### 5.3 Governance
- Role change requests require explicit Administrator approval
- All role changes are logged in the Audit Log
- Strong separation between testing role switches and permanent changes

---

## 6. Implemented Features

### Core Features
- **Advanced RBAC**: Full role lifecycle management (request -> OTP verification -> approval -> audit log).
- **Supervisor Oversight**: Live monitoring of team status, location, and real-time feedback tools.
- **HR Ecosystem**: Dedicated workspace for work log analysis, salary reporting, and attendance anomaly detection.
- **Meeting Intelligence**: One-click recording, transcription, and executive summary distribution to absent members via Email/WS.
- **Productivity Suite**: Binaural break timer, breakout rooms, and Memory Match team games.
- **Secure File Management**: Organization-level storage isolation with workspace-specific access guards.
- **System Resilience**: Automated secret generation (`init-env.sh`), one-click restarts, and TLS automation.

### Zero-Trust Authentication & Device Management (New - v4.0)
- **Device Fingerprinting**: Automatic, stable device recognition across sessions
- **Multi-Daily Admin Logins**: Multiple logins per day from trusted devices with minimal MFA
- **Adaptive MFA**: Authentication requirements adjust based on real-time risk assessment
- **Device Trust Dashboard**: Users can view, manage, and revoke device access
- **Admin Device Management**: System-wide device monitoring and control
- **Real-time Risk Scoring**: Continuous risk calculation (0-100) with anomaly detection
- **Instant Device Revocation**: Block compromised devices immediately, terminate all sessions
- **Session Management**: View active sessions, revoke specific sessions or all sessions
- **Login Audit Trail**: Complete history of login attempts with device fingerprints
- **Anomaly Detection**: Automatic flagging of unusual login patterns and behavioral changes

---

## 7. Workflow

### Standard Workflow
1. **Authentication**: User logs in; if MFA is enabled, TOTP is verified.
2. **Contextual Workspace**: User enters a workspace. Their role (e.g., Worker) determines the features they see and the "Nova" persona they interact with.
3. **Collaboration**: Real-time browser streaming (Neko) allows joint coding/design.
4. **Meeting Documentation**: Supervisor starts a recording; upon completion, Nova generates a transcript and report, mailing it to stakeholders.
5. **Role Elevation**: A Worker requests Supervisor access; an Admin receives a real-time notification, verifies with TOTP, and approves. The change is logged to the Audit Log.
6. **System Maintenance**: Ephemeral data is purged every 7 days; local sensitive data is wiped after 5 failed login attempts.

### Zero-Trust Authentication Workflow (Admin Access)
1. **Device Registration**: Admin navigates to zero-trust login endpoint
2. **Device Fingerprinting**: System automatically captures device characteristics (browser, OS, IP, screen, language)
3. **Risk Assessment**: Backend calculates risk score (0-100) based on:
   - Device trust status (new vs. recognized)
   - Usage history (first-time vs. recurring device)
   - Login location (familiar vs. new)
   - Time of day (working hours vs. unusual times)
   - Failed login attempts (none vs. multiple)
   - IP reputation (stable vs. rapid changes)
4. **Adaptive MFA**:
   - Low Risk: Direct token issuance for trusted devices
   - Medium Risk: TOTP verification required
   - High Risk: Additional email OTP verification
   - Critical Risk: Holds for admin review and approval
5. **Session Creation**: Successful authentication creates per-device session with metadata
6. **Device Trust Management**: Admin can mark device as trusted from dashboard
7. **Session Management**: Admin can view active sessions, revoke individual sessions, or revoke all sessions
8. **Continuous Monitoring**: All login attempts logged with device fingerprints; anomalies flagged automatically
9. **Device Revocation**: If device is compromised, can be blocked instantly, terminating all active sessions

---

## 8. Strengths & Unique Value

- Strong **governance and accountability** through RBAC, audit logging, and approval workflows
- **Context-aware AI assistance** tailored to each user’s role
- Secure and automated **meeting documentation** with transcription and distribution
- **Zero-Trust Device Authentication** with adaptive MFA that enables multiple daily admin logins without friction
- **Real-time Risk Assessment** and anomaly detection for proactive security
- **Device Management** with granular control and instant revocation capabilities
- Privacy-first, self-hostable architecture
- Production-ready security (TOTP + Zero-Trust device verification + RBAC + Audit Logging)
- Designed for both enterprise compliance and agile team collaboration

---

## 9. Licensing, Updates, and Governance

- **License**: Apache-2.0 – Fully open core
- **Updates**: One-click Docker Compose upgrades supported
- **Governance**: Community contributions encouraged with CLA for significant changes

---

## 10. Target Users and Monetization

- **Primary Users**: Development teams, AI researchers, enterprises, educational institutions, and remote/hybrid teams
- **Growth Strategy**: Open core via GitHub, LinkedIn, Hugging Face, and X
- **Monetization**: Core remains free. Revenue from sponsorships, premium support, and enterprise tiers

---

## 11. Risks & Mitigations

- Loss of project coherence → This charter is used as the single source of truth
- Security & compliance risks → Addressed through RBAC, TOTP, audit logging, and layered controls
- Over-scoping → Strict focus on core collaboration, governance, and meeting intelligence

---

**This document serves as the single source of truth for the Nova Workspace project.**

This integrates the original vision with all implemented features, including advanced Role-Based Access Control, Two-Factor Authentication, meeting intelligence, and real-time governance capabilities.