
"use server";

import { db } from '@/lib/firebase';
import type { User, CompanyFile, AccessRequest, ActivityLog, AdminNotification } from '@/types';
import { collection, getDocs, doc, setDoc, updateDoc, deleteDoc, addDoc, query, orderBy, limit, where, serverTimestamp, writeBatch, getDoc, deleteField, getCountFromServer } from 'firebase/firestore';
import { format, subDays, startOfDay, endOfDay } from 'date-fns';


export async function getUsers(): Promise<User[]> {
  const usersCol = collection(db, 'users');
  const userSnapshot = await getDocs(usersCol);
  const userList = userSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as User));
  return userList.sort((a,b) => (a.createdAt > b.createdAt ? -1 : 1)); 
}

export async function addUser(userData: Omit<User, 'id' | 'createdAt' | 'isTwoFactorEnabled' | 'twoFactorSecret' | 'password'> & {role?: 'admin' | 'user', passwordInput: string, faceDescriptor?: number[], allowedLoginStartTime?: string, allowedLoginEndTime?: string}): Promise<User> {
  try {
    const newUserId = doc(collection(db, 'users')).id; 
    const newUser: User = {
      id: newUserId,
      name: userData.name,
      email: userData.email,
      password: userData.passwordInput, 
      role: userData.role || 'user',
      isBlocked: false,
      createdAt: Date.now(),
      allowedLoginStartTime: userData.allowedLoginStartTime || undefined,
      allowedLoginEndTime: userData.allowedLoginEndTime || undefined,
      maxLoginAttemptsPerDay: userData.maxLoginAttemptsPerDay || 5,
      loginAttemptsToday: 0,
      lastLoginDate: format(new Date(), "yyyy-MM-dd"),
      isTwoFactorEnabled: false,
      twoFactorSecret: '',
      faceDescriptor: userData.faceDescriptor || undefined,
    };
    await setDoc(doc(db, 'users', newUserId), newUser);
    await addDoc(collection(db, 'activityLogs'), {
      userId: 'admin_action', userEmail: 'admin', action: 'user_added',
      details: { addedUserId: newUser.id, addedUserEmail: newUser.email, faceDataAdded: !!newUser.faceDescriptor }, timestamp: Date.now()
    });
    return newUser;
  } catch (error: any) {
    console.error("Error in addUser action:", error);
    throw new Error(error.message || "Failed to add user. Please check server logs.");
  }
}

export async function updateUser(userId: string, updates: Partial<User> & { faceDescriptor?: number[] | undefined | null }): Promise<void> {
  try {
    const userRef = doc(db, 'users', userId);
    const userDocSnap = await getDoc(userRef);

    if (userDocSnap.exists() && userDocSnap.data().email === "lateshshetty945@gmail.com") {
        if (updates.hasOwnProperty('role') && updates.role !== 'admin') {
            throw new Error("Cannot change the role of the primary admin account.");
        }
        if (updates.hasOwnProperty('isBlocked') && updates.isBlocked === true) {
            throw new Error("Cannot block the primary admin account.");
        }
    }

    const firestoreReadyUpdates: Record<string, any> = { ...updates };
    
    if (firestoreReadyUpdates.hasOwnProperty('blockedUntil') && firestoreReadyUpdates.blockedUntil === undefined) {
      firestoreReadyUpdates.blockedUntil = deleteField();
    }
    
    if (updates.hasOwnProperty('faceDescriptor')) {
      if (updates.faceDescriptor === undefined || updates.faceDescriptor === null) {
        firestoreReadyUpdates.faceDescriptor = deleteField();
      } else {
        firestoreReadyUpdates.faceDescriptor = updates.faceDescriptor;
      }
    }

    
    if (updates.hasOwnProperty('allowedLoginStartTime') && updates.allowedLoginStartTime === "") {
        firestoreReadyUpdates.allowedLoginStartTime = deleteField();
    }
    if (updates.hasOwnProperty('allowedLoginEndTime') && updates.allowedLoginEndTime === "") {
        firestoreReadyUpdates.allowedLoginEndTime = deleteField();
    }


    await updateDoc(userRef, firestoreReadyUpdates);
     await addDoc(collection(db, 'activityLogs'), {
      userId: 'admin_action', userEmail: 'admin', action: 'user_updated',
      details: { updatedUserId: userId, updatesApplied: Object.keys(updates), faceDataUpdated: updates.hasOwnProperty('faceDescriptor') }, timestamp: Date.now()
    });
  } catch (error: any) {
    console.error("Error in updateUser action:", error);
    throw new Error(error.message || "Failed to update user. Please check server logs.");
  }
}

