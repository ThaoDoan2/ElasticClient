import { useEffect, useState } from "react";
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

const PRODUCT_COLORS = [
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

const getProductColor = (productId) => {
  let hash = 0;
  for (let i = 0; i < productId.length; i += 1) {
    hash = (hash << 5) - hash + productId.charCodeAt(i);
    hash |= 0;
  }
  const index = Math.abs(hash) % PRODUCT_COLORS.length;
  return PRODUCT_COLORS[index];
};

export default function InAppDashboard() {
  const [fromDate, setFrom] = useState("2026-01-29");
  const [toDate, setTo] = useState("2026-02-05");
  const [country, setCountry] = useState("");
  const [version, setVersion] = useState("");
  const [platform, setPlatform] = useState("");
  const [platformOptions, setPlatformOptions] = useState([]);
  const [products, setProducts] = useState([]);
  const [compactChartData, setCompactChartData] = useState(null);
  const [compactChartMaxY, setCompactChartMaxY] = useState(10);
  const [compactChartRenderKey, setCompactChartRenderKey] = useState(0);
  const [revenueChartData, setRevenueChartData] = useState(null);
  const [revenueChartMaxY, setRevenueChartMaxY] = useState(10);
  const [revenueChartRenderKey, setRevenueChartRenderKey] = useState(0);
  const [revenueRatioChartData, setRevenueRatioChartData] = useState(null);
  const [revenueRatioChartRenderKey, setRevenueRatioChartRenderKey] = useState(0);
  const [placementRatioChartData, setPlacementRatioChartData] = useState(null);
  const [placementRatioChartRenderKey, setPlacementRatioChartRenderKey] = useState(0);
  const [error, setError] = useState("");

  const toApiDate = (value) => {
    // Keep browser ISO format (YYYY-MM-DD) to avoid backend parse issues.
    return value;
  };

  useEffect(() => {
    const loadPlatforms = async () => {
      try {
        const apiBase = process.env.REACT_APP_API_BASE_URL || "";
        const res = await axios.get(`${apiBase}/api/iap/platforms`);
        const raw = Array.isArray(res.data) ? res.data : [];
        const options = raw
          .map((item) => {
            if (typeof item === "string") return item.trim();
            if (item && typeof item === "object") {
              return String(item.platform ?? item.name ?? item.value ?? "").trim();
            }
            return "";
          })
          .filter(Boolean);
        setPlatformOptions(Array.from(new Set(options)));
      } catch (err) {
        console.error("Failed to load platforms", err);
        setPlatformOptions([]);
      }
    };

    loadPlatforms();
  }, []);

  const buildStackedChart = (rows, metricKeys) => {
    const data = Array.isArray(rows) ? rows : [];
    const aggregatedByDate = new Map();

    data.forEach((row) => {
      const date = row?.date ? String(row.date).trim() : "";
      if (!date) return;
      if (!aggregatedByDate.has(date)) aggregatedByDate.set(date, {});
      const merged = aggregatedByDate.get(date);

      if (row?.products && typeof row.products === "object") {
        Object.entries(row.products).forEach(([productId, rawValue]) => {
          const value = Number(rawValue);
          const safeValue = Number.isFinite(value) && value >= 0 ? value : 0;
          merged[productId] = (merged[productId] || 0) + safeValue;
        });
        return;
      }

      const productId = row?.productId ? String(row.productId).trim() : "";
      if (!productId) return;

      const rawValue = metricKeys
        .map((key) => row?.[key])
        .find((value) => value !== undefined && value !== null);
      const metricValue = Number(rawValue ?? 0);
      if (!Number.isFinite(metricValue) || metricValue < 0) return;
      merged[productId] = (merged[productId] || 0) + metricValue;
    });

    const points = Array.from(aggregatedByDate.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, productsMap]) => ({ date, products: productsMap }));
    if (!points.length) return null;

    const labels = points.map((d) => d.date);
    const productSet = new Set();
    points.forEach((d) => {
      Object.keys(d.products).forEach((p) => productSet.add(p));
    });

    const datasets = Array.from(productSet).map((p) => ({
      label: p,
      data: points.map((d) => {
        const value = Number(d.products[p]);
        return Number.isFinite(value) && value >= 0 ? value : 0;
      }),
      stack: "stack1",
      backgroundColor: `${getProductColor(p)}cc`,
      borderColor: getProductColor(p),
      borderWidth: 1,
      borderRadius: 4
    }));

    const stackedTotals = points.map((d) =>
      Object.values(d.products).reduce((sum, n) => {
        const value = Number(n);
        return sum + (Number.isFinite(value) && value >= 0 ? value : 0);
      }, 0)
    );
    const maxStack = Math.max(0, ...stackedTotals);
    const maxY = maxStack === 0 ? 10 : Math.ceil(maxStack * 1.15);

    return { data: { labels, datasets }, maxY };
  };

  const buildRevenueRatioChart = (stackedChart) => {
    if (!stackedChart?.data?.datasets?.length) return null;

    const totals = stackedChart.data.datasets
      .map((dataset) => {
        const total = (Array.isArray(dataset.data) ? dataset.data : []).reduce((sum, n) => {
          const value = Number(n);
          return sum + (Number.isFinite(value) && value >= 0 ? value : 0);
        }, 0);
        return {
          productId: dataset.label,
          total,
          color: getProductColor(String(dataset.label || "Unknown"))
        };
      })
      .filter((item) => item.total > 0)
      .sort((a, b) => b.total - a.total);

    if (!totals.length) return null;

    return {
      labels: totals.map((item) => item.productId),
      datasets: [
        {
          label: "Revenue Ratio",
          data: totals.map((item) => item.total),
          backgroundColor: totals.map((item) => `${item.color}cc`),
          borderColor: totals.map((item) => item.color),
          borderWidth: 1
        }
      ]
    };
  };

  const buildPlacementRatioChart = (rows) => {
    const list = Array.isArray(rows)
      ? rows
      : rows && typeof rows === "object"
        ? Object.entries(rows).map(([placement, value]) => ({ placement, value }))
        : [];

    const totals = list
      .map((row) => {
        const placement = String(
          row?.placement ?? row?.placementId ?? row?.name ?? row?.key ?? ""
        ).trim();
        const value = Number(
          row?.ratio ??
          row?.share ??
          row?.percentage ??
          row?.value ??
          row?.revenue ??
          row?.totalRevenue ??
          0
        );
        return { placement, value };
      })
      .filter((item) => item.placement && Number.isFinite(item.value) && item.value > 0)
      .sort((a, b) => b.value - a.value);

    if (!totals.length) return null;

    return {
      labels: totals.map((item) => item.placement),
      datasets: [
        {
          label: "Placement Ratio",
          data: totals.map((item) => item.value),
          backgroundColor: totals.map((item) => `${getProductColor(item.placement)}cc`),
          borderColor: totals.map((item) => getProductColor(item.placement)),
          borderWidth: 1
        }
      ]
    };
  };

  const loadData = async () => {
    const params = {
      fromDate: toApiDate(fromDate),
      toDate: toApiDate(toDate)
    };
    if (country) params.country = country;
    if (version) params.gameVersion = version;
    if (platform) params.platform = platform;
    if (products.length) params.products = products;

    try {
      setError("");
      const apiBase = process.env.REACT_APP_API_BASE_URL || "";
      const [compactRes, revenueRes, placementRatioRes] = await Promise.all([
        axios.get(`${apiBase}/api/iap/chart/compact`, { params }),
        axios.get(`${apiBase}/api/iap/revenue-by-date`, { params }),
        axios.get(`${apiBase}/api/iap/ratio/placement`, { params })
      ]);

      const compact = buildStackedChart(compactRes.data, [
        "count",
        "quantity",
        "purchases",
        "total"
      ]);
      const revenue = buildStackedChart(revenueRes.data, [
        "revenue",
        "amount",
        "totalRevenue"
      ]);
      const placementRatio = buildPlacementRatioChart(placementRatioRes.data);

      if (!compact && !revenue && !placementRatio) {
        setError("No chart data for selected filters.");
      }

      if (compact) {
        setCompactChartMaxY(compact.maxY);
        setCompactChartData(compact.data);
        setCompactChartRenderKey((prev) => prev + 1);
      } else {
        setCompactChartMaxY(10);
        setCompactChartData(null);
      }

      if (revenue) {
        setRevenueChartMaxY(revenue.maxY);
        setRevenueChartData(revenue.data);
        setRevenueChartRenderKey((prev) => prev + 1);

        const ratio = buildRevenueRatioChart(revenue);
        setRevenueRatioChartData(ratio);
        setRevenueRatioChartRenderKey((prev) => prev + 1);
      } else {
        setRevenueChartMaxY(10);
        setRevenueChartData(null);
        setRevenueRatioChartData(null);
      }

      if (placementRatio) {
        setPlacementRatioChartData(placementRatio);
        setPlacementRatioChartRenderKey((prev) => prev + 1);
      } else {
        setPlacementRatioChartData(null);
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
        console.error(err);
        setError("Failed to load dashboard data.");
      }
      setCompactChartMaxY(10);
      setCompactChartData(null);
      setRevenueChartMaxY(10);
      setRevenueChartData(null);
      setRevenueRatioChartData(null);
      setPlacementRatioChartData(null);
    }
  };

  return (
    <div style={{ padding: 24, background: "#f3f4f6", minHeight: "100vh" }}>
      <div style={{ maxWidth: 1240, margin: "0 auto", background: "#ffffff", borderRadius: 14, padding: 20, boxShadow: "0 10px 28px rgba(15, 23, 42, 0.08)" }}>
        <h2 style={{ margin: "0 0 16px", color: "#0f172a" }}>InApp Analytics</h2>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 10, marginBottom: 14 }}>
          <input style={{ padding: "10px 12px", border: "1px solid #d1d5db", borderRadius: 8 }} type="date" value={fromDate} onChange={e => setFrom(e.target.value)} />
          <input style={{ padding: "10px 12px", border: "1px solid #d1d5db", borderRadius: 8 }} type="date" value={toDate} onChange={e => setTo(e.target.value)} />

          <input style={{ padding: "10px 12px", border: "1px solid #d1d5db", borderRadius: 8 }} placeholder="Country" value={country} onChange={e => setCountry(e.target.value)} />
          <input style={{ padding: "10px 12px", border: "1px solid #d1d5db", borderRadius: 8 }} placeholder="Version" value={version} onChange={e => setVersion(e.target.value)} />
          <select
            style={{ padding: "10px 12px", border: "1px solid #d1d5db", borderRadius: 8 }}
            value={platform}
            onChange={(e) => setPlatform(e.target.value)}
          >
            <option value="">All Platforms</option>
            {platformOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>

          <select style={{ padding: 8, border: "1px solid #d1d5db", borderRadius: 8, minHeight: 92 }} multiple onChange={e =>
          setProducts(Array.from(e.target.selectedOptions, o => o.value))
        }>
          <option value="StarterPack">StarterPack</option>
          <option value="MysteryPack">MysteryPack</option>
          <option value="BigBundle">BigBundle</option>
          <option value="NoAds">NoAds</option>
        </select>

          <button style={{ background: "#1d4ed8", color: "white", border: 0, borderRadius: 8, fontWeight: 600, cursor: "pointer" }} onClick={loadData}>Search</button>
        </div>

        {error && <div style={{ color: "#b00020", marginBottom: 10 }}>{error}</div>}

        {compactChartData && (
          <>
            <h3 style={{ margin: "8px 0 8px", color: "#111827" }}>Purchases Per Day (by Product)</h3>
            <div style={{ height: 320, marginBottom: 18 }}>
              <Bar
                key={compactChartRenderKey}
                redraw
                data={compactChartData}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  plugins: { legend: { position: "right" } },
                  scales: {
                    x: { stacked: true },
                    y: { stacked: true, beginAtZero: true, suggestedMax: compactChartMaxY }
                  }
                }}
              />
            </div>
          </>
        )}

        {revenueChartData && (
          <>
            <h3 style={{ margin: "8px 0 8px", color: "#111827" }}>Revenue Per Day (by Product)</h3>
            <div style={{ height: 320, marginBottom: 18 }}>
              <Bar
                key={revenueChartRenderKey}
                redraw
                data={revenueChartData}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  plugins: { legend: { position: "right" } },
                  scales: {
                    x: { stacked: true },
                    y: { stacked: true, beginAtZero: true, suggestedMax: revenueChartMaxY }
                  }
                }}
              />
            </div>
          </>
        )}

        {revenueRatioChartData && (
          <>
            <h3 style={{ margin: "8px 0 8px", color: "#111827" }}>Revenue Ratio by Product</h3>
            <div style={{ height: 340, maxWidth: 760, margin: "0 auto" }}>
              <Doughnut
                key={revenueRatioChartRenderKey}
                redraw
                data={revenueRatioChartData}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  plugins: {
                    legend: { position: "right" },
                    tooltip: {
                      callbacks: {
                        label: (context) => {
                          const value = Number(context.parsed) || 0;
                          const dataset = context.dataset?.data || [];
                          const total = dataset.reduce((sum, n) => sum + (Number(n) || 0), 0);
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

        {placementRatioChartData && (
          <>
            <h3 style={{ margin: "8px 0 8px", color: "#111827" }}>Revenue Ratio by Placement</h3>
            <div style={{ height: 340, maxWidth: 760, margin: "0 auto" }}>
              <Doughnut
                key={placementRatioChartRenderKey}
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
                          const dataset = context.dataset?.data || [];
                          const total = dataset.reduce((sum, n) => sum + (Number(n) || 0), 0);
                          const ratio = total > 0 ? (value / total) * 100 : 0;
                          return `${context.label}: ${ratio.toFixed(1)}%`;
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
