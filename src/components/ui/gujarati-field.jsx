'use client';
import { RefreshCw } from 'lucide-react';
import { useRef } from 'react';
import { useT } from '@/lib/i18n/client';
import { Field, textArea, textInput } from './field';
import FloatingList from './floating-list';

/**
 * The Gujarati twin of an English name field, driven by useAutoGujarati — like Google Input
 * Tools: while either field has focus, a numbered list under it shows Google's suggestions with
 * the English spelling last; click one to take it (↑ / ↓ in the English field do the same).
 * The hint says where the value came from ("auto", "your spelling", or "Suggestion 2 of 6"), and
 * ↻ steps through the suggestions (1st, 2nd, 3rd … — from the 1st again after a manual edit).
 * @param {{ label: string, name: string, auto: ReturnType<typeof import('./use-auto-gujarati').useAutoGujarati>, maxLength?: number, className?: string }} props
 */
export default function GujaratiField({ label, name, auto, maxLength = 150, className = '', multiline = false, rows = 4 }) {
    const { t } = useT();
    const { list } = auto;
    const wrap = useRef(null);
    return (
        <Field
            label={label}
            hint={
                auto.manual
                    ? t('common.guManual')
                    : auto.position && auto.position.total > 1
                      ? t('common.guSuggestion', auto.position)
                      : t('common.guAuto')
            }
            className={className}
        >
            <div ref={wrap} className="relative">
                {multiline ? (
                    <textarea name={name} rows={rows} maxLength={maxLength} {...auto.guProps} className={`${textArea()} w-full pr-9`} />
                ) : (
                    <input name={name} maxLength={maxLength} autoComplete="off" {...auto.guProps} className={`${textInput()} w-full pr-9`} />
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
                {list.open && (
                    // On the page's top layer — never clipped by the card it sits in.
                    <FloatingList anchorRef={wrap} role="listbox" aria-label={label}>
                        {list.choices.map((c, i) => (
                            <li key={`${i}-${c}`} role="option" aria-selected={i === list.active}>
                                <button
                                    type="button"
                                    // mousedown, not click: picking must happen before the field's blur closes the list.
                                    onMouseDown={(e) => {
                                        e.preventDefault();
                                        list.pick(i);
                                    }}
                                    className={`flex w-full items-baseline gap-2 px-3 py-1.5 text-left text-sm ${
                                        i === list.active ? 'bg-accent font-medium text-primary' : 'text-ink hover:bg-accent/60'
                                    }`}
                                >
                                    <span className="w-4 shrink-0 text-xs text-ink-gray tabular-nums">{i + 1}.</span>
                                    <span className="min-w-0 break-words">{c}</span>
                                </button>
                            </li>
                        ))}
                    </FloatingList>
                )}
            </div>
        </Field>
    );
}
