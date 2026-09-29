import { selectInput } from '@/components/ui/field';

export const CAMPAIGN_FORM_ID = 'campaign-form';

/**
 * The fundraise Status picker, drawn in the page's title row (left of the kebab) but still
 * part of the campaign form through the form="…" attribute — it posts with Save.
 * @param {{ value?: string, t: (key: string) => string }} props
 */
export default function StatusSelect({ value = 'active', t }) {
    return (
        <label className="flex items-center gap-2">
            <span className="shrink-0 text-xs font-medium text-ink-gray">{t('fundraise.status')}</span>
            <select name="status" form={CAMPAIGN_FORM_ID} defaultValue={value} className={`${selectInput()} w-36`}>
                {['active', 'draft', 'closed'].map((st) => (
                    <option key={st} value={st}>
                        {t(`fundraise.${st}`)}
                    </option>
                ))}
            </select>
        </label>
    );
}
