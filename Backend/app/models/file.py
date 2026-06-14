from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, BigInteger
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from app.core.database import Base


class UploadedFile(Base):
    __tablename__ = "uploaded_files"

    # Use the safe stored filename (uuid_...) as the stable id for lookup/serving
    id = Column(String, primary_key=True, index=True)  # stored_filename

    workspace_id = Column(Integer, ForeignKey("workspaces.id"), nullable=True, index=True)
    uploader_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)

    original_filename = Column(String, nullable=False)
    stored_filename = Column(String, nullable=False, unique=True)
    content_type = Column(String, nullable=False, default="application/octet-stream")
    size = Column(BigInteger, nullable=False, default=0)

    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relationships (optional, for future joins)
    workspace = relationship("Workspace", backref="uploaded_files")
    uploader = relationship("User", backref="uploaded_files")
