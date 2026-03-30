import { useState, useEffect } from "react";

// Returns the Monday of whatever week contains `date`
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
  const [currentDate, setCurrentDate] = useState(today);
  const [data, setData] = useState({ eth: [], uzh: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [hiddenMensas, setHiddenMensas] = useState(new Set());

  const weekDates = getWeekDates(currentDate);

  useEffect(() => {
    setLoading(true);
    setError(null);
    fetch(`/api/all?date=${currentDate}`)
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false); })
      .catch(e => { setError(e.message); setLoading(false); });
  }, [currentDate]);

  const allMensas = [
    ...data.eth.map(m => ({ ...m, source: "ETH" })),
    ...data.uzh.map(m => ({ ...m, source: "UZH" })),
  ];

  const visibleMensas = allMensas.filter(m => !hiddenMensas.has(m.name));

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
    toggleMensa, loading, error,
    goToPrevWeek, goToNextWeek, goToToday,
  };
}