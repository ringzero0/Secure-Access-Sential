
"use server";

import { db } from '@/lib/firebase';
import type { User, UserSession, ActivityLog } from '@/types';
import { collection, query, where, getDocs, doc, setDoc, updateDoc, addDoc, deleteField, getDoc } from 'firebase/firestore';
import { format } from 'date-fns';
import speakeasy from 'speakeasy';
import qrcode from 'qrcode';
import { createAdminNotification } from './adminActions';

const ADMIN_EMAIL = "lateshshetty945@gmail.com";
const ADMIN_PASSWORD = "test@123"; 

async function logActivity(userId: string, userEmail: string, action: string, details?: Record<string, any>) {
  try {
    const logEntry: Omit<ActivityLog, 'id'> = {
      userId,
      userEmail,
      action,
      timestamp: Date.now(),
      details,
    };
    await addDoc(collection(db, 'activityLogs'), logEntry);
  } catch (error) {
    console.error("Error logging activity:", error);
  }
}

async function ensureAdminUserExists(): Promise<User> {
  const usersRef = collection(db, 'users');
  const q = query(usersRef, where("email", "==", ADMIN_EMAIL));
  const querySnapshot = await getDocs(q);

  if (querySnapshot.empty) {
    const adminUserDocRef = doc(db, 'users', ADMIN_EMAIL); 
    const adminUser: User = {
      id: adminUserDocRef.id, 
      name: "Latesh Shetty (Admin)",
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD, 
      role: 'admin',
      isBlocked: false,
      createdAt: Date.now(),
      allowedLoginStartTime: "00:00",
      allowedLoginEndTime: "23:59",
      maxLoginAttemptsPerDay: 999, 
      loginAttemptsToday: 0,
      lastLoginDate: format(new Date(), "yyyy-MM-dd"),
      isTwoFactorEnabled: false, 
      twoFactorSecret: '',
    };
    await setDoc(adminUserDocRef, adminUser);
    await logActivity(adminUser.id, adminUser.email, 'admin_user_created');
    await createAdminNotification(
        `Primary admin account ${adminUser.email} ensured/created.`,
        'info',
        { adminEmail: adminUser.email }
    );
    return adminUser;
  } else {
    const adminDoc = querySnapshot.docs[0];
    let existingAdmin = { id: adminDoc.id, ...adminDoc.data() } as User;
    
    const updates: Partial<User> = {};
    if (existingAdmin.password !== ADMIN_PASSWORD) {
        updates.password = ADMIN_PASSWORD;
    }
    if (existingAdmin.isTwoFactorEnabled === undefined) {
        updates.isTwoFactorEnabled = false;
    }
    if (existingAdmin.twoFactorSecret === undefined) {
        updates.twoFactorSecret = '';
    }
     if (existingAdmin.id !== ADMIN_EMAIL && adminDoc.id === ADMIN_EMAIL) { 
        console.warn(`Primary admin document ID ${adminDoc.id} did not match ADMIN_EMAIL. This should not happen.`);
    }

    if (Object.keys(updates).length > 0) {
        await updateDoc(doc(db, 'users', existingAdmin.id), updates);
        existingAdmin = {...existingAdmin, ...updates};
    }
    return existingAdmin;
  }
}

