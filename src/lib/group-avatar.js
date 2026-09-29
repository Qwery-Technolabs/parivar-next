// Pure module — client and server. A group's avatar: an icon, an emoji or up to 2 characters
// of text, on a chosen background colour. Stored as admin_groupsmeta keys avatar_kind,
// avatar_value, avatar_color; the lists here are the only values accepted.

/** Business / community icons (lucide-react export names), grouped by theme for the picker. */
export const AVATAR_ICONS = [
    'Users', 'UsersRound', 'HandHeart', 'HandHelping', 'HeartHandshake', 'Handshake', 'Home', 'Building', 'Building2', 'Landmark', 'Castle', 'Church', 'Hotel', 'Hospital', 'School', 'Store', 'Warehouse', 'Factory', 'Tent', 'Vote', 'Flag',
    'HandCoins', 'Wallet', 'PiggyBank', 'Coins', 'Banknote', 'IndianRupee', 'Receipt', 'Calculator', 'BarChart3', 'TrendingUp', 'Target', 'Presentation', 'Briefcase', 'ShoppingBag', 'ShoppingCart', 'Package', 'Gem', 'Crown', 'Scale', 'Gavel', 'Stamp', 'ScrollText',
    'Hammer', 'Wrench', 'Cog', 'HardHat', 'Construction', 'Tractor', 'Truck', 'Container', 'Lightbulb', 'Rocket', 'Laptop', 'Smartphone', 'Phone', 'Mail', 'Camera', 'Mic', 'Megaphone', 'Bell', 'Key', 'Shield', 'ShieldCheck',
    'Car', 'Bus', 'TrainFront', 'Plane', 'Ship', 'Bike', 'Fuel', 'Globe', 'MapPin',
    'Sun', 'Sunrise', 'Moon', 'Mountain', 'Trees', 'TreePine', 'Leaf', 'Sprout', 'Flower', 'Flower2', 'Wheat', 'Droplet', 'Droplets', 'Flame', 'PawPrint', 'Bird',
    'Utensils', 'Carrot', 'Apple', 'Coffee', 'Milk', 'CakeSlice',
    'Gift', 'PartyPopper', 'Sparkles', 'Star', 'Heart', 'Trophy', 'Award', 'Medal', 'Ticket', 'Music', 'Guitar', 'Drum', 'Infinity',
    'Stethoscope', 'HeartPulse', 'Ambulance', 'Pill', 'Microscope', 'Dumbbell', 'Baby',
    'BookOpen', 'Library', 'Newspaper', 'GraduationCap', 'Palette', 'Paintbrush', 'Scissors', 'Shirt', 'CalendarDays',
];

export const AVATAR_EMOJIS = [
    '🙏', '🛕', '🕉️', '🪔', '📿', '🏠', '👨‍👩‍👧‍👦', '🤝', '💰', '🪙', '🌸', '🌾', '🐄', '🌳',
    '🎉', '🎊', '🙌', '❤️', '⭐', '🏫', '🎓', '🏥', '🩸', '📅', '🚩', '🎶', '🍲', '🏆', '💼', '📢',
];

/** Preset background colours. Every one carries white text/icons at ≥4.5:1 (measured).
 *  Any other #rrggbb is accepted too (custom colour); avatarInk() picks its text colour. */
export const AVATAR_COLORS = [
    '#172f56', // navy 13.31
    '#1d4ed8', // blue 6.70
    '#4338ca', // indigo 7.90
    '#7e22ce', // purple 6.98
    '#be123c', // rose 6.29
    '#9f1239', // crimson 8.02
    '#b85d09', // orange 4.56
    '#047857', // emerald 5.48
    '#0f766e', // teal 5.47
    '#0e7490', // cyan 5.36
    '#475467', // slate 7.69
];

export const AVATAR_KINDS = ['icon', 'emoji', 'text'];

const HEX = /^#[0-9a-f]{6}$/i;

/** A preset or custom colour, lower-cased; '' when not a #rrggbb value. */
export function cleanAvatarColor(raw) {
    const c = String(raw ?? '').trim().toLowerCase();
    return HEX.test(c) ? c : '';
}

function luminance(hex) {
    const ch = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
    const [r, g, b] = ch.map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/**
 * Text/icon colour for a background: white while it keeps ≥4.5:1, otherwise dark navy
 * (a light custom colour like yellow would make white text unreadable).
 */
export function avatarInk(hex) {
    if (!HEX.test(hex ?? '')) return '#ffffff';
    const l = luminance(hex);
    return 1.05 / (l + 0.05) >= 4.5 ? '#ffffff' : '#101828';
}

/** A random preset icon + colour: the starting picture for a new group. */
export function randomAvatar() {
    const pick = (a) => a[Math.floor(Math.random() * a.length)];
    return { avatar_kind: 'icon', avatar_value: pick(AVATAR_ICONS), avatar_color: pick(AVATAR_COLORS) };
}

/** Text avatars: at most 2 visible characters (grapheme-ish: Array.from counts code points). */
export function cleanAvatarText(raw) {
    return Array.from(String(raw ?? '').trim()).slice(0, 2).join('');
}

/**
 * Validate what a form submitted; anything unknown falls back to "no custom avatar"
 * (the page then shows the group's first letter on a tint).
 * @returns {{ avatar_kind: string, avatar_value: string, avatar_color: string }}
 */
export function sanitizeAvatar(kind, value, color) {
    const c = cleanAvatarColor(color);
    if (kind === 'icon' && AVATAR_ICONS.includes(value)) return { avatar_kind: 'icon', avatar_value: value, avatar_color: c };
    if (kind === 'emoji' && AVATAR_EMOJIS.includes(value)) return { avatar_kind: 'emoji', avatar_value: value, avatar_color: c };
    const text = kind === 'text' ? cleanAvatarText(value) : '';
    if (text) return { avatar_kind: 'text', avatar_value: text, avatar_color: c };
    return { avatar_kind: '', avatar_value: '', avatar_color: c };
}
