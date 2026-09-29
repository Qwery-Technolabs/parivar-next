'use client';
import { RefreshCw } from 'lucide-react';
import { useT } from '@/lib/i18n/client';
import { Field, textArea, textInput } from './field';

/**
 * The Gujarati twin of an English name field, driven by useAutoGujarati. Shows where the
 * value came from ("auto" vs typed) and a button to re-suggest from the English text.
 * @param {{ label: string, name: string, auto: ReturnType<typeof import('./use-auto-gujarati').useAutoGujarati>, maxLength?: number, className?: string }} props
 */
export default function GujaratiField({ label, name, auto, maxLength = 150, className = '', multiline = false, rows = 4 }) {
    const { t } = useT();
    return (
        <Field label={label} hint={auto.manual ? t('common.guManual') : t('common.guAuto')} className={className}>
            <div className="relative">
                {multiline ? (
                    <textarea name={name} rows={rows} maxLength={maxLength} {...auto.guProps} className={`${textArea()} w-full pr-9`} />
                ) : (
                    <input name={name} maxLength={maxLength} {...auto.guProps} className={`${textInput()} w-full pr-9`} />
                )}
                <button
                    type="button"
                    onClick={auto.regenerate}
                    title={t('common.guRegenerate')}
                    aria-label={t('common.guRegenerate')}
                    className={`absolute right-0 flex w-9 items-center justify-center text-ink-gray hover:text-primary ${multiline ? 'top-0 h-9' : 'inset-y-0'}`}
                >
                    <RefreshCw className="size-3.5" />
                </button>
            </div>
        </Field>
    );
}