export async function loginAction(
  email: string,
  passwordAttempt: string,
  detectedOs: string
): Promise<{ 
  success: boolean; 
  user?: UserSession; 
  error?: string; 
  needsTwoFactor?: boolean; 
  userIdFor2FA?: string 
}> {
  try {
    let userRecord: User | null = null;
    let userId: string;

    if (email === ADMIN_EMAIL) {
      userRecord = await ensureAdminUserExists();
      userId = userRecord.id;
    } else {
      const usersRef = collection(db, 'users');
      const q = query(usersRef, where('email', '==', email));
      const querySnapshot = await getDocs(q);

      if (querySnapshot.empty) {
        await logActivity('unknown_user', email, 'login_fail_not_found', { detectedOs });
        return { success: false, error: 'User not found.' };
      }
      const userDocSnap = querySnapshot.docs[0];
      userRecord = { id: userDocSnap.id, ...userDocSnap.data() } as User;
      userId = userRecord.id;
    }
    
    const todayStr = format(new Date(), "yyyy-MM-dd");
    const isNewDay = userRecord.lastLoginDate !== todayStr;
    
    const updatesForFirestore: Record<string, any> = {};
    
    if (isNewDay) {
      userRecord.loginAttemptsToday = 0;
      userRecord.lastLoginDate = todayStr;
      updatesForFirestore.loginAttemptsToday = 0;
      updatesForFirestore.lastLoginDate = todayStr;
    }

    if (userRecord.isBlocked && userRecord.blockedUntil && userRecord.blockedUntil < Date.now()) {
      userRecord.isBlocked = false;
      userRecord.blockedUntil = undefined;
      updatesForFirestore.isBlocked = false;
      updatesForFirestore.blockedUntil = deleteField();
      
      await logActivity(userId, email, 'user_auto_unblocked', { detectedOs });
    }

    if (Object.keys(updatesForFirestore).length > 0) {
      await updateDoc(doc(db, 'users', userId), updatesForFirestore);
    }
    
    if (userRecord.isBlocked) {
      await logActivity(userId, email, 'login_fail_blocked', { detectedOs, blockedUntil: userRecord.blockedUntil });
      const remainingTime = userRecord.blockedUntil ? Math.max(0, Math.ceil((userRecord.blockedUntil - Date.now()) / 60000)) : 'N/A';
      return { success: false, error: `Account is blocked. Try again in ${remainingTime} minutes.` };
    }
    
    if (userRecord.role === 'user' && 
        userRecord.maxLoginAttemptsPerDay && 
        (userRecord.loginAttemptsToday || 0) >= userRecord.maxLoginAttemptsPerDay) {
      
      const blockDuration = 2 * 60 * 1000; 
      const dailyLimitBlockUpdates: Record<string, any> = {
          isBlocked: true, 
          blockedUntil: Date.now() + blockDuration,
      };
      await updateDoc(doc(db, 'users', userId), dailyLimitBlockUpdates);
      await logActivity(userId, email, 'login_fail_daily_limit_hit_block_2_min', { detectedOs, attempts: userRecord.loginAttemptsToday });
      return { success: false, error: 'Daily login attempts limit reached. Account blocked for 2 minutes.' };
    }


    if (userRecord.password !== passwordAttempt) {
      let currentFailedAttempts = (userRecord.loginAttemptsToday || 0) + 1;
      const updatesOnPasswordFailFs: Record<string, any> = { loginAttemptsToday: currentFailedAttempts };

      if (userRecord.role === 'user' && currentFailedAttempts >= 2) { 
        updatesOnPasswordFailFs.isBlocked = true;
        updatesOnPasswordFailFs.blockedUntil = Date.now() + 2 * 60 * 1000; 
        await updateDoc(doc(db, 'users', userId), updatesOnPasswordFailFs);
        await logActivity(userId, email, 'login_fail_credentials_block_2_attempts', { detectedOs, attempts: currentFailedAttempts });
        return { success: false, error: 'Invalid credentials. Account blocked for 2 minutes due to multiple failed attempts.' };
      } else {
        await updateDoc(doc(db, 'users', userId), updatesOnPasswordFailFs);
        await logActivity(userId, email, 'login_fail_password', { detectedOs, attempts: currentFailedAttempts });
        const remainingFor2MinBlock = userRecord.role === 'user' ? (2 - currentFailedAttempts) : Infinity;
         if (userRecord.role === 'user' && remainingFor2MinBlock > 0 && userRecord.maxLoginAttemptsPerDay && currentFailedAttempts < userRecord.maxLoginAttemptsPerDay) {
             return { success: false, error: `Invalid password. ${remainingFor2MinBlock} attempt(s) remaining before a 2-minute block.` };
        }
        return { success: false, error: 'Invalid password.' };
      }
    }

    if (userRecord.role === 'admin' && userRecord.isTwoFactorEnabled && userRecord.twoFactorSecret) {
      return { success: true, needsTwoFactor: true, userIdFor2FA: userRecord.id };
    }

    if (userRecord.role === 'user') {
        const osLower = detectedOs.toLowerCase();
        if (!(osLower.includes('win') || osLower.includes('android'))) {
            const osBlockUpdatesFs: Record<string, any> = {
                isBlocked: true,
                blockedUntil: Date.now() + 2 * 60 * 1000, 
                lastOsUsed: detectedOs,
            };
            await updateDoc(doc(db, 'users', userId), osBlockUpdatesFs);
            await logActivity(userId, email, 'login_fail_os_block', { detectedOs });
            return { success: false, error: 'Access denied. Only Windows or Android OS is permitted. Account blocked for 2 minutes.' };
        }
        
        if (userRecord.allowedLoginStartTime && userRecord.allowedLoginEndTime) {
            const now = new Date();
            const currentTime = format(now, 'HH:mm'); 
            if (currentTime < userRecord.allowedLoginStartTime || currentTime > userRecord.allowedLoginEndTime) {
                await logActivity(userId, email, 'login_fail_time_denied', { 
                    detectedOs, 
                    currentTime,
                    accessWindow: `${userRecord.allowedLoginStartTime}-${userRecord.allowedLoginEndTime}` 
                });
                return { success: false, error: `Access denied. Allowed login time is between ${userRecord.allowedLoginStartTime} and ${userRecord.allowedLoginEndTime}.` };
            }
        }
    }
    
    const successUpdatesFs: Record<string, any> = {
        loginAttemptsToday: 0, 
        lastOsUsed: detectedOs,
        isBlocked: false, 
        blockedUntil: deleteField(),
    };
    await updateDoc(doc(db, 'users', userId), successUpdatesFs);
    userRecord = { ...userRecord, ...successUpdatesFs, blockedUntil: undefined, loginAttemptsToday: 0 };

    await logActivity(userId, email, userRecord.role === 'admin' ? 'login_success_admin' : 'login_success_user', { detectedOs, role: userRecord.role });
    
    if (userRecord.role === 'user') {
      await createAdminNotification(
        `User ${userRecord.email} logged in.`,
        'login',
        { userEmail: userRecord.email, detectedOs }
      );
    } else if (userRecord.role === 'admin') {
        await createAdminNotification(
        `Admin ${userRecord.email} logged in.`,
        'login',
        { userEmail: userRecord.email, detectedOs, isAdmin: true }
      );
    }

    const userSessionData: UserSession = { ...userRecord }; 
    delete userSessionData.password;
    delete userSessionData.twoFactorSecret;
    return { success: true, user: userSessionData };

  } catch (error: any) {
    console.error('Login action error:', error);
    await logActivity('unknown_user', email, 'login_fail_server_error', { error: String(error) });
    const message = error.message || 'A server error occurred during login.';
    return { success: false, error: message };
  }
}

