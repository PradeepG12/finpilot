from contextlib import suppress

from django.apps import apps
from django.contrib import admin


def register_all_models():
    """Function used to register all the models used."""

    models = apps.get_models()
    for model in models:
        with suppress(admin.sites.AlreadyRegistered):
            admin.site.register(model)


# Register all Models
register_all_models()
