
"use client";

import { useState, useEffect } from 'react';
import type { ActivityLog } from '@/types';
import { getActivityLogs } from '@/actions/adminActions';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { format } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Search } from 'lucide-react';

export default function AdminActivityLogPage() {
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    const fetchLogs = async () => {
      setIsLoading(true);
      try {
        const fetchedLogs = await getActivityLogs(100); 
        setLogs(fetchedLogs);
      } catch (error) {
        console.error("Error fetching activity logs:", error);
        
      } finally {
        setIsLoading(false);
      }
    };
    fetchLogs();
  }, []);

  const filteredLogs = logs.filter(log => 
    log.userEmail.toLowerCase().includes(searchTerm.toLowerCase()) ||
    log.action.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (log.details && Object.values(log.details).some(val => String(val).toLowerCase().includes(searchTerm.toLowerCase())))
  );

  const getActionBadgeVariant = (action: string) => {
    if (action.includes('success') || action.includes('approved') || action.includes('added')) return 'default';
    if (action.includes('fail') || action.includes('rejected') || action.includes('blocked') || action.includes('deleted')) return 'destructive';
    if (action.includes('request')) return 'outline';
    return 'secondary';
  }

  if (isLoading) return <p>Loading activity logs...</p>;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">System Activity Logs</CardTitle>
          <CardDescription>Recent events recorded in the system.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-4">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Search logs..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8 w-full md:w-1/3"
              />
            </div>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Timestamp</TableHead>
                <TableHead>User Email</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Details</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredLogs.length > 0 ? filteredLogs.map((log) => (
                <TableRow key={log.id}>
                  <TableCell>{format(new Date(log.timestamp), 'PPpp')}</TableCell>
                  <TableCell>{log.userEmail}</TableCell>
                  <TableCell>
                    <Badge variant={getActionBadgeVariant(log.action)}>{log.action.replace(/_/g, ' ')}</Badge>
                  </TableCell>
                  <TableCell className="text-xs">
                    {log.details ? Object.entries(log.details).map(([key, value]) => (
                      <div key={key}><strong>{key}:</strong> {String(value)}</div>
                    )).reduce((acc, curr, idx, arr) => idx < arr.length -1 ? acc.concat([curr, <br key={`br-${idx}`}/>]) : acc.concat(curr) , [] as any) : 'N/A'}
                  </TableCell>
                </TableRow>
              )) : (
                <TableRow>
                  <TableCell colSpan={4} className="text-center h-24">No activity logs found.</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
