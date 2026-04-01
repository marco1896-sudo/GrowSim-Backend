export const USER_ROLES = ['user', 'tester', 'moderator', 'admin'];

export function normalizeUserRole(role) {
  return USER_ROLES.includes(role) ? role : 'user';
}

export function legacyUserRoleFilter() {
  return [{ role: { $exists: false } }, { role: null }, { role: '' }];
}
