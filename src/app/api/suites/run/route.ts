import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { compileTemplate } from "@/lib/compiler";
import { runPythonTemplate } from "@/lib/python-runner";

const prismaClient = prisma as typeof prisma & {
  ruleTestSuite: any;
  ruleTestCase: any;
  ruleTestRun: any;
  ruleTestSuiteRun: any;
  templateVersion: any;
};

const runSuiteSchema = z.object({
  suiteId: z.string().min(1),
  templateVersionId: z.string().min(1),
  userParamsOverride: z.string().optional().nullable(),
  aiTunablesOverride: z.string().optional().nullable(),
});

const querySchema = z.object({
  suiteId: z.string().optional(),
  limit: z.string().optional(),
});

const deriveStatus = (
  expectedAction: string | null | undefined,
  actualAction: string | null
) => {
  if (!expectedAction) return "pending";
  if (!actualAction) return "pending";
  return expectedAction === actualAction ? "pass" : "fail";
};

export async function GET(request: Request) {
  const url = new URL(request.url);
  const parsed = querySchema.safeParse({
    suiteId: url.searchParams.get("suiteId") ?? undefined,
    limit: url.searchParams.get("limit") ?? undefined,
  });

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid query" }, { status: 400 });
  }

  const limit = parsed.data.limit ? Number(parsed.data.limit) : 20;
  const suiteRuns = await prismaClient.ruleTestSuiteRun.findMany({
    where: parsed.data.suiteId ? { suiteId: parsed.data.suiteId } : undefined,
    include: {
      runs: {
        select: {
          id: true,
          testCaseId: true,
          expectedAction: true,
          actualAction: true,
          actualDescription: true,
          actualReasons: true,
          status: true,
        },
      },
    },
    orderBy: { createdAt: "desc" as const },
    take: Number.isNaN(limit) ? 20 : limit,
  });

  return NextResponse.json(suiteRuns);
}

export async function POST(request: Request) {
  try {
    const payload = runSuiteSchema.parse(await request.json());

    // Fetch suite with test cases
    const suite = await prismaClient.ruleTestSuite.findUnique({
      where: { id: payload.suiteId },
      include: { testCases: true },
    });

    if (!suite) {
      return NextResponse.json({ error: "Suite not found" }, { status: 404 });
    }

    if (suite.testCases.length === 0) {
      return NextResponse.json(
        { error: "Suite has no test cases" },
        { status: 400 }
      );
    }

    // Fetch the template version
    const version = await prismaClient.templateVersion.findUnique({
      where: { id: payload.templateVersionId },
      include: { helperSnippets: true },
    });

    if (!version) {
      return NextResponse.json(
        { error: "Template version not found" },
        { status: 404 }
      );
    }

    // Determine effective params: request overrides > suite overrides > version defaults
    const effectiveUserParams =
      payload.userParamsOverride ?? suite.userParamsOverride ?? version.userParams;
    const effectiveAiTunables =
      payload.aiTunablesOverride ?? suite.aiTunablesOverride ?? version.aiTunables;

    // Recompile with overrides
    const compiled = compileTemplate({
      userParams: effectiveUserParams,
      aiTunables: effectiveAiTunables,
      helpers: version.helpers,
      helperSnippets: version.helperSnippets?.map(
        (s: { code: string }) => s.code
      ),
      main: version.main,
    });

    // Create the suite run record
    const suiteRun = await prismaClient.ruleTestSuiteRun.create({
      data: {
        suiteId: suite.id,
        templateVersionId: payload.templateVersionId,
        userParamsSnapshot: effectiveUserParams,
        aiTunablesSnapshot: effectiveAiTunables,
        totalCount: suite.testCases.length,
      },
    });

    // Execute each test case
    let passCount = 0;
    let failCount = 0;
    let errorCount = 0;

    const runResults = [];

    for (const testCase of suite.testCases) {
      const inputJson = JSON.parse(testCase.inputJson || "{}");
      const result = await runPythonTemplate(compiled, inputJson);

      let actualAction: string | null = null;
      let actualDescription: string | null = null;
      let actualReasons: string | null = null;
      let status: string;

      if (!result.success) {
        actualDescription = result.error;
        status = "error";
        errorCount++;
      } else {
        actualAction = result.action ?? null;
        actualDescription = result.description ?? null;
        actualReasons = result.decisions?.reasons?.length
          ? JSON.stringify(result.decisions.reasons)
          : null;
        status = deriveStatus(testCase.expectedAction, actualAction);
        if (status === "pass") passCount++;
        else if (status === "fail") failCount++;
      }

      const run = await prismaClient.ruleTestRun.create({
        data: {
          templateId: suite.templateId,
          templateVersionId: payload.templateVersionId,
          testCaseId: testCase.id,
          suiteRunId: suiteRun.id,
          inputJson: testCase.inputJson,
          expectedAction: testCase.expectedAction ?? null,
          expectedDescription: testCase.expectedDescription ?? null,
          actualAction,
          actualDescription,
          actualReasons,
          status,
        },
      });

      runResults.push({
        id: run.id,
        testCaseId: testCase.id,
        testCaseName: testCase.name,
        expectedAction: testCase.expectedAction,
        actualAction,
        actualDescription,
        actualReasons,
        status,
      });
    }

    // Update suite run counts
    await prismaClient.ruleTestSuiteRun.update({
      where: { id: suiteRun.id },
      data: { passCount, failCount, errorCount },
    });

    return NextResponse.json(
      {
        id: suiteRun.id,
        suiteId: suite.id,
        templateVersionId: payload.templateVersionId,
        passCount,
        failCount,
        errorCount,
        totalCount: suite.testCases.length,
        createdAt: suiteRun.createdAt,
        runs: runResults,
      },
      { status: 201 }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid request";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
