"""Serializers for investments (accounts, transactions, positions)."""

from rest_framework import serializers

from apps.investments.models import Transaction


class TransactionListSerializer(serializers.ModelSerializer):
    account_code = serializers.CharField(source="account.account_code", read_only=True)
    instrument_code = serializers.CharField(source="instrument.instrument_code", read_only=True)
    instrument_symbol = serializers.CharField(source="instrument.symbol", read_only=True)
    instrument_name = serializers.CharField(source="instrument.instrument_name", read_only=True)

    class Meta:
        model = Transaction
        fields = [
            "id",
            "uuid",
            "transaction_code",
            "account_code",
            "instrument_code",
            "instrument_symbol",
            "instrument_name",
            "transaction_type",
            "trade_date",
            "quantity",
            "price",
            "amount",
            "status",
        ]
