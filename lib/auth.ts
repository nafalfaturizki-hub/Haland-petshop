import { getServerSession } from 'next-auth/next';
import type { DefaultSession, NextAuthOptions, Session } from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { prisma, createAuditLog } from './db';
import { getAuthSecret } from './auth-env';

declare module 'next-auth' {
  interface Session {
    user: DefaultSession['user'] & {
      id?: string;
      role?: string;
      username?: string;
      mustChangePin?: boolean;
    };
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id?: string;
    role?: string;
    username?: string;
    mustChangePin?: boolean;
    revoked?: boolean;
  }
}

const loginSchema = z.object({
  username: z.string().trim().min(1),
  pin: z.string().trim().regex(/^\d{6}$/, 'PIN harus 6 digit.'),
});

const nextAuthSecret = getAuthSecret();

async function getFreshUser(userId: string) {
  return prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      username: true,
      role: true,
      isActive: true,
      isLocked: true,
      lockedUntil: true,
      mustChangePin: true,
    },
  });
}

/**
 * Shared PIN verification logic with lockout protection
 * Used by both login and changePin to ensure consistent security
 * 
 * @param userId - User ID to verify PIN for
 * @param submittedPin - PIN submitted by user
 * @param userPinHash - Hash of user's stored PIN
 * @param context - 'LOGIN' or 'CHANGE_PIN' for audit logging
 * @returns { ok: true } if PIN is valid, { ok: false, message: string } otherwise
 */
export async function verifyPinWithLockout(
  userId: string,
  submittedPin: string,
  userPinHash: string,
  context: 'LOGIN' | 'CHANGE_PIN' = 'LOGIN',
) {
  const now = new Date();

  // Get current user state
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      isLocked: true,
      lockedUntil: true,
      failedPinAttempts: true,
    },
  });

  if (!user) {
    return { ok: false, message: 'Pengguna tidak ditemukan.' };
  }

  // Check if account is locked
  if (user.isLocked && user.lockedUntil && user.lockedUntil > now) {
    await createAuditLog(userId, context, 'User', userId, `${context} ditolak: akun terkunci`);
    return { ok: false, message: `Akun Anda terkunci karena terlalu banyak percobaan gagal. Coba lagi nanti.` };
  }

  // Unlock account if lockout period has passed
  if (user.isLocked && user.lockedUntil && user.lockedUntil <= now) {
    await prisma.user.update({
      where: { id: userId },
      data: {
        isLocked: false,
        lockedUntil: null,
        failedPinAttempts: 0,
      },
    });
  }

  // Verify PIN
  let isValidPin = false;
  try {
    isValidPin = await bcrypt.compare(submittedPin, userPinHash);
  } catch {
    await createAuditLog(userId, context, 'User', userId, `${context} gagal: kesalahan sistem`);
    return { ok: false, message: 'Kesalahan saat memverifikasi PIN.' };
  }

  if (!isValidPin) {
    // PIN is invalid - increment attempts and potentially lock account
    const nextAttempts = (user.failedPinAttempts ?? 0) + 1;
    const shouldLock = nextAttempts >= 5;

    await prisma.user.update({
      where: { id: userId },
      data: {
        failedPinAttempts: nextAttempts,
        isLocked: shouldLock,
        lockedUntil: shouldLock ? new Date(now.getTime() + 15 * 60 * 1000) : null,
      },
    });

    await createAuditLog(userId, context, 'User', userId, `${context} gagal: PIN salah (percobaan ${nextAttempts}/5)`);
    
    if (shouldLock) {
      return { ok: false, message: `PIN salah. Akun Anda telah terkunci karena 5 kali percobaan gagal. Silakan coba lagi dalam 15 menit.` };
    }
    
    return { ok: false, message: `PIN salah. Percobaan ${nextAttempts} dari 5.` };
  }

  // PIN is valid - reset failed attempts
  await prisma.user.update({
    where: { id: userId },
    data: {
      failedPinAttempts: 0,
      isLocked: false,
      lockedUntil: null,
    },
  });

  await createAuditLog(userId, context, 'User', userId, `${context} berhasil: PIN verified`);
  return { ok: true };
}

