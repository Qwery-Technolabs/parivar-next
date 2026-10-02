'use client';
import { useT } from '@/lib/i18n/client';
import { LOCAL_LANGUAGES } from '@/lib/local-language';
import { Field, textArea, textInput } from './field';
import GujaratiField from './gujarati-field';
import { useAutoGujarati } from './use-auto-gujarati';

/**
 * English name + its auto-filled, editable Gujarati twin. A component (not just the hook)
 * so it can sit inside FormDialog's render-prop children, where hooks cannot be called.
 * Renders two siblings — wrap in a grid if they should sit side by side.
 */
export default function BilingualName({
    enLabel,
    guLabel,
    enName,
    guName,
    defaultEn = '',
    defaultGu = '',
    error = null,
    required = false,
    maxLength = 150,
    multiline = false,
    rows = 4,
    className = '',
    example = null,
}) {
    const auto = useAutoGujarati(defaultEn, defaultGu, example);
    const { localLang } = useT();
    // Labels carry a {lang} slot: "Full name ({lang})" → "Full name (हिन्दी)" for a Hindi writer.
    const localLabel = guLabel.replace('{lang}', LOCAL_LANGUAGES[localLang]?.label ?? '');
    return (
        <>
            <Field label={enLabel} error={error} required={required} className={className}>
                {multiline ? (
                    <textarea name={enName} rows={rows} maxLength={maxLength} {...auto.enProps} className={`${textArea(!!error)} w-full`} />
                ) : (
                    <input
                        name={enName}
                        required={required}
                        maxLength={maxLength}
                        autoComplete="off"
                        {...auto.enProps}
                        className={`${textInput(!!error)} w-full`}
                    />
                )}
            </Field>
            <GujaratiField label={localLabel} name={guName} auto={auto} maxLength={maxLength} multiline={multiline} rows={rows} className={className} />
        </>
    );
}
