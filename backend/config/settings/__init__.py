# flake8: noqa
"""Settings package. Load the correct module based on the ENVIRONMENT env var."""
from pathlib import Path

import environ

# Base Directories
# ------------------------------------------------------------------------------
BASE_DIR = Path(__file__).resolve(strict=True).parent.parent.parent
APPS_DIR = BASE_DIR / "apps"

# Environment Helpers
# ------------------------------------------------------------------------------
env = environ.Env()
# Check backend/.env first, then root finpilot/.env
if (BASE_DIR / ".env").exists():
    env.read_env(str(BASE_DIR / ".env"))
elif (BASE_DIR.parent / ".env").exists():
    env.read_env(str(BASE_DIR.parent / ".env"))

ENVIRONMENT = env.str("ENVIRONMENT", default="development").lower()

if ENVIRONMENT in ("development", "local", "dev"):
    from .development import *
elif ENVIRONMENT in ("deployment", "production", "prod"):
    from .deployment import *
elif ENVIRONMENT in ("test", "testing"):
    from .test import *
else:
    raise NotImplementedError(
        f"Environment related settings not found! Please make sure settings/{ENVIRONMENT}.py is present."
    )
