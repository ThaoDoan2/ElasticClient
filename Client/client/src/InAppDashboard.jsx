import { useState } from "react";
import axios from "axios";
import { Bar } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Tooltip,
  Legend
} from "chart.js";

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend);

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
  const [products, setProducts] = useState([]);
  const [chartData, setChartData] = useState(null);
  const [chartMaxY, setChartMaxY] = useState(10);
  const [error, setError] = useState("");

  const toApiDate = (value) => {
    // Browser date input uses YYYY-MM-DD; API may expect MM/DD/YYYY.
    if (!value || !value.includes("-")) return value;
    const [yyyy, mm, dd] = value.split("-");
    if (!yyyy || !mm || !dd) return value;
    return `${mm}/${dd}/${yyyy}`;
  };

  const loadData = async () => {
    const params = {
      fromDate: toApiDate(fromDate),
      toDate: toApiDate(toDate),
      country: country || null,
      gameVersion: version || null,
      platform: platform || null,
      products: products.length ? products : null
    };

    try {
      setError("");
      const apiBase = process.env.REACT_APP_API_BASE_URL || "";
      const res = await axios.get(`${apiBase}/api/iap/chart/compact`, { params });
      const data = Array.isArray(res.data) ? res.data : [];

      const aggregatedByDate = new Map();
      data.forEach((row) => {
        const date = row?.date ? String(row.date).trim() : "";
        if (!date) return;

        const productMap = row?.products && typeof row.products === "object" ? row.products : {};
        if (!aggregatedByDate.has(date)) aggregatedByDate.set(date, {});

        const merged = aggregatedByDate.get(date);
        Object.entries(productMap).forEach(([productId, rawValue]) => {
          const value = Number(rawValue);
          const safeValue = Number.isFinite(value) && value >= 0 ? value : 0;
          merged[productId] = (merged[productId] || 0) + safeValue;
        });
      });

      const points = Array.from(aggregatedByDate.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([date, productsMap]) => ({ date, products: productsMap }));

      if (!points.length) {
        setError("No chart data for selected filters.");
        setChartMaxY(10);
        setChartData(null);
        return;
      }

      const labels = points.map(d => d.date);

      const productSet = new Set();
      points.forEach(d => {
        Object.keys(d.products).forEach(p => productSet.add(p));
      });

      const datasets = Array.from(productSet).map(p => ({
        label: p,
        data: points.map(d => {
          const value = Number(d.products[p]);
          return Number.isFinite(value) && value >= 0 ? value : 0;
        }),
        stack: "stack1",
        backgroundColor: `${getProductColor(p)}cc`,
        borderColor: getProductColor(p),
        borderWidth: 1,
        borderRadius: 4
      }));

      const stackedTotals = points.map((d) => {
        return Object.values(d.products).reduce((sum, n) => {
          const value = Number(n);
          return sum + (Number.isFinite(value) && value >= 0 ? value : 0);
        }, 0);
      });
      const maxStack = Math.max(0, ...stackedTotals);
      const nextMaxY = maxStack === 0 ? 10 : Math.ceil(maxStack * 1.15);

      setChartMaxY(nextMaxY);
      setChartData({ labels, datasets });
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
      setChartMaxY(10);
      setChartData(null);
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
          <input style={{ padding: "10px 12px", border: "1px solid #d1d5db", borderRadius: 8 }} placeholder="Platform" value={platform} onChange={e => setPlatform(e.target.value)} />

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

        {chartData && (
          <Bar data={chartData} options={{
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              legend: {
                position: "right",
                labels: {
                  color: "#1f2937",
                  usePointStyle: true,
                  boxWidth: 10,
                  boxHeight: 10,
                  padding: 12
                }
              }
            },
            scales: {
              x: {
                stacked: true,
                ticks: { color: "#374151", autoSkip: true, maxTicksLimit: 12 },
                grid: { color: "#e5e7eb" }
              },
              y: {
                stacked: true,
                beginAtZero: true,
                suggestedMax: chartMaxY,
                grace: "8%",
                ticks: { color: "#374151" },
                grid: { color: "#e5e7eb" }
              }
            }
          }} height={420} />
        )}
      </div>
    </div>
  );
}
