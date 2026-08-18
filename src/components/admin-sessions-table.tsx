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

export type AdminSessionRow = {
  id: string;
  candidateName: string | null;
  candidateEmail?: string | null;
  positionTitle: string | null;
  domain: string;
  durationMin: number;
  interviewDurationDisplay?: string;
  status: string;
  scorecard: { overallScore: number } | null;
  videoRecordingStatus?: "AVAILABLE" | "NOT_UPLOADED";
  candidateInviteCode?: string | null;
  requirementAccessCode?: string | null;
};

type AdminSessionsTableProps = {
  sessions: AdminSessionRow[];
  loading: boolean;
  search: string;
  onSearchChange: (value: string) => void;
  status: string;
  onStatusChange: (value: string) => void;
  recording: "all" | "no_recording";
  onRecordingChange: (value: "all" | "no_recording") => void;
  scoreMin: string;
  scoreMax: string;
  onScoreMinChange: (value: string) => void;
  onScoreMaxChange: (value: string) => void;
  from: string;
  to: string;
  onFromChange: (value: string) => void;
  onToChange: (value: string) => void;
  onReset: () => void;
  selectedIds: Set<string>;
  onToggle: (id: string) => void;
  onTogglePage: (checked: boolean, ids: string[]) => void;
  page: number;
  totalPages: number;
  pageStart: number;
  pageEnd: number;
  totalItems: number;
  onPageChange: (page: number) => void;
  onView: (sessionId: string) => void;
  onEdit: (sessionId: string) => void;
  onDelete: (sessionId: string) => void;
  onExportSelected: () => void;
  onExportAll: () => void;
  onBulkDelete: () => void;
  exportBusy: boolean;
  deleteBusy: boolean;
  formatCode: (session: AdminSessionRow) => string;
};

