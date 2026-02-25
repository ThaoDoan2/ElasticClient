import axios from "axios";

export const toInputDate = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

export const getDateOffset = (days) => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return toInputDate(d);
};

export const normalizeUnique = (values) =>
  Array.from(new Set((Array.isArray(values) ? values : []).map((v) => String(v).trim()).filter(Boolean)));

export const getParamValue = (selectedValues, allOptions) => {
  const options = normalizeUnique(allOptions);
  const selected = normalizeUnique(selectedValues).filter((v) => options.includes(v));
  if (!options.length) return "";
  if (!selected.length) return "";
  if (selected.length === options.length) return "";
  return selected.join(",");
};

export const getSelectedValues = (selectedValues, allOptions) => {
  const options = normalizeUnique(allOptions);
  const selected = normalizeUnique(selectedValues).filter((v) => options.includes(v));
  if (!options.length) return [];
  if (!selected.length) return [];
  if (selected.length === options.length) return [];
  return selected;
};

export const mapToStringOptions = (payload, keyCandidates = []) => {
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

export async function fetchFirstOptionList(apiBase, endpoints, keyCandidates) {
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

export const toRows = (payload, keyName = "x") => {
  if (Array.isArray(payload)) return payload;
  if (payload && Array.isArray(payload.data)) return payload.data;
  if (payload && typeof payload === "object") {
    return Object.entries(payload).map(([key, value]) =>
      value && typeof value === "object"
        ? { [keyName]: key, ...value }
        : { [keyName]: key, value }
    );
  }
  return [];
};

export const pickMetric = (row, keys) => {
  for (const key of keys) {
    const raw = row?.[key];
    const value = Number(raw);
    if (Number.isFinite(value)) return value;
  }
  return 0;
};

