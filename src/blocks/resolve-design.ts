import { isCoreWidget } from "../render/card-visibility";
import { definitionRoots, type TemplateDefinition } from "../types/definition";
import { isWidget, walkTreeOrder, type ElementNode, type Node } from "../types/node";
import type { StyleSet } from "../types/style";
import { getWidgetMeta, normalizeWidgetType } from "../widgets/registry";

export interface BlockDesign {
  design: Record<string, unknown>;
  partStyles: Record<string, StyleSet>;
  layout?: ElementNode;
  hasCustomLayout?: boolean;
  rootStyle?: StyleSet;
  rootHidden?: Partial<Record<"base" | "sm" | "md", boolean>>;
}

type Instance = {
  design?: Record<string, unknown>;
  partStyles?: Record<string, StyleSet>;
  layout?: ElementNode;
  rootStyle?: StyleSet;
  rootHidden?: Partial<Record<"base" | "sm" | "md", boolean>>;
};

/**
 * Tree order like `walkTreeOrder`, but also descends into each widget's own
 * `layout`. Widgets can nest — CONNECT_BUTTONS usually lives inside the
 * PROFILE widget's layout — and a lookup that skips layouts never finds them.
 */
function walkWithLayouts(node: Node, visit: (n: Node) => void): void {
  walkTreeOrder(node, (n) => {
    visit(n);
    if (isWidget(n) && n.layout) walkWithLayouts(n.layout, visit);
  });
}

/**
 * Text styling a placeholder must not hand to other block types. The
 * placeholder is usually a section title, so its font, size and case would
 * otherwise land on buttons, images and icons the user adds.
 */
const TYPOGRAPHY_PROPS = [
  "color",
  "fontFamily",
  "fontSize",
  "fontWeight",
  "fontStyle",
  "lineHeight",
  "letterSpacing",
  "textTransform",
  "textAlign",
  "textDecoration",
  "textGradient",
  "whiteSpace",
] as const;

function withoutTypography(style: StyleSet | undefined): StyleSet | undefined {
  if (!style) return style;
  const out: StyleSet = {};
  for (const [layer, props] of Object.entries(style)) {
    if (!props || typeof props !== "object") continue;
    const clean: Record<string, unknown> = { ...(props as Record<string, unknown>) };
    for (const key of TYPOGRAPHY_PROPS) delete clean[key];
    if (Object.keys(clean).length) (out as any)[layer] = clean;
  }
  return Object.keys(out).length ? out : undefined;
}

/** First widget instance of `type` found in the template tree, if any. */
function templateInstance(
  def: TemplateDefinition,
  type: string,
): Instance | null {
  const normTarget = normalizeWidgetType(type).toUpperCase();
  const lowerType = type.toLowerCase();
  for (const root of definitionRoots(def)) {
    let matched: Instance | null = null;
    walkWithLayouts(root, (n) => {
      if (matched) return;
      if (isWidget(n)) {
        const wNorm = normalizeWidgetType(n.widget).toUpperCase();
        const keyLower = (n.key || "").toLowerCase();
        const labelLower = (n.label || "").toLowerCase();
        if (
          wNorm === normTarget ||
          n.widget === type ||
          n.widget?.toUpperCase() === normTarget ||
          keyLower === lowerType ||
          labelLower === lowerType
        ) {
          matched = {
            design: n.design,
            partStyles: n.partStyles,
            layout: n.layout,
            rootStyle: n.style,
            rootHidden: n.hidden,
          };
        }
      }
    });
    if (matched) return matched;
  }
  return null;
}

/**
 * Find the first non-core widget in the template tree. This is the generic
 * "placeholder" for user blocks, so its custom outer styles (margin, border, background)
 * should apply as a generic template to any block type the user adds.
 */
function templatePlaceholder(
  def: TemplateDefinition,
): Pick<Instance, "rootStyle" | "rootHidden"> | null {
  for (const root of definitionRoots(def)) {
    let matched: Pick<Instance, "rootStyle" | "rootHidden"> | null = null;
    walkTreeOrder(root, (n) => {
      if (matched) return;
      if (isWidget(n)) {
        if (!isCoreWidget(n.widget)) {
          matched = {
            rootStyle: n.style,
            rootHidden: n.hidden,
          };
        }
      }
    });
    if (matched) return matched;
  }
  return null;
}

/**
 * The `(design, partStyles)` a user block of `type` should render with, given
 * the card's template. Deterministic and pure.
 */
