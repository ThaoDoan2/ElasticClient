import { useEffect, useRef, useState } from "react";
import axios from "axios";
import { Bar, Doughnut } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  ArcElement,
  Tooltip,
  Legend
} from "chart.js";

ChartJS.register(CategoryScale, LinearScale, BarElement, ArcElement, Tooltip, Legend);

const SERIES_COLORS = [
  "#2563eb",
  "#dc2626",
  "#16a34a",
  "#d97706",
  "#7c3aed",
  "#0891b2",
  "#be123c",
  "#4f46e5",
  "#059669",
  "#ca8a04",
  "#0f766e",
  "#b91c1c"
];

const getSeriesColor = (value) => {
  const input = String(value || "unknown");
  let hash = 0;
  for (let i = 0; i < input.length; i += 1) {
    hash = (hash << 5) - hash + input.charCodeAt(i);
    hash |= 0;
  }
  const index = Math.abs(hash) % SERIES_COLORS.length;
  return SERIES_COLORS[index];
};

const toApiDate = (value) => {
  return value;
};

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

const getParamValue = (selectedValues, allOptions) => {
  const options = normalizeUnique(allOptions);
  const selected = normalizeUnique(selectedValues).filter((v) => options.includes(v));
  if (!options.length) return "";
  if (!selected.length) return "";
  if (selected.length === options.length) return "";
  return selected.join(",");
};

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

const buildStackedChart = (rows, bucketKeyCandidates, xSorter = (a, b) => a.localeCompare(b)) => {
  const list = Array.isArray(rows) ? rows : [];
  const bucketByXAxis = new Map();

  list.forEach((row) => {
    const xLabel = String(row?.date ?? row?.level ?? row?.x ?? "").trim();
    if (!xLabel) return;

    if (!bucketByXAxis.has(xLabel)) bucketByXAxis.set(xLabel, {});
    const merged = bucketByXAxis.get(xLabel);

    if (row?.placements && typeof row.placements === "object") {
      Object.entries(row.placements).forEach(([placement, rawValue]) => {
        const amount = Number(rawValue);
        const safe = Number.isFinite(amount) && amount >= 0 ? amount : 0;
        merged[placement] = (merged[placement] || 0) + safe;
      });
      return;
    }

    const placement = String(
      row?.placement ?? row?.placementId ?? row?.adPlacement ?? row?.group ?? ""
    ).trim();
    if (!placement) return;

    const rawAmount = bucketKeyCandidates
      .map((key) => row?.[key])
      .find((value) => value !== undefined && value !== null);
    const amount = Number(rawAmount ?? 0);
    if (!Number.isFinite(amount) || amount < 0) return;
    merged[placement] = (merged[placement] || 0) + amount;
  });

  const points = Array.from(bucketByXAxis.entries())
    .sort(([a], [b]) => xSorter(a, b))
    .map(([x, placements]) => ({ x, placements }));
  if (!points.length) return null;

  const labels = points.map((p) => p.x);
  const placementSet = new Set();
  points.forEach((p) => {
    Object.keys(p.placements).forEach((placement) => placementSet.add(placement));
  });

  const datasets = Array.from(placementSet).map((placement) => ({
    label: placement,
    data: points.map((p) => {
      const amount = Number(p.placements[placement]);
      return Number.isFinite(amount) && amount >= 0 ? amount : 0;
    }),
    stack: "stack1",
    backgroundColor: `${getSeriesColor(placement)}cc`,
    borderColor: getSeriesColor(placement),
    borderWidth: 1,
    borderRadius: 4
  }));

  const totals = points.map((p) =>
    Object.values(p.placements).reduce((sum, n) => {
      const value = Number(n);
      return sum + (Number.isFinite(value) && value >= 0 ? value : 0);
    }, 0)
  );
  const max = Math.max(0, ...totals);
  const maxY = max === 0 ? 10 : Math.ceil(max * 1.15);

  return { data: { labels, datasets }, maxY };
};

const buildStackedByLevelChart = (rows, metricKeys) => {
  const compareLevelAsc = (a, b) => {
    const aNum = Number(a);
    const bNum = Number(b);
    const aIsNum = Number.isFinite(aNum);
    const bIsNum = Number.isFinite(bNum);
    if (aIsNum && bIsNum) return aNum - bNum;
    if (aIsNum) return -1;
    if (bIsNum) return 1;
    return String(a).localeCompare(String(b));
  };

  const list = Array.isArray(rows) ? rows : [];
  const normalized = list.map((row) => {
    if (row && typeof row === "object" && !Array.isArray(row)) return row;
    return {};
  });
  return buildStackedChart(
    normalized.map((row) => ({ ...row, x: row?.level ?? row?.stage ?? row?.tier })),
    metricKeys,
    compareLevelAsc
  );
};

