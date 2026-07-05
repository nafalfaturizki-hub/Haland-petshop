import { getServerSession } from 'next-auth/next';
import type { DefaultSession, NextAuthOptions, Session } from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { prisma, createAuditLog } from './db';

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

const nextAuthSecret = process.env.NEXTAUTH_SECRET ?? process.env.AUTH_SECRET;

if (!nextAuthSecret) {
  throw new Error('Missing NEXTAUTH_SECRET or AUTH_SECRET');
}

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

export const authOptions: NextAuthOptions = {
  secret: nextAuthSecret,
  session: {
    strategy: 'jwt',
    maxAge: 60 * 60 * 24 * 30,
  },
  jwt: {
    maxAge: 60 * 60 * 24 * 30,
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

          const now = new Date();
          if (user.isLocked) {
            if (user.lockedUntil && user.lockedUntil > now) {
              await createAuditLog(user.id, 'LOGIN', 'User', user.id, 'Login ditolak karena akun terkunci');
              return null;
            }

            await prisma.user.update({
              where: { id: user.id },
              data: {
                isLocked: false,
                lockedUntil: null,
                failedPinAttempts: 0,
              },
            });
          }

          let isValidPin = false;
          try {
            isValidPin = await bcrypt.compare(parsed.data.pin, user.pinHash);
          } catch {
            await createAuditLog(user.id, 'LOGIN', 'User', user.id, 'Login gagal karena kesalahan sistem');
            return null;
          }

          if (!isValidPin) {
            const nextAttempts = (user.failedPinAttempts ?? 0) + 1;
            const shouldLock = nextAttempts >= 5;

            await prisma.user.update({
              where: { id: user.id },
              data: {
                failedPinAttempts: nextAttempts,
                isLocked: shouldLock,
                lockedUntil: shouldLock ? new Date(now.getTime() + 15 * 60 * 1000) : null,
              },
            });

            await createAuditLog(user.id, 'LOGIN', 'User', user.id, 'Login gagal: PIN salah');
            return null;
          }

          await prisma.user.update({
            where: { id: user.id },
            data: {
              failedPinAttempts: 0,
              isLocked: false,
              lockedUntil: null,
            },
          });

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
      if (user) {
        token.id = user.id as string;
        token.role = (user as { role?: string }).role as string;
        token.username = (user as { username?: string }).username as string;
        token.mustChangePin = Boolean((user as { mustChangePin?: boolean }).mustChangePin);
      }

      if (token.id && !token.revoked) {
        const freshUser = await getFreshUser(token.id as string);
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
        (session.user as { id?: string; role?: string; username?: string; mustChangePin?: boolean }).id = token.id as string;
        (session.user as { id?: string; role?: string; username?: string; mustChangePin?: boolean }).role = token.role as string;
        (session.user as { id?: string; role?: string; username?: string; mustChangePin?: boolean }).username = token.username as string;
        (session.user as { id?: string; role?: string; username?: string; mustChangePin?: boolean }).mustChangePin = Boolean(token.mustChangePin);
      }
      return session;
    },
  },
};

export const auth = () => getServerSession(authOptions) as Promise<Session | null>;

