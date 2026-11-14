from django.contrib import admin
from apps.imports.models import ImportBatch, ImportRowError

admin.site.register(ImportBatch)
admin.site.register(ImportRowError)
