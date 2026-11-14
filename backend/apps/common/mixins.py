from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.generics import get_object_or_404


class MobileFilterAndSortMetaMixin:
    """
    Mixin to provide filter and sort meta endpoint for mobile listing screens.
    Override get_filter_meta_sections() to define which sections to include.
    Each section method is individually overrideable for per-viewset customisation.
    """

    def get_filter_meta_sections(self):
        """Returns the list of meta section methods to include in the filter sheet. Override to customise."""

        return []

    @action(methods=["GET"], url_path="filter-sort-meta", detail=False)
    def get_filter_and_sort_meta(self, *args, **kwargs):
        """Returns all filter and sort config sections for the mobile listing screen."""

        return self.send_response(data=[section() for section in self.get_filter_meta_sections()])

    def get_sort_by_meta(self):
        """Returns sort by options for the filter sheet. Override to customise sort options."""

        return {
            "key": "sort_by",
            "label": "Sort By",
            "options": [],
        }

    def get_veg_preference_meta(self):
        """Returns veg and non-veg toggle options for the filter sheet."""

        return {
            "key": "is_veg",
            "label": "Veg / Non-Veg Preference",
            "options": [
                {"id": True, "identity": "Veg"},
                {"id": False, "identity": "Non-Veg"},
            ],
        }

    def get_delivery_time_meta(self):
        """Returns delivery time filter options in minutes for the filter sheet."""

        return {
            "key": "delivery_time",
            "label": "Delivery Time",
            "options": [
                {"id": 30, "identity": "Under 30 mins"},
                {"id": 40, "identity": "Under 40 mins"},
                {"id": 45, "identity": "Under 45 mins"},
            ],
        }

    def get_ratings_meta(self):
        """Returns minimum rating filter options for the filter sheet."""

        return {
            "key": "min_rating",
            "label": "Ratings",
            "options": [
                {"id": "4.0", "identity": "4.0+"},
                {"id": "4.5", "identity": "4.5+"},
                {"id": "4.8", "identity": "4.8+"},
            ],
        }

    def get_cuisine_preferences_meta(self):
        """Returns active categories from the database for the filter sheet. Override to change the model."""

        raise NotImplementedError(f"{self.__class__.__name__} must implement get_cuisine_preferences_meta().")

    def get_price_range_meta(self):
        """Returns min and max price bounds for the price range slider. Override to change the model."""

        raise NotImplementedError(f"{self.__class__.__name__} must implement get_price_range_meta().")


class RetrieveObjectByUUIDMixin:
    """
    Generic mixin to retrieve any model instance using UUID.

    Configurable attributes:
        - lookup_model: Model class
        - query_param: query param name (optional)
        - url_kwarg: url kwarg name (optional)
    """

    lookup_model = None
    lookup_query_param = None
    lookup_url_kwarg = None

    def get_object_by_uuid(self, request=None):
        """Fetch object using UUID from query params or URL kwargs."""

        assert self.lookup_model, "lookup_model must be defined"
        if request is None:
            request = self.request
        uuid_value = None
        if self.lookup_query_param:
            uuid_value = request.query_params.get(self.lookup_query_param)
        if not uuid_value and self.lookup_url_kwarg:
            uuid_value = getattr(self, "kwargs", {}).get(self.lookup_url_kwarg)
        if not uuid_value:
            raise ValidationError({self.lookup_query_param or self.lookup_url_kwarg: "This field is required."})
        return get_object_or_404(self.lookup_model, uuid=uuid_value)

    def get_object_by_uuid_or_none(self, request=None):
        """Fetch object using UUID when provided, otherwise returns None instead of raising."""

        assert self.lookup_model, "lookup_model must be defined"
        if request is None:
            request = self.request
        uuid_value = None
        if self.lookup_query_param:
            uuid_value = request.query_params.get(self.lookup_query_param)
        if not uuid_value and self.lookup_url_kwarg:
            uuid_value = getattr(self, "kwargs", {}).get(self.lookup_url_kwarg)
        if not uuid_value:
            return None
        return get_object_or_404(self.lookup_model, uuid=uuid_value)
