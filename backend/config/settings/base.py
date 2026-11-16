# ruff: noqa: E501
"""Base settings to build other settings files upon."""

from datetime import timedelta

from config.settings import APPS_DIR, env

# GENERAL
# ------------------------------------------------------------------------------
SECRET_KEY = env("DJANGO_SECRET_KEY")
JWT_SIGNING_SECRET_KEY = env.str("JWT_SIGNING_SECRET_KEY")

# TimeZone & Localization
# ------------------------------------------------------------------------------
LANGUAGE_CODE = "en-us"
TIME_ZONE = "UTC"
SITE_ID = 1
USE_TZ = True

# Business settings
# ------------------------------------------------------------------------------
BUSINESS_TIME_ZONE = env.str("BUSINESS_TIME_ZONE", default="Asia/Kolkata")
STALE_DATA_DAYS = env.int("STALE_DATA_DAYS", default=7)
IMPORT_MAX_FILE_MB = env.int("IMPORT_MAX_FILE_MB", default=10)
IMPORT_MAX_ROWS = env.int("IMPORT_MAX_ROWS", default=50000)
IMPORT_AMOUNT_TOLERANCE = env.str("IMPORT_AMOUNT_TOLERANCE", default="1.00")
AUTO_SEED = env.bool("AUTO_SEED", default=False)
DEMO_VIEWER_EMAIL = env.str("DEMO_VIEWER_EMAIL", default="viewer@finpilot.local")
DEMO_VIEWER_PASSWORD = env.str("DEMO_VIEWER_PASSWORD", default="viewer-pass-123")

# JWT settings
# ------------------------------------------------------------------------------
JWT_ACCESS_MINUTES = env.int("JWT_ACCESS_MINUTES", default=15)
JWT_REFRESH_DAYS = env.int("JWT_REFRESH_DAYS", default=7)
COOKIE_SECURE = env.bool("COOKIE_SECURE", default=False)
COOKIE_SAMESITE = env.str("COOKIE_SAMESITE", default="Lax")

SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(minutes=JWT_ACCESS_MINUTES),
    "REFRESH_TOKEN_LIFETIME": timedelta(days=JWT_REFRESH_DAYS),
    "ROTATE_REFRESH_TOKENS": True,
    "BLACKLIST_AFTER_ROTATION": True,
    "UPDATE_LAST_LOGIN": True,
    "ALGORITHM": "HS256",
    "SIGNING_KEY": JWT_SIGNING_SECRET_KEY,
    "AUTH_HEADER_TYPES": ("Bearer",),
    "USER_ID_FIELD": "id",
    "USER_ID_CLAIM": "user_id",
}

# DATABASES
# ------------------------------------------------------------------------------
DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.postgresql",
        "NAME": env.str("POSTGRES_DB"),
        "USER": env.str("POSTGRES_USER"),
        "PASSWORD": env.str("POSTGRES_PASSWORD"),
        "HOST": env.str("POSTGRES_HOST"),
        "PORT": env.str("POSTGRES_PORT"),
        "ATOMIC_REQUESTS": True,
        "CONN_MAX_AGE": env.int("CONN_MAX_AGE", default=60),
        "CONN_HEALTH_CHECKS": True,
    },
}
DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

# URLS
# ------------------------------------------------------------------------------
ROOT_URLCONF = "config.urls"
WSGI_APPLICATION = "config.wsgi.application"
APPEND_SLASH = True

# APPS
# ------------------------------------------------------------------------------
DJANGO_APPS = [
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.sites",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "django.contrib.admin",
    "django.contrib.postgres",
]
THIRD_PARTY_APPS = [
    "django_extensions",
    "rest_framework",
    "rest_framework_simplejwt",
    "rest_framework_simplejwt.token_blacklist",
    "corsheaders",
    "drf_spectacular",
    "phonenumber_field",
    "django_filters",
    "django_celery_results",
]
CUSTOM_APPS = [
    "apps.common",
    "apps.access",
    "apps.customers",
    "apps.investments",
    "apps.goals",
    "apps.imports",
    "apps.reports",
]
INSTALLED_APPS = DJANGO_APPS + THIRD_PARTY_APPS + CUSTOM_APPS

# AUTHENTICATION
# ------------------------------------------------------------------------------
AUTHENTICATION_BACKENDS = [
    "django.contrib.auth.backends.ModelBackend",
]
AUTH_USER_MODEL = "access.User"

# PASSWORDS
# ------------------------------------------------------------------------------
PASSWORD_HASHERS = [
    "django.contrib.auth.hashers.PBKDF2PasswordHasher",
    "django.contrib.auth.hashers.PBKDF2SHA1PasswordHasher",
    "django.contrib.auth.hashers.BCryptSHA256PasswordHasher",
    "django.contrib.auth.hashers.ScryptPasswordHasher",
]
AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator", "OPTIONS": {"min_length": 8}},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]

# MIDDLEWARE
# ------------------------------------------------------------------------------
MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "apps.common.middleware.RequestIDMiddleware",
    "corsheaders.middleware.CorsMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.locale.LocaleMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

