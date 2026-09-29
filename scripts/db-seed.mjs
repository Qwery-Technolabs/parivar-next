// Create the first super_admin (from SEED_ADMIN_* env). With --demo, also a small
// sample parivar so every screen has something to show.
import bcrypt from 'bcryptjs';
import mysql from 'mysql2/promise';

const conn = await mysql.createConnection({
    host: process.env.DB_HOST || '127.0.0.1',
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'parivar',
    namedPlaceholders: true,
    charset: 'utf8mb4_unicode_ci',
});
const run = (sql, params = {}) => conn.execute(sql, params).then(([r]) => r);

const phone = (process.env.SEED_ADMIN_PHONE || '9999999999').replace(/\D/g, '');
const password = process.env.SEED_ADMIN_PASSWORD || 'change-me';
const name = process.env.SEED_ADMIN_NAME || 'Super Admin';

const [existing] = await run('SELECT id FROM users_list WHERE phone = :phone', { phone });
let adminId = existing?.id;
if (!adminId) {
    const r = await run(
        `INSERT INTO users_list (phone, password_hash, full_name, role, language)
         VALUES (:phone, :hash, :name, 'super_admin', 'gu')`,
        { phone, hash: await bcrypt.hash(password, 10), name },
    );
    adminId = r.insertId;
    console.log(`super_admin created: ${phone} / ${password} — change this password after first login`);
} else {
    console.log(`super_admin ${phone} already exists (id ${adminId})`);
}

if (process.argv.includes('--demo')) {
    const [{ n }] = await run('SELECT COUNT(*) AS n FROM users_list');
    if (n > 1) {
        console.log('Demo data skipped: users already exist.');
    } else {
        await seedDemo();
        console.log('Demo parivar created. Demo members log in with password: parivar123');
    }
}
await conn.end();

