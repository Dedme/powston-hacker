import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { runPythonTemplate } from "@/lib/python-runner";

const prismaClient = prisma as typeof prisma & {
  ruleTestRun: any;
  ruleTestCase: any;
  templateVersion: any;
};

const runSchema = z.object({
  testCaseId: z.string().min(1),
  overrides: z.record(z.unknown()).optional()
});

const querySchema = z.object({
  templateId: z.string().optional(),
  templateVersionId: z.string().optional(),
  testCaseId: z.string().optional(),
  limit: z.string().optional()
});

const deriveStatus = (
  expectedAction: string | null | undefined,
  expectedDescription: string | null | undefined,
  actualAction: string | null,
  actualDescription: string | null
) => {
  if (expectedAction || expectedDescription) {
    if (!actualAction && !actualDescription) {
      return "pending";
    }
    if (expectedAction && actualAction && expectedAction !== actualAction) {
      return "fail";
    }
    if (
      expectedDescription &&
      actualDescription &&
      expectedDescription !== actualDescription
    ) {
      return "fail";
    }
    return "pass";
  }
  return "pending";
};

export async function GET(request: Request) {
  const url = new URL(request.url);
  const parsed = querySchema.safeParse({
    templateId: url.searchParams.get("templateId") ?? undefined,
    templateVersionId: url.searchParams.get("templateVersionId") ?? undefined,
    testCaseId: url.searchParams.get("testCaseId") ?? undefined,
    limit: url.searchParams.get("limit") ?? undefined
  });

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid query" }, { status: 400 });
  }

  const limit = parsed.data.limit ? Number(parsed.data.limit) : 50;
  const runs = await prismaClient.ruleTestRun.findMany({
    where: {
      templateId: parsed.data.templateId,
      templateVersionId: parsed.data.templateVersionId,
      testCaseId: parsed.data.testCaseId
    },
    orderBy: { createdAt: "desc" },
    take: Number.isNaN(limit) ? 50 : limit
  });

  return NextResponse.json(runs);
}

export async function POST(request: Request) {
  try {
    const payload = runSchema.parse(await request.json());
    const testCase = await prismaClient.ruleTestCase.findUnique({
      where: { id: payload.testCaseId }
    });

    if (!testCase) {
      return NextResponse.json({ error: "Test not found" }, { status: 404 });
    }

    const baseInput = JSON.parse(testCase.inputJson || "{}");
    const inputJson = payload.overrides
      ? { ...baseInput, ...payload.overrides }
      : baseInput;

    // Fetch the compiled template code for this version
    const version = await prismaClient.templateVersion.findUnique({
      where: { id: testCase.templateVersionId }
    });

    let actualAction: string | null = null;
    let actualDescription: string | null = null;
    let actualReasons: string | null = null;
    let runError: string | null = null;

    if (!version || !version.compiled) {
      runError = "No compiled template found for this version.";
    } else {
      // Execute the compiled template via Python
      const result = await runPythonTemplate(version.compiled, inputJson);

      if (!result.success) {
        runError = result.error;
        actualDescription = runError;
      }

      actualAction = result.action ?? null;
      if (!runError) {
        actualDescription = result.description ?? null;
      }
      actualReasons =
        result.decisions?.reasons?.length
          ? JSON.stringify(result.decisions.reasons)
          : null;
    }

    const status = runError
      ? "error"
      : deriveStatus(
          testCase.expectedAction,
          testCase.expectedDescription,
          actualAction,
          actualDescription
        );

    const run = await prismaClient.ruleTestRun.create({
      data: {
        templateId: testCase.templateId,
        templateVersionId: testCase.templateVersionId,
        testCaseId: testCase.id,
        inputJson: JSON.stringify(inputJson),
        expectedAction: testCase.expectedAction ?? null,
        expectedDescription: testCase.expectedDescription ?? null,
        actualAction,
        actualDescription,
        actualReasons,
        status
      }
    });

    return NextResponse.json(run, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid request";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
