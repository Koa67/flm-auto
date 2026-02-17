"use client";

import { cn } from "@/lib/utils";

interface VehicleSilhouetteProps {
  length: number;
  width: number;
  height: number;
  wheelbase: number;
  groundClearance?: number;
  view: "side" | "front" | "top";
  label?: string;
  color?: string;
  className?: string;
}

type BodyType = "suv" | "sedan" | "hatchback";

function getBodyType(height: number, length: number, groundClearance?: number): BodyType {
  const ratio = height / length;
  if (ratio > 0.38 || (groundClearance && groundClearance > 180)) return "suv";
  if (ratio < 0.32) return "sedan";
  return "hatchback";
}

// ---------------------------------------------------------------------------
// SVG Marker definitions (arrowheads)
// ---------------------------------------------------------------------------
function DimensionMarkers() {
  return (
    <defs>
      <marker
        id="arrow-red-start"
        markerWidth="8"
        markerHeight="6"
        refX="0"
        refY="3"
        orient="auto"
      >
        <polygon points="8,0 0,3 8,6" fill="#ef4444" />
      </marker>
      <marker
        id="arrow-red-end"
        markerWidth="8"
        markerHeight="6"
        refX="8"
        refY="3"
        orient="auto"
      >
        <polygon points="0,0 8,3 0,6" fill="#ef4444" />
      </marker>
      <marker
        id="arrow-green-start"
        markerWidth="8"
        markerHeight="6"
        refX="0"
        refY="3"
        orient="auto"
      >
        <polygon points="8,0 0,3 8,6" fill="#22c55e" />
      </marker>
      <marker
        id="arrow-green-end"
        markerWidth="8"
        markerHeight="6"
        refX="8"
        refY="3"
        orient="auto"
      >
        <polygon points="0,0 8,3 0,6" fill="#22c55e" />
      </marker>
    </defs>
  );
}

