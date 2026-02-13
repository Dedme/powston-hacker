import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional().nullable(),
  code: z.string().optional(),
  tags: z.array(z.string()).optional(),
  isPublished: z.boolean().optional(),
  authorName: z.string().optional().nullable(),
  rating: z.number().int().min(1).max(5).optional(),
  comment: z.string().optional().nullable()
});

export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const payload = updateSchema.parse(await request.json());
    const tags = payload.tags ? payload.tags.join(",") : undefined;
    const snippet = await prisma.helperSnippet.update({
      where: { id: params.id },
      data: {
        name: payload.name,
        description: payload.description,
        code: payload.code,
        tags,
        isPublished: payload.isPublished,
        authorName: payload.authorName
      },
      include: { reviews: true }
    });

    if (payload.rating) {
      await prisma.helperSnippetReview.create({
        data: {
          snippetId: params.id,
          rating: payload.rating,
          comment: payload.comment ?? null,
          authorName: payload.authorName ?? null
        }
      });
    }

    return NextResponse.json(snippet);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid request";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: { id: string } }
) {
  await prisma.helperSnippet.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
