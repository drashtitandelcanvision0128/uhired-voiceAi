"use client";

import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import {
  CheckCircle2,
  ChevronDown,
  CircleDashed,
  Copy,
  Eye,
  Link2,
  Loader,
  MoreVertical,
  Pencil,
  Search,
  Trash2,
} from "lucide-react";

import type { AdminRequirementDetail } from "@/components/admin-requirement-detail-modal";
import { getAdminInviteStatus, isOpenInviteStatus, type AdminInviteStatus } from "@/lib/admin-invite-status";
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
import { cn } from "@/lib/utils";

type RequirementStatus = "Done" | "In Process" | "Ready";
type StatusFilter = "ALL" | RequirementStatus;
type DurationFilter = "ALL" | "5" | "10" | "15" | "30" | "60" | "other";

const STANDARD_DURATIONS = [5, 10, 15, 30, 60];

const TABLE_PAGE_SIZE = 10;

type AdminRequirementsTableProps = {
  requirements: AdminRequirementDetail[];
  loading: boolean;
  search: string;
  onSearchChange: (value: string) => void;
  page: number;
  totalPages: number;
  pageStart: number;
  pageEnd: number;
  totalItems: number;
  onPageChange: (page: number) => void;
  onView: (requirement: AdminRequirementDetail) => void;
  onEdit: (requirementId: string) => void;
  onDelete: (requirementId: string) => void;
  onInvite: (requirement: AdminRequirementDetail) => void;
  onCopyCode: (code: string) => void;
  onCopyShareLink: (requirement: AdminRequirementDetail) => void;
  onOpenSessions?: (requirement: AdminRequirementDetail) => void;
};

function inviteStatus(invite: AdminRequirementDetail["candidateInvites"][number]): AdminInviteStatus {
  return getAdminInviteStatus(invite);
}

function requirementStatus(requirement: AdminRequirementDetail): RequirementStatus {
  const invites = requirement.candidateInvites ?? [];
  if (invites.length === 0 && requirement.sessionsCount === 0) return "Ready";
  const open = invites.some((invite) => isOpenInviteStatus(inviteStatus(invite)));
  if (
    open ||
    (requirement.linkedInterviews ?? []).some((item) => item.status === "LIVE" || item.status === "READY")
  ) {
    return "In Process";
  }
  if (requirement.sessionsCount > 0 || invites.some((invite) => inviteStatus(invite) === "Used")) {
    return "Done";
  }
  return "Ready";
}

