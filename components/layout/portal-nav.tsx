'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { CalendarDays, House, ReceiptText, CircleUserRound, PawPrint } from 'lucide-react';

const items = [
  { href: '/portal', label: 'Beranda', icon: House },
  { href: '/portal/pets', label: 'Hewan', icon: PawPrint },
  { href: '/portal/appointments', label: 'JanjiTemu', icon: CalendarDays },
  { href: '/portal/invoices', label: 'Tagihan', icon: ReceiptText },
  { href: '/portal/profile', label: 'Profil', icon: CircleUserRound },
];

export function PortalNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed inset-x-0 bottom-0 border-t border-zinc-200 bg-white/95 backdrop-blur sm:static sm:mt-4 sm:rounded-xl sm:border sm:shadow-sm">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-1 px-2 py-2 sm:px-3">
        {items.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-1 flex-col items-center rounded-lg px-2 py-2 text-[11px] font-medium ${
                isActive ? 'bg-zinc-900 text-white' : 'text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900'
              }`}
            >
              <Icon className="mb-1 h-4 w-4" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
