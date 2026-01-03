import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  LayoutDashboard,
  UserPlus,
  Users,
  GraduationCap,
  Calendar,
  MessageSquare,
  FileText,
  Settings,
  User,
} from "lucide-react";

const navigationItems = [
  { label: "Dashboard", href: "/sis", icon: LayoutDashboard },
  { label: "Admissions", href: "/sis/admissions", icon: UserPlus },
  { label: "Batches", href: "/sis/batches", icon: Users },
  { label: "Students", href: "/sis/students", icon: GraduationCap },
  { label: "Attendance", href: "/sis/attendance", icon: Calendar },
  { label: "Communications", href: "/sis/communications", icon: MessageSquare },
  { label: "Reports", href: "/sis/reports", icon: FileText },
  { label: "Settings", href: "/sis/settings", icon: Settings },
];

export default function SISLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col">
      {/* Top Bar */}
      <header className="border-b bg-background">
        <div className="flex h-14 items-center justify-between px-4 md:px-6">
          <h1 className="text-lg font-semibold">vSchool · SIS</h1>
          <Button variant="ghost" size="icon" className="h-9 w-9">
            <User className="size-4" />
            <span className="sr-only">User menu</span>
          </Button>
        </div>
      </header>

      {/* Main Content Area */}
      <div className="flex flex-1 flex-col md:flex-row">
        {/* Sidebar */}
        <aside className="w-full border-b bg-muted/40 md:w-64 md:border-b-0 md:border-r">
          <nav className="flex flex-row gap-1 overflow-x-auto p-2 md:flex-col md:overflow-x-visible md:p-4">
            {navigationItems.map((item) => {
              const Icon = item.icon;
              return (
                <Button
                  key={item.href}
                  variant="ghost"
                  className="w-full justify-start gap-2 md:w-full"
                  asChild
                >
                  <Link href={item.href}>
                    <Icon className="size-4 shrink-0" />
                    <span className="whitespace-nowrap">{item.label}</span>
                  </Link>
                </Button>
              );
            })}
          </nav>
        </aside>

        {/* Main Content */}
        <main className="flex-1 p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}