export async function logoutAction(userId: string, userEmail: string) {
  await logActivity(userId, userEmail, 'logout_success');
  await createAdminNotification(
    `User ${userEmail} logged out.`,
    'logout',
    { userEmail }
  );
  return { success: true };
}

export async function verifyTwoFactorAndLogin(
  userId: string, 
  token: string, 
  detectedOs: string
): Promise<{ success: boolean; user?: UserSession; error?: string }> {
  try {
    const userRef = doc(db, 'users', userId);
    const userDocSnap = await getDoc(userRef);

    if (!userDocSnap.exists()) {
      return { success: false, error: "User not found for 2FA verification." };
    }
    const adminRecord = { id: userDocSnap.id, ...userDocSnap.data() } as User;

    if (adminRecord.role !== 'admin' || !adminRecord.isTwoFactorEnabled || !adminRecord.twoFactorSecret) {
      return { success: false, error: "2FA is not enabled or configured for this user." };
    }

    const isVerified = speakeasy.totp.verify({
      secret: adminRecord.twoFactorSecret,
      encoding: 'base32',
      token: token,
      window: 1 
    });

    if (!isVerified) {
      await logActivity(adminRecord.id, adminRecord.email, 'login_fail_2fa_token', { detectedOs });
      return { success: false, error: 'Invalid 2FA code.' };
    }

    const successUpdatesFs: Record<string, any> = {
        loginAttemptsToday: 0, 
        lastLoginDate: format(new Date(), "yyyy-MM-dd"),
        lastOsUsed: detectedOs,
        isBlocked: false, 
        blockedUntil: deleteField(),
    };
    await updateDoc(doc(db, 'users', adminRecord.id), successUpdatesFs);
    const updatedAdminRecord = { ...adminRecord, ...successUpdatesFs, blockedUntil: undefined };

    await logActivity(updatedAdminRecord.id, updatedAdminRecord.email, 'login_success_admin_2fa', { detectedOs, role: updatedAdminRecord.role });
    
    await createAdminNotification(
        `Admin ${updatedAdminRecord.email} logged in via 2FA.`,
        'login',
        { userEmail: updatedAdminRecord.email, detectedOs, isAdmin: true, twoFactorUsed: true }
    );
        
    const adminSessionData: UserSession = { ...updatedAdminRecord };
    delete adminSessionData.password;
    delete adminSessionData.twoFactorSecret; 
    
    return { success: true, user: adminSessionData };

  } catch (error: any) {
    console.error('2FA verification error:', error);
    await logActivity(userId, 'admin_2fa_user', 'login_fail_2fa_server_error', { error: String(error) });
    const message = error.message || 'A server error occurred during 2FA verification.';
    return { success: false, error: message };
  }
}

