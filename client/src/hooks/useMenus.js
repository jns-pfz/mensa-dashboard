import { useState, useEffect, useMemo } from "react";

function getWeekDates(dateStr) {
  const d = new Date(dateStr);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(d.setDate(diff));
  return Array.from({ length: 5 }, (_, i) => {
    const dd = new Date(monday);
    dd.setDate(monday.getDate() + i);
    return dd.toISOString().split("T")[0];
  });
}

export function useMenus() {
  const today = new Date().toISOString().split("T")[0];
  const [currentDate, setCurrentDate]   = useState(today);
  const [data, setData]                 = useState({ eth: [], uzh: [], meta: {} });
  const [loading, setLoading]           = useState(true);
  const [error, setError]               = useState(null);
  const [hiddenMensas, setHiddenMensas] = useState(new Set());
  const [sortMode, setSortMode]         = useState("default");
  const [uzhEnriched, setUzhEnriched]   = useState(false);

  const weekDates = getWeekDates(currentDate);

  // Main data fetch
  const fetchData = (date) => {
    setLoading(true);
    setError(null);
    fetch(`/api/all?date=${date}`)
      .then(r => r.json())
      .then(d => {
        setData(d);
        setUzhEnriched(d.meta?.uzhEnriched ?? false);
        setLoading(false);
      })
      .catch(e => { setError(e.message); setLoading(false); });
  };

  useEffect(() => { fetchData(currentDate); }, [currentDate]);

  // Poll for enrichment — refetch when nutrition data becomes ready
  useEffect(() => {
    if (uzhEnriched) return;
    const interval = setInterval(async () => {
      try {
        const r = await fetch(`/api/cache-status?date=${currentDate}`);
        const s = await r.json();
        if (s.enriched) {
          setUzhEnriched(true);
          clearInterval(interval);
          fetchData(currentDate); // refetch with full nutrition data
        }
      } catch (e) {}
    }, 20000); // check every 20 seconds
    return () => clearInterval(interval);
  }, [uzhEnriched, currentDate]);

  const allMensas = useMemo(() => [
    ...(data.eth || []).map(m => ({ ...m, source: m.source ?? "ETH" })),
    ...(data.uzh || []).map(m => ({ ...m, source: m.source ?? "UZH" })),
  ], [data]);

  const visibleMensas = useMemo(() =>
    allMensas.filter(m => !hiddenMensas.has(m.name)),
    [allMensas, hiddenMensas]
  );

  // Flat list of today's meals across all visible mensas — for sort view
  const todayMeals = useMemo(() =>
    visibleMensas.flatMap(mensa =>
      (mensa.days?.[today] || []).map(meal => ({
        ...meal,
        mensaName: mensa.name,
        source:    mensa.source,
      }))
    ),
    [visibleMensas, today]
  );

  const sortedTodayMeals = useMemo(() => {
    if (sortMode === "default") return todayMeals;
    return [...todayMeals].sort((a, b) => {
      if (sortMode === "protein") {
        return (b.nutrition?.protein ?? -1) - (a.nutrition?.protein ?? -1);
      }
      if (sortMode === "calories") {
        return (a.nutrition?.calories ?? Infinity) - (b.nutrition?.calories ?? Infinity);
      }
      if (sortMode === "climate") {
        const order = { LOW: 0, MEDIUM: 1, HIGH: 2 };
        return (order[a.climate] ?? 3) - (order[b.climate] ?? 3);
      }
      return 0;
    });
  }, [todayMeals, sortMode]);

  function toggleMensa(name) {
    setHiddenMensas(prev => {
      const next = new Set(prev);
      next.has(name) ? next.delete(name) : next.add(name);
      return next;
    });
  }

  function goToPrevWeek() {
    const d = new Date(currentDate);
    d.setDate(d.getDate() - 7);
    setCurrentDate(d.toISOString().split("T")[0]);
  }
  function goToNextWeek() {
    const d = new Date(currentDate);
    d.setDate(d.getDate() + 7);
    setCurrentDate(d.toISOString().split("T")[0]);
  }
  function goToToday() { setCurrentDate(today); }

  return {
    today, currentDate, weekDates,
    allMensas, visibleMensas, hiddenMensas,
    sortMode, setSortMode,
    todayMeals, sortedTodayMeals,
    uzhEnriched, meta: data.meta ?? {},
    toggleMensa, loading, error,
    goToPrevWeek, goToNextWeek, goToToday,
  };
}