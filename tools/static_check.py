"""Static cross-check:
1. Per-page HTML IDs: no duplicate IDs, and every page-specific getElementById()
   used by that page's JS initializers (excluding dynamically created IDs) exists.
2. Static asset paths (/css, /js, /img, /vendor) referenced by HTML exist on disk.
3. Every apiFetch / apiFetchRaw path in JS maps to an actual route in app.py.
4. i18n integrity: no duplicate keys in CITIZEN_I18N / BHW_I18N, full parity
   across en/ceb/tl, and all t()/bt()/data-i18n* keys exist.
"""

from __future__ import annotations

import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

# Map HTML path -> (js_file, list of top-level functions in that JS file active on the page)
PAGE_SPEC = {
    "static/index.html": ("api", []),
    "static/citizen/login.html": ("citizen", ["initLogin"]),
    "static/citizen/register.html": ("citizen", ["initRegister"]),
    "static/citizen/forgot-password.html": ("citizen", ["initForgotPassword"]),
    "static/citizen/dashboard.html": (
        "citizen",
        ["initDashboard", "renderLatest", "renderAlertBanner", "renderHero", "renderHeroOnboarding", "renderHeroUnavailable", "renderMiniTrends", "renderConsentChip", "renderBhwNotes", "renderGreeting", "applyDashboardHeadings"],
    ),
    "static/citizen/history.html": (
        "citizen",
        ["initHistory", "renderLogTable", "drawTableRows", "renderCharts"],
    ),
    "static/citizen/consent.html": (
        "citizen",
        ["initConsent", "loadConsent", "renderConsentState", "renderConsentHistory"],
    ),
    "static/citizen/profile.html": ("citizen", ["initProfile"]),
    "static/bhw/login.html": ("bhw", ["initBhwLogin"]),
    "static/bhw/dashboard.html": (
        "bhw",
        ["initDashboard", "loadDashboard", "loadContext", "renderFeverChart", "renderConcerns"],
    ),
    "static/bhw/search.html": (
        "bhw",
        ["initSearch", "searchCitizens", "renderCitizens", "updateSearchChipCounts"],
    ),
    "static/bhw/citizen-view.html": (
        "bhw",
        ["initCitizenView", "renderNotes", "showConsentBlocked"],
    ),
    "static/bhw/audit-trail.html": (
        "bhw",
        ["initAudit", "loadAudit", "renderAudit", "renderAuditMetrics"],
    ),
    "static/bhw/reports.html": ("bhw", ["initReports", "reportPath"]),
}

# IDs that are optional or dynamically created by JS itself
DYNAMIC_OR_OPTIONAL_IDS = {
    "toastContainer",
    "offlineBanner",
    "historyFilterInput",
    "historyCount",
    "referFeedback",
    "noteText",
    "resetCitizenPwInput",
    "referReasonInput",
    "citizenConsentModalBackdrop",
    "staffPenaltiesModalBackdrop",
    "staffOathVerifyErrBackdrop",
    "confirmDialogTitle",
    "confirmDialogDesc",
}


def extract_function_block(source: str, fn_name: str) -> str:
    m = re.search(
        rf"^  (?:async\s+)?function\s+{re.escape(fn_name)}\s*\(.*?\n  \}}",
        source,
        re.M | re.S,
    )
    return m.group(0) if m else ""


