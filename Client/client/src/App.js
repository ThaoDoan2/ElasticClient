import { useState } from "react";
import "./App.css";
import InAppDashboard from "./InAppDashboard";
import GameplayDashboard from "./GameplayDashboard";
import ResourcesDashboard from "./ResourcesDashboard";
import RewardedAdsDashboard from "./RewardedAdsDashboard";

function App() {
  const [page, setPage] = useState("iap");

  return (
    <div>
      <div style={{ display: "flex", gap: 8, padding: 12, background: "#e5e7eb", borderBottom: "1px solid #d1d5db" }}>
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
      </div>

      {page === "iap" && <InAppDashboard />}
      {page === "rewarded" && <RewardedAdsDashboard />}
      {page === "gameplay" && <GameplayDashboard />}
      {page === "resources" && <ResourcesDashboard />}
    </div>
  );
}

export default App;
