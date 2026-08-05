import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";

/* Global building selection: "portfolio" or a building id. Persisted per user. */

const KEY = "obelix_selected_building";
const BuildingContext = createContext(null);

export const BuildingProvider = ({ children }) => {
  const { data: buildings = [], isLoading } = useQuery({
    queryKey: ["buildings"],
    queryFn: () => api.get("/buildings").then((r) => r.data),
  });

  const [selectedId, setSelectedIdRaw] = useState(() => localStorage.getItem(KEY) || "portfolio");

  // validate persisted selection once buildings load
  useEffect(() => {
    if (isLoading) return;
    if (selectedId !== "portfolio" && !buildings.some((b) => b.id === selectedId)) {
      const next = buildings.length === 1 ? buildings[0].id : "portfolio";
      setSelectedIdRaw(next);
      localStorage.setItem(KEY, next);
    } else if (selectedId === "portfolio" && buildings.length === 1) {
      // single-building portfolios jump straight to the building
      setSelectedIdRaw(buildings[0].id);
      localStorage.setItem(KEY, buildings[0].id);
    }
  }, [isLoading, buildings, selectedId]);

  const setSelectedId = useCallback((id) => {
    setSelectedIdRaw(id);
    localStorage.setItem(KEY, id);
    const recents = JSON.parse(localStorage.getItem("obelix_recent_buildings") || "[]").filter((x) => x !== id);
    if (id !== "portfolio") localStorage.setItem("obelix_recent_buildings", JSON.stringify([id, ...recents].slice(0, 5)));
  }, []);

  const value = useMemo(() => {
    const selected = selectedId === "portfolio" ? null : buildings.find((b) => b.id === selectedId) || null;
    return {
      buildings,
      loading: isLoading,
      selectedId,
      setSelectedId,
      selected,
      isPortfolio: selectedId === "portfolio",
      hasBuildings: buildings.length > 0,
      recentIds: JSON.parse(localStorage.getItem("obelix_recent_buildings") || "[]"),
    };
  }, [buildings, isLoading, selectedId, setSelectedId]);

  return <BuildingContext.Provider value={value}>{children}</BuildingContext.Provider>;
};

export const useBuilding = () => {
  const ctx = useContext(BuildingContext);
  if (!ctx) throw new Error("useBuilding must be used inside BuildingProvider");
  return ctx;
};