async function seedDemo() {
    const hash = await bcrypt.hash('parivar123', 10);
    // key, phone, name, name_gu, gender, dob, blood, village, role
    const people = [
        ['ramesh', '9825000001', 'Ramesh Patel', 'રમેશ પટેલ', 'male', '1958-03-12', 'B+', 'Vadnagar', 'sarpanch'],
        ['savita', '9825000002', 'Savita Patel', 'સવિતા પટેલ', 'female', '1962-07-01', 'O+', 'Vadnagar', 'sabhyo'],
        ['mahesh', '9825000003', 'Mahesh Patel', 'મહેશ પટેલ', 'male', '1984-11-20', 'O-', 'Vadnagar', 'up_sarpanch'],
        ['kajal', '9825000004', 'Kajal Patel', 'કાજલ પટેલ', 'female', '1987-02-14', 'A+', 'Unjha', 'sabhyo'],
        ['nirav', '9825000005', 'Nirav Patel', 'નીરવ પટેલ', 'male', '1988-09-05', 'AB+', 'Vadnagar', 'sub_admin'],
        ['aarav', '9825000006', 'Aarav Patel', 'આરવ પટેલ', 'male', '2012-06-18', 'O+', 'Vadnagar', 'sabhyo'],
        ['diya', '9825000007', 'Diya Patel', 'દિયા પટેલ', 'female', '2015-01-30', 'A+', 'Vadnagar', 'sabhyo'],
        ['jignesh', '9825000008', 'Jignesh Shah', 'જીગ્નેશ શાહ', 'male', '1979-04-22', 'B-', 'Visnagar', 'administrator'],
    ];
    // Castes: two with sub-castes, one without.
    const caste = async (name, nameGu, parentId = null, sort = 0) =>
        (await run(
            'INSERT INTO admin_castes (parent_id, name, name_gu, sort_order, created_by) VALUES (:parentId, :name, :nameGu, :sort, :by)',
            { parentId, name, nameGu, sort, by: adminId },
        )).insertId;
    const patel = await caste('Patel', 'પટેલ', null, 1);
    const kadva = await caste('Kadva', 'કડવા', patel);
    const leuva = await caste('Leuva', 'લેઉવા', patel);
    const shah = await caste('Shah', 'શાહ', null, 2);
    await caste('Prajapati', 'પ્રજાપતિ', null, 3);

    const ids = {};
    const names = {};
    for (const [key, p, nm, gu, g, dob, bg, v, role] of people) {
        const r = await run(
            `INSERT INTO users_list (phone, password_hash, full_name, full_name_gu, gender, dob, blood_group, village, role, is_blood_donor, created_by)
             VALUES (:p, :hash, :nm, :gu, :g, :dob, :bg, :v, :role, :donor, :by)`,
            { p, hash, nm, gu, g, dob, bg, v, role, donor: dob < '2006-01-01' ? 1 : 0, by: adminId },
        );
        ids[key] = r.insertId;
        names[key] = nm;
    }
    await run('UPDATE users_list SET caste_id = :patel, subcaste_id = :kadva WHERE full_name LIKE "% Patel"', { patel, kadva });
    await run('UPDATE users_list SET subcaste_id = :leuva WHERE id = :id', { leuva, id: ids.kajal });
    await run('UPDATE users_list SET caste_id = :shah WHERE id = :id', { shah, id: ids.jignesh });

    const rel = (u, r, relation) =>
        run('INSERT INTO users_relations (user_id, relative_id, relation) VALUES (:u, :r, :relation)', {
            u: ids[u],
            r: ids[r],
            relation,
        });
    for (const [a, b] of [['ramesh', 'savita'], ['mahesh', 'kajal']]) {
        await rel(a, b, 'spouse');
        await rel(b, a, 'spouse');
    }
    for (const child of ['mahesh', 'nirav']) {
        await rel(child, 'ramesh', 'father');
        await rel(child, 'savita', 'mother');
    }
    for (const child of ['aarav', 'diya']) {
        await rel(child, 'mahesh', 'father');
        await rel(child, 'kajal', 'mother');
    }
    await run(
        `INSERT INTO users_listmeta (user_id, meta_key, meta_value)
         VALUES (:u, 'occupation', 'Farmer'), (:u, 'address', 'Patel Vas, Vadnagar')`,
        { u: ids.ramesh },
    );

    const g = await run(
        `INSERT INTO admin_groups (name, name_gu, created_by) VALUES ('Temple Committee', 'મંદિર સમિતિ', :by)`,
        { by: adminId },
    );
    for (const [who, mr] of [['ramesh', 'admin'], ['mahesh', 'member'], ['nirav', 'member'], ['jignesh', 'member']])
        await run(
            'INSERT INTO admin_group_members (group_id, user_id, member_role, added_by) VALUES (:g, :u, :mr, :by)',
            { g: g.insertId, u: ids[who], mr, by: adminId },
        );

    const c = await run(
        `INSERT INTO fundraise_campaigns (group_id, title, title_gu, target_amount, start_date, end_date, status, is_public, public_token, created_by)
         VALUES (:g, 'Temple renovation', 'મંદિર જીર્ણોદ્ધાર', 250000, CURDATE() - INTERVAL 10 DAY, CURDATE() + INTERVAL 20 DAY,
                 'active', 1, 'demoTempleRenovation2026', :by)`,
        { g: g.insertId, by: adminId },
    );
    await run(
        `INSERT INTO fundraise_campaignsmeta (campaign_id, meta_key, meta_value)
         VALUES (:c, 'description', 'Roof repair and new flooring for the village temple.')`,
        { c: c.insertId },
    );
    const gifts = [
        ['ramesh', 51000, 'bank', 9],
        ['mahesh', 21000, 'upi', 7],
        ['jignesh', 11000, 'cash', 5],
        [null, 5100, 'cash', 3],
        ['nirav', 11000, 'upi', 1],
    ];
    for (const [who, amt, mode, days] of gifts)
        await run(
            `INSERT INTO fundraise_contributions (campaign_id, user_id, donor_name, amount, paid_on, mode, recorded_by)
             VALUES (:c, :u, :nm, :amt, CURDATE() - INTERVAL ${days} DAY, :mode, :by)`,
            { c: c.insertId, u: who ? ids[who] : null, nm: who ? names[who] : 'Villagers (collection box)', amt, mode, by: adminId },
        );
    const spends = [
        ['Cement and sand', 'Shree Hardware, Vadnagar', 18500, 6],
        ['Mason labour (week 1)', 'Temple site', 14000, 2],
    ];
    for (const [title, place, amt, days] of spends)
        await run(
            `INSERT INTO fundraise_expenses (campaign_id, title, place, amount, spent_on, recorded_by)
             VALUES (:c, :title, :place, :amt, CURDATE() - INTERVAL ${days} DAY, :by)`,
            { c: c.insertId, title, place, amt, by: adminId },
        );

    await run(
        `INSERT INTO events_list (title, title_gu, event_type, start_date, start_time, location, group_id, created_by)
         VALUES ('Samaj general meeting', 'સમાજ સામાન્ય સભા', 'meeting', CURDATE() + INTERVAL 4 DAY, '18:00:00', 'Panchayat hall', :g, :by)`,
        { g: g.insertId, by: adminId },
    );
    await run(
        `INSERT INTO blood_requests (blood_group, units, patient_name, hospital, city, contact_phone, needed_by, created_by)
         VALUES ('O-', 2, 'Hiral Desai', 'Civil Hospital', 'Mehsana', '9825000099', CURDATE() + INTERVAL 2 DAY, :by)`,
        { by: adminId },
    );
}
