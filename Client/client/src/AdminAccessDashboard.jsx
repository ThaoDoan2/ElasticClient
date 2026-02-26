import { useEffect, useMemo, useState } from "react";
import axios from "axios";

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
          const rawValue = item.gameId;
          const rawLabel = item.name?? rawValue;
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

const normalizeUserRows = (payload) => {
  if (!Array.isArray(payload)) return [];
  return payload
    .map((item) => {
      if (typeof item === "string") {
        return { id: item, username: item, gameIds: [] };
      }
      if (!item || typeof item !== "object") return null;

      const id = item.username;
      if (id === undefined || id === null) return null;
      const username = item.username ?? String(id);

      const sourceGames =
        item.gameIds ??
        [];
      const gameIds = Array.isArray(sourceGames)
        ? sourceGames
            .map((g) => {
              if (typeof g === "string" || typeof g === "number") return String(g);
              if (g && typeof g === "object") {
                const raw = g.gameId;
                return raw === undefined || raw === null ? "" : String(raw);
              }
              return "";
            })
            .filter(Boolean)
        : [];

      return {
        id: String(id),
        username: String(username),
        gameIds
      };
    })
    .filter(Boolean);
};

const isRetryableEndpointError = (err) =>
  axios.isAxiosError(err) && err.response && [404, 405].includes(err.response.status);

const fetchUsers = async (apiBase) => {
  const endpoints = [
    "/api/admin/users"
  ];
  let lastError = null;
  for (const endpoint of endpoints) {
    try {
      const response = await axios.get(`${apiBase}${endpoint}`);
      return normalizeUserRows(response.data);
    } catch (err) {
      lastError = err;
      if (!isRetryableEndpointError(err)) throw err;
    }
  }
  throw lastError || new Error("Cannot load users.");
};

const saveUserGameAccess = async (apiBase, userId, gameIds) => {
  const attempts = [
    () => axios.put(`${apiBase}/api/admin/users/${encodeURIComponent(userId)}/access`, { gameIds })
  ];

  let lastError = null;
  for (const call of attempts) {
    try {
      return await call();
    } catch (err) {
      lastError = err;
      if (!isRetryableEndpointError(err)) throw err;
    }
  }
  throw lastError || new Error("Cannot save user game access.");
};

const createUser = async (apiBase, payload) => {
  const attempts = [
    () => axios.post(`${apiBase}/api/admin/users`, payload)
  ];

  let lastError = null;
  for (const call of attempts) {
    try {
      return await call();
    } catch (err) {
      lastError = err;
      if (!isRetryableEndpointError(err)) throw err;
    }
  }
  throw lastError || new Error("Cannot create user.");
};

