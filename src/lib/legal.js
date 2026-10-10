// About the app: who built it, the privacy policy (English + Gujarati) and the open-source packages it is
// built with. Pure data — the public /privacy-policy page and Settings → About both render it.
// The policy describes what the app really stores and sends; change it together with the app.

export const DEVELOPER = { name: 'Manthan Kanani', phone: '+918690355381', phoneShown: '+91 86903 55381' };

export const POLICY_UPDATED = '2026-10-10';

/**
 * The privacy policy by language: [{ title, body: string[] (paragraphs), list?: string[] }].
 * `{samaj}` is replaced with the Samaj name (Settings → General).
 */
export const PRIVACY_POLICY = {
    en: [
        {
            title: 'Who we are',
            body: [
                'This app is the members’ app of {samaj}. It is run by the Samaj’s administrators for its members and their families. It was developed by Manthan Kanani, who can be contacted at the number at the end of this policy.',
            ],
        },
        {
            title: 'What we keep about you',
            body: ['Only what members and administrators enter into the app:'],
            list: [
                'Account: your name (in English and your local language), mobile number and a password (stored only as a one-way hash, never readable).',
                'Profile: date of birth, gender, blood group and whether you are willing to donate blood, village and city, caste / sub-caste, marital status.',
                'Family: the relatives you or an administrator link to you (parents, spouse, children, brothers, sisters) for the family tree.',
                'Matrimony: only if a profile is listed for you — the details written in it.',
                'Groups, fundraisers and Mandals: your memberships and roles, contributions and expenses recorded, attendance at Mandal meetings, replies to meetings, and messages you post in discussions.',
                'Technical: a sign-in cookie, the browser / device type of each signed-in session, a push-notification address if you turn notifications on, a record of changes made in the app (activity log), and error reports when a page fails.',
            ],
        },
        {
            title: 'How it is used',
            body: [
                'To run the Samaj’s work: the member directory and family tree, groups and meetings with reminders, fundraisers and Mandal savings with their accounts, blood-donor search and the notifications you choose. It is not sold, not used for advertising and not shared for marketing.',
            ],
        },
        {
            title: 'Who can see it',
            body: [
                'Signed-in members of the Samaj can see the member directory, including members’ names, villages, mobile numbers and profile details such as birth date and blood group (so members can reach each other), and the blood-donor list with contact numbers. For relatives added through the family tree, the phone number, birth date and marital status are shown only to their family, to whoever added them and to member administrators. Administrators can see and edit what their role allows, and every change is recorded in the activity log.',
                'A fundraiser or Mandal can be given a public link by its administrators: anyone with that link can see its statement — contributor names and amounts (except gifts marked anonymous), expenses and, for a Mandal, who came to each meeting and what they paid.',
            ],
        },
        {
            title: 'Services the app uses',
            list: [
                'Vercel — hosts the app (servers in Mumbai, India).',
                'Hostinger — hosts the database (in India).',
                'Google Input Tools — when you use the local-language spelling suggestions, the word you type is sent to Google to suggest its spelling.',
                'Your browser’s push service (for example Google, Apple or Mozilla) — delivers notifications, only if you turn them on.',
            ],
        },
        {
            title: 'Cookies',
            body: [
                'Only the cookies the app needs: your sign-in (pv_session), your language (lang), the sidebar open / closed (sidebar) and how many rows a table shows (table_per_page). No advertising or tracking cookies.',
            ],
        },
        {
            title: 'Keeping and removing data',
            body: [
                'Your details stay while you are a member. Administrators can correct your details, archive a member and then delete them permanently; contribution records of a fundraiser are kept as part of its accounts. To have something corrected or removed, ask a Samaj administrator or contact the developer.',
            ],
        },
        {
            title: 'Your choices',
            body: [
                'You can edit your own profile, change your password and mobile number, choose the app language and turn each kind of notification on or off in Settings.',
            ],
        },
        {
            title: 'Security',
            body: [
                'The app is served only over an encrypted connection (HTTPS), passwords are stored as one-way hashes, and every page and action checks who you are and what your role allows.',
            ],
        },
        {
            title: 'Family members and children',
            body: [
                'Relatives, including children, may be added by a family member or an administrator so that the family tree is complete. Please add only details the family is happy to share with the Samaj.',
            ],
        },
        {
            title: 'Changes and contact',
            body: [
                'If this policy changes, the new version is published on this page with its date. For any question or request about your data, contact a Samaj administrator or the developer, Manthan Kanani, at {phone}.',
            ],
        },
    ],
    gu: [
        {
            title: 'અમે કોણ છીએ',
            body: [
                'આ એપ {samaj} ના સભ્યો માટેની એપ છે. તે સમાજના સંચાલકો દ્વારા સભ્યો અને તેમના પરિવારો માટે ચલાવવામાં આવે છે. આ એપ મંથન કાનાણી દ્વારા બનાવવામાં આવી છે; તેમનો સંપર્ક નંબર આ નીતિના અંતે આપેલો છે.',
            ],
        },
        {
            title: 'અમે તમારી કઈ માહિતી રાખીએ છીએ',
            body: ['ફક્ત એટલી જ માહિતી જે સભ્યો અને સંચાલકો એપમાં ઉમેરે છે:'],
            list: [
                'ખાતું: તમારું નામ (અંગ્રેજી અને તમારી સ્થાનિક ભાષામાં), મોબાઇલ નંબર અને પાસવર્ડ (ફક્ત એક-તરફી હેશ તરીકે સંગ્રહિત, ક્યારેય વાંચી શકાતો નથી).',
                'પ્રોફાઇલ: જન્મ તારીખ, જાતિ (પુરુષ / સ્ત્રી), બ્લડ ગ્રુપ અને રક્તદાન માટે તૈયાર છો કે નહીં, ગામ અને શહેર, જ્ઞાતિ / પેટા-જ્ઞાતિ, વૈવાહિક સ્થિતિ.',
                'પરિવાર: ફેમિલી ટ્રી માટે તમે અથવા સંચાલક જે સગાંને તમારી સાથે જોડે (માતા-પિતા, જીવનસાથી, સંતાનો, ભાઈ-બહેન).',
                'લગ્ન વિભાગ: ફક્ત જો તમારી પ્રોફાઇલ મૂકવામાં આવી હોય — તેમાં લખેલી વિગતો.',
                'ગ્રુપ, ફાળા અને મંડળ: તમારું સભ્યપદ અને ભૂમિકા, નોંધાયેલ ફાળો અને ખર્ચ, મંડળની મીટિંગમાં હાજરી, મીટિંગના જવાબો અને ચર્ચામાં તમે મોકલેલા સંદેશા.',
                'ટેકનિકલ: સાઇન-ઇન કૂકી, દરેક સાઇન-ઇન સત્રનો બ્રાઉઝર / ડિવાઇસ પ્રકાર, નોટિફિકેશન ચાલુ કરો તો તેનું સરનામું, એપમાં થયેલા ફેરફારોની નોંધ (પ્રવૃત્તિ લોગ) અને કોઈ પેજ નિષ્ફળ જાય ત્યારે ભૂલની નોંધ.',
            ],
        },
        {
            title: 'માહિતીનો ઉપયોગ કેવી રીતે થાય છે',
            body: [
                'સમાજનું કામ ચલાવવા માટે: સભ્ય યાદી અને ફેમિલી ટ્રી, ગ્રુપ અને રિમાઇન્ડર સાથેની મીટિંગો, ફાળા અને મંડળની બચત તથા તેનો હિસાબ, રક્તદાતા શોધ અને તમે પસંદ કરેલી નોટિફિકેશન. આ માહિતી વેચવામાં આવતી નથી, જાહેરાત માટે વપરાતી નથી અને માર્કેટિંગ માટે કોઈને આપવામાં આવતી નથી.',
            ],
        },
        {
            title: 'માહિતી કોણ જોઈ શકે છે',
            body: [
                'સમાજના સાઇન-ઇન કરેલા સભ્યો સભ્ય યાદી જોઈ શકે છે — સભ્યોનાં નામ, ગામ, મોબાઇલ નંબર અને જન્મ તારીખ, બ્લડ ગ્રુપ જેવી પ્રોફાઇલ વિગતો (જેથી સભ્યો એકબીજાનો સંપર્ક કરી શકે) — અને સંપર્ક નંબર સાથે રક્તદાતાઓની યાદી પણ. ફેમિલી ટ્રી દ્વારા ઉમેરાયેલા સગાંના ફોન નંબર, જન્મ તારીખ અને વૈવાહિક સ્થિતિ ફક્ત તેમના પરિવારને, તેમને ઉમેરનારને અને સભ્ય-સંચાલકોને જ દેખાય છે. સંચાલકો તેમની ભૂમિકા મુજબ જોઈ અને સુધારી શકે છે, અને દરેક ફેરફાર પ્રવૃત્તિ લોગમાં નોંધાય છે.',
                'ફાળા કે મંડળ માટે સંચાલકો જાહેર લિંક બનાવી શકે છે: એ લિંક ધરાવનાર કોઈપણ તેનો હિસાબ જોઈ શકે છે — દાતાનાં નામ અને રકમ (અનામી તરીકે નોંધાયેલ દાન સિવાય), ખર્ચ અને મંડળ માટે દરેક મીટિંગમાં કોણ આવ્યું અને કોણે કેટલું ભર્યું.',
            ],
        },
        {
            title: 'એપ જે સેવાઓ વાપરે છે',
            list: [
                'Vercel — એપ હોસ્ટ કરે છે (સર્વર મુંબઈ, ભારતમાં).',
                'Hostinger — ડેટાબેઝ હોસ્ટ કરે છે (ભારતમાં).',
                'Google Input Tools — તમે સ્થાનિક ભાષાના સ્પેલિંગ સૂચનો વાપરો ત્યારે તમે લખેલો શબ્દ સ્પેલિંગ સૂચવવા Google ને મોકલાય છે.',
                'તમારા બ્રાઉઝરની પુશ સેવા (દા.ત. Google, Apple કે Mozilla) — ફક્ત તમે નોટિફિકેશન ચાલુ કરો તો તે પહોંચાડે છે.',
            ],
        },
        {
            title: 'કૂકીઝ',
            body: [
                'ફક્ત જરૂરી કૂકીઝ: તમારું સાઇન-ઇન (pv_session), ભાષા (lang), સાઇડબાર ખુલ્લું / બંધ (sidebar) અને ટેબલમાં કેટલી લાઇન દેખાય (table_per_page). કોઈ જાહેરાત કે ટ્રેકિંગ કૂકી નથી.',
            ],
        },
        {
            title: 'માહિતી રાખવી અને દૂર કરવી',
            body: [
                'તમે સભ્ય હો ત્યાં સુધી તમારી વિગતો રહે છે. સંચાલકો તમારી વિગતો સુધારી શકે છે, સભ્યને આર્કાઇવ કરી પછી કાયમ માટે કાઢી શકે છે; ફાળાના ફાળો-રેકોર્ડ તેના હિસાબના ભાગ રૂપે રાખવામાં આવે છે. કોઈ વિગત સુધારવી કે દૂર કરવી હોય તો સમાજના સંચાલકને કહો અથવા ડેવલપરનો સંપર્ક કરો.',
            ],
        },
        {
            title: 'તમારી પસંદગીઓ',
            body: [
                'સેટિંગ્સમાં તમે તમારી પ્રોફાઇલ સુધારી શકો, પાસવર્ડ અને મોબાઇલ નંબર બદલી શકો, એપની ભાષા પસંદ કરી શકો અને દરેક પ્રકારની નોટિફિકેશન ચાલુ / બંધ કરી શકો.',
            ],
        },
        {
            title: 'સુરક્ષા',
            body: [
                'એપ ફક્ત સુરક્ષિત (HTTPS) જોડાણ પર ચાલે છે, પાસવર્ડ એક-તરફી હેશ તરીકે સંગ્રહાય છે અને દરેક પેજ તથા ક્રિયા તમે કોણ છો અને તમારી ભૂમિકા શું કરવા દે છે તે તપાસે છે.',
            ],
        },
        {
            title: 'પરિવારના સભ્યો અને બાળકો',
            body: [
                'ફેમિલી ટ્રી પૂર્ણ થાય તે માટે પરિવારના સભ્ય કે સંચાલક બાળકો સહિત સગાંને ઉમેરી શકે છે. કૃપા કરીને ફક્ત એવી જ વિગતો ઉમેરો જે પરિવાર સમાજ સાથે વહેંચવા તૈયાર હોય.',
            ],
        },
        {
            title: 'ફેરફારો અને સંપર્ક',
            body: [
                'આ નીતિમાં ફેરફાર થાય તો નવી આવૃત્તિ તેની તારીખ સાથે આ પેજ પર મૂકવામાં આવશે. તમારી માહિતી અંગે કોઈ પ્રશ્ન કે વિનંતી માટે સમાજના સંચાલક અથવા ડેવલપર મંથન કાનાણીનો {phone} પર સંપર્ક કરો.',
            ],
        },
    ],
};