const buildPlacementRatioChart = (stackedChart) => {
  if (!stackedChart?.data?.datasets?.length) return null;

  const totals = stackedChart.data.datasets
    .map((dataset) => {
      const total = (Array.isArray(dataset.data) ? dataset.data : []).reduce((sum, n) => {
        const value = Number(n);
        return sum + (Number.isFinite(value) && value >= 0 ? value : 0);
      }, 0);
      return {
        placement: String(dataset.label || "Unknown"),
        total
      };
    })
    .filter((item) => item.total > 0)
    .sort((a, b) => b.total - a.total);

  if (!totals.length) return null;

  return {
    labels: totals.map((item) => item.placement),
    datasets: [
      {
        label: "Rewarded Amount Ratio",
        data: totals.map((item) => item.total),
        backgroundColor: totals.map((item) => `${getSeriesColor(item.placement)}cc`),
        borderColor: totals.map((item) => getSeriesColor(item.placement)),
        borderWidth: 1
      }
    ]
  };
};

async function fetchLevelAmount(apiBase, params) {
  const primary = `${apiBase}/api/rewarded-ads/amount-by-level-placement`;
  const fallback = `${apiBase}/api/rewarded-ads/amount-by-level`;

  try {
    return await axios.get(primary, { params });
  } catch (err) {
    if (axios.isAxiosError(err) && err.response?.status === 404) {
      return axios.get(fallback, { params });
    }
    throw err;
  }
}

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

