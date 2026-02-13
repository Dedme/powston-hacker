import { NextResponse } from "next/server";
import { cookies } from "next/headers";

export async function GET() {
  const cookieStore = cookies();
  const apiKey = cookieStore.get("powston_api_key")?.value;
  return NextResponse.json({ authenticated: !!apiKey });
}

export async function POST(request: Request) {
  try {
    const { apiKey } = await request.json();
    if (!apiKey || typeof apiKey !== "string" || apiKey.length < 10) {
      return NextResponse.json({ error: "Invalid API key" }, { status: 400 });
    }

    // Validate the API key against Powston
    const baseUrl = process.env.POWSTON_API_BASE_URL || "https://app.powston.com";
    const res = await fetch(`${baseUrl}/api/user_api_key`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });

    if (!res.ok) {
      return NextResponse.json(
        { error: "Invalid API key — could not authenticate with Powston" },
        { status: 401 }
      );
    }

    // Store API key in an httpOnly cookie
    const response = NextResponse.json({ authenticated: true });
    response.cookies.set("powston_api_key", apiKey, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 90, // 90 days
    });

    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Auth failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function DELETE() {
  const response = NextResponse.json({ authenticated: false });
  response.cookies.delete("powston_api_key");
  return response;
}
