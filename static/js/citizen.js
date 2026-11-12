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
    document.body.classList.add("printing-passport");
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
    var pLogos = U.el("div", { class: "passport-logos", style: "display:flex; align-items:center; justify-content:center; gap:1.25rem; margin-bottom:0.6rem;" });
    pLogos.appendChild(U.el("img", { src: "/img/cpsc-logo.png", alt: "CPSC", width: "48", height: "48", style: "object-fit:contain;" }));
    pLogos.appendChild(U.el("img", { src: "/img/rhu-logo.png", alt: "RHU Mahinog", width: "48", height: "48", style: "object-fit:contain;" }));
    pHead.appendChild(pLogos);
    pHead.appendChild(U.el("div", { style: "font-size:0.75rem; font-weight:700; text-transform:uppercase; letter-spacing:0.06em; color:#0b3d30;" }, "Republic of the Philippines · Province of Camiguin"));
    pHead.appendChild(U.el("h2", { style: "margin:0.25rem 0; font-size:1.35rem;" }, "Citizen Health Passport"));
    pHead.appendChild(U.el("p", { style: "margin:0; font-size:0.82rem; color:#4a655a;" }, "Municipality of Mahinog · Camiguin Polytechnic State College & Rural Health Unit"));
    passport.appendChild(pHead);

    var infoDl = U.el("dl", { class: "kv", style: "margin-bottom:1rem;" });
    function addInfo(lbl, val) {
      var item = U.el("div", { class: "kv-item" });
      item.appendChild(U.el("dt", null, lbl));
      item.appendChild(U.el("dd", null, val || "—"));
      infoDl.appendChild(item);
    }
    addInfo("Citizen Name", profile.full_name || API.getName());
    addInfo("Username / ID", profile.username || "—");
    addInfo("Birthdate", profile.birthdate || "—");
    addInfo("Gender", profile.gender ? profile.gender.toUpperCase() : "—");
    if (profile.visit_count !== undefined) {
      addInfo("Total Kiosk Visits", String(profile.visit_count) + (profile.visit_count === 1 ? " check-in" : " check-ins"));
    }
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

  function showVitalsGuideModal() {
    var backdrop = U.el("div", { class: "modal-backdrop" });
    var card = U.el("div", { class: "modal-card vitals-guide-modal", style: "max-width: 640px;" });

    var header = U.el("div", { class: "modal-header" });
    header.appendChild(U.el("h3", null, "Clinical Vitals Reference Guide"));
    var closeBtn = U.el("button", { class: "btn btn-ghost", type: "button", "aria-label": "Close" }, "✕");
    header.appendChild(closeBtn);
    card.appendChild(header);

    var body = U.el("div", { class: "modal-body" });
    var intro = U.el("p", { class: "lede", style: "font-size:0.9rem; margin-bottom:1rem;" },
      "Standard clinical classification ranges used by the Barangay Health Station, Camiguin Rural Health Unit (RHU), and Department of Health (DOH)."
    );
    body.appendChild(intro);

    function addSection(title, rows) {
      var sec = U.el("div", { style: "margin-bottom:1.1rem;" });
      sec.appendChild(U.el("h4", { style: "font-size:0.95rem; font-weight:700; color:var(--green-900); margin-bottom:0.4rem;" }, title));
      var table = U.el("table", { class: "vitals-guide-table", style: "width:100%; font-size:0.85rem;" });
      var tbody = U.el("tbody");
      rows.forEach(function (r) {
        var tr = U.el("tr");
        var tdLabel = U.el("td", { style: "font-weight:600; width:40%; padding:0.35rem 0.5rem;" });
        if (r.badge) {
          tdLabel.appendChild(U.el("span", { class: "vital-badge badge-" + r.badge, style: "margin-right:0.35rem;" }, r.status));
        } else {
          tdLabel.textContent = r.status;
        }
        tr.appendChild(tdLabel);
        tr.appendChild(U.el("td", { style: "width:30%; padding:0.35rem 0.5rem; color:var(--ink-soft);" }, r.range));
        tr.appendChild(U.el("td", { style: "width:30%; padding:0.35rem 0.5rem; color:var(--ink-muted); font-size:0.8rem;" }, r.note));
        tbody.appendChild(tr);
      });
      table.appendChild(tbody);
      sec.appendChild(table);
      body.appendChild(sec);
    }

    addSection("Blood Pressure (Systolic / Diastolic mmHg)", [
      { status: "Normal", range: "< 120 and < 80", note: "Healthy optimal range", badge: "ok" },
      { status: "Elevated", range: "120–129 and < 80", note: "Lifestyle counseling", badge: "warn" },
      { status: "Stage 1 HTN", range: "130–139 or 80–89", note: "Monitor & follow-up", badge: "warn" },
      { status: "Stage 2 HTN", range: "≥ 140 or ≥ 90", note: "Clinical referral required", badge: "alert" },
      { status: "Hypertensive Crisis", range: "≥ 180 and/or ≥ 120", note: "Immediate medical care", badge: "alert" }
    ]);

    addSection("Body Mass Index (BMI — Asian / WHO-WPR)", [
      { status: "Underweight", range: "< 18.5", note: "Nutritional review", badge: "warn" },
      { status: "Normal weight", range: "18.5 – 24.9", note: "Healthy baseline", badge: "ok" },
      { status: "Overweight", range: "25.0 – 29.9", note: "Weight management", badge: "warn" },
      { status: "Obese", range: "≥ 30.0", note: "Health plan recommended", badge: "alert" }
    ]);

    addSection("Blood Oxygen (SpO2 %)", [
      { status: "Normal", range: "95% – 100%", note: "Healthy oxygenation", badge: "ok" },
      { status: "Low", range: "90% – 94%", note: "Rest and observation", badge: "warn" },
      { status: "Critical", range: "< 90%", note: "Seek clinical care", badge: "alert" }
    ]);

    addSection("Body Temperature (°C)", [
      { status: "Normal", range: "36.5°C – 37.5°C", note: "Normothermic", badge: "ok" },
      { status: "Elevated / Fever", range: "≥ 37.9°C", note: "Hydration & monitoring", badge: "alert" }
    ]);

    card.appendChild(body);

    var mFoot = U.el("div", { class: "modal-footer" });
    var dismissBtn = U.el("button", { class: "btn btn-primary", type: "button" }, "Got it");
    mFoot.appendChild(dismissBtn);
    card.appendChild(mFoot);

    backdrop.appendChild(card);
    document.body.appendChild(backdrop);

    var closeDialog = U.openDialog(backdrop, closeBtn);
    closeBtn.onclick = closeDialog;
    dismissBtn.onclick = closeDialog;
  }

  function showCitizenConsentModal(onDismiss) {
    if (document.getElementById("citizenConsentModalBackdrop")) return;

    var backdrop = U.el("div", {
      id: "citizenConsentModalBackdrop",
      class: "modal-backdrop",
    });
    var card = U.el("div", {
      class: "modal-card privacy-consent-modal",
      style: "max-width: 620px;",
    });

    var header = U.el("div", { class: "modal-header" });
    var headerLeft = U.el("div");
    var badge = U.el(
      "span",
      {
        class: "badge badge-ok",
        style:
          "display:inline-block; font-size:0.75rem; text-transform:uppercase; letter-spacing:0.04em; margin-bottom:0.25rem;",
      },
      "Data Privacy Act · Republic Act No. 10173"
    );
    headerLeft.appendChild(badge);
    headerLeft.appendChild(
      U.el(
        "h3",
        { style: "margin:0; font-size:1.15rem; color:#fff;" },
        "Patient Health Privacy Reminder"
      )
    );
    header.appendChild(headerLeft);
    card.appendChild(header);

    var body = U.el("div", {
      class: "modal-body",
      style: "font-size:0.92rem; line-height:1.55;",
    });

    var introP = U.el("p", { style: "margin-top:0; color:var(--ink-base);" });
    introP.innerHTML =
      "Welcome to the <strong>Barangay Health Monitoring System</strong>. " +
      "Under <strong>Republic Act No. 10173 (Philippine Data Privacy Act of 2012)</strong>, " +
      "your health vitals (blood pressure, heart rate, oxygen saturation, temperature, height, weight, and BMI) " +
      "are legally classified as <strong>Sensitive Personal Information (SPI)</strong>.";
    body.appendChild(introP);

    var calloutBox = U.el("div", {
      class: "statutory-callout",
      style:
        "background:var(--green-050); border-left:4px solid var(--green-600); padding:0.85rem 1rem; border-radius:6px; margin:0.9rem 0;",
    });
    calloutBox.appendChild(
      U.el(
        "h4",
        {
          style:
            "margin:0 0 0.4rem 0; font-size:0.92rem; color:var(--green-900); font-weight:700;",
        },
        "How Your Health Data is Handled"
      )
    );
    var calloutList = U.el("ul", {
      style: "margin:0; padding-left:1.2rem; font-size:0.88rem; color:var(--ink-soft);",
    });
    calloutList.appendChild(
      U.el(
        "li",
        null,
        "Primary Healthcare Triage: Immediate detection of elevated blood pressure, fever, and triage risks."
      )
    );
    calloutList.appendChild(
      U.el(
        "li",
        null,
        "Barangay Health Assistance: Clinical guidance, consultation scheduling, and RHU referral coordination."
      )
    );
    calloutList.appendChild(
      U.el(
        "li",
        null,
        "Community Epidemiology: Anonymous statistics for municipal health planning."
      )
    );
    calloutBox.appendChild(calloutList);
    body.appendChild(calloutBox);

    var rightsP = U.el("p", {
      style:
        "font-size:0.86rem; color:var(--ink-soft); background:#f9fafb; border:1px solid var(--line); border-radius:6px; padding:0.75rem 0.9rem; margin-bottom:0; line-height:1.45;",
    });
    rightsP.innerHTML =
      "<strong>Your Data Rights:</strong> Your consent preference was documented when you registered or checked in at the Barangay Health Kiosk. " +
      "You retain full ownership of your data — you may inspect your history, export your logs as CSV, or adjust your health worker sharing settings anytime on the <strong>Consent</strong> page.";
    body.appendChild(rightsP);

    card.appendChild(body);

    var mFoot = U.el("div", {
      class: "modal-footer",
      style: "display:flex; justify-content:flex-end; align-items:center;",
    });

    var understandBtn = U.el(
      "button",
      { class: "btn btn-primary", type: "button", style: "min-width: 140px;" },
      "I Understand"
    );
    mFoot.appendChild(understandBtn);
    card.appendChild(mFoot);

    backdrop.appendChild(card);
    document.body.appendChild(backdrop);

    var closeDialog = U.openDialog(backdrop, understandBtn, { persistent: true });

    understandBtn.onclick = function () {
      sessionStorage.setItem("bhm:citizen_terms_seen", "1");
      closeDialog();
      if (typeof onDismiss === "function") {
        onDismiss();
      }
    };
  }

  function addCard(container, label, value, sub, tone, gauge, delta, spark, pendingSparks, refRange, badge, unit) {
    var card = U.el("div", { class: "card" + (tone ? " " + tone : "") });
    var topRow = U.el("div", { class: "card-top-row" });
    topRow.appendChild(U.el("div", { class: "label" }, label));
    if (badge) {
      topRow.appendChild(U.el("span", { class: "vital-badge badge-" + (badge.tone || "neutral") }, badge.text));
    }
    card.appendChild(topRow);

    var valRow = U.el("div", { class: "value-row" });
    var valStr = String(value === null || value === undefined ? "—" : value);
    var valUnit = unit || "";

    if (!valUnit && typeof valStr === "string") {
      var match = valStr.match(/^([0-9./—-]+)\s*([a-zA-Z°%]+.*)$/);
      if (match) {
        valStr = match[1];
        valUnit = match[2];
      }
    }

    valRow.appendChild(U.el("span", { class: "value" }, valStr));
    if (valUnit) {
      valRow.appendChild(U.el("span", { class: "unit" }, valUnit));
    }
    card.appendChild(valRow);

    if (refRange || delta) {
      var metaRow = U.el("div", { class: "card-meta" });
      if (refRange) metaRow.appendChild(U.el("span", { class: "ref-range" }, refRange));
      if (delta) metaRow.appendChild(delta);
      card.appendChild(metaRow);
    }

    if (sub) card.appendChild(U.el("div", { class: "sub" }, sub));
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
    var strokeColor = color || "#0f6b53";
    sparkCharts.push(new window.Chart(ctx, {
      type: "line",
      data: {
        labels: ascendingVals.map(function () { return ""; }),
        datasets: [{
          data: ascendingVals,
          borderColor: strokeColor,
          backgroundColor: strokeColor === "#a5271d" || strokeColor === "#c0392b"
            ? "rgba(165, 39, 29, 0.08)"
            : "rgba(15, 107, 83, 0.07)",
          fill: true,
          spanGaps: true,
          tension: 0.35,
          pointRadius: 0,
          borderWidth: 1.75,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: false,
        plugins: { legend: { display: false }, tooltip: { enabled: false } },
        scales: { x: { display: false }, y: { display: false } },
        layout: { padding: { top: 2, bottom: 2, left: 1, right: 1 } },
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

  /* Plain-language trend line for a chart, e.g.
   * "Systolic went from 128 to 135 mmHg over 5 readings (up 7)." */
  function trendSentence(values, label, unit, decimals) {
    var pts = values.filter(function (v) { return v !== null; }).map(Number);
    if (pts.length < 2) return "";
    var d = decimals || 0;
    var first = pts[0];
    var last = pts[pts.length - 1];
    var diff = last - first;
    var u = unit ? " " + unit : "";
    var change = Math.abs(diff) < Math.pow(10, -d) / 2
      ? "no change"
      : (diff > 0 ? "up " : "down ") + Math.abs(diff).toFixed(d);
    return label + " went from " + first.toFixed(d) + " to " + last.toFixed(d) + u +
      " over " + pts.length + " readings (" + change + ").";
  }

  function setChartSummary(id, parts) {
    var node = document.getElementById(id);
    if (!node) return;
    node.textContent = parts.filter(Boolean).join(" ");
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
      setChartSummary("bpMiniSummary", [
        trendSentence(sys, "Systolic", "mmHg"),
        trendSentence(dia, "Diastolic", "mmHg"),
      ]);
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
      setChartSummary("weightMiniSummary", [
        trendSentence(weight, "Weight", "kg", 1),
        trendSentence(bmi, "BMI", "", 1),
      ]);
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
      ? createGauge("track-bp", ((log.systolic_bp - 90) / (190 - 90)) * 100, "90 Normal", "180+ High") : null;
    var bpBadge = isMissing(log.systolic_bp) || isMissing(log.diastolic_bp)
      ? null
      : bpCat === "Normal"
        ? { text: "Normal", tone: "good" }
        : bpCat === "Elevated"
          ? { text: "Elevated", tone: "warn" }
          : { text: bpCat, tone: "danger" };
    addCard(
      fragHeadline,
      "Blood pressure",
      isMissing(log.systolic_bp) || isMissing(log.diastolic_bp)
        ? "—"
        : log.systolic_bp + "/" + log.diastolic_bp,
      null,
      isMissing(log.systolic_bp) || isMissing(log.diastolic_bp)
        ? "missing"
        : bpCat === "Normal"
          ? null
          : "abnormal",
      bpGauge,
      bpDelta,
      spark(logs, "systolic_bp", "#0f6b53"),
      pendingSparks,
      "Target: <120/80 mmHg",
      bpBadge,
      "mmHg"
    );

    var spo2Cat = spo2Category(log.spo2);
    var spo2Gauge = !isMissing(log.spo2)
      ? createGauge("track-spo2", ((log.spo2 - 80) / (100 - 80)) * 100, "85% Low", "95%+ Normal") : null;
    var spo2Badge = isMissing(log.spo2)
      ? null
      : spo2Cat === "Normal"
        ? { text: "Normal", tone: "good" }
        : spo2Cat === "Low"
          ? { text: "Low SpO2", tone: "warn" }
          : { text: "Critical", tone: "danger" };
    addCard(
      fragHeadline,
      "SpO2 (Oxygen)",
      U.fmtNum(log.spo2, 0),
      null,
      isMissing(log.spo2) ? "missing" : spo2Cat === "Normal" ? null : "abnormal",
      spo2Gauge,
      spo2Delta,
      spark(logs, "spo2", "#0f6b53"),
      pendingSparks,
      "Normal: 95–100%",
      spo2Badge,
      "%"
    );

    var hasFever = !isMissing(log.temperature) && Number(log.temperature) >= 37.9;
    var tempGauge = !isMissing(log.temperature)
      ? createGauge("track-temp", ((log.temperature - 35) / (40 - 35)) * 100, "36.0°C", "38.0°C+ Fever") : null;
    var tempBadge = isMissing(log.temperature)
      ? null
      : hasFever
        ? { text: "Fever", tone: "danger" }
        : { text: "Normal", tone: "good" };
    addCard(
      fragHeadline,
      "Body temperature",
      U.fmtNum(log.temperature, 1),
      null,
      isMissing(log.temperature) ? "missing" : hasFever ? "abnormal" : null,
      tempGauge,
      tempDelta,
      spark(logs, "temperature", hasFever ? "#c0392b" : "#0f6b53"),
      pendingSparks,
      "Normal: 36.5–37.5 °C",
      tempBadge,
      "°C"
    );

    var pulseBadge = isMissing(log.pulse_rate)
      ? null
      : (log.pulse_rate >= 60 && log.pulse_rate <= 100)
        ? { text: "Normal", tone: "good" }
        : { text: log.pulse_rate < 60 ? "Low pulse" : "Elevated", tone: "warn" };
    addCard(
      fragSupport,
      "Pulse rate",
      U.fmtNum(log.pulse_rate, 0),
      null,
      isMissing(log.pulse_rate) ? "missing" : null,
      null,
      pulseDelta,
      spark(logs, "pulse_rate", "#0f6b53"),
      pendingSparks,
      "Resting: 60–100 bpm",
      pulseBadge,
      "bpm"
    );

    var bmiCat = bmiCategory(log.bmi);
    var bmiGauge = !isMissing(log.bmi)
      ? createGauge("track-bmi", ((log.bmi - 15) / (35 - 15)) * 100, "18.5 Min", "30.0+ Obese") : null;
    var bmiBadge = isMissing(log.bmi)
      ? null
      : bmiCat === "Normal"
        ? { text: "Normal", tone: "good" }
        : { text: bmiCat, tone: "warn" };
    addCard(
      fragSupport,
      "Body mass index",
      isMissing(log.bmi) ? "—" : U.fmtNum(log.bmi, 1),
      null,
      isMissing(log.bmi) ? "missing" : bmiCat === "Normal" ? null : "abnormal",
      bmiGauge,
      bmiDelta,
      spark(logs, "bmi", "#0f6b53"),
      pendingSparks,
      "Normal: 18.5–24.9",
      bmiBadge,
      "BMI"
    );

    addCard(
      fragSupport,
      "Weight",
      U.fmtNum(log.weight, 1),
      null,
      isMissing(log.weight) ? "missing" : null,
      null,
      weightDelta,
      spark(logs, "weight", "#0f6b53"),
      pendingSparks,
      "Recorded at kiosk",
      null,
      "kg"
    );

    addCard(
      fragSupport,
      "Height",
      U.fmtNum(log.height, 1),
      null,
      isMissing(log.height) ? "missing" : null,
      null,
      null,
      null,
      null,
      "Standing stature",
      null,
      "cm"
    );

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
        var consentInfo = results[1] || {};
        renderConsentChip(Boolean(consentInfo.consent_granted));

        var shouldShowConsentModal =
          !isAuto &&
          (consentInfo.has_recorded_consent === false ||
            !sessionStorage.getItem("bhm:citizen_terms_seen"));

        if (shouldShowConsentModal) {
          showCitizenConsentModal();
        }

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
        var visitsCount = logs.length;
        var visitsLabel = visitsCount === 1 ? "1 check-in" : (visitsCount + " check-ins");
        meta.textContent =
          "Latest reading: " + U.fmtDT(latest.timestamp) + " · " + U.fmtAge(latest.timestamp) + " · " + visitsLabel;

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

    var guideBtnDashboard = document.getElementById("vitalsGuideBtnDashboard");
    if (guideBtnDashboard) {
      guideBtnDashboard.onclick = showVitalsGuideModal;
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

    // Real-time live synchronization: instantly updates cards when kiosk POSTs
    var realtimeSync = API.initRealtimeSync({
      initialLogId: (latestLog && latestLog.id) || 0,
      onReading: function (reading) {
        load({ auto: true }).then(function (ok) {
          if (!ok) return;
          var allCards = document.querySelectorAll("#cards .card, #supportCards .card");
          allCards.forEach(function (c) {
            c.classList.remove("card-pulse");
            void c.offsetWidth;
            c.classList.add("card-pulse");
          });
          var bmiNote = reading.bmi ? (" · BMI: " + reading.bmi) : "";
          U.toast("New kiosk measurement received!" + bmiNote, "success");
        });
      },
    });
  }

  /* ---------------- history ---------------- */

  var historyState = {
    logs: [],
    filter: "",
    range: "all",
    page: 1,
    pageSize: 10,
  };

  var HISTORY_RANGES = [
    { key: "all", label: "All time", days: null },
    { key: "7", label: "Last 7 days", days: 7 },
    { key: "30", label: "Last 30 days", days: 30 },
    { key: "90", label: "Last 90 days", days: 90 },
  ];

  function logTime(log) {
    return new Date(String(log.timestamp).replace(" ", "T") + "Z").getTime();
  }

  /* Per-cell tone for the history table: "" | "cell-warn" | "cell-bad". */
  function cellTone(kind, log) {
    switch (kind) {
      case "bp": {
        var c = bpCategory(log.systolic_bp, log.diastolic_bp);
        if (!c || c === "Normal") return "";
        return c === "Elevated" || c === "Stage 1" ? "cell-warn" : "cell-bad";
      }
      case "spo2": {
        var s = spo2Category(log.spo2);
        return s === "Critical" ? "cell-bad" : s === "Low" ? "cell-warn" : "";
      }
      case "temp":
        if (isMissing(log.temperature)) return "";
        if (log.temperature >= 37.9) return "cell-bad";
        return log.temperature < 35.5 ? "cell-warn" : "";
      case "pulse":
        if (isMissing(log.pulse_rate)) return "";
        return log.pulse_rate < 60 || log.pulse_rate > 100 ? "cell-warn" : "";
      case "bmi": {
        var b = bmiCategory(log.bmi);
        return b && b !== "Normal" ? "cell-warn" : "";
      }
      default:
        return "";
    }
  }

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

      var presets = U.el("div", { class: "date-presets", role: "group", "aria-label": "Show readings from" });
      HISTORY_RANGES.forEach(function (r) {
        var btn = U.el("button", {
          type: "button",
          class: "date-preset-btn" + (historyState.range === r.key ? " active" : ""),
          "aria-pressed": historyState.range === r.key ? "true" : "false",
        }, r.label);
        btn.onclick = function () {
          historyState.range = r.key;
          historyState.page = 1;
          presets.querySelectorAll(".date-preset-btn").forEach(function (b) {
            b.classList.remove("active");
            b.setAttribute("aria-pressed", "false");
          });
          btn.classList.add("active");
          btn.setAttribute("aria-pressed", "true");
          drawTableRows();
        };
        presets.appendChild(btn);
      });
      controls.appendChild(presets);

      var countLbl = U.el("span", { id: "historyCount", class: "muted", style: "font-size:0.85rem;" }, logs.length + " total readings");
      controls.appendChild(countLbl);
    }

    drawTableRows();
  }

  function drawTableRows() {
    var wrap = document.getElementById("tableWrap");
    var paginationWrap = document.getElementById("paginationWrap");
    U.clear(wrap);
    if (paginationWrap) U.clear(paginationWrap);

    var range = HISTORY_RANGES.filter(function (r) { return r.key === historyState.range; })[0];
    var cutoff = range && range.days ? Date.now() - range.days * 86400000 : null;

    var filtered = historyState.logs.filter(function (log) {
      if (cutoff !== null && logTime(log) < cutoff) return false;
      if (!historyState.filter) return true;
      var text = (U.fmtDT(log.timestamp) + " " + (log.weight || "") + " " + (log.bmi || "") + " " +
        (log.systolic_bp || "") + "/" + (log.diastolic_bp || "") + " " + (log.temperature || "")).toLowerCase();
      return text.indexOf(historyState.filter) >= 0;
    });

    var countLbl = document.getElementById("historyCount");
    if (countLbl) {
      countLbl.textContent = filtered.length === historyState.logs.length
        ? historyState.logs.length + " total readings"
        : "Showing " + filtered.length + " of " + historyState.logs.length + " readings";
    }

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
      row.appendChild(U.el("td", { class: "cell-time nowrap", title: U.fmtUTC(log.timestamp), style: "font-weight:600; text-align:left;" }, U.fmtDT(log.timestamp)));
      [
        [U.fmtNum(log.weight, 1), ""],
        [U.fmtNum(log.height, 1), ""],
        [U.fmtNum(log.bmi, 1), cellTone("bmi", log)],
        [U.fmtNum(log.temperature, 1), cellTone("temp", log)],
        [U.fmtNum(log.pulse_rate, 0), cellTone("pulse", log)],
        [U.fmtNum(log.spo2, 0), cellTone("spo2", log)],
        [isMissing(log.systolic_bp) || isMissing(log.diastolic_bp)
          ? "—"
          : log.systolic_bp + "/" + log.diastolic_bp, cellTone("bp", log)],
      ].forEach(function (pair) {
        var tone = pair[1];
        var td = U.el("td", { class: "num" + (tone ? " " + tone : "") });
        td.appendChild(document.createTextNode(pair[0]));
        if (tone) {
          // Not colour-only: screen readers and greyscale prints get a word.
          td.appendChild(U.el("span", { class: "sr-only" }, tone === "cell-bad" ? " (needs attention)" : " (outside normal range)"));
        }
        row.appendChild(td);
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
    function series(key) {
      return ascending.map(function (log) { return isMissing(log[key]) ? null : log[key]; });
    }
    setChartSummary("temperatureSummary", [trendSentence(series("temperature"), "Temperature", "°C", 1)]);
    setChartSummary("weightSummary", [trendSentence(series("weight"), "Weight", "kg", 1)]);
    setChartSummary("bmiSummary", [trendSentence(series("bmi"), "BMI", "", 1)]);
    setChartSummary("bpSummary", [
      trendSentence(series("systolic_bp"), "Systolic", "mmHg"),
      trendSentence(series("diastolic_bp"), "Diastolic", "mmHg"),
    ]);
    setChartSummary("spo2Summary", [trendSentence(series("spo2"), "SpO2", "%")]);
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

    var guideBtnHistory = document.getElementById("vitalsGuideBtnHistory");
    if (guideBtnHistory) {
      guideBtnHistory.onclick = showVitalsGuideModal;
    }

    var exportCsvBtn = document.getElementById("exportCsvBtn");
    if (exportCsvBtn) {
      exportCsvBtn.onclick = function () {
        var logs = historyState.logs || [];
        if (!logs.length) {
          U.toast("No measurement records to export.", "warn");
          return;
        }
        var headers = [
          "Timestamp (PHT)",
          "Systolic BP (mmHg)",
          "Diastolic BP (mmHg)",
          "BP Category",
          "Heart Rate (bpm)",
          "SpO2 (%)",
          "Temperature (°C)",
          "Weight (kg)",
          "Height (cm)",
          "BMI",
          "BMI Category"
        ];
        var rows = logs.map(function (log) {
          return [
            U.fmtDT(log.timestamp),
            isMissing(log.systolic_bp) ? "" : log.systolic_bp,
            isMissing(log.diastolic_bp) ? "" : log.diastolic_bp,
            bpCategory(log.systolic_bp, log.diastolic_bp) || "",
            isMissing(log.pulse_rate) ? "" : log.pulse_rate,
            isMissing(log.spo2) ? "" : log.spo2,
            isMissing(log.temperature) ? "" : log.temperature,
            isMissing(log.weight) ? "" : log.weight,
            isMissing(log.height) ? "" : log.height,
            isMissing(log.bmi) ? "" : log.bmi,
            bmiCategory(log.bmi) || ""
          ].map(function (cell) {
            var s = String(cell == null ? "" : cell);
            if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
            s = s.replace(/"/g, '""');
            return /[",\r\n]/.test(s) ? '"' + s + '"' : s;
          }).join(",");
        });
        var csvContent = "\uFEFF" + headers.join(",") + "\r\n" + rows.join("\r\n");
        var blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
        var url = URL.createObjectURL(blob);
        var a = document.createElement("a");
        var dateSlug = new Date().toISOString().slice(0, 10);
        a.href = url;
        a.download = "health_records_" + dateSlug + ".csv";
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        U.toast("Exported " + logs.length + " health records to CSV", "success");
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

      API.initRealtimeSync({
        onReading: function () {
          API.apiFetch("/api/health-data").then(function (res) {
            var freshLogs = res.logs || [];
            historyState.logs = freshLogs;
            if (freshLogs.length > 0) {
              section.hidden = false;
              renderLogTable(freshLogs);
              renderCharts(freshLogs);
              U.toast("New measurement added to history!", "success");
            }
          });
        },
      });
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
    var colOn = document.getElementById("consentColOn");
    var colOff = document.getElementById("consentColOff");
    if (colOn) colOn.classList.toggle("is-current", granted);
    if (colOff) colOff.classList.toggle("is-current", !granted);
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
      row.appendChild(U.el("td", { class: "cell-time nowrap", title: U.fmtUTC(entry.timestamp), style: "font-weight:600; text-align:left;" }, U.fmtDT(entry.timestamp)));
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

  /* Inline, per-field validation message under an input. Pass "" to clear. */
  function setFieldError(input, message) {
    if (!input) return;
    var errId = input.id + "FieldError";
    var node = document.getElementById(errId);
    if (!node) {
      node = U.el("p", { id: errId, class: "field-error" });
      var field = input.closest(".field") || input.parentNode;
      field.appendChild(node);
      var described = (input.getAttribute("aria-describedby") || "").split(" ").filter(Boolean);
      if (described.indexOf(errId) < 0) described.unshift(errId);
      input.setAttribute("aria-describedby", described.join(" "));
    }
    node.textContent = message || "";
    if (message) input.setAttribute("aria-invalid", "true");
    else input.removeAttribute("aria-invalid");
  }

  function todayISO() {
    var d = new Date();
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  }

  function validateFullName(value) {
    if (!value) return "Full name is required.";
    if (value.length < 2) return "Enter your full name.";
    return "";
  }

  function validateBirthdate(value) {
    if (!value) return "Birthdate is required.";
    if (value > todayISO()) return "Birthdate cannot be in the future.";
    if (value < "1900-01-01") return "Check the year of your birthdate.";
    return "";
  }

  async function initProfile() {
    if (!API.requireRole("citizen")) return;
    var statusNode = document.getElementById("status");
    var profileForm = document.getElementById("profileForm");
    var passwordForm = document.getElementById("passwordForm");
    var profileError = document.getElementById("profileError");
    var profileFeedback = document.getElementById("profileFeedback");
    var passwordError = document.getElementById("passwordError");
    var passwordFeedback = document.getElementById("passwordFeedback");
    var nameInput = document.getElementById("fullName");
    var birthInput = document.getElementById("birthdate");
    var genderSelect = document.getElementById("gender");
    var profileSubmit = document.getElementById("profileSubmit");
    var newPwInput = document.getElementById("newPassword");
    var pwHint = document.getElementById("passwordHint");
    var saved = null; // last saved values, for unsaved-change tracking
    var feedbackTimer = null;

    birthInput.max = todayISO();

    function currentValues() {
      return { full_name: fieldValue("fullName"), birthdate: fieldValue("birthdate"), gender: fieldValue("gender") };
    }

    function isDirty() {
      if (!saved) return false;
      var now = currentValues();
      return now.full_name !== saved.full_name || now.birthdate !== saved.birthdate || now.gender !== saved.gender;
    }

    function updateDirty() {
      var dirty = isDirty();
      profileSubmit.disabled = !dirty;
      profileSubmit.textContent = dirty ? "Save changes" : "No changes to save";
    }

    function flash(node, message) {
      node.textContent = message;
      if (feedbackTimer) window.clearTimeout(feedbackTimer);
      feedbackTimer = window.setTimeout(function () { node.textContent = ""; }, 6000);
    }

    U.loading(statusNode, "Loading your profile…");
    try {
      var me = await API.apiFetch("/api/me");
      U.clear(statusNode);
      document.getElementById("usernameReadonly").value = me.username;
      nameInput.value = me.full_name;
      birthInput.value = me.birthdate;
      genderSelect.value = ["male", "female", "other"].indexOf(me.gender) >= 0 ? me.gender : "other";
      saved = currentValues();
      updateDirty();
    } catch (error) {
      U.error(statusNode, error.message);
      return;
    }

    [nameInput, birthInput, genderSelect].forEach(function (node) {
      node.addEventListener("input", function () {
        showFormError(profileFeedback, "");
        // Clear an error as soon as the user fixes it; don't nag while typing.
        if (node.getAttribute("aria-invalid") === "true") {
          setFieldError(node, node === nameInput ? validateFullName(node.value.trim()) : node === birthInput ? validateBirthdate(node.value) : "");
        }
        updateDirty();
      });
      node.addEventListener("change", updateDirty);
    });
    nameInput.addEventListener("blur", function () { if (saved) setFieldError(nameInput, validateFullName(nameInput.value.trim())); });
    birthInput.addEventListener("blur", function () { if (saved) setFieldError(birthInput, validateBirthdate(birthInput.value)); });

    // Warn before leaving with unsaved edits.
    window.addEventListener("beforeunload", function (event) {
      if (isDirty()) {
        event.preventDefault();
        event.returnValue = "";
      }
    });

    profileForm.addEventListener("submit", async function (event) {
      event.preventDefault();
      showFormError(profileError, "");
      showFormError(profileFeedback, "");
      var payload = currentValues();
      var nameErr = validateFullName(payload.full_name);
      var birthErr = validateBirthdate(payload.birthdate);
      setFieldError(nameInput, nameErr);
      setFieldError(birthInput, birthErr);
      if (nameErr || birthErr) {
        (nameErr ? nameInput : birthInput).focus();
        return;
      }
      setBusy(profileSubmit, true, "Saving…");
      var ok = false;
      try {
        await API.apiFetch("/api/citizen/profile", { method: "PUT", body: payload });
        ok = true;
        saved = payload;
        API.saveSession(API.getToken(), API.getRole(), payload.full_name);
        if (API.renderWhoami) API.renderWhoami();
        var time = new Intl.DateTimeFormat("en-PH", { timeZone: "Asia/Manila", hour: "numeric", minute: "2-digit" }).format(new Date());
        flash(profileFeedback, "Saved at " + time + ". Your details are up to date.");
        U.toast("Profile updated", "success");
      } catch (error) {
        showFormError(profileError, error.message);
        U.toast(error.message, "error");
      } finally {
        setBusy(profileSubmit, false);
        updateDirty();
        if (!ok) profileSubmit.disabled = false;
      }
    });

    function updatePwHint() {
      var len = newPwInput.value.length;
      pwHint.classList.toggle("hint-ok", len >= 8);
      pwHint.textContent = len === 0
        ? "At least 8 characters."
        : len >= 8
          ? "Length looks good (" + len + " characters)."
          : (8 - len) + " more character" + (8 - len === 1 ? "" : "s") + " needed.";
    }
    newPwInput.addEventListener("input", function () {
      updatePwHint();
      if (newPwInput.getAttribute("aria-invalid") === "true" && newPwInput.value.length >= 8) setFieldError(newPwInput, "");
    });

    passwordForm.addEventListener("submit", async function (event) {
      event.preventDefault();
      showFormError(passwordError, "");
      showFormError(passwordFeedback, "");
      var submit = document.getElementById("passwordSubmit");
      var currentInput = document.getElementById("currentPassword");
      var current = currentInput.value;
      var next = newPwInput.value;
      setFieldError(currentInput, current ? "" : "Enter your current password.");
      setFieldError(newPwInput, next.length >= 8 ? "" : "New password must be at least 8 characters.");
      if (!current) { currentInput.focus(); return; }
      if (next.length < 8) { newPwInput.focus(); return; }
      if (next === current) {
        setFieldError(newPwInput, "New password must be different from your current one.");
        newPwInput.focus();
        return;
      }
      setBusy(submit, true, "Updating…");
      try {
        await API.apiFetch("/api/citizen/password", {
          method: "PUT",
          body: { current_password: current, new_password: next },
        });
        passwordForm.reset();
        updatePwHint();
        flash(passwordFeedback, "Password updated. Use your new password next time you sign in.");
        U.toast("Password updated", "success");
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

  /* ---------------- forgot password ---------------- */

  function initForgotPassword() {
    var form = document.getElementById("forgotPasswordForm");
    if (!form) return;
    var errorNode = document.getElementById("resetError");
    var successCard = document.getElementById("resetSuccess");
    var submit = document.getElementById("resetSubmit");
    var newPwInput = document.getElementById("newPassword");
    var pwHint = document.getElementById("passwordHint");

    function updatePwHint() {
      if (!pwHint || !newPwInput) return;
      var len = newPwInput.value.length;
      pwHint.classList.toggle("hint-ok", len >= 8);
      pwHint.textContent = len === 0
        ? "At least 8 characters."
        : len >= 8
          ? "Length looks good (" + len + " characters)."
          : (8 - len) + " more character" + (8 - len === 1 ? "" : "s") + " needed.";
    }

    if (newPwInput) {
      newPwInput.addEventListener("input", updatePwHint);
    }

    form.addEventListener("submit", async function (event) {
      event.preventDefault();
      showFormError(errorNode, "");

      var username = fieldValue("username");
      var fullName = fieldValue("fullName");
      var birthdate = fieldValue("birthdate");
      var newPassword = document.getElementById("newPassword").value;
      var confirmPassword = document.getElementById("confirmPassword").value;

      if (!username) {
        showFormError(errorNode, "Please enter your username.");
        return;
      }
      if (!fullName) {
        showFormError(errorNode, "Please enter your full name as registered.");
        return;
      }
      if (!birthdate) {
        showFormError(errorNode, "Please select your registered birthdate.");
        return;
      }
      if (!newPassword || newPassword.length < 8) {
        showFormError(errorNode, "New password must be at least 8 characters long.");
        return;
      }
      if (newPassword !== confirmPassword) {
        showFormError(errorNode, "Passwords do not match. Please verify both fields.");
        return;
      }

      setBusy(submit, true, "Verifying details…");
      try {
        await API.apiFetch("/api/forgot-password", {
          method: "POST",
          body: {
            username: username,
            full_name: fullName,
            birthdate: birthdate,
            new_password: newPassword,
          },
        });
        form.style.display = "none";
        if (successCard) successCard.style.display = "block";
        U.toast("Password reset complete. You can now sign in.", "success");
      } catch (err) {
        showFormError(errorNode, err.message || "Failed to reset password. Please check your details.");
        setBusy(submit, false);
      }
    });
  }

  /* ---------------- router ---------------- */

  document.addEventListener("DOMContentLoaded", function () {
    var page = document.body.getAttribute("data-page");
    if (page === "citizen-login" || page === "bhw-login") initLogin();
    else if (page === "citizen-register") initRegister();
    else if (page === "citizen-forgot-password") initForgotPassword();
    else if (page === "citizen-dashboard") initDashboard();
    else if (page === "citizen-history") initHistory();
    else if (page === "citizen-consent") initConsent();
    else if (page === "citizen-profile") initProfile();
  });
})();