// ---------------------------------------------------------------------------
// SIDE VIEW
// ---------------------------------------------------------------------------
function SideView({
  length,
  width: _width,
  height,
  wheelbase,
  groundClearance,
  label,
  color,
}: Omit<VehicleSilhouetteProps, "view" | "className">) {
  const scale = 0.12;
  const pad = 60;
  const bottomExtra = 40;

  const sL = length * scale;
  const sH = height * scale;
  const sWB = wheelbase * scale;
  const sGC = groundClearance ? groundClearance * scale : 0;

  const wheelRadius = length * 0.07 * scale;
  const frontOverhang = (length - wheelbase) * 0.4 * scale;
  const frontAxleX = pad + frontOverhang;
  const rearAxleX = frontAxleX + sWB;
  const groundY = pad + sH;

  const svgW = sL + pad * 2;
  const svgH = sH + pad + bottomExtra + 60;

  const bodyType = getBodyType(height, length, groundClearance);

  // Build body path depending on body type
  const bodyLeft = pad;
  const bodyRight = pad + sL;
  const bodyBottom = groundY;
  const bodyTop = pad;

  let bodyPath: string;
  const hoodHeight = bodyType === "suv" ? sH * 0.42 : sH * 0.38;
  const hoodY = bodyBottom - hoodHeight;
  const windshieldStartX = bodyLeft + sL * 0.28;
  const roofStartX = bodyLeft + sL * 0.35;
  const roofY = bodyTop;

  if (bodyType === "suv") {
    const roofEndX = bodyLeft + sL * 0.78;
    const rearWindowEndX = bodyLeft + sL * 0.85;
    bodyPath = [
      `M ${bodyLeft} ${bodyBottom}`,
      `L ${bodyLeft} ${hoodY}`,
      `L ${bodyLeft + sL * 0.05} ${hoodY - sH * 0.05}`,
      `L ${windshieldStartX} ${hoodY - sH * 0.05}`,
      `L ${roofStartX} ${roofY + sH * 0.02}`,
      `L ${roofEndX} ${roofY}`,
      `L ${rearWindowEndX} ${roofY + sH * 0.15}`,
      `L ${bodyRight - sL * 0.05} ${roofY + sH * 0.18}`,
      `L ${bodyRight} ${bodyBottom - sH * 0.08}`,
      `L ${bodyRight} ${bodyBottom}`,
      `Z`,
    ].join(" ");
  } else if (bodyType === "sedan") {
    const roofEndX = bodyLeft + sL * 0.65;
    const rearWindowEndX = bodyLeft + sL * 0.76;
    const trunkTopY = bodyBottom - sH * 0.35;
    bodyPath = [
      `M ${bodyLeft} ${bodyBottom}`,
      `L ${bodyLeft} ${hoodY}`,
      `L ${bodyLeft + sL * 0.04} ${hoodY - sH * 0.04}`,
      `L ${windshieldStartX} ${hoodY - sH * 0.04}`,
      `L ${roofStartX} ${roofY + sH * 0.03}`,
      `L ${roofEndX} ${roofY}`,
      `L ${rearWindowEndX} ${trunkTopY}`,
      `L ${bodyRight - sL * 0.02} ${trunkTopY - sH * 0.02}`,
      `L ${bodyRight} ${trunkTopY + sH * 0.05}`,
      `L ${bodyRight} ${bodyBottom}`,
      `Z`,
    ].join(" ");
  } else {
    // hatchback
    const roofEndX = bodyLeft + sL * 0.68;
    const rearEndX = bodyLeft + sL * 0.88;
    bodyPath = [
      `M ${bodyLeft} ${bodyBottom}`,
      `L ${bodyLeft} ${hoodY}`,
      `L ${bodyLeft + sL * 0.04} ${hoodY - sH * 0.04}`,
      `L ${windshieldStartX} ${hoodY - sH * 0.04}`,
      `L ${roofStartX} ${roofY + sH * 0.03}`,
      `L ${roofEndX} ${roofY}`,
      `L ${rearEndX} ${bodyBottom - sH * 0.2}`,
      `L ${bodyRight} ${bodyBottom - sH * 0.1}`,
      `L ${bodyRight} ${bodyBottom}`,
      `Z`,
    ].join(" ");
  }

  // Windows path
  const winLeft = windshieldStartX + sL * 0.01;
  const winBottom = hoodY - sH * 0.02;
  let windowPath: string;

  if (bodyType === "suv") {
    const winTop = roofY + sH * 0.06;
    const winRoofEnd = bodyLeft + sL * 0.76;
    windowPath = [
      `M ${winLeft} ${winBottom}`,
      `L ${roofStartX + sL * 0.01} ${winTop}`,
      `L ${winRoofEnd} ${winTop - sH * 0.02}`,
      `L ${winRoofEnd + sL * 0.06} ${winBottom + sH * 0.06}`,
      `Z`,
    ].join(" ");
  } else if (bodyType === "sedan") {
    const winTop = roofY + sH * 0.07;
    const winRoofEnd = bodyLeft + sL * 0.63;
    windowPath = [
      `M ${winLeft} ${winBottom}`,
      `L ${roofStartX + sL * 0.01} ${winTop}`,
      `L ${winRoofEnd} ${winTop - sH * 0.03}`,
      `L ${bodyLeft + sL * 0.73} ${winBottom + sH * 0.08}`,
      `Z`,
    ].join(" ");
  } else {
    const winTop = roofY + sH * 0.07;
    const winRoofEnd = bodyLeft + sL * 0.66;
    windowPath = [
      `M ${winLeft} ${winBottom}`,
      `L ${roofStartX + sL * 0.01} ${winTop}`,
      `L ${winRoofEnd} ${winTop - sH * 0.03}`,
      `L ${bodyLeft + sL * 0.82} ${winBottom + sH * 0.1}`,
      `Z`,
    ].join(" ");
  }

  // Dimension annotation Y positions
  const dimLengthY = groundY + 25;
  const dimWheelbaseY = groundY + 45;
  const dimHeightX = bodyRight + 20;

  return (
    <svg
      viewBox={`0 0 ${svgW} ${svgH}`}
      xmlns="http://www.w3.org/2000/svg"
      className="w-full h-full"
      role="img"
      aria-label={label ? `Vue de cote - ${label}` : "Vue de cote du vehicule"}
    >
      <DimensionMarkers />

      {/* Label */}
      {label && (
        <text x={svgW / 2} y={16} textAnchor="middle" fill="currentColor" fontSize="14" fontWeight="bold">
          {label}
        </text>
      )}

      {/* Ground line */}
      <line
        x1={pad - 10}
        y1={groundY}
        x2={bodyRight + 10}
        y2={groundY}
        stroke="#374151"
        strokeWidth="1"
        strokeDasharray="4 2"
      />

      {/* Car body */}
      <path d={bodyPath} fill={color} stroke="#3b82f6" strokeWidth="2" />

      {/* Windows */}
      <path d={windowPath} fill="#1e293b" stroke="#475569" strokeWidth="1.5" />

      {/* Front wheel */}
      <circle cx={frontAxleX} cy={groundY} r={wheelRadius} fill="#1f2937" stroke="#374151" strokeWidth="2" />
      <circle cx={frontAxleX} cy={groundY} r={wheelRadius * 0.55} fill="#6b7280" stroke="#4b5563" strokeWidth="1" />

      {/* Rear wheel */}
      <circle cx={rearAxleX} cy={groundY} r={wheelRadius} fill="#1f2937" stroke="#374151" strokeWidth="2" />
      <circle cx={rearAxleX} cy={groundY} r={wheelRadius * 0.55} fill="#6b7280" stroke="#4b5563" strokeWidth="1" />

      {/* Length dimension */}
      <line
        x1={pad}
        y1={dimLengthY}
        x2={bodyRight}
        y2={dimLengthY}
        stroke="#ef4444"
        strokeWidth="1.5"
        markerStart="url(#arrow-red-start)"
        markerEnd="url(#arrow-red-end)"
      />
      <line x1={pad} y1={groundY + 2} x2={pad} y2={dimLengthY + 5} stroke="#ef4444" strokeWidth="0.5" strokeDasharray="2 2" />
      <line x1={bodyRight} y1={groundY + 2} x2={bodyRight} y2={dimLengthY + 5} stroke="#ef4444" strokeWidth="0.5" strokeDasharray="2 2" />
      <text
        x={(pad + bodyRight) / 2}
        y={dimLengthY - 4}
        textAnchor="middle"
        fill="#ef4444"
        fontSize="12"
        fontWeight="bold"
      >
        {length} mm
      </text>

      {/* Wheelbase dimension */}
      <line
        x1={frontAxleX}
        y1={dimWheelbaseY}
        x2={rearAxleX}
        y2={dimWheelbaseY}
        stroke="#22c55e"
        strokeWidth="1.5"
        markerStart="url(#arrow-green-start)"
        markerEnd="url(#arrow-green-end)"
      />
      <line x1={frontAxleX} y1={groundY + 2} x2={frontAxleX} y2={dimWheelbaseY + 5} stroke="#22c55e" strokeWidth="0.5" strokeDasharray="2 2" />
      <line x1={rearAxleX} y1={groundY + 2} x2={rearAxleX} y2={dimWheelbaseY + 5} stroke="#22c55e" strokeWidth="0.5" strokeDasharray="2 2" />
      <text
        x={(frontAxleX + rearAxleX) / 2}
        y={dimWheelbaseY - 4}
        textAnchor="middle"
        fill="#22c55e"
        fontSize="12"
        fontWeight="bold"
      >
        Empattement: {wheelbase} mm
      </text>

      {/* Height dimension */}
      <line
        x1={dimHeightX}
        y1={groundY}
        x2={dimHeightX}
        y2={pad}
        stroke="#ef4444"
        strokeWidth="1.5"
        markerStart="url(#arrow-red-start)"
        markerEnd="url(#arrow-red-end)"
      />
      <line x1={bodyRight + 2} y1={groundY} x2={dimHeightX + 5} y2={groundY} stroke="#ef4444" strokeWidth="0.5" strokeDasharray="2 2" />
      <line x1={bodyRight + 2} y1={pad} x2={dimHeightX + 5} y2={pad} stroke="#ef4444" strokeWidth="0.5" strokeDasharray="2 2" />
      <text
        x={dimHeightX + 6}
        y={(pad + groundY) / 2}
        textAnchor="start"
        fill="#ef4444"
        fontSize="12"
        fontWeight="bold"
        transform={`rotate(-90, ${dimHeightX + 6}, ${(pad + groundY) / 2})`}
      >
        {height} mm
      </text>

      {/* Ground clearance */}
      {groundClearance && sGC > 0 && (
        <>
          <line
            x1={(frontAxleX + rearAxleX) / 2}
            y1={groundY}
            x2={(frontAxleX + rearAxleX) / 2}
            y2={groundY + 12}
            stroke="#ef4444"
            strokeWidth="1"
          />
          <line
            x1={(frontAxleX + rearAxleX) / 2 - 10}
            y1={groundY}
            x2={(frontAxleX + rearAxleX) / 2 + 10}
            y2={groundY}
            stroke="#ef4444"
            strokeWidth="1"
          />
          <line
            x1={(frontAxleX + rearAxleX) / 2 - 10}
            y1={groundY - sGC}
            x2={(frontAxleX + rearAxleX) / 2 + 10}
            y2={groundY - sGC}
            stroke="#ef4444"
            strokeWidth="1"
            strokeDasharray="3 2"
          />
          <text
            x={(frontAxleX + rearAxleX) / 2 + 14}
            y={groundY - sGC / 2 + 4}
            fill="#ef4444"
            fontSize="10"
            fontWeight="bold"
          >
            GAV: {groundClearance} mm
          </text>
        </>
      )}
    </svg>
  );
}

