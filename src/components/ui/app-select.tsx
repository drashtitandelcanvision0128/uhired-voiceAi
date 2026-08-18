"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

const EMPTY_SELECT_VALUE = "__empty__";

export type AppSelectOption = {
  value: string;
  label: string;
  disabled?: boolean;
};

export function AppSelect({
  value,
  onValueChange,
  options,
  placeholder,
  disabled,
  required,
  name,
  className,
  size = "default",
  "aria-label": ariaLabel,
}: {
  value: string;
  onValueChange: (value: string) => void;
  options: AppSelectOption[];
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  name?: string;
  className?: string;
  size?: "sm" | "default";
  "aria-label"?: string;
}) {
  const selectValue = value === "" ? EMPTY_SELECT_VALUE : value;

  return (
    <>
      {name || required ? (
        <input
          type="text"
          name={name}
          value={value}
          required={required}
          tabIndex={-1}
          aria-hidden="true"
          className="sr-only"
          onChange={() => {}}
        />
      ) : null}
      <Select
        value={selectValue}
        onValueChange={(next) => onValueChange(next === EMPTY_SELECT_VALUE ? "" : next)}
        disabled={disabled}
      >
        <SelectTrigger
          size={size}
          aria-label={ariaLabel}
          className={cn(
            "admin-input !flex items-center justify-between text-left shadow-none [&_[data-slot=select-value]]:min-w-0 [&_[data-slot=select-value]]:truncate",
            size === "default" && "!min-h-[2.75rem] !py-2.5 !pl-4 !pr-3",
            size === "sm" && "!min-h-8 !py-1.5 !px-3 !text-xs",
            className,
          )}
        >
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem
              key={option.value === "" ? EMPTY_SELECT_VALUE : option.value}
              value={option.value === "" ? EMPTY_SELECT_VALUE : option.value}
              disabled={option.disabled}
            >
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </>
  );
}
