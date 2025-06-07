
"use client";

import type { UserSession } from '@/types';
import React, { createContext, useState, useEffect, ReactNode } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Loader2 } from 'lucide-react';

interface AuthContextType {
  user: UserSession;
  loading: boolean;
  login: (userData: UserSession) => void;
  logout: () => void;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<UserSession>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const initializeAuth = async () => {
      const storedUserId = localStorage.getItem('userId');
      if (storedUserId) {
        try {
          const userDoc = await getDoc(doc(db, 'users', storedUserId));
          if (userDoc.exists()) {
            const userData = { id: userDoc.id, ...userDoc.data() } as UserSession;
            delete userData?.password; 
            setUser(userData);
            
            
            if (pathname === '/login') {
              if (userData?.role === 'admin') {
                router.push('/admin/dashboard');
              } else if (userData?.role === 'user') {
                router.push('/user/dashboard');
              }
            }
          } else {
            localStorage.removeItem('userId');
            setUser(null);
            if (pathname !== '/login') router.push('/login');
          }
        } catch (error) {
          console.error("Error initializing auth:", error);
          localStorage.removeItem('userId');
          setUser(null);
          if (pathname !== '/login') router.push('/login');
        }
      } else {
         if (pathname !== '/login') router.push('/login');
      }
      setLoading(false);
    };
    initializeAuth();
  
  }, [pathname]); 

  const login = (userData: UserSession) => {
    if (userData) {
      localStorage.setItem('userId', userData.id);
      const sessionData = { ...userData };
      delete sessionData.password;
      setUser(sessionData);
      if (userData.role === 'admin') {
        router.push('/admin/dashboard');
      } else {
        router.push('/user/dashboard');
      }
    }
  };

  const logout = () => {
    localStorage.removeItem('userId');
    setUser(null);
    router.push('/login');
  };
  
  if (loading && pathname !== '/login') {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-16 w-16 animate-spin text-primary" />
      </div>
    );
  }

  if (!loading && !user && pathname !== '/login') {
     
     
     
     return (
      <div className="flex items-center justify-center min-h-screen">
        <p>Redirecting to login...</p>
      </div>
    );
  }


  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};
