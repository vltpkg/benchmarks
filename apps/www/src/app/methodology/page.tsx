import { CopyPage } from "@/components/copy-page";
import { DESCRIPTION, TOP, Trail } from "@/components/report-shell";
import { TOCMinimap } from "@/components/toc-minimap";
import { loadCatalog } from "@/lib/catalog";
import { dataClient } from "@/lib/data";
import { tocOf } from "@/lib/mdx";
import { pageMetadata, siteOrigin } from "@/lib/metadata";
import { Environment, Method, Reading, Resources, Scenarios, Trademark } from "./components";
import Content from "./content.mdx";
import { methodologyMarkdown } from "./markdown";

const description = "How the benchmarks are measured, where they run, and how to read the results.";

export const metadata = pageMetadata({ title: "Methodology", description, path: "/methodology" });

/**
 * How the numbers are made, in the docs' article typography. The prose and
 * its order are content.mdx; its outline is read from the Markdown twin, which
 * holds the scenario headings the MDX leaves to `<Scenarios />`.
 */
const Methodology = async () => {
  const { scenarios } = await loadCatalog(dataClient());
  return (
    <>
      <div className={TOP}>
        <Trail label="Methodology" sectionHref="/methodology" />
      </div>
      {/* The full column, as every page has it; only the prose keeps a reading measure. */}
      <article className="typeset typeset-docs mt-10 [&_:is(p,ul,dl)]:max-w-3xl">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <h1>Methodology</h1>
          <CopyPage />
        </div>
        <p className={DESCRIPTION}>{description}</p>
        <Content
          components={{
            Method,
            Environment,
            Reading,
            Scenarios: () => <Scenarios scenarios={scenarios} />,
            Resources,
            Trademark,
          }}
        />
      </article>
      <TOCMinimap items={tocOf(methodologyMarkdown(scenarios, siteOrigin()))} />
    </>
  );
};

export default Methodology;