# TEMPLATES
# ------------------------------------------------------------------------------
TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [str(APPS_DIR / "templates")],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.debug",
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.template.context_processors.i18n",
                "django.template.context_processors.media",
                "django.template.context_processors.static",
                "django.template.context_processors.tz",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

# STATIC FILES
# ------------------------------------------------------------------------------
STATIC_URL = "/static/"
STATIC_ROOT = str(APPS_DIR / "staticfiles")

# MEDIA FILES
# ------------------------------------------------------------------------------
MEDIA_URL = "/media/"
MEDIA_ROOT = str(APPS_DIR / "media")

# SECURITY
# ------------------------------------------------------------------------------
SESSION_COOKIE_HTTPONLY = True
CSRF_COOKIE_HTTPONLY = True
X_FRAME_OPTIONS = "DENY"

# ADMIN
# ------------------------------------------------------------------------------
ADMIN_URL = env.str("DJANGO_ADMIN_URL", default="django-admin/")

# LOGGING — JSON to stdout
# ------------------------------------------------------------------------------
LOG_LEVEL = env.str("LOG_LEVEL", default="INFO")
LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "formatters": {
        "json": {
            "()": "pythonjsonlogger.jsonlogger.JsonFormatter",
            "format": "%(asctime)s %(levelname)s %(name)s %(message)s",
        },
    },
    "handlers": {
        "console": {
            "class": "logging.StreamHandler",
            "formatter": "json",
        },
    },
    "root": {"level": LOG_LEVEL, "handlers": ["console"]},
}

# CACHE — LocMemCache
# ------------------------------------------------------------------------------
CACHES = {
    "default": {
        "BACKEND": "django.core.cache.backends.locmem.LocMemCache",
    }
}

# CORS
# ------------------------------------------------------------------------------
CORS_ALLOW_CREDENTIALS = env.bool("CORS_ALLOW_CREDENTIALS", default=True)
CORS_ALLOWED_ORIGINS = env.list("CORS_ALLOWED_ORIGINS", default=["http://localhost:5173", "http://localhost:8080"])

# django-rest-framework
# ------------------------------------------------------------------------------
REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": ("rest_framework_simplejwt.authentication.JWTAuthentication",),
    "DEFAULT_PERMISSION_CLASSES": ("apps.common.permissions.IsViewerOrAdmin",),
    "DEFAULT_PARSER_CLASSES": [
        "rest_framework.parsers.JSONParser",
        "rest_framework.parsers.FormParser",
        "rest_framework.parsers.MultiPartParser",
    ],
    "DEFAULT_RENDERER_CLASSES": [
        "rest_framework.renderers.JSONRenderer",
        "rest_framework.renderers.BrowsableAPIRenderer",
    ],
    "DEFAULT_SCHEMA_CLASS": "drf_spectacular.openapi.AutoSchema",
    "DEFAULT_PAGINATION_CLASS": "apps.common.pagination.AppPagination",
    "PAGE_SIZE": 24,
    "COERCE_DECIMAL_TO_STRING": True,
    "DEFAULT_THROTTLE_CLASSES": [
        "rest_framework.throttling.AnonRateThrottle",
        "rest_framework.throttling.UserRateThrottle",
        "rest_framework.throttling.ScopedRateThrottle",
    ],
    "DEFAULT_THROTTLE_RATES": {
        "anon": "60/min",
        "user": "600/min",
        "login": "10/min",
        "import": "5/hour",
    },
}

# drf-spectacular
# ------------------------------------------------------------------------------
SPECTACULAR_SETTINGS = {
    "TITLE": "FinPilot API",
    "DESCRIPTION": "Internal Investment Portfolio & Goal Monitoring API",
    "VERSION": "1.0.0",
    "SERVE_PERMISSIONS": ["rest_framework.permissions.AllowAny"],
    "SCHEMA_PATH_PREFIX": "/api/v1/",
}

# Celery
# ------------------------------------------------------------------------------
REDIS_URL = env.str("REDIS_URL", default="redis://127.0.0.1:6379/0")
CELERY_BROKER_URL = env.str("CELERY_BROKER_URL", default=REDIS_URL)
CELERY_RESULT_BACKEND = "django-db"
CELERY_TIMEZONE = TIME_ZONE
CELERY_ACCEPT_CONTENT = ["json"]
CELERY_TASK_SERIALIZER = "json"
CELERY_RESULT_SERIALIZER = "json"
CELERY_TASK_ALWAYS_EAGER = env.bool("CELERY_TASK_ALWAYS_EAGER", default=False)
CELERY_TASK_EAGER_PROPAGATES = True

# SuperAdmin Credentials
# ------------------------------------------------------------------------------
SUPER_ADMIN_EMAIL = env.str("SUPER_ADMIN_EMAIL")
SUPER_ADMIN_NAME = env.str("SUPER_ADMIN_NAME")
SUPER_ADMIN_PASSWORD = env.str("SUPER_ADMIN_PASSWORD")
