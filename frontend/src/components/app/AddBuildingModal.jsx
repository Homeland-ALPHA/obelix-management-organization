import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { MapPin, Search } from "lucide-react";
import { toast } from "sonner";
import { api, apiError } from "@/lib/api";
import { useBuilding } from "@/context/BuildingContext";
import { Modal, Spinner } from "./kit";
import { inputCls } from "./ui";

const useDebounced = (value, ms) => {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
};

export const AddBuildingModal = ({ open, onClose }) => {
  const qc = useQueryClient();
  const { setSelectedId } = useBuilding();
  const [q, setQ] = useState("");
  const dq = useDebounced(q, 400);

  const { data: hits, isFetching } = useQuery({
    queryKey: ["geosearch", dq],
    queryFn: () => api.get("/geosearch", { params: { q: dq } }).then((r) => r.data),
    enabled: open && dq.trim().length >= 3,
  });

  const add = useMutation({
    mutationFn: (sel) => api.post("/buildings", sel).then((r) => r.data),
    onSuccess: (b) => {
      qc.invalidateQueries();
      toast.success(`${b.label} connected — live city records imported`);
      setSelectedId(b.id);
      setQ("");
      onClose();
    },
    onError: (e) => toast.error(apiError(e)),
  });

  return (
    <Modal open={open} onClose={onClose} title="Add a building">
      <p className="text-[12.5px] leading-relaxed text-mid">
        Search any NYC address. Obelix matches it to the city record (BBL / BIN), imports the building
        profile, and pulls live HPD, DOB, OATH, 311 and DOF data.
      </p>
      <div className="relative mt-4">
        <Search size={14} strokeWidth={1.5} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-dim" />
        <input
          autoFocus
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="e.g. 888 Grand Concourse"
          className={`${inputCls} pl-10`}
          disabled={add.isPending}
          data-testid="add-building-search"
        />
        {(isFetching || add.isPending) && <Spinner className="absolute right-3.5 top-1/2 -translate-y-1/2" />}
      </div>
      {add.isPending ? (
        <p className="mt-3 flex items-center gap-2 text-[12px] text-gold">
          <Spinner /> Importing live city records — this takes a few seconds…
        </p>
      ) : (hits?.length || 0) > 0 ? (
        <ul className="mt-2 divide-y divide-line/70 border border-line">
          {hits.map((h) => (
            <li key={h.bbl + h.label}>
              <button
                type="button"
                onClick={() => add.mutate(h)}
                className="flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left transition-colors hover:bg-tint/[0.04]"
              >
                <span className="flex min-w-0 items-center gap-2.5">
                  <MapPin size={13} strokeWidth={1.5} className="shrink-0 text-gold" />
                  <span className="truncate text-[13px] text-body">{h.label}</span>
                </span>
                <span className="label-xs shrink-0 text-dim">BBL {h.bbl}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : dq.trim().length >= 3 && !isFetching ? (
        <p className="mt-3 text-[12px] text-dim">No city record matched that address.</p>
      ) : null}
    </Modal>
  );
};
