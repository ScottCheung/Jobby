import argparse
import json
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen


def api_request(base_url: str, path: str, payload: dict | None = None, query: dict | None = None) -> dict:
    url = f"{base_url.rstrip('/')}{path}"
    if query:
        url = f"{url}?{urlencode(query)}"

    data = None
    headers = {"Accept": "application/json"}
    if payload is not None:
        data = json.dumps(payload).encode("utf-8")
        headers["Content-Type"] = "application/json"

    request = Request(url, data=data, headers=headers, method="POST" if payload is not None else "GET")
    with urlopen(request, timeout=120) as response:
        return json.loads(response.read().decode("utf-8"))


def main() -> None:
    parser = argparse.ArgumentParser(description="Batch async application records from their job links.")
    parser.add_argument("--api-base-url", default="http://127.0.0.1:8000")
    parser.add_argument("--limit", type=int, default=100)
    parser.add_argument("--status", choices=["submitted", "skipped", "cancelled"], default=None)
    parser.add_argument("--all", action="store_true", help="Async records even if title/company/location/JD already exist.")
    args = parser.parse_args()

    query = {
        "limit": args.limit,
        "only_missing": str(not args.all).lower(),
    }
    if args.status:
        query["status"] = args.status

    try:
        result = api_request(args.api_base_url, "/api/applications/async-from-link/batch", payload={}, query=query)
    except HTTPError as error:
        detail = error.read().decode("utf-8", errors="replace")
        raise SystemExit(f"API returned HTTP {error.code}: {detail}") from error
    except (URLError, TimeoutError) as error:
        raise SystemExit(f"Could not reach API: {error}") from error

    print(json.dumps(result, indent=2, ensure_ascii=False))


if __name__ == "__main__":
    main()
