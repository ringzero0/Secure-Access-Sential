
"use client";

import { useState, useEffect, useCallback } from 'react';
import type { CompanyFile, AccessRequest } from '@/types';
import { useAuth } from '@/hooks/useAuth';
import { getCompanyFiles } from '@/actions/adminActions'; 
import { requestFileAccess, getUserAccessRequests } from '@/actions/userActions';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { FileText, Send, Loader2, CheckCircle2, XCircle, Hourglass, Ban, FileUp } from 'lucide-react';

export default function UserDashboardPage() {
  const { user } = useAuth();
  const { toast } = useToast();

  console.log('[UserDashboard] Component Render - Current auth user:', user ? JSON.stringify({ id: user.id, email: user.email, role: user.role }) : 'null');

  const [availableFiles, setAvailableFiles] = useState<CompanyFile[]>([]);
  const [userRequests, setUserRequests] = useState<AccessRequest[]>([]);
  const [loadingFiles, setLoadingFiles] = useState(true);
  const [loadingRequests, setLoadingRequests] = useState(true);
  const [requestingFileId, setRequestingFileId] = useState<string | null>(null);

  const NOTIFICATION_PREFIX = 'notified_request_status_';

  const processRequestNotifications = useCallback((requests: AccessRequest[]) => {
    console.log('[UserDashboard] processRequestNotifications - Processing:', requests.map(r => ({id: r.id, status: r.status, fileName: r.fileName })));
    requests.forEach(req => {
      if (req.status === 'approved' || req.status === 'rejected') {
        const notificationKey = `${NOTIFICATION_PREFIX}${req.id}_${req.status}`;
        if (typeof window !== 'undefined' && !localStorage.getItem(notificationKey)) {
          if (req.status === 'approved') {
            toast({
              title: 'Request Approved!',
              description: `Your request for "${req.fileName}" has been approved.`,
              variant: 'default',
            });
          } else if (req.status === 'rejected') {
            toast({
              title: 'Request Denied',
              description: `Your request for "${req.fileName}" has been rejected.`,
              variant: 'destructive',
            });
          }
          if (typeof window !== 'undefined') {
            localStorage.setItem(notificationKey, 'true');
          }
        }
      }
    });
  }, [toast]);


  const fetchDashboardData = useCallback(async (currentUserId?: string, isRefresh: boolean = false) => {
    console.log(`[UserDashboard] fetchDashboardData - START - ID: ${currentUserId}, Refresh: ${isRefresh}`);
    if (!currentUserId) {
      console.warn("[UserDashboard] fetchDashboardData called without a valid currentUserId. Aborting fetch.");
      setAvailableFiles([]);
      setUserRequests([]);
      setLoadingFiles(false);
      setLoadingRequests(false);
      return;
    }

    setLoadingFiles(prev => isRefresh ? prev : true); 
    setLoadingRequests(true); 
    
    try {
      if (!isRefresh) {
        const files = await getCompanyFiles();
        console.log(`[UserDashboard] fetchDashboardData - Fetched ${files.length} available files.`);
        setAvailableFiles(files);
        setLoadingFiles(false);
      }

      console.log(`[UserDashboard] fetchDashboardData - Calling getUserAccessRequests for ID: ${currentUserId}`);
      const requests = await getUserAccessRequests(currentUserId);
      console.log(`[UserDashboard] fetchDashboardData - Received ${requests.length} requests from action for ID: ${currentUserId}:`, requests.map(r => ({id: r.id, status: r.status, fileName: r.fileName })));
      setUserRequests(requests);
      processRequestNotifications(requests);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      toast({ variant: 'destructive', title: 'Error fetching data', description: errorMessage });
      console.error(`[UserDashboard] fetchDashboardData - Error for ID ${currentUserId}:`, errorMessage);
      if (!isRefresh) {
        setAvailableFiles([]); 
        setLoadingFiles(false);
      }
      setUserRequests([]);
    } finally {
      if (!isRefresh) setLoadingFiles(false);
      setLoadingRequests(false);
    }
    console.log(`[UserDashboard] fetchDashboardData - END - ID: ${currentUserId}`);
  }, [toast, processRequestNotifications]);

  useEffect(() => {
    const currentUserId = user?.id;
    console.log(`[UserDashboard] useEffect (user.id change) trigger - user.id: ${currentUserId}`);
    if (currentUserId && typeof currentUserId === 'string' && currentUserId.length > 0) {
      console.log(`[UserDashboard] useEffect (user.id change) - User is valid, fetching data for ID: ${currentUserId}`);
      fetchDashboardData(currentUserId, false);
    } else {
      console.log(`[UserDashboard] useEffect (user.id change) - User is not valid or ID is missing. Clearing data. User ID:`, currentUserId);
      setAvailableFiles([]);
      setUserRequests([]);
      setLoadingFiles(false);
      setLoadingRequests(false);
    }
  }, [user?.id, fetchDashboardData]);

  useEffect(() => {
    if (!loadingRequests && user?.id) {
        console.log(`[UserDashboard] Final check - User ID: ${user.id}, Requests loaded: ${userRequests.length}`, userRequests.map(r => ({id: r.id, status: r.status, fileName: r.fileName })));
        if (userRequests.length === 0 && loadingFiles === false && availableFiles.length > 0) { 
            console.warn(`[UserDashboard] Final check - No access requests displayed for user ID: ${user.id}. If requests were made, check Firestore 'accessRequests' collection for documents with this userId and ensure server logs for 'getUserAccessRequests' show them being found.`);
        }
    }
  }, [loadingRequests, userRequests, user, loadingFiles, availableFiles]);


  const handleRequestAccess = async (file: CompanyFile) => {
    const currentUserId = user?.id;
    if (!user || !currentUserId) {
      toast({ variant: 'destructive', title: 'Authentication Error', description: 'Please log in again.' });
      console.error('[UserDashboard] handleRequestAccess - Authentication error: User or user ID missing.');
      return;
    }
    setRequestingFileId(file.id);
    console.log(`[UserDashboard] handleRequestAccess - Requesting access for file: ${file.name} (ID: ${file.id}) by user: ${currentUserId}`);
    try {
      const result = await requestFileAccess(file, user);
      if (result.success) {
        toast({ title: 'Request Sent', description: `Your request for "${file.name}" has been submitted.` });
        console.log('[UserDashboard] handleRequestAccess success. Current user for fetchDashboardData:', JSON.stringify({id: user.id, email: user.email}));
        fetchDashboardData(currentUserId, true); 
      } else {
        toast({ variant: 'destructive', title: 'Request Failed', description: result.error });
        console.warn('[UserDashboard] handleRequestAccess - Request failed:', result.error);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      toast({ variant: 'destructive', title: 'Request Error', description: 'An unexpected error occurred.' });
      console.error('[UserDashboard] handleRequestAccess - Unexpected error:', errorMessage);
    } finally {
      setRequestingFileId(null);
    }
  };

  const getStatusBadge = (status: AccessRequest['status']) => {
    switch (status) {
      case 'pending':
        return <Badge variant="outline" className="text-yellow-600 border-yellow-500"><Hourglass className="mr-1 h-3 w-3" />Pending</Badge>;
      case 'approved':
        return <Badge variant="default" className="bg-green-600 hover:bg-green-700"><CheckCircle2 className="mr-1 h-3 w-3" />Approved</Badge>;
      case 'rejected':
        return <Badge variant="destructive"><XCircle className="mr-1 h-3 w-3" />Rejected</Badge>;
      case 'revoked':
        return <Badge variant="outline" className="bg-orange-500 text-white hover:bg-orange-600 border-orange-600"><Ban className="mr-1 h-3 w-3" />Revoked</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-8">
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl flex items-center"><FileText className="mr-2 h-6 w-6 text-primary" /> Company Files & Your Access Status</CardTitle>
          <CardDescription>Browse available files and see the status of your access requests.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {(loadingFiles || loadingRequests) && !availableFiles.length ? ( 
             <div className="flex justify-center items-center h-40">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="ml-2 text-muted-foreground">Loading files and statuses...</p>
            </div>
          ) : availableFiles.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>File Name</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead className="text-right">Status / Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {availableFiles.map((file) => {
                  const userRequestForFile = userRequests.find(req => req.fileId === file.id);
                  
                  return (
                    <TableRow key={file.id}>
                      <TableCell className="font-medium">{file.name}</TableCell>
                      <TableCell className="text-sm text-muted-foreground max-w-md truncate">{file.description}</TableCell>
                      <TableCell className="text-right">
                        {loadingRequests && !userRequestForFile ? ( 
                             <div className="flex justify-end items-center">
                                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                             </div>
                        ) : userRequestForFile ? (
                          <div className="flex flex-col items-end gap-1">
                            {getStatusBadge(userRequestForFile.status)}
                            {userRequestForFile.status === 'approved' && (
                              <Button size="sm" variant="outline" disabled className="mt-1">
                                <FileUp className="mr-2 h-4 w-4" /> Access File (TBD)
                              </Button>
                            )}
                            {(userRequestForFile.status === 'rejected' || userRequestForFile.status === 'revoked') && (
                                <span className="text-xs text-muted-foreground mt-1">
                                    Decision: {userRequestForFile.decisionTimestamp ? format(new Date(userRequestForFile.decisionTimestamp), 'PPp') : 'N/A'}
                                </span>
                            )}
                          </div>
                        ) : (
                          <Button
                            size="sm"
                            onClick={() => handleRequestAccess(file)}
                            disabled={requestingFileId === file.id || userRequests.some(req => req.fileId === file.id && (req.status === 'pending' || req.status === 'approved'))}
                          >
                            {requestingFileId === file.id ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                            {userRequests.some(req => req.fileId === file.id && req.status === 'pending') ? 'Request Pending' : 
                             userRequests.some(req => req.fileId === file.id && req.status === 'approved') ? 'Access Approved' : 
                             'Request Access'}
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          ) : (
            <p className="text-center text-muted-foreground py-4">No company files are currently available or statuses are loading.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
