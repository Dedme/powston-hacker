import { prisma } from "@/lib/db";

export default async function LibraryPage({
  searchParams
}: {
  searchParams?: { q?: string };
}) {
  const query = searchParams?.q?.trim() ?? "";

  const templates = await prisma.template.findMany({
    where: {
      isPublished: true,
      ...(query
        ? {
            OR: [
              { name: { contains: query } },
              { description: { contains: query } },
              { authorName: { contains: query } }
            ]
          }
        : {})
    },
    orderBy: { publishedAt: "desc" },
    take: 100
  });

  return (
    <main className="h-full w-full flex-1 overflow-auto bg-slate-950 px-6 py-6">
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-semibold text-white">Community Library</h1>
          <p className="text-sm text-slate-400">
            Browse published templates from the Powston community.
          </p>
        </div>

        <form className="flex items-center gap-2" action="/library" method="get">
          <input
            className="h-9 w-full max-w-md rounded-lg border border-slate-800 bg-slate-900/70 px-3 text-sm text-slate-100"
            name="q"
            placeholder="Search templates, authors, tags"
            defaultValue={query}
          />
          <button
            className="rounded-full border border-slate-700 px-4 py-2 text-xs font-semibold text-slate-100 hover:border-slate-500"
            type="submit"
          >
            Search
          </button>
        </form>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {templates.length === 0 ? (
            <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 text-sm text-slate-400">
              No published templates yet.
            </div>
          ) : (
            templates.map((template) => (
              <div
                key={template.id}
                className="rounded-xl border border-slate-800 bg-slate-900/60 p-4"
              >
                <div className="flex items-center justify-between">
                  <h3 className="text-base font-semibold text-white">{template.name}</h3>
                  <span className="text-xs text-slate-400">{template.authorName ?? ""}</span>
                </div>
                <p className="mt-2 text-xs text-slate-400">
                  {template.description || "No description provided."}
                </p>
                <p className="mt-3 text-[11px] text-slate-500">
                  Published {template.publishedAt?.toLocaleDateString() ?? ""}
                </p>
              </div>
            ))
          )}
        </div>
      </div>
    </main>
  );
}
