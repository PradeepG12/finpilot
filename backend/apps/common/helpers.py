import datetime
import json
import math
import random
import secrets
import string
import time
import typing
from decimal import Decimal
from math import acos, cos, radians, sin

import pytz
from dateutil import tz
from django.conf import settings
from django.db.models import F, FloatField, Value
from django.db.models.expressions import ExpressionWrapper
from django.db.models.functions import ACos, Cos, Greatest, Least, Radians, Sin
from django.utils import timezone
from django_filters import rest_framework as filters
from requests import request

EARTH_RADIUS_IN_METERS = 6371000


def create_log(data: typing.Any, category: str):
    """
    A centralized function to create the app logs. Just in case some
    extra pre-processing are to be added in the future.
    """

    # assert data and category, "The passed parameters cannot be None while creating log."
    # apps.get_model("common.Log").objects.create(data=data, category=category)

    if settings.DEBUG:
        print("Log: ", data, category)


def get_display_name_for_slug(slug: str):
    """
    For a given string slug this generates the display name for the given slug.
    This generated display name will be displayed on the front end.
    """

    try:
        return slug.replace("_", " ").title()
    except Exception:
        return slug


def flatten(value):
    return [item for sublist in value for item in sublist]


def random_n_digits(n):
    """Returns a random number with `n` length."""

    range_start = 10 ** (n - 1)
    range_end = (10**n) - 1
    return str(random.randint(range_start, range_end))


def random_n_token(n=10):
    """Generate a random string with numbers and characters with `n` length."""

    allowed_characters = (
        string.ascii_letters + string.digits + string.ascii_uppercase + string.ascii_lowercase
    )  # contains char and digits
    return "".join(secrets.choice(allowed_characters) for _ in range(n))


def make_http_request(url: str, method="GET", headers={}, data={}, params={}, auth=None, **kwargs):  # noqa
    """
    Function that makes a third party http request to any given url based on the passed params.
    This is similar to triggerSimpleAjax/Axios function. This is defined here just to make things DRY.
    """

    request_kwargs = {
        "method": method,
        "url": url,
        "headers": headers,
        "params": params,
        "auth": auth,
        **kwargs,
    }
    if method.upper() != "GET":
        request_kwargs["data"] = stringify(data)
    response = request(**request_kwargs)

    try:
        response_data = response.json()
    except json.decoder.JSONDecodeError:
        response_data = None

    _output = {
        "data": response_data,
        "status_code": response.status_code,
        "reason": None if response_data else response.text,  # fallback for the data
    }

    # logging action
    log = {
        "request_data": data,
        "params": params,
        "headers": headers,
        "method": method,
        "response_data": _output,
    }
    # log_outbound_message(stringify(log), url, "make_http_request")

    if settings.DEBUG:
        print(log)  # noqa

    return _output


def stringify(data, fallback=None):
    """Stringify a given data."""

    try:
        return json.dumps(data)
    except:  # noqa
        return fallback


def convert_utc_to_local_timezone(
    input_datetime: datetime.date | datetime.datetime,
    inbound_request,
):
    """
    Given a UTC datetime or date object, this will convert it to the
    user's local timezone based on the request.
    """

    from_zone = tz.gettz(settings.TIME_ZONE)

    # TODO: from `inbound_request`
    to_zone = tz.gettz("Asia/Kolkata")

    input_datetime = input_datetime.replace(tzinfo=from_zone)

    return input_datetime.astimezone(to_zone)


def is_any_or_list1_in_list2(list1: list, list2: list):
    """Given two lists, this will check if any element of list1 is in list2."""

    return any(v in list2 for v in list1)


def get_first_of(*args):
    """For _ in args, returns the first value whose value is valid."""

    for _ in args:
        if _:
            return _

    return None


def get_file_field_url(instance, field="image"):
    """Given any instance and a linked File or Image field, returns the url."""

    if getattr(instance, field, None):
        return getattr(instance, field).file.url

    return None


def pause_thread(seconds):
    """Pause the tread for the given seconds."""

    time.sleep(seconds)


def unpack_dj_choices(choices):
    """Return value and corresponding label for that choice."""

    return [{"id": key, "identity": str(value)} for key, value in choices]


def storage_file_path(instance, filename):
    """upload file in S3 on related path"""

    return f"{instance.__class__.__name__}/{filename}".lower()


