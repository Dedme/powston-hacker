import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";

const createSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional().nullable(),
  code: z.string().min(1),
  tags: z.array(z.string()).optional().default([]),
  isPublished: z.boolean().optional(),
  authorName: z.string().optional().nullable(),
  rating: z.number().int().min(1).max(5).optional(),
  comment: z.string().optional().nullable()
});

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q")?.trim() ?? "";

  const snippets = await prisma.helperSnippet.findMany({
    where: query
      ? {
          OR: [
            { name: { contains: query, mode: "insensitive" } },
            { description: { contains: query, mode: "insensitive" } },
            { authorName: { contains: query, mode: "insensitive" } }
          ]
        }
      : undefined,
    orderBy: { updatedAt: "desc" },
    include: { reviews: true }
  });

  return NextResponse.json(snippets);
}

export async function POST(request: Request) {
  try {
    const payload = createSchema.parse(await request.json());
    const tags = payload.tags.length ? payload.tags.join(",") : null;
    const snippet = await prisma.helperSnippet.create({
      data: {
        name: payload.name,
        description: payload.description ?? null,
        code: payload.code,
        tags,
        isPublished: payload.isPublished ?? false,
        authorName: payload.authorName ?? null
      },
      include: { reviews: true }
    });

    if (payload.rating) {
      await prisma.helperSnippetReview.create({
        data: {
          snippetId: snippet.id,
          rating: payload.rating,
          comment: payload.comment ?? null,
          authorName: payload.authorName ?? null
        }
      });
    }

    return NextResponse.json(snippet, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid request";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
