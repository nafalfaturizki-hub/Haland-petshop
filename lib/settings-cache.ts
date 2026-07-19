import { unstable_cache } from 'next/cache';
import { prisma } from '@/lib/db';

export const getSettings = unstable_cache(
  async function getSettings() {
    return prisma.settings.findFirst({
      where: { id: 'default-settings' },
    });
  },
  ['settings'],
  { revalidate: 60 }
);