function StatusPill({ status }: { status: string }) {
  const value = status.trim().toUpperCase();
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

function formatScore(score: number | null | undefined) {
  if (score == null || !Number.isFinite(score)) return "—";
  return Number.isInteger(score) ? String(score) : score.toFixed(1);
}

export function AdminSessionsTable({
  sessions,
  loading,
  search,
  onSearchChange,
  status,
  onStatusChange,
  recording,
  onRecordingChange,
  scoreMin,
  scoreMax,
  onScoreMinChange,
  onScoreMaxChange,
  from,
  to,
  onFromChange,
  onToChange,
  onReset,
  selectedIds,
  onToggle,
  onTogglePage,
  page,
  totalPages,
  pageStart,
  pageEnd,
  totalItems,
  onPageChange,
  onView,
  onEdit,
  onDelete,
  onExportSelected,
  onExportAll,
  onBulkDelete,
  exportBusy,
  deleteBusy,
  formatCode,
}: AdminSessionsTableProps) {
  const [menuId, setMenuId] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const selectAllRef = useRef<HTMLInputElement>(null);
  const ids = useMemo(() => sessions.map((item) => item.id), [sessions]);
  const allSelected = ids.length > 0 && ids.every((id) => selectedIds.has(id));
  const someSelected = selectedIds.size > 0;
  const filtersActive =
    status !== "ALL" ||
    recording !== "all" ||
    Boolean(scoreMin.trim() || scoreMax.trim() || from || to);

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

  return (
    <div className="overflow-hidden rounded-lg border bg-card">
      <div className="flex flex-col gap-2 border-b px-2 py-2">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative min-w-0 flex-1">
            <Search className="text-muted-foreground pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2" />
            <input
              value={search}
              onChange={(event) => onSearchChange(event.target.value)}
              placeholder="Search role, code, or candidate"
              className="border-input bg-background h-8 w-full rounded-md border pr-3 pl-8 text-sm outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
              aria-label="Search sessions"
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {someSelected ? (
              <>
                <span className="text-muted-foreground text-xs">{selectedIds.size} selected</span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 text-xs"
                  disabled={exportBusy}
                  onClick={onExportSelected}
                >
                  Export
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-destructive h-8 text-xs"
                  disabled={deleteBusy}
                  onClick={onBulkDelete}
                >
                  {deleteBusy ? "Deleting…" : "Delete"}
                </Button>
              </>
            ) : (
              <>
                <p className="text-muted-foreground hidden text-xs sm:block">
                  {totalItems} session{totalItems === 1 ? "" : "s"}
                </p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 text-xs"
                  disabled={exportBusy || totalItems === 0}
                  onClick={onExportAll}
                >
                  {exportBusy ? "Exporting…" : "Export CSV"}
                </Button>
              </>
            )}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <AppSelect
            value={status}
            onValueChange={onStatusChange}
            size="sm"
            className="w-[8.75rem]"
            aria-label="Filter by status"
            options={[
              { value: "ALL", label: "All status" },
              { value: "READY", label: "Ready" },
              { value: "LIVE", label: "Live" },
              { value: "COMPLETED", label: "Completed" },
            ]}
          />
          <AppSelect
            value={recording}
            onValueChange={(value) => onRecordingChange(value as "all" | "no_recording")}
            size="sm"
            className="w-[9.5rem]"
            aria-label="Filter by recording"
            options={[
              { value: "all", label: "All recordings" },
              { value: "no_recording", label: "No recording" },
            ]}
          />
          <input
            value={scoreMin}
            onChange={(event) => onScoreMinChange(event.target.value)}
            inputMode="decimal"
            placeholder="Min score"
            className="border-input bg-background text-foreground h-8 w-20 rounded-md border px-2 text-xs"
            aria-label="Minimum score"
          />
          <input
            value={scoreMax}
            onChange={(event) => onScoreMaxChange(event.target.value)}
            inputMode="decimal"
            placeholder="Max score"
            className="border-input bg-background text-foreground h-8 w-20 rounded-md border px-2 text-xs"
            aria-label="Maximum score"
          />
          <input
            type="date"
            value={from}
            onChange={(event) => onFromChange(event.target.value)}
            className="border-input bg-background text-foreground h-8 rounded-md border px-2 text-xs"
            aria-label="From date"
          />
          <input
            type="date"
            value={to}
            onChange={(event) => onToChange(event.target.value)}
            className="border-input bg-background text-foreground h-8 rounded-md border px-2 text-xs"
            aria-label="To date"
          />
          {filtersActive ? (
            <Button type="button" variant="ghost" size="sm" className="h-8 px-2 text-xs" onClick={onReset}>
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
                onChange={(event) => onTogglePage(event.currentTarget.checked, ids)}
                aria-label="Select all sessions"
              />
            </TableHead>
            <TableHead className="min-w-[160px]">Role</TableHead>
            <TableHead>Candidate</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Duration</TableHead>
            <TableHead>Recording</TableHead>
            <TableHead className="text-right">Score</TableHead>
            <TableHead className="w-8" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {loading && sessions.length === 0 ? (
            <TableRow>
              <TableCell colSpan={8} className="text-muted-foreground h-16 text-center">
                Loading sessions…
              </TableCell>
            </TableRow>
          ) : null}
          {sessions.map((session) => {
            const role = session.positionTitle?.trim() || session.domain;
            const selectedRow = selectedIds.has(session.id);
            const hasRecording = session.videoRecordingStatus === "AVAILABLE";
            return (
              <TableRow key={session.id} data-state={selectedRow ? "selected" : undefined} className="group">
                <TableCell className="w-8 px-2">
                  <Checkbox
                    checked={selectedRow}
                    onChange={() => onToggle(session.id)}
                    aria-label={`Select ${role}`}
                  />
                </TableCell>
                <TableCell className="min-w-[160px] max-w-[240px]">
                  <button
                    type="button"
                    onClick={() => onView(session.id)}
                    className="block w-full truncate text-left text-sm font-medium hover:underline"
                  >
                    {role}
                  </button>
                  <p className="text-muted-foreground truncate font-mono text-[11px]">{formatCode(session)}</p>
                </TableCell>
                <TableCell className="max-w-[180px]">
                  <p className="truncate text-sm">{session.candidateName ?? "Awaiting candidate"}</p>
                  <p className="text-muted-foreground truncate text-xs">{session.candidateEmail ?? "No email"}</p>
                </TableCell>
                <TableCell>
                  <StatusPill status={session.status} />
                </TableCell>
                <TableCell className="text-muted-foreground text-xs">
                  {session.interviewDurationDisplay ?? `${session.durationMin} min`}
                </TableCell>
                <TableCell>
                  {hasRecording ? (
                    <span className="inline-flex items-center gap-1 text-xs text-emerald-700 dark:text-emerald-300">
                      <CheckCircle2 className="size-3" />
                      Available
                    </span>
                  ) : (
                    <span className="text-muted-foreground text-xs">Not uploaded</span>
                  )}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatScore(session.scorecard?.overallScore)}
                </TableCell>
                <TableCell className="w-8 px-1">
                  <div className="relative flex justify-end" ref={menuId === session.id ? menuRef : undefined}>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-7"
                      aria-label={`Actions for ${role}`}
                      onClick={() => setMenuId((current) => (current === session.id ? null : session.id))}
                    >
                      <MoreVertical className="size-4" />
                    </Button>
                    {menuId === session.id ? (
                      <div className="bg-popover text-popover-foreground absolute top-8 right-0 z-30 min-w-40 overflow-hidden rounded-md border py-1 shadow-md">
                        <button
                          type="button"
                          className="hover:bg-muted flex w-full items-center gap-2 px-2.5 py-1.5 text-left text-sm"
                          onClick={() => {
                            setMenuId(null);
                            onView(session.id);
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
                            onEdit(session.id);
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
                            void onDelete(session.id);
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
          {!loading && sessions.length === 0 ? (
            <TableRow>
              <TableCell colSpan={8} className="text-muted-foreground h-16 text-center">
                {filtersActive || search.trim()
                  ? "No sessions match these filters."
                  : "No sessions yet."}
              </TableCell>
            </TableRow>
          ) : null}
        </TableBody>
      </Table>

      {totalItems > 0 ? (
        <div className="flex flex-col gap-2 border-t px-3 py-2 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-muted-foreground text-xs">
            Showing {pageStart}–{pageEnd} of {totalItems}
          </p>
          <div className="flex items-center gap-1.5">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 px-2.5"
              disabled={page <= 1}
              onClick={() => onPageChange(Math.max(1, page - 1))}
            >
              Previous
            </Button>
            <span className="px-1.5 text-xs tabular-nums">
              {page}/{totalPages}
            </span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 px-2.5"
              disabled={page >= totalPages}
              onClick={() => onPageChange(Math.min(totalPages, page + 1))}
            >
              Next
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
