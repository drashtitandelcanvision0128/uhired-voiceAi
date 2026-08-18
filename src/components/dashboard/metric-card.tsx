import { TrendingDown, TrendingUp, Minus } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type MetricCardProps = {
  label: string;
  value: string | number;
  delta?: number | null;
  trend?: string;
  footer?: string;
  onClick?: () => void;
  className?: string;
};

function DeltaBadge({ value }: { value: number }) {
  if (value === 0) {
    return (
      <Badge variant="secondary" className="font-medium">
        <Minus />
        0%
      </Badge>
    );
  }

  const up = value > 0;
  return (
    <Badge variant={up ? "success" : "danger"} className="font-medium">
      {up ? <TrendingUp /> : <TrendingDown />}
      {up ? "+" : ""}
      {value}%
    </Badge>
  );
}

export function MetricCard({
  label,
  value,
  delta,
  trend,
  footer,
  onClick,
  className,
}: MetricCardProps) {
  const Tag = onClick ? "button" : "div";

  return (
    <Tag
      type={onClick ? "button" : undefined}
      onClick={onClick}
      className={cn("h-full w-full text-left", onClick && "cursor-pointer")}
    >
      <Card
        className={cn(
          "h-full gap-3 py-4 shadow-none transition-colors",
          onClick && "hover:bg-muted/40",
          className,
        )}
      >
        <CardHeader className="px-4">
          <div className="flex items-start justify-between gap-3">
            <CardDescription className="text-sm">{label}</CardDescription>
            {delta != null ? <DeltaBadge value={delta} /> : null}
          </div>
          <CardTitle className="text-2xl font-semibold tabular-nums tracking-tight">
            {value}
          </CardTitle>
        </CardHeader>
        {(trend || footer) && (
          <CardFooter className="flex-col items-start gap-1 px-4 text-sm">
            {trend ? <p className="font-medium">{trend}</p> : null}
            {footer ? <p className="text-muted-foreground text-xs">{footer}</p> : null}
          </CardFooter>
        )}
      </Card>
    </Tag>
  );
}
