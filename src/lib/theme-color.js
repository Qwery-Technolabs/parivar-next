import 'server-only';
import { DEFAULT_LOGO } from '@/components/shell/samaj-logo';
import { cleanAvatarColor } from './group-avatar';
import { getSettings } from './settings';

/**
 * The browser / installed-app theme colour: the Samaj logo's background (Settings → General),
 * else the default logo's orange. Used by the root viewport and the web manifest.
 */
export async function themeColor() {
    try {
        return cleanAvatarColor((await getSettings('admin')).logo_color) || DEFAULT_LOGO.color;
    } catch {
        return DEFAULT_LOGO.color; // no database (build time)
    }
}
