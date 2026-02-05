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

export default function InAppDashboard() {
  const [from, setFrom] = useState("2026-01-29");
  const [to, setTo] = useState("2026-02-05");
  const [country, setCountry] = useState("");
  const [version, setVersion] = useState("");
  const [platform, setPlatform] = useState("");
  const [products, setProducts] = useState([]);
  const [chartData, setChartData] = useState(null);

  const loadData = async () => {
    const params = {
      from, to,
      country: country || null,
      version: version || null,
      platform: platform || null,
      products: products.length ? products : null
    };

    const res = await axios.get("http://localhost:8080/api/analytics/inapp-by-date", { params });
    const data = res.data;

    const labels = data.map(d => d.date);

    const productSet = new Set();
    data.forEach(d => Object.keys(d.products).forEach(p => productSet.add(p)));

    const datasets = Array.from(productSet).map(p => ({
      label: p,
      data: data.map(d => d.products[p] || 0),
      stack: "stack1"
    }));

    setChartData({ labels, datasets });
  };

  return (
    <div style={{ padding: 20 }}>
      <h2>InApp Analytics</h2>

      <div style={{ display: "flex", gap: 10, marginBottom: 10 }}>
        <input type="date" value={from} onChange={e => setFrom(e.target.value)} />
        <input type="date" value={to} onChange={e => setTo(e.target.value)} />

        <input placeholder="Country" value={country} onChange={e => setCountry(e.target.value)} />
        <input placeholder="Version" value={version} onChange={e => setVersion(e.target.value)} />
        <input placeholder="Platform" value={platform} onChange={e => setPlatform(e.target.value)} />

        <select multiple onChange={e =>
          setProducts(Array.from(e.target.selectedOptions, o => o.value))
        }>
          <option value="StarterPack">StarterPack</option>
          <option value="MysteryPack">MysteryPack</option>
          <option value="BigBundle">BigBundle</option>
          <option value="NoAds">NoAds</option>
        </select>

        <button onClick={loadData}>Search</button>
      </div>

      {chartData && (
        <Bar data={chartData} options={{
          responsive: true,
          plugins: { legend: { position: "right" }},
          scales: {
            x: { stacked: true },
            y: { stacked: true, beginAtZero: true }
          }
        }} />
      )}
    </div>
  );
}
