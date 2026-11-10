/* Citizen portal behaviour (login, register, dashboard, history, consent,
 * profile). All API calls go through API.apiFetch / API.apiFetchRaw. */
(function () {
  "use strict";

  var U = API.UI;
  var charts = {};
  var sparkCharts = [];

  /* Chart.js plugin that draws a horizontal fever threshold line at 37.9 °C. */
  var feverThresholdPlugin = {
    id: "feverThreshold",
    afterDraw: function (chart) {
      var ctx = chart.ctx;
      var yAxis = chart.scales.y;
      if (!yAxis) return;
      var y = yAxis.getPixelForValue(37.9);
      if (y === null || y === undefined) return;
      ctx.save();
      ctx.strokeStyle = "#a5271d";
      ctx.lineDash = [6, 4];
      ctx.lineWidth = 1.5;
      ctx.font = "11px var(--font, sans-serif)";
      ctx.fillStyle = "#a5271d";
      ctx.textAlign = "right";
      ctx.textBaseline = "bottom";
      ctx.beginPath();
      ctx.moveTo(yAxis.left, y);
      ctx.lineTo(yAxis.right, y);
      ctx.stroke();
      ctx.fillText("Fever ≥ 37.9 °C", yAxis.right - 8, y - 6);
      ctx.restore();
    },
  };
  var thresholdRegistered = false;

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

    /* Per-field inline validation: show/clear an error line under a field. */
    function fieldError(id, message) {
      var node = document.getElementById(id);
      var existing = document.getElementById(id + "-error");
      if (existing) existing.remove();
      if (!node) return;
      if (!message) {
        node.removeAttribute("aria-invalid");
        return;
      }
      node.setAttribute("aria-invalid", "true");
      node.setAttribute("aria-describedby", id + "-error");
      var err = U.el("p", { id: id + "-error", class: "form-error", role: "alert" }, message);
      node.parentNode.insertBefore(err, node.nextSibling);
    }

    function clearFieldError(id) {
      var node = document.getElementById(id);
      if (node) {
        node.removeAttribute("aria-invalid");
      }
      var existing = document.getElementById(id + "-error");
      if (existing) existing.remove();
    }

    ["fullName", "username", "password", "confirmPassword", "birthdate"].forEach(function (id) {
      var node = document.getElementById(id);
      if (node) node.addEventListener("input", function () { clearFieldError(id); });
    });

    form.addEventListener("submit", async function (event) {
      event.preventDefault();
      showFormError(errorNode, "");
      U.clear(successNode);
      ["fullName", "username", "password", "confirmPassword", "birthdate"].forEach(clearFieldError);

      var fullName = fieldValue("fullName");
      var username = fieldValue("username");
      var password = document.getElementById("password").value;
      var confirm = document.getElementById("confirmPassword").value;
      var birthdate = fieldValue("birthdate");
      var gender = fieldValue("gender");
      var ok = true;

      if (!fullName) { fieldError("fullName", "Full name is required."); ok = false; }
      if (!username) { fieldError("username", "Username is required."); ok = false; }
      if (!password) { fieldError("password", "Password is required."); ok = false; }
      else if (password.length < 8) { fieldError("password", "Password must be at least 8 characters."); ok = false; }
      if (!confirm) { fieldError("confirmPassword", "Please confirm your password."); ok = false; }
      else if (password !== confirm) { fieldError("confirmPassword", "Passwords do not match."); ok = false; }
      if (!birthdate) { fieldError("birthdate", "Birthdate is required."); ok = false; }
      if (!gender) { fieldError("gender", "Please select a gender."); ok = false; }
      if (!ok) return;

      var payload = {
        full_name: fullName,
        username: username,
        password: password,
        birthdate: birthdate,
        gender: gender,
      };

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

  function createDelta(diff, unit, lowerIsBetter, neutral, digits) {
    if (diff === null || diff === undefined || isNaN(diff)) return null;
    var places = digits === undefined ? 1 : digits;
    var epsilon = places === 0 ? 0.5 : 0.05;
    var sign = diff > 0 ? "+" : diff < 0 ? "−" : "±";
    var abs = Math.abs(diff);
    if (abs < epsilon) return U.el("span", { class: "delta neutral" }, "No change");
    var isGood = lowerIsBetter ? diff < 0 : diff > 0;
    var tone = neutral ? "neutral" : isGood ? "good" : "warn";
    var text = (diff > 0 ? "▲ " : "▼ ") + sign + abs.toFixed(places) + (unit ? " " + unit : "");
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
    foot.appendChild(U.el("span", null, "Recorded: " + (log ? U.fmtDT(log.timestamp) : "—")));
    foot.appendChild(U.el("span", { style: "font-weight:700; color:#0b3d30;" }, "OFFICIAL RECORD · BARANGAY HEALTH KIOSK"));
    passport.appendChild(foot);

    var sigBlock = U.el("div", { class: "official-signature-block print-only" });
    var sigFlex = U.el("div", { style: "display:flex; justify-content:space-between; margin-top:2.2rem;" });
    var sig1 = U.el("div");
    sig1.appendChild(U.el("div", { style: "border-bottom:1.5px solid #000; width:220px; height:1.4rem;" }));
    sig1.appendChild(U.el("div", { style: "font-size:0.75rem; margin-top:0.3rem; font-weight:600;" }, "Attending Health Worker (Signature)"));
    sigFlex.appendChild(sig1);
    var sig2 = U.el("div");
    sig2.appendChild(U.el("div", { style: "border-bottom:1.5px solid #000; width:160px; height:1.4rem;" }));
    sig2.appendChild(U.el("div", { style: "font-size:0.75rem; margin-top:0.3rem; font-weight:600;" }, "Date of Verification"));
    sigFlex.appendChild(sig2);
    sigBlock.appendChild(sigFlex);
    passport.appendChild(sigBlock);

    body.appendChild(passport);
    card.appendChild(body);

    var mFoot = U.el("div", { class: "modal-footer" });
    var printBtn = U.el("button", { class: "btn btn-primary", type: "button" }, "Print / Save as PDF");
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
      // Generous fallback for browsers that do not fire afterprint immediately
      setTimeout(clearPrintMode, 30000);
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
    var handleClose = function () {
      document.body.classList.remove("printing-passport");
      closeDialog();
    };
    closeBtn.onclick = handleClose;
    dismissBtn.onclick = handleClose;
  }

function addCard(container, label, value, sub, tone, gauge, delta, spark, pendingSparks, refRange) {
    var card = U.el("div", { class: "card" + (tone ? " " + tone : "") });
    card.appendChild(U.el("div", { class: "label" }, label));
    card.appendChild(U.el("div", { class: "value" }, value));
    if (sub) card.appendChild(U.el("div", { class: "sub" }, sub));
    if (refRange) card.appendChild(U.el("span", { class: "ref-range" }, refRange));
    if (delta) card.appendChild(delta);
    if (gauge) card.appendChild(gauge);
    if (spark) {
      if (pendingSparks) {
        pendingSparks.push({ card: card, values: spark.values, color: spark.color });
      } else {
        renderSparkline(card, spark.values, spark.color);
      }
    }
    container.appendChild(card);
    return card;
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
      var alertIcon = U.el("div", { class: "alert-icon", "aria-hidden": "true" });
      alertIcon.innerHTML = '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#a5271d" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>';
      box.appendChild(alertIcon);
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

  /* Tiny sparkline for a single vital across the recent time series.
   * Wrapped in .sparkline-wrap (fixed height) so Chart.js sizes against a
   * bounded parent instead of looping on the card's auto height. */
  function renderSparkline(card, values, color) {
    if (!window.Chart || !values || values.length < 2) return;
    var wrap = U.el("div", { class: "sparkline-wrap" });
    var canvas = U.el("canvas", { class: "sparkline" });
    wrap.appendChild(canvas);
    card.appendChild(wrap);
    var ascendingVals = values.slice().reverse();
    var ctx = canvas.getContext("2d");
    sparkCharts.push(new window.Chart(ctx, {
      type: "line",
      data: {
        labels: ascendingVals.map(function () { return ""; }),
        datasets: [{
          data: ascendingVals,
          borderColor: color,
          backgroundColor: "transparent",
          fill: false,
          spanGaps: true,
          tension: 0.25,
          pointRadius: 0,
          borderWidth: 2,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: false,
        plugins: { legend: { display: false }, tooltip: { enabled: false } },
        scales: { x: { display: false }, y: { display: false } },
        layout: { padding: 0 },
      },
    }));
  }

  /* Newest-first series for a sparkline: up to 10 non-null values. */
  function sparkSeries(logs, key) {
    var out = [];
    for (var i = 0; i < logs.length && out.length < 10; i++) {
      var value = logs[i][key];
      if (!isMissing(value)) out.push(value);
    }
    return out;
  }

  function spark(logs, key, color) {
    var values = sparkSeries(logs, key);
    return values.length >= 2 ? { values: values, color: color } : null;
  }

  /* ---------------- hero status panel ---------------- */

  /* Overall status derived from the latest reading (display only).
   * Levels mirror the clinical alert rules: crisis/Stage 2 BP, critical
   * SpO2 and fever are "action"; Stage 1/Elevated BP, low SpO2 and a BMI
   * outside normal are "attention"; everything else is "normal". */
  function deriveStatus(log) {
    var findings = [];

    var bpCat = bpCategory(log.systolic_bp, log.diastolic_bp);
    var bpText =
      isMissing(log.systolic_bp) || isMissing(log.diastolic_bp)
        ? null
        : " (" + log.systolic_bp + "/" + log.diastolic_bp + " mmHg)";
    if (bpCat === "Crisis" || bpCat === "Stage 2") {
      findings.push({ text: "your blood pressure is in the " + bpCat + " range" + (bpText || ""), tone: "bad" });
    } else if (bpCat === "Stage 1") {
      findings.push({ text: "your blood pressure is in the Stage 1 range" + (bpText || ""), tone: "warn" });
    } else if (bpCat === "Elevated") {
      findings.push({ text: "your blood pressure is a little high" + (bpText || ""), tone: "warn" });
    }

    var spo2Cat = spo2Category(log.spo2);
    if (spo2Cat === "Critical") {
      findings.push({ text: "your blood oxygen is critically low (" + log.spo2 + "%)", tone: "bad" });
    } else if (spo2Cat === "Low") {
      findings.push({ text: "your blood oxygen is a little low (" + log.spo2 + "%)", tone: "warn" });
    }

    if (!isMissing(log.temperature) && Number(log.temperature) >= 37.9) {
      findings.push({ text: "you have a fever (" + log.temperature + " °C)", tone: "bad" });
    }

    var bmiCat = bmiCategory(log.bmi);
    if (bmiCat && bmiCat !== "Normal") {
      findings.push({ text: "your BMI is in the " + bmiCat + " range (" + U.fmtNum(log.bmi, 1) + ")", tone: "warn" });
    }

    var level = findings.some(function (f) { return f.tone === "bad"; })
      ? "action"
      : findings.length
        ? "attention"
        : "normal";

    var sentence;
    if (level === "normal") {
      sentence = "Your latest readings are all within the healthy range.";
    } else {
      var texts = findings.map(function (f) { return f.text; });
      var joined =
        texts.length === 1
          ? texts[0]
          : texts.slice(0, -1).join(", ") + " and " + texts[texts.length - 1];
      sentence = "In your latest reading, " + joined + ".";
    }

    var next;
    if (level === "action") {
      next = "Next step: contact your Barangay Health Worker or visit the health station today.";
    } else if (level === "attention") {
      next = "Next step: mention this at your next visit, and recheck at the kiosk in a few days.";
    } else {
      next = "Next step: keep it up — take your next reading at the kiosk as usual.";
    }

    return {
      level: level,
      label: level === "action" ? "Action required" : level === "attention" ? "Monitor" : "Normal",
      tone: level === "action" ? "bad" : level === "attention" ? "warn" : "ok",
      sentence: sentence,
      next: next,
    };
  }

  /* Time-of-day greeting in PHT using the stored name (no extra request). */
  function renderGreeting() {
    var node = document.getElementById("heroGreeting");
    if (!node) return;
    var hour = Number(
      new Intl.DateTimeFormat("en-PH", {
        timeZone: "Asia/Manila",
        hour: "2-digit",
        hour12: false,
      }).format(new Date())
    );
    hour = hour % 24; // some locales format midnight as "24"
    var part = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
    var first = (API.getName() || "").trim().split(/\s+/)[0];
    node.textContent = first ? part + ", " + first : part;
  }

  function renderHero(log) {
    var pill = document.getElementById("heroPill");
    var sentence = document.getElementById("heroSentence");
    var next = document.getElementById("heroNext");
    if (!pill || !sentence || !next) return;
    var status = deriveStatus(log);
    pill.className = "hero-pill " + status.tone;
    pill.textContent = status.label;
    sentence.textContent = status.sentence;
    next.textContent = status.next;
  }

  /* No-readings onboarding state lives in the hero itself. */
  function renderHeroOnboarding() {
    var pill = document.getElementById("heroPill");
    var sentence = document.getElementById("heroSentence");
    var next = document.getElementById("heroNext");
    if (!pill || !sentence || !next) return;
    pill.className = "hero-pill muted";
    pill.textContent = "No readings";
    sentence.textContent =
      "No vital sign measurements are recorded yet for your account.";
    next.textContent =
      "Visit the barangay health kiosk to take your measurements. Your readings will appear here.";
  }

  /* Hero on a failed first load, so it never sits on "Checking…". */
  function renderHeroUnavailable() {
    var pill = document.getElementById("heroPill");
    var sentence = document.getElementById("heroSentence");
    var next = document.getElementById("heroNext");
    if (!pill || !sentence || !next) return;
    pill.className = "hero-pill muted";
    pill.textContent = "Unavailable";
    sentence.textContent = "We couldn't load your health data right now.";
    next.textContent = "Use Retry below, or check your connection and try again.";
  }

  /* ---------------- mini trends (dashboard at a glance) ---------------- */

  function miniSeries(logs, key) {
    return logs.map(function (log) {
      return isMissing(log[key]) ? null : log[key];
    });
  }

  function hasEnough(values) {
    return values.filter(function (v) { return v !== null; }).length >= 2;
  }

  function setMiniNote(canvasId, noteId, message) {
    var canvas = document.getElementById(canvasId);
    var note = document.getElementById(noteId);
    if (canvas) canvas.hidden = Boolean(message);
    if (note) U.empty(note, message || "");
  }

  /* Two compact trend charts for the last ≤10 readings. Chart.js is a
   * progressive enhancement: when the CDN is unreachable the canvases are
   * hidden and a text pointer to History is shown instead. */
  function renderMiniTrends(logs) {
    var section = document.getElementById("trendsSection");
    if (!section) return;
    if (logs.length < 2) {
      section.hidden = true;
      return;
    }
    section.hidden = false;

    var recent = logs.slice(0, 10).reverse(); // ascending, newest last
    var labels = recent.map(function (log) {
      return U.fmtDT(log.timestamp);
    });

    if (!window.Chart) {
      setMiniNote("bpMiniChart", "bpMiniNote", "Charts unavailable (the Chart.js CDN is unreachable) — open History for the full table.");
      setMiniNote("weightMiniChart", "weightMiniNote", "Charts unavailable (the Chart.js CDN is unreachable) — open History for the full table.");
      return;
    }

    var sys = miniSeries(recent, "systolic_bp");
    var dia = miniSeries(recent, "diastolic_bp");
    if (hasEnough(sys) || hasEnough(dia)) {
      setMiniNote("bpMiniChart", "bpMiniNote", "");
      var bpSummary = document.getElementById("bpMiniSummary");
      if (bpSummary && recent[0]) {
        bpSummary.textContent = "Recent blood pressure trend. Latest reading is " +
          (recent[0].systolic_bp || "—") + "/" + (recent[0].diastolic_bp || "—") + " mmHg.";
      }
      drawChart("bpMini", "bpMiniChart", {
        type: "line",
        data: {
          labels: labels,
          datasets: [
            {
              label: "Systolic",
              data: sys,
              borderColor: "#1565c0",
              spanGaps: true,
              tension: 0.25,
              pointRadius: 2.5,
            },
            {
              label: "Diastolic",
              data: dia,
              borderColor: "#b9761b",
              spanGaps: true,
              tension: 0.25,
              pointRadius: 2.5,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: true,
          aspectRatio: 1.7,
          plugins: { legend: { display: true, position: "bottom" } },
          scales: {
            x: { ticks: { maxTicksLimit: 5, maxRotation: 0 } },
            y: { beginAtZero: false },
          },
        },
      });
    } else {
      setMiniNote("bpMiniChart", "bpMiniNote", "Not enough blood pressure readings yet to show a trend.");
    }

    var weight = miniSeries(recent, "weight");
    var bmi = miniSeries(recent, "bmi");
    if (hasEnough(weight) || hasEnough(bmi)) {
      setMiniNote("weightMiniChart", "weightMiniNote", "");
      var weightSummary = document.getElementById("weightMiniSummary");
      if (weightSummary && recent[0]) {
        weightSummary.textContent = "Recent weight and BMI trend. Latest weight is " +
          (recent[0].weight || "—") + " kg, BMI is " + (recent[0].bmi || "—") + ".";
      }
      drawChart("weightMini", "weightMiniChart", {
        type: "line",
        data: {
          labels: labels,
          datasets: [
            {
              label: "Weight (kg)",
              data: weight,
              borderColor: "#0f6b53",
              backgroundColor: "rgba(15, 107, 83, 0.12)",
              fill: true,
              spanGaps: true,
              tension: 0.25,
              pointRadius: 2.5,
              yAxisID: "y",
            },
            {
              label: "BMI",
              data: bmi,
              borderColor: "#8a5a00",
              spanGaps: true,
              tension: 0.25,
              pointRadius: 2.5,
              yAxisID: "y1",
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: true,
          aspectRatio: 1.7,
          plugins: { legend: { display: true, position: "bottom" } },
          scales: {
            x: { ticks: { maxTicksLimit: 5, maxRotation: 0 } },
            y: { position: "left", beginAtZero: false },
            y1: {
              position: "right",
              beginAtZero: false,
              grid: { drawOnChartArea: false },
            },
          },
        },
      });
    } else {
      setMiniNote("weightMiniChart", "weightMiniNote", "Not enough weight readings yet to show a trend.");
    }
  }

  function renderLatest(logs) {
    var log = logs[0];
    var prevLog = logs.length > 1 ? logs[1] : null;
    // Release the previous reading's sparkline instances (their canvases are
    // about to be removed) so repeated kiosk readings never leak charts.
    sparkCharts.forEach(function (chart) {
      chart.destroy();
    });
    sparkCharts = [];
    var cards = document.getElementById("cards");
    var supportCards = document.getElementById("supportCards");
    U.clear(cards);
    U.clear(supportCards);
    renderAlertBanner(log);
    renderHero(log);
    renderMiniTrends(logs);

    var fragHeadline = document.createDocumentFragment();
    var fragSupport = document.createDocumentFragment();
    var pendingSparks = [];

    // Delta calculations (vs the previous reading, when both exist)
    var weightDelta = prevLog && !isMissing(log.weight) && !isMissing(prevLog.weight)
      ? createDelta(log.weight - prevLog.weight, "kg", true) : null;
    var bmiDelta = prevLog && !isMissing(log.bmi) && !isMissing(prevLog.bmi)
      ? createDelta(log.bmi - prevLog.bmi, "", true) : null;
    var bpDelta = prevLog && !isMissing(log.systolic_bp) && !isMissing(prevLog.systolic_bp)
      ? createDelta(log.systolic_bp - prevLog.systolic_bp, "sys", true, false, 0) : null;
    var tempDelta = prevLog && !isMissing(log.temperature) && !isMissing(prevLog.temperature)
      ? createDelta(log.temperature - prevLog.temperature, "°C", true) : null;
    var pulseDelta = prevLog && !isMissing(log.pulse_rate) && !isMissing(prevLog.pulse_rate)
      ? createDelta(log.pulse_rate - prevLog.pulse_rate, "bpm", false, true, 0) : null;
    var spo2Delta = prevLog && !isMissing(log.spo2) && !isMissing(prevLog.spo2)
      ? createDelta(log.spo2 - prevLog.spo2, "%", false, false, 0) : null;

    // Cards are ordered by clinical priority: actionable vitals first,
    // anthropometrics (BMI / weight / height) last.
    var bpCat = bpCategory(log.systolic_bp, log.diastolic_bp);
    var bpGauge = !isMissing(log.systolic_bp)
      ? createGauge("track-bp", ((log.systolic_bp - 90) / (190 - 90)) * 100, "90 Normal", "190 Crisis") : null;
    addCard(
      fragHeadline,
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
      bpDelta,
      spark(logs, "systolic_bp", "#1565c0"),
      pendingSparks,
      "Target: <120/80 mmHg"
    );

    var spo2Cat = spo2Category(log.spo2);
    var spo2Gauge = !isMissing(log.spo2)
      ? createGauge("track-spo2", ((log.spo2 - 80) / (100 - 80)) * 100, "80% Crit", "100% OK") : null;
    addCard(
      fragHeadline,
      "SpO2",
      U.fmtNum(log.spo2, 0, "%"),
      spo2Cat ? "Category: " + spo2Cat : "Not measured",
      isMissing(log.spo2) ? "missing" : spo2Cat === "Normal" ? null : "abnormal",
      spo2Gauge,
      spo2Delta,
      spark(logs, "spo2", "#0b3d30"),
      pendingSparks,
      "Normal: 95–100%"
    );

    var hasFever = !isMissing(log.temperature) && Number(log.temperature) >= 37.9;
    var tempGauge = !isMissing(log.temperature)
      ? createGauge("track-temp", ((log.temperature - 35) / (40 - 35)) * 100, "35°C", "40°C Fever") : null;
    addCard(
      fragHeadline,
      "Temperature",
      U.fmtNum(log.temperature, 1, "°C"),
      isMissing(log.temperature) ? "Not measured" : hasFever ? "Elevated — fever range" : "Within normal range",
      isMissing(log.temperature) ? "missing" : hasFever ? "abnormal" : null,
      tempGauge,
      tempDelta,
      spark(logs, "temperature", "#a5271d"),
      pendingSparks,
      "Normal: 36.5–37.5 °C"
    );

    addCard(
      fragSupport,
      "Pulse rate",
      U.fmtNum(log.pulse_rate, 0, "bpm"),
      null,
      isMissing(log.pulse_rate) ? "missing" : null,
      null,
      pulseDelta,
      spark(logs, "pulse_rate", "#0f6b53"),
      pendingSparks,
      "Resting: 60–100 bpm"
    );

    var bmiCat = bmiCategory(log.bmi);
    var bmiGauge = !isMissing(log.bmi)
      ? createGauge("track-bmi", ((log.bmi - 15) / (35 - 15)) * 100, "15 Under", "35+ Obese") : null;
    addCard(
      fragSupport,
      "BMI",
      isMissing(log.bmi) ? "—" : U.fmtNum(log.bmi, 1),
      bmiCat ? "Category: " + bmiCat : "Not measured",
      isMissing(log.bmi) ? "missing" : bmiCat === "Normal" ? null : "abnormal",
      bmiGauge,
      bmiDelta,
      spark(logs, "bmi", "#8a5a00"),
      pendingSparks,
      "Normal: 18.5–24.9 kg/m²"
    );

    addCard(fragSupport, "Weight", U.fmtNum(log.weight, 1, "kg"), null, isMissing(log.weight) ? "missing" : null, null, weightDelta, spark(logs, "weight", "#0f6b53"), pendingSparks);
    addCard(fragSupport, "Height", U.fmtNum(log.height, 1, "cm"), null, isMissing(log.height) ? "missing" : null);

    // Batch append to DOM in a single reflow/repaint pass
    cards.appendChild(fragHeadline);
    supportCards.appendChild(fragSupport);

    // Render sparklines after canvases are attached to live DOM
    pendingSparks.forEach(function (p) {
      renderSparkline(p.card, p.values, p.color);
    });
  }

  function renderConsentChip(granted) {
    var chip = document.getElementById("consentChip");
    if (chip) {
      chip.className = "status-chip " + (granted ? "granted" : "not-granted");
      chip.textContent = granted ? "Consent: Granted" : "Consent: Not granted";
      chip.title = granted
        ? "Barangay Health Workers can open your individual records. Change this on the Consent page."
        : "Barangay Health Workers only see anonymous totals. Change this on the Consent page.";
    }
    // Trust strip: plain-language explanation of what the chip means.
    var explain = document.getElementById("consentExplain");
    if (explain) {
      U.clear(explain);
      explain.appendChild(
        document.createTextNode(
          granted
            ? "Barangay Health Workers can open your individual records — this is what you agreed to. "
            : "Barangay Health Workers only see anonymous totals; they cannot open your individual records. "
        )
      );
      explain.appendChild(U.el("a", { href: "/citizen/consent.html" }, "Change this on the Consent page"));
      explain.appendChild(document.createTextNode("."));
    }
  }

  async function initDashboard() {
    if (!API.requireRole("citizen")) return;
    var statusNode = document.getElementById("status");
    var cards = document.getElementById("cards");
    var supportCards = document.getElementById("supportCards");
    var headlineSection = document.getElementById("headlineSection");
    var supportSection = document.getElementById("supportSection");
    var trendsSection = document.getElementById("trendsSection");
    var emptyNode = document.getElementById("emptyState");
    var meta = document.getElementById("latestMeta");
    var passportBtn = document.getElementById("passportBtn");

    var knownTimestamp = null;
    var latestLog = null;
    var loaded = false;

    function setVitalsVisible(visible) {
      [headlineSection, supportSection, trendsSection].forEach(function (node) {
        if (node) node.hidden = !visible;
      });
    }

    renderGreeting();

    async function load(options) {
      var isAuto = Boolean(options && options.auto);
      // First load shows a spinner; later refreshes keep content on screen
      // (stale-while-revalidate) so nothing flashes.
      if (!loaded && !isAuto) U.loading(statusNode, "Loading your latest reading…");
      try {
        var results = await Promise.all([
          API.apiFetch("/api/health-data"),
          API.apiFetch("/api/consent"),
        ]);
        U.clear(statusNode);
        var logs = results[0].logs || [];
        renderConsentChip(Boolean(results[1].consent_granted));

        if (logs.length === 0) {
          knownTimestamp = null;
          latestLog = null;
          U.clear(cards);
          U.clear(supportCards);
          setVitalsVisible(false);
          renderHeroOnboarding();
          U.clear(emptyNode);
          meta.textContent = "";
          if (passportBtn) passportBtn.hidden = false;
          loaded = true;
          return true;
        }

        U.clear(emptyNode);
        setVitalsVisible(true);
        if (passportBtn) passportBtn.hidden = false;
        var latest = logs[0];
        meta.textContent =
          "Latest reading: " + U.fmtDT(latest.timestamp) + " · " + U.fmtAge(latest.timestamp);

        // Re-render only when a new kiosk reading actually arrived, so the
        // 60s poll never disturbs the screen or screen-reader users.
        if (knownTimestamp !== latest.timestamp) {
          knownTimestamp = latest.timestamp;
          latestLog = latest;
          renderLatest(logs);
        }
        loaded = true;
        return true;
      } catch (error) {
        // First-load/manual failures surface an error with Retry; auto-refresh
        // failures keep the stale (still valid) content on screen.
        if (!isAuto) {
          if (!loaded) {
            U.clear(cards);
            U.clear(supportCards);
            renderHeroUnavailable();
          }
          U.error(statusNode, error.message, function () {
            load({});
          });
        }
        return false;
      }
    }

    if (passportBtn) {
      passportBtn.onclick = async function () {
        setBusy(passportBtn, true, "Opening…");
        var me = {};
        try {
          me = await API.apiFetch("/api/me");
        } catch (e) {
          me = { full_name: API.getName() };
        } finally {
          setBusy(passportBtn, false);
        }
        showHealthPassportModal(me, latestLog);
      };
    }

    var refreshBtn = document.getElementById("citizenRefreshBtn");
    if (refreshBtn) {
      refreshBtn.addEventListener("click", async function () {
        setBusy(refreshBtn, true, "Refreshing…");
        try {
          var ok = await load({});
          if (ok) U.toast("Dashboard refreshed", "success");
        } finally {
          setBusy(refreshBtn, false);
        }
      });
    }

    await load({});

    // Gentle 60s poll: skips hidden tabs; re-renders only on new data.
    setInterval(function () {
      if (!document.hidden) load({ auto: true });
    }, 60000);
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
    ["Time (PHT)", "Weight (kg)", "Height (cm)", "BMI", "Temp (°C)", "Pulse (bpm)", "SpO2 (%)", "Blood pressure"]
      .forEach(function (label, index) {
        headRow.appendChild(U.el("th", index === 0 ? { scope: "col" } : { class: "num", scope: "col" }, label));
      });
    thead.appendChild(headRow);
    table.appendChild(thead);

    var tbody = U.el("tbody");
    var rowsFrag = document.createDocumentFragment();
    pageSlice.forEach(function (log) {
      var row = U.el("tr");
      row.appendChild(U.el("th", { class: "nowrap", scope: "row", title: U.fmtUTC(log.timestamp), style: "font-weight:600; text-align:left; background:transparent;" }, U.fmtDT(log.timestamp)));
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
      rowsFrag.appendChild(row);
    });
    tbody.appendChild(rowsFrag);
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
    if (!thresholdRegistered) {
      window.Chart.register(feverThresholdPlugin);
      thresholdRegistered = true;
    }

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
            borderColor: "#1565c0",
            backgroundColor: "rgba(21, 101, 192, 0.10)",
            spanGaps: true,
            tension: 0.25,
            pointRadius: 3,
            pointStyle: "circle",
          },
          {
            label: "Diastolic",
            data: ascending.map(function (log) {
              return log.diastolic_bp;
            }),
            borderColor: "#b9761b",
            backgroundColor: "rgba(185, 118, 27, 0.10)",
            spanGaps: true,
            tension: 0.25,
            pointRadius: 3,
            pointStyle: "rect",
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

    var temps = ascending.map(function (log) {
      return log.temperature;
    });
    var tempMax = Math.max.apply(
      null,
      temps.filter(function (t) {
        return t !== null && t !== undefined;
      }).concat([38.5])
    );
    drawChart("temperature", "temperatureChart", {
      type: "line",
      data: {
        labels: labels,
        datasets: [
          {
            label: "Temperature (°C)",
            data: temps,
            borderColor: "#a5271d",
            backgroundColor: "rgba(165, 39, 29, 0.12)",
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
        plugins: {
          legend: { display: false },
          feverThreshold: {},
        },
        scales: {
          x: { ticks: { maxTicksLimit: 6, maxRotation: 0 } },
          y: {
            beginAtZero: false,
            suggestedMin: 34,
            suggestedMax: tempMax,
            title: { display: true, text: "°C" },
          },
        },
      },
    });
  }

  async function initHistory() {
    if (!API.requireRole("citizen")) return;
    var statusNode = document.getElementById("status");
    var tableWrap = document.getElementById("tableWrap");
    var section = document.getElementById("chartsSection");
    var passportBtn = document.getElementById("passportBtnHistory");

    if (passportBtn) {
      passportBtn.onclick = async function () {
        setBusy(passportBtn, true, "Opening…");
        var me = {};
        try {
          me = await API.apiFetch("/api/me");
        } catch (e) {
          me = { full_name: API.getName() };
        } finally {
          setBusy(passportBtn, false);
        }
        var latest = (historyState.logs && historyState.logs.length) ? historyState.logs[0] : null;
        showHealthPassportModal(me, latest);
      };
    }

    U.loading(statusNode, "Loading your readings…");
    U.clear(tableWrap);
    section.hidden = true;

    try {
      var data = await API.apiFetch("/api/health-data");
      U.clear(statusNode);
      var logs = data.logs || [];
      historyState.logs = logs;
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
    } catch (error) {
      section.hidden = true;
      U.clear(tableWrap);
      U.error(statusNode, error.message, initHistory);
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
    ["Time (PHT)", "Action", "IP address"].forEach(function (label) {
      headRow.appendChild(U.el("th", { scope: "col" }, label));
    });
    thead.appendChild(headRow);
    table.appendChild(thead);

    var tbody = U.el("tbody");
    history.forEach(function (entry) {
      var row = U.el("tr");
      row.appendChild(U.el("th", { class: "nowrap", scope: "row", title: U.fmtUTC(entry.timestamp), style: "font-weight:600; text-align:left; background:transparent;" }, U.fmtDT(entry.timestamp)));
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
      if (!window.confirm("Grant Barangay Health Workers access to your health records?")) return;
      changeConsent(true);
    });
    revokeBtn.addEventListener("click", function () {
      if (!window.confirm("Are you sure? Revoking consent means Barangay Health Workers will no longer be able to open your individual records.")) return;
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
