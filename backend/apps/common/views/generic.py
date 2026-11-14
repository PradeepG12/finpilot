from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import filters, parsers, permissions
from rest_framework.decorators import action
from rest_framework.exceptions import MethodNotAllowed
from rest_framework.mixins import (
    CreateModelMixin,
    DestroyModelMixin,
    ListModelMixin,
    RetrieveModelMixin,
    UpdateModelMixin,
)
from rest_framework.viewsets import GenericViewSet

from apps.common.pagination import AppPagination
from apps.common.serializers import AppModelSerializer, simple_serialize_queryset
from apps.common.views.base import AppCreateAPIView, AppViewMixin, SortingMixin


class AppGenericViewSet(GenericViewSet):
    """
    Applications version of the `GenericViewSet`. Overridden to implement
    app's necessary features. Also used in the CRUD viewsets.

    Note:
        1. An APIView is different from an APIViewSet.
        2. An APIView is registered using:
            path("url/endpoint/", APIView.as_view())
        3. An APIViewSet is registered using:
            router.register(
                "url/endpoint",
                APIViewSet,
                basename="base_name_if_needed",
            )

    Why is this implemented?
        > Consider an Update API that has to be implemented.
        > The API has to send the following:
            >> Initial data (ids).
            >> Metadata for select options.
            >> Handle the update operations.
        > If implemented using APIView, there has to be at least 2 view classes.
        > If implemented using APIViewSet, it is only one view.
        > Hence reduces the development time.
    """

    lookup_url_kwarg = "uuid"
    lookup_field = "uuid"


class AppModelListAPIViewSet(
    SortingMixin,
    ListModelMixin,
    AppGenericViewSet,
):
    """
    Applications base list APIViewSet. Handles all the listing views.
    This also sends the necessary filter meta and table config data.

    Also handles listing operations like sort, search, filter and
    table preferences of the user.

    References:
        1. https://github.com/miki725/django-url-filter
        2. https://www.django-rest-framework.org/api-guide/filtering/
    """

    pagination_class = AppPagination  # page-size: 25
    filter_backends = [
        DjangoFilterBackend,
        filters.SearchFilter,
        filters.OrderingFilter,
    ]

    filterset_fields = []  # override
    search_fields = []  # override
    ordering_fields = "__all__"

    all_table_columns = {}

    @action(
        methods=["GET"],
        url_path="table-meta",
        detail=False,
    )
    def get_meta_for_table_handler(self, *args, **kwargs):
        """
        Sends out all the necessary config for the front-end table. The
        config can vary based on user permission and preference.
        """

        return self.send_response(data=self.get_meta_for_table())

    def get_meta_for_table(self) -> dict:
        """
        Just an adaptor class for the `get_meta_for_table_handler`.
        Overridden on the child classes to send data.
        """

        return {
            "columns": self.get_table_columns(),
            "filter_data": (
                self.serializer_class(context=self.get_serializer_context()).get_filter_meta()
                if self.serializer_class
                else {}
            ),
            "sort_by": self.get_sorting_options(),
        }

    def get_table_columns(self) -> dict:
        """
        Returns all the columns for the table in order. Got from the
        preference of the user. Overridden in child.
        """

        return self.all_table_columns

    def serialize_for_filter(self, queryset, fields=None):
        """Simple central function to serialize data for the filter component."""

        if not fields:
            fields = ["id", "identity"]

        return simple_serialize_queryset(queryset=queryset, fields=fields)

    def serialize_choices(self, choices: list):
        """
        Given a list of choices like:
            ['active', ...]

        This will return the following:
            [{'id': 'active', 'identity': 'Active'}, ...]

        This will be convenient for the front end to integrate. Also
        this is considered as a standard.
        """

        from apps.common.helpers import get_display_name_for_slug

        return [{"id": _, "identity": get_display_name_for_slug(_)} for _ in choices]


