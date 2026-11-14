"""Settings package. Load the correct module based on the ENVIRONMENT env var."""

from pathlib import Path

import environ

# Build paths inside the project like this: APPS_DIR / "subdir"
BASE_DIR = Path(__file__).resolve().parent.parent.parent
APPS_DIR = BASE_DIR / "apps"

env = environ.Env()
# Read .env from project root if it exists
environ.Env.read_env(str(BASE_DIR / ".env"), overwrite=False)

ENVIRONMENT = env.str("ENVIRONMENT", default="local")
