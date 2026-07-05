'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { BarChart3, CalendarDays, CircleUserRound, House, Package2, ScrollText, Settings, ShoppingBag, Stethoscope, Users, ReceiptText, Hotel, ShieldCheck } from 'lucide-react';
import { canAccessModule } from '@/lib/permissions';

interface SidebarProps {
  role: any;
}

const staffMenu = [
  { href: '/dashboard', label: 'Beranda', icon: House, module: 'dashboard' as const },
  { href: '/customers', label: 'Pelanggan', icon: Users, module: 'customers' as const },
  { href: '/pets', label: 'Hewan', icon: Stethoscope, module: 'pets' as const },
  { href: '/appointments', label: 'Janji Temu', icon: CalendarDays, module: 'appointments' as const },
  { href: '/medical-records', label: 'Rekam Medis', icon: ScrollText, module: 'medical-records' as const },
  { href: '/procedures', label: 'Master Tindakan', icon: ScrollText, module: 'procedures' as const },
  { href: '/pet-hotel', label: 'Pet Hotel', icon: Hotel, module: 'pet-hotel' as const },
  { href: '/petshop/products', label: 'Petshop', icon: ShoppingBag, module: 'petshop' as const },
  { href: '/pos', label: 'POS', icon: ReceiptText, module: 'pos' as const },
  { href: '/billing', label: 'Tagihan', icon: Package2, module: 'billing' as const },
  { href: '/reports', label: 'Laporan', icon: BarChart3, module: 'reports' as const },
  { href: '/users', label: 'Pengguna', icon: ShieldCheck, module: 'users' as const },
  { href: '/settings', label: 'Pengaturan', icon: Settings, module: 'settings' as const },
  { href: '/profile', label: 'Profil', icon: CircleUserRound, module: 'profile' as const },
];

export function Sidebar({ role }: SidebarProps) {
  const pathname = usePathname();
  const visibleItems = staffMenu.filter((item) => canAccessModule(role, item.module));

  return (
    <aside className="border-b border-zinc-200 bg-white/95 px-4 py-4 lg:min-h-screen lg:w-72 lg:border-b-0 lg:border-r lg:px-6 lg:py-6">
      <div className="flex items-center justify-between lg:block">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-zinc-500">Haland</p>
          <h2 className="mt-1 text-lg font-semibold text-zinc-900">Staff Panel</h2>
        </div>
        <div className="rounded-full border border-zinc-200 px-3 py-1 text-xs font-medium text-zinc-600 lg:hidden">Menu</div>
      </div>

      <nav className="mt-6 flex gap-2 overflow-x-auto lg:flex-col lg:gap-1.5">
        {visibleItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex min-w-[112px] items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium transition ${
                isActive ? 'bg-zinc-900 text-white' : 'text-zinc-700 hover:bg-zinc-100 hover:text-zinc-900'
              }`}
            >
              <Icon className="h-4 w-4" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