function StatusPill({ status }: { status: RequirementStatus }) {
  if (status === "Done") {
    return (
      <Badge variant="outline" className="gap-1 border-border font-normal text-foreground">
        <CheckCircle2 className="size-3 text-emerald-600 dark:text-emerald-400" />
        Done
      </Badge>
    );
  }
  if (status === "In Process") {
    return (
      <Badge variant="outline" className="text-muted-foreground gap-1 border-border font-normal">
        <Loader className="size-3" />
        In Process
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="text-muted-foreground gap-1 border-border font-normal">
      <CircleDashed className="size-3" />
      Ready
    </Badge>
  );
}

export function AdminRequirementsTable({
  requirements,
  loading,
  search,
  onSearchChange,
  page,
  onPageChange,
  onView,
  onEdit,
  onDelete,
  onInvite,
  onCopyCode,
  onCopyShareLink,
  onOpenSessions,
}: AdminRequirementsTableProps) {
  const [selected, setSelected] = useState<string[]>([]);
  const [menuId, setMenuId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");
  const [typeFilter, setTypeFilter] = useState("ALL");
  const [durationFilter, setDurationFilter] = useState<DurationFilter>("ALL");
  const menuRef = useRef<HTMLDivElement>(null);

  const selectAllRef = useRef<HTMLInputElement>(null);
  const typeOptions = useMemo(() => {
    const values = new Set(requirements.map((item) => item.domain.trim()).filter(Boolean));
    return [...values].sort((a, b) => a.localeCompare(b));
  }, [requirements]);

  const filteredRequirements = useMemo(() => {
    return requirements.filter((requirement) => {
      if (statusFilter !== "ALL" && requirementStatus(requirement) !== statusFilter) return false;
      if (typeFilter !== "ALL" && requirement.domain.trim() !== typeFilter) return false;
      if (durationFilter === "other") {
        if (STANDARD_DURATIONS.includes(requirement.durationMin)) return false;
      } else if (durationFilter !== "ALL" && requirement.durationMin !== Number(durationFilter)) {
        return false;
      }
      return true;
    });
  }, [requirements, statusFilter, typeFilter, durationFilter]);

  const totalFiltered = filteredRequirements.length;
  const filteredPages = Math.max(1, Math.ceil(totalFiltered / TABLE_PAGE_SIZE));
  const safePage = Math.min(page, filteredPages);
  const pageItems = useMemo(
    () => filteredRequirements.slice((safePage - 1) * TABLE_PAGE_SIZE, safePage * TABLE_PAGE_SIZE),
    [filteredRequirements, safePage],
  );
  const filteredStart = totalFiltered === 0 ? 0 : (safePage - 1) * TABLE_PAGE_SIZE + 1;
  const filteredEnd = Math.min(safePage * TABLE_PAGE_SIZE, totalFiltered);
  const filtersActive = statusFilter !== "ALL" || typeFilter !== "ALL" || durationFilter !== "ALL";

  const ids = useMemo(() => pageItems.map((item) => item.requirementId), [pageItems]);
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
  }, [search, statusFilter, typeFilter, durationFilter, onPageChange]);

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
              placeholder="Search role, domain, or topic"
              className="border-input bg-background h-8 w-full rounded-md border pr-3 pl-8 text-sm outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
              aria-label="Search openings"
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
                {totalFiltered} opening{totalFiltered === 1 ? "" : "s"}
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
              { value: "Ready", label: "Ready" },
              { value: "In Process", label: "In Process" },
              { value: "Done", label: "Done" },
            ]}
          />
          <AppSelect
            value={typeFilter}
            onValueChange={setTypeFilter}
            size="sm"
            className="min-w-[8rem] w-[9.5rem]"
            aria-label="Filter by type"
            options={[
              { value: "ALL", label: "All types" },
              ...typeOptions.map((type) => ({ value: type, label: type })),
            ]}
          />
          <AppSelect
            value={durationFilter}
            onValueChange={(value) => setDurationFilter(value as DurationFilter)}
            size="sm"
            className="w-[8.75rem]"
            aria-label="Filter by duration"
            options={[
              { value: "ALL", label: "All duration" },
              { value: "5", label: "5 min" },
              { value: "10", label: "10 min" },
              { value: "15", label: "15 min" },
              { value: "30", label: "30 min" },
              { value: "60", label: "60 min" },
              { value: "other", label: "Other" },
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
                setTypeFilter("ALL");
                setDurationFilter("ALL");
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
                aria-label="Select all openings"
              />
            </TableHead>
            <TableHead className="min-w-[180px]">Role</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Duration</TableHead>
            <TableHead className="text-right">Sessions</TableHead>
            <TableHead>Invites</TableHead>
            <TableHead className="w-8" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {loading && pageItems.length === 0 ? (
            <TableRow>
              <TableCell colSpan={8} className="text-muted-foreground h-16 text-center">
                Loading openings…
              </TableCell>
            </TableRow>
          ) : null}
          {pageItems.map((requirement) => {
            const role = requirement.title?.trim() || requirement.domain;
            const status = requirementStatus(requirement);
            const invites = requirement.candidateInvites ?? [];
            const used = invites.filter((invite) => inviteStatus(invite) === "Used").length;
            const selectedRow = selected.includes(requirement.requirementId);
            const expanded = expandedId === requirement.requirementId;
            const code = requirement.requirementAccessCode;

            return (
              <Fragment key={requirement.requirementId}>
              <TableRow
                data-state={selectedRow ? "selected" : undefined}
                className="group"
              >
                <TableCell className="w-8 px-2">
                  <Checkbox
                    checked={selectedRow}
                    onChange={() => toggleOne(requirement.requirementId)}
                    aria-label={`Select ${role}`}
                  />
                </TableCell>
                <TableCell className="min-w-[180px] max-w-[280px]">
                  <button
                    type="button"
                    onClick={() => onView(requirement)}
                    className="block w-full truncate text-left text-sm font-medium hover:underline"
                  >
                    {role}
                  </button>
                  <p className="text-muted-foreground truncate text-xs">{requirement.topic}</p>
                </TableCell>
                <TableCell>
                  <Badge variant="outline" className="font-normal">
                    {requirement.domain}
                  </Badge>
                </TableCell>
                <TableCell>
                  <StatusPill status={status} />
                </TableCell>
                <TableCell className="text-right tabular-nums">{requirement.durationMin}</TableCell>
                <TableCell className="text-right">
                  {onOpenSessions && requirement.sessionsCount > 0 ? (
                    <button
                      type="button"
                      onClick={() => onOpenSessions(requirement)}
                      className="text-foreground hover:underline tabular-nums"
                    >
                      {requirement.sessionsCount}
                    </button>
                  ) : (
                    <span className="tabular-nums">{requirement.sessionsCount}</span>
                  )}
                </TableCell>
                <TableCell>
                  {invites.length > 0 ? (
                    <button
                      type="button"
                      onClick={() => setExpandedId(expanded ? null : requirement.requirementId)}
                      className="inline-flex items-center gap-1 text-sm"
                    >
                      <span className="tabular-nums">
                        {used}/{invites.length}
                      </span>
                      <ChevronDown className={cn("text-muted-foreground size-3.5 transition", expanded && "rotate-180")} />
                    </button>
                  ) : (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-7 px-2 text-xs font-normal"
                      onClick={() => onInvite(requirement)}
                    >
                      Invite candidates
                      <ChevronDown className="size-3.5 opacity-70" />
                    </Button>
                  )}
                </TableCell>
                <TableCell className="w-8 px-1">
                  <div className="relative flex justify-end" ref={menuId === requirement.requirementId ? menuRef : undefined}>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-7"
                      aria-label={`Actions for ${role}`}
                      onClick={() =>
                        setMenuId((current) => (current === requirement.requirementId ? null : requirement.requirementId))
                      }
                    >
                      <MoreVertical className="size-4" />
                    </Button>
                    {menuId === requirement.requirementId ? (
                      <div className="bg-popover text-popover-foreground absolute top-8 right-0 z-30 min-w-40 overflow-hidden rounded-md border py-1 shadow-md">
                        <button
                          type="button"
                          className="hover:bg-muted flex w-full items-center gap-2 px-2.5 py-1.5 text-left text-sm"
                          onClick={() => {
                            setMenuId(null);
                            onView(requirement);
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
                            onEdit(requirement.requirementId);
                          }}
                        >
                          <Pencil className="size-3.5" />
                          Edit
                        </button>
                        {code ? (
                          <button
                            type="button"
                            className="hover:bg-muted flex w-full items-center gap-2 px-2.5 py-1.5 text-left text-sm"
                            onClick={() => {
                              setMenuId(null);
                              onCopyCode(code);
                            }}
                          >
                            <Copy className="size-3.5" />
                            Copy code
                          </button>
                        ) : null}
                        {code ? (
                          <button
                            type="button"
                            className="hover:bg-muted flex w-full items-center gap-2 px-2.5 py-1.5 text-left text-sm"
                            onClick={() => {
                              setMenuId(null);
                              onCopyShareLink(requirement);
                            }}
                          >
                            <Link2 className="size-3.5" />
                            Copy share link
                          </button>
                        ) : null}
                        <button
                          type="button"
                          className="hover:bg-muted flex w-full items-center gap-2 px-2.5 py-1.5 text-left text-sm"
                          onClick={() => {
                            setMenuId(null);
                            onInvite(requirement);
                          }}
                        >
                          Invite
                        </button>
                        <button
                          type="button"
                          className="text-destructive hover:bg-destructive/10 flex w-full items-center gap-2 px-2.5 py-1.5 text-left text-sm"
                          onClick={() => {
                            setMenuId(null);
                            void onDelete(requirement.requirementId);
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
              {expanded ? (
                <TableRow className="bg-muted/30 hover:bg-muted/30">
                  <TableCell colSpan={8} className="h-auto py-2">
                    <div className="grid gap-1">
                      {invites.map((invite) => {
                        const status = inviteStatus(invite);
                        return (
                          <div
                            key={`${invite.email}-${invite.accessCode}`}
                            className="flex flex-wrap items-center gap-2 px-1 text-xs"
                          >
                            <span className="min-w-0 flex-1 truncate font-medium">
                              {invite.candidateName?.trim() || invite.email}
                            </span>
                            <code className="text-muted-foreground font-mono">{invite.accessCode}</code>
                            <Badge
                              variant={status === "Used" ? "success" : status === "Expired" ? "danger" : "outline"}
                              className="font-normal"
                            >
                              {status}
                            </Badge>
                          </div>
                        );
                      })}
                    </div>
                  </TableCell>
                </TableRow>
              ) : null}
              </Fragment>
            );
          })}
          {!loading && pageItems.length === 0 ? (
            <TableRow>
              <TableCell colSpan={8} className="text-muted-foreground h-16 text-center">
                {filtersActive || search.trim()
                  ? "No openings match these filters."
                  : "No openings found yet."}
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