export async function deleteUser(userId: string): Promise<void> {
  const userRef = doc(db, 'users', userId);
  const userDocSnap = await getDoc(userRef);
  let userEmailToDelete = "unknown_user_email_on_delete";
  if(userDocSnap.exists()) {
    userEmailToDelete = userDocSnap.data().email;
  }

  if (userEmailToDelete === "lateshshetty945@gmail.com") {
    throw new Error("Cannot delete the primary admin account.");
  }
  await deleteDoc(userRef);
  await addDoc(collection(db, 'activityLogs'), {
    userId: 'admin_action', userEmail: 'admin', action: 'user_deleted',
    details: { deletedUserId: userId, deletedUserEmail: userEmailToDelete }, timestamp: Date.now()
  });
}


const dummyFilesData: Omit<CompanyFile, 'id' | 'createdAt'>[] = [
  { name: "Q4 Financial Report 2023.pdf", description: "Detailed financial statements and analysis for the fourth quarter of 2023." },
  { name: "Project Phoenix - Design Document.docx", description: "Comprehensive design specifications for the upcoming Project Phoenix." },
  { name: "Employee Handbook - 2024 Edition.pdf", description: "Updated company policies, procedures, and employee guidelines." },
  { name: "Marketing Campaign - Summer Launch.pptx", description: "Presentation outlining the strategy for the summer product launch." },
  { name: "Competitor Analysis - Q1 2024.xlsx", description: "Spreadsheet detailing market competitor performance and strategies." },
];

async function seedDummyFiles() {
  const filesCol = collection(db, 'companyFiles');
  const snapshot = await getDocs(query(filesCol, limit(1)));
  if (snapshot.empty) {
    console.log("No company files found. Seeding dummy files...");
    const batch = writeBatch(db);
    dummyFilesData.forEach(fileData => {
      const newFileRef = doc(collection(db, 'companyFiles'));
      const newFile: CompanyFile = {
        ...fileData,
        id: newFileRef.id,
        createdAt: Date.now(),
      };
      batch.set(newFileRef, newFile);
    });
    await batch.commit();
    console.log(`${dummyFilesData.length} dummy files seeded.`);
  }
}


export async function getCompanyFiles(): Promise<CompanyFile[]> {
  await seedDummyFiles(); 
  const filesCol = collection(db, 'companyFiles');
  const filesSnapshot = await getDocs(query(filesCol, orderBy('createdAt', 'desc')));
  return filesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as CompanyFile));
}

export async function addCompanyFile(fileData: Omit<CompanyFile, 'id' | 'createdAt'>): Promise<CompanyFile> {
  const newFileRef = doc(collection(db, 'companyFiles'));
  const newFile: CompanyFile = {
    ...fileData,
    id: newFileRef.id,
    createdAt: Date.now(),
  };
  await setDoc(newFileRef, newFile);
  await addDoc(collection(db, 'activityLogs'), {
    userId: 'admin_action',
    userEmail: 'admin',
    action: 'file_metadata_added',
    details: { fileId: newFile.id, fileName: newFile.name },
    timestamp: Date.now()
  });
  return newFile;
}



export async function getAccessRequests(): Promise<AccessRequest[]> {
  const requestsCol = collection(db, 'accessRequests');
  const requestSnapshot = await getDocs(query(requestsCol, orderBy('requestTimestamp', 'desc')));
  return requestSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as AccessRequest));
}

export async function updateAccessRequestStatus(requestId: string, status: 'approved' | 'rejected' | 'revoked', adminId: string, adminEmail: string): Promise<void> {
  const requestRef = doc(db, 'accessRequests', requestId);
  const requestDocSnap = await getDoc(requestRef);

  let actionType = `request_${status}`;
  let oldStatus: AccessRequest['status'] | undefined = undefined;

  if (requestDocSnap.exists()) {
    oldStatus = (requestDocSnap.data() as AccessRequest).status;
    if (oldStatus === 'approved' && status === 'revoked') {
      actionType = 'request_revoked';
    }
  }

  await updateDoc(requestRef, { status, decisionTimestamp: Date.now() });

  let requestDetails: Partial<AccessRequest> = {};
  if(requestDocSnap.exists()) {
    requestDetails = requestDocSnap.data() as AccessRequest;
  }

  await addDoc(collection(db, 'activityLogs'), {
    userId: adminId,
    userEmail: adminEmail,
    action: actionType,
    details: {
      requestId,
      fileId: requestDetails.fileId,
      targetUserId: requestDetails.userId,
      previousStatus: oldStatus,
      newStatus: status
    },
    timestamp: Date.now()
  });
}



