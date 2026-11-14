from django.contrib import admin
from apps.investments.models import Account, Instrument, HoldingSnapshot, Transaction

admin.site.register(Account)
admin.site.register(Instrument)
admin.site.register(HoldingSnapshot)
admin.site.register(Transaction)