export async function generateTwoFactorSetupDetails(userId: string): Promise<{ success: boolean; qrCodeDataUrl?: string; secret?: string; error?: string }> {
  try {
    const userRef = doc(db, 'users', userId);
    const userDocSnap = await getDoc(userRef);
    if (!userDocSnap.exists() || userDocSnap.data().role !== 'admin') {
      return { success: false, error: "User not found or not an admin." };
    }

    const secret = speakeasy.generateSecret({ name: `SecureAccessSentinel(${userDocSnap.data().email})` });
    
    await updateDoc(userRef, { 
        tempTwoFactorSecret: secret.base32,
        tempTwoFactorSecretTimestamp: Date.now()
    });

    const qrCodeDataUrl = await qrcode.toDataURL(secret.otpauth_url!);
    return { success: true, qrCodeDataUrl, secret: secret.base32 };

  } catch (error: any) {
    console.error("Error generating 2FA setup:", error);
    const message = error.message || "Failed to generate 2FA setup details.";
    return { success: false, error: message };
  }
}

export async function confirmAndEnableTwoFactor(userId: string, token: string): Promise<{ success: boolean; error?: string }> {
  try {
    const userRef = doc(db, 'users', userId);
    const userDocSnap = await getDoc(userRef);
    if (!userDocSnap.exists()) return { success: false, error: "User not found." };
    
    const userData = userDocSnap.data() as User;
    if (userData.role !== 'admin') return { success: false, error: "Only admins can enable 2FA." };
    if (!userData.tempTwoFactorSecret) return { success: false, error: "No temporary secret found. Please restart setup." };

    const tenMinutes = 10 * 60 * 1000;
    if (userData.tempTwoFactorSecretTimestamp && (Date.now() - userData.tempTwoFactorSecretTimestamp > tenMinutes)) {
        await updateDoc(userRef, { tempTwoFactorSecret: deleteField(), tempTwoFactorSecretTimestamp: deleteField() });
        return { success: false, error: "2FA setup timed out. Please restart." };
    }

    const isVerified = speakeasy.totp.verify({
      secret: userData.tempTwoFactorSecret,
      encoding: 'base32',
      token: token,
      window: 1
    });

    if (!isVerified) return { success: false, error: "Invalid token. Please try again." };

    await updateDoc(userRef, {
      isTwoFactorEnabled: true,
      twoFactorSecret: userData.tempTwoFactorSecret,
      tempTwoFactorSecret: deleteField(), 
      tempTwoFactorSecretTimestamp: deleteField()
    });
    await logActivity(userId, userData.email, 'admin_2fa_enabled');
    await createAdminNotification(
        `Admin ${userData.email} enabled 2FA.`,
        'info',
        { userEmail: userData.email, securityAction: '2FA_enabled' }
    );
    return { success: true };

  } catch (error: any) {
    console.error("Error confirming 2FA:", error);
    const message = error.message || "Failed to confirm and enable 2FA.";
    return { success: false, error: message };
  }
}


