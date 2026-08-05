import { useOutletContext } from "react-router-dom";
import { Building2 } from "lucide-react";
import { useBuilding } from "@/context/BuildingContext";
import { EmptyState, GoldButton } from "./kit";
import { PageLoading } from "./ui";

/* Wrap building-scoped pages: prompts to add or select a building when needed. */
export const RequireBuildingSelected = ({ children, pageName = "This page" }) => {
  const { selected, isPortfolio, hasBuildings, loading } = useBuilding();
  const { openAddBuilding } = useOutletContext();

  if (loading) return <PageLoading />;
  if (!hasBuildings) {
    return (
      <EmptyState
        icon={Building2}
        title="Connect your first property."
        body={`${pageName} is scoped to a building. Add your first property to begin.`}
      >
        <GoldButton onClick={openAddBuilding} className="px-6 py-2.5">Add a building</GoldButton>
      </EmptyState>
    );
  }
  if (isPortfolio || !selected) {
    return (
      <EmptyState
        icon={Building2}
        title="Select a building."
        body={`${pageName} shows one building at a time. Pick a building from the selector in the top bar.`}
      />
    );
  }
  return children;
};
