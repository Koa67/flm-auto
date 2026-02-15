import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { logError } from '@/lib/logger';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

/**
 * GET /api/recalls
 * Fetch vehicle recalls for a specific generation or brand+model
 *
 * Query params:
 * - generation_id: UUID of the generation (primary lookup)
 * - brand: brand name (alternative lookup, requires model)
 * - model: model name (alternative lookup, requires brand)
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);

  const generationId = searchParams.get('generation_id');
  const brand = searchParams.get('brand');
  const model = searchParams.get('model');

  try {
    // Primary lookup: by generation_id
    if (generationId) {
      const { data, error } = await supabase
        .from('vehicle_recalls')
        .select('*')
        .eq('generation_id', generationId)
        .order('recall_date', { ascending: false })
        .limit(50);

      if (error) {
        logError(error, { endpoint: "/api/recalls" });
        return NextResponse.json(
          { error: 'Erreur lors de la recherche des rappels' },
          { status: 500 }
        );
      }

      return NextResponse.json({
        recalls: data || [],
        count: data?.length || 0,
      });
    }

    // Alternative lookup: by brand + model
    if (brand && model) {
      const { data, error } = await supabase
        .from('vehicle_recalls')
        .select('*')
        .ilike('brand', `%${brand}%`)
        .ilike('model', `%${model}%`)
        .order('recall_date', { ascending: false })
        .limit(50);

      if (error) {
        logError(error, { endpoint: "/api/recalls" });
        return NextResponse.json(
          { error: 'Erreur lors de la recherche des rappels' },
          { status: 500 }
        );
      }

      return NextResponse.json({
        recalls: data || [],
        count: data?.length || 0,
      });
    }

    // No valid params provided
    return NextResponse.json(
      { error: 'Parametre requis : generation_id ou brand+model' },
      { status: 400 }
    );
  } catch (err) {
    logError(err, { endpoint: "/api/recalls" });
    return NextResponse.json(
      { error: 'Erreur interne du serveur' },
      { status: 500 }
    );
  }
}
