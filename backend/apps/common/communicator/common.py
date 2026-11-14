from apps.common.helpers import make_http_request


class Communicator:
    """
    Communicates with microservices and returns the response. This is the one way class to communicate with the
    running microservice.

    """

    @staticmethod
    def get_url(url=None):
        """Returns service host."""

        return url

    @staticmethod
    def get_headers(auth_token=None, headers=None):
        """Headers necessary for authorization."""

        if headers is None:
            headers = {}
        if not headers.get("Content-Type"):
            headers["Content-Type"] = "application/json"
        if auth_token:
            headers["Authorization"] = f"Bearer {auth_token}"
        return headers

    def get(self, url, auth_token=None, params=None, headers=None, auth=None):
        """Make get request."""

        if params is None:
            params = {}

        response = make_http_request(
            url=f"{self.get_url(url)}",
            method="GET",
            params=params,
            headers=self.get_headers(auth_token=auth_token, headers=headers or {}),
            auth=auth,
        )
        if response.get("status_code") == 200:
            return True, response.get("data") or response
        return False, response

    def post(self, url, data=None, auth_token=None, params=None, headers=None, auth=None):
        """Make post request."""

        response = make_http_request(
            url=f"{self.get_url(url)}",
            method="POST",
            data=data,
            params=params,
            headers=self.get_headers(auth_token=auth_token, headers=headers or {}),
            auth=auth,
        )
        if 200 <= response.get("status_code") < 300:
            return True, response["data"]
        return False, response

    def put(self, url, data=None, auth_token=None, params=None, headers=None, auth=None):
        """Make put request."""

        if data is None:
            data = {}
        if params is None:
            params = {}

        response = make_http_request(
            url=f"{self.get_url(url)}",
            method="PUT",
            data=data,
            params=params,
            headers=self.get_headers(auth_token=auth_token, headers=headers or {}),
            auth=auth,
        )
        if response.get("status_code") == 200:
            return True, response["data"]
        return False, response
