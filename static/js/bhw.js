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
    if (options.subtext) {
      card.appendChild(U.el("div", { class: "subtext" }, options.subtext));
    }
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
      row.appendChild(U.el("td", { class: "cell-name", style: "font-weight:600; text-align:left;" }, key));
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
            var bar = meta.data && meta.data[index];
            var xPos = bar ? bar.x : xScale.getPixelForValue(value);
            var yPos = bar ? bar.y : (yScale.getPixelForValue ? yScale.getPixelForValue(index) : 0);
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
      totalsNode.appendChild(totalCard("Measurements", totals.measurements || 0, { subtext: "Recorded in period" }));
      totalsNode.appendChild(totalCard("Active kiosk citizens", totals.active_citizens || 0, { subtext: "Individual visits" }));
      totalsNode.appendChild(totalCard("Guest measurements", totals.guest_measurements || 0, { subtext: "Anonymous check-ins" }));
      totalsNode.appendChild(
        totalCard("Alerts", alerts, {
          tone: alerts > 0 ? "alert" : null,
          subtext: alerts > 0 ? "Require clinical review" : "No active alerts",
          link: { href: "/bhw/search.html", text: "Review citizens →" },
        })
      );
      totalsNode.appendChild(totalCard("Consent grants (period)", totals.consent_grants || 0, { subtext: "New authorizations" }));

      // Registry totals are all-time and never change with the period filter,
      // so they live in their own labelled group.
      U.clear(registryNode);
      registryNode.appendChild(totalCard("Registered users", totals.users || 0, { subtext: "All-time community registry" }));

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
    var periodSelect = document.getElementById("period");
    var rememberedPeriod = U.remember("bhw_period");
    if (rememberedPeriod && periodSelect) {
      periodSelect.value = rememberedPeriod;
    }
    periodSelect.addEventListener("change", function () {
      U.remember("bhw_period", periodSelect.value);
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

    API.initRealtimeSync({
      onReading: function () {
        loadDashboard({ animate: false });
        loadContext();
      },
    });
  }

  /* ---------------- search ---------------- */

  var searchState = { allCitizens: [], filter: "all", query: "" };

  function consentBadge(granted) {
    return U.el(
      "span",
      { class: "badge " + (granted ? "badge-ok" : "badge-no") },
      granted ? "Granted" : "Not granted"
    );
  }

  function updateSearchChipCounts() {
    var all = searchState.allCitizens;
    var countAll = document.getElementById("countAll");
    var countConsented = document.getElementById("countConsented");
    var countActive = document.getElementById("countActive");
    var countNoVisit = document.getElementById("countNoVisit");

    if (countAll) countAll.textContent = all.length;
    if (countConsented) countConsented.textContent = all.filter(function (c) { return Boolean(c.consent); }).length;
    if (countActive) countActive.textContent = all.filter(function (c) { return (c.visit_count || 0) > 0; }).length;
    if (countNoVisit) countNoVisit.textContent = all.filter(function (c) { return (c.visit_count || 0) === 0; }).length;
  }

  function applySearchFilter() {
    var list = searchState.allCitizens;
    if (searchState.filter === "consented") {
      list = list.filter(function (c) { return Boolean(c.consent); });
    } else if (searchState.filter === "active") {
      list = list.filter(function (c) { return (c.visit_count || 0) > 0; });
    } else if (searchState.filter === "novisit") {
      list = list.filter(function (c) { return (c.visit_count || 0) === 0; });
    }
    renderCitizens(list, searchState.query);
  }

  function renderCitizens(citizens, query) {
    var results = document.getElementById("results");
    U.clear(results);
    if (!citizens.length) {
      var q = query || fieldValue("searchInput");
      var emptyBox = U.el("div", { class: "empty-search-state" });
      var icon = U.el("div", { class: "empty-icon" });
      icon.innerHTML = '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="8" y1="11" x2="14" y2="11"/></svg>';
      emptyBox.appendChild(icon);

      var isFilterActive = searchState.filter !== "all";
      var titleText = isFilterActive
        ? "No citizens match the active filter"
        : (q ? "No citizens matching \u201C" + q + "\u201D" : "No citizens found");
      var descText = isFilterActive
        ? "Try choosing another status chip or show all citizens."
        : (q ? "Check the name spelling or try searching by username." : "No registered citizens are currently available in the database.");

      emptyBox.appendChild(U.el("h3", { class: "empty-title" }, titleText));
      emptyBox.appendChild(U.el("p", { class: "empty-desc" }, descText));

      var btnRow = U.el("div", { style: "display:flex; gap:0.5rem; justify-content:center; flex-wrap:wrap; margin-top:0.6rem;" });
      if (isFilterActive) {
        var clearFilterBtn = U.el("button", { class: "btn btn-secondary", type: "button" }, "Show all citizens");
        clearFilterBtn.addEventListener("click", function () {
          searchState.filter = "all";
          var chips = document.querySelectorAll("#searchTriageChips button.chip");
          chips.forEach(function (c) {
            c.classList.toggle("is-active", (c.getAttribute("data-filter") || "all") === "all");
          });
          applySearchFilter();
        });
        btnRow.appendChild(clearFilterBtn);
      }
      if (q) {
        var clearSearchBtn = U.el("button", { class: "btn btn-secondary", type: "button" }, "Clear search term");
        clearSearchBtn.addEventListener("click", function () {
          var input = document.getElementById("searchInput");
          if (input) input.value = "";
          searchCitizens();
        });
        btnRow.appendChild(clearSearchBtn);
      }
      if (btnRow.children.length > 0) {
        emptyBox.appendChild(btnRow);
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
      var tdName = U.el("td", { class: "cell-name", style: "font-weight:600; text-align:left;" });
      U.highlight(tdName, citizen.full_name, query);
      row.appendChild(tdName);

      var tdUser = U.el("td", { class: "muted" });
      U.highlight(tdUser, citizen.username, query);
      row.appendChild(tdUser);

      var tdBirth = U.el("td", { class: "nowrap" }, citizen.birthdate || "—");
      tdBirth.setAttribute("data-sort", citizen.birthdate || "");
      row.appendChild(tdBirth);

      var visitsCell = U.el("td", { class: "nowrap" });
      var vCount = citizen.visit_count || 0;
      visitsCell.setAttribute("data-sort", String(vCount));
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

      var measCell = U.el("td", { class: "nowrap" }, citizen.last_measurement ? U.fmtDT(citizen.last_measurement) : "No readings");
      measCell.setAttribute("data-sort", citizen.last_measurement || "");
      row.appendChild(measCell);

      var consentCell = U.el("td");
      consentCell.setAttribute("data-sort", citizen.consent ? "1" : "0");
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
    U.makeSortable(table, { skip: [6] });
    tableWrap.appendChild(table);
    results.appendChild(tableWrap);
  }

  async function searchCitizens() {
    var statusNode = document.getElementById("status");
    var query = fieldValue("searchInput");
    U.remember("bhw_search", query);
    U.loading(statusNode, "Searching citizens…");
    var results = document.getElementById("results");
    U.clear(results);
    results.appendChild(U.tableSkeleton(["Name", "Username", "Birthdate", "Kiosk visits", "Last measurement (PHT)", "Consent", "Actions"], 3));
    try {
      var data = await API.apiFetch(
        "/api/bhw/citizens?search=" + encodeURIComponent(query)
      );
      U.clear(statusNode);
      searchState.allCitizens = data.citizens || [];
      searchState.query = query;
      updateSearchChipCounts();
      applySearchFilter();
    } catch (error) {
      U.clear(document.getElementById("results"));
      U.error(statusNode, error.message, searchCitizens);
    }
  }

  function initSearch() {
    if (!API.requireRole("bhw")) return;
    var input = document.getElementById("searchInput");
    var remembered = U.remember("bhw_search");
    if (remembered && input) {
      input.value = remembered;
    }
    document.getElementById("searchForm").addEventListener("submit", function (event) {
      event.preventDefault();
      searchCitizens();
    });

    var chips = document.querySelectorAll("#searchTriageChips button.chip");
    chips.forEach(function (btn) {
      btn.addEventListener("click", function () {
        chips.forEach(function (c) { c.classList.remove("is-active"); });
        btn.classList.add("is-active");
        searchState.filter = btn.getAttribute("data-filter") || "all";
        applySearchFilter();
      });
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
      var tdTime = U.el("td", { class: "cell-time nowrap", style: "font-weight:600; text-align:left;" }, U.fmtDT(log.timestamp));
      tdTime.setAttribute("data-sort", log.timestamp || "");
      row.appendChild(tdTime);
      [
        [U.fmtNum(log.weight, 1), log.weight],
        [U.fmtNum(log.height, 1), log.height],
        [U.fmtNum(log.bmi, 1), log.bmi],
        [U.fmtNum(log.temperature, 1), log.temperature],
        [U.fmtNum(log.pulse_rate, 0), log.pulse_rate],
        [U.fmtNum(log.spo2, 0), log.spo2],
        [
          log.systolic_bp === null || log.systolic_bp === undefined ||
          log.diastolic_bp === null || log.diastolic_bp === undefined
            ? "—"
            : log.systolic_bp + "/" + log.diastolic_bp,
          log.systolic_bp || ""
        ],
      ].forEach(function (pair) {
        var td = U.el("td", { class: "num" }, pair[0]);
        if (pair[1] !== null && pair[1] !== undefined) td.setAttribute("data-sort", String(pair[1]));
        row.appendChild(td);
      });
      rowsFrag.appendChild(row);
    });
    tbody.appendChild(rowsFrag);
    table.appendChild(tbody);
    U.makeSortable(table);
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

  function showReferralSlipModal(citizen, log, reason) {
    document.body.classList.add("printing-referral");
    var backdrop = U.el("div", { class: "modal-backdrop" });
    var card = U.el("div", { class: "modal-card", style: "max-width: 680px;" });

    var header = U.el("div", { class: "modal-header" });
    header.appendChild(U.el("h3", null, "Official Clinical Referral Slip"));
    var closeBtn = U.el("button", { class: "btn btn-ghost", type: "button", "aria-label": "Close" }, "✕");
    header.appendChild(closeBtn);
    card.appendChild(header);

    var body = U.el("div", { class: "modal-body" });
    var slip = U.el("div", { class: "referral-slip-card" });

    var pHead = U.el("div", { class: "referral-header" });
    var pLogos = U.el("div", { class: "referral-logos", style: "display:flex; align-items:center; justify-content:center; gap:1.25rem; margin-bottom:0.6rem;" });
    pLogos.appendChild(U.el("img", { src: "/img/cpsc-logo.png", alt: "CPSC", width: "48", height: "48", style: "object-fit:contain;" }));
    pLogos.appendChild(U.el("img", { src: "/img/rhu-logo.png", alt: "RHU Mahinog", width: "48", height: "48", style: "object-fit:contain;" }));
    pHead.appendChild(pLogos);
    pHead.appendChild(U.el("div", { style: "font-size:0.75rem; font-weight:700; text-transform:uppercase; letter-spacing:0.06em; color:#0b3d30;" }, "Republic of the Philippines · Province of Camiguin"));
    pHead.appendChild(U.el("h2", { style: "margin:0.25rem 0; font-size:1.3rem; color:#0b3d30;" }, "Clinical Referral Slip (RHU Mahinog)"));
    pHead.appendChild(U.el("p", { style: "margin:0; font-size:0.82rem; color:#4a655a;" }, "Municipality of Mahinog · Barangay Health Station & Rural Health Unit"));
    slip.appendChild(pHead);

    var infoDl = U.el("dl", { class: "kv", style: "margin-bottom:0.85rem;" });
    function addInfo(lbl, val) {
      infoDl.appendChild(U.el("dt", null, lbl));
      infoDl.appendChild(U.el("dd", null, val || "—"));
    }
    addInfo("Patient Name", citizen.full_name || "—");
    addInfo("Username / ID", citizen.username || "—");
    addInfo("Birthdate", citizen.birthdate || "—");
    addInfo("Gender", citizen.gender ? citizen.gender.toUpperCase() : "—");
    slip.appendChild(infoDl);

    var reasonBox = U.el("div", { class: "referral-reason-box" });
    reasonBox.appendChild(U.el("div", { style: "font-weight:700; font-size:0.8rem; text-transform:uppercase; letter-spacing:0.04em; color:var(--green-900); margin-bottom:0.25rem;" }, "Reason for Referral & Clinical Findings:"));
    reasonBox.appendChild(U.el("div", { style: "line-height:1.45; white-space:pre-wrap;" }, reason || "Patient referred for medical evaluation, diagnosis, and prescription management at the Rural Health Unit."));
    slip.appendChild(reasonBox);

    var vitalsTitle = U.el("h4", { style: "margin:0.75rem 0 0.35rem 0; font-size:0.85rem; font-weight:700; text-transform:uppercase; letter-spacing:0.04em; color:#0b3d30;" }, "Latest Vital Signs (Barangay Health Kiosk)");
    slip.appendChild(vitalsTitle);

    var grid = U.el("div", { class: "passport-grid" });
    function addStat(lbl, val, sub) {
      var box = U.el("div", { class: "passport-stat" });
      box.appendChild(U.el("div", { class: "lbl" }, lbl));
      box.appendChild(U.el("div", { class: "val" }, val));
      if (sub) box.appendChild(U.el("div", { class: "sub", style: "font-size:0.75rem; color:#4b6b62;" }, sub));
      grid.appendChild(box);
    }

    if (log) {
      var hasBp = (log.systolic_bp !== null && log.systolic_bp !== undefined && log.diastolic_bp !== null && log.diastolic_bp !== undefined);
      var bpVal = hasBp ? (log.systolic_bp + "/" + log.diastolic_bp + " mmHg") : "—";
      var bpSub = (log.systolic_bp >= 140 || log.diastolic_bp >= 90) ? "Stage 2 HTN Alert" : (log.systolic_bp >= 130 || log.diastolic_bp >= 80 ? "Stage 1 HTN" : "Normal BP");
      addStat("Blood Pressure", bpVal, bpSub);
      addStat("Body Mass Index", U.fmtNum(log.bmi, 1), log.weight ? (U.fmtNum(log.weight, 1, "kg") + " / " + U.fmtNum(log.height, 1, "cm")) : "");
      addStat("Blood Oxygen (SpO2)", U.fmtNum(log.spo2, 0, "%"), (log.spo2 && log.spo2 < 95) ? "Attention required" : "Normal");
      addStat("Body Temperature", U.fmtNum(log.temperature, 1, "°C"), (log.temperature >= 37.9) ? "Fever alert" : "Normothermic");
      addStat("Pulse / Heart Rate", U.fmtNum(log.pulse_rate, 0, "bpm"), "Resting pulse");
      addStat("Measurement Time", U.fmtDT(log.timestamp), "Kiosk Station");
    } else {
      grid.appendChild(U.el("p", { class: "muted" }, "No vital readings recorded yet."));
    }
    slip.appendChild(grid);

    var sigBlock = U.el("div", { class: "official-signature-block", style: "margin-top:1.5rem;" });
    var sigFlex = U.el("div", { style: "display:flex; justify-content:space-between; gap:1rem;" });
    
    var sig1 = U.el("div");
    sig1.appendChild(U.el("div", { style: "border-bottom:1.5px solid #000; width:220px; height:1.4rem;" }));
    sig1.appendChild(U.el("div", { style: "font-size:0.75rem; margin-top:0.3rem; font-weight:600;" }, "Referring BHW / Health Worker"));
    sig1.appendChild(U.el("div", { style: "font-size:0.72rem; color:#4a655a;" }, API.getName() || "Barangay Health Worker"));
    sigFlex.appendChild(sig1);

    var sig2 = U.el("div");
    sig2.appendChild(U.el("div", { style: "border-bottom:1.5px solid #000; width:220px; height:1.4rem;" }));
    sig2.appendChild(U.el("div", { style: "font-size:0.75rem; margin-top:0.3rem; font-weight:600;" }, "Receiving RHU Doctor / Nurse"));
    sig2.appendChild(U.el("div", { style: "font-size:0.72rem; color:#4a655a;" }, "Rural Health Unit Mahinog"));
    sigFlex.appendChild(sig2);

    sigBlock.appendChild(sigFlex);
    slip.appendChild(sigBlock);

    var foot = U.el("div", { class: "referral-footer", style: "margin-top:1.1rem; border-top:1px dashed var(--line-strong); padding-top:0.45rem; display:flex; justify-content:space-between; font-size:0.72rem; color:#4a655a;" });
    foot.appendChild(U.el("span", null, "Generated: " + nowPht()));
    foot.appendChild(U.el("span", { style: "font-weight:700; color:#0b3d30;" }, "OFFICIAL RHU REFERRAL · RA 10173 AUDITED"));
    slip.appendChild(foot);

    body.appendChild(slip);
    card.appendChild(body);

    var mFoot = U.el("div", { class: "modal-footer" });
    var dismissBtn = U.el("button", { class: "btn btn-secondary", type: "button" }, "Close");
    var printBtn = U.el("button", { class: "btn btn-primary", type: "button" }, "Print / Save PDF");
    printBtn.onclick = function () {
      document.body.classList.add("printing-referral");
      var clearPrint = function () {
        document.body.classList.remove("printing-referral");
        window.removeEventListener("afterprint", clearPrint);
      };
      window.addEventListener("afterprint", clearPrint);
      window.print();
      setTimeout(clearPrint, 30000);
    };

    mFoot.appendChild(dismissBtn);
    mFoot.appendChild(printBtn);
    card.appendChild(mFoot);

    backdrop.appendChild(card);
    document.body.appendChild(backdrop);

    var closeDialog = U.openDialog(backdrop, closeBtn);
    var handleClose = function () {
      document.body.classList.remove("printing-referral");
      closeDialog();
    };
    closeBtn.onclick = handleClose;
    dismissBtn.onclick = handleClose;
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
          var logs = data.logs || [];
          var latest = logs.length ? logs[0] : null;
          showReferralSlipModal(citizen, latest, value);
        } catch (error) {
          U.error(statusNode, error.message);
          U.toast(error.message, "error");
        } finally {
          setBusy(document.getElementById("referBtn"), false);
        }
      };
    });

    var printReferralBtn = document.getElementById("printReferralBtn");
    if (printReferralBtn) {
      printReferralBtn.addEventListener("click", function () {
        var logs = data.logs || [];
        var latest = logs.length ? logs[0] : null;
        showReferralSlipModal(citizen, latest, "");
      });
    }
  }

  /* ---------------- audit trail ---------------- */

  var AUDIT_ACTION_MAP = {
    view_health_data: { label: "Viewed health records", cls: "badge-ok" },
    view_notes: { label: "Viewed clinical notes", cls: "badge-admin" },
    add_note: { label: "Added clinical note", cls: "badge-ok" },
    refer_to_rhu: { label: "Referred to RHU", cls: "badge-warn" },
    unauthorized_access: { label: "Blocked: No Consent", cls: "badge-danger" },
    export_report: { label: "Exported Report", cls: "badge-info" },
    staff_login: { label: "Staff Login", cls: "badge-admin" },
  };

  var currentAuditRows = [];

  function renderActionBadge(action, status) {
    if (status === "blocked" || action === "unauthorized_access") {
      return U.el("span", { class: "badge badge-danger" }, "Blocked: No Consent");
    }
    var meta = AUDIT_ACTION_MAP[action] || {
      label: (action || "—").replace(/_/g, " "),
      cls: "badge-no",
    };
    return U.el("span", { class: "badge " + meta.cls }, meta.label);
  }

  function renderStatusBadge(status) {
    if (status === "blocked") {
      return U.el("span", { class: "badge badge-danger" }, "Blocked 🚫");
    }
    return U.el("span", { class: "badge badge-ok" }, "Authorized ✓");
  }

  function renderAuditMetrics(metrics) {
    if (!metrics) return;
    var elTotal = document.getElementById("kpiTotal");
    var elViews = document.getElementById("kpiViews");
    var elInterventions = document.getElementById("kpiInterventions");
    var elBlocked = document.getElementById("kpiBlocked");
    var cardBlocked = document.getElementById("kpiBlockedCard");

    if (elTotal) elTotal.textContent = metrics.total !== undefined ? metrics.total : "—";
    if (elViews) elViews.textContent = metrics.views !== undefined ? metrics.views : "—";
    if (elInterventions) elInterventions.textContent = metrics.interventions !== undefined ? metrics.interventions : "—";
    if (elBlocked) {
      elBlocked.textContent = metrics.blocked !== undefined ? metrics.blocked : "0";
      if (cardBlocked) {
        cardBlocked.classList.toggle("has-alerts", (metrics.blocked || 0) > 0);
      }
    }
  }

  function showAuditDetailsModal(entry) {
    var backdrop = U.el("div", { class: "modal-backdrop" });
    var card = U.el("div", {
      class: "modal-card",
      style: "max-width: 600px; width: 100%; box-shadow: 0 20px 60px rgba(0,0,0,0.3);",
    });

    var isBlocked = entry.status === "blocked" || entry.action === "unauthorized_access";

    var header = U.el("div", {
      class: "modal-header",
      style: isBlocked ? "background: #7f1d1d;" : "",
    });
    var headerTitle = U.el("div");
    headerTitle.innerHTML =
      '<h3 style="margin:0; font-size:1.15rem; color:#fff;">Audit Log Inspector #' +
      (entry.id || "—") +
      "</h3>" +
      '<small style="color: rgba(255,255,255,0.85); font-weight: 500;">RA 10173 Compliance Verification</small>';
    header.appendChild(headerTitle);

    var closeBtn = U.el(
      "button",
      { class: "btn btn-ghost", type: "button", "aria-label": "Close" },
      "✕"
    );
    header.appendChild(closeBtn);
    card.appendChild(header);

    var body = U.el("div", {
      class: "modal-body",
      style: "padding: 1.25rem; font-size: 0.92rem; max-height: 70vh; overflow-y: auto;",
    });

    var statusBadge = isBlocked
      ? '<span class="badge badge-danger">Blocked / Security Flag</span>'
      : '<span class="badge badge-ok">Authorized / Verified</span>';

    var dl = U.el("dl", { class: "audit-detail-list" });
    dl.innerHTML =
      '<div class="audit-detail-item"><dt>Event Status</dt><dd>' +
      statusBadge +
      "</dd></div>" +
      '<div class="audit-detail-item"><dt>Action Performed</dt><dd><strong>' +
      (entry.action || "—").replace(/_/g, " ") +
      "</strong></dd></div>" +
      '<div class="audit-detail-item"><dt>Health Worker / Actor</dt><dd>' +
      (entry.bhw_name || "—") +
      ' <span style="color:var(--ink-soft); font-size:0.8rem;">(ID: ' +
      (entry.bhw || "—") +
      ")</span></dd></div>" +
      '<div class="audit-detail-item"><dt>Citizen Subject</dt><dd>' +
      (entry.citizen_name || "All Citizens / System") +
      (entry.citizen
        ? ' <span style="color:var(--ink-soft); font-size:0.8rem;">(ID: ' +
          entry.citizen +
          ")</span>"
        : "") +
      "</dd></div>" +
      '<div class="audit-detail-item"><dt>Timestamp (PHT)</dt><dd>' +
      U.fmtDT(entry.time) +
      ' <span style="color:var(--ink-soft); font-size:0.8rem;">(' +
      U.fmtAge(entry.time) +
      ")</span></dd></div>" +
      '<div class="audit-detail-item"><dt>Timestamp (UTC)</dt><dd><code>' +
      (entry.time || "—") +
      "Z</code></dd></div>" +
      '<div class="audit-detail-item"><dt>Event Details</dt><dd>' +
      (entry.details || "Standard operational record access") +
      "</dd></div>" +
      '<div class="audit-detail-item"><dt>Origin IP Address</dt><dd><code>' +
      (entry.ip || "—") +
      "</code></dd></div>" +
      '<div class="audit-detail-item"><dt>Client User Agent</dt><dd><span style="font-size:0.82rem; word-break:break-all; color:var(--ink-soft); font-family:monospace;">' +
      (entry.user_agent || "Standard Browser Client") +
      "</span></dd></div>";

    body.appendChild(dl);

    var legalBox = U.el("div", {
      style:
        "margin-top:1rem; padding:0.75rem 1rem; border-radius:8px; background:var(--green-50, #f0fdf4); border:1px solid #bbf7d0; font-size:0.82rem; color:#14532d; display:flex; align-items:center; gap:0.5rem;",
    });
    legalBox.innerHTML =
      '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="flex-shrink:0;"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>' +
      "<span>Logged in accordance with the <strong>Republic Act No. 10173 (Data Privacy Act of 2012)</strong>. Record is immutable and append-only.</span>";
    body.appendChild(legalBox);
    card.appendChild(body);

    var footer = U.el("div", {
      class: "modal-footer",
      style: "display:flex; justify-content:space-between; align-items:center;",
    });
    if (entry.citizen) {
      var viewCitizenLink = U.el(
        "a",
        {
          href: "/bhw/citizen-view.html?id=" + entry.citizen,
          class: "btn btn-secondary",
          style: "font-size:0.88rem;",
        },
        "Open Citizen Record →"
      );
      footer.appendChild(viewCitizenLink);
    } else {
      footer.appendChild(U.el("span"));
    }

    var dismissBtn = U.el("button", { class: "btn btn-primary", type: "button" }, "Done");
    footer.appendChild(dismissBtn);
    card.appendChild(footer);

    backdrop.appendChild(card);
    document.body.appendChild(backdrop);

    function close() {
      if (backdrop.parentNode) backdrop.parentNode.removeChild(backdrop);
      document.removeEventListener("keydown", onKey);
    }
    function onKey(e) {
      if (e.key === "Escape" || e.key === "Esc") close();
    }

    closeBtn.onclick = close;
    dismissBtn.onclick = close;
    backdrop.onclick = function (e) {
      if (e.target === backdrop) close();
    };
    document.addEventListener("keydown", onKey);
    dismissBtn.focus();
  }

  function exportAuditToCsv(rows) {
    if (!rows || !rows.length) {
      U.toast("No audit records to export", "info");
      return;
    }
    var headers = [
      "Log ID",
      "Timestamp (UTC)",
      "Timestamp (PHT)",
      "Health Worker",
      "Citizen",
      "Action",
      "Status",
      "Details",
      "IP Address",
    ];
    function sanitizeCell(val) {
      var str = String(val == null ? "" : val);
      if (/^[=+\-@\t\r]/.test(str)) str = "'" + str;
      return '"' + str.replace(/"/g, '""') + '"';
    }
    var csvLines = [headers.join(",")];
    rows.forEach(function (r) {
      var line = [
        r.id || "",
        r.time || "",
        sanitizeCell(U.fmtDT(r.time)),
        sanitizeCell(r.bhw_name),
        sanitizeCell(r.citizen_name),
        sanitizeCell(r.action),
        sanitizeCell(r.status || "success"),
        sanitizeCell(r.details),
        sanitizeCell(r.ip),
      ];
      csvLines.push(line.join(","));
    });
    var blob = new Blob(["\uFEFF" + csvLines.join("\r\n")], { type: "text/csv;charset=utf-8;" });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url;
    a.download = "audit-trail-" + new Date().toISOString().slice(0, 10) + ".csv";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    U.toast("Audit trail exported as CSV", "success");
  }

  function renderAudit(rows) {
    currentAuditRows = rows || [];
    var results = document.getElementById("results");
    U.clear(results);
    if (!rows.length) {
      setEmptyRow(results, "No audit entries match these filters.");
      return;
    }
    var tableWrap = U.el("div", { class: "table-wrap" });
    var table = U.el("table", { class: "table-clickable audit-table" });
    var thead = U.el("thead");
    var headRow = U.el("tr");
    [
      "Time (PHT)",
      "Health worker",
      "Citizen accessed",
      "Action taken",
      "Status",
      "Details",
      "IP address",
    ].forEach(function (label) {
      headRow.appendChild(U.el("th", { scope: "col" }, label));
    });
    thead.appendChild(headRow);
    table.appendChild(thead);

    var tbody = U.el("tbody");
    var rowsFrag = document.createDocumentFragment();
    rows.forEach(function (entry) {
      var isBlocked = entry.status === "blocked" || entry.action === "unauthorized_access";
      var row = U.el("tr", {
        class: "audit-row" + (isBlocked ? " audit-row-blocked" : ""),
        tabindex: "0",
        role: "button",
        "aria-label": "Inspect audit record #" + entry.id,
      });
      row.title = "Click to inspect complete audit details & compliance trace";

      var tdTime = U.el(
        "td",
        {
          class: "cell-time nowrap",
          style: "font-weight:600; text-align:left;",
        },
        U.fmtDT(entry.time)
      );
      tdTime.setAttribute("data-sort", entry.time || "");
      row.appendChild(tdTime);

      row.appendChild(U.el("td", { style: "font-weight:500;" }, entry.bhw_name));

      var citizenColor = entry.citizen ? "var(--green-900)" : "var(--ink-soft)";
      row.appendChild(
        U.el("td", { style: "font-weight:600; color:" + citizenColor + ";" }, entry.citizen_name)
      );

      var actionCell = U.el("td");
      actionCell.appendChild(renderActionBadge(entry.action, entry.status));
      row.appendChild(actionCell);

      var statusCell = U.el("td");
      statusCell.appendChild(renderStatusBadge(entry.status));
      row.appendChild(statusCell);

      var detailsText = entry.details || "—";
      var tdDetails = U.el(
        "td",
        {
          style:
            "max-width:220px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; font-size:0.86rem; color:var(--ink-soft);",
          title: detailsText,
        },
        detailsText
      );
      row.appendChild(tdDetails);

      row.appendChild(
        U.el(
          "td",
          { style: "color:var(--ink-soft); font-size:0.85rem; font-family:monospace;" },
          entry.ip || "—"
        )
      );

      row.addEventListener("click", function () {
        showAuditDetailsModal(entry);
      });
      row.addEventListener("keydown", function (e) {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          showAuditDetailsModal(entry);
        }
      });

      rowsFrag.appendChild(row);
    });
    tbody.appendChild(rowsFrag);
    table.appendChild(tbody);
    U.makeSortable(table);
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
    var status = fieldValue("statusFilter");
    U.remember("bhw_audit_filters", {
      from: from,
      to: to,
      bhw: bhw,
      citizen: citizen,
      action: action,
      status: status,
    });
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    if (bhw) params.set("bhw", bhw);
    if (citizen) params.set("citizen", citizen);
    if (action) params.set("action", action);
    if (status) params.set("status", status);

    U.loading(statusNode, "Loading audit entries…");
    var results = document.getElementById("results");
    U.clear(results);
    results.appendChild(
      U.tableSkeleton(
        [
          "Time (PHT)",
          "Health worker",
          "Citizen accessed",
          "Action taken",
          "Status",
          "Details",
          "IP address",
        ],
        4
      )
    );
    try {
      var data = await API.apiFetch("/api/bhw/audit-trail?" + params.toString());
      U.clear(statusNode);
      renderAudit(data.audit || []);
      renderAuditMetrics(data.metrics);
    } catch (error) {
      U.clear(document.getElementById("results"));
      U.error(statusNode, error.message, loadAudit);
    }
  }

  function initAudit() {
    if (!API.requireRole("bhw")) return;
    var form = document.getElementById("filterForm");
    var remembered = U.remember("bhw_audit_filters");
    if (remembered) {
      if (remembered.from) document.getElementById("fromDate").value = remembered.from;
      if (remembered.to) document.getElementById("toDate").value = remembered.to;
      if (remembered.bhw) document.getElementById("bhwName").value = remembered.bhw;
      if (remembered.citizen) document.getElementById("citizenName").value = remembered.citizen;
      if (remembered.action) document.getElementById("actionType").value = remembered.action;
      if (remembered.status && document.getElementById("statusFilter")) {
        document.getElementById("statusFilter").value = remembered.status;
      }
    }
    bindDatePresets(form, "fromDate", "toDate", loadAudit);
    form.addEventListener("submit", function (event) {
      event.preventDefault();
      loadAudit();
    });
    document.getElementById("clearBtn").addEventListener("click", function () {
      form.reset();
      U.remember("bhw_audit_filters", null);
      form.querySelectorAll(".date-preset-btn").forEach(function (b) {
        b.classList.remove("active");
      });
      loadAudit();
    });

    var exportCsvBtn = document.getElementById("exportAuditCsvBtn");
    if (exportCsvBtn) {
      exportCsvBtn.addEventListener("click", function () {
        exportAuditToCsv(currentAuditRows);
      });
    }

    var printBtn = document.getElementById("printAuditBtn");
    if (printBtn) {
      printBtn.addEventListener("click", function () {
        window.print();
      });
    }

    loadAudit();

    // Live sync for audit trail
    API.initRealtimeSync({
      onReading: function () {
        loadAudit();
      },
    });
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
