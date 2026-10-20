import { isValidElement, type ComponentProps, type ReactNode } from "react";
import { HeadingAnchor } from "@/components/heading-anchor";
import { slug } from "@/lib/mdx";
import { cn } from "@/lib/utils";

const textOf = (node: ReactNode): string =>
  typeof node === "string" || typeof node === "number"
    ? String(node)
    : Array.isArray(node)
      ? node.map(textOf).join("")
      : isValidElement<{ children?: ReactNode }>(node)
        ? textOf(node.props.children)
        : "";

/**
 * The docs' article heading (vltpkg/www/docs/src/components/heading.tsx),
 * with this app's margin link icon (`HeadingAnchor`) rather than theirs. The
 * id is the text's `slug`, as `tocOf` derives it, unless one is given.
 */
export const Heading = ({
  as: Tag,
  id,
  className,
  children,
  ...props
}: ComponentProps<"h2"> & { as: "h2" | "h3" | "h4" }) => {
  const title = textOf(children);
  const anchor = id ?? slug(title);
  return (
    <Tag id={anchor} className={cn("group/heading relative", className)} {...props}>
      <HeadingAnchor id={anchor} title={title} />
      {children}
    </Tag>
  );
};
