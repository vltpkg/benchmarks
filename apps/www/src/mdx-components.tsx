import type { MDXComponents } from "mdx/types";
import { Heading } from "@/components/heading";
import { InlineCode } from "@/components/inline-code";

/* The docs' element map (vltpkg/www/docs/src/mdx-components.tsx), for the elements these pages use. */
const components: MDXComponents = {
  h2: ({ ref: _ref, ...props }) => <Heading as="h2" {...props} />,
  h3: ({ ref: _ref, ...props }) => <Heading as="h3" {...props} />,
  h4: ({ ref: _ref, ...props }) => <Heading as="h4" {...props} />,
  code: ({ children }) => <InlineCode size="text">{children}</InlineCode>,
};

export const useMDXComponents = (): MDXComponents => components;
