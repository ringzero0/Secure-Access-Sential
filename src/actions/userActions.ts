
"use server";

import { db } from '@/lib/firebase';
import type { CompanyFile, AccessRequest, UserSession, ActivityLog } from '@/types';
import { collection, addDoc, query, where, getDocs, orderBy, serverTimestamp, doc, setDoc } from 'firebase/firestore';
import { createAdminNotification } from './adminActions'; 

async function logUserActivity(userId: string, userEmail: string, action: string, details?: Record<string, any>) {
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
    console.error("Error logging user activity:", error);
  }
}

export async function requestFileAccess(
  file: CompanyFile,
  user: UserSession
): Promise<{ success: boolean; error?: string; requestId?: string }> {
  if (!user) {
    return { success: false, error: "User not authenticated." };
  }

  try {
    const existingRequestsQuery = query(
      collection(db, 'accessRequests'),
      where('userId', '==', user.id),
      where('fileId', '==', file.id),
      where('status', 'in', ['pending', 'approved'])
    );
    const existingRequestsSnapshot = await getDocs(existingRequestsQuery);
    if (!existingRequestsSnapshot.empty) {
      const existingRequest = existingRequestsSnapshot.docs[0].data() as AccessRequest;
      if (existingRequest.status === 'pending') {
        return { success: false, error: "You already have a pending request for this file." };
      }
      if (existingRequest.status === 'approved') {
        return { success: false, error: "You already have approved access to this file." };
      }
    }

    const newRequestId = doc(collection(db, 'accessRequests')).id;
    const newRequest: AccessRequest = {
      id: newRequestId,
      userId: user.id,
      userName: user.name,
      userEmail: user.email,
      fileId: file.id,
      fileName: file.name,
      status: 'pending',
      requestTimestamp: Date.now(),
    };

    await setDoc(doc(db, 'accessRequests', newRequestId), newRequest);
    
    await logUserActivity(user.id, user.email, 'file_access_request_sent', { fileId: file.id, fileName: file.name, requestId: newRequestId });

    
    await createAdminNotification(
      `User ${user.email} requested access to file "${file.name}".`,
      'access_request',
      { userEmail: user.email, fileName: file.name, fileId: file.id }
    );

    return { success: true, requestId: newRequestId };
  } catch (error) {
    console.error("Error requesting file access:", error);
    await logUserActivity(user.id, user.email, 'file_access_request_fail', { fileId: file.id, fileName: file.name, error: String(error) });
    return { success: false, error: "Failed to submit access request. Please try again." };
  }
}

export async function getUserAccessRequests(userId: string): Promise<AccessRequest[]> {
  console.log(`[Server Action] getUserAccessRequests called for userId: ${userId}`); 
  if (!userId) {
    console.warn("[Server Action] getUserAccessRequests: userId is missing or invalid.");
    return [];
  }
  try {
    const requestsQuery = query(
      collection(db, 'accessRequests'),
      where('userId', '==', userId),
      orderBy('requestTimestamp', 'desc')
    );
    const snapshot = await getDocs(requestsQuery);
    const requests = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as AccessRequest));
    console.log(`[Server Action] Found ${requests.length} access requests for userId: ${userId}`);
    return requests;
  } catch (error) {
    console.error(`[Server Action] Error fetching user access requests for userId ${userId}:`, error);
    return []; 
  }
}
