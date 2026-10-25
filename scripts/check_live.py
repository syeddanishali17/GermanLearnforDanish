"""Pre-/post-deploy checklist against a running Ustad (docs/PRIVACY.md).

Usage: python scripts/check_live.py https://<your-app>.workers.dev
       python scripts/check_live.py http://localhost:8787
The URL is an argument on purpose: never commit the production URL.
"""

import json
import sys
import urllib.error
import urllib.request

PRIVATE = ["/audio-private/manifest.json", "/api/daily", "/api/review/queue", "/api/missions", "/api/stats/dashboard", "/api/export", "/api/settings", "/api/conversations", "/api/items"]
HEADERS = {
    "x-robots-tag": "noindex, nofollow, noarchive",
    "x-content-type-options": "nosniff",
    "referrer-policy": "no-referrer",
    "x-frame-options": "DENY",
}


def fetch(url: str, method: str = "GET", body: bytes | None = None, headers: dict | None = None):
    req = urllib.request.Request(url, data=body, method=method, headers={"User-Agent": "ustad-check/1.0 (curl-compatible)", **(headers or {})})
    try:
        with urllib.request.urlopen(req, timeout=20) as r:
            return r.status, {k.lower(): v for k, v in r.headers.items()}, r.read()
    except urllib.error.HTTPError as e:
        return e.code, {k.lower(): v for k, v in e.headers.items()}, e.read()


def main(base: str) -> int:
    base = base.rstrip("/")
    results: list[tuple[str, bool, str]] = []

    def check(name: str, ok: bool, detail: str = "") -> None:
        results.append((name, ok, detail))

    st, h, body = fetch(base + "/")
    html = body.decode("utf-8", "replace")
    check("HTML has noindex meta", 'name="robots" content="noindex, nofollow, noarchive"' in html)
    for k, v in HEADERS.items():
        check(f"HTML {k}", h.get(k) == v, h.get(k, "missing"))
    csp = h.get("content-security-policy", "")
    check("HTML CSP frame-ancestors 'none'", "frame-ancestors 'none'" in csp, csp[:60])
    pp = h.get("permissions-policy", "")
    check("camera/geolocation/payment denied", all(f"{x}=()" in pp for x in ("camera", "geolocation", "payment")), pp)
    check("microphone not globally blocked", "microphone=()" not in pp, pp)
    check("no analytics/tracker scripts", not any(t in html.lower() for t in ("googletagmanager", "gtag(", "plausible", "beacon.min.js", "cloudflareinsights", "analytics")))

    st, h, body = fetch(base + "/robots.txt")
    check("robots.txt allows crawling", st == 200 and "Allow: /" in body.decode(), str(st))
    check("robots.txt X-Robots-Tag", h.get("x-robots-tag") == HEADERS["x-robots-tag"])
    st, _, _ = fetch(base + "/sitemap.xml")
    check("no sitemap", st == 404, str(st))

    st, h, body = fetch(base + "/api/health")
    check("API health", st == 200 and json.loads(body).get("ok") is True)
    for k, v in HEADERS.items():
        check(f"API {k}", h.get(k) == v, h.get(k, "missing"))
    for path in PRIVATE:
        st, h, _ = fetch(base + path, headers={"Origin": "https://evil.example"})
        check(f"{path} needs login", st == 401, str(st))
        check(f"{path} no CORS", "access-control-allow-origin" not in h)
    st, _, _ = fetch(base + "/api/missions", "POST", b"{}", {"content-type": "application/json", "Origin": "https://evil.example"})
    check("cross-site POST blocked", st in (401, 403), str(st))

    st, _, body = fetch(base + "/")
    js = [part.split('"')[0] for part in html.split('src="')[1:] if part.split('"')[0].endswith(".js")]
    leaked = []
    for src in js:
        _, _, code = fetch(base + src)
        text = code.decode("utf-8", "replace")
        leaked += [m for m in ("PASSWORD_HASH", "pbkdf2$", "GATE_TOKEN", "sk-ant-", "BEGIN PRIVATE KEY") if m in text]
    check("no secrets in frontend bundle", not leaked, ", ".join(leaked))

    width = max(len(n) for n, _, _ in results)
    for name, ok, detail in results:
        print(f"{'PASS' if ok else 'FAIL'}  {name:<{width}}  {'' if ok else detail}")
    failed = [n for n, ok, _ in results if not ok]
    print(f"\n{len(results) - len(failed)}/{len(results)} passed")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1]))
