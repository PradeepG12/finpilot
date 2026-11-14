from rest_framework.pagination import LimitOffsetPagination, PageNumberPagination


class AppPagination(PageNumberPagination):
    """
    Pagination class used across the app. Every list view uses
    pagination for better performance.
    """

    page_size = 24
    page_size_query_param = "page-size"
    max_page_size = 100


class BaseLimitOffsetPagination(LimitOffsetPagination):
    """
    Custom pagination class that uses the LimitOffset pagination
    strategy.

    This class is useful when you want to paginate a list of objects
    """

    default_limit = 200
