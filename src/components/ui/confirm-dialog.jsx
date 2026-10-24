'use client';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useT } from '@/lib/i18n/client';

/**
 * The app's own "Are you sure?" — in place of the browser's window.confirm: a small centred card with a tinted icon
 * circle, title, one line, then Cancel · the action (a spinner while it runs). `tone` 'danger' = red action.
 * @param {{ open: boolean, onOpenChange: (v: boolean) => void, icon?: any, tone?: 'default' | 'danger', title: string,
 *   description?: string, confirmLabel: string, pending?: boolean, onConfirm: () => void }} props
 */
export default function ConfirmDialog({
    open,
    onOpenChange,
    icon: Icon = null,
    tone = 'default',
    title,
    description,
    confirmLabel,
    pending = false,
    onConfirm,
}) {
    const { t } = useT();
    const danger = tone === 'danger';
    return (
        <Dialog open={open} onOpenChange={(v) => !pending && onOpenChange(v)}>
            <DialogContent focusPopup className="bg-white text-center sm:max-w-sm">
                <DialogHeader className="items-center">
                    {Icon && (
                        <span
                            className={`mx-auto flex size-11 items-center justify-center rounded-full ${
                                danger ? 'bg-rose-50 text-rose-600' : 'bg-brand-orange/10 text-brand-orange-strong'
                            }`}
                        >
                            <Icon className="size-5" />
                        </span>
                    )}
                    <DialogTitle className="text-base font-semibold text-primary">{title}</DialogTitle>
                    {description && <DialogDescription className="text-sm text-ink-gray">{description}</DialogDescription>}
                </DialogHeader>
                <div className="mt-1 grid grid-cols-2 gap-2">
                    <Button variant="outline" size="lg" onClick={() => onOpenChange(false)} disabled={pending}>
                        {t('common.cancel')}
                    </Button>
                    <Button variant={danger ? 'destructive' : 'default'} size="lg" onClick={onConfirm} disabled={pending}>
                        {pending && <Loader2 className="animate-spin" />} {confirmLabel}
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
