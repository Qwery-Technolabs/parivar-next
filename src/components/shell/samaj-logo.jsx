import GroupAvatar from '@/components/groups/group-avatar';

/** The default Samaj logo: the people icon on the brand orange. */
export const DEFAULT_LOGO = { kind: 'icon', value: 'Users', color: '#b85d09' };

/**
 * The Samaj's logo — chosen in Settings → General with the group picture picker (icon /
 * emoji / 2 letters on a colour); the orange people icon until one is set. Hook-free, so it
 * renders in the app shell, the sign-in screen and the public pages alike.
 * @param {{ settings: { logo_kind?: string, logo_value?: string, logo_color?: string }, name?: string, size?: 'sm'|'md', className?: string }} props
 */
export default function SamajLogo({ settings = {}, name = '', size = 'sm', className = '' }) {
    const chosen = Boolean(settings.logo_kind);
    return (
        <GroupAvatar
            name={name}
            kind={chosen ? settings.logo_kind : DEFAULT_LOGO.kind}
            value={chosen ? settings.logo_value : DEFAULT_LOGO.value}
            color={settings.logo_color || DEFAULT_LOGO.color}
            size={size}
            // A rounded square, like an app icon (group pictures are round).
            className={`rounded-md! ${size === 'md' ? 'size-10! rounded-lg!' : ''} ${className}`}
        />
    );
}
