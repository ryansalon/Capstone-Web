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

  function getToken() {
    return localStorage.getItem(TOKEN_KEY);
  }

  function getRole() {
    return localStorage.getItem(ROLE_KEY);
  }

  function getName() {
    return localStorage.getItem(NAME_KEY);
  }

  function saveSession(token, role, fullName) {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(ROLE_KEY, role);
    if (fullName === undefined || fullName === null) {
      localStorage.removeItem(NAME_KEY);
    } else {
      localStorage.setItem(NAME_KEY, fullName);
    }
  }

  function clearSession() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(ROLE_KEY);
    localStorage.removeItem(NAME_KEY);
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
    if (location.pathname !== target) location.replace(target);
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
      var netErr = new Error("network error - is the server running?");
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
      var netErr = new Error("network error - is the server running?");
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
          if (key === "class") node.className = attrs[key];
          else if (key === "text") node.textContent = attrs[key];
          else node.setAttribute(key, attrs[key]);
        });
      }
      if (text !== undefined && text !== null) node.textContent = String(text);
      return node;
    },

    loading: function (target, message) {
      if (!target) return;
      UI.clear(target);
      target.appendChild(
        UI.el("div", { class: "status loading", role: "status" }, message || "Loading…")
      );
    },

    error: function (target, message) {
      if (!target) return;
      UI.clear(target);
      target.appendChild(
        UI.el(
          "div",
          { class: "status error", role: "alert" },
          message || "Something went wrong."
        )
      );
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

    fmtDT: function (value) {
      if (!value) return "—";
      return String(value).replace("T", " ").slice(0, 16);
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
        container = UI.el("div", { id: "toastContainer", class: "toast-container" });
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
      setTimeout(function () {
        if (toast.parentNode) {
          toast.classList.add("toast-fadeout");
          setTimeout(function () {
            if (toast.parentNode) toast.parentNode.removeChild(toast);
          }, 300);
        }
      }, 3500);
    },
  };

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
    isStaff: isStaff,
    loginPageForRole: loginPageForRole,
    homeForRole: homeForRole,
    UI: UI,
  };

  /* Fill the header name and wire the log-out button on every page. */
  document.addEventListener("DOMContentLoaded", function () {
    var whoami = document.getElementById("whoami");
    if (whoami) {
      var name = getName();
      if (name) whoami.textContent = name;
    }
    var logoutBtn = document.getElementById("logoutBtn");
    if (logoutBtn) {
      logoutBtn.addEventListener("click", function () {
        logout();
      });
    }
  });
})();
