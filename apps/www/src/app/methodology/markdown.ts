import { mdxMarkdown, mdxSource } from "@/lib/mdx";
import { METHOD, READING, RESOURCES, RUNNER, RUNNER_NOTE, TRADEMARK } from "@/lib/metadata";
import type { SectionScenarios } from "@/lib/page-tree";
import { DESCRIPTIONS, scenarioPath, stateParts } from "@/lib/scenarios";
import { SECTION_DEFS, SECTIONS } from "@/lib/sections";

/** The Methodology page as Markdown: content.mdx, each block written out as ./components.tsx draws it. */
export const methodologyMarkdown = (scenarios: SectionScenarios, origin: string): string => {
  const abs = (path: string) => new URL(path, origin).href;
  const lines = (...lines: string[]) => lines.join("\n");
  const body = mdxMarkdown(mdxSource("app/methodology/content.mdx"), {
    Method: METHOD,
    Environment: lines(
      ...RUNNER.map(([term, value]) => `- ${term}: \`${value}\``),
      "",
      RUNNER_NOTE,
    ),
    Reading: lines(...READING.map((line) => `- ${line}`)),
    Scenarios: SECTIONS.map((section) =>
      lines(
        `### ${SECTION_DEFS[section].label}`,
        "",
        SECTION_DEFS[section].about,
        "",
        ...scenarios[section].map(
          (s) =>
            `- [${s.variation}](${abs(`${scenarioPath(section, s.variation)}.md`)}): ${DESCRIPTIONS[s.variation] ?? "Published, with no description yet."}${
              s.kind === "other"
                ? ""
                : ` Before each run: ${stateParts(s.state)
                    .map((p) => `${p.name} ${p.word}`)
                    .join(", ")}.`
            }`,
        ),
      ),
    ).join("\n\n"),
    Resources: lines(...RESOURCES.map(([term, , href]) => `- ${term}: ${href}`)),
    Trademark: TRADEMARK,
  });
  return `# Methodology (${abs("/methodology")})\n\n${body}`;
};