export async function getActivityLogs(count: number = 50): Promise<ActivityLog[]> {
  const logsCol = collection(db, 'activityLogs');
  const logSnapshot = await getDocs(query(logsCol, orderBy('timestamp', 'desc'), limit(count)));
  return logSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ActivityLog));
}

export interface DailyActivityCount {
  date: string; 
  activities: number;
}

export async function getDailyActivityCounts(numberOfDays: number = 7): Promise<DailyActivityCount[]> {
  const activityCounts: DailyActivityCount[] = [];
  const today = new Date();

  for (let i = 0; i < numberOfDays; i++) {
    const targetDate = subDays(today, i);
    const dateStart = startOfDay(targetDate);
    const dateEnd = endOfDay(targetDate);

    const logsCol = collection(db, 'activityLogs');
    const qCount = query(
      logsCol,
      where('timestamp', '>=', dateStart.getTime()),
      where('timestamp', '<=', dateEnd.getTime())
    );

    const snapshot = await getCountFromServer(qCount);
    activityCounts.push({
      date: format(targetDate, 'MMM d'),
      activities: snapshot.data().count,
    });
  }
  return activityCounts.reverse();
}



export async function getUsersCount(): Promise<number> {
  const usersCol = collection(db, 'users');
  const userSnapshot = await getDocs(usersCol);
  return userSnapshot.size;
}

export async function getPendingRequestsCount(): Promise<number> {
  const requestsCol = collection(db, 'accessRequests');
  const q = query(requestsCol, where('status', '==', 'pending'));
  const requestSnapshot = await getDocs(q);
  return requestSnapshot.size;
}

export async function getRecentActivitiesCount(hoursAgo: number = 24): Promise<number> {
  const logsCol = collection(db, 'activityLogs');
  const timeThreshold = Date.now() - (hoursAgo * 60 * 60 * 1000);
  const q = query(logsCol, where('timestamp', '>=', timeThreshold));
  const logSnapshot = await getDocs(q);
  return logSnapshot.size;
}


export async function createAdminNotification(
  message: string,
  actionType: AdminNotification['actionType'],
  relatedInfo?: AdminNotification['relatedInfo']
): Promise<void> {
  try {
    const newNotificationRef = doc(collection(db, 'adminNotifications'));
    const newNotification: AdminNotification = {
      id: newNotificationRef.id,
      message,
      actionType,
      relatedInfo,
      timestamp: Date.now(),
      isRead: false,
    };
    await setDoc(newNotificationRef, newNotification);
  } catch (error) {
    console.error("Error creating admin notification:", error);
  }
}

export async function getAdminNotifications(count: number = 50): Promise<AdminNotification[]> {
  const notificationsCol = collection(db, 'adminNotifications');
  const snapshot = await getDocs(query(notificationsCol, orderBy('timestamp', 'desc'), limit(count)));
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as AdminNotification));
}

export async function markAdminNotificationAsRead(notificationId: string): Promise<void> {
  const notificationRef = doc(db, 'adminNotifications', notificationId);
  await updateDoc(notificationRef, { isRead: true });
}

export async function markAllAdminNotificationsAsRead(adminId: string): Promise<void> {
  const notificationsCol = collection(db, 'adminNotifications');
  const q = query(notificationsCol, where('isRead', '==', false));
  const snapshot = await getDocs(q);
  const batch = writeBatch(db);
  snapshot.docs.forEach(doc => {
    batch.update(doc.ref, { isRead: true });
  });
  await batch.commit();
  await addDoc(collection(db, 'activityLogs'), {
    userId: adminId, userEmail: 'admin_action', action: 'admin_notifications_marked_read',
    details: { count: snapshot.size }, timestamp: Date.now()
  });
}
