from types import SimpleNamespace

import pytest

import services.api.dependencies as dependencies


class _FakeResponse:
    def __enter__(self):
        return self

    def __exit__(self, *_args):
        return False

    def read(self) -> bytes:
        return b'{"email":"person@example.com"}'


def test_supabase_email_uses_urllib_request_and_returns_user_email(monkeypatch) -> None:
    monkeypatch.setattr(
        dependencies,
        "get_settings",
        lambda: SimpleNamespace(
            supabase_url="https://project.supabase.co",
            supabase_service_role_key=None,
            supabase_anon_key="anon-key",
        ),
    )
    seen: dict[str, object] = {}

    def fake_urlopen(request, timeout):
        seen["request"] = request
        seen["timeout"] = timeout
        return _FakeResponse()

    monkeypatch.setattr(dependencies, "urlopen", fake_urlopen)

    assert dependencies._supabase_email("supabase-access-token") == "person@example.com"
    request = seen["request"]
    assert request.full_url == "https://project.supabase.co/auth/v1/user"
    assert request.get_header("Authorization") == "Bearer supabase-access-token"
    assert seen["timeout"] == 5


def test_current_user_requires_an_authenticated_identity(monkeypatch) -> None:
    monkeypatch.setattr(
        dependencies,
        "get_settings",
        lambda: SimpleNamespace(supabase_url=None, admin_email_list=[]),
    )

    with pytest.raises(dependencies.HTTPException) as exc_info:
        dependencies.get_or_create_current_user(SimpleNamespace(headers={}), None)

    assert exc_info.value.status_code == 401
