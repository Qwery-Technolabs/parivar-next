import 'server-only';

/**
 * The browser / installed-app theme colour: the brand navy, matching the app header.
 * Used by the root viewport and the web manifest.
 */
export const THEME_COLOR = '#172f56';

export async function themeColor() {
    return THEME_COLOR;
}
