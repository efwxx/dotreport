import { NextResponse } from "next/server";
import { getRecentTrack } from "@/lib/lastfm";

export const revalidate = 30;

export async function GET() {
  try {
    const track = await getRecentTrack();
    return NextResponse.json({ track });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
