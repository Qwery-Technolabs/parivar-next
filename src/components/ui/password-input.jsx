'use client';
import { Eye, EyeOff } from 'lucide-react';
import { useState } from 'react';
import { useT } from '@/lib/i18n/client';
import { cn } from '@/lib/utils';

/**
 * A password box with an eye button to show / hide what is typed. Takes every <input> prop
 * (name, autoComplete, required, minLength, className …); `type` is managed here. Use it for
 * every password field in the app.
 */
export default function PasswordInput({ className = '', ...props }) {
    const { t } = useT();
    const [show, setShow] = useState(false);
    const label = show ? t('common.hidePassword') : t('common.showPassword');
    return (
        <div className="relative">
            <input {...props} type={show ? 'text' : 'password'} className={cn(className, 'pr-10')} />
            <button
                type="button"
                onClick={() => setShow((s) => !s)}
                aria-label={label}
                aria-pressed={show}
                title={label}
                className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-ink-gray hover:text-primary"
            >
                {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </button>
        </div>
    );
}
