'use client';
import { ChevronDown } from 'lucide-react';
import { useState } from 'react';
import { textInput } from '@/components/ui/field';
import { useT } from '@/lib/i18n/client';
import { COUNTRIES, splitPhone } from '@/lib/phone';

/**
 * A phone number with its country code — every phone box in the app. Left: the code ("+91 ▾"; a native select
 * laid invisibly over it, so phones get their own picker), right: the number. Posts ONE value under `name`:
 * an Indian number as typed (normalizePhone makes it 10 digits), any other as "+<code><number>" — the stored
 * form (lib/phone.js). Starts on India, or on the country of `defaultValue`.
 * Controlled when `value` + `onChange(full)` are given (invite rows); otherwise uncontrolled.
 * @param {{ name?: string, defaultValue?: string, value?: string, onChange?: (v: string) => void, hasError?: boolean,
 *           size?: string, placeholder?: string, id?: string, autoFocus?: boolean, autoComplete?: string, 'aria-label'?: string, required?: boolean }} props
 */
export default function PhoneInput({
    name,
    defaultValue = '',
    value,
    onChange,
    hasError = false,
    size = 'h-9',
    placeholder,
    id,
    autoFocus,
    autoComplete = 'tel-national',
    'aria-label': ariaLabel,
    required = false,
}) {
    const { t, locale } = useT();
    const start = splitPhone(value ?? defaultValue);
    const [country, setCountry] = useState(() => COUNTRIES.find((c) => c.dial === start.dial)?.code ?? 'IN');
    const [own, setOwn] = useState(start.national);
    const controlled = value !== undefined;
    const national = controlled ? splitPhone(value).national : own;
    const dial = COUNTRIES.find((c) => c.code === country)?.dial ?? '91';
    const full = (d, n) => (!n.trim() ? '' : d === '91' ? n : `+${d}${n.replace(/\D/g, '')}`);
    const emit = (d, n) => {
        if (!controlled) setOwn(n);
        onChange?.(full(d, n));
    };
    return (
        <div className="flex min-w-0">
            {name && <input type="hidden" name={name} value={full(dial, national)} />}
            <span
                className={`relative inline-flex shrink-0 items-center gap-1 rounded-l-md border border-r-0 bg-surface-bggray/60 px-2 text-sm font-medium text-primary tabular-nums ${size} ${
                    hasError ? 'border-destructive' : 'border-surface-border'
                }`}
                title={t('phone.country')}
            >
                +{dial}
                <ChevronDown className="size-3.5 text-ink-gray" />
                <select
                    aria-label={t('phone.country')}
                    value={country}
                    onChange={(e) => {
                        setCountry(e.target.value);
                        emit(COUNTRIES.find((c) => c.code === e.target.value)?.dial ?? '91', national);
                    }}
                    className="absolute inset-0 cursor-pointer opacity-0"
                >
                    {COUNTRIES.map((c) => (
                        <option key={c.code} value={c.code}>
                            {(locale !== 'en' && c.gu) || c.name} (+{c.dial})
                        </option>
                    ))}
                </select>
            </span>
            <input
                id={id}
                type="tel"
                inputMode="tel"
                autoComplete={autoComplete}
                autoFocus={autoFocus}
                required={required}
                aria-label={ariaLabel}
                placeholder={placeholder}
                value={national}
                onChange={(e) => emit(dial, e.target.value)}
                className={`${textInput(hasError, size)} w-full min-w-0 rounded-l-none tabular-nums`}
            />
        </div>
    );
}
