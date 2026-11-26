/**
 * Lucide icons outside LUCIDE_STATIC — CommonJS build (dist/).
 *
 * The CJS build is what Node servers load (the API renders card documents
 * with renderToStaticMarkup, which can't wait for lazy chunks), so here the
 * whole set is required synchronously. Browser bundles get
 * lucide-fallback.esm.tsx instead: `scripts/postbuild-esm.js` copies it over
 * this file in dist-esm/, so the full set never reaches the card site.
 *
 * Both files export the same `LucideByName` component.
 */
import * as LucideIcons from "lucide-react";
import { LUCIDE_UNKNOWN } from "./lucide-static";

export function LucideByName({
  names,
  ...iconProps
}: {
  /** Candidate export names, most specific first ("Link2", "link-2"…). */
  names: string[];
  [prop: string]: unknown;
}) {
  const all = LucideIcons as unknown as Record<string, any>;
  const Icon = names.map((n) => all[n]).find(Boolean) ?? LUCIDE_UNKNOWN;
  return <Icon {...iconProps} />;
}
