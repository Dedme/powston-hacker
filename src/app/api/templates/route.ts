import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { compileTemplate } from "@/lib/compiler";
import { slugify } from "@/lib/slug";
import { getTemplatesWithLatest } from "@/lib/template-queries";

const templateSchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().optional().nullable(),
  authorName: z.string().optional().nullable(),
  isPublished: z.boolean().optional(),
  title: z.string().optional().nullable(),
  message: z.string().optional().nullable(),
  userParams: z.string().optional().default(""),
  aiTunables: z.string().optional().default(""),
  helpers: z.string().optional().default(""),
  main: z.string().optional().default(""),
  helperSnippetIds: z.array(z.string()).optional().default([])
});

export async function GET() {
  const templates = await getTemplatesWithLatest();
  return NextResponse.json(templates);
}

export async function POST(request: Request) {
  try {
    const payload = templateSchema.parse(await request.json());
    const baseSlug = slugify(payload.name);
    const slugSuffix = crypto.randomUUID().slice(0, 6);
    const slug = `${baseSlug}-${slugSuffix}`;

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

    const template = await prisma.$transaction(async (tx) => {
      const shouldPublish = payload.isPublished ?? false;
      const createdTemplate = await tx.template.create({
        data: {
          name: payload.name,
          description: payload.description ?? null,
          authorName: payload.authorName ?? null,
          isPublished: shouldPublish,
          publishedAt: shouldPublish ? new Date() : null,
          slug
        }
      });

      const version = await tx.templateVersion.create({
        data: {
          templateId: createdTemplate.id,
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

      const updated = await tx.template.update({
        where: { id: createdTemplate.id },
        data: { currentVersionId: version.id }
      });

      return { ...updated, currentVersion: version };
    });

    return NextResponse.json(template, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid request";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
