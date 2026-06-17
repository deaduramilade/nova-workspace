from enum import Enum
from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, JSON, Enum as SQLEnum
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from app.core.database import Base


class AssignmentRuleType(str, Enum):
    """Types of assignment rules for action items."""
    ROLE_BASED = "role_based"  # Assign to users with specific role
    USER_SPECIFIC = "user_specific"  # Assign to specific user
    ROUND_ROBIN = "round_robin"  # Distribute among team members
    CUSTOM = "custom"  # Custom matching criteria


class WorkspaceAssignmentRule(Base):
    """
    Workspace-level assignment rules for auto-assigning action items.
    
    Allows supervisors to define default assignment strategies for extracted action items.
    Rules are checked during memory ingestion to auto-assign tasks.
    """
    __tablename__ = "workspace_assignment_rules"

    id = Column(Integer, primary_key=True, index=True)
    workspace_id = Column(Integer, ForeignKey("workspaces.id"), nullable=False, index=True)
    name = Column(String, nullable=False)  # User-friendly name
    rule_type = Column(SQLEnum(AssignmentRuleType), nullable=False, default=AssignmentRuleType.ROLE_BASED)
    
    # For ROLE_BASED: target role to assign to
    target_role = Column(String, nullable=True)
    
    # For USER_SPECIFIC: user_id to assign to
    target_user_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    
    # For ROUND_ROBIN: list of user IDs to rotate through
    # For CUSTOM: custom matching criteria
    criteria = Column(JSON, nullable=True, default={})
    
    # Priority for rule matching (higher = applied first)
    priority = Column(Integer, default=100)
    
    # Enable/disable this rule
    enabled = Column(Boolean, default=True)
    
    # Rule conditions (optional)
    # - keywords: Only apply if action item contains these keywords
    # - exclude_keywords: Skip if action item contains these words
    # - department: Only for certain departments
    conditions = Column(JSON, nullable=True, default={})
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relationships
    workspace = relationship("Workspace", backref="assignment_rules")
    target_user = relationship("User", foreign_keys=[target_user_id])
