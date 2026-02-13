import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { compileTemplate } from "@/lib/compiler";

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional().nullable(),
  authorName: z.string().optional().nullable(),
  isPublished: z.boolean().optional(),
  title: z.string().optional().nullable(),
  message: z.string().optional().nullable(),
  userParams: z.string().optional(),
  aiTunables: z.string().optional(),
  helpers: z.string().optional(),
  main: z.string().optional(),
  helperSnippetIds: z.array(z.string()).optional()
});

export async function GET(
  _request: Request,
  { params }: { params: { id: string } }
) {
  const template = await prisma.template.findUnique({
    where: { id: params.id },
    include: {
      versions: { orderBy: { createdAt: "desc" }, include: { helperSnippets: true } }
    }
  });

  if (!template) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({
    ...template,
    currentVersion: template.versions[0] ?? null
  });
}

export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const payload = updateSchema.parse(await request.json());

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

    const nextHelperIds =
      payload.helperSnippetIds ?? lastVersion?.helperSnippets.map((snippet) => snippet.id) ?? [];
    const helperSnippets = nextHelperIds.length
      ? await prisma.helperSnippet.findMany({
          where: { id: { in: nextHelperIds } },
          orderBy: { createdAt: "asc" }
        })
      : [];
    const compiled = compileTemplate({
      userParams: payload.userParams ?? lastVersion?.userParams ?? "",
      aiTunables: payload.aiTunables ?? lastVersion?.aiTunables ?? "",
      helpers: payload.helpers ?? lastVersion?.helpers ?? "",
      helperSnippets: helperSnippets.map((snippet: { code: string }) => snippet.code),
      main: payload.main ?? lastVersion?.main ?? ""
    });

    const updated = await prisma.$transaction(async (tx) => {
      const shouldPublish = payload.isPublished ?? template.isPublished;
      const publishedAt = shouldPublish ? template.publishedAt ?? new Date() : null;
      const version = await tx.templateVersion.create({
        data: {
          templateId: template.id,
          parentVersionId: lastVersion?.id ?? null,
          title: payload.title ?? null,
          message: payload.message ?? null,
          userParams: payload.userParams ?? lastVersion?.userParams ?? "",
          aiTunables: payload.aiTunables ?? lastVersion?.aiTunables ?? "",
          helpers: payload.helpers ?? lastVersion?.helpers ?? "",
          main: payload.main ?? lastVersion?.main ?? "",
          compiled,
          helperSnippets: {
            connect: nextHelperIds.map((id) => ({ id }))
          }
        },
        include: { helperSnippets: true }
      });

      const updatedTemplate = await tx.template.update({
        where: { id: template.id },
        data: {
          name: payload.name ?? template.name,
          description: payload.description ?? template.description,
          authorName: payload.authorName ?? template.authorName,
          isPublished: shouldPublish,
          publishedAt,
          currentVersionId: version.id
        }
      });

      return { ...updatedTemplate, currentVersion: version };
    });

    return NextResponse.json(updated);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid request";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: { id: string } }
) {
  await prisma.template.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
