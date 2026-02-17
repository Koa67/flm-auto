'use client';

import { useState } from 'react';

// ─── Types ─────────────────────────────────────────────

interface ISOFIXSchemaProps {
  isofixPositions: string[];  // e.g. ['left', 'right'] or ['left', 'center', 'right']
  centerIsofix: boolean;
  topTetherPoints: number;   // 0-6
  rearBenchWidthMm?: number; // rear_bench_width_usable_mm or rear_bench_width_total_mm
}

// ─── Constants ─────────────────────────────────────────

type SeatPosition = 'left' | 'center' | 'right';

const POSITIONS: { key: SeatPosition; label: string }[] = [
  { key: 'left', label: 'Gauche' },
  { key: 'center', label: 'Centre' },
  { key: 'right', label: 'Droite' },
];

// ─── Component ─────────────────────────────────────────

export function ISOFIXSchema({
  isofixPositions,
  centerIsofix,
  topTetherPoints,
  rearBenchWidthMm,
}: ISOFIXSchemaProps) {
  const [infoExpanded, setInfoExpanded] = useState(false);

  const isofixCount = isofixPositions.length;

  function hasIsofix(pos: SeatPosition): boolean {
    return isofixPositions.includes(pos);
  }

  function hasTopTether(posIndex: number): boolean {
    // Top tether points are distributed across positions
    // If topTetherPoints >= number of ISOFIX positions, all ISOFIX seats have tether
    // Otherwise, outer positions get priority
    if (topTetherPoints <= 0) return false;
    const isofixSeats = POSITIONS.filter((p) => hasIsofix(p.key));
    if (topTetherPoints >= isofixSeats.length) return hasIsofix(POSITIONS[posIndex].key);
    // Partial: left and right get priority over center
    const priorityOrder: SeatPosition[] = ['left', 'right', 'center'];
    const withTether = priorityOrder.slice(0, topTetherPoints);
    return withTether.includes(POSITIONS[posIndex].key);
  }

  // SVG layout constants
  const svgWidth = 380;
  const svgHeight = 180;
  const seatWidth = 100;
  const seatHeight = 80;
  const seatGap = 12;
  const totalSeatsWidth = seatWidth * 3 + seatGap * 2;
  const startX = (svgWidth - totalSeatsWidth) / 2;
  const seatY = 40;

  return (
    <div className="space-y-4">
      {/* SVG Schema */}
      <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-900">
        <svg
          viewBox={`0 0 ${svgWidth} ${svgHeight}`}
          className="mx-auto w-full max-w-md"
          role="img"
          aria-label="Schema ISOFIX banquette arriere"
        >
          {/* Title */}
          <text
            x={svgWidth / 2}
            y={20}
            textAnchor="middle"
            className="fill-zinc-500 text-[11px] dark:fill-zinc-400"
            fontFamily="system-ui, sans-serif"
            fontSize="11"
          >
            Banquette arriere - Points ISOFIX
          </text>

          {/* Seat positions */}
          {POSITIONS.map((pos, i) => {
            const x = startX + i * (seatWidth + seatGap);
            const isofix = hasIsofix(pos.key);
            const tether = hasTopTether(i);

            return (
              <g key={pos.key}>
                {/* Seat rectangle */}
                <rect
                  x={x}
                  y={seatY}
                  width={seatWidth}
                  height={seatHeight}
                  rx={8}
                  className={
                    isofix
                      ? 'fill-green-50 stroke-green-500 dark:fill-green-950/40 dark:stroke-green-600'
                      : 'fill-zinc-50 stroke-zinc-300 dark:fill-zinc-800 dark:stroke-zinc-600'
                  }
                  strokeWidth={2}
                />

                {/* ISOFIX status icon */}
                {isofix ? (
                  <>
                    {/* Green circle with checkmark */}
                    <circle
                      cx={x + seatWidth / 2}
                      cy={seatY + 30}
                      r={14}
                      className="fill-green-500 dark:fill-green-600"
                    />
                    <path
                      d={`M${x + seatWidth / 2 - 6},${seatY + 30} l4,5 l8,-10`}
                      fill="none"
                      stroke="white"
                      strokeWidth={2.5}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </>
                ) : (
                  <>
                    {/* Red circle with X */}
                    <circle
                      cx={x + seatWidth / 2}
                      cy={seatY + 30}
                      r={14}
                      className="fill-red-500 dark:fill-red-600"
                    />
                    <path
                      d={`M${x + seatWidth / 2 - 5},${seatY + 25} l10,10 M${x + seatWidth / 2 + 5},${seatY + 25} l-10,10`}
                      fill="none"
                      stroke="white"
                      strokeWidth={2.5}
                      strokeLinecap="round"
                    />
                  </>
                )}

                {/* ISOFIX label */}
                <text
                  x={x + seatWidth / 2}
                  y={seatY + 58}
                  textAnchor="middle"
                  className={
                    isofix
                      ? 'fill-green-700 dark:fill-green-400'
                      : 'fill-red-600 dark:fill-red-400'
                  }
                  fontFamily="system-ui, sans-serif"
                  fontSize="9"
                  fontWeight="600"
                >
                  {isofix ? 'ISOFIX' : 'Pas ISOFIX'}
                </text>

                {/* Top tether badge */}
                {tether && (
                  <>
                    <rect
                      x={x + seatWidth - 20}
                      y={seatY - 2}
                      width={22}
                      height={18}
                      rx={4}
                      className="fill-blue-500 dark:fill-blue-600"
                    />
                    <text
                      x={x + seatWidth - 9}
                      y={seatY + 12}
                      textAnchor="middle"
                      fill="white"
                      fontFamily="system-ui, sans-serif"
                      fontSize="11"
                      fontWeight="700"
                    >
                      T
                    </text>
                  </>
                )}

                {/* Position label */}
                <text
                  x={x + seatWidth / 2}
                  y={seatY + seatHeight + 18}
                  textAnchor="middle"
                  className="fill-zinc-500 dark:fill-zinc-400"
                  fontFamily="system-ui, sans-serif"
                  fontSize="11"
                >
                  {pos.label}
                </text>
              </g>
            );
          })}

          {/* Bench width annotation */}
          {rearBenchWidthMm && (
            <g>
              <line
                x1={startX}
                y1={seatY + seatHeight + 34}
                x2={startX + totalSeatsWidth}
                y2={seatY + seatHeight + 34}
                className="stroke-zinc-400 dark:stroke-zinc-500"
                strokeWidth={1}
                markerStart="url(#arrowLeft)"
                markerEnd="url(#arrowRight)"
              />
              <text
                x={svgWidth / 2}
                y={seatY + seatHeight + 48}
                textAnchor="middle"
                className="fill-zinc-500 dark:fill-zinc-400"
                fontFamily="system-ui, sans-serif"
                fontSize="10"
              >
                {rearBenchWidthMm} mm
              </text>
              {/* Arrow markers */}
              <defs>
                <marker
                  id="arrowLeft"
                  markerWidth="6"
                  markerHeight="6"
                  refX="6"
                  refY="3"
                  orient="auto"
                >
                  <path d="M6,0 L0,3 L6,6" className="fill-zinc-400 dark:fill-zinc-500" />
                </marker>
                <marker
                  id="arrowRight"
                  markerWidth="6"
                  markerHeight="6"
                  refX="0"
                  refY="3"
                  orient="auto"
                >
                  <path d="M0,0 L6,3 L0,6" className="fill-zinc-400 dark:fill-zinc-500" />
                </marker>
              </defs>
            </g>
          )}
        </svg>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-zinc-500 dark:text-zinc-400">
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-3 rounded-full bg-green-500" />
          ISOFIX disponible
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-3 rounded-full bg-red-500" />
          Pas d&apos;ISOFIX
        </span>
        {topTetherPoints > 0 && (
          <span className="flex items-center gap-1.5">
            <span className="inline-flex h-4 w-4 items-center justify-center rounded bg-blue-500 text-[9px] font-bold text-white">
              T
            </span>
            Top Tether
          </span>
        )}
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-3 gap-3 text-center">
        <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-2 dark:border-zinc-700 dark:bg-zinc-800">
          <div className="text-lg font-bold text-zinc-900 dark:text-zinc-100">{isofixCount}</div>
          <div className="text-[11px] text-zinc-500 dark:text-zinc-400">Points ISOFIX</div>
        </div>
        <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-2 dark:border-zinc-700 dark:bg-zinc-800">
          <div className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
            {centerIsofix ? 'Oui' : 'Non'}
          </div>
          <div className="text-[11px] text-zinc-500 dark:text-zinc-400">ISOFIX central</div>
        </div>
        <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-2 dark:border-zinc-700 dark:bg-zinc-800">
          <div className="text-lg font-bold text-zinc-900 dark:text-zinc-100">{topTetherPoints}</div>
          <div className="text-[11px] text-zinc-500 dark:text-zinc-400">Top Tether</div>
        </div>
      </div>

      {/* Expandable info section */}
      <div className="rounded-lg border border-zinc-200 dark:border-zinc-700">
        <button
          onClick={() => setInfoExpanded(!infoExpanded)}
          className="flex w-full items-center justify-between px-4 py-3 text-left text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 dark:text-zinc-300 dark:hover:bg-zinc-800"
        >
          <span>Qu&apos;est-ce que l&apos;ISOFIX et le Top Tether ?</span>
          <svg
            className={`h-4 w-4 shrink-0 text-zinc-400 transition-transform duration-200 ${
              infoExpanded ? 'rotate-180' : ''
            }`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {infoExpanded && (
          <div className="space-y-3 border-t border-zinc-200 px-4 py-3 text-sm text-zinc-600 dark:border-zinc-700 dark:text-zinc-400">
            <div>
              <h4 className="font-semibold text-zinc-800 dark:text-zinc-200">ISOFIX</h4>
              <p>
                L&apos;ISOFIX est un systeme de fixation standardise (ISO 13216) pour les sieges
                enfants. Il utilise deux points d&apos;ancrage metalliques integres entre l&apos;assise
                et le dossier de la banquette. Ce systeme reduit considerablement les risques
                de mauvaise installation par rapport a la fixation par ceinture de securite.
              </p>
            </div>
            <div>
              <h4 className="font-semibold text-zinc-800 dark:text-zinc-200">Top Tether</h4>
              <p>
                Le Top Tether est une sangle d&apos;ancrage superieure qui constitue le troisieme
                point de fixation d&apos;un siege enfant. Il limite le basculement vers l&apos;avant
                en cas de choc frontal et ameliore la stabilite globale du siege. Le point
                d&apos;ancrage se situe generalement sur le dossier de la banquette ou sur le
                plancher du coffre.
              </p>
            </div>
            <div>
              <h4 className="font-semibold text-zinc-800 dark:text-zinc-200">Place centrale</h4>
              <p>
                La place centrale de la banquette arriere est statistiquement la plus sure
                pour un enfant. Cependant, tous les vehicules ne disposent pas de fixation
                ISOFIX a cette position. Dans ce cas, le siege enfant doit etre installe
                avec la ceinture de securite 3 points.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