export default function RewardedAdsDashboard() {
  const [fromDate, setFromDate] = useState(() => getDateOffset(-7));
  const [toDate, setToDate] = useState(() => getDateOffset(0));
  const [minLevel, setMinLevel] = useState("");
  const [maxLevel, setMaxLevel] = useState("");
  const [countries, setCountries] = useState([]);
  const [platforms, setPlatforms] = useState([]);
  const [versions, setVersions] = useState([]);
  const [placements, setPlacements] = useState([]);
  const [countryOptions, setCountryOptions] = useState([]);
  const [platformOptions, setPlatformOptions] = useState([]);
  const [versionOptions, setVersionOptions] = useState([]);
  const [placementOptions, setPlacementOptions] = useState([]);
  const [datePlacementChartData, setDatePlacementChartData] = useState(null);
  const [datePlacementChartMaxY, setDatePlacementChartMaxY] = useState(10);
  const [datePlacementRenderKey, setDatePlacementRenderKey] = useState(0);
  const [levelPlacementChartData, setLevelPlacementChartData] = useState(null);
  const [levelPlacementChartMaxY, setLevelPlacementChartMaxY] = useState(10);
  const [levelPlacementRenderKey, setLevelPlacementRenderKey] = useState(0);
  const [placementRatioChartData, setPlacementRatioChartData] = useState(null);
  const [placementRatioRenderKey, setPlacementRatioRenderKey] = useState(0);
  const [error, setError] = useState("");
  const initialLoadDoneRef = useRef(false);

  useEffect(() => {
    const loadFilterOptions = async () => {
      const apiBase = process.env.REACT_APP_API_BASE_URL || "";
      const [countryList, platformList, versionList, placementList] = await Promise.all([
        fetchFirstOptionList(apiBase, ["/api/rewarded-ads/countries", "/api/iap/countries"], [
          "country",
          "code",
          "name",
          "value"
        ]),
        fetchFirstOptionList(apiBase, ["/api/rewarded-ads/platforms", "/api/iap/platforms"], [
          "platform",
          "name",
          "value"
        ]),
        fetchFirstOptionList(
          apiBase,
          ["/api/rewarded-ads/game-versions", "/api/iap/versions", "/api/iap/game-versions"],
          ["version", "gameVersion", "name", "value"]
        ),
        fetchFirstOptionList(
          apiBase,
          ["/api/rewarded-ads/placements", "/api/rewarded-ads/ratio/placement"],
          ["placement", "placementId", "name", "key", "value"]
        )
      ]);

      setCountryOptions(countryList);
      setPlatformOptions(platformList);
      setVersionOptions(versionList);
      setPlacementOptions(placementList);
      setCountries(countryList);
      setPlatforms(platformList);
      setVersions(versionList);
      setPlacements(placementList);
    };

    loadFilterOptions();
  }, []);

  const loadData = async () => {
    try {
      setError("");
      const apiBase = process.env.REACT_APP_API_BASE_URL || "";
      const params = {
        fromDate: toApiDate(fromDate),
        toDate: toApiDate(toDate)
      };
      if (minLevel !== "") params.minLevel = Number(minLevel);
      if (maxLevel !== "") params.maxLevel = Number(maxLevel);
      const countryParam = getParamValue(countries, countryOptions);
      const platformParam = getParamValue(platforms, platformOptions);
      const versionParam = getParamValue(versions, versionOptions);
      const placementParam = getParamValue(placements, placementOptions);
      if (countryParam) params.countryCode = countryParam;
      if (platformParam) params.platform = platformParam;
      if (versionParam) params.gameVersion = versionParam;
      if (placementParam) params.placements = placementParam;

      const [datePlacementRes, levelRes] = await Promise.all([
        axios.get(`${apiBase}/api/rewarded-ads/amount-by-date-placement`, { params }),
        fetchLevelAmount(apiBase, params)
      ]);

      const datePlacement = buildStackedChart(datePlacementRes.data, [
        "amount",
        "totalAmount",
        "count",
        "value"
      ]);
      const levelPlacement = buildStackedByLevelChart(levelRes.data, [
        "amount",
        "totalAmount",
        "count",
        "value"
      ]);

      if (!datePlacement && !levelPlacement) {
        setError("No rewarded ads data for selected filters.");
      }

      if (datePlacement) {
        setDatePlacementChartData(datePlacement.data);
        setDatePlacementChartMaxY(datePlacement.maxY);
        setDatePlacementRenderKey((prev) => prev + 1);

        const placementRatio = buildPlacementRatioChart(datePlacement);
        setPlacementRatioChartData(placementRatio);
        setPlacementRatioRenderKey((prev) => prev + 1);
        setPlacementOptions((prev) => {
          const existing = normalizeUnique(prev);
          const fromChart = normalizeUnique(placementRatio?.labels);
          const merged = normalizeUnique([...existing, ...fromChart]);

          setPlacements((prevSelected) => {
            const selected = normalizeUnique(prevSelected);
            const wasAllSelected =
              existing.length > 0 &&
              selected.length === existing.length &&
              existing.every((value) => selected.includes(value));
            if (wasAllSelected || selected.length === 0) return merged;
            return selected.filter((value) => merged.includes(value));
          });

          return merged;
        });
      } else {
        setDatePlacementChartData(null);
        setDatePlacementChartMaxY(10);
        setPlacementRatioChartData(null);
      }

      if (levelPlacement) {
        setLevelPlacementChartData(levelPlacement.data);
        setLevelPlacementChartMaxY(levelPlacement.maxY);
        setLevelPlacementRenderKey((prev) => prev + 1);
      } else {
        setLevelPlacementChartData(null);
        setLevelPlacementChartMaxY(10);
      }
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
        setError("Failed to load rewarded ads dashboard data.");
      }
      setDatePlacementChartData(null);
      setDatePlacementChartMaxY(10);
      setPlacementRatioChartData(null);
      setLevelPlacementChartData(null);
      setLevelPlacementChartMaxY(10);
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
        <h2 style={{ margin: "0 0 16px", color: "#0f172a" }}>Rewarded Ads Analytics</h2>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 10, marginBottom: 14 }}>
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
            {countryOptions.map((option) => (
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
            {platformOptions.map((option) => (
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
            {versionOptions.map((option) => (
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

        {datePlacementChartData && (
          <>
            <h3 style={{ margin: "8px 0 8px", color: "#111827" }}>Rewarded Amount by Date (Group by Placement)</h3>
            <div style={{ height: 320, marginBottom: 18 }}>
              <Bar
                key={datePlacementRenderKey}
                redraw
                data={datePlacementChartData}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  plugins: { legend: { position: "right" } },
                  scales: {
                    x: { stacked: true },
                    y: { stacked: true, beginAtZero: true, suggestedMax: datePlacementChartMaxY }
                  }
                }}
              />
            </div>
          </>
        )}

        {levelPlacementChartData && (
          <>
            <h3 style={{ margin: "8px 0 8px", color: "#111827" }}>Rewarded Amount by Level (Group by Placement)</h3>
            <div style={{ height: 320 }}>
              <Bar
                key={levelPlacementRenderKey}
                redraw
                data={levelPlacementChartData}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  plugins: { legend: { position: "right" } },
                  scales: {
                    x: { stacked: true },
                    y: { stacked: true, beginAtZero: true, suggestedMax: levelPlacementChartMaxY }
                  }
                }}
              />
            </div>
          </>
        )}

        {placementRatioChartData && (
          <>
            <h3 style={{ margin: "8px 0 8px", color: "#111827" }}>Ratio Rewarded Amount by Placement</h3>
            <div style={{ height: 340, maxWidth: 760, margin: "0 auto" }}>
              <Doughnut
                key={placementRatioRenderKey}
                redraw
                data={placementRatioChartData}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  plugins: {
                    legend: { position: "right" },
                    tooltip: {
                      callbacks: {
                        label: (context) => {
                          const value = Number(context.parsed) || 0;
                          const total = (context.dataset?.data || []).reduce(
                            (sum, n) => sum + (Number(n) || 0),
                            0
                          );
                          const ratio = total > 0 ? (value / total) * 100 : 0;
                          return `${context.label}: ${value.toFixed(2)} (${ratio.toFixed(1)}%)`;
                        }
                      }
                    }
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