export default function AdminAccessDashboard() {
  const [users, setUsers] = useState([]);
  const [gameOptions, setGameOptions] = useState([]);
  const [selectedByUserId, setSelectedByUserId] = useState({});
  const [search, setSearch] = useState("");
  const [savingByUserId, setSavingByUserId] = useState({});
  const [showCreateUser, setShowCreateUser] = useState(false);
  const [newUsername, setNewUsername] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newIsAdmin, setNewIsAdmin] = useState(false);
  const [newGameIds, setNewGameIds] = useState([]);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const loadData = async () => {
    try {
      setLoading(true);
      setError("");
      const apiBase = process.env.REACT_APP_API_BASE_URL || "";
      const [gamesRes, usersList] = await Promise.all([
        axios.get(`${apiBase}/api/games`),
        fetchUsers(apiBase)
      ]);
      const games = normalizeGames(gamesRes.data);
      setGameOptions(games);
      setUsers(usersList);
      setSelectedByUserId(
        usersList.reduce((acc, user) => {
          acc[user.id] = Array.isArray(user.gameIds) ? user.gameIds : [];
          return acc;
        }, {})
      );
    } catch (err) {
      if (axios.isAxiosError(err) && !err.response) {
        setError("Cannot reach API. Make sure backend is running.");
      } else if (axios.isAxiosError(err) && err.response) {
        const payload = err.response.data;
        const serverMessage = typeof payload === "string"
          ? payload
          : payload?.message || payload?.error || JSON.stringify(payload);
        setError(`API ${err.response.status}: ${serverMessage}`);
      } else {
        setError("Failed to load admin access data.");
      }
      setUsers([]);
      setGameOptions([]);
      setSelectedByUserId({});
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const filteredUsers = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    if (!keyword) return users;
    return users.filter((user) => user.username.toLowerCase().includes(keyword));
  }, [users, search]);

  const handleSave = async (userId) => {
    const selected = Array.isArray(selectedByUserId[userId]) ? selectedByUserId[userId] : [];
    try {
      setSavingByUserId((prev) => ({ ...prev, [userId]: true }));
      const apiBase = process.env.REACT_APP_API_BASE_URL || "";
      await saveUserGameAccess(apiBase, userId, selected);
      setUsers((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, gameIds: selected } : u))
      );
    } catch (err) {
      if (axios.isAxiosError(err) && err.response) {
        const payload = err.response.data;
        const serverMessage = typeof payload === "string"
          ? payload
          : payload?.message || payload?.error || JSON.stringify(payload);
        setError(`Save failed for ${userId}: ${serverMessage}`);
      } else {
        setError(`Save failed for ${userId}.`);
      }
    } finally {
      setSavingByUserId((prev) => ({ ...prev, [userId]: false }));
    }
  };

  const handleCreateUser = async (e) => {
    e.preventDefault();
    const username = newUsername.trim();
    const password = newPassword.trim();
    const passwordEncoded = true;
    if (!username || !password) {
      setError("Username and password are required to create user.");
      return;
    }

    try {
      setCreating(true);
      setError("");
      const apiBase = process.env.REACT_APP_API_BASE_URL || "";
      await createUser(apiBase, {
        username,
        password: toBase64(password),
        passwordEncoded,
        role: newIsAdmin? "ADMIN": "USER",
        gameIds: newGameIds
      });

      setNewUsername("");
      setNewPassword("");
      setNewIsAdmin(false);
      setNewGameIds([]);
      setShowCreateUser(false);
      await loadData();
    } catch (err) {
      if (axios.isAxiosError(err) && err.response) {
        const payload = err.response.data;
        const serverMessage = typeof payload === "string"
          ? payload
          : payload?.message || payload?.error || JSON.stringify(payload);
        setError(`Create user failed: ${serverMessage}`);
      } else {
        setError("Create user failed.");
      }
    } finally {
      setCreating(false);
    }
  };

  return (
    <div style={{ padding: 24, background: "#f3f4f6", minHeight: "100vh" }}>
      <div style={{ maxWidth: 1240, margin: "0 auto", background: "#ffffff", borderRadius: 14, padding: 20, boxShadow: "0 10px 28px rgba(15, 23, 42, 0.08)" }}>
        <h2 style={{ margin: "0 0 16px", color: "#0f172a" }}>Admin: User Game Access</h2>
        <div style={{ display: "flex", gap: 10, marginBottom: 14 }}>
          <input
            style={{ padding: "10px 12px", border: "1px solid #d1d5db", borderRadius: 8, flex: 1 }}
            placeholder="Search username..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <button
            style={{ background: "#1d4ed8", color: "#ffffff", border: 0, borderRadius: 8, padding: "10px 14px", fontWeight: 600, cursor: "pointer" }}
            onClick={loadData}
          >
            Reload
          </button>
          <button
            style={{ background: "#059669", color: "#ffffff", border: 0, borderRadius: 8, padding: "10px 14px", fontWeight: 600, cursor: "pointer" }}
            onClick={() => setShowCreateUser((prev) => !prev)}
          >
            {showCreateUser ? "Close Create User" : "Create User"}
          </button>
        </div>

        {showCreateUser && (
          <form
            onSubmit={handleCreateUser}
            style={{
              border: "1px solid #d1d5db",
              borderRadius: 8,
              padding: 12,
              marginBottom: 14,
              background: "#f9fafb"
            }}
          >
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 10, alignItems: "start" }}>
              <input
                style={{ padding: "10px 12px", border: "1px solid #d1d5db", borderRadius: 8 }}
                placeholder="Username"
                value={newUsername}
                onChange={(e) => setNewUsername(e.target.value)}
              />
              <input
                style={{ padding: "10px 12px", border: "1px solid #d1d5db", borderRadius: 8 }}
                type="password"
                placeholder="Password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
              <label style={{ display: "flex", alignItems: "center", gap: 8, paddingTop: 8, color: "#111827", fontWeight: 600 }}>
                <input
                  type="checkbox"
                  checked={newIsAdmin}
                  onChange={(e) => setNewIsAdmin(e.target.checked)}
                />
                Admin
              </label>
              <select
                style={{ padding: 8, border: "1px solid #d1d5db", borderRadius: 8, minHeight: 92 }}
                multiple
                value={newGameIds}
                onChange={(e) => setNewGameIds(Array.from(e.target.selectedOptions, (o) => o.value))}
              >
                {gameOptions.map((game) => (
                  <option key={game.value} value={game.value}>
                    {game.label}
                  </option>
                ))}
              </select>
              <button
                style={{ background: "#1d4ed8", color: "#ffffff", border: 0, borderRadius: 8, padding: "10px 14px", fontWeight: 600, cursor: "pointer", maxHeight: 42 }}
                type="submit"
                disabled={creating}
              >
                {creating ? "Creating..." : "Create"}
              </button>
            </div>
          </form>
        )}

        {error && <div style={{ color: "#b00020", marginBottom: 10 }}>{error}</div>}
        {loading && <div style={{ color: "#374151", marginBottom: 10 }}>Loading...</div>}

        <div style={{ border: "1px solid #d1d5db", borderRadius: 8, overflow: "hidden" }}>
          <div style={{ display: "grid", gridTemplateColumns: "220px 1fr 130px", padding: "10px 12px", background: "#f3f4f6", fontWeight: 700, color: "#111827" }}>
            <div>User</div>
            <div>Allowed Game IDs</div>
            <div>Action</div>
          </div>
          {filteredUsers.map((user) => (
            <div key={user.id} style={{ display: "grid", gridTemplateColumns: "220px 1fr 130px", padding: "10px 12px", borderTop: "1px solid #e5e7eb", alignItems: "center", gap: 10 }}>
              <div style={{ fontWeight: 600, color: "#111827" }}>{user.username}</div>
              <select
                style={{ padding: 8, border: "1px solid #d1d5db", borderRadius: 8, minHeight: 92 }}
                multiple
                value={selectedByUserId[user.id] || []}
                onChange={(e) =>
                  setSelectedByUserId((prev) => ({
                    ...prev,
                    [user.id]: Array.from(e.target.selectedOptions, (o) => o.value)
                  }))
                }
              >
                {gameOptions.map((game) => (
                  <option key={game.value} value={game.value}>
                    {game.label}
                  </option>
                ))}
              </select>
              <button
                style={{ background: "#059669", color: "#ffffff", border: 0, borderRadius: 8, padding: "8px 12px", fontWeight: 600, cursor: "pointer" }}
                onClick={() => handleSave(user.id)}
                disabled={savingByUserId[user.id]}
              >
                {savingByUserId[user.id] ? "Saving..." : "Save"}
              </button>
            </div>
          ))}
          {!filteredUsers.length && !loading && (
            <div style={{ padding: 14, color: "#6b7280" }}>No users found.</div>
          )}
        </div>
      </div>
    </div>
  );
}