/** The app's runtime packages and their licences (Settings → About → Open-source licences). */
export const OPEN_SOURCE = [
    { name: 'Next.js', pkg: 'next', license: 'MIT', url: 'https://nextjs.org' },
    { name: 'React', pkg: 'react, react-dom', license: 'MIT', url: 'https://react.dev' },
    { name: 'Tailwind CSS', pkg: 'tailwindcss', license: 'MIT', url: 'https://tailwindcss.com' },
    { name: 'Base UI', pkg: '@base-ui/react', license: 'MIT', url: 'https://base-ui.com' },
    { name: 'Lucide', pkg: 'lucide-react', license: 'ISC', url: 'https://lucide.dev' },
    { name: 'Sonner', pkg: 'sonner', license: 'MIT', url: 'https://sonner.emilkowal.ski' },
    { name: 'MySQL2', pkg: 'mysql2', license: 'MIT', url: 'https://github.com/sidorares/node-mysql2' },
    { name: 'bcrypt.js', pkg: 'bcryptjs', license: 'BSD-3-Clause', url: 'https://github.com/dcodeIO/bcrypt.js' },
    { name: 'web-push', pkg: 'web-push', license: 'MPL-2.0', url: 'https://github.com/web-push-libs/web-push' },
    { name: 'class-variance-authority', pkg: 'class-variance-authority', license: 'Apache-2.0', url: 'https://github.com/joe-bell/cva' },
    { name: 'clsx', pkg: 'clsx', license: 'MIT', url: 'https://github.com/lukeed/clsx' },
    { name: 'tailwind-merge', pkg: 'tailwind-merge', license: 'MIT', url: 'https://github.com/dcastil/tailwind-merge' },
    { name: 'tw-animate-css', pkg: 'tw-animate-css', license: 'MIT', url: 'https://github.com/Wombosvideo/tw-animate-css' },
    { name: 'server-only', pkg: 'server-only', license: 'MIT', url: 'https://www.npmjs.com/package/server-only' },
];
