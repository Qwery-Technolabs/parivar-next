// One-off migration (deleted after use, folded into public/schema/live/parivar.sql):
// fundraise_members — several roles per person (key fundraise + person + role) and the new 'expenser' role.
// Idempotent: skips when already applied. Uses DB_* from the environment, ONE connection.
import mysql from 'mysql2/promise';

const db = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
});
try {
    const [[col]] = await db.query("SHOW COLUMNS FROM fundraise_members LIKE 'member_role'");
    const [pk] = await db.query("SHOW INDEX FROM fundraise_members WHERE Key_name = 'PRIMARY'");
    const pkCols = pk.map((r) => r.Column_name);
    const before = { type: col.Type, pk: pkCols };
    if (col.Type.includes("'expenser'") && pkCols.includes('member_role')) {
        console.log('already applied', JSON.stringify(before));
    } else {
        const [[{ n }]] = await db.query('SELECT COUNT(*) AS n FROM fundraise_members');
        // Keep an index starting with campaign_id for its foreign key while the primary key is swapped.
        await db.query(
            `ALTER TABLE fundraise_members
                MODIFY member_role ENUM('admin','organizer','treasurer','collector','expenser','volunteer') NOT NULL DEFAULT 'volunteer',
                DROP PRIMARY KEY,
                ADD PRIMARY KEY (campaign_id, user_id, member_role)`,
        );
        const [[{ n2 }]] = await db.query('SELECT COUNT(*) AS n2 FROM fundraise_members');
        const [[col2]] = await db.query("SHOW COLUMNS FROM fundraise_members LIKE 'member_role'");
        const [pk2] = await db.query("SHOW INDEX FROM fundraise_members WHERE Key_name = 'PRIMARY'");
        console.log('applied', JSON.stringify({ before, rowsBefore: n, rowsAfter: n2, type: col2.Type, pk: pk2.map((r) => r.Column_name) }));
    }
} finally {
    await db.end();
}
