import { prisma } from "@/lib/db";
import type { Prisma } from "@prisma/client";

type TemplateWithLatest = Prisma.TemplateGetPayload<{
  include: {
    versions: {
      orderBy: { createdAt: "desc" };
      take: 1;
      include: { helperSnippets: true };
    };
  };
}>;

export const getTemplatesWithLatest = async () => {
  const templates = await prisma.template.findMany({
    orderBy: { updatedAt: "desc" },
    include: {
      versions: {
        orderBy: { createdAt: "desc" },
        take: 1,
        include: { helperSnippets: true }
      }
    }
  });

  return templates.map((template: TemplateWithLatest) => ({
    ...template,
    currentVersion: template.versions[0] ?? null
  }));
};