export async function disableTwoFactor(userId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const userRef = doc(db, 'users', userId);
    const userDocSnap = await getDoc(userRef);
    if (!userDocSnap.exists()) return { success: false, error: "User not found." };
    const userData = userDocSnap.data() as User;
    if (userData.role !== 'admin') return { success: false, error: "User is not an admin." };

    await updateDoc(userRef, {
      isTwoFactorEnabled: false,
      twoFactorSecret: deleteField() 
    });
    await logActivity(userId, userData.email, 'admin_2fa_disabled');
     await createAdminNotification(
        `Admin ${userData.email} disabled 2FA.`,
        'info',
        { userEmail: userData.email, securityAction: '2FA_disabled' }
    );
    return { success: true };
  } catch (error: any) {
    console.error("Error disabling 2FA:", error);
    const message = error.message || "Failed to disable 2FA.";
    return { success: false, error: message };
  }
}

export async function getAdminTwoFactorStatus(userId: string): Promise<{ isEnabled: boolean }> {
    const userRef = doc(db, 'users', userId);
    const userDocSnap = await getDoc(userRef);
    if (userDocSnap.exists() && userDocSnap.data().role === 'admin') {
        return { isEnabled: userDocSnap.data().isTwoFactorEnabled || false };
    }
    return { isEnabled: false };
}



export async function getUsersWithFaceDescriptors(): Promise<User[]> {
  try {
    const usersRef = collection(db, 'users');
    
    const q = query(usersRef, where('faceDescriptor', '!=', null), where('role', '==', 'user'));
    const querySnapshot = await getDocs(q);
    
    const users: User[] = [];
    querySnapshot.forEach(docSnap => {
      const userData = docSnap.data();
      
      if (userData.faceDescriptor && Array.isArray(userData.faceDescriptor)) {
        users.push({ 
            id: docSnap.id, 
            email: userData.email, 
            name: userData.name,
            role: userData.role,
            isBlocked: userData.isBlocked,
            
            faceDescriptor: userData.faceDescriptor 
        } as User); 
      }
    });
    return users;
  } catch (error: any) {
    console.error("Error fetching users with face descriptors:", error);
    throw new Error(error.message || "Failed to fetch users for face recognition.");
  }
}

