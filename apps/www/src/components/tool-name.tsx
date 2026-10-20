import type { ComponentType, SVGProps } from "react";
import { Astro } from "@/components/icons/astro";
import { Aube } from "@/components/icons/aube";
import { Aws } from "@/components/icons/aws";
import { Berry } from "@/components/icons/berry";
import { Bun } from "@/components/icons/bun";
import { Cloudsmith } from "@/components/icons/cloudsmith";
import { Deno } from "@/components/icons/deno";
import { Github } from "@/components/icons/github";
import { Jfrog } from "@/components/icons/jfrog";
import { Next } from "@/components/icons/next";
import { Node } from "@/components/icons/node";
import { Npm } from "@/components/icons/npm";
import { Nx } from "@/components/icons/nx";
import { Package } from "@/components/icons/package";
import { Pnpm } from "@/components/icons/pnpm";
import { Svelte } from "@/components/icons/svelte";
import { Turbo } from "@/components/icons/turbo";
import { Upm } from "@/components/icons/upm";
import { Vlt } from "@/components/icons/vlt";
import { Vp } from "@/components/icons/vp";
import { Vue } from "@/components/icons/vue";
import { Yarn } from "@/components/icons/yarn";
import { Zpm } from "@/components/icons/zpm";
import type { SectionId } from "@/lib/sections";
import { fixtureLabel, toolLabel } from "@/lib/tools";

type Icon = ComponentType<SVGProps<SVGSVGElement>>;

/*
 * The previous app's icon assignments (tmp/app/src/lib/get-icons.ts), kept
 * as they were -- including pacquet under the pnpm mark, since it is pnpm's
 * own rewrite. A name with no entry gets no icon and its label, which is the
 * part that carries identity anyway.
 */
export const TOOL_ICONS: { readonly [tool: string]: Icon } = {
  aube: Aube,
  aws: Aws,
  berry: Berry,
  bun: Bun,
  cloudsmith: Cloudsmith,
  deno: Deno,
  github: Github,
  jfrog: Jfrog,
  node: Node,
  npm: Npm,
  nx: Nx,
  pacquet: Pnpm,
  pnpm: Pnpm,
  turbo: Turbo,
  upm: Upm,
  vlt: Vlt,
  vp: Vp,
  yarn: Yarn,
  zpm: Zpm,
};

const FIXTURE_ICONS: { readonly [fixture: string]: Icon } = {
  astro: Astro,
  babylon: Package,
  large: Package,
  next: Next,
  svelte: Svelte,
  vue: Vue,
};

const Mark = ({ icon: IconFor }: { icon: Icon | undefined }) =>
  IconFor === undefined ? null : <IconFor aria-hidden className="size-4 shrink-0" />;

/** A tool as it is named everywhere outside a chart: its mark, then its name. */
export const ToolName = ({
  tool,
  section,
  className = "",
}: {
  tool: string;
  section: SectionId;
  className?: string;
}) => (
  <span className={`inline-flex items-center gap-2 align-middle ${className}`}>
    <Mark icon={TOOL_ICONS[tool]} />
    {toolLabel(tool, section)}
  </span>
);

export const FixtureName = ({ fixture }: { fixture: string }) => (
  <span className="inline-flex items-center gap-1.5 align-middle">
    <Mark icon={FIXTURE_ICONS[fixture]} />
    {fixtureLabel(fixture)}
  </span>
);
