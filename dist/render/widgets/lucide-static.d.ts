/**
 * Lucide icons bundled up-front: every name the engine itself references
 * (link catalog, widget defaults, the Ionicons/COMMON maps in icon-helper)
 * that isn't already drawn by react-icons, plus the icons cards pick most.
 *
 * These are NAMED imports so bundlers tree-shake lucide-react down to just
 * this list. Never add `import * as … from "lucide-react"` to code that
 * reaches the browser: it ships all ~1,400 icons (~1 MB) to every card
 * visitor. Anything not listed here is still rendered — see
 * lucide-fallback.tsx (full set on CJS servers) and lucide-fallback.esm.tsx
 * (one lazy chunk per icon in browser bundles).
 */
import type { ComponentType } from "react";
export declare const LUCIDE_STATIC: Record<string, ComponentType<any>>;
/** Drawn when a name matches no Lucide icon (unchanged from before). */
export declare const LUCIDE_UNKNOWN: ComponentType<any>;