export function resolveBlockDesign(
  def: TemplateDefinition,
  type: string,
): BlockDesign {
  const normType = (type || "").toUpperCase();
  const aliasMap: Record<string, string> = {
    MAPS: "MAP",
    LOCATION: "MAP",
    MAP: "MAP",
    ABOUT_US: "DESCRIPTION",
    ABOUT: "DESCRIPTION",
    HOURS: "BUSINESS_HOURS",
    REVIEWS: "TESTIMONIALS",
    BUTTON: "CTA_BUTTON",
    SOCIAL_ICON: "SOCIAL_ICONS",
    HR: "DIVIDER",
    SPACE: "SPACER",
    HTML_EMBED: "EMBED",
    VCARD: "VCARD_BUTTON",
    LINKS: "CONTACT_LINKS",
  };
  const targetType = aliasMap[normType] || normType;

  let inst = templateInstance(def, targetType) ?? templateInstance(def, type);
  if (!inst) {
    const placeholder = templatePlaceholder(def);
    if (placeholder) {
      // Fallback to the placeholder's explicitly authored root styles, so generic
      // spacing/borders apply to all user blocks even if they don't match the placeholder's type.
      // Box styles only: its text styling belongs to that widget, not to this type.
      inst = {
        rootStyle: withoutTypography(placeholder.rootStyle),
        rootHidden: placeholder.rootHidden,
      };
    }
  }

  const meta = getWidgetMeta(targetType) ?? getWidgetMeta(type);

  // Part styles: start with meta defaults, but NEVER inject automatic padding/margin onto root
  const partStyles: Record<string, StyleSet> = {};
  if (meta?.defaultPartStyles) {
    for (const [part, set] of Object.entries(meta.defaultPartStyles)) {
      const cloned = structuredClone(set);
      // Strip automatic root padding/margin so admin design rules supreme
      if (part === "root" && cloned.base) {
        delete (cloned.base as any).padding;
        delete (cloned.base as any).margin;
      }
      partStyles[part] = cloned;
    }
  }

  // If a template instance exists from Admin, its authored partStyles take priority
  if (inst?.partStyles) {
    for (const [part, set] of Object.entries(inst.partStyles)) {
      partStyles[part] = {
        ...(partStyles[part] ?? {}),
        ...(set ?? {}),
        base: { ...(partStyles[part]?.base ?? {}), ...(set?.base ?? {}) },
        sm: { ...(partStyles[part]?.sm ?? {}), ...(set?.sm ?? {}) },
        md: { ...(partStyles[part]?.md ?? {}), ...(set?.md ?? {}) },
      };
    }
  }

  // Layout: If the admin authored a custom layout in the template, USE IT DIRECTLY!
  // Do NOT merge defaultLayout over it, which re-injects unwanted default padding/margin/structure.
  const rawLayout = inst?.layout
    ? structuredClone(inst.layout)
    : meta?.defaultLayout
      ? structuredClone(meta.defaultLayout)
      : undefined;

  let layout = rawLayout;
  if (layout) {
    const rootStyle = inst?.rootStyle;
    const rootPartStyle = inst?.partStyles?.root;
    if (rootStyle || rootPartStyle) {
      const mergeBreakpoint = (
        layoutBp: any,
        partBp: any,
        rootBp: any,
      ) => {
        // If the layout container already defines its display (e.g. flex or grid),
        // preserve its internal layout mechanics (display, flexDirection, alignItems, justifyContent, gap, gridTemplate...)!
        // rootStyle from the widget wrapper only provides outer styling (background, border, radius, shadow, margin).
        const hasLayoutDisplay = Boolean(
          layoutBp?.display && layoutBp.display !== "block",
        );
        const cleanRoot: any = { ...(rootBp ?? {}) };
        const cleanPart: any = { ...(partBp ?? {}) };
        if (hasLayoutDisplay) {
          delete cleanRoot.display;
          delete cleanRoot.flexDirection;
          delete cleanRoot.alignItems;
          delete cleanRoot.justifyContent;
          delete cleanRoot.gap;
          delete cleanRoot.gridTemplateColumns;
          delete cleanRoot.gridTemplateRows;

          delete cleanPart.display;
          delete cleanPart.flexDirection;
          delete cleanPart.alignItems;
          delete cleanPart.justifyContent;
          delete cleanPart.gap;
          delete cleanPart.gridTemplateColumns;
          delete cleanPart.gridTemplateRows;
        }
        return {
          ...(layoutBp ?? {}),
          ...cleanPart,
          ...cleanRoot,
          ...(hasLayoutDisplay
            ? {
                display: layoutBp.display,
                ...(layoutBp.flexDirection ? { flexDirection: layoutBp.flexDirection } : {}),
                ...(layoutBp.alignItems ? { alignItems: layoutBp.alignItems } : {}),
                ...(layoutBp.justifyContent ? { justifyContent: layoutBp.justifyContent } : {}),
                ...(layoutBp.gap !== undefined ? { gap: layoutBp.gap } : {}),
                ...(layoutBp.gridTemplateColumns ? { gridTemplateColumns: layoutBp.gridTemplateColumns } : {}),
                ...(layoutBp.gridTemplateRows ? { gridTemplateRows: layoutBp.gridTemplateRows } : {}),
              }
            : {}),
        };
      };

      layout.style = {
        ...(layout.style ?? {}),
        base: mergeBreakpoint(
          layout.style?.base,
          rootPartStyle?.base,
          rootStyle?.base,
        ),
        sm: mergeBreakpoint(
          layout.style?.sm,
          rootPartStyle?.sm,
          rootStyle?.sm,
        ),
        md: mergeBreakpoint(
          layout.style?.md,
          rootPartStyle?.md,
          rootStyle?.md,
        ),
      };
    }
  }

  return {
    design: { ...(meta?.defaultDesign ?? {}), ...(inst?.design ?? {}) },
    partStyles,
    layout,
    hasCustomLayout: Boolean(inst?.layout),
    rootStyle: inst?.rootStyle,
    rootHidden: inst?.rootHidden,
  };
}

/**
 * Every widget type a user may add as a block. Design/decoration + content
 * widgets are user-addable; identity widgets that read card data (`derived`)
 * and the lead form (edited in its own tab) are not.
 */
export function userBlockTypes(
  allTypes: { type: string; derived?: boolean }[],
): string[] {
  const EXCLUDED = new Set(["LEAD_FORM"]);
  return allTypes
    .filter((m) => !m.derived && !EXCLUDED.has(m.type))
    .map((m) => m.type);
}

/** The CSS class a block wrapper carries so it picks up the template preset. */
export function blockClass(type: string): string {
  return `tsb-${String(type).replace(/[^A-Za-z0-9_-]/g, "")}`;
}
