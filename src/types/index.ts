
export interface User {
  id: string;
  name: string;
  email: string;
  password?: string; 
  role: 'admin' | 'user';
  isBlocked: boolean;
  blockedUntil?: number; 
  allowedLoginStartTime?: string; 
  allowedLoginEndTime?: string; 
  maxLoginAttemptsPerDay?: number;
  loginAttemptsToday?: number;
  lastLoginDate?: string; 
  createdAt: number; 
  lastOsUsed?: string;
  isTwoFactorEnabled?: boolean;
  twoFactorSecret?: string;
  tempTwoFactorSecret?: string;
  tempTwoFactorSecretTimestamp?: number;
  faceDescriptor?: number[]; 
}

export interface CompanyFile {
  id: string;
  name: string;
  description: string;
  createdAt: number; 
  
}

export interface AccessRequest {
  id:string;
  userId: string;
  userName: string; 
  userEmail: string; 
  fileId: string;
  fileName: string; 
  status: 'pending' | 'approved' | 'rejected' | 'revoked';
  requestTimestamp: number;
  decisionTimestamp?: number;
}

export interface ActivityLog {
  id: string;
  userId: string;
  userEmail: string;
  action: string; 
  timestamp: number;
  details?: Record<string, any>; 
}

export type UserSession = Omit<User, 'password' | 'twoFactorSecret' | 'tempTwoFactorSecret' | 'tempTwoFactorSecretTimestamp' | 'faceDescriptor'> | null;

export interface AdminNotification {
  id: string;
  message: string;
  timestamp: number;
  isRead: boolean; 
  actionType: 'login' | 'logout' | 'access_request' | 'info';
  relatedInfo?: {
    userEmail?: string;
    fileName?: string;
    [key: string]: any; 
  };
}
