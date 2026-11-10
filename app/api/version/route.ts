import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/** Version en ligne, comparée par les fenêtres ouvertes à la leur. */
export function GET() {
  return NextResponse.json(
    { version: process.env.NEXT_PUBLIC_BUILD_ID ?? null },
    { headers: { "Cache-Control": "no-store" } },
  );
}
