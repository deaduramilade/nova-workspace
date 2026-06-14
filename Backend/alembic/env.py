"""
Alembic environment configuration for Nova Workspace backend.

Configures database migrations using SQLAlchemy 2.0 + Alembic against PostgreSQL.

Models are imported explicitly so that Base.metadata reflects the current schema
for autogenerate support (`alembic revision --autogenerate`).

Project direction and constraints: docs/charter.md (single source of truth).
"""

import sys
from logging.config import fileConfig
from pathlib import Path

from sqlalchemy import engine_from_config, pool

from alembic import context

# --- Ensure "import app..." works when Alembic is invoked ---
# Running from Backend/ (alembic.ini location) or inside the Docker /app image.
# Insert the directory containing the "app" package.
alembic_dir = Path(__file__).resolve().parent
backend_root = alembic_dir.parent
if str(backend_root) not in sys.path:
    sys.path.insert(0, str(backend_root))

# --- Application imports ---
# These must be imported before setting target_metadata so all tables are known.
from app.core.config import settings
from app.core.database import Base

# Current models (registered on Base.metadata)
from app.models.user import User  # noqa: F401
from app.models.workspace import Workspace  # noqa: F401
from app.models.file import UploadedFile  # noqa: F401

# Planned / future models (see backend-api-plan.md and charter AI agent support).
# Uncomment and add when the corresponding model files define tables:
# from app.models.session import Session  # noqa: F401
# from app.models.agent import Agent  # noqa: F401

# Alembic Config object
config = context.config

# Interpret the config file for Python logging
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# Target metadata for autogenerate and migration operations
target_metadata = Base.metadata

# Use the same DATABASE_URL as the running application (supports .env, prod secrets, etc.)
config.set_main_option("sqlalchemy.url", settings.DATABASE_URL)


def process_revision_directives(context, revision, directives):
    """Prevent generation of empty migration scripts.

    This keeps the versions/ directory clean during development and in CI.
    Only applies during `alembic revision --autogenerate`.
    """
    if getattr(config.cmd_opts, "autogenerate", False):
        script = directives[0]
        if script.upgrade_ops.is_empty():
            directives[:] = []
            print("No schema changes detected; no migration generated.")


def run_migrations_offline() -> None:
    """Run migrations in 'offline' mode.

    This configures the context with just a URL (no live Engine/connection).
    """
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        # Improved autogenerate accuracy (production polish)
        compare_type=True,
        compare_server_default=True,
        # Hook to suppress empty migrations
        process_revision_directives=process_revision_directives,
    )

    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    """Run migrations in 'online' mode.

    Creates an Engine and associates a connection with the migration context.
    Uses NullPool to avoid holding connections open during migrations.
    """
    connectable = engine_from_config(
        config.get_section(config.config_ini_section),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )

    with connectable.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
            # Improved autogenerate accuracy (production polish)
            compare_type=True,
            compare_server_default=True,
            # Hook to suppress empty migrations
            process_revision_directives=process_revision_directives,
        )

        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()