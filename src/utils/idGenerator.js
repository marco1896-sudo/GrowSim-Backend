import crypto from 'crypto';

export function createPrefixedId(prefix) {
  return `${prefix}_${crypto.randomBytes(8).toString('hex')}`;
}
