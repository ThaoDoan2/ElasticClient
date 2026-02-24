import { useEffect, useRef, useState } from "react";
import axios from "axios";
import { Line } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Legend
} from "chart.js";

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend);

const toInputDate = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const getDateOffset = (days) => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return toInputDate(d);
};

const normalizeUnique = (values) =>
  Array.from(new Set((Array.isArray(values) ? values : []).map((v) => String(v).trim()).filter(Boolean)));

const mapToStringOptions = (payload, keyCandidates = []) => {
  if (Array.isArray(payload)) {
    return payload
      .map((item) => {
        if (typeof item === "string" || typeof item === "number") return String(item).trim();
        if (item && typeof item === "object") {
          for (const key of keyCandidates) {
            const value = item?.[key];
            if (value !== undefined && value !== null && String(value).trim()) {
              return String(value).trim();
            }
          }
        }
        return "";
      })
      .filter(Boolean);
  }

  if (payload && typeof payload === "object") {
    return Object.keys(payload).map((key) => String(key).trim()).filter(Boolean);
  }

  return [];
};

async function fetchFirstOptionList(apiBase, endpoints, keyCandidates) {
  for (const endpoint of endpoints) {
    try {
      const response = await axios.get(`${apiBase}${endpoint}`);
      const options = Array.from(new Set(mapToStringOptions(response.data, keyCandidates)));
      if (options.length) return options;
    } catch (err) {
      if (axios.isAxiosError(err) && err.response?.status === 404) {
        continue;
      }
    }
  }
  return [];
}

const toRows = (payload) => {
  if (Array.isArray(payload)) return payload;
  if (payload && Array.isArray(payload.data)) return payload.data;
  if (payload && typeof payload === "object") {
    return Object.entries(payload).map(([key, value]) =>
      value && typeof value === "object"
        ? { level: key, ...value }
        : { level: key, value }
    );
  }
  return [];
};

const toLevelLabel = (row) => {
  const value = row?.level ?? row?.gameLevel ?? row?.stage ?? row?.x ?? row?.key;
  if (value === undefined || value === null) return "";
  return String(value).trim();
};

const pickMetric = (row, keys) => {
  for (const key of keys) {
    const raw = row?.[key];
    const value = Number(raw);
    if (Number.isFinite(value)) return value;
  }
  return 0;
};

const compareLevelsAsc = (a, b) => {
  const aNum = Number(a);
  const bNum = Number(b);
  const aIsNum = Number.isFinite(aNum);
  const bIsNum = Number.isFinite(bNum);
  if (aIsNum && bIsNum) return aNum - bNum;
  if (aIsNum) return -1;
  if (bIsNum) return 1;
  return String(a).localeCompare(String(b));
};

const buildChart = (rows, definitions) => {
  const grouped = new Map();
  (Array.isArray(rows) ? rows : []).forEach((row) => {
    const level = toLevelLabel(row);
    if (!level) return;
    if (!grouped.has(level)) {
      grouped.set(
        level,
        definitions.reduce((acc, def) => ({ ...acc, [def.key]: 0 }), {})
      );
    }
    const aggregate = grouped.get(level);
    definitions.forEach((def) => {
      aggregate[def.key] += pickMetric(row, def.keys);
    });
  });

  const points = Array.from(grouped.entries())
    .sort(([a], [b]) => compareLevelsAsc(a, b))
    .map(([level, values]) => ({ level, values }));
  if (!points.length) return null;

  const datasets = definitions.map((def) => ({
    label: def.label,
    data: points.map((item) => {
      let value = item.values[def.key] || 0;
      if (def.toPercent && value > 0 && value <= 1) value *= 100;
      return Number(value.toFixed(2));
    }),
    borderColor: def.color,
    backgroundColor: `${def.color}22`,
    borderWidth: 2,
    tension: 0.25,
    pointRadius: 2
  }));

  return {
    labels: points.map((item) => item.level),
    datasets
  };
};

