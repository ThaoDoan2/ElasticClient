import { useState } from "react";
import "./App.css";
import InAppDashboard from "./InAppDashboard";
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
      </div>

      {page === "iap" ? <InAppDashboard /> : <RewardedAdsDashboard />}
    </div>
  );
}

export default App;
