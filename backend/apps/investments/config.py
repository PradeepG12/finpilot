"""Choice enumerations for the investments app."""

from djchoices import ChoiceItem, DjangoChoices


class AccountTypeChoices(DjangoChoices):
    """Type of investment account."""

    brokerage = ChoiceItem("BROKERAGE", "Brokerage")
    mutual_fund = ChoiceItem("MUTUAL_FUND", "Mutual Fund")
    retirement = ChoiceItem("RETIREMENT", "Retirement")


class AccountStatusChoices(DjangoChoices):
    """Operational status of an account."""

    active = ChoiceItem("ACTIVE", "Active")
    dormant = ChoiceItem("DORMANT", "Dormant")
    closed = ChoiceItem("CLOSED", "Closed")


class AssetClassChoices(DjangoChoices):
    """Asset class of a financial instrument."""

    equity = ChoiceItem("EQUITY", "Equity")
    etf = ChoiceItem("ETF", "ETF")
    mutual_fund = ChoiceItem("MUTUAL_FUND", "Mutual Fund")
    bond = ChoiceItem("BOND", "Bond")
    reit = ChoiceItem("REIT", "REIT")
    gsec = ChoiceItem("GSEC", "G-Sec")


class ExchangeChoices(DjangoChoices):
    """Stock exchange where the instrument is listed."""

    nse = ChoiceItem("NSE", "NSE")
    bse = ChoiceItem("BSE", "BSE")
    otc = ChoiceItem("OTC", "OTC")


class RiskBandChoices(DjangoChoices):
    """Risk band for an instrument."""

    low = ChoiceItem("LOW", "Low")
    medium = ChoiceItem("MEDIUM", "Medium")
    high = ChoiceItem("HIGH", "High")


class TransactionTypeChoices(DjangoChoices):
    """Type of transaction."""

    buy = ChoiceItem("BUY", "Buy")
    sell = ChoiceItem("SELL", "Sell")
    dividend = ChoiceItem("DIVIDEND", "Dividend")
    fee = ChoiceItem("FEE", "Fee")


class TransactionStatusChoices(DjangoChoices):
    """Settlement status of a transaction."""

    settled = ChoiceItem("SETTLED", "Settled")
    pending = ChoiceItem("PENDING", "Pending")
    reversed = ChoiceItem("REVERSED", "Reversed")
