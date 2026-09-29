'use client';
import { Loader2 } from 'lucide-react';
import { useRef, useTransition } from 'react';
import { selectInput } from '@/components/ui/field';

/**
 * A language dropdown that saves as soon as a new one is picked (Settings → Language).
 * Posts `name=value` to `action` (a plain server action taking FormData).
 * @param {{ action: (fd: FormData) => Promise<void>, name: string, value: string, label: string, options: Array<{ value: string, label: string }> }} props
 */
export default function LanguageSelect({ action, name, value, label, options }) {
    const form = useRef(null);
    const [pending, startTransition] = useTransition();
    return (
        <form ref={form} className="flex items-center gap-2">
            <select
                name={name}
                defaultValue={value}
                aria-label={label}
                disabled={pending}
                onChange={() => startTransition(() => action(new FormData(form.current)))}
                className={`${selectInput()} w-full`}
            >
                {options.map((o) => (
                    <option key={o.value} value={o.value} lang={o.value}>
                        {o.label}
                    </option>
                ))}
            </select>
            {pending && <Loader2 className="size-4 shrink-0 animate-spin text-ink-gray" />}
        </form>
    );
}
