import { ChevronDown, Info } from 'lucide-react';

/**
 * Settings → Family tree: what the four numbers do, in plain words — a slim strip above the form, closed by default
 * (a native <details>, no script), so the page keeps its look. The example uses the values saved now.
 * @param {{ values: { tree_fold_above: number, tree_up_generations: number, tree_open_generations: number, tree_branch_generations: number }, t: Function }} props
 */
export default function TreeFoldHelp({ values, t }) {
    const v = { size: values.tree_fold_above, up: values.tree_up_generations, open: values.tree_open_generations, branch: values.tree_branch_generations };
    const items = [
        ['size', t('settings.treeHelp.size', v)],
        ['up', t('settings.treeHelp.up', v)],
        ['open', t('settings.treeHelp.open', v)],
        ['branch', t('settings.treeHelp.branch', v)],
    ];
    return (
        <details className="group mb-3 rounded-lg border border-surface-border bg-white shadow-sm">
            <summary className="flex cursor-pointer list-none items-center gap-2 px-3.5 py-2.5 text-sm font-medium text-primary [&::-webkit-details-marker]:hidden">
                <Info className="size-4 shrink-0 text-brand-orange-strong" />
                <span className="flex-1">{t('settings.treeHelp.title')}</span>
                <ChevronDown className="size-4 shrink-0 text-ink-gray transition-transform group-open:rotate-180" />
            </summary>
            <div className="space-y-2.5 border-t border-surface-border px-3.5 py-3 text-xs leading-relaxed text-ink">
                <p className="text-ink-gray">{t('settings.treeHelp.intro')}</p>
                <ol className="space-y-1.5">
                    {items.map(([k, text], i) => (
                        <li key={k} className="flex gap-2">
                            <span className="flex size-4.5 shrink-0 items-center justify-center rounded-full bg-brand-navy text-[10px] font-semibold text-white">
                                {i + 1}
                            </span>
                            <span>{text}</span>
                        </li>
                    ))}
                </ol>
                <p className="rounded-md bg-surface-bggray/70 px-2.5 py-2 text-ink-gray">{t('settings.treeHelp.always')}</p>
                <p className="text-ink-gray">{t('settings.treeHelp.example', v)}</p>
            </div>
        </details>
    );
}