class AppModelCUDAPIViewSet(
    AppViewMixin,
    CreateModelMixin,
    UpdateModelMixin,
    DestroyModelMixin,
    AppGenericViewSet,
):
    """
    What is CUD?
        Create, Update & Delete

    What is a CUD ViewSet?
        A ViewSet that handles the necessary CUD operations.

    Why is this separated from the ModelViewSet?
        User Permissions can be two types:
            > View
            > Modify
        An user can have anyone or both for a particular entity like `ProjectType`.
        These conditions can be handled easily, when the CUD is separated.

    Urls Allowed:
        > POST: {endpoint}/
            >> Get data from front-end and creates an object.
        > GET: {endpoint}/meta/
            >> Returns metadata for the front-end for object creation.

        > PUT: {endpoint}/<uuid>/
            >> Get data from font-end to update an object.
        > GET: {endpoint}/<uuid>/meta/
            >> Returns metadata for the front-end for object update.

        > DELETE: {endpoint}/<uuid>/
            >> Deletes the object identified by the passed `uuid`.
    """

    @action(
        methods=["GET"],
        url_path="meta",
        detail=False,
    )
    def get_meta_for_create(self, *args, **kwargs):
        """Returns the meta details for create from serializer."""

        return self.send_response(data=self.get_serializer().get_meta_for_create())

    @action(
        methods=["GET"],
        url_path="meta",
        detail=True,
    )
    def get_meta_for_update(self, *args, **kwargs):
        """Returns the meta details for update from serializer."""

        return self.send_response(data=self.get_serializer(instance=self.get_object()).get_meta_for_update())


class AppModelCreateAPIViewSet(AppModelCUDAPIViewSet):
    """
    Urls Allowed:
        > POST: {endpoint}/
            >> Get data from front-end and creates an object.
        > GET: {endpoint}/meta/
            >> Returns metadata for the front-end for object creation.
        > DELETE: {endpoint}/<uuid>/
            >> Deletes the object identified by the passed `uuid`.
    """

    def update(self, request, *args, **kwargs):
        """Not allowed."""

        raise MethodNotAllowed(request.method)

    @action(
        methods=["GET"],
        url_path="meta",
        detail=False,
    )
    def get_meta_for_create(self, *args, **kwargs):
        """Returns the meta details for create from serializer."""

        return self.send_response(data=self.get_serializer().get_meta_for_create())


class AppModelUpdateAPIViewSet(
    AppViewMixin,
    UpdateModelMixin,
    AppGenericViewSet,
):
    """
    Urls Allowed:
        > PUT: {endpoint}/<uuid>/
            >> Get data from font-end to update an object.
        > GET: {endpoint}/<uuid>/meta/
            >> Returns metadata for the front-end for object update.
    """

    def create(self, request, *args, **kwargs):
        """Not Supported."""

        raise MethodNotAllowed(request.method)

    def destroy(self, request, *args, **kwargs):
        """Not supported."""

        raise MethodNotAllowed(request.method)

    @action(
        methods=["GET"],
        url_path="meta",
        detail=True,
    )
    def get_meta_for_update(self, *args, **kwargs):
        """Returns the meta details for update from serializer."""

        return self.send_response(data=self.get_serializer(instance=self.get_object()).get_meta_for_update())


class AppModelRetrieveAPIViewSet(AppViewMixin, RetrieveModelMixin, AppGenericViewSet):
    pass


def get_upload_api_view(meta_model, meta_fields=None, is_allow_any=False):
    """Central function to return the UploadAPIView. Used to handle uploads."""

    if not meta_fields:
        meta_fields = ["file", "id"]

    meta_permissions = [permissions.IsAuthenticated]
    if is_allow_any:
        meta_permissions = [permissions.AllowAny]

    class _View(AppCreateAPIView):
        """View to handle the upload."""

        class _Serializer(AppModelSerializer):
            """Serializer for write."""

            class Meta(AppModelSerializer.Meta):
                model = meta_model
                fields = meta_fields

        parser_classes = [parsers.MultiPartParser]
        serializer_class = _Serializer
        permission_classes = meta_permissions

    return _View
