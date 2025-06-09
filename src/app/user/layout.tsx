
"use client";

import React, { useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { LogOut, ShieldCheck, UserCircle } from 'lucide-react';
import Link from 'next/link';
import { logoutAction } from '@/actions/authActions';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';

export default function UserLayout({ children }: { children: React.ReactNode }) {
  const { user, loading, logout: authLogout } = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  useEffect(() => {
    if (!loading) {
      if (!user) {
        router.replace('/login');
      } else if (user.role === 'admin') {
        
        router.replace('/admin/dashboard');
        toast({
          variant: 'destructive',
          title: 'Access Denied',
          description: 'Admins should use the admin panel.',
        });
      }
    }
  }, [user, loading, router, toast]);

  const handleLogout = async () => {
    if (user) {
      await logoutAction(user.id, user.email);
    }
    authLogout(); 
    toast({ title: "Logged Out", description: "You have been successfully logged out." });
  };

  if (loading || !user || user.role === 'admin') {
    
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="ml-4 text-muted-foreground">Loading user session...</p>
      </div>
    );
  }
  
  
  
  if (user.role !== 'user') {
     router.replace('/login'); 
     return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="ml-4 text-muted-foreground">Verifying user role...</p>
      </div>
    );
  }


  return (
    <div className="flex flex-col min-h-screen bg-muted/40">
      <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-4 border-b bg-background px-6 shadow-sm">
        <Link href="/user/dashboard" className="flex items-center gap-2 font-semibold text-lg">
          <ShieldCheck className="h-6 w-6 text-primary" />
          Secure Access Sentinel
        </Link>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 text-sm">
            <UserCircle className="h-5 w-5 text-muted-foreground" />
            <span>{user.name}</span>
          </div>
          <Button variant="outline" size="sm" onClick={handleLogout}>
            <LogOut className="mr-2 h-4 w-4" />
            Logout
          </Button>
        </div>
      </header>
      <main className="flex-1 p-6">
        {children}
      </main>
       <footer className="py-4 px-6 border-t bg-background text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} Secure Access Sentinel. All rights reserved.
      </footer>
    </div>
  );
}