// ---------------------------------------------------------------------------
// FRONT VIEW
// ---------------------------------------------------------------------------
function FrontView({
  length: _length,
  width,
  height,
  wheelbase: _wheelbase,
  groundClearance: _groundClearance,
  label,
  color,
}: Omit<VehicleSilhouetteProps, "view" | "className">) {
  const scale = 0.12;
  const pad = 60;
  const bottomExtra = 40;

  const sW = width * scale;
  const sH = height * scale;

  const svgW = sW + pad * 2;
  const svgH = sH + pad + bottomExtra + 20;

  const centerX = svgW / 2;
  const groundY = pad + sH;

  const wheelArchWidth = sW * 0.18;
  const wheelArchHeight = sH * 0.2;
  const bodyWidth = sW;
  const halfBody = bodyWidth / 2;

  // Front body path (symmetrical)
  const roofWidth = halfBody * 0.6;
  const roofY = pad + sH * 0.05;
  const windowBottomY = pad + sH * 0.4;
  const bodyBottomY = groundY;

  const bodyPath = [
    // Start bottom left
    `M ${centerX - halfBody} ${bodyBottomY}`,
    // Left side up to window line
    `L ${centerX - halfBody} ${windowBottomY + sH * 0.05}`,
    // Left A-pillar to roof
    `L ${centerX - roofWidth} ${roofY + sH * 0.08}`,
    // Roof left to right
    `Q ${centerX} ${roofY} ${centerX + roofWidth} ${roofY + sH * 0.08}`,
    // Right A-pillar down
    `L ${centerX + halfBody} ${windowBottomY + sH * 0.05}`,
    // Right side down
    `L ${centerX + halfBody} ${bodyBottomY}`,
    `Z`,
  ].join(" ");

  // Windshield
  const windowPath = [
    `M ${centerX - halfBody * 0.75} ${windowBottomY}`,
    `L ${centerX - roofWidth * 0.9} ${roofY + sH * 0.13}`,
    `Q ${centerX} ${roofY + sH * 0.06} ${centerX + roofWidth * 0.9} ${roofY + sH * 0.13}`,
    `L ${centerX + halfBody * 0.75} ${windowBottomY}`,
    `Z`,
  ].join(" ");

  // Grille area
  const grilleTop = windowBottomY + sH * 0.2;
  const grilleBottom = bodyBottomY - sH * 0.18;
  const grilleHalfW = halfBody * 0.55;

  // Headlights
  const headlightY = windowBottomY + sH * 0.15;
  const headlightH = sH * 0.12;
  const headlightW = sW * 0.12;

  const dimLengthY = groundY + 25;
  const dimHeightX = centerX + halfBody + 20;

  return (
    <svg
      viewBox={`0 0 ${svgW} ${svgH}`}
      xmlns="http://www.w3.org/2000/svg"
      className="w-full h-full"
      role="img"
      aria-label={label ? `Vue de face - ${label}` : "Vue de face du vehicule"}
    >
      <DimensionMarkers />

      {label && (
        <text x={centerX} y={16} textAnchor="middle" fill="currentColor" fontSize="14" fontWeight="bold">
          {label}
        </text>
      )}

      {/* Ground line */}
      <line
        x1={pad - 10}
        y1={groundY}
        x2={svgW - pad + 10}
        y2={groundY}
        stroke="#374151"
        strokeWidth="1"
        strokeDasharray="4 2"
      />

      {/* Body */}
      <path d={bodyPath} fill={color} stroke="#3b82f6" strokeWidth="2" />

      {/* Windshield */}
      <path d={windowPath} fill="#1e293b" stroke="#475569" strokeWidth="1.5" />

      {/* Grille */}
      <rect
        x={centerX - grilleHalfW}
        y={grilleTop}
        width={grilleHalfW * 2}
        height={grilleBottom - grilleTop}
        rx="4"
        fill="#111827"
        stroke="#374151"
        strokeWidth="1"
      />

      {/* Headlights */}
      <ellipse
        cx={centerX - halfBody * 0.7}
        cy={headlightY + headlightH / 2}
        rx={headlightW / 2}
        ry={headlightH / 2}
        fill="#fbbf24"
        stroke="#d97706"
        strokeWidth="1"
        opacity="0.8"
      />
      <ellipse
        cx={centerX + halfBody * 0.7}
        cy={headlightY + headlightH / 2}
        rx={headlightW / 2}
        ry={headlightH / 2}
        fill="#fbbf24"
        stroke="#d97706"
        strokeWidth="1"
        opacity="0.8"
      />

      {/* Wheel arches */}
      <path
        d={`M ${centerX - halfBody} ${bodyBottomY}
            A ${wheelArchWidth / 2} ${wheelArchHeight} 0 0 1 ${centerX - halfBody + wheelArchWidth} ${bodyBottomY}`}
        fill="#111827"
        stroke="#374151"
        strokeWidth="1"
      />
      <path
        d={`M ${centerX + halfBody - wheelArchWidth} ${bodyBottomY}
            A ${wheelArchWidth / 2} ${wheelArchHeight} 0 0 1 ${centerX + halfBody} ${bodyBottomY}`}
        fill="#111827"
        stroke="#374151"
        strokeWidth="1"
      />

      {/* Wheels (partial circles at bottom) */}
      <ellipse
        cx={centerX - halfBody + wheelArchWidth / 2}
        cy={bodyBottomY}
        rx={wheelArchWidth * 0.35}
        ry={wheelArchHeight * 0.5}
        fill="#1f2937"
        stroke="#374151"
        strokeWidth="2"
      />
      <ellipse
        cx={centerX + halfBody - wheelArchWidth / 2}
        cy={bodyBottomY}
        rx={wheelArchWidth * 0.35}
        ry={wheelArchHeight * 0.5}
        fill="#1f2937"
        stroke="#374151"
        strokeWidth="2"
      />

      {/* Width dimension */}
      <line
        x1={centerX - halfBody}
        y1={dimLengthY}
        x2={centerX + halfBody}
        y2={dimLengthY}
        stroke="#ef4444"
        strokeWidth="1.5"
        markerStart="url(#arrow-red-start)"
        markerEnd="url(#arrow-red-end)"
      />
      <line x1={centerX - halfBody} y1={groundY + 2} x2={centerX - halfBody} y2={dimLengthY + 5} stroke="#ef4444" strokeWidth="0.5" strokeDasharray="2 2" />
      <line x1={centerX + halfBody} y1={groundY + 2} x2={centerX + halfBody} y2={dimLengthY + 5} stroke="#ef4444" strokeWidth="0.5" strokeDasharray="2 2" />
      <text
        x={centerX}
        y={dimLengthY - 4}
        textAnchor="middle"
        fill="#ef4444"
        fontSize="12"
        fontWeight="bold"
      >
        {width} mm
      </text>

      {/* Height dimension */}
      <line
        x1={dimHeightX}
        y1={groundY}
        x2={dimHeightX}
        y2={pad}
        stroke="#ef4444"
        strokeWidth="1.5"
        markerStart="url(#arrow-red-start)"
        markerEnd="url(#arrow-red-end)"
      />
      <line x1={centerX + halfBody + 2} y1={groundY} x2={dimHeightX + 5} y2={groundY} stroke="#ef4444" strokeWidth="0.5" strokeDasharray="2 2" />
      <line x1={centerX + halfBody + 2} y1={pad} x2={dimHeightX + 5} y2={pad} stroke="#ef4444" strokeWidth="0.5" strokeDasharray="2 2" />
      <text
        x={dimHeightX + 6}
        y={(pad + groundY) / 2}
        textAnchor="start"
        fill="#ef4444"
        fontSize="12"
        fontWeight="bold"
        transform={`rotate(-90, ${dimHeightX + 6}, ${(pad + groundY) / 2})`}
      >
        {height} mm
      </text>
    </svg>
  );
}

