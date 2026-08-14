"use client";

import * as React from "react";

import { formatAmount, formatAmountCompact } from "@/lib/money";
import { cn } from "@/lib/utils";

export type MonthlyPoint = { month: string; invoiced: number; paid: number };

const SERIES = [
  { key: "invoiced", label: "Facturé", className: "fill-chart-1", swatch: "bg-chart-1" },
  { key: "paid", label: "Encaissé", className: "fill-chart-2", swatch: "bg-chart-2" },
] as const;

/* Géométrie du tracé, en unités du viewBox. */
const VIEW_WIDTH = 760;
const VIEW_HEIGHT = 260;
const PAD_LEFT = 58;
const PAD_RIGHT = 8;
const PAD_TOP = 12;
const PAD_BOTTOM = 30;
const PLOT_WIDTH = VIEW_WIDTH - PAD_LEFT - PAD_RIGHT;
const PLOT_HEIGHT = VIEW_HEIGHT - PAD_TOP - PAD_BOTTOM;
const BAR_WIDTH = 16;
/** Filet de fond entre deux barres : sépare les séries sans trait de contour. */
const BAR_GAP = 2;
const BAR_RADIUS = 4;

/** Borne haute « ronde » pour que les graduations tombent juste. */
function niceMax(value: number): number {
  if (value <= 0) return 1;
  const magnitude = 10 ** Math.floor(Math.log10(value));
  const normalised = value / magnitude;
  const step = normalised <= 1 ? 1 : normalised <= 2 ? 2 : normalised <= 5 ? 5 : 10;
  return step * magnitude;
}

function formatMonth(month: string): string {
  const [year, monthPart] = month.split("-").map(Number) as [number, number];
  return new Intl.DateTimeFormat("fr-FR", { month: "short", timeZone: "UTC" })
    .format(new Date(Date.UTC(year, monthPart - 1, 1)))
    .replace(".", "");
}

function formatMonthLong(month: string): string {
  const [year, monthPart] = month.split("-").map(Number) as [number, number];
  return new Intl.DateTimeFormat("fr-FR", { month: "long", year: "numeric", timeZone: "UTC" })
    .format(new Date(Date.UTC(year, monthPart - 1, 1)));
}

/** Barre à extrémité arrondie, ancrée à la ligne de base. */
function barPath(x: number, y: number, width: number, height: number): string {
  if (height <= 0) return "";
  const radius = Math.min(BAR_RADIUS, height, width / 2);
  const bottom = y + height;
  return [
    `M ${x} ${bottom}`,
    `L ${x} ${y + radius}`,
    `Q ${x} ${y} ${x + radius} ${y}`,
    `L ${x + width - radius} ${y}`,
    `Q ${x + width} ${y} ${x + width} ${y + radius}`,
    `L ${x + width} ${bottom}`,
    "Z",
  ].join(" ");
}