def get_instance_data(instance):
    """Returns the instance data as a dictionary with field_name as key and field_value as value."""

    from django.db import models

    from apps.common.model_fields import AppPhoneNumberField

    initial = {
        field_name: getattr(instance, field_name, None)
        for field_name in ["id", "uuid", *instance.get_model_field_names()]
    }

    # simplify for FE
    for k, v in initial.items():
        # foreignkey
        if hasattr(v, "pk"):
            initial[k] = v.pk

        # not a model field
        if not instance.__class__.get_model_field(k, None):
            continue

        # many-to-many
        if instance.__class__.get_model_field(k).many_to_many:
            initial[k] = getattr(instance, k).values_list("pk", flat=True)

        if instance.__class__.get_model_field(k).__class__ == AppPhoneNumberField:
            initial[k] = getattr(instance, k).raw_input if getattr(instance, k) else None

        if instance.__class__.get_model_field(k).__class__ in [
            models.DateTimeField,
            models.DateField,
            models.TimeField,
            models.UUIDField,
        ]:
            initial[k] = str(getattr(instance, k))

    return initial


def convert_date_string_to_date(date_string):
    """Converts a date string in format 'YYYY-MM-DD' to date obj."""

    return datetime.datetime.strptime(date_string, "%Y-%m-%d").date()


def convert_datetime_string_to_date(date_string):
    """Converts a date string with time in format 'YYYY-MM-DDTHH:MM 00:00' to date obj."""

    date_string = date_string.split(" ")[0].split("+")[0]
    return datetime.datetime.strptime(date_string, "%Y-%m-%dT%H:%M").date()


class CommonCreatedRangeFilters(filters.FilterSet):
    """Common filter class for created field range filter"""

    created = filters.DateTimeFromToRangeFilter(field_name="created")

    class Meta:
        fields = ["created"]


def get_utc_timezone():
    """Returns UTC timezone object."""

    return timezone.now().astimezone(pytz.utc)


def get_month_boundary_date(is_start: bool, reference_date=None):
    """
    Returns the first date of the month when `is_start` is True, otherwise the last
    date of the month. The month is taken from `reference_date`, defaulting to today.
    """

    reference_date = reference_date or timezone.now().date()
    if is_start:
        return reference_date.replace(day=1)
    next_month = reference_date.replace(day=28) + datetime.timedelta(days=4)
    return next_month.replace(day=1) - datetime.timedelta(days=1)


def get_trimmed_decimal(amount):
    """Rounds amount to 2 decimals and strips trailing zeros."""

    normalized = Decimal(amount).quantize(Decimal("0.01")).normalize()
    if normalized.as_tuple().exponent > 0:
        normalized = normalized.quantize(Decimal("1"))
    return normalized


def round_up_custom(n):
    """Round up a number to the nearest 10, 100, or 1000 based on its size."""

    if n == 0:
        return 0
    try:
        if n < 1000:
            base = 10
        else:
            base = 100
        return math.ceil(n / base) * base
    except Exception:
        return n


def get_distance_in_meters_expression(
    source_latitude, source_longitude, dest_latitude_field="latitude", dest_longitude_field="longitude"
):
    """
    Return a reusable ORM expression for calculating the distance
    between two coordinates using the Haversine formula.

    Formula:
        distance = R * acos(cos(lat1) * cos(lat2) * cos(lon2 - lon1) + sin(lat1) * sin(lat2))

    Where:
        R       = Earth radius in meters
        lat1    = Source latitude
        lon1    = Source longitude
        lat2    = Destination latitude
        lon2    = Destination longitude
    Note:
        All coordinate values are converted to radians before calculation.
        The acos argument is clamped to [-1, 1] because floating-point rounding can
        push it marginally outside that domain for near-identical coordinates, which
        makes Postgres acos() raise "input is out of range".
    """

    acos_argument = Cos(Radians(Value(source_latitude))) * Cos(Radians(F(dest_latitude_field))) * Cos(
        Radians(F(dest_longitude_field)) - Radians(Value(source_longitude)),
    ) + Sin(Radians(Value(source_latitude))) * Sin(Radians(F(dest_latitude_field)))
    return ExpressionWrapper(
        Value(EARTH_RADIUS_IN_METERS) * ACos(Least(Greatest(acos_argument, Value(-1.0)), Value(1.0))),
        output_field=FloatField(),
    )


def calculate_distance_in_meters(
    source_latitude,
    source_longitude,
    destination_latitude,
    destination_longitude,
):
    """
    Return distance in meters calculating the distance between two coordinates using the Haversine formula.

    Formula:
        distance = R * acos(cos(lat1) * cos(lat2) * cos(lon2 - lon1) + sin(lat1) * sin(lat2))

    Where:
        R       = Earth radius in meters
        lat1    = Source latitude
        lon1    = Source longitude
        lat2    = Destination latitude
        lon2    = Destination longitude
    """

    if not all([source_latitude, source_longitude, destination_latitude, destination_longitude]):
        return 0

    acos_argument = cos(radians(source_latitude)) * cos(radians(destination_latitude)) * cos(
        radians(destination_longitude) - radians(source_longitude)
    ) + sin(radians(source_latitude)) * sin(radians(destination_latitude))
    return EARTH_RADIUS_IN_METERS * acos(max(-1.0, min(1.0, acos_argument)))
