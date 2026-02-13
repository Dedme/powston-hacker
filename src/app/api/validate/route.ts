import { NextResponse } from "next/server";
import { z } from "zod";
import { compileTemplate } from "@/lib/compiler";
import { validateWithPowston } from "@/lib/powston";
import { prisma } from "@/lib/db";

const validateSchema = z.object({
  compiled: z.string().optional(),
  userParams: z.string().optional().default(""),
  aiTunables: z.string().optional().default(""),
  helpers: z.string().optional().default(""),
  main: z.string().optional().default(""),
  helperSnippetIds: z.array(z.string()).optional().default([])
});

export async function POST(request: Request) {
  try {
    const payload = validateSchema.parse(await request.json());
    const helperSnippets = payload.helperSnippetIds.length
      ? await prisma.helperSnippet.findMany({
          where: { id: { in: payload.helperSnippetIds } },
          orderBy: { createdAt: "asc" }
        })
      : [];
    const compiled = payload.compiled ??
      compileTemplate({
        userParams: payload.userParams,
        aiTunables: payload.aiTunables,
        helpers: payload.helpers,
        helperSnippets: helperSnippets.map((snippet: { code: string }) => snippet.code),
        main: payload.main
      });

    const result = await validateWithPowston(compiled);

    return NextResponse.json({
      ok: result.ok ?? true,
      message:
        result.message ??
        (typeof result.details === "string" ? result.details : "Validation complete."),
      details: result.details ?? null
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Validation failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
