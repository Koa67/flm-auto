/**
 * Generate static ISOFIX SVG files for SEO and sharing.
 * Reads family_fit_compatibility + generation/model/brand data.
 * Outputs to public/isofix/ and updates isofix_schema_url in interior_dimensions.
 *
 * Usage: npx ts-node --compiler-options '{"module":"CommonJS"}' scripts/generate-isofix-svgs.ts
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';

dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const OUTPUT_DIR = path.resolve(__dirname, '../public/isofix');

// ─── paginateAll ──────────────────────────────────────────

async function paginateAll(table: string, select: string): Promise<any[]> {
  const all: any[] = [];
  let page = 0;
  while (true) {
    const { data, error } = await supabase
      .from(table)
      .select(select)
      .range(page * 1000, (page + 1) * 1000 - 1);
    if (error) { console.error(`  Error ${table} page ${page}: ${error.message}`); break; }
    if (!data || data.length === 0) break;
    all.push(...data);
    if (data.length < 1000) break;
    page++;
  }
  return all;
}

// ─── SVG generation ───────────────────────────────────────

function generateSVG(opts: {
  title: string;
  isofixPositions: string[];
  centerIsofix: boolean;
  topTetherPoints: number;
  benchWidthMm?: number;
}): string {
  const { title, isofixPositions, centerIsofix, topTetherPoints, benchWidthMm } = opts;
  const w = 400, h = 200;
  const seatW = 100, seatH = 70, gap = 10;
  const totalW = seatW * 3 + gap * 2;
  const startX = (w - totalW) / 2;
  const seatY = 55;

  const positions: Array<{ key: string; label: string }> = [
    { key: 'left', label: 'Gauche' },
    { key: 'center', label: 'Centre' },
    { key: 'right', label: 'Droite' },
  ];

  const hasIsofix = (key: string) => isofixPositions.includes(key);

  const isofixCount = isofixPositions.length;
  const tetherPerSeat = topTetherPoints > 0 && isofixCount > 0
    ? Math.min(topTetherPoints, isofixCount)
    : 0;

  let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">
<rect width="${w}" height="${h}" fill="#18181b"/>
<text x="${w / 2}" y="22" text-anchor="middle" fill="#fff" font-family="system-ui,sans-serif" font-size="13" font-weight="bold">${escapeXml(title)}</text>
<text x="${w / 2}" y="40" text-anchor="middle" fill="#a1a1aa" font-family="system-ui,sans-serif" font-size="10">Configuration ISOFIX - ${isofixCount}/3 positions</text>
`;

  positions.forEach((pos, i) => {
    const x = startX + i * (seatW + gap);
    const isofix = hasIsofix(pos.key);
    const fillColor = isofix ? '#052e16' : '#27272a';
    const strokeColor = isofix ? '#22c55e' : '#3f3f46';
    const iconColor = isofix ? '#22c55e' : '#71717a';
    const icon = isofix ? '\u2713' : '\u2717';

    svg += `<rect x="${x}" y="${seatY}" width="${seatW}" height="${seatH}" rx="8" fill="${fillColor}" stroke="${strokeColor}" stroke-width="2"/>
<text x="${x + seatW / 2}" y="${seatY + seatH / 2 + 7}" text-anchor="middle" fill="${iconColor}" font-family="system-ui,sans-serif" font-size="22" font-weight="bold">${icon}</text>
<text x="${x + seatW / 2}" y="${seatY + seatH + 16}" text-anchor="middle" fill="#a1a1aa" font-family="system-ui,sans-serif" font-size="10">${pos.label}</text>
`;

    // Top tether badge
    if (isofix && tetherPerSeat > 0) {
      const tetherAssigned = i === 0 || i === 2 || (i === 1 && topTetherPoints >= isofixCount);
      if (tetherAssigned) {
        svg += `<rect x="${x + seatW - 22}" y="${seatY + 2}" width="20" height="16" rx="4" fill="#3b82f6"/>
<text x="${x + seatW - 12}" y="${seatY + 14}" text-anchor="middle" fill="#fff" font-family="system-ui,sans-serif" font-size="11" font-weight="bold">T</text>
`;
      }
    }
  });

  if (benchWidthMm) {
    svg += `<text x="${w / 2}" y="${h - 12}" text-anchor="middle" fill="#71717a" font-family="system-ui,sans-serif" font-size="10">Largeur banquette : ${benchWidthMm} mm</text>
`;
  }

  svg += `</svg>`;
  return svg;
}

function escapeXml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ─── Main ────────────────────────────────────────────────

async function main() {
  console.log('=== ISOFIX SVG Generator ===\n');

  if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  // Load family_fit data with ISOFIX
  const fits = await paginateAll(
    'family_fit_compatibility',
    'generation_id, isofix_positions, center_isofix, top_tether_points, rear_bench_width_usable_mm'
  );
  const withIsofix = fits.filter(f => f.isofix_positions && f.isofix_positions.length > 0);
  console.log(`  ${withIsofix.length} generations with ISOFIX data`);

  // Load generation + model + brand info
  const gens = await paginateAll('generations', 'id, name, internal_code, slug, model_id');
  const models = await paginateAll('models', 'id, name, slug, brand_id');
  const brands = await paginateAll('brands', 'id, name, slug');

  const brandById = new Map(brands.map((b: any) => [b.id, b]));
  const modelById = new Map(models.map((m: any) => [m.id, m]));
  const genById = new Map(gens.map((g: any) => [g.id, g]));

  let count = 0;
  let errors = 0;

  for (const fit of withIsofix) {
    const gen = genById.get(fit.generation_id);
    if (!gen) continue;
    const model = modelById.get(gen.model_id);
    if (!model) continue;
    const brand = brandById.get(model.brand_id);
    if (!brand) continue;

    const title = `${brand.name} ${model.name} ${gen.internal_code || gen.name}`;
    const slug = `${brand.slug}-${model.slug}-${gen.slug}`;

    const svg = generateSVG({
      title,
      isofixPositions: fit.isofix_positions,
      centerIsofix: fit.center_isofix ?? false,
      topTetherPoints: fit.top_tether_points ?? 0,
      benchWidthMm: fit.rear_bench_width_usable_mm,
    });

    const filePath = path.join(OUTPUT_DIR, `${slug}.svg`);
    fs.writeFileSync(filePath, svg);

    // Update interior_dimensions with schema URL (if row exists)
    const { error } = await supabase
      .from('interior_dimensions')
      .update({ isofix_schema_url: `/isofix/${slug}.svg` })
      .eq('generation_id', fit.generation_id);
    if (error) errors++;

    count++;
  }

  console.log(`\n=== Done ===`);
  console.log(`  SVG files generated: ${count}`);
  console.log(`  DB update errors: ${errors}`);
  console.log(`  Output dir: ${OUTPUT_DIR}`);
}

main().catch(console.error);
