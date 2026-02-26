import { useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import "./App.css";
import InAppDashboard from "./InAppDashboard";
import AdminAccessDashboard from "./AdminAccessDashboard";
import GameplayDashboard from "./GameplayDashboard";
import ResourcesDashboard from "./ResourcesDashboard";
import RewardedAdsDashboard from "./RewardedAdsDashboard";

const AUTH_STORAGE_KEY = "elastic_client_logged_in";
const GAME_STORAGE_KEY = "elastic_client_selected_game";
const USER_STORAGE_KEY = "elastic_client_username";
const ADMIN_STORAGE_KEY = "elastic_client_is_admin";
const toBase64 = (value) => window.btoa(unescape(encodeURIComponent(value)));
const normalizeGames = (payload) => {
  if (Array.isArray(payload)) {
    return payload
      .map((item) => {
        if (typeof item === "string" || typeof item === "number") {
          const value = String(item);
          return { value, label: value };
        }
        if (item && typeof item === "object") {
          const rawValue = item.id ?? item.gameId ?? item.code ?? item.key ?? item.value ?? item.name;
          const rawLabel = item.name ?? item.gameName ?? item.title ?? item.displayName ?? rawValue;
          if (rawValue === undefined || rawValue === null) return null;
          return { value: String(rawValue), label: String(rawLabel ?? rawValue) };
        }
        return null;
      })
      .filter(Boolean);
  }

  if (payload && typeof payload === "object") {
    return Object.entries(payload).map(([key, value]) => ({
      value: String(key),
      label: String(value ?? key)
    }));
  }

  return [];
};

const inferIsAdmin = (authPayload, fallbackUsername) => {
  if (!authPayload || typeof authPayload !== "object") {
    return String(fallbackUsername || "").toLowerCase() === "admin";
  }
  if (authPayload.isAdmin === true || authPayload.admin === true) return true;

  const roleSources = [
    authPayload.roles,
    authPayload.authorities,
    authPayload.role,
    authPayload.user?.roles,
    authPayload.user?.authorities,
    authPayload.user?.role
  ];

  const roles = roleSources
    .flatMap((source) => (Array.isArray(source) ? source : source ? [source] : []))
    .map((role) => {
      if (typeof role === "string") return role;
      if (role && typeof role === "object") return role.name ?? role.role ?? role.authority ?? "";
      return "";
    })
    .map((role) => String(role).toUpperCase());

  if (roles.some((role) => role.includes("ADMIN"))) return true;
  return String(fallbackUsername || "").toLowerCase() === "admin";
};

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    return window.localStorage.getItem(AUTH_STORAGE_KEY) === "1";
  });
  const [isAdmin, setIsAdmin] = useState(() => window.localStorage.getItem(ADMIN_STORAGE_KEY) === "1");
  const [username, setUsername] = useState(() => window.localStorage.getItem(USER_STORAGE_KEY) || "");
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [games, setGames] = useState([]);
  const [selectedGame, setSelectedGame] = useState(() => window.localStorage.getItem(GAME_STORAGE_KEY) || "");
  const [page, setPage] = useState("iap");
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [passwordSuccess, setPasswordSuccess] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);
  const accountMenuRef = useRef(null);
  const selectedGameIds = useMemo(() => (selectedGame ? [selectedGame] : []), [selectedGame]);

  useEffect(() => {
    if (!isAuthenticated) return;

    const loadGames = async () => {
      try {
        const apiBase = process.env.REACT_APP_API_BASE_URL || "";
        const response = await axios.get(`${apiBase}/api/games`);
        const options = normalizeGames(response.data);
        setGames(options);
        if (!options.length) return;

        const current = window.localStorage.getItem(GAME_STORAGE_KEY) || "";
        const exists = options.some((g) => g.value === current);
        if (exists) {
          setSelectedGame(current);
          return;
        }
        setSelectedGame(options[0].value);
        window.localStorage.setItem(GAME_STORAGE_KEY, options[0].value);
      } catch (err) {
        setGames([]);
      }
    };

    loadGames();
  }, [isAuthenticated]);

  useEffect(() => {
    const handleDocumentClick = (event) => {
      if (!accountMenuRef.current) return;
      if (accountMenuRef.current.contains(event.target)) return;
      setAccountMenuOpen(false);
    };
    document.addEventListener("mousedown", handleDocumentClick);
    return () => document.removeEventListener("mousedown", handleDocumentClick);
  }, []);

  const handleLogin = async (e) => {
    e.preventDefault();
    const user = username.trim();
    const pass = password.trim();
    if (!user || !pass) {
      setLoginError("Username and password are required.");
      return;
    }

    try {
      setLoginError("");
      const apiBase = process.env.REACT_APP_API_BASE_URL || "";
      const response = await axios.post(`${apiBase}/api/auth/login`, {
        username: user,
        password: toBase64(pass),
        passwordEncoded: true
      });
      const admin = inferIsAdmin(response.data, user);

      window.localStorage.setItem(AUTH_STORAGE_KEY, "1");
      window.localStorage.setItem(USER_STORAGE_KEY, user);
      window.localStorage.setItem(ADMIN_STORAGE_KEY, admin ? "1" : "0");
      setIsAuthenticated(true);
      setIsAdmin(admin);
      setUsername(user);
      setPassword("");
    } catch (err) {
      if (axios.isAxiosError(err) && !err.response) {
        setLoginError("Cannot reach auth API. Make sure backend is running.");
        return;
      }
      if (axios.isAxiosError(err) && err.response) {
        const payload = err.response.data;
        const serverMessage = typeof payload === "string"
          ? payload
          : payload?.message || payload?.error || "Invalid username or password.";
        setLoginError(`Login failed: ${serverMessage}`);
        return;
      }
      setLoginError("Login failed. Please try again.");
      return;
    }
  };

  const handleLogout = () => {
    window.localStorage.removeItem(AUTH_STORAGE_KEY);
    window.localStorage.removeItem(USER_STORAGE_KEY);
    window.localStorage.removeItem(ADMIN_STORAGE_KEY);
    setIsAuthenticated(false);
    setIsAdmin(false);
    setUsername("");
    setPassword("");
    setAccountMenuOpen(false);
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setPasswordError("");
    setPasswordSuccess("");
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    const current = currentPassword.trim();
    const next = newPassword.trim();
    const confirm = confirmPassword.trim();
    if (!current || !next || !confirm) {
      setPasswordError("All password fields are required.");
      return;
    }
    if (next !== confirm) {
      setPasswordError("New password and confirmation do not match.");
      return;
    }

    try {
      setSavingPassword(true);
      setPasswordError("");
      setPasswordSuccess("");
      const apiBase = process.env.REACT_APP_API_BASE_URL || "";
      const payload = {
        oldPassword: toBase64(current),
        newPassword: toBase64(next)
      };

      const attempts = [
        () => axios.post(`${apiBase}/api/auth/change-password`, payload)
      ];

      let changed = false;
      let lastError = null;
      for (const call of attempts) {
        try {
          await call();
          changed = true;
          break;
        } catch (err) {
          lastError = err;
          if (!(axios.isAxiosError(err) && err.response && [404, 405].includes(err.response.status))) {
            throw err;
          }
        }
      }
      if (!changed && lastError) throw lastError;

      setPasswordSuccess("Password updated successfully.");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      if (axios.isAxiosError(err) && err.response) {
        const payload = err.response.data;
        const serverMessage = typeof payload === "string"
          ? payload
          : payload?.message || payload?.error || JSON.stringify(payload);
        setPasswordError(`Change password failed: ${serverMessage}`);
      } else {
        setPasswordError("Change password failed.");
      }
    } finally {
      setSavingPassword(false);
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="login-page">
        <div className="login-topbar" />
        <div className="login-card-wrap">
          <div className="login-banner">Login to your account</div>
          <form className="login-card" onSubmit={handleLogin}>
            <h2 className="login-title">Sign in</h2>
            <div className="login-field">
              <label className="login-label" htmlFor="username">Username</label>
              <input
                id="username"
                className="login-input"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="username"
              />
            </div>
            <div className="login-field">
              <label className="login-label" htmlFor="password">Password</label>
              <input
                id="password"
                className="login-input"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
              />
            </div>
            {loginError && <div className="login-error">{loginError}</div>}
            <button className="login-button" type="submit">Sign in</button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: "flex", gap: 8, padding: 12, background: "#e5e7eb", borderBottom: "1px solid #d1d5db", alignItems: "center" }}>
        <button
          style={{
            padding: "8px 12px",
            borderRadius: 8,
            border: 0,
            cursor: "pointer",
            background: page === "iap" ? "#1d4ed8" : "#ffffff",
            color: page === "iap" ? "#ffffff" : "#111827",
            fontWeight: 600
          }}
          onClick={() => setPage("iap")}
        >
          InApp
        </button>
        
        <button
          style={{
            padding: "8px 12px",
            borderRadius: 8,
            border: 0,
            cursor: "pointer",
            background: page === "rewarded" ? "#1d4ed8" : "#ffffff",
            color: page === "rewarded" ? "#ffffff" : "#111827",
            fontWeight: 600
          }}
          onClick={() => setPage("rewarded")}
        >
          Rewarded Ads
        </button>
        <button
          style={{
            padding: "8px 12px",
            borderRadius: 8,
            border: 0,
            cursor: "pointer",
            background: page === "gameplay" ? "#1d4ed8" : "#ffffff",
            color: page === "gameplay" ? "#ffffff" : "#111827",
            fontWeight: 600
          }}
          onClick={() => setPage("gameplay")}
        >
          Gameplay
        </button>
        <button
          style={{
            padding: "8px 12px",
            borderRadius: 8,
            border: 0,
            cursor: "pointer",
            background: page === "resources" ? "#1d4ed8" : "#ffffff",
            color: page === "resources" ? "#ffffff" : "#111827",
            fontWeight: 600
          }}
          onClick={() => setPage("resources")}
        >
          Resources
        </button>
        {isAdmin && (
          <button
            style={{
              padding: "8px 12px",
              borderRadius: 8,
              border: 0,
              cursor: "pointer",
              background: page === "admin" ? "#1d4ed8" : "#ffffff",
              color: page === "admin" ? "#ffffff" : "#111827",
              fontWeight: 600
            }}
            onClick={() => setPage("admin")}
          >
            Admin
          </button>
        )}
        <select
          style={{
            marginLeft: "auto",
            minWidth: 260,
            padding: "8px 10px",
            borderRadius: 8,
            border: "1px solid #cbd5e1",
            background: "#ffffff",
            color: "#111827"
          }}
          value={selectedGame}
          onChange={(e) => {
            setSelectedGame(e.target.value);
            window.localStorage.setItem(GAME_STORAGE_KEY, e.target.value);
          }}
        >
          <option value="">Select Game...</option>
          {games.map((game) => (
            <option key={game.value} value={game.value}>
              {game.label}
            </option>
          ))}
        </select>

        <div className="account-menu-wrap" ref={accountMenuRef}>
          <button
            className="account-menu-button"
            onClick={() => setAccountMenuOpen((prev) => !prev)}
          >
            {username} ▾
          </button>
          {accountMenuOpen && (
            <div className="account-menu-dropdown">
              <button
                className="account-menu-item"
                onClick={() => {
                  setPage("password");
                  setAccountMenuOpen(false);
                  setPasswordError("");
                  setPasswordSuccess("");
                }}
              >
                Password
              </button>
              <button
                className="account-menu-item"
                onClick={handleLogout}
              >
                Sign out
              </button>
            </div>
          )}
        </div>
      </div>

      {page === "iap" && <InAppDashboard gameIds={selectedGameIds} />}
      {page === "rewarded" && <RewardedAdsDashboard gameIds={selectedGameIds} />}
      {page === "gameplay" && <GameplayDashboard gameIds={selectedGameIds} />}
      {page === "resources" && <ResourcesDashboard gameIds={selectedGameIds} />}
      {page === "admin" && isAdmin && <AdminAccessDashboard />}
      {page === "password" && (
        <div className="password-page">
          <div className="password-card">
            <h2 className="password-title">Password for [{username}]</h2>
            <form onSubmit={handleChangePassword}>
              <label className="password-label" htmlFor="currentPassword">Current password</label>
              <input
                id="currentPassword"
                className="password-input"
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="Current password"
              />

              <label className="password-label" htmlFor="newPassword">New password</label>
              <input
                id="newPassword"
                className="password-input"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="New password"
              />

              <label className="password-label" htmlFor="confirmPassword">New password confirmation</label>
              <input
                id="confirmPassword"
                className="password-input"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm the new password"
              />

              {passwordError && <div className="password-error">{passwordError}</div>}
              {passwordSuccess && <div className="password-success">{passwordSuccess}</div>}

              <button className="password-save-button" type="submit" disabled={savingPassword}>
                {savingPassword ? "Saving..." : "Save"}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
