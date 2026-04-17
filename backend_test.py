"""
Backend auth refactor tests.
Tests that user-scoped endpoints return 401 without auth and 200 with valid Bearer token.
"""
import sys
import requests

BASE_URL = "https://nuo-vocal-biometrics.preview.emergentagent.com/api"

results = []


def record(name, passed, detail=""):
    status = "PASS" if passed else "FAIL"
    results.append((status, name, detail))
    print(f"[{status}] {name} {('- ' + detail) if detail else ''}")


def get_session_token():
    r = requests.post(f"{BASE_URL}/auth/mock", timeout=30)
    if r.status_code != 200:
        print(f"CRITICAL: /auth/mock failed: {r.status_code} {r.text}")
        sys.exit(1)
    data = r.json()
    token = data.get("session_token")
    user = data.get("user")
    print(f"Got session_token for user: {user.get('email')} token={token[:20]}...")
    return token


def test_endpoint(method, path, token=None, auth_ok_codes=None, extra_params=None, data=None):
    if auth_ok_codes is None:
        auth_ok_codes = {200}
    full_url = f"{BASE_URL}{path}"

    # (a) WITHOUT auth
    s = requests.Session()
    try:
        if method == "GET":
            r_no_auth = s.request(method, full_url, params=extra_params, timeout=30)
        else:
            r_no_auth = s.request(method, full_url, params=extra_params, json=data, timeout=30)
    except Exception as e:
        record(f"{method} {path} [no auth]", False, f"exception: {e}")
        return

    if r_no_auth.status_code == 401:
        record(f"{method} {path} [no auth -> 401]", True)
    else:
        record(f"{method} {path} [no auth -> 401]", False,
               f"got {r_no_auth.status_code}, body={r_no_auth.text[:200]}")

    # (b) WITH auth
    if token:
        s = requests.Session()
        headers = {"Authorization": f"Bearer {token}"}
        try:
            if method == "GET":
                r_auth = s.request(method, full_url, headers=headers, params=extra_params, timeout=30)
            else:
                r_auth = s.request(method, full_url, headers=headers, params=extra_params, json=data, timeout=30)
        except Exception as e:
            record(f"{method} {path} [with auth]", False, f"exception: {e}")
            return

        if r_auth.status_code in auth_ok_codes:
            record(f"{method} {path} [with auth -> {r_auth.status_code}]", True)
        else:
            record(f"{method} {path} [with auth]", False,
                   f"expected {auth_ok_codes}, got {r_auth.status_code}, body={r_auth.text[:300]}")


def main():
    print(f"Base URL: {BASE_URL}")
    print("=" * 80)

    token = get_session_token()
    print("=" * 80)

    endpoints = [
        ("GET", "/auth/me", {200}, None, None),
        ("GET", "/recovery-index", {200}, None, None),
        ("GET", "/sleep-debt", {200}, None, None),
        ("GET", "/metrics/home", {200}, None, None),
        ("GET", "/session/status", {200}, None, None),
        ("GET", "/interventions/today", {200}, None, None),
        ("POST", "/interventions/generate", {200}, None, None),
        ("GET", "/progress/summary", {200}, {"period": "week"}, None),
        ("GET", "/interventions/count", {200}, {"period": "week"}, None),
        ("GET", "/achievements", {200}, None, None),
        ("GET", "/calendar/events", {200, 400}, None, None),
        ("POST", "/calendar/recalculate", {200, 400}, None, None),
        ("DELETE", "/debug/clear-subscription", {200}, None, None),
    ]

    for method, path, auth_ok, params, body in endpoints:
        test_endpoint(method, path, token=token, auth_ok_codes=auth_ok,
                      extra_params=params, data=body)

    print("=" * 80)
    # email= query param should NOT bypass auth
    r = requests.get(f"{BASE_URL}/recovery-index",
                     params={"email": "atuljha2402@gmail.com"}, timeout=30)
    if r.status_code == 401:
        record("GET /recovery-index?email=... [no bearer -> 401]", True)
    else:
        record("GET /recovery-index?email=... [no bearer -> 401]", False,
               f"LEAK! got {r.status_code}, body={r.text[:200]}")

    # voice/analyze — 401 without auth
    r = requests.post(f"{BASE_URL}/voice/analyze", timeout=30)
    if r.status_code == 401:
        record("POST /voice/analyze [no auth -> 401]", True)
    else:
        record("POST /voice/analyze [no auth -> 401]", False,
               f"got {r.status_code}, body={r.text[:200]}")

    # audio/library — public
    r = requests.get(f"{BASE_URL}/audio/library", timeout=30)
    if r.status_code == 200:
        record("GET /audio/library [public -> 200]", True)
    else:
        record("GET /audio/library [public -> 200]", False,
               f"got {r.status_code}, body={r.text[:200]}")

    # payment/plans — public
    r = requests.get(f"{BASE_URL}/payment/plans", timeout=30)
    if r.status_code == 200:
        record("GET /payment/plans [public -> 200]", True)
    else:
        record("GET /payment/plans [public -> 200]", False,
               f"got {r.status_code}, body={r.text[:200]}")

    # Logout then re-use token
    r = requests.post(f"{BASE_URL}/auth/logout",
                      headers={"Authorization": f"Bearer {token}"}, timeout=30)
    if r.status_code == 200:
        record("POST /auth/logout [with bearer -> 200]", True)
    else:
        record("POST /auth/logout [with bearer -> 200]", False,
               f"got {r.status_code}, body={r.text[:200]}")

    r = requests.get(f"{BASE_URL}/auth/me",
                     headers={"Authorization": f"Bearer {token}"}, timeout=30)
    if r.status_code == 401:
        record("GET /auth/me [after logout -> 401]", True)
    else:
        record("GET /auth/me [after logout -> 401]", False,
               f"got {r.status_code}, body={r.text[:200]}")

    print("=" * 80)
    passed = sum(1 for r in results if r[0] == "PASS")
    failed = sum(1 for r in results if r[0] == "FAIL")
    print(f"\nTOTAL: {passed} passed, {failed} failed, {len(results)} total")
    if failed:
        print("\nFAILURES:")
        for s, n, d in results:
            if s == "FAIL":
                print(f"  - {n}: {d}")
    sys.exit(0 if failed == 0 else 1)


if __name__ == "__main__":
    main()
