/* Citizen portal behaviour (login, register, dashboard, history, consent,
 * profile). All API calls go through API.apiFetch / API.apiFetchRaw. */
(function () {
  "use strict";

  var U = API.UI;
  var charts = {};

  /* ---------------- classification (display only) ---------------- */

  function bmiCategory(value) {
    if (value === null || value === undefined) return null;
    if (value < 18.5) return "Underweight";
    if (value < 25) return "Normal";
    if (value < 30) return "Overweight";
    return "Obese";
  }

  function bpCategory(systolic, diastolic) {
    if (systolic === null || systolic === undefined) return null;
    if (diastolic === null || diastolic === undefined) return null;
    if (systolic >= 180 || diastolic >= 120) return "Crisis";
    if (systolic >= 140 || diastolic >= 90) return "Stage 2";
    if (systolic >= 130 || diastolic >= 80) return "Stage 1";
    if (systolic >= 120) return "Elevated";
    return "Normal";
  }

  function spo2Category(value) {
    if (value === null || value === undefined) return null;
    if (value < 90) return "Critical";
    if (value < 95) return "Low";
    return "Normal";
  }

  function isMissing(value) {
    return value === null || value === undefined;
  }

  /* ---------------- shared form helpers ---------------- */

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

  function showFormError(node, message) {
    if (!node) return;
    node.textContent = message || "";
  }

  function fieldValue(id) {
    var node = document.getElementById(id);
    return node ? node.value.trim() : "";
  }

  /* ---------------- login / register ---------------- */

  function initLogin() {
    var form = document.getElementById("loginForm");
    if (!form) return;
    var errorNode = document.getElementById("loginError");
    var submit = document.getElementById("loginSubmit");

    form.addEventListener("submit", async function (event) {
      event.preventDefault();
      showFormError(errorNode, "");
      var username = fieldValue("username");
      var password = document.getElementById("password").value;
      if (!username || !password) {
        showFormError(errorNode, "Enter your username and password.");
        return;
      }
      setBusy(submit, true, "Signing in…");
      try {
        var data = await API.apiFetch("/api/login", {
          method: "POST",
          body: { username: username, password: password },
        });

        if (document.body.getAttribute("data-page") === "bhw-login") {
          if (data.role !== "bhw" && data.role !== "admin") {
            showFormError(
              errorNode,
              "This portal is for Barangay Health Workers. Citizens sign in through the citizen portal."
            );
            setBusy(submit, false);
            return;
          }
          API.saveSession(data.token, data.role, data.full_name);
          location.href = "/bhw/dashboard.html";
          return;
        }

        API.saveSession(data.token, data.role, data.full_name);
        location.href = API.homeForRole(data.role);
      } catch (error) {
        showFormError(errorNode, error.message);
        setBusy(submit, false);
      }
    });
  }

  function initRegister() {
    var form = document.getElementById("registerForm");
    if (!form) return;
    var errorNode = document.getElementById("registerError");
    var successNode = document.getElementById("registerSuccess");
    var submit = document.getElementById("registerSubmit");

    form.addEventListener("submit", async function (event) {
      event.preventDefault();
      showFormError(errorNode, "");
      U.clear(successNode);

      var payload = {
        full_name: fieldValue("fullName"),
        username: fieldValue("username"),
        password: document.getElementById("password").value,
        birthdate: fieldValue("birthdate"),
        gender: fieldValue("gender"),
      };
      if (!payload.full_name || !payload.username || !payload.password || !payload.birthdate) {
        showFormError(errorNode, "Please fill in every field.");
        return;
      }
      if (payload.password.length < 8) {
        showFormError(errorNode, "Password must be at least 8 characters.");
        return;
      }

      setBusy(submit, true, "Creating account…");
      try {
        await API.apiFetch("/api/register", { method: "POST", body: payload });
        form.reset();
        successNode.textContent = "Account created. ";
        var link = U.el("a", { href: "/citizen/login.html" }, "Sign in with your new account");
        successNode.appendChild(link);
        successNode.appendChild(document.createTextNode("."));
        setBusy(submit, false);
      } catch (error) {
        showFormError(errorNode, error.message);
        setBusy(submit, false);
      }
    });
  }

  /* ---------------- dashboard ---------------- */

  function createGauge(trackClass, percent, leftLabel, rightLabel) {
    var wrap = U.el("div", { class: "vitals-gauge" });
    var track = U.el("div", { class: "gauge-track " + trackClass });
    var clamped = Math.max(0, Math.min(100, percent));
    var pin = U.el("div", { class: "gauge-pin" });
    pin.style.left = clamped + "%";
    track.appendChild(pin);
    wrap.appendChild(track);
    var legend = U.el("div", { class: "gauge-legend" });
    legend.appendChild(U.el("span", null, leftLabel));
    legend.appendChild(U.el("span", null, rightLabel));
    wrap.appendChild(legend);
    return wrap;
  }

  function createDelta(diff, unit, lowerIsBetter) {
    if (diff === null || diff === undefined || isNaN(diff)) return null;
    var sign = diff > 0 ? "+" : diff < 0 ? "−" : "±";
    var abs = Math.abs(diff);
    if (abs < 0.05) return U.el("span", { class: "delta neutral" }, "No change");
    var isGood = lowerIsBetter ? diff < 0 : diff > 0;
    var tone = isGood ? "good" : "warn";
    var text = (diff > 0 ? "▲ " : "▼ ") + sign + abs.toFixed(1) + (unit ? " " + unit : "");
    return U.el("span", { class: "delta " + tone }, text);
  }

  function showHealthPassportModal(profile, log) {
    var backdrop = U.el("div", { class: "modal-backdrop" });
    var card = U.el("div", { class: "modal-card health-passport-modal" });

    var header = U.el("div", { class: "modal-header" });
    header.appendChild(U.el("h3", null, "Official Health Passport"));
    var closeBtn = U.el("button", { class: "btn btn-ghost", type: "button", "aria-label": "Close" }, "✕");
    header.appendChild(closeBtn);
    card.appendChild(header);

    var body = U.el("div", { class: "modal-body" });
    var passport = U.el("div", { class: "passport-card" });

    var pHead = U.el("div", { class: "passport-header" });
    pHead.appendChild(U.el("h2", null, "Barangay Health Monitoring"));
    pHead.appendChild(U.el("p", null, "Official Citizen Health Record Card · Republic of the Philippines"));
    passport.appendChild(pHead);

    var infoDl = U.el("dl", { class: "kv", style: "margin-bottom:1rem;" });
    function addInfo(lbl, val) {
      infoDl.appendChild(U.el("dt", null, lbl));
      infoDl.appendChild(U.el("dd", null, val || "—"));
    }
    addInfo("Citizen Name", profile.full_name || API.getName());
    addInfo("Username / ID", profile.username || "—");
    addInfo("Birthdate", profile.birthdate || "—");
    addInfo("Gender", profile.gender ? profile.gender.toUpperCase() : "—");
    passport.appendChild(infoDl);

    var grid = U.el("div", { class: "passport-grid" });
    function addStat(lbl, val, sub) {
      var box = U.el("div", { class: "passport-stat" });
      box.appendChild(U.el("div", { class: "lbl" }, lbl));
      box.appendChild(U.el("div", { class: "val" }, val));
      if (sub) box.appendChild(U.el("div", { class: "sub", style: "font-size:0.75rem; color:#4b6b62;" }, sub));
      grid.appendChild(box);
    }

    if (log) {
      var bmiCat = bmiCategory(log.bmi);
      var bpCat = bpCategory(log.systolic_bp, log.diastolic_bp);
      var spo2Cat = spo2Category(log.spo2);

      addStat("Blood Pressure", (!isMissing(log.systolic_bp) && !isMissing(log.diastolic_bp)) ? (log.systolic_bp + "/" + log.diastolic_bp + " mmHg") : "—", bpCat || "");
      addStat("Body Mass Index", U.fmtNum(log.bmi, 1), bmiCat ? "BMI Category: " + bmiCat : "");
      addStat("Weight & Height", U.fmtNum(log.weight, 1, "kg") + " / " + U.fmtNum(log.height, 1, "cm"), "");
      addStat("Blood Oxygen", U.fmtNum(log.spo2, 0, "%"), spo2Cat || "");
      addStat("Body Temperature", U.fmtNum(log.temperature, 1, "°C"), Number(log.temperature) >= 37.9 ? "Elevated Fever" : "Normal");
      addStat("Pulse Rate", U.fmtNum(log.pulse_rate, 0, "bpm"), "Resting pulse");
    } else {
      grid.appendChild(U.el("p", { class: "muted" }, "No vital readings recorded yet."));
    }
    passport.appendChild(grid);

    var foot = U.el("div", { class: "passport-footer" });
    foot.appendChild(U.el("span", null, "Recorded: " + (log ? U.fmtDT(log.timestamp) + " UTC" : "—")));
    foot.appendChild(U.el("span", { style: "font-weight:700; color:#0b3d30;" }, "✓ VERIFIED BY BARANGAY HEALTH KIOSK"));
    passport.appendChild(foot);

    body.appendChild(passport);
    card.appendChild(body);

    var mFoot = U.el("div", { class: "modal-footer" });
    var printBtn = U.el("button", { class: "btn btn-primary", type: "button" }, "🖨️ Print / Save as PDF");
    printBtn.onclick = function () {
      // body.printing-passport scopes the @media print rules to the passport
      // card only; without it Ctrl+P printed a blank page elsewhere too.
      document.body.classList.add("printing-passport");
      var clearPrintMode = function () {
        document.body.classList.remove("printing-passport");
        window.removeEventListener("afterprint", clearPrintMode);
      };
      window.addEventListener("afterprint", clearPrintMode);
      window.print();
      // Fallback for browsers that never fire afterprint (e.g. some
      // headless/print-to-PDF paths): restore after the print dialog closes.
      setTimeout(clearPrintMode, 1000);
    };
    var dismissBtn = U.el("button", { class: "btn btn-secondary", type: "button" }, "Close");
    mFoot.appendChild(dismissBtn);
    mFoot.appendChild(printBtn);
    card.appendChild(mFoot);

    backdrop.appendChild(card);
    document.body.appendChild(backdrop);

    // Accessible dialog: role/aria-modal/aria-labelledby, Escape and
    // backdrop click close it, focus moves in and is restored on close.
    var closeDialog = U.openDialog(backdrop, closeBtn);
    closeBtn.onclick = closeDialog;
    dismissBtn.onclick = closeDialog;
  }

  function addCard(container, label, value, sub, tone, gauge, delta) {
    var card = U.el("div", { class: "card" + (tone ? " " + tone : "") });
    card.appendChild(U.el("div", { class: "label" }, label));
    card.appendChild(U.el("div", { class: "value" }, value));
    if (sub) card.appendChild(U.el("div", { class: "sub" }, sub));
    if (delta) card.appendChild(delta);
    if (gauge) card.appendChild(gauge);
    container.appendChild(card);
  }

  function renderAlertBanner(log) {
    var banner = document.getElementById("alertBanner");
    if (!banner) return;
    U.clear(banner);

    var alerts = [];
    if (!isMissing(log.systolic_bp) && !isMissing(log.diastolic_bp)) {
      if (log.systolic_bp >= 180 || log.diastolic_bp >= 120) {
        alerts.push("Hypertensive Crisis Level (" + log.systolic_bp + "/" + log.diastolic_bp + " mmHg). Immediate clinical evaluation recommended.");
      } else if (log.systolic_bp >= 140 || log.diastolic_bp >= 90) {
        alerts.push("Stage 2 High Blood Pressure (" + log.systolic_bp + "/" + log.diastolic_bp + " mmHg). Please consult your Barangay Health Worker.");
      } else if (log.systolic_bp >= 130 || log.diastolic_bp >= 80) {
        alerts.push("Stage 1 High Blood Pressure (" + log.systolic_bp + "/" + log.diastolic_bp + " mmHg). Keep an eye on your readings and consult your Barangay Health Worker.");
      }
    }
    if (!isMissing(log.spo2) && log.spo2 <= 90) {
      alerts.push("Critical Low Oxygen Saturation (" + log.spo2 + "%). Please proceed to the health station or nearest facility.");
    }
    // Spec alert rule: temperature >= 37.9 (was 38.5, which missed
    // low-grade fevers the backend already counts as alerts).
    if (!isMissing(log.temperature) && Number(log.temperature) >= 37.9) {
      alerts.push("Fever (" + log.temperature + " °C). Rest, stay hydrated, and report to your health worker if symptoms persist.");
    }

    if (alerts.length > 0) {
      var box = U.el("div", { class: "alert-banner", role: "alert" });
      box.appendChild(U.el("div", { class: "alert-icon" }, "⚠️"));
      var content = U.el("div", { class: "alert-content" });
      content.appendChild(U.el("h3", null, "Clinical Attention Required"));
      var ul = U.el("ul", { style: "margin:0.25rem 0 0; padding-left:1.2rem;" });
      alerts.forEach(function (msg) {
        ul.appendChild(U.el("li", null, msg));
      });
      content.appendChild(ul);
      box.appendChild(content);
      banner.appendChild(box);
    }
  }

  function renderLatest(log, prevLog) {
    var cards = document.getElementById("cards");
    U.clear(cards);
    renderAlertBanner(log);

    // Delta calculations
    var weightDelta = prevLog && !isMissing(log.weight) && !isMissing(prevLog.weight)
      ? createDelta(log.weight - prevLog.weight, "kg", true) : null;
    var bmiDelta = prevLog && !isMissing(log.bmi) && !isMissing(prevLog.bmi)
      ? createDelta(log.bmi - prevLog.bmi, "", true) : null;
    var bpDelta = prevLog && !isMissing(log.systolic_bp) && !isMissing(prevLog.systolic_bp)
      ? createDelta(log.systolic_bp - prevLog.systolic_bp, "sys", true) : null;

    addCard(cards, "Weight", U.fmtNum(log.weight, 1, "kg"), null, isMissing(log.weight) ? "missing" : null, null, weightDelta);
    addCard(cards, "Height", U.fmtNum(log.height, 1, "cm"), null, isMissing(log.height) ? "missing" : null);

    var bmiCat = bmiCategory(log.bmi);
    var bmiGauge = !isMissing(log.bmi)
      ? createGauge("track-bmi", ((log.bmi - 15) / (35 - 15)) * 100, "15 Under", "35+ Obese") : null;
    addCard(
      cards,
      "BMI",
      isMissing(log.bmi) ? "—" : U.fmtNum(log.bmi, 1),
      bmiCat ? "Category: " + bmiCat : "Not measured",
      isMissing(log.bmi) ? "missing" : bmiCat === "Normal" ? null : "abnormal",
      bmiGauge,
      bmiDelta
    );

    var hasFever = !isMissing(log.temperature) && Number(log.temperature) >= 37.9;
    var tempGauge = !isMissing(log.temperature)
      ? createGauge("track-temp", ((log.temperature - 35) / (40 - 35)) * 100, "35°C", "40°C Fever") : null;
    addCard(
      cards,
      "Temperature",
      U.fmtNum(log.temperature, 1, "°C"),
      isMissing(log.temperature) ? "Not measured" : hasFever ? "Elevated — fever range" : "Within normal range",
      isMissing(log.temperature) ? "missing" : hasFever ? "abnormal" : null,
      tempGauge
    );

    addCard(
      cards,
      "Pulse rate",
      U.fmtNum(log.pulse_rate, 0, "bpm"),
      null,
      isMissing(log.pulse_rate) ? "missing" : null
    );

    var spo2Cat = spo2Category(log.spo2);
    var spo2Gauge = !isMissing(log.spo2)
      ? createGauge("track-spo2", ((log.spo2 - 80) / (100 - 80)) * 100, "80% Crit", "100% OK") : null;
    addCard(
      cards,
      "SpO2",
      U.fmtNum(log.spo2, 0, "%"),
      spo2Cat ? "Category: " + spo2Cat : "Not measured",
      isMissing(log.spo2) ? "missing" : spo2Cat === "Normal" ? null : "abnormal",
      spo2Gauge
    );

    var bpCat = bpCategory(log.systolic_bp, log.diastolic_bp);
    var bpGauge = !isMissing(log.systolic_bp)
      ? createGauge("track-bp", ((log.systolic_bp - 90) / (190 - 90)) * 100, "90 Normal", "190 Crisis") : null;
    addCard(
      cards,
      "Blood pressure",
      isMissing(log.systolic_bp) || isMissing(log.diastolic_bp)
        ? "—"
        : log.systolic_bp + "/" + log.diastolic_bp,
      bpCat ? "mmHg · " + bpCat : "Not measured",
      isMissing(log.systolic_bp) || isMissing(log.diastolic_bp)
        ? "missing"
        : bpCat === "Normal"
          ? null
          : "abnormal",
      bpGauge,
      bpDelta
    );
  }

  async function initDashboard() {
    if (!API.requireRole("citizen")) return;
    var statusNode = document.getElementById("status");
    var cards = document.getElementById("cards");
    var emptyNode = document.getElementById("emptyState");
    var meta = document.getElementById("latestMeta");

    U.loading(statusNode, "Loading your latest reading…");
    U.clear(cards);
    U.clear(emptyNode);
    meta.textContent = "";

    try {
      var data = await API.apiFetch("/api/health-data");
      U.clear(statusNode);
      var logs = data.logs || [];
      if (logs.length === 0) {
        U.empty(
          emptyNode,
          "No readings yet. Visit the barangay health center kiosk to take your first measurement — it will appear here automatically."
        );
        return;
      }
      var latest = logs[0];
      var prev = logs.length > 1 ? logs[1] : null;
      meta.textContent = "Latest reading: " + U.fmtDT(latest.timestamp) + " UTC";
      renderLatest(latest, prev);

      var passportBtn = document.getElementById("passportBtn");
      if (passportBtn) {
        passportBtn.onclick = async function () {
          var me = {};
          try {
            me = await API.apiFetch("/api/me");
          } catch (e) {
            me = { full_name: API.getName() };
          }
          showHealthPassportModal(me, latest);
        };
      }
    } catch (error) {
      U.clear(cards);
      U.error(statusNode, error.message);
    }
  }

  /* ---------------- history ---------------- */

  var historyState = {
    logs: [],
    filter: "",
    page: 1,
    pageSize: 10,
  };

  function renderLogTable(logs) {
    historyState.logs = logs || [];
    var wrap = document.getElementById("tableWrap");
    var controls = document.getElementById("tableControls");
    var paginationWrap = document.getElementById("paginationWrap");
    U.clear(wrap);
    if (controls) U.clear(controls);
    if (paginationWrap) U.clear(paginationWrap);

    // Filter controls
    if (controls) {
      var searchDiv = U.el("div", { class: "table-search" });
      // Visible label (placeholder alone is not an accessible label).
      var inputId = "historyFilterInput";
      searchDiv.appendChild(
        U.el(
          "label",
          {
            for: inputId,
            class: "muted",
            style: "display:block; font-size:0.8rem; margin-bottom:0.25rem;",
          },
          "Filter readings"
        )
      );
      var input = U.el("input", {
        id: inputId,
        type: "search",
        placeholder: "Filter by date, BP, BMI…",
        value: historyState.filter,
      });
      input.oninput = function () {
        historyState.filter = input.value.trim().toLowerCase();
        historyState.page = 1;
        drawTableRows();
      };
      searchDiv.appendChild(input);
      controls.appendChild(searchDiv);

      var countLbl = U.el("span", { class: "muted", style: "font-size:0.85rem;" }, logs.length + " total readings");
      controls.appendChild(countLbl);
    }

    drawTableRows();
  }

  function drawTableRows() {
    var wrap = document.getElementById("tableWrap");
    var paginationWrap = document.getElementById("paginationWrap");
    U.clear(wrap);
    if (paginationWrap) U.clear(paginationWrap);

    var filtered = historyState.logs.filter(function (log) {
      if (!historyState.filter) return true;
      var text = (U.fmtDT(log.timestamp) + " " + (log.weight || "") + " " + (log.bmi || "") + " " +
        (log.systolic_bp || "") + "/" + (log.diastolic_bp || "") + " " + (log.temperature || "")).toLowerCase();
      return text.indexOf(historyState.filter) >= 0;
    });

    if (!filtered.length) {
      U.empty(wrap, "No readings match your filter.");
      return;
    }

    var totalPages = Math.ceil(filtered.length / historyState.pageSize);
    if (historyState.page > totalPages) historyState.page = totalPages;
    var startIdx = (historyState.page - 1) * historyState.pageSize;
    var pageSlice = filtered.slice(startIdx, startIdx + historyState.pageSize);

    var tableWrap = U.el("div", { class: "table-wrap" });
    var table = U.el("table");
    var thead = U.el("thead");
    var headRow = U.el("tr");
    ["Timestamp (UTC)", "Weight (kg)", "Height (cm)", "BMI", "Temp (°C)", "Pulse (bpm)", "SpO2 (%)", "Blood pressure"]
      .forEach(function (label, index) {
        headRow.appendChild(U.el("th", index === 0 ? null : { class: "num" }, label));
      });
    thead.appendChild(headRow);
    table.appendChild(thead);

    var tbody = U.el("tbody");
    pageSlice.forEach(function (log) {
      var row = U.el("tr");
      row.appendChild(U.el("td", { class: "nowrap" }, U.fmtDT(log.timestamp)));
      [
        U.fmtNum(log.weight, 1),
        U.fmtNum(log.height, 1),
        U.fmtNum(log.bmi, 1),
        U.fmtNum(log.temperature, 1),
        U.fmtNum(log.pulse_rate, 0),
        U.fmtNum(log.spo2, 0),
        isMissing(log.systolic_bp) || isMissing(log.diastolic_bp)
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

    // Pagination
    if (paginationWrap && totalPages > 1) {
      var pager = U.el("div", { class: "pagination" });
      var prevBtn = U.el("button", { type: "button", disabled: historyState.page <= 1 }, "← Previous");
      prevBtn.onclick = function () {
        if (historyState.page > 1) {
          historyState.page--;
          drawTableRows();
        }
      };
      pager.appendChild(prevBtn);

      pager.appendChild(U.el("span", { class: "muted" }, "Page " + historyState.page + " of " + totalPages));

      var nextBtn = U.el("button", { type: "button", disabled: historyState.page >= totalPages }, "Next →");
      nextBtn.onclick = function () {
        if (historyState.page < totalPages) {
          historyState.page++;
          drawTableRows();
        }
      };
      pager.appendChild(nextBtn);
      paginationWrap.appendChild(pager);
    }
  }

  function drawChart(key, canvasId, config) {
    var canvas = document.getElementById(canvasId);
    if (!canvas || !window.Chart) return;
    if (charts[key]) charts[key].destroy();
    charts[key] = new window.Chart(canvas, config);
  }

  function renderCharts(logs) {
    var note = document.getElementById("chartNote");
    var section = document.getElementById("chartsSection");
    U.clear(note);

    if (!window.Chart) {
      section.hidden = true;
      U.empty(
        note,
        "Charts could not load (the Chart.js CDN is unreachable). The table below still lists every reading."
      );
      return;
    }
    section.hidden = false;

    var ascending = logs.slice().reverse();
    var labels = ascending.map(function (log) {
      return U.fmtDT(log.timestamp);
    });
    var green = "#0f6b53";
    var red = "#a5271d";
    var baseOptions = {
      responsive: true,
      maintainAspectRatio: true,
      aspectRatio: 2,
      plugins: { legend: { display: false } },
      scales: {
        x: { ticks: { maxTicksLimit: 6, maxRotation: 0 } },
        y: { beginAtZero: false },
      },
    };

    drawChart("weight", "weightChart", {
      type: "line",
      data: {
        labels: labels,
        datasets: [
          {
            label: "Weight (kg)",
            data: ascending.map(function (log) {
              return log.weight;
            }),
            borderColor: green,
            backgroundColor: "rgba(15, 107, 83, 0.12)",
            fill: true,
            spanGaps: true,
            tension: 0.25,
            pointRadius: 3,
          },
        ],
      },
      options: baseOptions,
    });

    drawChart("bmi", "bmiChart", {
      type: "line",
      data: {
        labels: labels,
        datasets: [
          {
            label: "BMI",
            data: ascending.map(function (log) {
              return log.bmi;
            }),
            borderColor: "#8a5a00",
            backgroundColor: "rgba(138, 90, 0, 0.12)",
            fill: true,
            spanGaps: true,
            tension: 0.25,
            pointRadius: 3,
          },
        ],
      },
      options: baseOptions,
    });

    drawChart("bp", "bpChart", {
      type: "line",
      data: {
        labels: labels,
        datasets: [
          {
            label: "Systolic",
            data: ascending.map(function (log) {
              return log.systolic_bp;
            }),
            borderColor: red,
            backgroundColor: "rgba(165, 39, 29, 0.10)",
            spanGaps: true,
            tension: 0.25,
            pointRadius: 3,
          },
          {
            label: "Diastolic",
            data: ascending.map(function (log) {
              return log.diastolic_bp;
            }),
            borderColor: green,
            backgroundColor: "rgba(15, 107, 83, 0.10)",
            spanGaps: true,
            tension: 0.25,
            pointRadius: 3,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        aspectRatio: 2,
        plugins: { legend: { display: true, position: "bottom" } },
        scales: {
          x: { ticks: { maxTicksLimit: 6, maxRotation: 0 } },
          y: { beginAtZero: false },
        },
      },
    });

    drawChart("spo2", "spo2Chart", {
      type: "line",
      data: {
        labels: labels,
        datasets: [
          {
            label: "SpO2 (%)",
            data: ascending.map(function (log) {
              return log.spo2;
            }),
            borderColor: "#0b3d30",
            backgroundColor: "rgba(11, 61, 48, 0.12)",
            fill: true,
            spanGaps: true,
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
          x: { ticks: { maxTicksLimit: 6, maxRotation: 0 } },
          y: { suggestedMin: 80, suggestedMax: 100 },
        },
      },
    });
  }

  async function initHistory() {
    if (!API.requireRole("citizen")) return;
    var statusNode = document.getElementById("status");
    var tableWrap = document.getElementById("tableWrap");
    var section = document.getElementById("chartsSection");

    U.loading(statusNode, "Loading your readings…");
    U.clear(tableWrap);
    section.hidden = true;

    try {
      var data = await API.apiFetch("/api/health-data");
      U.clear(statusNode);
      var logs = data.logs || [];
      if (logs.length === 0) {
        U.empty(
          statusNode,
          "No readings yet. After your first kiosk measurement the table and charts will appear here."
        );
        U.clear(document.getElementById("chartNote"));
        return;
      }
      renderLogTable(logs);
      renderCharts(logs);

      var passportBtn = document.getElementById("passportBtnHistory");
      if (passportBtn) {
        passportBtn.onclick = async function () {
          var me = {};
          try {
            me = await API.apiFetch("/api/me");
          } catch (e) {
            me = { full_name: API.getName() };
          }
          showHealthPassportModal(me, logs[0]);
        };
      }
    } catch (error) {
      section.hidden = true;
      U.clear(tableWrap);
      U.error(statusNode, error.message);
    }
  }

  /* ---------------- consent ---------------- */

  function consentBadge(granted) {
    return U.el(
      "span",
      { class: "badge " + (granted ? "badge-ok" : "badge-no") },
      granted ? "Granted" : "Not granted"
    );
  }

  function renderConsentState(granted) {
    var stateNode = document.getElementById("consentState");
    U.clear(stateNode);
    stateNode.appendChild(consentBadge(granted));
    stateNode.appendChild(
      document.createTextNode(
        granted
          ? " — health workers at the barangay health center can open your individual records and notes."
          : " — health workers cannot open your individual records. Only anonymous totals are visible to them."
      )
    );
    document.getElementById("grantBtn").disabled = granted;
    document.getElementById("revokeBtn").disabled = !granted;
  }

  function renderConsentHistory(history) {
    var wrap = document.getElementById("historyWrap");
    U.clear(wrap);
    if (!history.length) {
      U.empty(wrap, "No consent changes recorded yet.");
      return;
    }
    var tableWrap = U.el("div", { class: "table-wrap" });
    var table = U.el("table");
    var thead = U.el("thead");
    var headRow = U.el("tr");
    ["Timestamp (UTC)", "Action", "IP address"].forEach(function (label) {
      headRow.appendChild(U.el("th", null, label));
    });
    thead.appendChild(headRow);
    table.appendChild(thead);

    var tbody = U.el("tbody");
    history.forEach(function (entry) {
      var row = U.el("tr");
      row.appendChild(U.el("td", { class: "nowrap" }, U.fmtDT(entry.timestamp)));
      var actionCell = U.el("td");
      actionCell.appendChild(
        U.el(
          "span",
          { class: "badge " + (entry.action === "granted" ? "badge-ok" : "badge-warn") },
          entry.action === "granted" ? "Granted" : "Revoked"
        )
      );
      row.appendChild(actionCell);
      row.appendChild(U.el("td", null, entry.ip_address || "—"));
      tbody.appendChild(row);
    });
    table.appendChild(tbody);
    tableWrap.appendChild(table);
    wrap.appendChild(tableWrap);
  }

  async function loadConsent(statusNode) {
    var results = await Promise.all([
      API.apiFetch("/api/consent"),
      API.apiFetch("/api/citizen/consent-history"),
    ]);
    renderConsentState(Boolean(results[0].consent_granted));
    renderConsentHistory(results[1].history || []);
    U.clear(statusNode);
  }

  async function initConsent() {
    if (!API.requireRole("citizen")) return;
    var statusNode = document.getElementById("status");
    var grantBtn = document.getElementById("grantBtn");
    var revokeBtn = document.getElementById("revokeBtn");

    U.loading(statusNode, "Checking your consent status…");
    try {
      await loadConsent(statusNode);
    } catch (error) {
      U.error(statusNode, error.message);
      document.getElementById("consentState").textContent =
        "Consent status unavailable right now.";
      grantBtn.disabled = true;
      revokeBtn.disabled = true;
      return;
    }

    async function changeConsent(granted) {
      grantBtn.disabled = true;
      revokeBtn.disabled = true;
      U.loading(statusNode, granted ? "Granting consent…" : "Revoking consent…");
      try {
        await API.apiFetch("/api/consent", {
          method: "POST",
          body: { consent_granted: granted },
        });
        await loadConsent(statusNode);
        U.toast(granted ? "Consent granted to Barangay Health Workers" : "Consent revoked - records are now private", "success");
      } catch (error) {
        U.error(statusNode, error.message);
        try {
          await loadConsent(statusNode);
        } catch (reloadError) {
          /* the error state from the failed action stays visible */
        }
      }
    }

    grantBtn.addEventListener("click", function () {
      changeConsent(true);
    });
    revokeBtn.addEventListener("click", function () {
      changeConsent(false);
    });
  }

  /* ---------------- profile ---------------- */

  async function initProfile() {
    if (!API.requireRole("citizen")) return;
    var statusNode = document.getElementById("status");
    var profileForm = document.getElementById("profileForm");
    var passwordForm = document.getElementById("passwordForm");
    var profileError = document.getElementById("profileError");
    var profileFeedback = document.getElementById("profileFeedback");
    var passwordError = document.getElementById("passwordError");
    var passwordFeedback = document.getElementById("passwordFeedback");

    U.loading(statusNode, "Loading your profile…");
    try {
      var me = await API.apiFetch("/api/me");
      U.clear(statusNode);
      document.getElementById("usernameReadonly").value = me.username;
      document.getElementById("fullName").value = me.full_name;
      document.getElementById("birthdate").value = me.birthdate;
      var genderSelect = document.getElementById("gender");
      genderSelect.value = ["male", "female", "other"].indexOf(me.gender) >= 0 ? me.gender : "other";
    } catch (error) {
      U.error(statusNode, error.message);
      return;
    }

    profileForm.addEventListener("submit", async function (event) {
      event.preventDefault();
      showFormError(profileError, "");
      showFormError(profileFeedback, "");
      var submit = document.getElementById("profileSubmit");
      var payload = {
        full_name: fieldValue("fullName"),
        birthdate: fieldValue("birthdate"),
        gender: fieldValue("gender"),
      };
      if (!payload.full_name) {
        showFormError(profileError, "Full name is required.");
        return;
      }
      if (!payload.birthdate) {
        showFormError(profileError, "Birthdate is required.");
        return;
      }
      setBusy(submit, true, "Saving…");
      try {
        await API.apiFetch("/api/citizen/profile", { method: "PUT", body: payload });
        profileFeedback.textContent = "Profile saved.";
        U.toast("Profile updated successfully", "success");
        API.saveSession(API.getToken(), API.getRole(), payload.full_name);
        var whoami = document.getElementById("whoami");
        if (whoami) whoami.textContent = payload.full_name;
      } catch (error) {
        showFormError(profileError, error.message);
        U.toast(error.message, "error");
      } finally {
        setBusy(submit, false);
      }
    });

    passwordForm.addEventListener("submit", async function (event) {
      event.preventDefault();
      showFormError(passwordError, "");
      showFormError(passwordFeedback, "");
      var submit = document.getElementById("passwordSubmit");
      var current = document.getElementById("currentPassword").value;
      var next = document.getElementById("newPassword").value;
      if (!current) {
        showFormError(passwordError, "Enter your current password.");
        return;
      }
      if (next.length < 8) {
        showFormError(passwordError, "New password must be at least 8 characters.");
        return;
      }
      setBusy(submit, true, "Updating…");
      try {
        await API.apiFetch("/api/citizen/password", {
          method: "PUT",
          body: { current_password: current, new_password: next },
        });
        passwordForm.reset();
        passwordFeedback.textContent = "Password updated.";
        U.toast("Password updated successfully", "success");
      } catch (error) {
        showFormError(passwordError, error.message);
        U.toast(error.message, "error");
      } finally {
        setBusy(submit, false);
      }
    });

    var logoutMain = document.getElementById("logoutBtnMain");
    if (logoutMain) {
      logoutMain.addEventListener("click", function () {
        API.logout();
      });
    }
  }

  /* ---------------- router ---------------- */

  document.addEventListener("DOMContentLoaded", function () {
    var page = document.body.getAttribute("data-page");
    if (page === "citizen-login" || page === "bhw-login") initLogin();
    else if (page === "citizen-register") initRegister();
    else if (page === "citizen-dashboard") initDashboard();
    else if (page === "citizen-history") initHistory();
    else if (page === "citizen-consent") initConsent();
    else if (page === "citizen-profile") initProfile();
  });
})();
