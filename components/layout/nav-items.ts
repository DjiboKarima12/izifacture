import {
  CircleHelp,
  FileText,
  LayoutDashboard,
  Receipt,
  Settings,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
};

export type NavGroup = {
  label: string;
  items: NavItem[];
};

/**
 * Deux groupes, comme dans la maquette. « Devis » et « Encaissements » figurent
 * sous Menu bien qu'absents de la maquette : les pages existent et sont
 * fonctionnelles, les retirer du menu les rendrait inatteignables.
 */
export const NAV_GROUPS: NavGroup[] = [
  {
    label: "Menu",
    items: [
      { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
      { href: "/invoices", label: "Factures", icon: FileText },
      { href: "/quotes", label: "Devis", icon: Receipt },
      { href: "/clients", label: "Clients", icon: Users },
      { href: "/payments", label: "Encaissements", icon: Wallet },
    ],
  },
  {
    label: "Utilitaires",
    items: [
      { href: "/settings", label: "Paramètres", icon: Settings },
      { href: "/support", label: "Aide et Support", icon: CircleHelp },
    ],
  },
];
