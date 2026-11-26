import { jsx as _jsx } from "react/jsx-runtime";
/**
 * Lucide icons outside LUCIDE_STATIC — ES-module build (dist-esm/), i.e.
 * the browser bundles. `scripts/postbuild-esm.js` copies this file's output
 * over dist-esm/render/widgets/lucide-fallback.js.
 *
 * Each icon loads as its own small chunk via lucide's dynamicIconImports, and
 * the name index itself is a lazy chunk, so a card that only uses common
 * icons downloads none of this.
 *
 * No flash on the card site: the icon renders inside <Suspense>. Next's
 * server render waits for it, so the HTML already contains the <svg>; while
 * hydrating, React keeps that server HTML until the chunk arrives. Only a
 * purely client-side render (the editor) briefly shows the 1em placeholder.
 */
import { createElement, lazy, Suspense, } from "react";
import { LUCIDE_UNKNOWN } from "./lucide-static";
/** "Link2" / "link-2" / "LINK_2" → "link2". */
const norm = (s) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
/**
 * lucide-react 0.300 export names that don't normalise to their file name
 * (renamed icons kept as aliases). Generated from dist/esm/lucide-react.js.
 */
const ALIASES = {
    alarmcheck: "alarm-clock-check", sortdesc: "arrow-down-wide-narrow",
    sortasc: "arrow-up-narrow-wide", verified: "badge-check",
    booktemplate: "book-dashed", curlybraces: "braces",
    circleslashed: "circle-slash-2", usercircle2: "circle-user-round",
    usercircle: "circle-user", foldercog2: "folder-cog", filecog2: "file-cog",
    squaregantt: "gantt-chart-square", gitcommit: "git-commit-horizontal",
    squarekanbandashed: "kanban-square-dashed", grid: "grid-3x3",
    squarekanban: "kanban-square", inspect: "mouse-pointer-square",
    sidebarclose: "panel-left-close", sidebaropen: "panel-left-open",
    sidebar: "panel-left", edit3: "pen-line", edit: "pen-square",
    penbox: "pen-square", edit2: "pen", sendhorizonal: "send-horizontal",
    shieldclose: "shield-x", stars: "sparkles", usersquare2: "square-user-round",
    usersquare: "square-user", textselection: "text-select", train: "tram-front",
    usercheck2: "user-round-check", usercog2: "user-round-cog",
    userminus2: "user-round-minus", userplus2: "user-round-plus",
    userx2: "user-round-x", user2: "user-round", users2: "users-round",
};
let indexPromise = null;
function loadIndex() {
    if (!indexPromise) {
        indexPromise = import("lucide-react/dynamicIconImports").then((mod) => {
            const imports = (mod.default ?? mod);
            const byNorm = new Map();
            for (const key of Object.keys(imports))
                byNorm.set(norm(key), key);
            for (const [alias, key] of Object.entries(ALIASES)) {
                if (!byNorm.has(alias))
                    byNorm.set(alias, key);
            }
            return { imports, byNorm };
        });
        // A failed chunk load (network blip) may be retried by a later render.
        indexPromise.catch(() => {
            indexPromise = null;
        });
    }
    return indexPromise;
}
/** "LucideLink2" and "Link2Icon" are lucide-react aliases of "Link2". */
function variants(name) {
    const bare = name.replace(/^Lucide(?=[A-Z0-9])/, "").replace(/(.)Icon$/, "$1");
    return bare === name ? [name] : [name, bare];
}
async function loadIcon(names) {
    const { imports, byNorm } = await loadIndex();
    for (const name of names) {
        for (const v of variants(name)) {
            const key = byNorm.get(norm(v));
            if (key && imports[key])
                return (await imports[key]()).default;
        }
    }
    return LUCIDE_UNKNOWN;
}
/** Icons already loaded, so later renders skip Suspense entirely. */
const loaded = new Map();
/** One lazy component per name list — a new one each render would re-suspend. */
const lazies = new Map();
function lazyIcon(key, names) {
    let Lazy = lazies.get(key);
    if (!Lazy) {
        Lazy = lazy(() => loadIcon(names).then((Icon) => {
            loaded.set(key, Icon);
            return { default: Icon };
        }, () => {
            lazies.delete(key); // let a later render retry the download
            return { default: LUCIDE_UNKNOWN };
        }));
        lazies.set(key, Lazy);
    }
    return Lazy;
}
function LoadedIcon({ cacheKey, names, iconProps, }) {
    const Icon = loaded.get(cacheKey) ?? lazyIcon(cacheKey, names);
    return createElement(Icon, iconProps);
}
const placeholderStyle = {
    display: "inline-block",
    width: "1em",
    height: "1em",
    flexShrink: 0,
};
export function LucideByName({ names, ...iconProps }) {
    const cacheKey = names.join("|");
    return (_jsx(Suspense, { fallback: _jsx("span", { "aria-hidden": true, style: placeholderStyle }), children: _jsx(LoadedIcon, { cacheKey: cacheKey, names: names, iconProps: iconProps }) }));
}
