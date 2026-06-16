import React, { useState } from "react";
import { Link, useLocation } from "wouter";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarProvider,
  SidebarFooter,
} from "@/components/ui/sidebar";
import {
  Moon,
  Activity,
  Pill,
  BookOpen,
  Sparkles,
  MessageCircle,
  Star,
  ClipboardList,
  Scroll,
  Sprout,
  SlidersHorizontal,
  User,
  RefreshCw,
  Copy,
  Check,
  PenLine,
  CalendarDays,
  BarChart2,
  Compass,
} from "lucide-react";
import { useTester } from "@/contexts/tester-context";
import { shortId } from "@/lib/tester-profile";

export default function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const { profile, openModal, resetProfile } = useTester();
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleCopyId = () => {
    if (!profile) return;
    navigator.clipboard.writeText(profile.testerId).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const navItems = [
    { label: "Today", path: "/", icon: Moon },
    { label: "Log", path: "/log", icon: PenLine },
    { label: "Practices", path: "/cultivator", icon: Sprout },
    { label: "Track", path: "/track", icon: ClipboardList },
    { label: "History", path: "/logs", icon: BookOpen },
    { label: "Supplements", path: "/supplements", icon: Pill },
    { label: "Activities", path: "/activities", icon: Activity },
    { label: "Natal Chart", path: "/natal", icon: Star },
    { label: "Calendar", path: "/calendar", icon: CalendarDays },
    { label: "Balance", path: "/patterns", icon: BarChart2 },
    { label: "Blueprint", path: "/blueprint", icon: Scroll },
    { label: "Auspice", path: "/auspice", icon: Compass },
    { label: "Settings", path: "/settings", icon: SlidersHorizontal },
    { label: "Oracle", path: "/chat", icon: MessageCircle },
  ];

  const handleReset = () => {
    if (showResetConfirm) {
      resetProfile();
      setShowResetConfirm(false);
    } else {
      setShowResetConfirm(true);
    }
  };

  return (
    <SidebarProvider>
      <div className="flex h-screen w-full bg-background overflow-hidden selection:bg-primary/30">
        <Sidebar className="border-r border-border/50 bg-background/80 backdrop-blur-md">
          <SidebarHeader className="py-6 px-4">
            <Link href="/" className="flex items-center gap-3 px-2 group">
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center border border-primary/20 group-hover:bg-primary/20 transition-colors">
                <Moon className="w-4 h-4 text-primary" />
              </div>
              <span className="font-serif text-xl tracking-wide text-foreground">
                Observatory
              </span>
            </Link>
          </SidebarHeader>
          <SidebarContent>
            <SidebarGroup>
              <SidebarGroupContent>
                <SidebarMenu>
                  {navItems.map((item) => {
                    const Icon = item.icon;
                    const isActive = location === item.path;
                    return (
                      <SidebarMenuItem key={item.path}>
                        <SidebarMenuButton asChild isActive={isActive} tooltip={item.label}>
                          <Link href={item.path} className="flex items-center gap-3">
                            <Icon className="w-4 h-4" />
                            <span>{item.label}</span>
                          </Link>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    );
                  })}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </SidebarContent>

          {profile && (
            <SidebarFooter className="px-4 py-4 border-t border-border/30">
              <div className="rounded-lg bg-primary/5 border border-primary/10 p-3 space-y-2">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full bg-primary/15 flex items-center justify-center flex-shrink-0">
                    <User className="w-3 h-3 text-primary" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium text-foreground truncate">{profile.displayName}</p>
                    <button
                      onClick={handleCopyId}
                      title="Copy tester ID"
                      className="flex items-center gap-1 text-[10px] text-muted-foreground font-mono hover:text-foreground transition-colors group"
                    >
                      <span className="truncate">{shortId(profile.testerId)}</span>
                      {copied
                        ? <Check className="w-2.5 h-2.5 text-chart-2 flex-shrink-0" />
                        : <Copy className="w-2.5 h-2.5 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
                      }
                    </button>
                  </div>
                </div>

                {showResetConfirm ? (
                  <div className="space-y-1.5">
                    <p className="text-[10px] text-amber-400 leading-snug">
                      This switches to a new tester profile. Old data stays on the server — re-enter your tester ID to access it later.
                    </p>
                    <div className="flex gap-1.5">
                      <button
                        onClick={handleReset}
                        className="flex-1 text-[10px] py-1 rounded bg-amber-500/20 text-amber-400 hover:bg-amber-500/30 transition-colors"
                      >
                        Confirm
                      </button>
                      <button
                        onClick={() => setShowResetConfirm(false)}
                        className="flex-1 text-[10px] py-1 rounded bg-border/30 text-muted-foreground hover:bg-border/50 transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={handleReset}
                    className="w-full flex items-center justify-center gap-1.5 text-[10px] text-muted-foreground hover:text-foreground transition-colors py-1 rounded hover:bg-border/20"
                  >
                    <RefreshCw className="w-2.5 h-2.5" />
                    Switch / Reset Tester Profile
                  </button>
                )}
              </div>
              <p className="text-[9px] text-muted-foreground/50 text-center leading-snug mt-2 px-1">
                Tester profiles are for MVP separation only, not secure medical accounts.
              </p>
            </SidebarFooter>
          )}
        </Sidebar>
        <main className="flex-1 overflow-y-auto relative bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-secondary/10 via-background to-background">
          <div className="absolute inset-0 opacity-[0.08] pointer-events-none mix-blend-overlay" style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`, backgroundRepeat: "repeat", backgroundSize: "200px 200px" }}></div>
          {children}
        </main>
      </div>
    </SidebarProvider>
  );
}