export function MonthlyChart({ data }: { data: MonthlyPoint[] }) {
  const [active, setActive] = React.useState<number | null>(null);

  const max = niceMax(Math.max(1, ...data.flatMap((point) => [point.invoiced, point.paid])));
  const bandWidth = PLOT_WIDTH / Math.max(1, data.length);
  const groupWidth = BAR_WIDTH * 2 + BAR_GAP;
  const ticks = [0, 0.25, 0.5, 0.75, 1];

  const scaleY = (value: number) => PLOT_HEIGHT - (value / max) * PLOT_HEIGHT;
  const bandCenter = (index: number) => PAD_LEFT + bandWidth * (index + 0.5);

  const activePoint = active === null ? null : data[active];

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-4">
        {SERIES.map((series) => (
          <span key={series.key} className="flex items-center gap-2 text-sm text-muted-foreground">
            <span className={cn("size-2.5 rounded-sm", series.swatch)} aria-hidden />
            {series.label}
          </span>
        ))}
      </div>

      <div className="relative">
        <svg
          viewBox={`0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}`}
          className="w-full"
          role="img"
          aria-label="Montants facturés et encaissés par mois. Le détail chiffré est disponible dans le tableau sous le graphique."
          onMouseLeave={() => setActive(null)}
        >
          {/* Graduations : discrètes, elles ne doivent pas concurrencer les barres. */}
          {ticks.map((tick) => {
            const y = PAD_TOP + PLOT_HEIGHT - tick * PLOT_HEIGHT;
            return (
              <g key={tick}>
                <line
                  x1={PAD_LEFT}
                  x2={VIEW_WIDTH - PAD_RIGHT}
                  y1={y}
                  y2={y}
                  className="stroke-border"
                  strokeWidth={1}
                />
                <text
                  x={PAD_LEFT - 10}
                  y={y + 4}
                  textAnchor="end"
                  className="fill-muted-foreground text-[11px]"
                >
                  {formatAmountCompact(Math.round(tick * max))}
                </text>
              </g>
            );
          })}

          {data.map((point, index) => {
            const center = bandCenter(index);
            const groupLeft = center - groupWidth / 2;

            return (
              <g key={point.month}>
                {active === index ? (
                  <rect
                    x={center - bandWidth / 2}
                    y={PAD_TOP}
                    width={bandWidth}
                    height={PLOT_HEIGHT}
                    className="fill-muted"
                  />
                ) : null}

                {SERIES.map((series, seriesIndex) => {
                  const value = point[series.key];
                  const height = PLOT_HEIGHT - scaleY(value);
                  const x = groupLeft + seriesIndex * (BAR_WIDTH + BAR_GAP);

                  return (
                    <path
                      key={series.key}
                      d={barPath(x, PAD_TOP + scaleY(value), BAR_WIDTH, height)}
                      className={cn(
                        series.className,
                        "transition-opacity",
                        active !== null && active !== index && "opacity-40",
                      )}
                    />
                  );
                })}

                <text
                  x={center}
                  y={VIEW_HEIGHT - 10}
                  textAnchor="middle"
                  className="fill-muted-foreground text-[11px]"
                >
                  {formatMonth(point.month)}
                </text>

                {/* Cible de survol pleine hauteur : bien plus large que les barres. */}
                <rect
                  x={center - bandWidth / 2}
                  y={PAD_TOP}
                  width={bandWidth}
                  height={PLOT_HEIGHT}
                  fill="transparent"
                  onMouseEnter={() => setActive(index)}
                />
              </g>
            );
          })}

          <line
            x1={PAD_LEFT}
            x2={VIEW_WIDTH - PAD_RIGHT}
            y1={PAD_TOP + PLOT_HEIGHT}
            y2={PAD_TOP + PLOT_HEIGHT}
            className="stroke-border"
            strokeWidth={1}
          />
        </svg>

        {activePoint ? (
          <div
            className="pointer-events-none absolute top-0 z-10 w-max -translate-x-1/2 rounded-lg border border-border bg-popover px-3 py-2 shadow-raised"
            style={{ left: `${(bandCenter(active!) / VIEW_WIDTH) * 100}%` }}
          >
            <p className="text-xs font-medium capitalize">{formatMonthLong(activePoint.month)}</p>
            <dl className="mt-1.5 space-y-1">
              {SERIES.map((series) => (
                <div key={series.key} className="flex items-center gap-2 text-xs">
                  <span className={cn("size-2 rounded-sm", series.swatch)} aria-hidden />
                  <dt className="text-muted-foreground">{series.label}</dt>
                  <dd className="tabular ml-auto pl-3 font-medium">
                    {formatAmount(activePoint[series.key])}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        ) : null}
      </div>

      {/* Relief d'accessibilité : les mêmes données, lisibles sans percevoir la couleur. */}
      <details className="mt-4 text-sm">
        <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
          Afficher les données en tableau
        </summary>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="py-2 pr-4 font-medium">Mois</th>
                <th className="py-2 pr-4 text-right font-medium">Facturé</th>
                <th className="py-2 text-right font-medium">Encaissé</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {data.map((point) => (
                <tr key={point.month}>
                  <td className="py-2 pr-4 capitalize">{formatMonthLong(point.month)}</td>
                  <td className="tabular py-2 pr-4 text-right">{formatAmount(point.invoiced)}</td>
                  <td className="tabular py-2 text-right">{formatAmount(point.paid)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}