// ---------------------------------------------------------------------------
// TOP VIEW
// ---------------------------------------------------------------------------
function TopView({
  length,
  width,
  height,
  wheelbase,
  groundClearance,
  label,
  color,
}: Omit<VehicleSilhouetteProps, "view" | "className">) {
  const scale = 0.08;
  const pad = 60;
  const bottomExtra = 40;

  const sL = length * scale;
  const sW = width * scale;
  const sWB = wheelbase * scale;

  const svgW = sW + pad * 2 + 80;
  const svgH = sL + pad + bottomExtra + 20;

  const centerX = pad + sW / 2;
  const topY = pad;
  const bottomY = pad + sL;

  const frontOverhang = (length - wheelbase) * 0.4 * scale;
  const frontAxleY = topY + frontOverhang;
  const rearAxleY = frontAxleY + sWB;

  const halfW = sW / 2;

  const bodyType = getBodyType(height, length, groundClearance);

  // Top-down body shape
  const noseNarrow = bodyType === "sedan" ? 0.75 : bodyType === "suv" ? 0.85 : 0.78;
  const rearNarrow = bodyType === "sedan" ? 0.7 : bodyType === "suv" ? 0.9 : 0.8;
  const cabinStartY = topY + sL * 0.25;
  const cabinEndY = topY + sL * 0.7;

  const bodyPath = [
    // Front (nose) - narrower
    `M ${centerX - halfW * noseNarrow * 0.5} ${topY}`,
    `Q ${centerX} ${topY - sL * 0.01} ${centerX + halfW * noseNarrow * 0.5} ${topY}`,
    // Right side front widens
    `L ${centerX + halfW * noseNarrow} ${topY + sL * 0.08}`,
    `Q ${centerX + halfW * 1.02} ${cabinStartY} ${centerX + halfW} ${cabinStartY + sL * 0.05}`,
    // Right side cabin (widest)
    `L ${centerX + halfW} ${cabinEndY}`,
    // Right side rear narrows
    `Q ${centerX + halfW * 1.02} ${cabinEndY + sL * 0.08} ${centerX + halfW * rearNarrow} ${bottomY - sL * 0.05}`,
    `L ${centerX + halfW * rearNarrow * 0.6} ${bottomY}`,
    // Rear
    `Q ${centerX} ${bottomY + sL * 0.01} ${centerX - halfW * rearNarrow * 0.6} ${bottomY}`,
    // Left side rear
    `L ${centerX - halfW * rearNarrow} ${bottomY - sL * 0.05}`,
    `Q ${centerX - halfW * 1.02} ${cabinEndY + sL * 0.08} ${centerX - halfW} ${cabinEndY}`,
    // Left side cabin
    `L ${centerX - halfW} ${cabinStartY + sL * 0.05}`,
    `Q ${centerX - halfW * 1.02} ${cabinStartY} ${centerX - halfW * noseNarrow} ${topY + sL * 0.08}`,
    `L ${centerX - halfW * noseNarrow * 0.5} ${topY}`,
    `Z`,
  ].join(" ");

  // Windshield + rear window (top view)
  const windshieldY1 = cabinStartY - sL * 0.02;
  const windshieldY2 = cabinStartY + sL * 0.08;
  const rearWindowY1 = cabinEndY - sL * 0.02;
  const rearWindowY2 = cabinEndY + sL * 0.05;
  const winHalfW = halfW * 0.7;

  // Wheel positions (small rectangles)
  const wheelW = sW * 0.08;
  const wheelH = sL * 0.04;

  const dimLengthX = centerX + halfW + 25;
  const dimWheelbaseX = centerX + halfW + 50;
  const dimWidthY = bottomY + 25;

  return (
    <svg
      viewBox={`0 0 ${svgW} ${svgH}`}
      xmlns="http://www.w3.org/2000/svg"
      className="w-full h-full"
      role="img"
      aria-label={label ? `Vue de dessus - ${label}` : "Vue de dessus du vehicule"}
    >
      <DimensionMarkers />

      {label && (
        <text x={svgW / 2} y={16} textAnchor="middle" fill="currentColor" fontSize="14" fontWeight="bold">
          {label}
        </text>
      )}

      {/* Body */}
      <path d={bodyPath} fill={color} stroke="#3b82f6" strokeWidth="2" />

      {/* Windshield */}
      <path
        d={`M ${centerX - winHalfW} ${windshieldY1}
            Q ${centerX} ${windshieldY1 - sL * 0.01} ${centerX + winHalfW} ${windshieldY1}
            L ${centerX + winHalfW * 0.95} ${windshieldY2}
            L ${centerX - winHalfW * 0.95} ${windshieldY2}
            Z`}
        fill="#1e293b"
        stroke="#475569"
        strokeWidth="1.5"
      />

      {/* Rear window */}
      <path
        d={`M ${centerX - winHalfW * 0.85} ${rearWindowY1}
            L ${centerX + winHalfW * 0.85} ${rearWindowY1}
            L ${centerX + winHalfW * 0.7} ${rearWindowY2}
            Q ${centerX} ${rearWindowY2 + sL * 0.005} ${centerX - winHalfW * 0.7} ${rearWindowY2}
            Z`}
        fill="#1e293b"
        stroke="#475569"
        strokeWidth="1.5"
      />

      {/* Wheels - front left */}
      <rect x={centerX - halfW - wheelW * 0.3} y={frontAxleY - wheelH / 2} width={wheelW} height={wheelH} rx="2" fill="#1f2937" stroke="#374151" strokeWidth="1.5" />
      {/* Wheels - front right */}
      <rect x={centerX + halfW - wheelW * 0.7} y={frontAxleY - wheelH / 2} width={wheelW} height={wheelH} rx="2" fill="#1f2937" stroke="#374151" strokeWidth="1.5" />
      {/* Wheels - rear left */}
      <rect x={centerX - halfW - wheelW * 0.3} y={rearAxleY - wheelH / 2} width={wheelW} height={wheelH} rx="2" fill="#1f2937" stroke="#374151" strokeWidth="1.5" />
      {/* Wheels - rear right */}
      <rect x={centerX + halfW - wheelW * 0.7} y={rearAxleY - wheelH / 2} width={wheelW} height={wheelH} rx="2" fill="#1f2937" stroke="#374151" strokeWidth="1.5" />

      {/* Length dimension (right side, vertical) */}
      <line
        x1={dimLengthX}
        y1={topY}
        x2={dimLengthX}
        y2={bottomY}
        stroke="#ef4444"
        strokeWidth="1.5"
        markerStart="url(#arrow-red-start)"
        markerEnd="url(#arrow-red-end)"
      />
      <line x1={centerX + halfW + 2} y1={topY} x2={dimLengthX + 5} y2={topY} stroke="#ef4444" strokeWidth="0.5" strokeDasharray="2 2" />
      <line x1={centerX + halfW + 2} y1={bottomY} x2={dimLengthX + 5} y2={bottomY} stroke="#ef4444" strokeWidth="0.5" strokeDasharray="2 2" />
      <text
        x={dimLengthX + 6}
        y={(topY + bottomY) / 2}
        textAnchor="start"
        fill="#ef4444"
        fontSize="12"
        fontWeight="bold"
        transform={`rotate(-90, ${dimLengthX + 6}, ${(topY + bottomY) / 2})`}
      >
        {length} mm
      </text>

      {/* Wheelbase dimension */}
      <line
        x1={dimWheelbaseX}
        y1={frontAxleY}
        x2={dimWheelbaseX}
        y2={rearAxleY}
        stroke="#22c55e"
        strokeWidth="1.5"
        markerStart="url(#arrow-green-start)"
        markerEnd="url(#arrow-green-end)"
      />
      <line x1={centerX + halfW + 2} y1={frontAxleY} x2={dimWheelbaseX + 5} y2={frontAxleY} stroke="#22c55e" strokeWidth="0.5" strokeDasharray="2 2" />
      <line x1={centerX + halfW + 2} y1={rearAxleY} x2={dimWheelbaseX + 5} y2={rearAxleY} stroke="#22c55e" strokeWidth="0.5" strokeDasharray="2 2" />
      <text
        x={dimWheelbaseX + 6}
        y={(frontAxleY + rearAxleY) / 2}
        textAnchor="start"
        fill="#22c55e"
        fontSize="11"
        fontWeight="bold"
        transform={`rotate(-90, ${dimWheelbaseX + 6}, ${(frontAxleY + rearAxleY) / 2})`}
      >
        Empattement: {wheelbase} mm
      </text>

      {/* Width dimension (bottom) */}
      <line
        x1={centerX - halfW}
        y1={dimWidthY}
        x2={centerX + halfW}
        y2={dimWidthY}
        stroke="#ef4444"
        strokeWidth="1.5"
        markerStart="url(#arrow-red-start)"
        markerEnd="url(#arrow-red-end)"
      />
      <line x1={centerX - halfW} y1={bottomY + 2} x2={centerX - halfW} y2={dimWidthY + 5} stroke="#ef4444" strokeWidth="0.5" strokeDasharray="2 2" />
      <line x1={centerX + halfW} y1={bottomY + 2} x2={centerX + halfW} y2={dimWidthY + 5} stroke="#ef4444" strokeWidth="0.5" strokeDasharray="2 2" />
      <text
        x={centerX}
        y={dimWidthY - 4}
        textAnchor="middle"
        fill="#ef4444"
        fontSize="12"
        fontWeight="bold"
      >
        {width} mm
      </text>
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------
export function VehicleSilhouette({
  length,
  width,
  height,
  wheelbase,
  groundClearance,
  view,
  label,
  color = "#1e40af",
  className,
}: VehicleSilhouetteProps) {
  const viewProps = { length, width, height, wheelbase, groundClearance, label, color };

  return (
    <div className={cn("w-full h-full", className)}>
      {view === "side" && <SideView {...viewProps} />}
      {view === "front" && <FrontView {...viewProps} />}
      {view === "top" && <TopView {...viewProps} />}
    </div>
  );
}
