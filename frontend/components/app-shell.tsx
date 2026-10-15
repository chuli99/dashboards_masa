'use client';

import { FactoryIcon, Home01Icon, Moon02Icon, PencilEdit02Icon, Sun03Icon } from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTheme } from 'next-themes';
import { useEffect, useState } from 'react';
import { Separator } from '@/components/ui/separator';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarRail,
  SidebarTrigger,
} from '@/components/ui/sidebar';
import { FLOWSHEETS } from '@/flowsheets';

const LOGO_ALT = 'Minas Argentinas S.A. — Gualcamayo';

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset className="min-w-0">
        <header className="sticky top-0 z-20 flex h-16 shrink-0 items-center gap-2 border-b bg-background/95 px-3 backdrop-blur-sm supports-backdrop-filter:bg-background/80">
          <SidebarTrigger />
          <Separator orientation="vertical" className="h-4!" />
          <span className="min-w-0 truncate font-medium text-muted-foreground text-xl">Monitoreo de Planta</span>
          <Reloj />
        </header>
        {children}
      </SidebarInset>
    </SidebarProvider>
  );
}

const diaSemana = new Intl.DateTimeFormat('es-AR', { weekday: 'short' });
const mesCorto = new Intl.DateTimeFormat('es-AR', { month: 'short' });
const horaMinuto = new Intl.DateTimeFormat('es-AR', { hour: '2-digit', minute: '2-digit', hour12: false });

// "mié." → "Mié"
const corto = (f: Intl.DateTimeFormat, d: Date) => {
  const s = f.format(d).replace('.', '');
  return s.charAt(0).toUpperCase() + s.slice(1);
};

/** Se monta en el cliente: el HTML exportado no puede traer la hora. */
function Reloj() {
  const [d, setD] = useState<Date | null>(null);
  useEffect(() => {
    setD(new Date());
    const id = setInterval(() => setD(new Date()), 10000);
    return () => clearInterval(id);
  }, []);
  if (!d) return null;
  return (
    <time dateTime={d.toISOString()} className="ml-auto flex items-baseline gap-2 tabular-nums">
      <span className="hidden font-medium text-lg text-muted-foreground sm:inline">
        {corto(diaSemana, d)} {d.getDate()} {corto(mesCorto, d)} ·
      </span>
      <span className="font-semibold text-xl">{horaMinuto.format(d)}</span>
    </time>
  );
}

function Item({ href, titulo, icono }: { href: string; titulo: string; icono: typeof FactoryIcon }) {
  // trailingSlash: true → "/flowsheet/tk1/"; comparación exacta para que tk1 no marque tk1rica
  const activo = usePathname().replace(/\/$/, '') === href.replace(/\/$/, '');
  return (
    <SidebarMenuItem>
      <SidebarMenuButton isActive={activo} tooltip={titulo} render={<Link href={href} />}>
        <HugeiconsIcon icon={icono} strokeWidth={2} />
        <span>{titulo}</span>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}

function AppSidebar() {
  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="h-16 justify-center overflow-hidden border-b px-4 group-data-[collapsible=icon]:px-2">
        <Link href="/" className="flex items-center">
          {/* Ancho fijo (sidebar menos px-4): al expandir se recorta en vez de crecer con la animación. */}
          <span className="contents group-data-[collapsible=icon]:hidden">
            <img
              src="/masa-logo.svg"
              alt={LOGO_ALT}
              className="h-auto w-[calc(var(--sidebar-width)-2rem)] max-w-none dark:hidden"
            />
            <img
              src="/masa-logo-dark.svg"
              alt={LOGO_ALT}
              className="hidden h-auto w-[calc(var(--sidebar-width)-2rem)] max-w-none dark:block"
            />
          </span>
          {/* Colapsada: sólo la montaña (la misma del favicon, app/icon.svg). */}
          <img src="/masa-icono.svg" alt={LOGO_ALT} className="hidden size-8 group-data-[collapsible=icon]:block" />
        </Link>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarMenu>
            <Item href="/" titulo="Inicio" icono={Home01Icon} />
          </SidebarMenu>
        </SidebarGroup>
        <SidebarGroup>
          <SidebarGroupLabel>Flowsheets</SidebarGroupLabel>
          <SidebarMenu>
            {Object.entries(FLOWSHEETS).map(([slug, fs]) => (
              <Item key={slug} href={`/flowsheet/${slug}/`} titulo={fs.title} icono={FactoryIcon} />
            ))}
          </SidebarMenu>
        </SidebarGroup>
        <SidebarGroup>
          <SidebarGroupLabel>Herramientas</SidebarGroupLabel>
          <SidebarMenu>
            <Item href="/editor/" titulo="Editor de flowsheets" icono={PencilEdit02Icon} />
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <BotonTema />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}

function BotonTema() {
  const { resolvedTheme, setTheme } = useTheme();
  const oscuro = resolvedTheme === 'dark';
  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <SidebarMenuButton tooltip="Cambiar tema (D)" onClick={() => setTheme(oscuro ? 'light' : 'dark')}>
          <HugeiconsIcon icon={oscuro ? Sun03Icon : Moon02Icon} strokeWidth={2} />
          <span>{oscuro ? 'Tema claro' : 'Tema oscuro'}</span>
        </SidebarMenuButton>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
