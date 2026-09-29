'use client';
import { Loader2, Pencil, Plus, Trash2 } from 'lucide-react';
import dynamic from 'next/dynamic';
import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { deleteEvent } from '@/app/actions/events';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { MenuOpener } from '@/components/shell/page-menu';
import { KebabMenu, MenuItem, MenuSeparator } from '@/components/ui/popover';
import { useT } from '@/lib/i18n/client';

// Lazy: the form's code is fetched on the first open, not with the calendar page.
const EventFormDialog = dynamic(() => import('./event-form-dialog'), { ssr: false });

/** "New event" button. */
export function NewEventButton({ groups, types, defaultDate, menuKey }) {
    const { t } = useT();
    const [open, setOpen] = useState(false);
    const [mounted, setMounted] = useState(false);
    const show = () => {
        setMounted(true);
        setOpen(true);
    };
    return (
        <>
            {menuKey ? (
                <MenuOpener id={menuKey} open={show} />
            ) : (
            <button
                type="button"
                onClick={() => {
                    setMounted(true);
                    setOpen(true);
                }}
                className="inline-flex h-9 w-full shrink-0 items-center justify-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90 sm:w-auto"
            >
                <Plus className="size-4" /> {t('calendar.add')}
            </button>
            )}
            {mounted && (
                <EventFormDialog open={open} onOpenChange={setOpen} groups={groups} types={types} defaultDate={defaultDate} />
            )}
        </>
    );
}

/** Kebab on an agenda row: edit / delete. */
export function EventRowMenu({ event, groups, types }) {
    const { t } = useT();
    const [editOpen, setEditOpen] = useState(false);
    const [mounted, setMounted] = useState(false);
    const [confirmOpen, setConfirmOpen] = useState(false);
    const [pending, startTransition] = useTransition();

    function remove() {
        startTransition(async () => {
            const fd = new FormData();
            fd.set('id', String(event.id));
            const res = await deleteEvent(null, fd);
            if (res?.ok) {
                setConfirmOpen(false);
                toast.success(t(res.message ?? 'common.deleted'));
            } else toast.error(t(res?.error ?? 'common.error'));
        });
    }

    return (
        <>
            <KebabMenu label={t('common.more')}>
                {(close) => (
                    <>
                        <MenuItem
                            icon={Pencil}
                            onClick={() => {
                                close();
                                setMounted(true);
                                setEditOpen(true);
                            }}
                        >
                            {t('common.edit')}
                        </MenuItem>
                        <MenuSeparator />
                        <MenuItem
                            icon={Trash2}
                            danger
                            onClick={() => {
                                close();
                                setConfirmOpen(true);
                            }}
                        >
                            {t('common.delete')}
                        </MenuItem>
                    </>
                )}
            </KebabMenu>
            {mounted && <EventFormDialog open={editOpen} onOpenChange={setEditOpen} event={event} groups={groups} types={types} />}
            <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
                <DialogContent className="bg-white sm:max-w-sm">
                    <DialogHeader>
                        <DialogTitle className="text-base font-semibold text-primary">{t('common.delete')}</DialogTitle>
                        <DialogDescription className="text-sm text-ink-gray">{t('common.confirmDelete')}</DialogDescription>
                    </DialogHeader>
                    <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                        <button
                            type="button"
                            onClick={() => setConfirmOpen(false)}
                            className="inline-flex h-9 items-center justify-center rounded-md border border-surface-border bg-white px-4 text-sm font-medium text-primary hover:bg-accent"
                        >
                            {t('common.cancel')}
                        </button>
                        <button
                            type="button"
                            onClick={remove}
                            disabled={pending}
                            className="inline-flex h-9 items-center justify-center gap-2 rounded-md bg-destructive px-4 text-sm font-medium text-white hover:bg-destructive/90 disabled:opacity-60"
                        >
                            {pending ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
                            {t('common.delete')}
                        </button>
                    </div>
                </DialogContent>
            </Dialog>
        </>
    );
}
