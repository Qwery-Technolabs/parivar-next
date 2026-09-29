import { redirect } from 'next/navigation';

// Profile moved into Settings → My settings; old links and bookmarks still land there.
export default function ProfilePage() {
    redirect('/settings');
}
