from djchoices import ChoiceItem, DjangoChoices


class UserTypeChoices(DjangoChoices):
    """Choices for user types to access the platform."""

    admin = ChoiceItem("ADMIN", "Admin")
    viewer = ChoiceItem("VIEWER", "Viewer")
