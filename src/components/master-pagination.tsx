"use client";

import { MasterSelect } from "@/components/master-ui";

export const MASTER_PAGE_SIZE_OPTIONS = [10, 25, 50] as const;

export type MasterPageSize = (typeof MASTER_PAGE_SIZE_OPTIONS)[number];

type MasterPaginationProps = {
  page: number;
  pageSize: MasterPageSize;
  totalItems: number;
  itemLabel?: string;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: MasterPageSize) => void;
};

export function MasterPagination({
  page,
  pageSize,
  totalItems,
  itemLabel = "items",
  onPageChange,
  onPageSizeChange,
}: MasterPaginationProps) {
  if (totalItems <= 0) {
    return null;
  }

  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const safePage = Math.min(page, totalPages);
  const rangeStart = (safePage - 1) * pageSize + 1;
  const rangeEnd = Math.min(safePage * pageSize, totalItems);

  return (
    <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4">
      <p className="text-sm text-slate-500">
        Showing <span className="font-semibold text-slate-700">{rangeStart}–{rangeEnd}</span> of{" "}
        <span className="font-semibold text-slate-700">{totalItems}</span> {itemLabel}
      </p>
      <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-sm text-slate-600">
          Rows
          <MasterSelect
            value={String(pageSize)}
            onValueChange={(value) => onPageSizeChange(Number(value) as MasterPageSize)}
            size="sm"
            className="!w-[4.75rem] min-w-[4.75rem]"
            aria-label="Rows per page"
            options={MASTER_PAGE_SIZE_OPTIONS.map((size) => ({
              value: String(size),
              label: String(size),
            }))}
          />
        </label>
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={safePage <= 1}
            onClick={() => onPageChange(Math.max(1, safePage - 1))}
            className="admin-btn-ghost disabled:cursor-not-allowed disabled:opacity-40"
          >
            Previous
          </button>
          <span className="px-1 text-sm text-slate-600">
            Page {safePage} of {totalPages}
          </span>
          <button
            type="button"
            disabled={safePage >= totalPages}
            onClick={() => onPageChange(Math.min(totalPages, safePage + 1))}
            className="inline-flex items-center justify-center rounded-lg border border-[#0f172a] bg-[#0f172a] px-4 py-2 text-sm font-bold text-white transition hover:bg-[#1e293b] disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}

export function paginateItems<T>(items: T[], page: number, pageSize: number) {
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const start = (safePage - 1) * pageSize;
  return {
    items: items.slice(start, start + pageSize),
    totalPages,
    safePage,
  };
}