export async function finalizeFaceLogin(
  userId: string, 
  detectedOs: string
): Promise<{ success: boolean; user?: UserSession; error?: string }> {
  try {
    const userRef = doc(db, 'users', userId);
    const userDocSnap = await getDoc(userRef);

    if (!userDocSnap.exists()) {
      await logActivity(userId, 'unknown_face_user', 'face_login_fail_not_found', { detectedOs });
      return { success: false, error: 'User not found for face login.' };
    }
    let userRecord = { id: userDocSnap.id, ...userDocSnap.data() } as User;

    if (userRecord.role !== 'user') {
        await logActivity(userId, userRecord.email, 'face_login_fail_not_user', { detectedOs });
        return { success: false, error: 'Face login is only available for user accounts.' };
    }
    
    const todayStr = format(new Date(), "yyyy-MM-dd");
    const isNewDay = userRecord.lastLoginDate !== todayStr;
    
    const updatesForFirestore: Record<string, any> = {};
    if (isNewDay) {
      userRecord.loginAttemptsToday = 0; 
      userRecord.lastLoginDate = todayStr;
      updatesForFirestore.loginAttemptsToday = 0;
      updatesForFirestore.lastLoginDate = todayStr;
    }

    if (userRecord.isBlocked && userRecord.blockedUntil && userRecord.blockedUntil < Date.now()) {
      userRecord.isBlocked = false;
      userRecord.blockedUntil = undefined;
      updatesForFirestore.isBlocked = false;
      updatesForFirestore.blockedUntil = deleteField();
      await logActivity(userId, userRecord.email, 'user_auto_unblocked_for_face_login', { detectedOs });
    }
    
    if (Object.keys(updatesForFirestore).length > 0) {
      await updateDoc(userRef, updatesForFirestore);
    }

    if (userRecord.isBlocked) {
      await logActivity(userId, userRecord.email, 'face_login_fail_blocked', { detectedOs, blockedUntil: userRecord.blockedUntil });
      const remainingTime = userRecord.blockedUntil ? Math.max(0, Math.ceil((userRecord.blockedUntil - Date.now()) / 60000)) : 'N/A';
      return { success: false, error: `Account is blocked. Try again in ${remainingTime} minutes.` };
    }

     if (userRecord.role === 'user' && 
        userRecord.maxLoginAttemptsPerDay && 
        (userRecord.loginAttemptsToday || 0) >= userRecord.maxLoginAttemptsPerDay) {
      
      const blockDuration = 2 * 60 * 1000; 
      const dailyLimitBlockUpdates: Record<string, any> = {
          isBlocked: true, 
          blockedUntil: Date.now() + blockDuration,
      };
      await updateDoc(doc(db, 'users', userId), dailyLimitBlockUpdates);
      await logActivity(userId, userRecord.email, 'face_login_fail_daily_limit_hit_block_2_min', { detectedOs, attempts: userRecord.loginAttemptsToday });
      return { success: false, error: 'Daily login attempts limit reached. Account blocked for 2 minutes.' };
    }

    const osLower = detectedOs.toLowerCase();
    if (!(osLower.includes('win') || osLower.includes('android'))) {
      const osBlockUpdatesFs: Record<string, any> = {
        isBlocked: true,
        blockedUntil: Date.now() + 2 * 60 * 1000, 
        lastOsUsed: detectedOs,
      };
      await updateDoc(userRef, osBlockUpdatesFs);
      await logActivity(userId, userRecord.email, 'face_login_fail_os_block', { detectedOs });
      return { success: false, error: 'Access denied. Only Windows or Android OS is permitted. Account blocked for 2 minutes.' };
    }
    
    if (userRecord.allowedLoginStartTime && userRecord.allowedLoginEndTime) {
      const now = new Date();
      const currentTime = format(now, 'HH:mm');
      if (currentTime < userRecord.allowedLoginStartTime || currentTime > userRecord.allowedLoginEndTime) {
        await logActivity(userId, userRecord.email, 'face_login_fail_time_denied', { 
            detectedOs, 
            currentTime,
            accessWindow: `${userRecord.allowedLoginStartTime}-${userRecord.allowedLoginEndTime}` 
        });
        return { success: false, error: `Access denied. Allowed login time is between ${userRecord.allowedLoginStartTime} and ${userRecord.allowedLoginEndTime}.` };
      }
    }
    
    const successUpdatesFs: Record<string, any> = {
        loginAttemptsToday: 0, 
        lastOsUsed: detectedOs,
        isBlocked: false, 
        blockedUntil: deleteField(),
    };
    await updateDoc(userRef, successUpdatesFs);
    userRecord = { ...userRecord, ...successUpdatesFs, blockedUntil: undefined, loginAttemptsToday: 0 };

    await logActivity(userId, userRecord.email, 'login_success_user_face_recognition', { detectedOs, role: userRecord.role });
    
    await createAdminNotification(
      `User ${userRecord.email} logged in via Face Recognition.`,
      'login',
      { userEmail: userRecord.email, detectedOs, loginMethod: 'face_recognition' }
    );

    const userSessionData: UserSession = { ...userRecord }; 
    delete userSessionData.password;
    delete userSessionData.twoFactorSecret; 
    delete userSessionData.faceDescriptor; 
    return { success: true, user: userSessionData };

  } catch (error: any) {
    console.error('Face login finalization error:', error);
    await logActivity(userId, 'unknown_face_user', 'face_login_fail_server_error', { error: String(error) });
    const message = error.message || 'A server error occurred during face login.';
    return { success: false, error: message };
  }
}
