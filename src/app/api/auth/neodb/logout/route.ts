import { NextResponse } from "next/server";
import { OAUTH_COOKIE, SESSION_COOKIE } from "@/lib/neodb-auth";

export async function POST() {
  const response = NextResponse.json({ ok: true });

  response.cookies.delete(SESSION_COOKIE);
  response.cookies.delete(OAUTH_COOKIE);

  return response;
}
