
"use client";

import { useState, useEffect } from 'react';
import type { AccessRequest } from '@/types';
import { useAuth } from '@/hooks/useAuth';
import { getAccessRequests, updateAccessRequestStatus } from '@/actions/adminActions';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { format } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, XCircle, Hourglass, Ban, Undo2 } from 'lucide-react'; 
import { useToast } from '@/hooks/use-toast';

export default function AdminAccessRequestsPage() {
  const [requests, setRequests] = useState<AccessRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { user } = useAuth();
  const { toast } = useToast();

  const fetchRequests = async () => {
    setIsLoading(true);
    try {
      const fetchedRequests = await getAccessRequests();
      setRequests(fetchedRequests);
    } catch (error) {
      toast({ variant: 'destructive', title: 'Error fetching requests', description: String(error) });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchRequests();
  }, []);

  const handleUpdateRequestStatus = async (requestId: string, status: 'approved' | 'rejected' | 'revoked') => {
    if (!user) {
      toast({ variant: 'destructive', title: 'Authentication Error', description: 'Admin user not found.' });
      return;
    }
    try {
      await updateAccessRequestStatus(requestId, status, user.id, user.email);
      toast({ title: `Request ${status}`, description: `The access request has been ${status}.` });
      fetchRequests(); 
    } catch (error) {
      toast({ variant: 'destructive', title: 'Error updating request', description: String(error) });
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

  if (isLoading) return <p>Loading access requests...</p>;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">File Access Requests</CardTitle>
          <CardDescription>Review and manage user requests for file access.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Requested At</TableHead>
                <TableHead>User</TableHead>
                <TableHead>File Name</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {requests.length > 0 ? requests.map((req) => (
                <TableRow key={req.id}>
                  <TableCell>{format(new Date(req.requestTimestamp), 'PPpp')}</TableCell>
                  <TableCell>
                    <div>{req.userName}</div>
                    <div className="text-xs text-muted-foreground">{req.userEmail}</div>
                  </TableCell>
                  <TableCell>{req.fileName}</TableCell>
                  <TableCell>{getStatusBadge(req.status)}</TableCell>
                  <TableCell className="text-right space-x-2">
                    {req.status === 'pending' && (
                      <>
                        <Button 
                          size="sm" 
                          variant="outline" 
                          className="border-green-500 text-green-600 hover:bg-green-50 hover:text-green-700"
                          onClick={() => handleUpdateRequestStatus(req.id, 'approved')}
                        >
                          <CheckCircle2 className="mr-1 h-4 w-4" /> Approve
                        </Button>
                        <Button 
                          size="sm" 
                          variant="outline" 
                          className="border-red-500 text-red-600 hover:bg-red-50 hover:text-red-700"
                          onClick={() => handleUpdateRequestStatus(req.id, 'rejected')}
                        >
                          <XCircle className="mr-1 h-4 w-4" /> Reject
                        </Button>
                      </>
                    )}
                    {req.status === 'approved' && (
                      <Button 
                        size="sm" 
                        variant="outline"
                        className="border-orange-500 text-orange-600 hover:bg-orange-50 hover:text-orange-700"
                        onClick={() => handleUpdateRequestStatus(req.id, 'revoked')}
                      >
                        <Ban className="mr-1 h-4 w-4" /> Revoke
                      </Button>
                    )}
                    {(req.status === 'rejected' || req.status === 'revoked') && (
                        <span className="text-xs text-muted-foreground">
                            Decided on {req.decisionTimestamp ? format(new Date(req.decisionTimestamp), 'PPp') : 'N/A'}
                        </span>
                    )}
                  </TableCell>
                </TableRow>
              )) : (
                <TableRow>
                  <TableCell colSpan={5} className="text-center h-24">No access requests found.</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
