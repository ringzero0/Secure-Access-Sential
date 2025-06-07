
"use client";

import React, { useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useRouter } from 'next/navigation';
import { SidebarProvider, Sidebar, SidebarHeader, SidebarContent, SidebarMenu, SidebarMenuItem, SidebarMenuButton, SidebarInset, SidebarTrigger, SidebarFooter } from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';
import { Home, Users, Activity, FileCheck, Settings, LogOut, ShieldAlert, PlusCircle, FolderKanban, Bell, KeyRound } from 'lucide-react';
import Link from 'next/link';
import { logoutAction } from '@/actions/authActions';
import { useToast } from '@/hooks/use-toast';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user, loading, logout: authLogout } = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  useEffect(() => {
    if (!loading && (!user || user.role !== 'admin')) {
      router.replace('/login');
    }
  }, [user, loading, router]);

  const handleLogout = async () => {
    if (user) {
      await logoutAction(user.id, user.email);
    }
    authLogout();
    toast({ title: "Logged Out", description: "You have been successfully logged out." });
  };

  if (loading || !user || user.role !== 'admin') {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p>Loading admin dashboard or redirecting...</p>
      </div>
    );
  }

  return (
    <SidebarProvider defaultOpen>
      <div className="flex min-h-screen">
        <Sidebar collapsible="icon" className="border-r">
          <SidebarHeader className="p-4">
            <Link href="/admin/dashboard" className="flex items-center gap-2 font-bold text-lg">
              <ShieldAlert className="text-primary" />
              <span className="group-data-[collapsible=icon]:hidden">Admin Panel</span>
            </Link>
          </SidebarHeader>
          <SidebarContent className="p-2">
            <SidebarMenu>
              <SidebarMenuItem>
                <Link href="/admin/dashboard" legacyBehavior passHref>
                  <SidebarMenuButton tooltip="Dashboard">
                    <Home /> <span className="group-data-[collapsible=icon]:hidden">Dashboard</span>
                  </SidebarMenuButton>
                </Link>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <Link href="/admin/users" legacyBehavior passHref>
                  <SidebarMenuButton tooltip="Manage Users">
                    <Users /> <span className="group-data-[collapsible=icon]:hidden">Manage Users</span>
                  </SidebarMenuButton>
                </Link>
              </SidebarMenuItem>
               <SidebarMenuItem>
                <Link href="/admin/add-user" legacyBehavior passHref>
                  <SidebarMenuButton tooltip="Add New User">
                    <PlusCircle /> <span className="group-data-[collapsible=icon]:hidden">Add New User</span>
                  </SidebarMenuButton>
                </Link>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <Link href="/admin/files" legacyBehavior passHref>
                  <SidebarMenuButton tooltip="Manage Files">
                    <FolderKanban /> <span className="group-data-[collapsible=icon]:hidden">Manage Files</span>
                  </SidebarMenuButton>
                </Link>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <Link href="/admin/requests" legacyBehavior passHref>
                  <SidebarMenuButton tooltip="Access Requests">
                    <FileCheck /> <span className="group-data-[collapsible=icon]:hidden">Access Requests</span>
                  </SidebarMenuButton>
                </Link>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <Link href="/admin/activity" legacyBehavior passHref>
                  <SidebarMenuButton tooltip="Activity Logs">
                    <Activity /> <span className="group-data-[collapsible=icon]:hidden">Activity Logs</span>
                  </SidebarMenuButton>
                </Link>
              </SidebarMenuItem>
               <SidebarMenuItem>
                <Link href="/admin/notifications" legacyBehavior passHref>
                  <SidebarMenuButton tooltip="Notifications">
                    <Bell /> <span className="group-data-[collapsible=icon]:hidden">Notifications</span>
                  </SidebarMenuButton>
                </Link>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <Link href="/admin/security" legacyBehavior passHref>
                  <SidebarMenuButton tooltip="Security Settings">
                    <KeyRound /> <span className="group-data-[collapsible=icon]:hidden">Security Settings</span>
                  </SidebarMenuButton>
                </Link>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarContent>
          <SidebarFooter className="p-4 mt-auto">
             <Button variant="ghost" onClick={handleLogout} className="w-full justify-start group-data-[collapsible=icon]:justify-center">
                <LogOut className="mr-2 group-data-[collapsible=icon]:mr-0" />
                <span className="group-data-[collapsible=icon]:hidden">Logout</span>
              </Button>
          </SidebarFooter>
        </Sidebar>
        <SidebarInset className="flex-1 overflow-auto">
          <header className="p-4 border-b flex items-center justify-between sticky top-0 bg-background z-10">
            <SidebarTrigger className="md:hidden" /> 
            <h1 className="text-xl font-semibold">{user.name}</h1>
             
             <div className="flex items-center gap-2">
                <Link href="/admin/notifications" legacyBehavior passHref>
                    <Button variant="ghost" size="icon" aria-label="View Notifications">
                        <Bell className="h-5 w-5" />
                    </Button>
                </Link>
                <Link href="/admin/activity" legacyBehavior passHref>
                    <Button variant="ghost" size="icon" aria-label="View Activity Logs">
                        <Activity className="h-5 w-5" />
                    </Button>
                </Link>
             </div>
          </header>
          <main className="p-6">
            {children}
          </main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}
