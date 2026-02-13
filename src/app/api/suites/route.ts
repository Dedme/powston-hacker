import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";

const prismaClient = prisma as typeof prisma & {
  ruleTestSuite: any;
  ruleTestCase: any;
};

const createSchema = z.object({
  templateId: z.string().min(1),
  name: z.string().min(1),
  description: z.string().optional().nullable(),
  userParamsOverride: z.string().optional().nullable(),
  aiTunablesOverride: z.string().optional().nullable(),
});

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional().nullable(),
  userParamsOverride: z.string().optional().nullable(),
  aiTunablesOverride: z.string().optional().nullable(),
});

export async function GET(request: Request) {
  const url = new URL(request.url);
  const templateId = url.searchParams.get("templateId");

  const suites = await prismaClient.ruleTestSuite.findMany({
    where: templateId ? { templateId } : undefined,
    include: {
      testCases: { select: { id: true, name: true, expectedAction: true } },
      suiteRuns: {
        orderBy: { createdAt: "desc" as const },
        take: 1,
        select: {
          id: true,
          passCount: true,
          failCount: true,
          errorCount: true,
          totalCount: true,
          createdAt: true,
        },
      },
    },
    orderBy: { createdAt: "desc" as const },
  });

  return NextResponse.json(suites);
}

export async function POST(request: Request) {
  try {
    const payload = createSchema.parse(await request.json());
    const suite = await prismaClient.ruleTestSuite.create({
      data: {
        templateId: payload.templateId,
        name: payload.name,
        description: payload.description ?? null,
        userParamsOverride: payload.userParamsOverride ?? null,
        aiTunablesOverride: payload.aiTunablesOverride ?? null,
      },
    });
    return NextResponse.json(suite, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid request";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function PUT(request: Request) {
  try {
    const url = new URL(request.url);
    const id = url.searchParams.get("id");
    if (!id) {
      return NextResponse.json({ error: "Missing id" }, { status: 400 });
    }
    const payload = updateSchema.parse(await request.json());
    const suite = await prismaClient.ruleTestSuite.update({
      where: { id },
      data: {
        ...(payload.name !== undefined && { name: payload.name }),
        ...(payload.description !== undefined && {
          description: payload.description,
        }),
        ...(payload.userParamsOverride !== undefined && {
          userParamsOverride: payload.userParamsOverride,
        }),
        ...(payload.aiTunablesOverride !== undefined && {
          aiTunablesOverride: payload.aiTunablesOverride,
        }),
      },
    });
    return NextResponse.json(suite);
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
    await prismaClient.ruleTestSuite.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to delete";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
