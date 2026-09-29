// Pure module — safe on client and server. The ONE definition of roles and who may do what;
// server actions call these same predicates, so hiding a button is never the only gate.

/** Highest first. Rank is the index: lower = more power. */
export const ROLES = ['super_admin', 'administrator', 'sub_admin', 'sabhyo'];

export const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

/** Who can GIVE blood to a patient of this group (red-cell compatibility). */
export const BLOOD_DONORS_FOR = {
    'O-': ['O-'],
    'O+': ['O-', 'O+'],
    'A-': ['O-', 'A-'],
    'A+': ['O-', 'O+', 'A-', 'A+'],
    'B-': ['O-', 'B-'],
    'B+': ['O-', 'O+', 'B-', 'B+'],
    'AB-': ['O-', 'A-', 'B-', 'AB-'],
    'AB+': ['O-', 'O+', 'A-', 'A+', 'B-', 'B+', 'AB-', 'AB+'],
};

export function rank(role) {
    const i = ROLES.indexOf(role);
    return i === -1 ? ROLES.length : i;
}

export function isRole(value) {
    return ROLES.includes(value);
}

/** At least as powerful as `min`. */
export function atLeast(role, min) {
    return rank(role) <= rank(min);
}

// ── capabilities ──────────────────────────────────────────────────────────────

/** Add / edit members. Sub-admin and up. */
export const canManageMembers = (role) => atLeast(role, 'sub_admin');

/** Create groups and appoint group admins. */
export const canManageGroups = (role) => atLeast(role, 'sub_admin');

/**
 * Create and manage (record, edit, delete) any fundraise: super_admin, administrator, sub_admin.
 * Otherwise only that fundraise's group admins may — see fundraisePermissions in lib/access.
 */
export const canManageAllFundraises = (role) => atLeast(role, 'sub_admin');

export const canManageEvents = (role) => atLeast(role, 'sub_admin');

export const canViewAudit = (role) => atLeast(role, 'sub_admin');

/** Invite people by phone number from the Members page (first password = their number). */
export const canInviteMembers = (role) => atLeast(role, 'sub_admin');

/** Edit app-wide and module settings. */
export const canManageSettings = (role) => atLeast(role, 'administrator');

/**
 * Roles `actor` may assign. Nobody can create a peer or a superior, except
 * super_admin who can appoint another super_admin (someone must be able to hand over).
 */
export function assignableRoles(actorRole) {
    if (actorRole === 'super_admin') return ROLES;
    return ROLES.filter((r) => rank(r) > rank(actorRole));
}

/** May `actor` edit `target` at all (profile, phone, password reset)? */
export function canEditUser(actor, target) {
    if (!actor) return false;
    if (actor.id === target.id) return true;
    if (!canManageMembers(actor.role)) return false;
    return actor.role === 'super_admin' || rank(target.role) > rank(actor.role);
}

/**
 * Reset someone else's password. Admins and sub-admins may for any member — peers too — but
 * never an account ranked above them (that would let them sign in as their superior).
 * Everyone else who can edit a member (village leadership, lower ranks) keeps that right.
 * Your own password is changed from the profile page, which asks for the current one.
 */
export function canResetPassword(actor, target) {
    if (!actor || actor.id === target.id) return false;
    if (actor.role === 'super_admin') return true;
    if (atLeast(actor.role, 'sub_admin')) return rank(target.role) >= rank(actor.role);
    return canEditUser(actor, target);
}

export function canChangeRole(actor, target, newRole) {
    if (!actor || actor.id === target.id) return false; // no self-promotion or self-lockout
    if (!canEditUser(actor, target)) return false;
    return assignableRoles(actor.role).includes(newRole);
}
