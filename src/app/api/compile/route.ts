import { NextResponse } from "next/server";
import { z } from "zod";
import { compileTemplate } from "@/lib/compiler";
import { prisma } from "@/lib/db";

const compileSchema = z.object({
  userParams: z.string().optional().default(""),
  aiTunables: z.string().optional().default(""),
  helpers: z.string().optional().default(""),
  main: z.string().optional().default(""),
  helperSnippetIds: z.array(z.string()).optional().default([])
});

export async function POST(request: Request) {
  try {
    const payload = compileSchema.parse(await request.json());
    const helperSnippets = payload.helperSnippetIds.length
      ? await prisma.helperSnippet.findMany({
          where: { id: { in: payload.helperSnippetIds } },
          orderBy: { createdAt: "asc" }
        })
      : [];
    const compiled = compileTemplate({
      userParams: payload.userParams,
      aiTunables: payload.aiTunables,
      helpers: payload.helpers,
      helperSnippets: helperSnippets.map((snippet: { code: string }) => snippet.code),
      main: payload.main
    });
    return NextResponse.json({ compiled });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid request";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
