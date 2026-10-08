// /mandal/[id] — a Mandal's own address. Same page as a fundraise (tabs: Discussion · Meetings ·
// Savings · About); /fundraise/[id] of a Mandal redirects here, and this redirects a plain fundraise back.
import FundraiseDetailPage, { generateMetadata } from '../../fundraise/[id]/page';

export { generateMetadata };

export default function MandalPage(props) {
    return FundraiseDetailPage({ ...props, asMandal: true });
}
