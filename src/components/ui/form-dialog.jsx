'use client';
import { startTransition, useActionState, useState } from 'react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useT } from '@/lib/i18n/client';
import SubmitButton from './submit-button';

/**
 * A button that opens a dialog holding one server-action form.
 *
 * Server action contract, used by every form in the app:
 *   (prevState, formData) => { ok: true, message?: i18nKey } | { error?: i18nKey, fieldErrors?: { [field]: i18nKey } }
 *
 * `children` is a render function receiving { fieldError(name) } so each Field can show
 * its own translated error. The dialog closes and toasts on success.
 */
export default function FormDialog({
    trigger,
    title,
    description,
    action,
    submitLabel,
    submitIcon,
    submitVariant,
    children,
    width = 'sm:max-w-lg',
    hidden = {},
    onSuccess,
}) {
    const { t } = useT();
    const [open, setOpen] = useState(false);
    // Remount the form each time it opens, so a previous attempt's errors do not linger.
    const [formKey, setFormKey] = useState(0);

    return (
        <>
            {trigger({
                open: () => {
                    setFormKey((k) => k + 1);
                    setOpen(true);
                },
            })}
            <Dialog open={open} onOpenChange={setOpen}>
                {/* sm:max-w-*, never max-w-*: the base class ends in sm:max-w-sm and would win above sm. */}
                {/* No autofocus on a field (focusPopup): nothing pre-selected, no phone keyboard on open. */}
                <DialogContent focusPopup className={`${width} max-h-[92vh] overflow-y-auto bg-white`}>
                    <DialogHeader>
                        <DialogTitle className="text-base font-semibold text-primary">{title}</DialogTitle>
                        {description && <DialogDescription className="text-xs text-ink-gray">{description}</DialogDescription>}
                    </DialogHeader>
                    <DialogForm
                        key={formKey}
                        action={action}
                        hidden={hidden}
                        submitLabel={submitLabel ?? t('common.save')}
                        submitIcon={submitIcon}
                        submitVariant={submitVariant}
                        onDone={(state) => {
                            setOpen(false);
                            if (state.message) toast.success(t(state.message, state.vars));
                            onSuccess?.(state);
                        }}
                        onCancel={() => setOpen(false)}
                    >
                        {children}
                    </DialogForm>
                </DialogContent>
            </Dialog>
        </>
    );
}

function DialogForm({ action, hidden, submitLabel, submitIcon, submitVariant, onDone, onCancel, children }) {
    const { t } = useT();
    const [state, formAction, pending] = useActionState(async (prev, fd) => {
        const res = (await action(prev, fd)) ?? {};
        if (res.ok) onDone(res);
        return res;
    }, null);

    const fieldError = (name) => (state?.fieldErrors?.[name] ? t(state.fieldErrors[name]) : null);

    return (
        <form
            // Not <form action>: React resets uncontrolled fields after a form action,
            // which would wipe the input when the server returns a validation error.
            onSubmit={(e) => {
                e.preventDefault();
                const fd = new FormData(e.currentTarget);
                startTransition(() => formAction(fd));
            }}
            className="space-y-3"
        >
            {Object.entries(hidden).map(([k, v]) => (
                <input key={k} type="hidden" name={k} value={v ?? ''} />
            ))}
            {typeof children === 'function' ? children({ fieldError, state }) : children}
            {state?.error && (
                <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-xs font-medium text-destructive">
                    {t(state.error, state.vars)}
                </p>
            )}
            {/* Pinned to the bottom of the scrolling dialog, so Save never scrolls out of reach. */}
            {/* Cancel and Save side by side — halves on phones, their own width from sm up. */}
            <div className="sticky bottom-0 -mx-4 flex flex-row gap-2 border-t border-surface-border bg-white px-4 py-3 sm:justify-end">
                <button
                    type="button"
                    onClick={onCancel}
                    className="inline-flex h-9 flex-1 items-center justify-center rounded-md border border-surface-border bg-white px-4 text-sm font-medium text-primary hover:bg-accent sm:flex-none"
                >
                    {t('common.cancel')}
                </button>
                <SubmitButton icon={submitIcon} variant={submitVariant} pendingText={t('common.saving')} pending={pending} className="flex-1 sm:flex-none">
                    {submitLabel}
                </SubmitButton>
            </div>
        </form>
    );
}
