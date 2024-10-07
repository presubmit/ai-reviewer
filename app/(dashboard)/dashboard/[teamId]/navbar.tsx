"use client";

import * as React from "react";
import {
  Activity,
  ChevronDown,
  Database,
  Home,
  LogOut,
  Menu,
  Settings,
  Shield,
  Users,
} from "lucide-react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { usePathname } from "next/navigation";
import { selectTeam } from "./actions";
import { useState } from "react";

const navItems = [
  { href: "", icon: Home, label: "Overview" },
  { href: "/repositories", icon: Database, label: "Repositories" },
  { href: "/team", icon: Users, label: "Team" },
  { href: "/general", icon: Settings, label: "General" },
  { href: "/activity", icon: Activity, label: "Activity" },
  { href: "/security", icon: Shield, label: "Security" },
];

type NavTeam = {
  id: string;
  name: string;
  image?: string;
};

export default function Navbar({ teams }: { teams: NavTeam[] }) {
  const params = useParams();
  const selectedTeamId = params.teamId;
  console.log("params", params);
  console.log("selectedTeamId", selectedTeamId);
  const initiallySelectedTeam =
    teams.find((t) => t.id === selectedTeamId) || teams[0];

  const [selectedTeam, setSelectedTeam] = useState(initiallySelectedTeam);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const handleTeamSelect = async (team: NavTeam) => {
    try {
      await selectTeam(team.id);
      setSelectedTeam(team);
    } catch (error) {
      console.error("Error selecting team:", error);
      // Handle error (e.g., show a notification to the user)
    }
  };

  const buildPath = (href: string) => `/dashboard/${selectedTeamId}${href}`;

  const TeamSwitcher = () => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          className="w-full justify-between mb-6 px-2 h-12"
        >
          <div className="flex items-center overflow-hidden">
            <Avatar className="h-7 w-7 mr-2 flex-shrink-0">
              <AvatarFallback>{selectedTeam.name.charAt(0)}</AvatarFallback>
            </Avatar>
            <span className="truncate">{selectedTeam.name}</span>
          </div>
          <ChevronDown className="h-4 w-4 text-muted-foreground flex-shrink-0 ml-2" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56">
        <DropdownMenuLabel>Switch Team</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {teams.map((team) => (
          <DropdownMenuItem
            key={team.id}
            onSelect={() => handleTeamSelect(team)}
            className="cursor-pointer"
          >
            <Avatar className="h-6 w-6 mr-2">
              <AvatarFallback>{team.name.charAt(0)}</AvatarFallback>
            </Avatar>
            <span className="truncate">{team.name}</span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );

  const NavItems = () => {
    const pathname = usePathname();
    return (
      <div className="space-y-2">
        {navItems.map((item) => {
          const href = buildPath(item.href);
          return (
            <Link
              key={item.label}
              href={href}
              className={cn(
                "flex items-center space-x-3 rounded-lg px-3 py-2 text-sm font-medium hover:bg-accent hover:text-accent-foreground",
                href === pathname
                  ? "bg-accent text-accent-foreground"
                  : "text-muted-foreground"
              )}
              onClick={() => setIsMobileMenuOpen(false)}
            >
              <item.icon className="h-4 w-4 mr-2" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </div>
    );
  };

  return (
    <aside className="flex flex-col-reverse sm:flex-row">
      {/* Mobile Header */}
      <header className="sm:hidden border-t border-border p-4 flex justify-between items-center">
        <TeamSwitcher />
        <Sheet open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen}>
          <SheetTrigger asChild>
            <Button variant="outline" size="icon">
              <Menu className="h-6 w-6" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-64">
            <nav className="flex flex-col h-full">
              <TeamSwitcher />
              <NavItems />
              <div className="mt-auto">
                <Button
                  variant="ghost"
                  className="w-full justify-start text-muted-foreground"
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  Log out
                </Button>
              </div>
            </nav>
          </SheetContent>
        </Sheet>
      </header>

      {/* Desktop Sidebar */}
      <nav className="hidden sm:flex w-64 border-r p-4 flex-col">
        <TeamSwitcher />
        <NavItems />
        <div className="mt-auto">
          <Button
            variant="ghost"
            className="w-full justify-start text-muted-foreground"
          >
            <LogOut className="mr-4 h-4 w-4" />
            Log out
          </Button>
        </div>
      </nav>
    </aside>
  );
}