def main() -> int:
    js = {
        name: (ROOT / "static" / "js" / f"{name}.js").read_text(encoding="utf-8")
        for name in ("api", "citizen", "bhw")
    }
    app_src = (ROOT / "app.py").read_text(encoding="utf-8")

    problems = 0

    # 1. Per-page HTML IDs & static asset verification
    for page, (js_name, fn_names) in PAGE_SPEC.items():
        html = (ROOT / page).read_text(encoding="utf-8")
        ids = re.findall(r'id="([^"]+)"', html)
        dupes = sorted({i for i in ids if ids.count(i) > 1})
        if dupes:
            print(f"DUPLICATE IDS in {page}: {dupes}")
            problems += 1

        for ref in re.findall(r'(?:src|href)="(/[^"?#]+)', html):
            if ref == "/":
                continue
            if not (ROOT / "static" / ref.lstrip("/")).exists():
                print(f"MISSING ASSET in {page}: {ref}")
                problems += 1

        present = set(ids)
        needed = set()
        if js_name != "api":
            src = js[js_name]
            for fn in fn_names:
                block = extract_function_block(src, fn)
                if not block:
                    print(f"MISSING JS FUNCTION {fn} referenced for {page}")
                    problems += 1
                    continue
                needed.update(re.findall(r'getElementById\(\s*"([^"]+)"\s*\)', block))
        missing = sorted(needed - present - DYNAMIC_OR_OPTIONAL_IDS)
        if missing:
            print(f"MISSING IDS in {page}: {missing}")
            problems += 1

    print("page/id & asset check:", "OK" if not problems else f"{problems} problem(s)")

    # 2. Frontend API paths vs app.py routes
    print("\nfrontend API paths vs app.py routes:")
    used: set[str] = set()
    for source in js.values():
        used.update(re.findall(r'apiFetch(?:Raw)?\(\s*"([^"?]+)', source))
        used.update(re.findall(r"apiFetch(?:Raw)?\(\s*'([^'?]+)", source))

    # Include dynamic concatenations for /api/bhw/citizen/<id>/...
    citizen_subcalls = set(
        re.findall(r'"/api/bhw/citizen/"\s*\+\s*encodeURIComponent\([^)]+\)\s*\+\s*"([^"]+)"', js["bhw"])
    )
    routes = set(re.findall(r'@app\.route\("([^"]+)"', app_src))
    route_ok = True

    for path in sorted(used):
        if path == "/api/bhw/citizen/":
            for sub in sorted(citizen_subcalls):
                if sub.startswith("/notes/"):
                    expected = "/api/bhw/citizen/<int:citizen_id>/notes/<int:note_id>"
                else:
                    expected = "/api/bhw/citizen/<int:citizen_id>" + sub
                known = expected in routes
                print(f"  {'OK  ' if known else 'MISS'} {expected}")
                route_ok = route_ok and known
            continue
        known = path in routes
        print(f"  {'OK  ' if known else 'MISS'} {path}")
        route_ok = route_ok and known

    print("\nroute check:", "OK" if route_ok else "PROBLEMS")

    # 3. i18n parity & duplicate key check
    i18n_problems = 0
    en_dicts: dict[str, set[str]] = {}
    for js_name, dict_name, fn_name in (
        ("citizen", "CITIZEN_I18N", "t"),
        ("bhw", "BHW_I18N", "bt"),
    ):
        txt = js[js_name]
        m_all = re.search(rf"{dict_name}\s*=\s*\{{(.*?)\n  \}};\r?\n", txt, re.S)
        i18n_block = m_all.group(1) if m_all else ""
        en_keys: set[str] = set()
        for lang in ("en", "ceb", "tl"):
            ml = re.search(rf"\n    {lang}:\s*\{{(.*?)\n    \}},", i18n_block, re.S)
            block = ml.group(1) if ml else ""
            keys = re.findall(r"^\s{6}([a-zA-Z0-9_]+)\s*:", block, re.M)
            dups = sorted({k for k in keys if keys.count(k) > 1})
            if dups:
                print(f"DUPLICATE i18n keys in {js_name}.js [{lang}]: {dups}")
                i18n_problems += 1
            key_set = set(keys)
            if lang == "en":
                en_keys = key_set
                en_dicts[js_name] = en_keys
            else:
                missing_lang = sorted(en_keys - key_set)
                if missing_lang:
                    print(f"MISSING {lang} i18n keys in {js_name}.js: {missing_lang}")
                    i18n_problems += 1

        calls = set(re.findall(rf'\b{fn_name}\(\s*"([^"]+)"', txt))
        missing_calls = sorted(calls - en_keys)
        if missing_calls:
            print(f"MISSING {fn_name}() i18n keys in {js_name}.js: {missing_calls}")
            i18n_problems += 1

    for page in PAGE_SPEC:
        if page == "static/index.html":
            continue
        html = (ROOT / page).read_text(encoding="utf-8")
        target = "bhw" if "/bhw/" in page else "citizen"
        attrs = set(re.findall(r'data-i18n(?:-(?:html|placeholder))?="([^"]+)"', html))
        miss_html = sorted(attrs - en_dicts[target])
        if miss_html:
            print(f"MISSING HTML data-i18n keys in {page}: {miss_html}")
            i18n_problems += 1

    print("i18n check:", "OK" if not i18n_problems else f"{i18n_problems} problem(s)")

    return 1 if (problems or not route_ok or i18n_problems) else 0


if __name__ == "__main__":
    sys.exit(main())
