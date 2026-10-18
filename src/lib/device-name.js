// Pure module — client and server. A push device (token) described from its browser's user agent.

/** "Chrome · Android" — enough to tell one's devices apart. */
export function deviceName(ua = '') {
    const s = String(ua ?? '');
    const browser = /SamsungBrowser/.test(s)
        ? 'Samsung Internet'
        : /Edg\//.test(s)
          ? 'Edge'
          : /OPR\//.test(s)
            ? 'Opera'
            : /Firefox\//.test(s)
              ? 'Firefox'
              : /Chrome\//.test(s)
                ? 'Chrome'
                : /Safari\//.test(s)
                  ? 'Safari'
                  : null;
    const os = /iPhone|iPad/.test(s)
        ? 'iPhone / iPad'
        : /Android/.test(s)
          ? 'Android'
          : /Windows/.test(s)
            ? 'Windows'
            : /Mac OS X/.test(s)
              ? 'Mac'
              : /Linux/.test(s)
                ? 'Linux'
                : null;
    return [browser, os].filter(Boolean).join(' · ') || '—';
}

/** A phone / tablet (vs a computer). */
export const isPhone = (ua) => /Android|iPhone|iPad|Mobile/.test(String(ua ?? ''));
