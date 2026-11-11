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

  function formatDateISO(d) {
    var year = d.getFullYear();
    var month = String(d.getMonth() + 1).padStart(2, "0");
    var day = String(d.getDate()).padStart(2, "0");
    return year + "-" + month + "-" + day;
  }

  function bindDatePresets(formOrContainer, fromId, toId, onApply) {
    if (!formOrContainer) return;
    var fromInput = document.getElementById(fromId);
    var toInput = document.getElementById(toId);
    if (!fromInput || !toInput) return;
    var presetBtns = formOrContainer.querySelectorAll(".date-preset-btn");
    presetBtns.forEach(function (btn) {
      btn.addEventListener("click", function () {
        var range = btn.getAttribute("data-range");
        var now = new Date();
        var todayStr = formatDateISO(now);
        if (range === "today") {
          fromInput.value = todayStr;
          toInput.value = todayStr;
        } else if (range === "7d") {
          var d7 = new Date();
          d7.setDate(now.getDate() - 7);
          fromInput.value = formatDateISO(d7);
          toInput.value = todayStr;
        } else if (range === "30d") {
          var d30 = new Date();
          d30.setDate(now.getDate() - 30);
          fromInput.value = formatDateISO(d30);
          toInput.value = todayStr;
        } else if (range === "all") {
          fromInput.value = "";
          toInput.value = "";
        }
        presetBtns.forEach(function (b) { b.classList.remove("active"); });
        btn.classList.add("active");
        if (typeof onApply === "function") {
          onApply();
        }
      });
    });
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

  function totalCard(label, value, options) {
    options = options || {};
    var card = U.el("div", { class: "total" + (options.tone ? " " + options.tone : "") });
    card.appendChild(U.el("div", { class: "label" }, label));
    card.appendChild(U.el("div", { class: "value" }, String(value)));
    if (options.link) {
      card.appendChild(U.el("a", { class: "total-link", href: options.link.href }, options.link.text));
    }
    return card;
  }

  function destroyChart(key) {
    if (dashboardCharts[key]) {
      dashboardCharts[key].destroy();
      delete dashboardCharts[key];
    }
  }

  function distributionTable(keys, data, total) {
    var wrap = U.el("div");
    var table = U.el("table");
    var thead = U.el("thead");
    var headRow = U.el("tr");
    headRow.appendChild(U.el("th", { scope: "col" }, "Category"));
    headRow.appendChild(U.el("th", { class: "num", scope: "col" }, "Count"));
    headRow.appendChild(U.el("th", { class: "num", scope: "col" }, "Share"));
    thead.appendChild(headRow);
    table.appendChild(thead);
    var tbody = U.el("tbody");
    keys.forEach(function (key) {
      var row = U.el("tr");
      row.appendChild(U.el("th", { scope: "row", style: "font-weight:600; text-align:left; background:transparent;" }, key));
      row.appendChild(U.el("td", { class: "num" }, String(data[key])));
      var pct = total > 0 ? Math.round((data[key] / total) * 100) : 0;
      row.appendChild(U.el("td", { class: "num" }, pct + "%"));
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

  /* Inline per-chart plugin: draws "count (xx%)" at the end of each
   * horizontal bar so values are readable without hovering. Positions come
   * from the scales (not bar element geometry) to stay exact. */
  function valueLabelPlugin(total) {
    return {
      id: "valueLabels",
      afterDatasetsDraw: function (chart) {
        var xScale = chart.scales.x;
        var yScale = chart.scales.y;
        if (!xScale || !yScale) return;
        var ctx = chart.ctx;
        ctx.save();
        ctx.font = '700 11px "Segoe UI", system-ui, sans-serif';
        ctx.fillStyle = "#14332b";
        ctx.textBaseline = "middle";
        ctx.textAlign = "left";
        chart.data.datasets.forEach(function (dataset, datasetIndex) {
          var meta = chart.getDatasetMeta(datasetIndex);
          if (meta.hidden) return;
          dataset.data.forEach(function (value, index) {
            if (value === null || value === undefined) return;
            var pct = total > 0 ? Math.round((value / total) * 100) : 0;
            var xPos = xScale.getPixelForValue(value);
            var yPos = yScale.getPixelForIndex(index);
            ctx.fillText(value + " (" + pct + "%)", xPos + 6, yPos);
          });
        });
        ctx.restore();
      },
    };
  }

  function renderDistribution(container, key, title, data, animate) {
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

    var total = keys.reduce(function (sum, name) {
      return sum + data[name];
    }, 0);
    box.appendChild(
      U.el("p", { class: "chart-caption muted" }, "n = " + total + " readings classified in this period")
    );

    if (window.Chart) {
      var canvas = U.el("canvas", {
        role: "img",
        "aria-label": title + " bar chart: " + keys.map(function (name) {
          return name + " " + data[name];
        }).join(", "),
      });
      box.appendChild(canvas);
      container.appendChild(box);
      destroyChart("dist-" + key);
      var chartOptions = {
        indexAxis: "y",
        responsive: true,
        maintainAspectRatio: true,
        aspectRatio: 1.8,
        layout: { padding: { right: 72 } },
        plugins: { legend: { display: false } },
        scales: {
          x: { beginAtZero: true, ticks: { precision: 0 } },
          y: { ticks: { autoSkip: false } },
        },
      };
      // Auto-refresh ticks redraw without animation to avoid flicker.
      if (animate === false || prefersReducedMotion()) chartOptions.animation = false;
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
        options: chartOptions,
        plugins: [valueLabelPlugin(total)],
      });
      return;
    }

    var wrap = U.el("div", { class: "table-wrap", style: "box-shadow:none" });
    wrap.appendChild(distributionTable(keys, data, total));
    box.appendChild(wrap);
    container.appendChild(box);
  }

  function renderFeverChart(trend, animate) {
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
    var feverOptions = {
      responsive: true,
      maintainAspectRatio: true,
      // Full-width hero panel: wider aspect on desktop, taller on phones.
      aspectRatio: window.innerWidth < 640 ? 1.5 : 3,
      plugins: { legend: { display: false } },
      scales: {
        x: { ticks: { maxTicksLimit: 8, maxRotation: 0 } },
        y: { beginAtZero: true, ticks: { precision: 0 } },
      },
    };
    // Auto-refresh ticks redraw without animation to avoid flicker.
    if (animate === false || prefersReducedMotion()) feverOptions.animation = false;
    dashboardCharts.fever = new window.Chart(canvas, {
      type: "line",
      data: {
        labels: trend.map(function (item) {
          var d = new Date(item[0] + "T00:00:00Z");
          return new Intl.DateTimeFormat("en-PH", { timeZone: "Asia/Manila", month: "short", day: "numeric" }).format(d);
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
      options: feverOptions,
    });
  }

  /* Severity tone per concern label (aligned with DIST_COLORS). */
  var CONCERN_TONE = {
    "Stage 2 Hypertension": "tone-red",
    "BP Crisis": "tone-red",
    "High Fever": "tone-red",
    "Critical SpO2": "tone-red",
    "Obese": "tone-red",
    "Stage 1 Hypertension": "tone-amber",
    "Elevated BP": "tone-amber",
    "Low SpO2": "tone-amber",
    "Overweight": "tone-amber",
    "Underweight": "tone-amber",
  };

  function renderConcerns(concerns) {
    var list = document.getElementById("concerns");
    var emptyNode = document.getElementById("concernsEmpty");
    U.clear(list);
    if (!concerns.length) {
      emptyNode.hidden = false;
      return;
    }
    emptyNode.hidden = true;
    var max = 1;
    concerns.forEach(function (item) {
      if (item[1] > max) max = item[1];
    });
    var frag = document.createDocumentFragment();
    concerns.forEach(function (item) {
      var row = U.el("li");
      var head = U.el("div", { class: "concern-head" });
      head.appendChild(U.el("span", null, item[0]));
      head.appendChild(U.el("span", { class: "count" }, String(item[1])));
      row.appendChild(head);
      var track = U.el("div", { class: "concern-track" });
      var bar = U.el("div", {
        class: ("concern-bar " + (CONCERN_TONE[item[0]] || "")).trim(),
      });
      bar.style.width = Math.max(4, Math.round((item[1] / max) * 100)) + "%";
      track.appendChild(bar);
      row.appendChild(track);
      frag.appendChild(row);
    });
    list.appendChild(frag);
  }

  /* Resolved date range for the period select (shown next to the filter). */
  function fmtDay(date, withYear) {
    var opts = { timeZone: "Asia/Manila", month: "short", day: "numeric" };
    if (withYear) opts.year = "numeric";
    return new Intl.DateTimeFormat("en-PH", opts).format(date);
  }

  function rangeLabelFor(days) {
    if (days === "all") return "All time";
    var end = new Date();
    var start = new Date(end.getTime() - Number(days) * 86400000);
    var withYear = start.getFullYear() !== end.getFullYear();
    return fmtDay(start, withYear) + " – " + fmtDay(end, true) + " PHT";
  }

  function nowPht() {
    return (
      new Intl.DateTimeFormat("en-PH", {
        timeZone: "Asia/Manila",
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      }).format(new Date()) + " PHT"
    );
  }

  /* Chart animation is skipped for reduced-motion users (mirrors the CSS
   * prefers-reduced-motion block) as well as for auto-refresh ticks. */
  function prefersReducedMotion() {
    return Boolean(
      window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches
    );
  }

  /* At-a-glance context: consent coverage + kiosk freshness, computed
   * client-side from the existing /api/bhw/citizens payload — counts and
   * timestamps only; names never reach this dashboard. Failures degrade to
   * a quiet note and never touch the main dashboard (this runs outside
   * loadDashboard's try/catch). Loaded once at startup and on manual
   * refresh — not on the 30s tick, to avoid needless churn. */
  async function loadContext() {
    var donutNode = document.getElementById("consentDonut");
    var summaryNode = document.getElementById("consentDonutText");
    var freshnessNode = document.getElementById("kioskFreshness");
    if (!donutNode || !summaryNode || !freshnessNode) return;

    var data;
    try {
      data = await API.apiFetch("/api/bhw/citizens");
    } catch (error) {
      U.empty(summaryNode, "Coverage unavailable right now — try Refresh.");
      U.clear(freshnessNode);
      freshnessNode.appendChild(
        U.el("p", { class: "freshness none" }, "Freshness unavailable right now")
      );
      return;
    }

    var citizens = data.citizens || [];
    var granted = citizens.filter(function (citizen) {
      return Boolean(citizen.consent);
    }).length;
    var total = citizens.length;
    var pct = total > 0 ? Math.round((granted / total) * 100) : 0;

    // Consent coverage donut (falls back to the summary line without Chart.js).
    destroyChart("consentDonut");
    if (window.Chart && total > 0) {
      donutNode.hidden = false;
      dashboardCharts.consentDonut = new window.Chart(donutNode, {
        type: "doughnut",
        data: {
          labels: ["Consented", "Not consented"],
          datasets: [
            {
              data: [granted, total - granted],
              backgroundColor: ["#14876a", "#e6efeb"],
              borderColor: "#ffffff",
              borderWidth: 2,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: true,
          aspectRatio: 1.7,
          cutout: "66%",
          animation: prefersReducedMotion() ? false : undefined,
          plugins: { legend: { position: "bottom" } },
        },
      });
    } else {
      donutNode.hidden = true;
    }
    U.empty(
      summaryNode,
      total > 0
        ? granted + " of " + total + " citizens have granted consent (" + pct + "%)."
        : "No registered citizens yet."
    );

    // Kiosk freshness: newest last_measurement across the registry.
    var latestRaw = null;
    var latestMs = null;
    citizens.forEach(function (citizen) {
      var raw = citizen.last_measurement;
      if (!raw) return;
      var ms = Date.parse(String(raw).replace(" ", "T") + "Z");
      if (!isNaN(ms) && (latestMs === null || ms > latestMs)) {
        latestMs = ms;
        latestRaw = raw;
      }
    });

    U.clear(freshnessNode);
    if (!latestRaw) {
      freshnessNode.appendChild(U.el("p", { class: "freshness none" }, "No kiosk readings yet"));
      freshnessNode.appendChild(
        U.el("p", { class: "freshness-sub" }, "The health kiosk has not uploaded any measurements.")
      );
      return;
    }
    var hours = (Date.now() - latestMs) / 3600000;
    var tone = hours < 24 ? "" : hours < 72 ? " warn" : " stale";
    freshnessNode.appendChild(
      U.el("p", { class: ("freshness" + tone).trim() }, "Last reading " + U.fmtAge(latestRaw))
    );
    freshnessNode.appendChild(
      U.el("p", { class: "freshness-sub" }, U.fmtDT(latestRaw) + " · from the barangay kiosk")
    );
  }

  async function loadDashboard(options) {
    // animate:false is used by the 30s auto-refresh tick to avoid flicker.
    var animate = !options || options.animate !== false;
    var periodNode = document.getElementById("period");
    var statusNode = document.getElementById("status");
    var totalsNode = document.getElementById("totals");
    var registryNode = document.getElementById("registryTotals");
    var distNode = document.getElementById("distributions");
    var days = periodNode.value;

    // Stale-while-revalidate: keep current content visible while fetching,
    // show only a subtle "Updating…" indicator, and swap content on success.
    U.clear(statusNode);
    statusNode.appendChild(
      U.el("span", { class: "muted", style: "font-size:0.85rem;" }, "Updating…")
    );

    try {
      var data = await API.apiFetch("/api/bhw/dashboard?days=" + encodeURIComponent(days));
      U.clear(statusNode);

      // Resolved date range + last-updated stamp.
      var rangeNode = document.getElementById("rangeLabel");
      if (rangeNode) rangeNode.textContent = rangeLabelFor(days);
      var updatedNode = document.getElementById("lastUpdated");
      if (updatedNode) updatedNode.textContent = "Updated " + nowPht();

      var totals = data.totals || {};
      var alerts = totals.alerts || 0;

      // Period-scoped totals.
      U.clear(totalsNode);
      totalsNode.appendChild(totalCard("Measurements", totals.measurements || 0));
      totalsNode.appendChild(totalCard("Active kiosk citizens", totals.active_citizens || 0));
      totalsNode.appendChild(totalCard("Guest measurements", totals.guest_measurements || 0));
      totalsNode.appendChild(
        totalCard("Alerts", alerts, {
          tone: alerts > 0 ? "alert" : null,
          link: { href: "/bhw/search.html", text: "Review citizens →" },
        })
      );
      totalsNode.appendChild(totalCard("Consent grants (period)", totals.consent_grants || 0));

      // Registry totals are all-time and never change with the period filter,
      // so they live in their own labelled group.
      U.clear(registryNode);
      registryNode.appendChild(totalCard("Registered users", totals.users || 0));

      // An empty period gets an explanation instead of only bare zeros.
      var emptyNode = document.getElementById("emptyState");
      U.clear(emptyNode);
      if (!totals.measurements) {
        emptyNode.appendChild(
          U.el(
            "div",
            { class: "status empty" },
            days === "all"
              ? "No measurements recorded yet. Check that the health kiosk is online and syncing."
              : "No measurements in this period. Try a longer period, or check that the health kiosk is online and syncing."
          )
        );
      }

      var distributions = data.distributions || {};
      U.clear(distNode);
      renderDistribution(distNode, "bmi", "BMI categories", distributions.bmi || {}, animate);
      renderDistribution(distNode, "bp", "Blood pressure categories", distributions.bp || {}, animate);
      renderDistribution(distNode, "spo2", "SpO2 categories", distributions.spo2 || {}, animate);

      renderFeverChart(data.fever_trend || [], animate);
      renderConcerns(data.top_concerns || []);
      return true;
    } catch (error) {
      // Keep the stale content visible; surface the error with a Retry button.
      U.error(statusNode, error.message, loadDashboard);
      return false;
    }
  }

  var refreshTimer = null;

  function initDashboard() {
    if (!API.requireRole("bhw")) return;
    document.getElementById("period").addEventListener("change", function () {
      loadDashboard({ animate: true });
    });
    document.getElementById("refreshBtn").addEventListener("click", async function () {
      // Only report success when the fetch actually succeeded — otherwise the
      // user would see "Dashboard refreshed" over an error state.
      var ok = await loadDashboard({ animate: true });
      if (ok) U.toast("Dashboard refreshed", "success");
      loadContext(); // context panels refresh alongside the manual refresh
    });

    var toggle = document.getElementById("autoRefreshToggle");
    var liveText = document.getElementById("liveText");
    var secondsLeft = 30;
    var paused = false;

    function updateLiveText() {
      if (paused) {
        if (liveText) liveText.textContent = "Paused (hidden tab)";
      } else if (toggle && toggle.checked) {
        if (liveText) liveText.textContent = "Live (" + secondsLeft + "s)";
      } else {
        if (liveText) liveText.textContent = "Paused";
      }
    }

    function startTimer() {
      if (refreshTimer) clearInterval(refreshTimer);
      secondsLeft = 30;
      updateLiveText();
      refreshTimer = setInterval(function () {
        if (paused || !toggle || !toggle.checked) return;
        secondsLeft--;
        updateLiveText();
        if (secondsLeft <= 0) {
          secondsLeft = 30;
          // Timer ticks redraw without animation so the page never flickers.
          loadDashboard({ animate: false });
        }
      }, 1000);
    }

    document.addEventListener("visibilitychange", function () {
      paused = document.hidden;
      updateLiveText();
      if (!paused && toggle && toggle.checked) startTimer();
    });

    if (toggle) {
      toggle.addEventListener("change", function () {
        if (toggle.checked) {
          startTimer();
        } else {
          if (refreshTimer) clearInterval(refreshTimer);
          updateLiveText();
        }
      });
      startTimer();
    }

    loadDashboard({ animate: true });
    loadContext(); // consent donut + kiosk freshness (isolated failures)
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
      var query = fieldValue("searchInput");
      var emptyBox = U.el("div", { class: "empty-search-state" });
      var icon = U.el("div", { class: "empty-icon" });
      icon.innerHTML = '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="8" y1="11" x2="14" y2="11"/></svg>';
      emptyBox.appendChild(icon);
      emptyBox.appendChild(U.el("h3", { class: "empty-title" }, query ? "No citizens matching \u201C" + query + "\u201D" : "No citizens found"));
      emptyBox.appendChild(U.el("p", { class: "empty-desc" }, query ? "Check the name spelling or try searching by username." : "No registered citizens are currently available in the database."));
      if (query) {
        var clearBtn = U.el("button", { class: "btn btn-secondary", type: "button" }, "Show all citizens");
        clearBtn.addEventListener("click", function () {
          var input = document.getElementById("searchInput");
          if (input) input.value = "";
          searchCitizens();
        });
        emptyBox.appendChild(clearBtn);
      }
      results.appendChild(emptyBox);
      return;
    }
    var tableWrap = U.el("div", { class: "table-wrap" });
    var table = U.el("table");
    var thead = U.el("thead");
    var headRow = U.el("tr");
    ["Name", "Username", "Birthdate", "Kiosk visits", "Last measurement (PHT)", "Consent", "Actions"].forEach(function (label, index) {
      headRow.appendChild(
        U.el("th", index === 6 ? { style: "text-align:right;", scope: "col" } : { scope: "col" }, label)
      );
    });
    thead.appendChild(headRow);
    table.appendChild(thead);

    var tbody = U.el("tbody");
    var rowsFrag = document.createDocumentFragment();
    citizens.forEach(function (citizen) {
      var row = U.el("tr");
      if (citizen.consent) {
        row.style.background = "#fafdfb";
      }
      row.appendChild(U.el("th", { scope: "row", style: "font-weight:600; text-align:left; background:transparent;" }, citizen.full_name));
      row.appendChild(U.el("td", { class: "muted" }, citizen.username));
      row.appendChild(U.el("td", { class: "nowrap" }, citizen.birthdate || "—"));
      var visitsCell = U.el("td", { class: "nowrap" });
      var vCount = citizen.visit_count || 0;
      if (vCount > 0) {
        var vBadge = U.el(
          "span",
          { class: "badge badge-ok", style: "font-weight:700;" },
          vCount + " " + (vCount === 1 ? "visit" : "visits")
        );
        visitsCell.appendChild(vBadge);
      } else {
        visitsCell.appendChild(U.el("span", { class: "muted" }, "0 visits"));
      }
      row.appendChild(visitsCell);
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
      rowsFrag.appendChild(row);
    });
    tbody.appendChild(rowsFrag);
    table.appendChild(tbody);
    tableWrap.appendChild(table);
    results.appendChild(tableWrap);
  }

  async function searchCitizens() {
    var statusNode = document.getElementById("status");
    var query = fieldValue("searchInput");
    U.loading(statusNode, "Searching citizens…");
    var results = document.getElementById("results");
    U.clear(results);
    results.appendChild(U.tableSkeleton(["Name", "Username", "Birthdate", "Kiosk visits", "Last measurement (PHT)", "Consent", "Actions"], 3));
    try {
      var data = await API.apiFetch(
        "/api/bhw/citizens?search=" + encodeURIComponent(query)
      );
      U.clear(statusNode);
      renderCitizens(data.citizens || []);
    } catch (error) {
      U.clear(document.getElementById("results"));
      U.error(statusNode, error.message, searchCitizens);
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
    ["Time (PHT)", "Weight (kg)", "Height (cm)", "BMI", "Temp (°C)", "Pulse (bpm)", "SpO2 (%)", "Blood pressure"].forEach(function (label, index) {
      headRow.appendChild(U.el("th", index === 0 ? { scope: "col" } : { class: "num", scope: "col" }, label));
    });
    thead.appendChild(headRow);
    table.appendChild(thead);

    var tbody = U.el("tbody");
    var rowsFrag = document.createDocumentFragment();
    logs.forEach(function (log) {
      var row = U.el("tr");
      row.appendChild(U.el("th", { class: "nowrap", scope: "row", style: "font-weight:600; text-align:left; background:transparent;" }, U.fmtDT(log.timestamp)));
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
      rowsFrag.appendChild(row);
    });
    tbody.appendChild(rowsFrag);
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
          "By " + note.bhw + " · " + U.fmtDT(note.timestamp)
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
    var logsCount = data.logs ? data.logs.length : 0;
    addPair("Total kiosk visits", logsCount + (logsCount === 1 ? " visit recorded" : " visits recorded"));

    var consent = data.consent || {};
    document.getElementById("consentLine").textContent =
      "Consent granted on " + U.fmtDT(consent.timestamp) + ".";

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
      var citizenId = currentCitizenId();
      if (!citizenId) return;

      var backdrop = U.el("div", { class: "modal-backdrop" });
      var card = U.el("div", { class: "modal-card" });

      var header = U.el("div", { class: "modal-header" });
      header.appendChild(U.el("h3", null, "Refer to Rural Health Unit"));
      var closeBtn = U.el("button", { class: "btn btn-ghost", type: "button", "aria-label": "Close" }, "✕");
      header.appendChild(closeBtn);
      card.appendChild(header);

      var body = U.el("div", { class: "modal-body" });
      body.appendChild(U.el("label", { style: "display:block; font-weight:600; margin-bottom:0.35rem;" }, "Reason for referral (required)"));
      var reason = U.el("textarea", { name: "reason", required: true, style: "width:100%; min-height:90px; padding:0.55rem 0.65rem; font:inherit; font-size:0.95rem; border:1px solid #b9cdc6; border-radius:8px;" });
      body.appendChild(reason);
      var reasonErr = U.el("p", { style: "color:#a5271d; font-size:0.85rem; margin-top:0.35rem; display:none;" }, "Please enter a reason for the referral.");
      body.appendChild(reasonErr);
      card.appendChild(body);

      var footer = U.el("div", { class: "modal-footer" });
      var cancelBtn = U.el("button", { class: "btn btn-secondary", type: "button" }, "Cancel");
      var referBtnEl = U.el("button", { class: "btn btn-primary", type: "button" }, "Refer");
      footer.appendChild(cancelBtn);
      footer.appendChild(referBtnEl);
      card.appendChild(footer);

      backdrop.appendChild(card);
      document.body.appendChild(backdrop);

      var closeDialog = U.openDialog(backdrop, reason);
      closeBtn.onclick = closeDialog;
      cancelBtn.onclick = closeDialog;

      referBtnEl.onclick = async function () {
        var value = reason.value.trim();
        if (!value) {
          reasonErr.style.display = "block";
          reason.focus();
          return;
        }
        reasonErr.style.display = "none";
        closeDialog();
        setBusy(document.getElementById("referBtn"), true, "Referring…");
        try {
          await API.apiFetch(
            "/api/bhw/citizen/" + encodeURIComponent(citizenId) + "/refer",
            { method: "POST", body: { note: value } }
          );
          await loadNotes(citizenId);
          var notice = U.el("p", { class: "notice", id: "referFeedback", role: "status" },
            "Referral to the Rural Health Unit recorded.");
          var consentLine = document.getElementById("consentLine");
          if (consentLine) consentLine.after(notice);
          U.toast("Referral to RHU submitted", "success");
        } catch (error) {
          U.error(statusNode, error.message);
          U.toast(error.message, "error");
        } finally {
          setBusy(document.getElementById("referBtn"), false);
        }
      };
    });
  }

  /* ---------------- audit trail ---------------- */

  var AUDIT_ACTION_MAP = {
    view_health_data: { label: "Viewed health records", cls: "badge-ok" },
    view_notes: { label: "Viewed clinical notes", cls: "badge-admin" },
    add_note: { label: "Added clinical note", cls: "badge-ok" },
    refer_to_rhu: { label: "Referred to RHU", cls: "badge-warn" },
  };

  function renderActionBadge(action) {
    var meta = AUDIT_ACTION_MAP[action] || {
      label: (action || "—").replace(/_/g, " "),
      cls: "badge-no",
    };
    return U.el("span", { class: "badge " + meta.cls }, meta.label);
  }

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
    ["Time (PHT)", "Health worker", "Citizen accessed", "Action taken", "IP address"].forEach(function (label) {
      headRow.appendChild(U.el("th", { scope: "col" }, label));
    });
    thead.appendChild(headRow);
    table.appendChild(thead);

    var tbody = U.el("tbody");
    var rowsFrag = document.createDocumentFragment();
    rows.forEach(function (entry) {
      var row = U.el("tr");
      row.appendChild(
        U.el(
          "th",
          {
            class: "nowrap",
            scope: "row",
            style: "font-weight:600; text-align:left; background:transparent;",
          },
          U.fmtDT(entry.time)
        )
      );
      row.appendChild(U.el("td", { style: "font-weight:500;" }, entry.bhw_name));
      row.appendChild(U.el("td", { style: "font-weight:600; color:var(--green-900);" }, entry.citizen_name));
      var actionCell = U.el("td");
      actionCell.appendChild(renderActionBadge(entry.action));
      row.appendChild(actionCell);
      row.appendChild(U.el("td", { style: "color:var(--ink-soft); font-size:0.85rem;" }, entry.ip || "—"));
      rowsFrag.appendChild(row);
    });
    tbody.appendChild(rowsFrag);
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
    var citizen = fieldValue("citizenName");
    var action = fieldValue("actionType");
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    if (bhw) params.set("bhw", bhw);
    if (citizen) params.set("citizen", citizen);
    if (action) params.set("action", action);

    U.loading(statusNode, "Loading audit entries…");
    var results = document.getElementById("results");
    U.clear(results);
    results.appendChild(
      U.tableSkeleton(
        ["Time (PHT)", "Health worker", "Citizen accessed", "Action taken", "IP address"],
        4
      )
    );
    try {
      var data = await API.apiFetch("/api/bhw/audit-trail?" + params.toString());
      U.clear(statusNode);
      renderAudit(data.audit || []);
    } catch (error) {
      U.clear(document.getElementById("results"));
      U.error(statusNode, error.message, loadAudit);
    }
  }

  function initAudit() {
    if (!API.requireRole("bhw")) return;
    var form = document.getElementById("filterForm");
    bindDatePresets(form, "fromDate", "toDate", loadAudit);
    form.addEventListener("submit", function (event) {
      event.preventDefault();
      loadAudit();
    });
    document.getElementById("clearBtn").addEventListener("click", function () {
      form.reset();
      form.querySelectorAll(".date-preset-btn").forEach(function (b) { b.classList.remove("active"); });
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
    var form = document.getElementById("reportForm");
    bindDatePresets(form, "fromDate", "toDate", null);
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
      header.appendChild(closeBtn);
      card.appendChild(header);

      var body = U.el("div", {
        class: "modal-body",
        style: "padding:0; height:min(500px, 62vh); min-height:260px;",
      });
      // srcdoc + sandbox instead of document.write(): the preview renders in
      // an isolated frame (no popups/top-navigation/forms), gets a title for
      // screen readers, and a failed render can no longer fail silently.
      var iframe = U.el("iframe", {
        title: reportType.charAt(0).toUpperCase() + reportType.slice(1) + " report preview",
        sandbox: "allow-scripts allow-modals allow-same-origin",
        style: "width:100%; height:100%; border:none; background:#ffffff;",
      });
      body.appendChild(iframe);
      card.appendChild(body);

      // Dedicated node for failure notes (showNote clears its target, so it
      // must never be the iframe's container).
      var noteNode = U.el("div", { style: "padding:0 1.25rem;" });
      card.appendChild(noteNode);

      var footer = U.el("div", { class: "modal-footer" });
      var dismiss = U.el("button", { class: "btn btn-secondary", type: "button" }, "Close");
      var print = U.el("button", { class: "btn btn-primary", type: "button" }, "Print report");
      print.onclick = function () {
        try {
          if (iframe.contentWindow) {
            iframe.contentWindow.focus();
            iframe.contentWindow.print();
          }
        } catch (printError) {
          // Sandboxed frames can refuse print(); tell the user instead of
          // failing silently — the report has its own Print button.
          showNote(
            noteNode,
            "The browser blocked printing from the preview. Use the Print button inside the report.",
            true
          );
        }
      };
      footer.appendChild(dismiss);
      footer.appendChild(print);
      card.appendChild(footer);

      backdrop.appendChild(card);
      document.body.appendChild(backdrop);

      iframe.srcdoc = reportHtml;

      // Accessible dialog: Escape / backdrop click close, focus restored.
      var closeDialog = U.openDialog(backdrop, closeBtn);
      closeBtn.onclick = closeDialog;
      dismiss.onclick = closeDialog;
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
    // Administrator badge next to the signed-in name. The backend gives the
    // admin role identical permissions to a BHW, so the board is shared —
    // the badge is the only visible difference. Guarded: pages without a
    // #whoami (login) simply skip it.
    if (API.getRole() === "admin") {
      var whoami = document.getElementById("whoami");
      if (whoami && !document.querySelector(".badge-admin")) {
        whoami.insertAdjacentElement(
          "afterend",
          U.el("span", { class: "badge badge-admin" }, "Administrator")
        );
      }
    }

    var page = document.body.getAttribute("data-page");
    if (page === "bhw-login") initBhwLogin();
    else if (page === "bhw-dashboard") initDashboard();
    else if (page === "bhw-search") initSearch();
    else if (page === "bhw-citizen-view") initCitizenView();
    else if (page === "bhw-audit") initAudit();
    else if (page === "bhw-reports") initReports();
  });
})();
