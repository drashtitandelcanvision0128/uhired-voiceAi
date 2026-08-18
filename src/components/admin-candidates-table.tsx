"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  CheckCircle2,
  CircleDashed,
  Eye,
  Loader,
  MoreVertical,
  Pencil,
  Search,
  Trash2,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { AppSelect } from "@/components/ui/app-select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export type AdminCandidateRow = {
  candidateId: string;
  key: string;
  candidateName: string | null;
  candidateEmail: string | null;
  latestStatus: string;
  latestScore: number | null;
  latestSessionId: string | null;
  sessionsCount: number;
  updatedAt?: string;
};

type StatusFilter = "ALL" | "COMPLETED" | "READY" | "LIVE" | "OTHER";
type SessionsFilter = "ALL" | "0" | "1" | "2plus";
type ScoreFilter = "ALL" | "has" | "none" | "70" | "50" | "low";

const TABLE_PAGE_SIZE = 10;

type AdminCandidatesTableProps = {
  candidates: AdminCandidateRow[];
  loading: boolean;
  search: string;
  onSearchChange: (value: string) => void;
  page: number;
  onPageChange: (page: number) => void;
  onView: (candidateId: string) => void;
  onEdit: (candidateId: string) => void;
  onDelete: (candidate: AdminCandidateRow) => void;
};

function normalizeStatus(status: string) {
  return status.trim().toUpperCase();
}

function isOtherStatus(status: string) {
  const value = normalizeStatus(status);
  return value !== "COMPLETED" && value !== "READY" && value !== "LIVE";
}

