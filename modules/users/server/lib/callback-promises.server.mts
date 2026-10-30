import crypto from 'crypto';
import type { UserServerDocument } from '../models/user.server.types.mts';

interface LoginRequest {
  login?(
    user: UserServerDocument,
    callback: (error?: Error | null) => void,
  ): void;
}

export function randomBytes(size: number): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    crypto.randomBytes(size, (err, buffer) =>
      err ? reject(err) : resolve(buffer),
    );
  });
}

export function login(req: LoginRequest, user: UserServerDocument) {
  return new Promise<void>((resolve, reject) => {
    req.login!(user, err => (err ? reject(err) : resolve()));
  });
}