export const authOptions: NextAuthOptions = {
  secret: nextAuthSecret,
  session: {
    strategy: 'jwt',
    // Sesi klinik menyimpan data sensitif; batasi masa berlaku token ke 7 hari.
    // Revokasi eksplisit ditangani via flag `revoked` yang dicek pada tiap request (getFreshUser).
    maxAge: 60 * 60 * 24 * 7,
  },
  jwt: {
    maxAge: 60 * 60 * 24 * 7,
  },
  providers: [
    Credentials({
      name: 'Credentials',
      credentials: {
        username: { label: 'Username', type: 'text' },
        pin: { label: 'PIN', type: 'password' },
      },
      async authorize(credentials) {
        try {
          const parsed = loginSchema.safeParse(credentials);
          if (!parsed.success) {
            return null;
          }

          const normalizedUsername = parsed.data.username.trim().toLowerCase();
          const user = await prisma.user.findFirst({
            where: {
              username: {
                equals: normalizedUsername,
                mode: 'insensitive',
              },
            },
          });

          if (!user) {
            return null;
          }

          if (!user.isActive) {
            await createAuditLog(user.id, 'LOGIN', 'User', user.id, 'Login ditolak karena akun nonaktif');
            return null;
          }

          // Use shared PIN verification logic with lockout protection
          const pinVerification = await verifyPinWithLockout(user.id, parsed.data.pin, user.pinHash, 'LOGIN');
          if (!pinVerification.ok) {
            return null;
          }

          await createAuditLog(user.id, 'LOGIN', 'User', user.id, 'Login berhasil');

          return {
            id: user.id,
            name: user.name,
            username: user.username,
            role: user.role,
            mustChangePin: user.mustChangePin,
          };
        } catch {
          return null;
        }
      },
    }),
  ],
  pages: {
    signIn: '/login',
  },
  debug: process.env.NODE_ENV !== 'production',
  events: {
    async signIn(message) {
      const userId = (message.user as { id?: string } | undefined)?.id ?? (message.user as { email?: string } | undefined)?.email;
      if (userId) {
        await createAuditLog(String(userId), 'LOGIN', 'User', String(userId), 'Sesi login dibuat');
      }
    },
    async signOut(message) {
      const userId = (message.token as { sub?: string } | undefined)?.sub;
      if (userId) {
        await createAuditLog(userId, 'LOGOUT', 'User', userId, 'Sesi logout selesai');
      }
    },
  },
  callbacks: {
    async jwt({ token, user }) {
      const userId = typeof user?.id === 'string' ? user.id : (typeof token?.id === 'string' ? token.id : undefined);

      if (userId) {
        token.sub = userId;
        token.id = userId;
      } else if (!token.sub && typeof token.id === 'string') {
        token.sub = token.id;
      }

      if (user) {
        token.role = (user as { role?: string }).role as string;
        token.username = (user as { username?: string }).username as string;
        token.mustChangePin = Boolean((user as { mustChangePin?: boolean }).mustChangePin);
      }

      const resolvedUserId = typeof token.sub === 'string' && token.sub ? token.sub : (typeof token.id === 'string' ? token.id : undefined);
      if (resolvedUserId && !token.revoked) {
        const freshUser = await getFreshUser(resolvedUserId);
        if (!freshUser || !freshUser.isActive || freshUser.isLocked) {
          token.revoked = true;
          return token;
        }

        token.role = freshUser.role;
        token.username = freshUser.username;
        token.mustChangePin = Boolean(freshUser.mustChangePin);
      }

      return token;
    },
    async session({ session, token }) {
      if (session.user && !token.revoked) {
        const userId = typeof token.sub === 'string' && token.sub ? token.sub : (typeof token.id === 'string' ? token.id : undefined);
        (session.user as { id?: string; role?: string; username?: string; mustChangePin?: boolean }).id = userId;
        (session.user as { id?: string; role?: string; username?: string; mustChangePin?: boolean }).role = token.role as string;
        (session.user as { id?: string; role?: string; username?: string; mustChangePin?: boolean }).username = token.username as string;
        (session.user as { id?: string; role?: string; username?: string; mustChangePin?: boolean }).mustChangePin = Boolean(token.mustChangePin);
      }
      return session;
    },
  },
};

export const auth = () => getServerSession(authOptions) as Promise<Session | null>;

