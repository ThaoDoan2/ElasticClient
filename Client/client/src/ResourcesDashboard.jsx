import { useEffect, useRef, useState } from "react";
import axios from "axios";
import { Doughnut, Line } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  ArcElement,
  Tooltip,
  Legend
} from "chart.js";
import {
  fetchFirstOptionList,
  getDateOffset,
  getSelectedValues,
  normalizeUnique,
  pickMetric,
  toRows
} from "./dashboardUtils";

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, ArcElement, Tooltip, Legend);

const COLORS = [
  "#eab308",
  "#22c55e",
  "#3b82f6",
  "#ef4444",
  "#14b8a6",
  "#f97316",
  "#a855f7",
  "#06b6d4",
  "#84cc16",
  "#ec4899",
  "#0ea5e9",
];

const toXLabel = (row, keyCandidates) => {
  for (const key of keyCandidates) {
    const value = row?.[key];
    if (value !== undefined && value !== null && String(value).trim()) return String(value).trim();
  }
  return "";
};

const compareMixedAsc = (a, b) => {
  const aNum = Number(a);
  const bNum = Number(b);
  const aIsNum = Number.isFinite(aNum);
  const bIsNum = Number.isFinite(bNum);
  if (aIsNum && bIsNum) return aNum - bNum;
  if (aIsNum) return -1;
  if (bIsNum) return 1;
  return String(a).localeCompare(String(b));
};

const buildSourceSinkLineChart = (rows, xKeyCandidates, xSorter = (a, b) => String(a).localeCompare(String(b))) => {
  const grouped = new Map();
  (Array.isArray(rows) ? rows : []).forEach((row) => {
    const x = toXLabel(row, xKeyCandidates);
    if (!x) return;
    if (!grouped.has(x)) grouped.set(x, { source: 0, sink: 0 });
    const agg = grouped.get(x);
    agg.source += pickMetric(row, ["source", "totalSource", "sourceAmount", "inflow", "in", "gain"]);
    agg.sink += pickMetric(row, ["sink", "totalSink", "sinkAmount", "outflow", "out", "loss"]);
  });

  const points = Array.from(grouped.entries())
    .sort(([a], [b]) => xSorter(a, b))
    .map(([x, values]) => ({ x, values }));
  if (!points.length) return null;

  return {
    labels: points.map((p) => p.x),
    datasets: [
      {
        label: "source",
        data: points.map((p) => Number((p.values.source || 0).toFixed(2))),
        borderColor: "#eab308",
        backgroundColor: "#eab30822",
        borderWidth: 2,
        tension: 0.25,
        pointRadius: 2
      },
      {
        label: "sink",
        data: points.map((p) => Number((p.values.sink || 0).toFixed(2))),
        borderColor: "#22c55e",
        backgroundColor: "#22c55e22",
        borderWidth: 2,
        tension: 0.25,
        pointRadius: 2
      }
    ]
  };
};

const buildWhereMainDoughnut = (rows, metricKeys, label) => {
  const buckets = new Map();
  (Array.isArray(rows) ? rows : []).forEach((row) => {
    const whereMain = String(
      row?.placement ?? row?.whereMain ?? row?.sourceWhereMain ?? row?.sinkWhereMain ?? row?.main ?? ""
    ).trim();
    if (!whereMain) return;
    const amount = pickMetric(row, metricKeys);
    if (!Number.isFinite(amount) || amount <= 0) return;
    buckets.set(whereMain, (buckets.get(whereMain) || 0) + amount);
  });

  const totals = Array.from(buckets.entries())
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);
  if (!totals.length) return null;

  return {
    labels: totals.map((t) => t.name),
    datasets: [
      {
        label,
        data: totals.map((t) => Number(t.value.toFixed(2))),
        backgroundColor: totals.map((_, index) => `${COLORS[index % COLORS.length]}cc`),
        borderColor: totals.map((_, index) => COLORS[index % COLORS.length]),
        borderWidth: 1
      }
    ]
  };
};

async function requestResourceData(apiBase, endpointCandidates, payload) {
  let lastError = null;
  for (const endpoint of endpointCandidates) {
    const full = `${apiBase}${endpoint}`;
    try {
      return await axios.post(full, payload);
    } catch (postErr) {
      if (!(axios.isAxiosError(postErr) && postErr.response && [404, 405].includes(postErr.response.status))) {
        throw postErr;
      }
    }
    try {
      return await axios.get(full, { params: payload });
    } catch (getErr) {
      lastError = getErr;
      if (!(axios.isAxiosError(getErr) && getErr.response && [404, 405].includes(getErr.response.status))) {
        throw getErr;
      }
    }
  }
  throw lastError || new Error("Cannot find supported resource endpoint.");
}

