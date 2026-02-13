import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";

const prismaClient = prisma as typeof prisma & { ruleTestCase: any };

const testCaseSchema = z.object({
  templateId: z.string().min(1),
  templateVersionId: z.string().min(1),
  name: z.string().min(1),
  inputJson: z.unknown(),
  expectedAction: z.string().optional().nullable(),
  expectedDescription: z.string().optional().nullable(),
  suiteId: z.string().optional().nullable()
});

const querySchema = z.object({
  templateId: z.string().optional(),
  templateVersionId: z.string().optional(),
  suiteId: z.string().optional()
});

export async function GET(request: Request) {
  const url = new URL(request.url);
  const parsed = querySchema.safeParse({
    templateId: url.searchParams.get("templateId") ?? undefined,
    templateVersionId: url.searchParams.get("templateVersionId") ?? undefined,
    suiteId: url.searchParams.get("suiteId") ?? undefined
  });

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid query" }, { status: 400 });
  }

  const cases = await prismaClient.ruleTestCase.findMany({
    where: {
      templateId: parsed.data.templateId,
      templateVersionId: parsed.data.templateVersionId,
      ...(parsed.data.suiteId && { suiteId: parsed.data.suiteId })
    },
    orderBy: { createdAt: "desc" }
  });

  return NextResponse.json(cases);
}

export async function POST(request: Request) {
  try {
    const payload = testCaseSchema.parse(await request.json());
    const testCase = await prismaClient.ruleTestCase.create({
      data: {
        templateId: payload.templateId,
        templateVersionId: payload.templateVersionId,
        name: payload.name,
        inputJson: JSON.stringify(payload.inputJson),
        expectedAction: payload.expectedAction ?? null,
        expectedDescription: payload.expectedDescription ?? null,
        suiteId: payload.suiteId ?? null
      }
    });

    return NextResponse.json(testCase, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid request";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(request: Request) {
  try {
    const url = new URL(request.url);
    const id = url.searchParams.get("id");
    if (!id) {
      return NextResponse.json({ error: "Missing id" }, { status: 400 });
    }
    await prismaClient.ruleTestCase.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to delete";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
