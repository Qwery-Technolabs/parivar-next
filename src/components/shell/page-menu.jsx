'use client';
import { useRouter } from 'next/navigation';
import { createContext, useContext, useEffect, useRef, useState, useTransition } from 'react';
import { toast } from 'sonner';
import { KebabMenu, MenuItem } from '@/components/ui/popover';
import { useT } from '@/lib/i18n/client';

/*
 * A page's actions as a kebab (⋮) at the right end of the title row, instead of a row of buttons.
 *   <PageHeader menu={<PageMenu items={[...]}>{dialogs}</PageMenu>} />
 * Items (plain data, so server pages can pass them):
 *   { key, label, icon: <Icon/>, href }        → a link
 *   { key, label, icon: <Icon/>, action }      → a server action run in place (e.g. mark all read);
 *                                                add confirm: '…' to ask first, danger: true for red
 *   { key, label, icon: <Icon/> }              → opens the dialog registered under `key`
 * Dialogs stay mounted as `children`, outside the menu — a menu unmounts when it closes, which
 * would take an open dialog with it. A dialog registers its open() with <MenuOpener> (pass
 * `menuKey` to the dialog components that support it).
 */
const Ctx = createContext(null);

export default function PageMenu({ items, children, label }) {
    const { t } = useT();
    const router = useRouter();
    const openers = useRef({});
    // Stable register / unregister handed to dialogs; they never touch the ref themselves.
    const [registry] = useState(() => ({
        register: (id, fn) => {
            openers.current[id] = fn;
        },
        unregister: (id, fn) => {
            if (openers.current[id] === fn) delete openers.current[id];
        },
    }));
    const [pending, startTransition] = useTransition();
    const visible = items.filter(Boolean);
    if (visible.length === 0 && !children) return null;

    return (
        <Ctx.Provider value={registry}>
            {children}
            {visible.length > 0 && (
                <KebabMenu label={label ?? t('common.more')}>
                    {(close) =>
                        visible.map((item) => (
                            <MenuItem
                                key={item.key}
                                icon={item.icon}
                                href={item.href}
                                danger={item.danger}
                                disabled={pending}
                                onClick={
                                    item.href
                                        ? undefined
                                        : () => {
                                              close();
                                              if (item.confirm && !window.confirm(item.confirm)) return;
                                              if (item.action) {
                                                  startTransition(async () => {
                                                      const res = await item.action();
                                                      if (res?.error) return toast.error(t(res.error));
                                                      if (res?.message) toast.success(t(res.message));
                                                      router.refresh();
                                                  });
                                              } else {
                                                  openers.current[item.key]?.();
                                              }
                                          }
                                }
                            >
                                {item.label}
                            </MenuItem>
                        ))
                    }
                </KebabMenu>
            )}
        </Ctx.Provider>
    );
}

/** Rendered as a dialog's trigger when it lives in a PageMenu: registers open(), draws nothing. */
export function MenuOpener({ id, open }) {
    const registry = useContext(Ctx);
    useEffect(() => {
        if (!registry) return;
        registry.register(id, open);
        return () => registry.unregister(id, open);
    }, [registry, id, open]);
    return null;
}
