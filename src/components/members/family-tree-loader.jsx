'use client';
import { Loader2 } from 'lucide-react';
import dynamic from 'next/dynamic';

// Lazy: the tree is only needed on this one route, so its code is split out of the
// shared bundle. `ssr:false` has to live in a client component (Next 16).
const FamilyTree = dynamic(() => import('./family-tree'), {
    ssr: false,
    loading: () => (
        <div className="flex justify-center py-16">
            <Loader2 className="size-5 animate-spin text-ink-gray" />
        </div>
    ),
});

export default function FamilyTreeLoader({ tree }) {
    return <FamilyTree tree={tree} />;
}
