import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { compileTemplate } from "@/lib/compiler";

const versionSchema = z.object({
  title: z.string().optional().nullable(),
  message: z.string().optional().nullable(),
  userParams: z.string().optional().default(""),
  aiTunables: z.string().optional().default(""),
  helpers: z.string().optional().default(""),
  main: z.string().optional().default(""),
  helperSnippetIds: z.array(z.string()).optional().default([])
});

export async function GET(
  _request: Request,
  { params }: { params: { id: string } }
) {
  const versions = await prisma.templateVersion.findMany({
    where: { templateId: params.id },
    orderBy: { createdAt: "desc" },
    include: { helperSnippets: true }
  });

  return NextResponse.json(versions);
}

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const payload = versionSchema.parse(await request.json());

    const template = await prisma.template.findUnique({
      where: { id: params.id },
      include: {
        versions: {
          orderBy: { createdAt: "desc" },
          take: 1,
          include: { helperSnippets: true }
        }
      }
    });

    if (!template) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const lastVersion = template.versions[0];

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

    const version = await prisma.templateVersion.create({
      data: {
        templateId: template.id,
        parentVersionId: lastVersion?.id ?? null,
        title: payload.title ?? null,
        message: payload.message ?? null,
        userParams: payload.userParams,
        aiTunables: payload.aiTunables,
        helpers: payload.helpers,
        main: payload.main,
        compiled,
        helperSnippets: {
          connect: payload.helperSnippetIds.map((id) => ({ id }))
        }
      },
      include: { helperSnippets: true }
    });

    await prisma.template.update({
      where: { id: template.id },
      data: { currentVersionId: version.id }
    });

    return NextResponse.json(version, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid request";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