export default function ResourcesDashboard() {
  const [fromDate, setFromDate] = useState(() => getDateOffset(-7));
  const [toDate, setToDate] = useState(() => getDateOffset(0));
  const [countries, setCountries] = useState([]);
  const [platforms, setPlatforms] = useState([]);
  const [versions, setVersions] = useState([]);
  const [placements, setPlacements] = useState([]);
  const [subPlacements, setSubPlacements] = useState([]);
  const [itemNames, setItemNames] = useState([]);
  const [minLevel, setMinLevel] = useState("");
  const [maxLevel, setMaxLevel] = useState("");
  const [countryOptions, setCountryOptions] = useState([]);
  const [platformOptions, setPlatformOptions] = useState([]);
  const [versionOptions, setVersionOptions] = useState([]);
  const [placementOptions, setPlacementOptions] = useState([]);
  const [subPlacementOptions, setSubPlacementOptions] = useState([]);
  const [itemNameOptions, setItemNameOptions] = useState([]);
  const [dateChartData, setDateChartData] = useState(null);
  const [levelChartData, setLevelChartData] = useState(null);
  const [sourceWhereMainChartData, setSourceWhereMainChartData] = useState(null);
  const [sinkWhereMainChartData, setSinkWhereMainChartData] = useState(null);
  const [dateRenderKey, setDateRenderKey] = useState(0);
  const [levelRenderKey, setLevelRenderKey] = useState(0);
  const [sourceWhereMainRenderKey, setSourceWhereMainRenderKey] = useState(0);
  const [sinkWhereMainRenderKey, setSinkWhereMainRenderKey] = useState(0);
  const [error, setError] = useState("");
  const initialLoadDoneRef = useRef(false);

  useEffect(() => {
    const loadFilterOptions = async () => {
      const apiBase = process.env.REACT_APP_API_BASE_URL || "";
      const [countryList, platformList, versionList, placementList, subPlacementList, itemNameList] = await Promise.all([
        fetchFirstOptionList(
          apiBase,
          ["/api/resource/countries"],
          ["country", "countryCode", "name", "value"]
        ),
        fetchFirstOptionList(
          apiBase,
          ["/api/resource/platforms"],
          ["platform", "name", "value"]
        ),
        fetchFirstOptionList(
          apiBase,
          ["/api/resource/game-versions"],
          ["version", "gameVersion", "name", "value"]
        ),
        fetchFirstOptionList(
          apiBase,
          ["/api/resource/placements"],
          ["placement", "name", "value"]
        ),
        fetchFirstOptionList(
          apiBase,
          ["/api/resource/sub-placements"],
          ["subPlacement", "name", "value"]
        ),
        fetchFirstOptionList(
          apiBase,
          ["/api/resource/item-names"],
          ["itemName", "name", "value"]
        )
      ]);
      setCountryOptions(countryList);
      setPlatformOptions(platformList);
      setVersionOptions(versionList);
      setCountries(countryList);
      setPlatforms(platformList);
      setVersions(versionList);
      setPlacementOptions(placementList);
      setSubPlacementOptions(subPlacementList);
      setItemNameOptions(itemNameList);
      setPlacements(placementList);
      setSubPlacements(subPlacementList);
      setItemNames(itemNameList);
    };

    loadFilterOptions();
  }, []);

  const loadData = async () => {
    try {
      setError("");
      const apiBase = process.env.REACT_APP_API_BASE_URL || "";
      const payload = { fromDate, toDate };
      const countryValues = getSelectedValues(countries, countryOptions);
      const platformValues = getSelectedValues(platforms, platformOptions);
      const versionValues = getSelectedValues(versions, versionOptions);
      if (countryValues.length) payload.countryCode = countryValues;
      if (platformValues.length) payload.platform = platformValues;
      if (versionValues.length) payload.gameVersion = versionValues;
      const placementValues = getSelectedValues(placements, placementOptions);
      const subPlacementValues = getSelectedValues(subPlacements, subPlacementOptions);
      const itemNameValues = getSelectedValues(itemNames, itemNameOptions);
      if (placementValues.length) payload.placements = placementValues;
      if (subPlacementValues.length) payload.subPlacements = subPlacementValues;
      if (itemNameValues.length) payload.itemNames = itemNameValues;
      if (minLevel !== "") payload.minLevel = Number(minLevel);
      if (maxLevel !== "") payload.maxLevel = Number(maxLevel);

      const [byDateRes, byLevelRes, sourceByWhereMainRes, sinkByWhereMainRes] = await Promise.all([
        requestResourceData(apiBase, ["/api/resource/source-sink-by-date"], payload),
        requestResourceData(apiBase, ["/api/resource/source-sink-by-level"], payload),
        requestResourceData(apiBase, ["/api/resource/source-by-where-main"], payload),
        requestResourceData(apiBase, ["/api/resource/sink-by-where-main"], payload)
      ]);

      const byDateRows = toRows(byDateRes.data);
      const byLevelRows = toRows(byLevelRes.data);
      const sourceByWhereMainRows = toRows(sourceByWhereMainRes.data);
      const sinkByWhereMainRows = toRows(sinkByWhereMainRes.data);
      const dateChart = buildSourceSinkLineChart(byDateRows, ["date", "x", "day"], (a, b) => String(a).localeCompare(String(b)));
      const levelChart = buildSourceSinkLineChart(byLevelRows, ["level", "gameLevel", "x"], compareMixedAsc);
      const sourceWhereMainChart = buildWhereMainDoughnut(
        sourceByWhereMainRows,
        ["source", "totalSource", "sourceAmount", "amount", "value", "count", "total"],
        "source"
      );
      const sinkWhereMainChart = buildWhereMainDoughnut(
        sinkByWhereMainRows,
        ["sink", "totalSink", "sinkAmount", "amount", "value", "count", "total"],
        "sink"
      );

      if (!dateChart && !levelChart && !sourceWhereMainChart && !sinkWhereMainChart) {
        setError("No resource data for selected filters.");
      }

      setDateChartData(dateChart);
      setLevelChartData(levelChart);
      setSourceWhereMainChartData(sourceWhereMainChart);
      setSinkWhereMainChartData(sinkWhereMainChart);
      setDateRenderKey((prev) => prev + 1);
      setLevelRenderKey((prev) => prev + 1);
      setSourceWhereMainRenderKey((prev) => prev + 1);
      setSinkWhereMainRenderKey((prev) => prev + 1);
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
        setError("Failed to load resources dashboard data.");
      }
      setDateChartData(null);
      setLevelChartData(null);
      setSourceWhereMainChartData(null);
      setSinkWhereMainChartData(null);
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
        <h2 style={{ margin: "0 0 16px", color: "#0f172a" }}>Resources Analytics</h2>

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
            style={{ padding: 8, border: "1px solid #d1d5db", borderRadius: 8, minHeight: 92 }}
            multiple
            value={countries}
            onChange={(e) => setCountries(Array.from(e.target.selectedOptions, (o) => o.value))}
          >
            {normalizeUnique(countryOptions).map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
          <select
            style={{ padding: 8, border: "1px solid #d1d5db", borderRadius: 8, minHeight: 92 }}
            multiple
            value={versions}
            onChange={(e) => setVersions(Array.from(e.target.selectedOptions, (o) => o.value))}
          >
            {normalizeUnique(versionOptions).map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
          <select
            style={{ padding: 8, border: "1px solid #d1d5db", borderRadius: 8, minHeight: 92 }}
            multiple
            value={platforms}
            onChange={(e) => setPlatforms(Array.from(e.target.selectedOptions, (o) => o.value))}
          >
            {normalizeUnique(platformOptions).map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
          <select
            style={{ padding: 8, border: "1px solid #d1d5db", borderRadius: 8, minHeight: 92 }}
            multiple
            value={placements}
            onChange={(e) => setPlacements(Array.from(e.target.selectedOptions, (o) => o.value))}
          >
            {placementOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
          <select
            style={{ padding: 8, border: "1px solid #d1d5db", borderRadius: 8, minHeight: 92 }}
            multiple
            value={subPlacements}
            onChange={(e) => setSubPlacements(Array.from(e.target.selectedOptions, (o) => o.value))}
          >
            {subPlacementOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
          <select
            style={{ padding: 8, border: "1px solid #d1d5db", borderRadius: 8, minHeight: 92 }}
            multiple
            value={itemNames}
            onChange={(e) => setItemNames(Array.from(e.target.selectedOptions, (o) => o.value))}
          >
            {itemNameOptions.map((option) => (
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

        

        {dateChartData && (
          <>
            <h3 style={{ margin: "8px 0 8px", color: "#111827" }}>Source/Sink by date</h3>
            <div style={{ height: 320, marginBottom: 18 }}>
              <Line
                key={dateRenderKey}
                redraw
                data={dateChartData}
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

        {levelChartData && (
          <>
            <h3 style={{ margin: "8px 0 8px", color: "#111827" }}>Source/Sink by level</h3>
            <div style={{ height: 320 }}>
              <Line
                key={levelRenderKey}
                redraw
                data={levelChartData}
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

        {sourceWhereMainChartData && (
          <>
            <h3 style={{ margin: "8px 0 8px", color: "#111827" }}>Source by Placement</h3>
            <div style={{ height: 340, maxWidth: 760, margin: "0 auto 18px" }}>
              <Doughnut
                key={sourceWhereMainRenderKey}
                redraw
                data={sourceWhereMainChartData}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  plugins: { legend: { position: "right" } }
                }}
              />
            </div>
          </>
        )}

        {sinkWhereMainChartData && (
          <>
            <h3 style={{ margin: "8px 0 8px", color: "#111827" }}>Sink by Placement</h3>
            <div style={{ height: 340, maxWidth: 760, margin: "0 auto 18px" }}>
              <Doughnut
                key={sinkWhereMainRenderKey}
                redraw
                data={sinkWhereMainChartData}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  plugins: { legend: { position: "right" } }
                }}
              />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
