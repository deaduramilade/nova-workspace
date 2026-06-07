from datetime import datetime, timedelta
from app.core.config import settings

# Placeholder for 7-day deletion logic
def should_delete_record(created_at: datetime) -> bool:
    """Check if record exceeds 7-day retention period"""
    retention_period = timedelta(days=settings.DATA_RETENTION_DAYS)
    return datetime.utcnow() - created_at > retention_period