"""Application-level middleware for FinPilot."""

import logging
import uuid

logger = logging.getLogger(__name__)


class RequestIDMiddleware:
    """Accepts X-Request-ID from client or generates a fresh UUID; adds it to every log line and response."""

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        """Processes the request, attaches request_id to request and response."""

        request_id = request.headers.get("X-Request-ID") or str(uuid.uuid4())
        request.request_id = request_id
        response = self.get_response(request)
        response["X-Request-ID"] = request_id
        return response