function StatusPill({ status }: { status: string }) {
  const value = normalizeStatus(status);
  if (value === "COMPLETED") {
    return (
      <Badge variant="outline" className="gap-1 border-border font-normal text-foreground">
        <CheckCircle2 className="size-3 text-emerald-600 dark:text-emerald-400" />
        Completed
      </Badge>
    );
  }
  if (value === "LIVE") {
    return (
      <Badge variant="outline" className="text-muted-foreground gap-1 border-border font-normal">
        <Loader className="size-3" />
        Live
      </Badge>
    );
  }
  if (value === "READY") {
    return (
      <Badge variant="outline" className="text-muted-foreground gap-1 border-border font-normal">
        <CircleDashed className="size-3" />
        Ready
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="text-muted-foreground font-normal">
      {status || "Unknown"}
    </Badge>
  );
}

function formatUpdated(iso?: string) {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString(undefined, { day: "2-digit", month: "short" });
}

function formatScore(score: number | null) {
  if (score == null || !Number.isFinite(score)) return "—";
  return Number.isInteger(score) ? String(score) : score.toFixed(1);
}

export function AdminCandidatesTable({
  candidates,
  loading,
  search,
  onSearchChange,
  page,
  onPageChange,
  onView,
  onEdit,
  onDelete,
}: AdminCandidatesTableProps) {
  const [selected, setSelected] = useState<string[]>([]);
  const [menuId, setMenuId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");
  const [sessionsFilter, setSessionsFilter] = useState<SessionsFilter>("ALL");
  const [scoreFilter, setScoreFilter] = useState<ScoreFilter>("ALL");
  const menuRef = useRef<HTMLDivElement>(null);
  const selectAllRef = useRef<HTMLInputElement>(null);

  const filteredCandidates = useMemo(() => {
    return candidates.filter((candidate) => {
      const status = normalizeStatus(candidate.latestStatus);
      if (statusFilter === "OTHER" && !isOtherStatus(status)) return false;
      if (statusFilter !== "ALL" && statusFilter !== "OTHER" && status !== statusFilter) return false;
      if (sessionsFilter === "0" && candidate.sessionsCount !== 0) return false;
      if (sessionsFilter === "1" && candidate.sessionsCount !== 1) return false;
      if (sessionsFilter === "2plus" && candidate.sessionsCount < 2) return false;
      const score = candidate.latestScore;
      if (scoreFilter === "has" && (score == null || !Number.isFinite(score))) return false;
      if (scoreFilter === "none" && score != null && Number.isFinite(score)) return false;
      if (scoreFilter === "70" && (score == null || score < 70)) return false;
      if (scoreFilter === "50" && (score == null || score < 50 || score >= 70)) return false;
      if (scoreFilter === "low" && (score == null || score >= 50)) return false;
      return true;
    });
  }, [candidates, statusFilter, sessionsFilter, scoreFilter]);

  const totalFiltered = filteredCandidates.length;
  const filteredPages = Math.max(1, Math.ceil(totalFiltered / TABLE_PAGE_SIZE));
  const safePage = Math.min(page, filteredPages);
  const pageItems = useMemo(
    () => filteredCandidates.slice((safePage - 1) * TABLE_PAGE_SIZE, safePage * TABLE_PAGE_SIZE),
    [filteredCandidates, safePage],
  );
  const filteredStart = totalFiltered === 0 ? 0 : (safePage - 1) * TABLE_PAGE_SIZE + 1;
  const filteredEnd = Math.min(safePage * TABLE_PAGE_SIZE, totalFiltered);
  const filtersActive = statusFilter !== "ALL" || sessionsFilter !== "ALL" || scoreFilter !== "ALL";

  const ids = useMemo(() => pageItems.map((item) => item.candidateId), [pageItems]);
  const allSelected = ids.length > 0 && ids.every((id) => selected.includes(id));
  const someSelected = selected.length > 0;

  useEffect(() => {
    setSelected((current) => {
      const next = current.filter((id) => ids.includes(id));
      return next.length === current.length ? current : next;
    });
  }, [ids]);

  useEffect(() => {
    if (selectAllRef.current) {
      selectAllRef.current.indeterminate = someSelected && !allSelected;
    }
  }, [someSelected, allSelected]);

  useEffect(() => {
    function onDocClick(event: MouseEvent) {
      if (!menuRef.current?.contains(event.target as Node)) setMenuId(null);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  useEffect(() => {
    if (page !== 1) onPageChange(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset on filter/search only
  }, [search, statusFilter, sessionsFilter, scoreFilter, onPageChange]);

  function toggleAll() {
    setSelected(allSelected ? [] : ids);
  }

  function toggleOne(id: string) {
    setSelected((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]));
  }

  return (
    <div className="overflow-hidden rounded-lg border bg-card">
      <div className="flex flex-col gap-2 border-b px-2 py-2">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative min-w-0 flex-1">
            <Search className="text-muted-foreground pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2" />
            <input
              value={search}
              onChange={(event) => onSearchChange(event.target.value)}
              placeholder="Search name, email, or status"
              className="border-input bg-background h-8 w-full rounded-md border pr-3 pl-8 text-sm outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
              aria-label="Search candidates"
            />
          </div>
          <div className="flex items-center gap-2">
            {someSelected ? (
              <>
                <span className="text-muted-foreground text-xs">{selected.length} selected</span>
                <Button type="button" variant="outline" size="sm" className="h-8" onClick={() => setSelected([])}>
                  Clear
                </Button>
              </>
            ) : (
              <p className="text-muted-foreground hidden text-xs sm:block">
                {totalFiltered} candidate{totalFiltered === 1 ? "" : "s"}
              </p>
            )}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <AppSelect
            value={statusFilter}
            onValueChange={(value) => setStatusFilter(value as StatusFilter)}
            size="sm"
            className="w-[8.75rem]"
            aria-label="Filter by status"
            options={[
              { value: "ALL", label: "All status" },
              { value: "COMPLETED", label: "Completed" },
              { value: "READY", label: "Ready" },
              { value: "LIVE", label: "Live" },
              { value: "OTHER", label: "Other" },
            ]}
          />
          <AppSelect
            value={sessionsFilter}
            onValueChange={(value) => setSessionsFilter(value as SessionsFilter)}
            size="sm"
            className="w-[8.75rem]"
            aria-label="Filter by sessions"
            options={[
              { value: "ALL", label: "All sessions" },
              { value: "0", label: "No sessions" },
              { value: "1", label: "1 session" },
              { value: "2plus", label: "2+ sessions" },
            ]}
          />
          <AppSelect
            value={scoreFilter}
            onValueChange={(value) => setScoreFilter(value as ScoreFilter)}
            size="sm"
            className="w-[8.75rem]"
            aria-label="Filter by score"
            options={[
              { value: "ALL", label: "All scores" },
              { value: "has", label: "Has score" },
              { value: "none", label: "No score" },
              { value: "70", label: "70+" },
              { value: "50", label: "50–69" },
              { value: "low", label: "Below 50" },
            ]}
          />
          {filtersActive ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 px-2 text-xs"
              onClick={() => {
                setStatusFilter("ALL");
                setSessionsFilter("ALL");
                setScoreFilter("ALL");
              }}
            >
              Reset
            </Button>
          ) : null}
        </div>
      </div>

      <Table>
        <TableHeader className="bg-muted/50">
          <TableRow className="hover:bg-transparent">
            <TableHead className="w-8 px-2">
              <Checkbox
                ref={selectAllRef}
                checked={allSelected}
                onChange={toggleAll}
                aria-label="Select all candidates"
              />
            </TableHead>
            <TableHead className="min-w-[180px]">Candidate</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Sessions</TableHead>
            <TableHead className="text-right">Score</TableHead>
            <TableHead>Updated</TableHead>
            <TableHead className="w-8" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {loading && pageItems.length === 0 ? (
            <TableRow>
              <TableCell colSpan={7} className="text-muted-foreground h-16 text-center">
                Loading candidates…
              </TableCell>
            </TableRow>
          ) : null}
          {pageItems.map((candidate) => {
            const name = candidate.candidateName?.trim() || "Unnamed candidate";
            const selectedRow = selected.includes(candidate.candidateId);
            return (
              <TableRow key={candidate.key} data-state={selectedRow ? "selected" : undefined} className="group">
                <TableCell className="w-8 px-2">
                  <Checkbox
                    checked={selectedRow}
                    onChange={() => toggleOne(candidate.candidateId)}
                    aria-label={`Select ${name}`}
                  />
                </TableCell>
                <TableCell className="min-w-[180px] max-w-[280px]">
                  <button
                    type="button"
                    onClick={() => onView(candidate.candidateId)}
                    className="block w-full truncate text-left text-sm font-medium hover:underline"
                  >
                    {name}
                  </button>
                  <p className="text-muted-foreground truncate text-xs">
                    {candidate.candidateEmail ?? "No email"}
                  </p>
                </TableCell>
                <TableCell>
                  <StatusPill status={candidate.latestStatus} />
                </TableCell>
                <TableCell className="text-right tabular-nums">{candidate.sessionsCount}</TableCell>
                <TableCell className="text-right tabular-nums">{formatScore(candidate.latestScore)}</TableCell>
                <TableCell className="text-muted-foreground text-xs">{formatUpdated(candidate.updatedAt)}</TableCell>
                <TableCell className="w-8 px-1">
                  <div className="relative flex justify-end" ref={menuId === candidate.candidateId ? menuRef : undefined}>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-7"
                      aria-label={`Actions for ${name}`}
                      onClick={() =>
                        setMenuId((current) => (current === candidate.candidateId ? null : candidate.candidateId))
                      }
                    >
                      <MoreVertical className="size-4" />
                    </Button>
                    {menuId === candidate.candidateId ? (
                      <div className="bg-popover text-popover-foreground absolute top-8 right-0 z-30 min-w-40 overflow-hidden rounded-md border py-1 shadow-md">
                        <button
                          type="button"
                          className="hover:bg-muted flex w-full items-center gap-2 px-2.5 py-1.5 text-left text-sm"
                          onClick={() => {
                            setMenuId(null);
                            onView(candidate.candidateId);
                          }}
                        >
                          <Eye className="size-3.5" />
                          View
                        </button>
                        <button
                          type="button"
                          className="hover:bg-muted flex w-full items-center gap-2 px-2.5 py-1.5 text-left text-sm"
                          onClick={() => {
                            setMenuId(null);
                            onEdit(candidate.candidateId);
                          }}
                        >
                          <Pencil className="size-3.5" />
                          Edit
                        </button>
                        <button
                          type="button"
                          className="text-destructive hover:bg-destructive/10 flex w-full items-center gap-2 px-2.5 py-1.5 text-left text-sm"
                          onClick={() => {
                            setMenuId(null);
                            void onDelete(candidate);
                          }}
                        >
                          <Trash2 className="size-3.5" />
                          Delete
                        </button>
                      </div>
                    ) : null}
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
          {!loading && pageItems.length === 0 ? (
            <TableRow>
              <TableCell colSpan={7} className="text-muted-foreground h-16 text-center">
                {filtersActive || search.trim()
                  ? "No candidates match these filters."
                  : "No candidates found yet."}
              </TableCell>
            </TableRow>
          ) : null}
        </TableBody>
      </Table>

      {totalFiltered > 0 ? (
        <div className="flex flex-col gap-2 border-t px-3 py-2 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-muted-foreground text-xs">
            Showing {filteredStart}–{filteredEnd} of {totalFiltered}
          </p>
          <div className="flex items-center gap-1.5">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 px-2.5"
              disabled={safePage <= 1}
              onClick={() => onPageChange(Math.max(1, safePage - 1))}
            >
              Previous
            </Button>
            <span className="px-1.5 text-xs tabular-nums">
              {safePage}/{filteredPages}
            </span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 px-2.5"
              disabled={safePage >= filteredPages}
              onClick={() => onPageChange(Math.min(filteredPages, safePage + 1))}
            >
              Next
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
