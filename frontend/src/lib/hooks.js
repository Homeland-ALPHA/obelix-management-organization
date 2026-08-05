import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api, apiError } from "@/lib/api";

/* Generic entity data hooks backed by /api/e/{entity}. */

export const useList = (entity, buildingId, opts = {}) =>
  useQuery({
    queryKey: ["e", entity, buildingId || "all"],
    queryFn: () =>
      api
        .get(`/e/${entity}`, { params: buildingId && buildingId !== "portfolio" ? { building_id: buildingId } : {} })
        .then((r) => r.data),
    ...opts,
  });

const invalidate = (qc) => {
  qc.invalidateQueries({ queryKey: ["e"] });
  qc.invalidateQueries({ queryKey: ["overview"] });
  qc.invalidateQueries({ queryKey: ["financials"] });
  qc.invalidateQueries({ queryKey: ["rentroll"] });
  qc.invalidateQueries({ queryKey: ["notifications"] });
  qc.invalidateQueries({ queryKey: ["compliance"] });
};

export const useSave = (entity, { onDone } = {}) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...values }) =>
      (id ? api.patch(`/e/${entity}/${id}`, values) : api.post(`/e/${entity}`, values)).then((r) => r.data),
    onSuccess: (data) => {
      invalidate(qc);
      onDone?.(data);
    },
    onError: (e) => toast.error(apiError(e)),
  });
};

export const useRemove = (entity, { onDone } = {}) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id) => api.delete(`/e/${entity}/${id}`).then((r) => r.data),
    onSuccess: () => {
      invalidate(qc);
      onDone?.();
    },
    onError: (e) => toast.error(apiError(e)),
  });
};

export const useSettings = () =>
  useQuery({ queryKey: ["settings"], queryFn: () => api.get("/settings").then((r) => r.data) });

export const downloadReport = async (kind, buildingId) => {
  try {
    const res = await api.get(`/reports/${kind}`, {
      params: { building_id: buildingId || "portfolio" },
      responseType: "blob",
    });
    const url = URL.createObjectURL(res.data);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${kind}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  } catch (e) {
    toast.error(apiError(e, "Export failed"));
  }
};
