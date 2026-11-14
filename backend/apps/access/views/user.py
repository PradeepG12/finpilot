"""User profile views."""

from apps.access.serializers.user import UserProfileSerializer
from apps.common.views import AppAPIView


class UserProfileAPIView(AppAPIView):
    """Returns the profile of the currently authenticated user."""

    def get(self, request, *args, **kwargs):
        """Returns the authenticated user's profile data."""

        user = self.get_authenticated_user()
        return self.send_response(UserProfileSerializer(user).data)
