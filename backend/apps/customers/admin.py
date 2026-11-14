from django.contrib import admin
from apps.customers.models import Customer, RiskProfile

admin.site.register(Customer)
admin.site.register(RiskProfile)