const buildRatioChart = (rows, numeratorKeys, denominatorKeys, label = "Ratio") => {
  const grouped = new Map();
  (Array.isArray(rows) ? rows : []).forEach((row) => {
    const level = toLevelLabel(row);
    if (!level) return;
    if (!grouped.has(level)) {
      grouped.set(level, { numerator: 0, denominator: 0 });
    }
    const aggregate = grouped.get(level);
    aggregate.numerator += pickMetric(row, numeratorKeys);
    aggregate.denominator += pickMetric(row, denominatorKeys);
  });

  const points = Array.from(grouped.entries())
    .sort(([a], [b]) => compareLevelsAsc(a, b))
    .map(([level, values]) => ({ level, values }));
  if (!points.length) return null;

  return {
    labels: points.map((item) => item.level),
    datasets: [
      {
        label,
        data: points.map((item) => {
          const numerator = Number(item.values.numerator) || 0;
          const denominator = Number(item.values.denominator) || 0;
          if (denominator <= 0) return 0;
          return Number((numerator / denominator).toFixed(2));
        }),
        borderColor: "#eab308",
        backgroundColor: "#eab30822",
        borderWidth: 2,
        tension: 0.25,
        pointRadius: 2
      }
    ]
  };
};

const buildDurationChart = (rows, label = "Duration(s)") => {
  const grouped = new Map();
  (Array.isArray(rows) ? rows : []).forEach((row) => {
    const level = toLevelLabel(row);
    if (!level) return;
    const duration = pickMetric(row, ["duration", "avgDuration", "averageDuration", "meanDuration"]);
    if (!Number.isFinite(duration) || duration < 0) return;
    if (!grouped.has(level)) {
      grouped.set(level, { total: 0, count: 0 });
    }
    const bucket = grouped.get(level);
    bucket.total += duration;
    bucket.count += 1;
  });

  const points = Array.from(grouped.entries())
    .sort(([a], [b]) => compareLevelsAsc(a, b))
    .map(([level, values]) => ({ level, values }));
  if (!points.length) return null;

  return {
    labels: points.map((item) => item.level),
    datasets: [
      {
        label,
        data: points.map((item) => {
          const avg = item.values.count > 0 ? item.values.total / item.values.count : 0;
          return Number(avg.toFixed(2));
        }),
        borderColor: "#eab308",
        backgroundColor: "#eab30822",
        borderWidth: 2,
        tension: 0.25,
        pointRadius: 2
      }
    ]
  };
};

const appendRemainPercentDataset = (chartData, userDatasetLabel) => {
  if (!chartData?.datasets?.length) return chartData;
  const userDataset = chartData.datasets.find((d) => d.label === userDatasetLabel);
  const userValues = Array.isArray(userDataset?.data) ? userDataset.data.map((n) => Number(n) || 0) : [];
  if (!userValues.length) return chartData;

  const baseline = userValues.find((n) => n > 0) || 0;
  if (baseline <= 0) return chartData;

  const remainPercent = userValues.map((n) => Number(((n / baseline) * 100).toFixed(2)));
  return {
    ...chartData,
    datasets: [
      ...chartData.datasets,
      {
        label: "% Users Remaining",
        data: remainPercent,
        borderColor: "#f59e0b",
        backgroundColor: "#f59e0b22",
        borderWidth: 2,
        tension: 0.25,
        pointRadius: 2
      }
    ]
  };
};

