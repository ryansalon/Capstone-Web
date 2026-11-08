"""Static cross-check: every getElementById in JS must exist in the pages that
load it, ids must be unique per page, and every apiFetch path must map to a route."""

import re
import sys
from pathlib import Path

root = Path(__file__).resolve().parent.parent
js = {
    name: (root / "static" / "js" / f"{name}.js").read_text(encoding="utf-8")
    for name in ("api", "citizen", "bhw")
}
app = (root / "app.py").read_text(encoding="utf-8")

pages = [
    ("static/index.html", ["api"]),
    ("static/citizen/login.html", ["api", "citizen"]),
    ("static/citizen/register.html", ["api", "citizen"]),
    ("static/citizen/dashboard.html", ["api", "citizen"]),
    ("static/citizen/history.html", ["api", "citizen"]),
    ("static/citizen/consent.html", ["api", "citizen"]),
    ("static/citizen/profile.html", ["api", "citizen"]),
    ("static/bhw/login.html", ["api", "bhw"]),
    ("static/bhw/dashboard.html", ["api", "bhw"]),
    ("static/bhw/search.html", ["api", "bhw"]),
    ("static/bhw/citizen-view.html", ["api", "bhw"]),
    ("static/bhw/audit-trail.html", ["api", "bhw"]),
    ("static/bhw/reports.html", ["api", "bhw"]),
]

problems = 0
for page, scripts in pages:
    html = (root / page).read_text(encoding="utf-8")
    ids = re.findall(r'id="([^"]+)"', html)
    dupes = sorted({i for i in ids if ids.count(i) > 1})
    if dupes:
        print(f"DUPLICATE IDS in {page}: {dupes}")
        problems += 1
    present = set(ids)
    needed = set()
    for s in scripts:
        needed.update(re.findall(r'getElementById\(\s*"([^"]+)"\s*\)', js[s]))
    missing = sorted(needed - present)
    if missing:
        print(f"MISSING IDS in {page}: {missing}")
        problems += 1

print("page/id check:", "OK" if not problems else f"{problems} problem(s)")

# apiFetch paths vs app.py routes
print("\nfrontend API paths vs app.py routes:")
used = set()
for source in js.values():
    used.update(re.findall(r'apiFetch(?:Raw)?\(\s*"([^"?]+)', source))
    used.update(re.findall(r"apiFetch(?:Raw)?\(\s*'([^'?]+)", source))
routes = set(re.findall(r'@app\.route\("([^"]+)"', app))
ok = True
for path in sorted(used):
    if path.startswith("/api/bhw/citizen/"):
        pat = "/api/bhw/citizen/<int:citizen_id>" + path.split("/notes")[0].split("/refer")[0].split("/health-logs")[0].replace("/api/bhw/citizen/", "")
        known = any(r.startswith("/api/bhw/citizen/<int:citizen_id>") for r in routes)
        print(f"  {'OK  ' if known else 'MISS'} {path}")
        ok = ok and known
        continue
    # front-end builds query strings dynamically; compare the static prefix
    base = path
    known = base in routes or any(r == base for r in routes)
    if not known:
        # maybe path includes a query already stripped; check prefixes
        known = any(r.startswith(base) for r in routes)
    print(f"  {'OK  ' if known else 'MISS'} {base}")
    ok = ok and known

print("\nroute check:", "OK" if ok else "PROBLEMS")
sys.exit(1 if problems or not ok else 0)
