/* Barangay Health Worker portal behaviour (login, dashboard, search, citizen
 * record, audit trail, reports). All API calls go through API.apiFetch. */
(function () {
  "use strict";

  var U = API.UI;
  var dashboardCharts = {};

  /* ---------------- helpers ---------------- */

  function setBusy(button, busy, label) {
    if (!button) return;
    if (busy) {
      button.dataset.label = button.textContent;
      button.textContent = label || "Please wait…";
      button.disabled = true;
    } else {
      button.textContent = button.dataset.label || button.textContent;
      button.disabled = false;
    }
  }

  function showNote(node, message, isError) {
    if (!node) return;
    U.clear(node);
    node.appendChild(
      U.el(
        "div",
        {
          class: "notice" + (isError ? " warn" : ""),
          role: isError ? "alert" : "status",
        },
        message
      )
    );
  }

  function fieldValue(id) {
    var node = document.getElementById(id);
    return node ? node.value.trim() : "";
  }

  function setEmptyRow(wrap, message) {
    U.empty(wrap, message);
  }

  /* ---------------- login ---------------- */

  function initBhwLogin() {
    var form = document.getElementById("loginForm");
    if (!form) return;
    var errorNode = document.getElementById("loginError");
    var submit = document.getElementById("loginSubmit");

    form.addEventListener("submit", async function (event) {
      event.preventDefault();
      errorNode.textContent = "";
      var username = fieldValue("username");
      var password = document.getElementById("password").value;
      if (!username || !password) {
        errorNode.textContent = "Enter your username and password.";
        return;
      }
      setBusy(submit, true, "Signing in…");
      try {
        var data = await API.apiFetch("/api/login", {
          method: "POST",
          body: { username: username, password: password },
        });
        if (data.role !== "bhw" && data.role !== "admin") {
          errorNode.textContent =
            "This portal is for Barangay Health Workers. Citizens sign in through the citizen portal.";
          setBusy(submit, false);
          return;
        }
        API.saveSession(data.token, data.role, data.full_name);
        location.href = "/bhw/dashboard.html";
      } catch (error) {
        errorNode.textContent = error.message;
        setBusy(submit, false);
      }
    });
  }

  /* ---------------- dashboard ---------------- */

  function totalCard(label, value) {
    var card = U.el("div", { class: "total" });
    card.appendChild(U.el("div", { class: "label" }, label));
    card.appendChild(U.el("div", { class: "value" }, String(value)));
    return card;
  }

  function destroyChart(key) {
    if (dashboardCharts[key]) {
      dashboardCharts[key].destroy();
      delete dashboardCharts[key];
    }
  }

  function distributionTable(keys, data) {
    var wrap = U.el("div");
    var table = U.el("table");
    var thead = U.el("thead");
    var headRow = U.el("tr");
    headRow.appendChild(U.el("th", null, "Category"));
    headRow.appendChild(U.el("th", { class: "num" }, "Count"));
    thead.appendChild(headRow);
    table.appendChild(thead);
    var tbody = U.el("tbody");
    keys.forEach(function (key) {
      var row = U.el("tr");
      row.appendChild(U.el("td", null, key));
      row.appendChild(U.el("td", { class: "num" }, String(data[key])));
      tbody.appendChild(row);
    });
    table.appendChild(tbody);
    wrap.appendChild(table);
    return wrap;
  }

  var DIST_ORDER = {
    bmi: ["Underweight", "Normal", "Overweight", "Obese"],
    bp: ["Normal", "Elevated", "Stage 1", "Stage 2", "Crisis"],
    spo2: ["Normal", "Low", "Critical"],
  };

  var DIST_COLORS = {
    Underweight: "#8a5a00",
    Normal: "#0f6b53",
    Overweight: "#b9761b",
    Obese: "#a5271d",
    Elevated: "#b9761b",
    "Stage 1": "#c26a12",
    "Stage 2": "#a5271d",
    Crisis: "#7d1a13",
    Low: "#b9761b",
    Critical: "#a5271d",
  };

  function renderDistribution(container, key, title, data) {
    var box = U.el("div", { class: "chart-box" });
    box.appendChild(U.el("h2", null, title));
    var order = DIST_ORDER[key] || [];
    var keys = order.filter(function (name) {
      return data[name] !== undefined && data[name] > 0;
    });
    Object.keys(data).forEach(function (name) {
      if (keys.indexOf(name) === -1 && data[name] > 0) keys.push(name);
    });

    if (!keys.length) {
      box.appendChild(U.el("div", { class: "status empty" }, "No measurements in this period."));
      container.appendChild(box);
      return;
    }

    if (window.Chart) {
      var canvas = U.el("canvas", {
        height: "170",
        role: "img",
        "aria-label": title + " bar chart: " + keys.map(function (name) {
          return name + " " + data[name];
        }).join(", "),
      });
      box.appendChild(canvas);
      container.appendChild(box);
      destroyChart("dist-" + key);
      dashboardCharts["dist-" + key] = new window.Chart(canvas, {
        type: "bar",
        data: {
          labels: keys,
          datasets: [
            {
              data: keys.map(function (name) {
                return data[name];
              }),
              backgroundColor: keys.map(function (name) {
                return DIST_COLORS[name] || "#0f6b53";
              }),
              borderRadius: 6,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: true,
          aspectRatio: 1.9,
          plugins: { legend: { display: false } },
          scales: {
            x: { ticks: { maxRotation: 0, autoSkip: false } },
            y: { beginAtZero: true, ticks: { precision: 0 } },
          },
        },
      });
      return;
    }

    var wrap = U.el("div", { class: "table-wrap", style: "box-shadow:none" });
    wrap.appendChild(distributionTable(keys, data));
    box.appendChild(wrap);
    container.appendChild(box);
  }

  function renderFeverChart(trend) {
    var note = document.getElementById("feverFallback");
    var canvas = document.getElementById("feverChart");
    U.clear(note);
    destroyChart("fever");

    if (!trend || !trend.length) {
      if (canvas) canvas.hidden = true;
      U.empty(note, "No fever-range readings in this period.");
      return;
    }
    if (!window.Chart) {
      if (canvas) canvas.hidden = true;
      U.empty(note, "Chart library unavailable — fever counts: " +
        trend.map(function (item) {
          return item[0] + ": " + item[1];
        }).join(", "));
      return;
    }
    canvas.hidden = false;
    dashboardCharts.fever = new window.Chart(canvas, {
      type: "line",
      data: {
        labels: trend.map(function (item) {
          return item[0];
        }),
        datasets: [
          {
            label: "Fever readings",
            data: trend.map(function (item) {
              return item[1];
            }),
            borderColor: "#a5271d",
            backgroundColor: "rgba(165, 39, 29, 0.12)",
            fill: true,
            tension: 0.25,
            pointRadius: 3,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        aspectRatio: 2,
        plugins: { legend: { display: false } },
        scales: {
          x: { ticks: { maxTicksLimit: 8, maxRotation: 0 } },
          y: { beginAtZero: true, ticks: { precision: 0 } },
        },
      },
    });
  }

  function renderConcerns(concerns) {
    var list = document.getElementById("concerns");
    var emptyNode = document.getElementById("concernsEmpty");
    U.clear(list);
    if (!concerns.length) {
      emptyNode.hidden = false;
      return;
    }
    emptyNode.hidden = true;
    concerns.forEach(function (item) {
      var row = U.el("li");
      row.appendChild(U.el("span", null, item[0]));
      row.appendChild(U.el("span", { class: "count" }, String(item[1])));
      list.appendChild(row);
    });
  }

  async function loadDashboard() {
    var periodNode = document.getElementById("period");
    var statusNode = document.getElementById("status");
    var totalsNode = document.getElementById("totals");
    var distNode = document.getElementById("distributions");
    var days = periodNode.value;

    U.loading(statusNode, "Loading community aggregates…");
    U.clear(totalsNode);
    U.clear(distNode);
    U.clear(document.getElementById("concerns"));
    var fallback = document.getElementById("feverFallback");
    U.clear(fallback);
    var feverCanvas = document.getElementById("feverChart");
    if (feverCanvas) feverCanvas.hidden = false;

    try {
      var data = await API.apiFetch("/api/bhw/dashboard?days=" + encodeURIComponent(days));
      U.clear(statusNode);

      var totals = data.totals || {};
      totalsNode.appendChild(totalCard("Measurements", totals.measurements || 0));
      totalsNode.appendChild(totalCard("Registered users", totals.users || 0));
      totalsNode.appendChild(totalCard("Consent grants", totals.consent_grants || 0));
      totalsNode.appendChild(totalCard("Guest measurements", totals.guest_measurements || 0));
      totalsNode.appendChild(totalCard("Alerts", totals.alerts || 0));

      var distributions = data.distributions || {};
      renderDistribution(distNode, "bmi", "BMI categories", distributions.bmi || {});
      renderDistribution(distNode, "bp", "Blood pressure categories", distributions.bp || {});
      renderDistribution(distNode, "spo2", "SpO2 categories", distributions.spo2 || {});

      renderFeverChart(data.fever_trend || []);
      renderConcerns(data.top_concerns || []);
    } catch (error) {
      U.clear(totalsNode);
      U.clear(distNode);
      U.clear(document.getElementById("concerns"));
      U.error(statusNode, error.message);
      renderFeverChart([]);
    }
  }

  var refreshTimer = null;

  function initDashboard() {
    if (!API.requireRole("bhw")) return;
    document.getElementById("period").addEventListener("change", loadDashboard);
    document.getElementById("refreshBtn").addEventListener("click", function () {
      loadDashboard();
      U.toast("Dashboard refreshed", "success");
    });

    var toggle = document.getElementById("autoRefreshToggle");
    var liveText = document.getElementById("liveText");
    var secondsLeft = 30;

    function startTimer() {
      if (refreshTimer) clearInterval(refreshTimer);
      secondsLeft = 30;
      refreshTimer = setInterval(function () {
        if (!toggle || !toggle.checked) return;
        secondsLeft--;
        if (liveText) liveText.textContent = "Live (" + secondsLeft + "s)";
        if (secondsLeft <= 0) {
          secondsLeft = 30;
          loadDashboard();
        }
      }, 1000);
    }

    if (toggle) {
      toggle.addEventListener("change", function () {
        if (toggle.checked) {
          startTimer();
          if (liveText) liveText.textContent = "Live (30s)";
        } else {
          if (refreshTimer) clearInterval(refreshTimer);
          if (liveText) liveText.textContent = "Paused";
        }
      });
      startTimer();
    }

    loadDashboard();
  }

  /* ---------------- search ---------------- */

  function consentBadge(granted) {
    return U.el(
      "span",
      { class: "badge " + (granted ? "badge-ok" : "badge-no") },
      granted ? "Granted" : "Not granted"
    );
  }

  function renderCitizens(citizens) {
    var results = document.getElementById("results");
    U.clear(results);
    if (!citizens.length) {
      setEmptyRow(results, "No citizens match this search.");
      return;
    }
    var tableWrap = U.el("div", { class: "table-wrap" });
    var table = U.el("table");
    var thead = U.el("thead");
    var headRow = U.el("tr");
    ["Name", "Username", "Birthdate", "Last measurement (UTC)", "Consent", ""].forEach(function (label) {
      headRow.appendChild(U.el("th", null, label));
    });
    thead.appendChild(headRow);
    table.appendChild(thead);

    var tbody = U.el("tbody");
    citizens.forEach(function (citizen) {
      var row = U.el("tr");
      if (citizen.consent) {
        row.style.background = "#fafdfb";
      }
      row.appendChild(U.el("td", { style: "font-weight:600;" }, citizen.full_name));
      row.appendChild(U.el("td", { class: "muted" }, citizen.username));
      row.appendChild(U.el("td", { class: "nowrap" }, citizen.birthdate || "—"));
      row.appendChild(
        U.el("td", { class: "nowrap" }, citizen.last_measurement ? U.fmtDT(citizen.last_measurement) : "No readings")
      );
      var consentCell = U.el("td");
      consentCell.appendChild(consentBadge(Boolean(citizen.consent)));
      row.appendChild(consentCell);

      var actionCell = U.el("td", { style: "text-align:right;" });
      var button = U.el("button", {
        class: citizen.consent ? "btn btn-primary" : "btn btn-secondary",
        type: "button",
        style: "min-height:2.1rem; padding:0.35rem 0.8rem; font-size:0.85rem;"
      }, "Open record →");
      button.addEventListener("click", function () {
        location.href = "/bhw/citizen-view.html?id=" + encodeURIComponent(citizen.id);
      });
      actionCell.appendChild(button);
      row.appendChild(actionCell);
      tbody.appendChild(row);
    });
    table.appendChild(tbody);
    tableWrap.appendChild(table);
    results.appendChild(tableWrap);
  }

  async function searchCitizens() {
    var statusNode = document.getElementById("status");
    var query = fieldValue("searchInput");
    U.loading(statusNode, "Searching citizens…");
    U.clear(document.getElementById("results"));
    try {
      var data = await API.apiFetch(
        "/api/bhw/citizens?search=" + encodeURIComponent(query)
      );
      U.clear(statusNode);
      renderCitizens(data.citizens || []);
    } catch (error) {
      U.clear(document.getElementById("results"));
      U.error(statusNode, error.message);
    }
  }

  function initSearch() {
    if (!API.requireRole("bhw")) return;
    document.getElementById("searchForm").addEventListener("submit", function (event) {
      event.preventDefault();
      searchCitizens();
    });
    searchCitizens();
  }

  /* ---------------- citizen record ---------------- */

  function readingsTable(logs) {
    var wrap = U.el("div");
    if (!logs.length) {
      U.empty(wrap, "No readings recorded for this citizen yet.");
      return wrap;
    }
    var tableWrap = U.el("div", { class: "table-wrap" });
    var table = U.el("table");
    var thead = U.el("thead");
    var headRow = U.el("tr");
    ["Timestamp (UTC)", "Weight (kg)", "Height (cm)", "BMI", "Temp (°C)", "Pulse (bpm)", "SpO2 (%)", "Blood pressure"].forEach(function (label, index) {
      headRow.appendChild(U.el("th", index === 0 ? null : { class: "num" }, label));
    });
    thead.appendChild(headRow);
    table.appendChild(thead);

    var tbody = U.el("tbody");
    logs.forEach(function (log) {
      var row = U.el("tr");
      row.appendChild(U.el("td", { class: "nowrap" }, U.fmtDT(log.timestamp)));
      [
        U.fmtNum(log.weight, 1),
        U.fmtNum(log.height, 1),
        U.fmtNum(log.bmi, 1),
        U.fmtNum(log.temperature, 1),
        U.fmtNum(log.pulse_rate, 0),
        U.fmtNum(log.spo2, 0),
        log.systolic_bp === null || log.systolic_bp === undefined ||
        log.diastolic_bp === null || log.diastolic_bp === undefined
          ? "—"
          : log.systolic_bp + "/" + log.diastolic_bp,
      ].forEach(function (value) {
        row.appendChild(U.el("td", { class: "num" }, value));
      });
      tbody.appendChild(row);
    });
    table.appendChild(tbody);
    tableWrap.appendChild(table);
    wrap.appendChild(tableWrap);
    return wrap;
  }

  function renderNotes(notes) {
    var area = document.getElementById("notesArea");
    U.clear(area);
    if (!notes.length) {
      U.empty(area, "No notes yet for this citizen.");
      return;
    }
    var list = U.el("ul", { class: "notes-list" });
    notes.forEach(function (note) {
      var item = U.el("li");
      item.appendChild(U.el("div", { class: "text" }, note.note));
      item.appendChild(
        U.el(
          "div",
          { class: "meta" },
          "By " + note.bhw + " · " + U.fmtDT(note.timestamp) + " UTC"
        )
      );
      list.appendChild(item);
    });
    area.appendChild(list);
  }

  function currentCitizenId() {
    var params = new URLSearchParams(location.search);
    var raw = params.get("id");
    if (!raw || !/^\d+$/.test(raw)) return null;
    return raw;
  }

  async function loadNotes(citizenId) {
    var notesData = await API.apiFetch(
      "/api/bhw/citizen/" + encodeURIComponent(citizenId) + "/notes"
    );
    renderNotes(notesData.notes || []);
  }

  function showConsentBlocked() {
    var panel = document.getElementById("consentBlocked");
    U.clear(panel);
    var box = U.el("div", { class: "consent-panel" });
    box.appendChild(U.el("h2", null, "Citizen has not granted consent"));
    box.appendChild(
      U.el(
        "p",
        null,
        "This citizen has not granted consent to share individual records. Their readings are included only in anonymous community totals. Ask the citizen to grant consent from the Citizen Portal if access is clinically needed."
      )
    );
    var link = U.el("a", { class: "btn btn-secondary", href: "/bhw/search.html" }, "Back to search");
    box.appendChild(link);
    panel.appendChild(box);
    document.getElementById("record").hidden = true;
  }

  async function initCitizenView() {
    if (!API.requireRole("bhw")) return;
    var statusNode = document.getElementById("status");
    var citizenId = currentCitizenId();
    if (!citizenId) {
      U.error(statusNode, "No citizen selected. Open a record from the search page.");
      document.getElementById("record").hidden = true;
      return;
    }

    U.loading(statusNode, "Loading citizen record…");
    var data;
    try {
      data = await API.apiFetch(
        "/api/bhw/citizen/" + encodeURIComponent(citizenId) + "/health-logs"
      );
    } catch (error) {
      if (error.status === 403) {
        U.clear(statusNode);
        showConsentBlocked();
        return;
      }
      U.error(statusNode, error.message);
      document.getElementById("record").hidden = true;
      return;
    }

    U.clear(statusNode);
    U.clear(document.getElementById("consentBlocked"));
    var record = document.getElementById("record");
    record.hidden = false;

    var citizen = data.citizen || {};
    document.getElementById("pageTitle").textContent = citizen.full_name || "Citizen record";

    var kv = document.getElementById("profileKv");
    U.clear(kv);
    function addPair(term, value) {
      kv.appendChild(U.el("dt", null, term));
      kv.appendChild(U.el("dd", null, value || "—"));
    }
    addPair("Full name", citizen.full_name);
    addPair("Username", citizen.username);
    addPair("Birthdate", citizen.birthdate);
    addPair("Gender", citizen.gender);

    var consent = data.consent || {};
    document.getElementById("consentLine").textContent =
      "Consent granted on " + U.fmtDT(consent.timestamp) + " UTC.";

    var readings = document.getElementById("readings");
    U.clear(readings);
    readings.appendChild(readingsTable(data.logs || []));

    try {
      await loadNotes(citizenId);
    } catch (error) {
      U.error(document.getElementById("notesArea"), error.message);
    }

    var chipsContainer = document.getElementById("noteChips");
    if (chipsContainer) {
      var chips = chipsContainer.querySelectorAll(".chip");
      chips.forEach(function (btn) {
        btn.onclick = function () {
          var val = btn.getAttribute("data-chip");
          var textarea = document.getElementById("noteText");
          if (textarea) {
            textarea.value = textarea.value ? (textarea.value + " " + val) : val;
            textarea.focus();
          }
        };
      });
    }

    var noteForm = document.getElementById("noteForm");
    noteForm.addEventListener("submit", async function (event) {
      event.preventDefault();
      var errorNode = document.getElementById("noteError");
      var feedback = document.getElementById("noteFeedback");
      errorNode.textContent = "";
      feedback.textContent = "";
      var text = document.getElementById("noteText").value.trim();
      if (!text) {
        errorNode.textContent = "Write a note before saving.";
        return;
      }
      var submit = document.getElementById("noteSubmit");
      setBusy(submit, true, "Saving…");
      try {
        var result = await API.apiFetch(
          "/api/bhw/citizen/" + encodeURIComponent(citizenId) + "/notes",
          { method: "POST", body: { note: text } }
        );
        document.getElementById("noteText").value = "";
        renderNotes(result.notes || []);
        feedback.textContent = "Note saved.";
        U.toast("Note saved successfully", "success");
      } catch (error) {
        errorNode.textContent = error.message;
        U.toast(error.message, "error");
      } finally {
        setBusy(submit, false);
      }
    });

    document.getElementById("referBtn").addEventListener("click", async function () {
      var note = window.prompt(
        "Optional note for the Rural Health Unit referral (leave blank to refer without a note):",
        ""
      );
      if (note === null) return;
      var feedbackNode = document.getElementById("referFeedback");
      if (feedbackNode) feedbackNode.remove();
      var button = document.getElementById("referBtn");
      setBusy(button, true, "Referring…");
      try {
        await API.apiFetch(
          "/api/bhw/citizen/" + encodeURIComponent(citizenId) + "/refer",
          { method: "POST", body: { note: note.trim() } }
        );
        await loadNotes(citizenId);
        var notice = U.el("p", { class: "notice", id: "referFeedback", role: "status" },
          "Referral to the Rural Health Unit recorded.");
        document.getElementById("consentLine").after(notice);
        U.toast("Referral to RHU submitted", "success");
      } catch (error) {
        U.error(statusNode, error.message);
        U.toast(error.message, "error");
      } finally {
        setBusy(button, false);
      }
    });
  }

  /* ---------------- audit trail ---------------- */

  function renderAudit(rows) {
    var results = document.getElementById("results");
    U.clear(results);
    if (!rows.length) {
      setEmptyRow(results, "No audit entries match these filters.");
      return;
    }
    var tableWrap = U.el("div", { class: "table-wrap" });
    var table = U.el("table");
    var thead = U.el("thead");
    var headRow = U.el("tr");
    ["Timestamp (UTC)", "Health worker", "Citizen", "Action", "IP address"].forEach(function (label) {
      headRow.appendChild(U.el("th", null, label));
    });
    thead.appendChild(headRow);
    table.appendChild(thead);

    var tbody = U.el("tbody");
    rows.forEach(function (entry) {
      var row = U.el("tr");
      row.appendChild(U.el("td", { class: "nowrap" }, U.fmtDT(entry.time)));
      row.appendChild(U.el("td", null, entry.bhw_name));
      row.appendChild(U.el("td", null, entry.citizen_name));
      row.appendChild(U.el("td", null, entry.action));
      row.appendChild(U.el("td", null, entry.ip || "—"));
      tbody.appendChild(row);
    });
    table.appendChild(tbody);
    tableWrap.appendChild(table);
    results.appendChild(tableWrap);
  }

  async function loadAudit() {
    var statusNode = document.getElementById("status");
    var params = new URLSearchParams();
    var from = fieldValue("fromDate");
    var to = fieldValue("toDate");
    var bhw = fieldValue("bhwName");
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    if (bhw) params.set("bhw", bhw);

    U.loading(statusNode, "Loading audit entries…");
    U.clear(document.getElementById("results"));
    try {
      var data = await API.apiFetch("/api/bhw/audit-trail?" + params.toString());
      U.clear(statusNode);
      renderAudit(data.audit || []);
    } catch (error) {
      U.clear(document.getElementById("results"));
      U.error(statusNode, error.message);
    }
  }

  function initAudit() {
    if (!API.requireRole("bhw")) return;
    document.getElementById("filterForm").addEventListener("submit", function (event) {
      event.preventDefault();
      loadAudit();
    });
    document.getElementById("clearBtn").addEventListener("click", function () {
      document.getElementById("filterForm").reset();
      loadAudit();
    });
    loadAudit();
  }

  /* ---------------- reports ---------------- */

  function reportPath() {
    var type = document.getElementById("reportType").value;
    var from = fieldValue("fromDate");
    var to = fieldValue("toDate");
    var params = new URLSearchParams();
    params.set("type", type);
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    return { type: type, path: "/api/bhw/reports?" + params.toString() };
  }

  function validateRange(statusNode) {
    var from = fieldValue("fromDate");
    var to = fieldValue("toDate");
    if (from && to && from > to) {
      U.error(statusNode, "The From date must be on or before the To date.");
      return false;
    }
    return true;
  }

  function initReports() {
    if (!API.requireRole("bhw")) return;
    var statusNode = document.getElementById("status");

    document.getElementById("csvBtn").addEventListener("click", async function () {
      if (!validateRange(statusNode)) return;
      var target = reportPath();
      U.loading(statusNode, "Preparing the CSV download…");
      try {
        var response = await API.apiFetchRaw(target.path);
        var blob = await response.blob();
        var url = URL.createObjectURL(blob);
        var link = document.createElement("a");
        link.href = url;
        link.download = target.type + "_report.csv";
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.setTimeout(function () {
          URL.revokeObjectURL(url);
        }, 1500);
        showNote(statusNode, "Download started: " + target.type + "_report.csv");
      } catch (error) {
        U.error(statusNode, error.message);
      }
    });

    function showReportModal(reportType, reportHtml) {
      var backdrop = U.el("div", { class: "modal-backdrop" });
      var card = U.el("div", { class: "modal-card" });

      var header = U.el("div", { class: "modal-header" });
      header.appendChild(U.el("h3", null, "Printable " + reportType.toUpperCase() + " Report Preview"));
      var closeBtn = U.el("button", { class: "btn btn-ghost", type: "button", "aria-label": "Close" }, "✕");
      closeBtn.onclick = function () {
        if (backdrop.parentNode) backdrop.parentNode.removeChild(backdrop);
      };
      header.appendChild(closeBtn);
      card.appendChild(header);

      var body = U.el("div", { class: "modal-body", style: "padding:0; height:500px;" });
      var iframe = U.el("iframe", { style: "width:100%; height:100%; border:none; background:#ffffff;" });
      body.appendChild(iframe);
      card.appendChild(body);

      var footer = U.el("div", { class: "modal-footer" });
      var dismiss = U.el("button", { class: "btn btn-secondary", type: "button" }, "Close");
      dismiss.onclick = function () {
        if (backdrop.parentNode) backdrop.parentNode.removeChild(backdrop);
      };
      var print = U.el("button", { class: "btn btn-primary", type: "button" }, "🖨️ Print Now");
      print.onclick = function () {
        if (iframe.contentWindow) {
          iframe.contentWindow.focus();
          iframe.contentWindow.print();
        }
      };
      footer.appendChild(dismiss);
      footer.appendChild(print);
      card.appendChild(footer);

      backdrop.appendChild(card);
      document.body.appendChild(backdrop);

      setTimeout(function () {
        try {
          var doc = iframe.contentDocument || iframe.contentWindow.document;
          doc.open();
          doc.write(reportHtml);
          doc.close();
        } catch (e) {
          /* fallback */
        }
      }, 50);
    }

    document.getElementById("printBtn").addEventListener("click", async function () {
      if (!validateRange(statusNode)) return;
      var target = reportPath();
      U.loading(statusNode, "Preparing the printable report…");
      try {
        var response = await API.apiFetchRaw(target.path + "&format=print");
        var reportHtml = await response.text();
        U.clearStatus(statusNode);
        showReportModal(target.type, reportHtml);
      } catch (error) {
        U.error(statusNode, error.message);
      }
    });
  }

  /* ---------------- router ---------------- */

  document.addEventListener("DOMContentLoaded", function () {
    var page = document.body.getAttribute("data-page");
    if (page === "bhw-login") initBhwLogin();
    else if (page === "bhw-dashboard") initDashboard();
    else if (page === "bhw-search") initSearch();
    else if (page === "bhw-citizen-view") initCitizenView();
    else if (page === "bhw-audit") initAudit();
    else if (page === "bhw-reports") initReports();
  });
})();
