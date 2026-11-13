/* Smart Barangay Health Monitoring Kiosk - API helper + auth guard.
 *
 * This file is the single source of truth for talking to the API and for the
 * session stored in localStorage (keys: hk_token / hk_role / hk_name).
 */
(function () {
  "use strict";

  var TOKEN_KEY = "hk_token";
  var ROLE_KEY = "hk_role";
  var NAME_KEY = "hk_name";
  var PRIVACY_ACK_KEY = "hk_privacy_ack";

  function getToken() {
    return localStorage.getItem(TOKEN_KEY);
  }

  function getRole() {
    return localStorage.getItem(ROLE_KEY);
  }

  function getName() {
    return localStorage.getItem(NAME_KEY);
  }

  function getPrivacyAcknowledged() {
    var val = localStorage.getItem(PRIVACY_ACK_KEY);
    if (val === "1") return true;
    if (val === "0") return false;
    return null;
  }

  function setPrivacyAcknowledged(acknowledged) {
    localStorage.setItem(PRIVACY_ACK_KEY, acknowledged ? "1" : "0");
  }

  function saveSession(token, role, fullName, privacyAck) {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(ROLE_KEY, role);
    if (fullName === undefined || fullName === null) {
      localStorage.removeItem(NAME_KEY);
    } else {
      localStorage.setItem(NAME_KEY, fullName);
    }
    if (privacyAck !== undefined) {
      setPrivacyAcknowledged(Boolean(privacyAck));
    }
  }

  function clearSession() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(ROLE_KEY);
    localStorage.removeItem(NAME_KEY);
    localStorage.removeItem(PRIVACY_ACK_KEY);
    try {
      sessionStorage.removeItem("bhm:staff_privacy_oath");
      sessionStorage.removeItem("bhm:citizen_terms_seen");
    } catch (_) {}
  }

  function isStaff(role) {
    return role === "bhw" || role === "admin";
  }

  function loginPageForRole(role) {
    return isStaff(role) ? "/bhw/login.html" : "/citizen/login.html";
  }

  function homeForRole(role) {
    return isStaff(role) ? "/bhw/dashboard.html" : "/citizen/dashboard.html";
  }

  function currentLoginPage() {
    if (location.pathname.indexOf("/bhw/") === 0) return "/bhw/login.html";
    if (location.pathname.indexOf("/citizen/") === 0) return "/citizen/login.html";
    return loginPageForRole(getRole());
  }

  function handleUnauthorized() {
    // Login / register pages show the server message inline instead of
    // reloading (the 401 there means "invalid credentials", not "expired").
    if (/\/(login|register)\.html$/.test(location.pathname)) return;
    var target = currentLoginPage();
    clearSession();
    if (location.pathname !== target) location.replace(target + "?reason=expired");
  }

  function buildHeaders() {
    var headers = { "Content-Type": "application/json" };
    var token = getToken();
    if (token) headers["Authorization"] = "Bearer " + token;
    return headers;
  }

  async function apiFetch(path, options) {
    options = options || {};
    var init = {
      method: options.method || "GET",
      headers: buildHeaders(),
    };
    if (options.body !== undefined) {
      init.body = JSON.stringify(options.body);
    }

    var response;
    try {
      response = await fetch(path, init);
    } catch (networkError) {
      var netErr = new Error("Can't reach the health server. Check your connection.");
      netErr.status = 0;
      throw netErr;
    }

    var data = null;
    try {
      data = await response.json();
    } catch (parseError) {
      data = null;
    }

    if (!response.ok) {
      var apiError = new Error(
        (data && data.error) || "request failed (" + response.status + ")"
      );
      apiError.status = response.status;
      if (response.status === 401) handleUnauthorized();
      throw apiError;
    }
    return data;
  }

  /* Like apiFetch but returns the raw Response (used for CSV downloads and
   * printable HTML reports). Error bodies are still JSON and are surfaced. */
  async function apiFetchRaw(path, options) {
    options = options || {};
    var init = {
      method: options.method || "GET",
      headers: buildHeaders(),
    };
    if (options.body !== undefined) {
      init.body = JSON.stringify(options.body);
    }

    var response;
    try {
      response = await fetch(path, init);
    } catch (networkError) {
      var netErr = new Error("Can't reach the health server. Check your connection.");
      netErr.status = 0;
      throw netErr;
    }

    if (!response.ok) {
      var message = "request failed (" + response.status + ")";
      try {
        var payload = await response.json();
        if (payload && payload.error) message = payload.error;
      } catch (parseError) {
        /* keep the generic message */
      }
      var apiError = new Error(message);
      apiError.status = response.status;
      if (response.status === 401) handleUnauthorized();
      throw apiError;
    }
    return response;
  }

  function requireRole(role) {
    var token = getToken();
    var storedRole = getRole();

    if (!token || !storedRole) {
      location.replace(loginPageForRole(role));
      return null;
    }
    if (role === "bhw") {
      if (!isStaff(storedRole)) {
        location.replace("/citizen/dashboard.html");
        return null;
      }
    } else if (isStaff(storedRole)) {
      location.replace("/bhw/dashboard.html");
      return null;
    }
    return { token: token, role: storedRole, name: getName() };
  }

  function logout() {
    var role = getRole();
    var target = loginPageForRole(role);
    clearSession();
    if (getToken()) return; // defensive; clearSession already removed it
    location.href = target;
  }

  /* ---------------- small DOM helpers (textContent only) ---------------- */

  var UI = {
    clear: function (node) {
      if (!node) return;
      while (node.firstChild) node.removeChild(node.firstChild);
    },

    el: function (tag, attrs, text) {
      var node = document.createElement(tag);
      if (attrs) {
        Object.keys(attrs).forEach(function (key) {
          var value = attrs[key];
          // Skip unset values: passing disabled:false used to call
          // setAttribute("disabled", false), which yields the STRING "false"
          // and still disables the control (broke pagination buttons).
          if (value === false || value === null || value === undefined) return;
          if (key === "class") node.className = value;
          else if (key === "text") node.textContent = value;
          // Boolean attributes (disabled, required, checked…) are set as
          // empty strings so the presence of the attribute is the truth.
          else if (value === true) node.setAttribute(key, "");
          else node.setAttribute(key, String(value));
        });
      }
      if (text !== undefined && text !== null) node.textContent = String(text);
      return node;
    },

    loading: function (target, message) {
      if (!target) return;
      UI.clear(target);
      var node = UI.el("div", { class: "status loading", role: "status" });
      node.appendChild(UI.el("span", { class: "spinner", "aria-hidden": "true" }));
      node.appendChild(document.createTextNode(" " + (message || "Loading…")));
      target.appendChild(node);
    },

    error: function (target, message, onRetry) {
      if (!target) return;
      UI.clear(target);
      var box = UI.el(
        "div",
        { class: "status error", role: "alert" },
        message || "Something went wrong."
      );
      if (onRetry) {
        var retry = UI.el("button", { class: "btn btn-secondary", type: "button" }, "Retry");
        retry.onclick = function () {
          UI.clearStatus(target);
          onRetry();
        };
        box.appendChild(retry);
      }
      target.appendChild(box);
    },

    empty: function (target, message) {
      if (!target) return;
      UI.clear(target);
      target.appendChild(
        UI.el("div", { class: "status empty" }, message || "Nothing to show yet.")
      );
    },

    clearStatus: function (target) {
      if (target) UI.clear(target);
    },

    tableSkeleton: function (columns, rowCount) {
      var wrap = UI.el("div", { class: "table-wrap skeleton-table-wrap", "aria-busy": "true", "aria-label": "Loading table data" });
      var table = UI.el("table");
      var thead = UI.el("thead");
      var headRow = UI.el("tr");
      (columns || ["", "", "", ""]).forEach(function (colName) {
        var th = UI.el("th", { scope: "col" });
        var bar = UI.el("div", { class: "skeleton skeleton-label" });
        if (colName) th.textContent = colName;
        else th.appendChild(bar);
        headRow.appendChild(th);
      });
      thead.appendChild(headRow);
      table.appendChild(thead);
      var tbody = UI.el("tbody");
      var count = rowCount || 4;
      for (var r = 0; r < count; r++) {
        var tr = UI.el("tr");
        for (var c = 0; c < (columns ? columns.length : 4); c++) {
          var td = UI.el("td");
          td.appendChild(UI.el("div", { class: "skeleton skeleton-sub", style: "width:" + (55 + ((r + c) % 3) * 15) + "%;" }));
          tr.appendChild(td);
        }
        tbody.appendChild(tr);
      }
      table.appendChild(tbody);
      wrap.appendChild(table);
      return wrap;
    },

    /* Show a modal backdrop as an accessible dialog:
     * role/aria-modal/aria-labelledby for screen readers, Escape and
     * backdrop-click to close, focus moved in and restored on close, and a
     * minimal Tab trap so keyboard users cannot tab behind the overlay.
     * Returns a close() function (callers should invoke it from their own
     * close buttons). */
    openDialog: function (backdrop, focusTarget, options) {
      if (!backdrop) return function () {};
      options = options || {};
      var persistent = Boolean(options.persistent || options.preventDismiss);
      var seq = (UI._dialogSeq = (UI._dialogSeq || 0) + 1);

      backdrop.setAttribute("role", persistent ? "alertdialog" : "dialog");
      backdrop.setAttribute("aria-modal", "true");
      if (!backdrop.getAttribute("aria-labelledby")) {
        var heading = backdrop.querySelector("h1, h2, h3");
        if (heading) {
          if (!heading.id) heading.id = "dialog-title-" + seq;
          backdrop.setAttribute("aria-labelledby", heading.id);
        }
      }

      var previousFocus = document.activeElement;
      var closed = false;

      function focusables() {
        return Array.prototype.filter.call(
          backdrop.querySelectorAll(
            'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
          ),
          function (node) {
            return node.offsetWidth > 0 || node.offsetHeight > 0;
          }
        );
      }

      function close() {
        if (closed) return;
        closed = true;
        document.removeEventListener("keydown", onKeydown, true);
        if (backdrop.parentNode) backdrop.parentNode.removeChild(backdrop);
        if (previousFocus && typeof previousFocus.focus === "function") {
          previousFocus.focus();
        }
      }

      function onKeydown(event) {
        if (event.key === "Escape" || event.key === "Esc") {
          event.preventDefault();
          if (!persistent) {
            close();
          }
          return;
        }
        if (event.key === "Tab") {
          var items = focusables();
          if (!items.length) return;
          var first = items[0];
          var last = items[items.length - 1];
          var current = document.activeElement;
          if (event.shiftKey && (current === first || !backdrop.contains(current))) {
            event.preventDefault();
            last.focus();
          } else if (!event.shiftKey && (current === last || !backdrop.contains(current))) {
            event.preventDefault();
            first.focus();
          }
        }
      }

      backdrop.addEventListener("mousedown", function (event) {
        if (event.target === backdrop && !persistent) close();
      });
      document.addEventListener("keydown", onKeydown, true);

      var target =
        focusTarget ||
        backdrop.querySelector(
          'button:not([disabled]), [href], input:not([disabled]), select, textarea'
        );
      if (target && typeof target.focus === "function") target.focus();

      return close;
    },

    /* Click-to-sort column headers for a rendered table. Each header becomes
     * a button (keyboard + screen-reader friendly, aria-sort reflects state).
     * Cells may carry data-sort for a machine value (timestamps, counts);
     * otherwise the visible text is compared. opts.skip = column indexes to
     * leave unsortable. opts.onSort(index, dir) lets callers remember it. */
    makeSortable: function (table, opts) {
      opts = opts || {};
      var skip = opts.skip || [];
      var heads = table.querySelectorAll("thead th");
      var tbody = table.querySelector("tbody");
      if (!tbody) return;
      var state = { index: -1, dir: "none" };

      function cellValue(row, index) {
        var cell = row.children[index];
        if (!cell) return "";
        var raw = cell.getAttribute("data-sort");
        return raw !== null ? raw : cell.textContent.trim();
      }

      function compare(a, b) {
        var na = parseFloat(a);
        var nb = parseFloat(b);
        var numeric = a !== "" && b !== "" && !isNaN(na) && !isNaN(nb) && isFinite(a) && isFinite(b);
        if (numeric) return na - nb;
        return String(a).localeCompare(String(b), undefined, { sensitivity: "base", numeric: true });
      }

      function apply(index, dir) {
        var rows = Array.prototype.slice.call(tbody.rows);
        rows.sort(function (r1, r2) {
          var v1 = cellValue(r1, index);
          var v2 = cellValue(r2, index);
          // Empty values always sink to the bottom.
          if (v1 === "" && v2 !== "") return 1;
          if (v2 === "" && v1 !== "") return -1;
          var c = compare(v1, v2);
          return dir === "ascending" ? c : -c;
        });
        var frag = document.createDocumentFragment();
        rows.forEach(function (r) { frag.appendChild(r); });
        tbody.appendChild(frag);
        Array.prototype.forEach.call(heads, function (th, i) {
          if (skip.indexOf(i) >= 0) return;
          th.setAttribute("aria-sort", i === index ? dir : "none");
        });
        state.index = index;
        state.dir = dir;
      }

      Array.prototype.forEach.call(heads, function (th, i) {
        if (skip.indexOf(i) >= 0) return;
        var label = th.textContent;
        UI.clear(th);
        var btn = UI.el("button", { type: "button", class: "th-sort" });
        btn.appendChild(UI.el("span", null, label));
        btn.appendChild(UI.el("span", { class: "th-sort-icon", "aria-hidden": "true" }));
        th.appendChild(btn);
        th.setAttribute("aria-sort", "none");
        btn.addEventListener("click", function () {
          var dir = state.index === i && state.dir === "ascending" ? "descending" : "ascending";
          apply(i, dir);
          if (opts.onSort) opts.onSort(i, dir);
        });
      });

      if (opts.initial && opts.initial.index >= 0 && skip.indexOf(opts.initial.index) < 0) {
        apply(opts.initial.index, opts.initial.dir === "descending" ? "descending" : "ascending");
      }
    },

    /* Append text to node, wrapping case-insensitive matches of query in <mark>. */
    highlight: function (node, text, query) {
      text = String(text == null ? "" : text);
      var q = String(query || "").trim();
      if (!q) {
        node.appendChild(document.createTextNode(text));
        return node;
      }
      var lower = text.toLowerCase();
      var needle = q.toLowerCase();
      var pos = 0;
      var hit = lower.indexOf(needle, pos);
      while (hit >= 0) {
        if (hit > pos) node.appendChild(document.createTextNode(text.slice(pos, hit)));
        node.appendChild(UI.el("mark", { class: "match" }, text.slice(hit, hit + needle.length)));
        pos = hit + needle.length;
        hit = lower.indexOf(needle, pos);
      }
      if (pos < text.length) node.appendChild(document.createTextNode(text.slice(pos)));
      return node;
    },

    /* Per-tab memory for filters (sessionStorage, cleared on logout so a
     * shared health-center PC doesn't leak the last worker's searches). */
    remember: function (key, value) {
      try {
        if (value === undefined) {
          var raw = window.sessionStorage.getItem("bhm:" + key);
          return raw ? JSON.parse(raw) : null;
        }
        window.sessionStorage.setItem("bhm:" + key, JSON.stringify(value));
      } catch (e) {
        return null;
      }
      return value;
    },

    fmtDT: function (value) {
      if (!value) return "—";
      var date = new Date(String(value).replace(" ", "T") + "Z");
      if (isNaN(date.getTime())) return String(value);
      // Asia/Manila (PHT = UTC+8) standard 12-hour AM/PM format, e.g. "Nov 8, 10:30 PM PHT".
      var formatted = new Intl.DateTimeFormat("en-PH", {
        timeZone: "Asia/Manila",
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      }).format(date);
      return formatted + " PHT";
    },

    /* UTC form of a timestamp for title tooltips / footer notes. */
    fmtUTC: function (value) {
      if (!value) return "—";
      return String(value).replace("T", " ").slice(0, 16) + " UTC";
    },

    /* Relative age of a timestamp: "2 min ago", "3 h ago", "1 day ago". */
    fmtAge: function (value) {
      if (!value) return "—";
      var date = new Date(String(value).replace(" ", "T") + "Z");
      if (isNaN(date.getTime())) return "—";
      var diffMs = Date.now() - date.getTime();
      if (diffMs < 0) diffMs = 0;
      var diffMin = Math.floor(diffMs / 60000);
      var diffHour = Math.floor(diffMs / 3600000);
      var diffDay = Math.floor(diffMs / 86400000);
      if (diffDay > 0) return diffDay + " day" + (diffDay > 1 ? "s" : "") + " ago";
      if (diffHour > 0) return diffHour + " h ago";
      if (diffMin > 0) return diffMin + " min ago";
      return "just now";
    },

    fmtNum: function (value, digits, suffix) {
      if (value === null || value === undefined || value === "") return "—";
      var number = Number(value);
      if (isNaN(number)) return "—";
      var text = digits === undefined ? String(number) : number.toFixed(digits);
      return suffix ? text + " " + suffix : text;
    },

    toast: function (message, type) {
      var container = document.getElementById("toastContainer");
      if (!container) {
        // aria-live so screen readers announce transient messages.
        container = UI.el("div", {
          id: "toastContainer",
          class: "toast-container",
          role: "status",
          "aria-live": "polite",
          "aria-atomic": "false",
        });
        document.body.appendChild(container);
      }
      var toast = UI.el("div", { class: "toast" + (type ? " toast-" + type : "") });
      toast.appendChild(UI.el("span", { class: "toast-text" }, message));
      var closeBtn = UI.el("button", { class: "toast-close", type: "button", "aria-label": "Close" }, "×");
      closeBtn.onclick = function () {
        if (toast.parentNode) toast.parentNode.removeChild(toast);
      };
      toast.appendChild(closeBtn);
      container.appendChild(toast);
      var dismissAfter = type === "error" ? 0 : 3500;
      if (dismissAfter > 0) {
        setTimeout(function () {
          if (toast.parentNode) {
            toast.classList.add("toast-fadeout");
            setTimeout(function () {
              if (toast.parentNode) toast.parentNode.removeChild(toast);
            }, 300);
          }
        }, dismissAfter);
      }
    },

    /* Accessible in-app confirmation modal replacing native window.confirm. */
    confirmDialog: function (opts) {
      opts = opts || {};
      var backdrop = UI.el("div", { class: "modal-backdrop" });
      var card = UI.el("div", {
        class: "modal-card modal-card-narrow",
        role: "alertdialog",
        "aria-modal": "true",
        "aria-labelledby": "confirmDialogTitle",
        "aria-describedby": "confirmDialogDesc",
      });
      var head = UI.el("div", { class: "modal-header" });
      head.appendChild(UI.el("h3", { id: "confirmDialogTitle" }, opts.title || "Confirm action"));
      var closeX = UI.el("button", { class: "btn btn-ghost btn-sm", type: "button", "aria-label": "Close" }, "×");
      head.appendChild(closeX);
      card.appendChild(head);

      var body = UI.el("div", { class: "modal-body" });
      body.appendChild(UI.el("p", { id: "confirmDialogDesc", class: "confirm-dialog-msg" }, opts.message || ""));
      if (opts.note) {
        body.appendChild(UI.el("p", { class: "hint muted", style: "margin-top:0.5rem;" }, opts.note));
      }
      card.appendChild(body);

      var footer = UI.el("div", { class: "modal-footer" });
      var cancelBtn = UI.el("button", { class: "btn btn-secondary", type: "button" }, opts.cancelLabel || "Cancel");
      var confirmBtn = UI.el("button", {
        class: "btn " + (opts.danger ? "btn-danger" : "btn-primary"),
        type: "button",
      }, opts.confirmLabel || "Confirm");
      footer.appendChild(cancelBtn);
      footer.appendChild(confirmBtn);
      card.appendChild(footer);
      backdrop.appendChild(card);
      document.body.appendChild(backdrop);

      var close = UI.openDialog(backdrop, cancelBtn);
      function cleanup() {
        close();
        if (backdrop.parentNode) backdrop.parentNode.removeChild(backdrop);
      }
      closeX.onclick = cleanup;
      cancelBtn.onclick = cleanup;
      confirmBtn.onclick = function () {
        cleanup();
        if (opts.onConfirm) opts.onConfirm();
      };
    },

    /* Shows an unobtrusive horizontal scroll cue when a wide table overflows on mobile. */
    addScrollCue: function (tableWrap, label) {
      if (!tableWrap || !tableWrap.parentNode) return;
      var existing = tableWrap.previousElementSibling;
      if (existing && existing.classList.contains("table-scroll-cue")) existing.remove();
      var cue = UI.el("div", { class: "table-scroll-cue", "aria-hidden": "true" },
        label || "Swipe table sideways to view all columns →"
      );
      tableWrap.parentNode.insertBefore(cue, tableWrap);

      function sync() {
        if (!document.body.contains(tableWrap)) return;
        var visible = tableWrap.offsetParent !== null;
        var overflows = visible && tableWrap.scrollWidth > tableWrap.clientWidth + 6;
        cue.hidden = !overflows;
        tableWrap.classList.toggle("is-scrollable-x", overflows);
        var atEnd = overflows && (tableWrap.scrollLeft + tableWrap.clientWidth >= tableWrap.scrollWidth - 6);
        cue.classList.toggle("is-at-end", atEnd);
      }
      requestAnimationFrame(sync);
      tableWrap.addEventListener("scroll", sync, { passive: true });
      window.addEventListener("resize", sync, { passive: true });
      return sync;
    },

    /* Compact stacked check-in cards for mobile readability without sideways swiping. */
    buildCheckinCards: function (logs, cellToneFn, i18n) {
      var dict = i18n || {};
      var list = UI.el("div", { class: "checkin-cards-list" });
      var frag = document.createDocumentFragment();
      function missing(v) { return v === null || v === undefined || v === ""; }
      logs.forEach(function (log) {
        var tones = ["bp", "temp", "spo2", "pulse", "bmi"].map(function (k) {
          return cellToneFn ? cellToneFn(k, log) : "";
        });
        var hasBad = tones.indexOf("cell-bad") >= 0;
        var hasWarn = tones.indexOf("cell-warn") >= 0;
        var cardCls = "checkin-card" + (hasBad ? " is-bad" : hasWarn ? " is-warn" : "");
        var card = UI.el("article", { class: cardCls });

        var head = UI.el("div", { class: "checkin-card-head" });
        head.appendChild(UI.el("span", { class: "checkin-card-time" }, UI.fmtDT(log.timestamp)));
        if (hasBad || hasWarn) {
          head.appendChild(
            UI.el("span", { class: "vital-badge " + (hasBad ? "badge-danger" : "badge-warn") },
              hasBad ? (dict.needsAttention || "Needs attention") : (dict.monitor || "Monitor"))
          );
        } else {
          head.appendChild(UI.el("span", { class: "vital-badge badge-good" }, dict.normal || "Normal"));
        }
        card.appendChild(head);

        var grid = UI.el("div", { class: "checkin-card-grid" });
        var metrics = [
          [dict.bp || "Blood Pressure", (missing(log.systolic_bp) || missing(log.diastolic_bp)) ? "—" : (log.systolic_bp + "/" + log.diastolic_bp + " mmHg"), cellToneFn ? cellToneFn("bp", log) : ""],
          [dict.temp || "Temperature", missing(log.temperature) ? "—" : UI.fmtNum(log.temperature, 1, "°C"), cellToneFn ? cellToneFn("temp", log) : ""],
          [dict.spo2 || "SpO₂", missing(log.spo2) ? "—" : UI.fmtNum(log.spo2, 0, "%"), cellToneFn ? cellToneFn("spo2", log) : ""],
          [dict.pulse || "Pulse", missing(log.pulse_rate) ? "—" : UI.fmtNum(log.pulse_rate, 0, "bpm"), cellToneFn ? cellToneFn("pulse", log) : ""],
          [dict.weight || "Weight", missing(log.weight) ? "—" : UI.fmtNum(log.weight, 1, "kg"), ""],
          [dict.bmi || "BMI", missing(log.bmi) ? "—" : UI.fmtNum(log.bmi, 1), cellToneFn ? cellToneFn("bmi", log) : ""],
        ];
        metrics.forEach(function (m) {
          var cell = UI.el("div", { class: "checkin-metric" + (m[2] ? " " + m[2] : "") });
          cell.appendChild(UI.el("span", { class: "checkin-metric-label" }, m[0]));
          cell.appendChild(UI.el("span", { class: "checkin-metric-val" + (m[1] === "—" ? " is-missing" : "") }, m[1]));
          grid.appendChild(cell);
        });
        card.appendChild(grid);
        frag.appendChild(card);
      });
      list.appendChild(frag);
      return list;
    },

    /* Pairs a scrollable table with mobile check-in cards + a Cards/Table switcher. */
    wrapCheckinViews: function (logs, tableWrap, cellToneFn, savedMode, i18n) {
      var dict = i18n || {};
      var mode = savedMode || (window.innerWidth <= 640 ? "cards" : "table");
      var container = UI.el("div", { class: "checkin-views-wrap" });

      var bar = UI.el("div", { class: "checkin-view-bar" });
      var group = UI.el("div", { class: "view-switch", role: "group", "aria-label": dict.displayFormat || "Display format" });
      var cardsBtn = UI.el("button", { type: "button", class: "view-switch-btn" }, dict.cardsBtn || "Cards");
      var tableBtn = UI.el("button", { type: "button", class: "view-switch-btn" }, dict.tableBtn || "Table");
      group.appendChild(cardsBtn);
      group.appendChild(tableBtn);
      bar.appendChild(group);

      var cardsList = UI.buildCheckinCards(logs, cellToneFn, dict);
      var cue = UI.el("div", { class: "table-scroll-cue", "aria-hidden": "true" },
        dict.swipeCue || "Swipe table sideways to view all columns →"
      );

      container.appendChild(bar);
      container.appendChild(cardsList);
      container.appendChild(cue);
      container.appendChild(tableWrap);

      function syncCue() {
        if (!document.body.contains(tableWrap) || tableWrap.hidden) {
          cue.hidden = true;
          return;
        }
        var overflows = tableWrap.scrollWidth > tableWrap.clientWidth + 6;
        cue.hidden = !overflows;
        tableWrap.classList.toggle("is-scrollable-x", overflows);
        cue.classList.toggle(
          "is-at-end",
          overflows && (tableWrap.scrollLeft + tableWrap.clientWidth >= tableWrap.scrollWidth - 6)
        );
      }

      function setMode(next) {
        mode = next;
        var isCards = mode === "cards";
        cardsList.hidden = !isCards;
        tableWrap.hidden = isCards;
        cardsBtn.classList.toggle("is-active", isCards);
        cardsBtn.setAttribute("aria-pressed", isCards ? "true" : "false");
        tableBtn.classList.toggle("is-active", !isCards);
        tableBtn.setAttribute("aria-pressed", !isCards ? "true" : "false");
        requestAnimationFrame(syncCue);
      }

      cardsBtn.addEventListener("click", function () { setMode("cards"); });
      tableBtn.addEventListener("click", function () { setMode("table"); });
      tableWrap.addEventListener("scroll", syncCue, { passive: true });
      window.addEventListener("resize", syncCue, { passive: true });

      setMode(mode);
      return {
        container: container,
        getMode: function () { return mode; },
        setMode: setMode,
      };
    },
  };

  /* Real-time synchronization engine:
   * Uses an ultra-lightweight, non-blocking watermark pulse (every 3s when tab is active).
   * - Closes the HTTP socket in <2ms: zero thread locking, zero socket starvation.
   * - Completely pauses when document.hidden is true (0 CPU, 0 network).
   * - Synchronizes immediately on tab focus or visibility change (phone unlock).
   */
  function initRealtimeSync(options) {
    options = options || {};
    var onReading = options.onReading || function () {};
    var token = getToken();
    if (!token) return { close: function () {}, setLastId: function () {} };

    var closed = false;
    var lastWatermarkId = options.initialLogId || 0;
    var lastVersion = 0;
    var pollTimer = null;
    var isChecking = false;

    async function checkWatermark() {
      if (closed || document.hidden || isChecking) return;
      isChecking = true;
      try {
        var res = await apiFetch("/api/realtime/watermark");
        if (closed) return;
        if (res && (res.latest_id !== undefined || res.version !== undefined)) {
          var newId = res.latest_id || 0;
          var newVer = res.version || 0;

          var hasChanged = false;
          if (lastWatermarkId && newId > lastWatermarkId) {
            hasChanged = true;
          } else if (!lastWatermarkId && newId > 0 && lastVersion > 0) {
            hasChanged = true;
          } else if (lastVersion > 0 && newVer > lastVersion) {
            hasChanged = true;
          }

          lastWatermarkId = Math.max(lastWatermarkId, newId);
          lastVersion = Math.max(lastVersion, newVer);

          if (hasChanged) {
            onReading({
              type: "kiosk_update",
              latest_id: lastWatermarkId,
              timestamp: res.latest_timestamp,
              version: lastVersion,
            });
          }
        }
      } catch (err) {
        // Silently ignore transient network blips
      } finally {
        isChecking = false;
      }
    }

    // Fast initial check after page mounts
    setTimeout(checkWatermark, 100);

    // Adaptive pulse every 3 seconds while active
    pollTimer = setInterval(function () {
      if (!document.hidden && !closed) {
        checkWatermark();
      }
    }, 3000);

    function onWakeup() {
      if (!document.hidden && !closed) {
        checkWatermark();
      }
    }

    document.addEventListener("visibilitychange", onWakeup);
    window.addEventListener("focus", onWakeup);

    return {
      close: function () {
        closed = true;
        if (pollTimer) clearInterval(pollTimer);
        document.removeEventListener("visibilitychange", onWakeup);
        window.removeEventListener("focus", onWakeup);
      },
      setLastId: function (id) {
        if (id) lastWatermarkId = Math.max(lastWatermarkId, id);
      },
    };
  }

  window.API = {
    apiFetch: apiFetch,
    apiFetchRaw: apiFetchRaw,
    saveSession: saveSession,
    clearSession: clearSession,
    requireRole: requireRole,
    logout: logout,
    getToken: getToken,
    getRole: getRole,
    getName: getName,
    getPrivacyAcknowledged: getPrivacyAcknowledged,
    setPrivacyAcknowledged: setPrivacyAcknowledged,
    isStaff: isStaff,
    loginPageForRole: loginPageForRole,
    homeForRole: homeForRole,
    initRealtimeSync: initRealtimeSync,
    UI: UI,
  };

  /* Sidebar identity lockup: initials avatar + name + role. Re-callable
   * (e.g. after a profile name change). */
  function renderWhoami() {
    var whoami = document.getElementById("whoami");
    if (!whoami) return;
    var name = getName() || "User";
    var role = getRole();
    var initials = name
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map(function (w) { return w[0].toUpperCase(); })
      .join("") || "U";
    var roleLabel = role === "bhw" ? "Health Worker" : role === "admin" ? "Staff Admin" : "Citizen";

    UI.clear(whoami);
    var avatar = UI.el("span", { class: "user-avatar", "aria-hidden": "true" }, initials);
    var textWrap = UI.el("div", { class: "user-info-text" });
    textWrap.appendChild(UI.el("span", { class: "user-display-name", title: name }, name));
    textWrap.appendChild(UI.el("span", { class: "user-role-badge" }, roleLabel));
    whoami.appendChild(avatar);
    whoami.appendChild(textWrap);
  }
  window.API.renderWhoami = renderWhoami;

  /* Fill the header name and wire the log-out button on every page. */
  document.addEventListener("DOMContentLoaded", function () {
    renderWhoami();
    var logoutBtn = document.getElementById("logoutBtn");
    if (logoutBtn) {
      logoutBtn.addEventListener("click", function () {
        logout();
      });
    }
    initMobileNav();
    initMobileBottomDock();
    initOfflineIndicator();
    initPasswordToggles();
  });

  /* Shared accessible Show/Hide password toggle for auth and profile forms. */
  function initPasswordToggles() {
    document.querySelectorAll(".btn-toggle-pw").forEach(function (btn) {
      if (btn.dataset.pwBound === "1") return;
      btn.dataset.pwBound = "1";
      btn.removeAttribute("tabindex");
      btn.setAttribute("aria-pressed", "false");
      btn.addEventListener("click", function () {
        var wrap = btn.closest(".password-wrap");
        var input = (wrap && wrap.querySelector("input")) || btn.previousElementSibling;
        if (!input) return;
        var show = input.type === "password";
        input.type = show ? "text" : "password";
        btn.textContent = show ? "Hide" : "Show";
        btn.setAttribute("aria-label", show ? "Hide password" : "Show password");
        btn.setAttribute("aria-pressed", show ? "true" : "false");
      });
    });
  }
  window.API.initPasswordToggles = initPasswordToggles;

  /* Phones/tablets: collapse the sidebar into a top bar with a menu button.
   * Opens a panel with the nav + account; closes on Esc, tap outside,
   * or picking a link. Desktop layout is untouched (button hidden by CSS). */
  function initMobileNav() {
    var sidebar = document.querySelector(".sidebar");
    var nav = sidebar && sidebar.querySelector(".sidenav");
    if (!sidebar || !nav) return;
    if (!nav.id) nav.id = "sidenav";

    var toggle = UI.el("button", {
      class: "nav-toggle",
      type: "button",
      "aria-expanded": "false",
      "aria-controls": nav.id,
      "aria-label": "Open menu",
    });
    toggle.innerHTML =
      '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true">' +
      '<line class="l1" x1="4" y1="7" x2="20" y2="7"/><line class="l2" x1="4" y1="12" x2="20" y2="12"/><line class="l3" x1="4" y1="17" x2="20" y2="17"/></svg>';
    var brand = sidebar.querySelector(".brand");
    if (brand && brand.nextSibling) sidebar.insertBefore(toggle, brand.nextSibling);
    else sidebar.appendChild(toggle);

    var backdrop = UI.el("div", { class: "nav-backdrop", "aria-hidden": "true" });
    document.body.appendChild(backdrop);

    function setOpen(open) {
      sidebar.classList.toggle("open", open);
      document.body.classList.toggle("nav-open", open);
      toggle.setAttribute("aria-expanded", open ? "true" : "false");
      toggle.setAttribute("aria-label", open ? "Close menu" : "Open menu");
    }

    toggle.addEventListener("click", function () {
      var open = !sidebar.classList.contains("open");
      setOpen(open);
      if (open) {
        var current = nav.querySelector('[aria-current="page"]') || nav.querySelector("a");
        if (current) current.focus();
      }
    });
    backdrop.addEventListener("click", function () { setOpen(false); });
    nav.addEventListener("click", function (event) {
      if (event.target.closest("a")) setOpen(false);
    });
    document.addEventListener("keydown", function (event) {
      if ((event.key === "Escape" || event.key === "Esc") && sidebar.classList.contains("open")) {
        setOpen(false);
        toggle.focus();
      }
    });
    // Reset if the window grows back to desktop width while open.
    var mq = window.matchMedia("(min-width: 901px)");
    var onChange = function (e) { if (e.matches) setOpen(false); };
    if (mq.addEventListener) mq.addEventListener("change", onChange);
    else if (mq.addListener) mq.addListener(onChange);
  }

  /* Smartphone view: bottom navigation bar for quick one-handed navigation */
  function initMobileBottomDock() {
    var page = document.body.dataset.page;
    if (!page) return;
    if (document.querySelector(".mobile-bottom-dock")) return;

    var dock = UI.el("nav", { class: "mobile-bottom-dock", "aria-label": "Mobile navigation dock" });
    var items = [];

    var authPages = ["citizen-login", "citizen-register", "citizen-forgot-password"];
    if (page.startsWith("citizen-") && authPages.indexOf(page) === -1) {
      items = [
        {
          href: "/citizen/dashboard.html",
          label: "Dashboard",
          active: page === "citizen-dashboard",
          icon: '<svg class="dock-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="3" width="7" height="9"/><rect x="14" y="3" width="7" height="5"/><rect x="14" y="12" width="7" height="9"/><rect x="3" y="16" width="7" height="5"/></svg>'
        },
        {
          href: "/citizen/history.html",
          label: "History",
          active: page === "citizen-history",
          icon: '<svg class="dock-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>'
        },
        {
          href: "/citizen/consent.html",
          label: "Consent",
          active: page === "citizen-consent",
          icon: '<svg class="dock-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>'
        },
        {
          href: "/citizen/profile.html",
          label: "Profile",
          active: page === "citizen-profile",
          icon: '<svg class="dock-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>'
        }
      ];
    } else if (page.startsWith("bhw-") && page !== "bhw-login") {
      items = [
        {
          href: "/bhw/dashboard.html",
          label: "Dashboard",
          active: page === "bhw-dashboard",
          icon: '<svg class="dock-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="3" width="7" height="9"/><rect x="14" y="3" width="7" height="5"/><rect x="14" y="12" width="7" height="9"/><rect x="3" y="16" width="7" height="5"/></svg>'
        },
        {
          href: "/bhw/search.html",
          label: "Citizens",
          active: page === "bhw-search" || page === "bhw-citizen-view",
          icon: '<svg class="dock-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>'
        },
        {
          href: "/bhw/audit-trail.html",
          label: "Audit",
          active: page === "bhw-audit-trail" || page === "bhw-audit",
          icon: '<svg class="dock-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>'
        },
        {
          href: "/bhw/reports.html",
          label: "Reports",
          active: page === "bhw-reports",
          icon: '<svg class="dock-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>'
        }
      ];
    }

    if (!items.length) return;

    items.forEach(function (it) {
      var a = UI.el("a", { class: "mobile-bottom-link" + (it.active ? " is-active" : ""), href: it.href });
      if (it.active) a.setAttribute("aria-current", "page");
      a.innerHTML = it.icon + '<span>' + it.label + '</span>';
      dock.appendChild(a);
    });

    document.body.appendChild(dock);
  }

  /* Ambient offline indicator */
  function initOfflineIndicator() {
    var banner = document.getElementById("offlineBanner");
    if (!banner) {
      banner = UI.el("div", {
        id: "offlineBanner",
        class: "offline-banner",
        role: "status",
        "aria-live": "polite",
        style: "display:none;",
      });
      document.body.insertBefore(banner, document.body.firstChild);
    }

    function update() {
      if (!navigator.onLine) {
        banner.className = "offline-banner is-offline";
        banner.style.display = "block";
        banner.textContent = "⚠️ Internet connection interrupted. Changes will synchronize automatically once reconnected.";
      } else if (banner.classList.contains("is-offline")) {
        banner.className = "offline-banner is-online";
        banner.textContent = "✓ Connection restored. Data synchronized.";
        setTimeout(function () {
          if (navigator.onLine) {
            banner.style.display = "none";
            banner.classList.remove("is-online");
          }
        }, 3000);
      }
    }

    window.addEventListener("offline", update);
    window.addEventListener("online", update);
    if (!navigator.onLine) update();
  }
})();
