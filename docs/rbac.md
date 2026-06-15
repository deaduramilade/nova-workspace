# Role-Based Access Control (RBAC)

**Project**: Nova Workspace  
**Version**: 2.3  
**Last Updated**: June 15, 2026  
**Status**: Active

---

## 1. Overview

Nova Workspace implements a **Role-Based Access Control (RBAC)** system to ensure secure, organized, and efficient collaboration. Each role has clearly defined permissions, features, and access levels.

This document serves as the single source of truth for user roles, their responsibilities, and the AI assistance available to them.

---

## 2. Roles Overview

| Role                    | Access Level   | Primary Responsibility                     | AI Assistant       |
|-------------------------|----------------|--------------------------------------------|--------------------|
| Team Member / Worker    | Standard       | Daily work and collaboration               | Nova Worker        |
| Supervisor / Manager    | Elevated       | Team oversight and performance management  | Nova Supervisor    |
| HR Personnel            | Elevated       | Work log management and reporting          | Nova HR            |
| Administrator           | Highest        | Platform and user management               | Nova Admin         |
| AI Agent                | Participant    | Collaborative task execution               | N/A                |

---

## 3. Detailed Role Definitions

### 3.1 Team Member / Worker

**Description**:  
Core users who actively participate in workspaces to complete tasks and collaborate with others.

**Permissions**:
- Create and join workspaces
- Edit content and participate in real-time sessions
- Use breakout rooms, break timer, and team games
- View and track their personal working hours
- Manage their own Profile Settings (including PFP and social links)
- Invite AI agents into their personal workspace

**Key Features**:
- Personal Dashboard
- Working Hours Tracker
- Break Timer with Binaural Audio
- Profile Settings Page
- Mobile View Indicator

**AI Assistant**: **Nova Worker**  
Users can type **“Nova”** in the workspace chat to receive contextual help such as task suggestions, code assistance, summaries, or productivity advice.

---

### 3.2 Supervisor / Manager

**Description**:  
Team leads responsible for monitoring team performance and providing guidance.

**Permissions**:
- View real-time status of assigned team members
- Access the Supervisor Oversight Panel
- Send live feedback to team members
- View aggregated working hours of their team
- Monitor active workspaces (read-only access)

**Key Features**:
- Supervisor Oversight Dashboard
- Live User Status and Location
- Team Working Hours Overview
- Real-time Feedback Tools

**AI Assistant**: **Nova Supervisor**  
Accessible by typing **“Nova”** in the supervisor workspace. It assists with generating team reports, identifying productivity trends, and drafting constructive feedback.

---

### 3.3 HR Personnel

**Description**:  
Responsible for managing employee attendance, working hours, and generating organizational reports.

**Permissions**:
- Full access to the HR Workspace
- View all employees’ working hours and work logs
- Filter and analyze attendance data
- Generate and export reports
- View individual and team-level hour summaries

**Key Features**:
- Dedicated HR Workspace
- Employee Work Log Table
- Hours Summary Dashboard
- Report Export Functionality

**AI Assistant**: **Nova HR**  
Users can type **“Nova”** in the HR workspace to request insights such as:
- Employees with low working hours
- Weekly or monthly attendance summaries
- Anomaly detection in work patterns

---

### 3.4 Administrator

**Description**:  
Highest privilege role with complete control over the Nova Workspace platform.

**Permissions**:
- Create, edit, and deactivate user accounts
- Assign and modify user roles
- Access system-wide settings and configurations
- View all workspaces and activity across the platform
- Manage AI agent settings and availability
- Access platform analytics and audit logs

**Key Features** (Planned for Administrator Dashboard):
- User Management Interface
- Role Assignment and Management
- System Health Monitoring
- Audit Logs
- AI Agent Configuration Panel

**AI Assistant**: **Nova Admin**  
Accessible by typing **“Nova”**. It supports administrative tasks such as user queries, generating system reports, and providing recommendations for platform improvements.

---

### 3.5 AI Agent

**Description**:  
Autonomous AI participants that can be invited into workspaces to collaborate with human users.

**Permissions**:
- Participate in workspaces as first-class users
- Execute assigned tasks
- Collaborate in real-time with humans and other agents

**Note**: AI Agents do not have a personal dashboard. They operate within the workspaces they are invited to.

---

## 4. Role-Specific AI Assistants (“Nova”)

Each role is assigned a specialized version of the AI assistant called **Nova**. This ensures context-aware assistance tailored to the user’s responsibilities.

| Role                    | AI Assistant Name     | Specialization                              | Trigger Word |
|-------------------------|-----------------------|---------------------------------------------|--------------|
| Team Member / Worker    | Nova Worker           | Task help, code assistance, productivity    | “Nova”       |
| Supervisor / Manager    | Nova Supervisor       | Team insights, feedback, reporting          | “Nova”       |
| HR Personnel            | Nova HR               | Work log analysis and attendance insights   | “Nova”       |
| Administrator           | Nova Admin            | System management and platform analytics    | “Nova”       |

---

## 5. Implementation Notes

- Role checking should be enforced both on the frontend (UI visibility) and backend (API access).
- The “Nova” trigger word should be context-aware based on the user’s current role.
- Future versions may include fine-grained permissions within roles (e.g., “Can export reports” vs “Can only view reports”).

---

## 6. Future Enhancements

- Granular permission system within roles
- Custom role creation by Administrators
- Audit logging for all role-based actions
- Integration with external identity providers (SSO)

---

**This document is the authoritative reference for roles and access control in Nova Workspace.**