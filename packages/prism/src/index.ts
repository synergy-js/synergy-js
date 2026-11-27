/**
 * Atomic CSS-in-JS architecture (StyleX / Atomizer / Compiled style).
 *
 * Engineering Breakdown
 *
 * 1. True Atomic Deduplication (atomCache): Instead of generating duplicate CSS rules per component like
 * Emotion/styled-components, "background-color:red" is inserted into the stylesheet once (syn-0) and
 * reused everywhere—keeping stylesheet size O(unique declarations) instead of O(components).
 *
 * 2. Constructable Stylesheets (new CSSStyleSheet() + document.adoptedStyleSheets): Zero <style> tag DOM mutation
 * overhead—rules go straight into the browser's native CSSOM sheet.
 *
 * 3. Deterministic Last-Wins Merging (cx() + classToSlot): Classic atomic CSS breaks when class
 * A is inserted into the stylesheet after class B, causing A to override B even when you write class="A B".
 * Your classToSlot map ("syn-0" -> "background-color", ":hover|background-color") solves the exact
 * same problem Meta's stylex.props() solves, in ~20 lines of O(tokens) code.
 *
 * 4. Zero-Runtime-Cost Design Tokens (defineTokens): Emits native CSS custom properties
 * (:root { --syn-colors-primary: ... }) and returns typed var(--syn-...) references,
 * so theme switches happen natively in CSS without re-running JS.
 *
 * 5. Full csstype Autocomplete: Typing PropertiesHyphen<string | number> + --${string} custom
 * vars + PseudoSelector gives real IDE autocomplete for CSS properties, values, and pseudo-selectors.
 *
 * 6. createVariants (CVA / Vanilla-Extract Recipes style) built directly on top of your createStyleSheet +
 * cx engine—so every variant rule gets full atomic deduplication (syn-*), last-wins slot resolution (cx()),
 * and strict TypeScript inference on variant props and defaultVariants
 */

export * from "./cx.ts"
export * from "./sheet.ts"
export * from "./tokens.ts"
export * from "./types.ts"
export * from "./variants.ts"
export * from "./stylesheet.ts"