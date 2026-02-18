/** Configuration for a single font face */
interface FontConfig {
    url: string;
    weight?: string | number;
    style?: string;
}
/** Font mapping: family name → URL string, single config, or array of configs for multiple weights/styles */
type FontMapping = Record<string, string | FontConfig | FontConfig[]>;
/** SVG compatibility configuration flags */
interface SvgCompatConfig {
    useClipPathForOverflow: boolean;
    stripFilters: boolean;
    stripBoxShadows: boolean;
    stripMaskImage: boolean;
    stripTextShadows: boolean;
    avoidStyleAttributes: boolean;
    stripXmlSpace: boolean;
    stripGroupOpacity: boolean;
    inlineClipPathTransforms: boolean;
    flattenNestedSvg: boolean;
}
/** SVG compatibility preset */
type SvgCompat = 'full' | 'inkscape' | SvgCompatConfig;
/** Options for domToSvg() */
interface DomToSvgOptions {
    /** Map of font-family → URL or FontConfig for text-to-path conversion */
    fonts?: FontMapping;
    /** CSS selector or predicate to exclude elements */
    exclude?: string | ((element: Element) => boolean);
    /** Custom handler for specific elements — return SVGElement to use it, or null to fall through to default rendering */
    handler?: (element: Element, context: RenderContext) => SVGElement | null;
    /** Background color for the root SVG (default: transparent) */
    background?: string;
    /** Extra padding around the captured area in px */
    padding?: number;
    /** Whether to convert text to paths using opentype.js (default: false) */
    textToPath?: boolean;
    /** Skip applying CSS transforms as SVG attributes (default: false).
     *  When true, element positions come solely from getBoundingClientRect
     *  which already includes CSS transforms. Use this when capturing containers
     *  with nested CSS transforms (e.g. SvelteFlow, React Flow) where
     *  the default behaviour would double-apply transforms. */
    flattenTransforms?: boolean;
    /** SVG compatibility preset or custom config (default: 'full') */
    compat?: SvgCompat;
}
/** Internal render context passed through the tree */
interface RenderContext {
    /** The output SVG document */
    svgDocument: Document;
    /** The <defs> element for shared definitions */
    defs: SVGDefsElement;
    /** ID generator for unique IDs */
    idGenerator: IdGenerator;
    /** Options from the caller */
    options: DomToSvgOptions;
    /** Resolved SVG compatibility config */
    compat: SvgCompatConfig;
    /** Font cache (available when textToPath is enabled) */
    fontCache?: FontCache;
    /** Current inherited opacity */
    opacity: number;
}
/** Interface for unique ID generation */
interface IdGenerator {
    next(prefix?: string): string;
}
/** Interface for the font cache */
interface FontCache {
    getFont(family: string, weight?: string | number, style?: string): Promise<any>;
    has(family: string): boolean;
}
/** Result of domToSvg() */
interface DomToSvgResult {
    /** The generated SVG element */
    svg: SVGSVGElement;
    /** Serialize to SVG string */
    toString(): string;
    /** Serialize to a Blob */
    toBlob(): Blob;
    /** Trigger a download in the browser */
    download(filename?: string): void;
}

/**
 * Convert a DOM element (including hybrid HTML/SVG) to a self-contained SVG.
 *
 * @param element - The root DOM element to convert
 * @param options - Configuration options
 * @returns A result object with the SVG and serialization helpers
 */
declare function domToSvg(element: Element, options?: DomToSvgOptions): Promise<DomToSvgResult>;

export { type DomToSvgOptions, type DomToSvgResult, type FontConfig, type FontMapping, type SvgCompat, type SvgCompatConfig, domToSvg };
