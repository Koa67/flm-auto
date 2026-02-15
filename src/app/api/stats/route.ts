import { NextResponse } from "next/server";
import { createStaticClient } from "@/lib/supabase/server";

export const revalidate = 3600;

export async function GET() {
  const db = createStaticClient();

  const [
    { count: brandsCount },
    { count: generationsCount },
    { count: photosCount },
    { count: specsCount },
    { count: videosCount },
  ] = await Promise.all([
    db.from("brands").select("*", { count: "exact", head: true }),
    db.from("generations").select("*", { count: "exact", head: true }),
    db.from("vehicle_images").select("*", { count: "exact", head: true }),
    db.from("third_party_specs").select("*", { count: "exact", head: true }),
    db.from("vehicle_videos").select("*", { count: "exact", head: true }),
  ]);

  return NextResponse.json({
    brands: brandsCount || 0,
    generations: generationsCount || 0,
    photos: photosCount || 0,
    specs: specsCount || 0,
    videos: videosCount || 0,
  });
}