export default function GameplayDashboard() {
  const [fromDate, setFromDate] = useState(() => getDateOffset(-7));
  const [toDate, setToDate] = useState(() => getDateOffset(0));
  const [country, setCountry] = useState("");
  const [platform, setPlatform] = useState("");
  const [version, setVersion] = useState("");
  const [minLevel, setMinLevel] = useState("");
  const [maxLevel, setMaxLevel] = useState("");
  const [countryOptions, setCountryOptions] = useState([]);
  const [platformOptions, setPlatformOptions] = useState([]);
  const [versionOptions, setVersionOptions] = useState([]);
  const [startChartData, setStartChartData] = useState(null);
  const [winChartData, setWinChartData] = useState(null);
  const [loseChartData, setLoseChartData] = useState(null);
  const [startRatioChartData, setStartRatioChartData] = useState(null);
  const [winRatioChartData, setWinRatioChartData] = useState(null);
  const [loseRatioChartData, setLoseRatioChartData] = useState(null);
  const [loseDurationChartData, setLoseDurationChartData] = useState(null);
  const [winDurationChartData, setWinDurationChartData] = useState(null);
  const [startRenderKey, setStartRenderKey] = useState(0);
  const [winRenderKey, setWinRenderKey] = useState(0);
  const [loseRenderKey, setLoseRenderKey] = useState(0);
  const [startRatioRenderKey, setStartRatioRenderKey] = useState(0);
  const [winRatioRenderKey, setWinRatioRenderKey] = useState(0);
  const [loseRatioRenderKey, setLoseRatioRenderKey] = useState(0);
  const [loseDurationRenderKey, setLoseDurationRenderKey] = useState(0);
  const [winDurationRenderKey, setWinDurationRenderKey] = useState(0);
  const [error, setError] = useState("");
  const initialLoadDoneRef = useRef(false);

  useEffect(() => {
    const loadFilterOptions = async () => {
      const apiBase = process.env.REACT_APP_API_BASE_URL || "";
      const [countryList, platformList, versionList] = await Promise.all([
        fetchFirstOptionList(apiBase, ["/api/gameplay/countries", "/api/iap/countries"], [
          "country",
          "countryCode",
          "name",
          "value"
        ]),
        fetchFirstOptionList(apiBase, ["/api/gameplay/platforms", "/api/iap/platforms"], [
          "platform",
          "name",
          "value"
        ]),
        fetchFirstOptionList(
          apiBase,
          ["/api/gameplay/game-versions", "/api/iap/game-versions", "/api/iap/versions"],
          ["version", "gameVersion", "name", "value"]
        )
      ]);
      setCountryOptions(countryList);
      setPlatformOptions(platformList);
      setVersionOptions(versionList);
    };

    loadFilterOptions();
  }, []);

  const loadData = async () => {
    try {
      setError("");
      const apiBase = process.env.REACT_APP_API_BASE_URL || "";
      const params = {
        fromDate,
        toDate
      };
      if (country) {
        params.country = country;
        params.countryCode = country;
      }
      if (platform) params.platform = platform;
      if (version) params.gameVersion = version;
      if (minLevel !== "") params.minLevel = Number(minLevel);
      if (maxLevel !== "") params.maxLevel = Number(maxLevel);

      const [startRes, winRes, loseRes] = await Promise.all([
        axios.post(`${apiBase}/api/gameplay/user-start`, params),
        axios.post(`${apiBase}/api/gameplay/user-win`, params),
        axios.post(`${apiBase}/api/gameplay/user-lose`, params)
      ]);

      const startData = buildChart(toRows(startRes.data), [
        {
          key: "starts",
          label: "Total Starts",
          keys: ["totalStarts", "startCount", "totalStart", "starts", "count", "playCount", "total", "value", "amount"],
          color: "#eab308"
        },
        {
          key: "users",
          label: "Users Started",
          keys: ["totalUsersStart", "userStart", "totalUserStart", "users", "uniqueUsers", "userCount"],
          color: "#22c55e"
        }
      ]);
      const startDataWithRemain = appendRemainPercentDataset(startData, "Users Started");
      const startRatioData = buildRatioChart(
        toRows(startRes.data),
        ["totalStarts", "startCount", "totalStart", "starts", "count", "playCount", "total", "value", "amount"],
        ["totalUsersStart", "userStart", "totalUserStart", "users", "uniqueUsers", "userCount"],
        "Start/UserStart Ratio"
      );

      const winData = buildChart(toRows(winRes.data), [
        {
          key: "wins",
          label: "Total Wins",
          keys: ["totalWins", "winCount", "totalWin", "wins", "count", "playCount", "total", "value", "amount"],
          color: "#eab308"
        },
        {
          key: "users",
          label: "Users Won",
          keys: ["totalUsersWin", "userWin", "totalUserWin", "users", "uniqueUsers", "userCount"],
          color: "#22c55e"
        }
      ]);
      const winRatioData = buildRatioChart(
        toRows(winRes.data),
        ["totalWins", "winCount", "totalWin", "wins", "count", "playCount", "total", "value", "amount"],
        ["totalUsersWin", "userWin", "totalUserWin", "users", "uniqueUsers", "userCount"],
        "Win/UserWin Ratio"
      );

      const loseData = buildChart(toRows(loseRes.data), [
        {
          key: "loses",
          label: "Total Loses",
          keys: ["totalLoses", "loseCount", "totalLose", "loses", "count", "playCount", "total", "value", "amount"],
          color: "#eab308"
        },
        {
          key: "users",
          label: "Users Lost",
          keys: ["totalUsersLose", "userLose", "totalUserLose", "users", "uniqueUsers", "userCount"],
          color: "#22c55e"
        }
      ]);
      const loseRatioData = buildRatioChart(
        toRows(loseRes.data),
        ["totalLoses", "loseCount", "totalLose", "loses", "count", "playCount", "total", "value", "amount"],
        ["totalUsersLose", "userLose", "totalUserLose", "users", "uniqueUsers", "userCount"],
        "Lose/UserLose Ratio"
      );
      const loseDurationData = buildDurationChart(toRows(loseRes.data), "Duration(s)");
      const winDurationData = buildDurationChart(toRows(winRes.data), "Duration(s)");

      if (
        !startDataWithRemain &&
        !winData &&
        !loseData &&
        !startRatioData &&
        !winRatioData &&
        !loseRatioData &&
        !loseDurationData &&
        !winDurationData
      ) {
        setError("No gameplay data for selected filters.");
      }

      setStartChartData(startDataWithRemain);
      setWinChartData(winData);
      setLoseChartData(loseData);
      setStartRatioChartData(startRatioData);
      setWinRatioChartData(winRatioData);
      setLoseRatioChartData(loseRatioData);
      setLoseDurationChartData(loseDurationData);
      setWinDurationChartData(winDurationData);
      setStartRenderKey((prev) => prev + 1);
      setWinRenderKey((prev) => prev + 1);
      setLoseRenderKey((prev) => prev + 1);
      setStartRatioRenderKey((prev) => prev + 1);
      setWinRatioRenderKey((prev) => prev + 1);
      setLoseRatioRenderKey((prev) => prev + 1);
      setLoseDurationRenderKey((prev) => prev + 1);
      setWinDurationRenderKey((prev) => prev + 1);
    } catch (err) {
      if (axios.isAxiosError(err) && !err.response) {
        setError("Cannot reach API. Make sure backend is running and proxy/base URL is configured.");
      } else if (axios.isAxiosError(err) && err.response) {
        const payload = err.response.data;
        const serverMessage = typeof payload === "string"
          ? payload
          : payload?.message || payload?.error || JSON.stringify(payload);
        setError(`API ${err.response.status}: ${serverMessage}`);
      } else {
        setError("Failed to load gameplay dashboard data.");
      }
      setStartChartData(null);
      setWinChartData(null);
      setLoseChartData(null);
      setStartRatioChartData(null);
      setWinRatioChartData(null);
      setLoseRatioChartData(null);
      setLoseDurationChartData(null);
      setWinDurationChartData(null);
    }
  };

  useEffect(() => {
    if (initialLoadDoneRef.current) return;
    initialLoadDoneRef.current = true;
    loadData();
  }, []);

  return (
    <div style={{ padding: 24, background: "#f3f4f6", minHeight: "100vh" }}>
      <div style={{ maxWidth: 1240, margin: "0 auto", background: "#ffffff", borderRadius: 14, padding: 20, boxShadow: "0 10px 28px rgba(15, 23, 42, 0.08)" }}>
        <h2 style={{ margin: "0 0 16px", color: "#0f172a" }}>Gameplay Analytics</h2>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 10, marginBottom: 14 }}>
          <input
            style={{ padding: "10px 12px", border: "1px solid #d1d5db", borderRadius: 8 }}
            type="date"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
          />
          <input
            style={{ padding: "10px 12px", border: "1px solid #d1d5db", borderRadius: 8 }}
            type="date"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
          />
          <select
            style={{ padding: "10px 12px", border: "1px solid #d1d5db", borderRadius: 8 }}
            value={country}
            onChange={(e) => setCountry(e.target.value)}
          >
            <option value="">All Countries</option>
            {normalizeUnique(countryOptions).map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
          <select
            style={{ padding: "10px 12px", border: "1px solid #d1d5db", borderRadius: 8 }}
            value={version}
            onChange={(e) => setVersion(e.target.value)}
          >
            <option value="">All Versions</option>
            {normalizeUnique(versionOptions).map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
          <select
            style={{ padding: "10px 12px", border: "1px solid #d1d5db", borderRadius: 8 }}
            value={platform}
            onChange={(e) => setPlatform(e.target.value)}
          >
            <option value="">All Platforms</option>
            {normalizeUnique(platformOptions).map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
          <input
            style={{ padding: "10px 12px", border: "1px solid #d1d5db", borderRadius: 8 }}
            type="number"
            min={0}
            placeholder="Min Level"
            value={minLevel}
            onChange={(e) => setMinLevel(e.target.value)}
          />
          <input
            style={{ padding: "10px 12px", border: "1px solid #d1d5db", borderRadius: 8 }}
            type="number"
            min={0}
            placeholder="Max Level"
            value={maxLevel}
            onChange={(e) => setMaxLevel(e.target.value)}
          />
          <button
            style={{ background: "#1d4ed8", color: "white", border: 0, borderRadius: 8, fontWeight: 600, cursor: "pointer" }}
            onClick={loadData}
          >
            Search
          </button>
        </div>

        {error && <div style={{ color: "#b00020", marginBottom: 10 }}>{error}</div>}

        {startChartData && (
          <>
            <h3 style={{ margin: "8px 0 8px", color: "#111827" }}>Total Starts and Users Started</h3>
            <div style={{ height: 320, marginBottom: 18 }}>
              <Line
                key={startRenderKey}
                redraw
                data={startChartData}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  plugins: { legend: { position: "right" } },
                  scales: {
                    y: { beginAtZero: true }
                  }
                }}
              />
            </div>
          </>
        )}

        {winChartData && (
          <>
            <h3 style={{ margin: "8px 0 8px", color: "#111827" }}>Total Wins and Users Won</h3>
            <div style={{ height: 320 }}>
              <Line
                key={winRenderKey}
                redraw
                data={winChartData}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  plugins: { legend: { position: "right" } },
                  scales: {
                    y: { beginAtZero: true }
                  }
                }}
              />
            </div>
          </>
        )}

        {loseChartData && (
          <>
            <h3 style={{ margin: "8px 0 8px", color: "#111827" }}>Total Loses and Users Lost</h3>
            <div style={{ height: 320, marginBottom: 18 }}>
              <Line
                key={loseRenderKey}
                redraw
                data={loseChartData}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  plugins: { legend: { position: "right" } },
                  scales: {
                    y: { beginAtZero: true }
                  }
                }}
              />
            </div>
          </>
        )}

        {startRatioChartData && (
          <>
            <h3 style={{ margin: "8px 0 8px", color: "#111827" }}>Ratio Start / User Start</h3>
            <div style={{ height: 280, marginBottom: 18 }}>
              <Line
                key={startRatioRenderKey}
                redraw
                data={startRatioChartData}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  plugins: { legend: { position: "right" } },
                  scales: {
                    y: { beginAtZero: true }
                  }
                }}
              />
            </div>
          </>
        )}

        {winRatioChartData && (
          <>
            <h3 style={{ margin: "8px 0 8px", color: "#111827" }}>Ratio Win / User Win</h3>
            <div style={{ height: 280, marginBottom: 18 }}>
              <Line
                key={winRatioRenderKey}
                redraw
                data={winRatioChartData}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  plugins: { legend: { position: "right" } },
                  scales: {
                    y: { beginAtZero: true }
                  }
                }}
              />
            </div>
          </>
        )}

        {loseRatioChartData && (
          <>
            <h3 style={{ margin: "8px 0 8px", color: "#111827" }}>Ratio Lose / User Lose</h3>
            <div style={{ height: 280, marginBottom: 18 }}>
              <Line
                key={loseRatioRenderKey}
                redraw
                data={loseRatioChartData}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  plugins: { legend: { position: "right" } },
                  scales: {
                    y: { beginAtZero: true }
                  }
                }}
              />
            </div>
          </>
        )}

        {loseDurationChartData && (
          <>
            <h3 style={{ margin: "8px 0 8px", color: "#111827" }}>Average Duration of User Lose by Level</h3>
            <div style={{ height: 280, marginBottom: 18 }}>
              <Line
                key={loseDurationRenderKey}
                redraw
                data={loseDurationChartData}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  plugins: { legend: { position: "right" } },
                  scales: {
                    y: { beginAtZero: true, title: { display: true, text: "Duration(s)" } }
                  }
                }}
              />
            </div>
          </>
        )}

        {winDurationChartData && (
          <>
            <h3 style={{ margin: "8px 0 8px", color: "#111827" }}>Average Duration of User Win by Level</h3>
            <div style={{ height: 280 }}>
              <Line
                key={winDurationRenderKey}
                redraw
                data={winDurationChartData}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  plugins: { legend: { position: "right" } },
                  scales: {
                    y: { beginAtZero: true, title: { display: true, text: "Duration(s)" } }
                  }
                }}
              />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
