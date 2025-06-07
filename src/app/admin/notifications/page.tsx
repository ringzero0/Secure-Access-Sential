
"use client";

import { useState, useEffect } from 'react';
import type { AdminNotification } from '@/types';
import { getAdminNotifications } from '@/actions/adminActions'; 
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { format } from 'date-fns';
import { Bell, Info, LogIn, LogOut, FileLock, Loader2, RefreshCw } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';

export default function AdminNotificationsPage() {
  const [notifications, setNotifications] = useState<AdminNotification[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  const fetchNotifications = async () => {
    setIsLoading(true);
    try {
      const fetchedNotifications = await getAdminNotifications(100); 
      setNotifications(fetchedNotifications);
    } catch (error) {
      console.error("Error fetching notifications:", error);
      toast({ variant: 'destructive', title: 'Error', description: 'Could not fetch notifications.' });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchNotifications();
  
  }, []);

  const getNotificationIcon = (actionType: AdminNotification['actionType']) => {
    switch (actionType) {
      case 'login': return <LogIn className="h-5 w-5 text-green-500" />;
      case 'logout': return <LogOut className="h-5 w-5 text-red-500" />;
      case 'access_request': return <FileLock className="h-5 w-5 text-blue-500" />;
      case 'info': return <Info className="h-5 w-5 text-yellow-500" />;
      default: return <Bell className="h-5 w-5 text-muted-foreground" />;
    }
  };

  const getActionTypeBadge = (actionType: AdminNotification['actionType']) => {
    switch (actionType) {
      case 'login': return <Badge variant="default" className="bg-green-100 text-green-700 border-green-300">Login</Badge>;
      case 'logout': return <Badge variant="destructive" className="bg-red-100 text-red-700 border-red-300">Logout</Badge>;
      case 'access_request': return <Badge variant="outline" className="bg-blue-100 text-blue-700 border-blue-300">Access Request</Badge>;
      case 'info': return <Badge variant="secondary" className="bg-yellow-100 text-yellow-700 border-yellow-300">System Info</Badge>;
      default: return <Badge variant="secondary">{actionType}</Badge>;
    }
  };

  

  return (
    <div className="space-y-6">
      <Card className="shadow-lg">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-2xl flex items-center">
              <Bell className="mr-3 h-7 w-7 text-primary" />
              Admin Notifications
            </CardTitle>
            <CardDescription>Recent system events and user activities requiring attention or awareness.</CardDescription>
          </div>
          <Button onClick={fetchNotifications} variant="outline" size="sm" disabled={isLoading}>
            {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
            Refresh
          </Button>
        </CardHeader>
        <CardContent>
          {isLoading && notifications.length === 0 ? (
            <div className="flex justify-center items-center h-60">
              <Loader2 className="h-10 w-10 animate-spin text-primary" />
              <p className="ml-3 text-muted-foreground">Loading notifications...</p>
            </div>
          ) : notifications.length === 0 ? (
            <div className="text-center py-10">
              <Bell className="mx-auto h-16 w-16 text-muted-foreground mb-4" />
              <p className="text-xl font-semibold text-muted-foreground">No notifications yet.</p>
              <p className="text-sm text-muted-foreground">Important system events will appear here.</p>
            </div>
          ) : (
            <ScrollArea className="h-[60vh] pr-4"> 
              <div className="space-y-4">
                {notifications.map((notification) => (
                  <div 
                    key={notification.id} 
                    className={`p-4 rounded-lg border flex items-start gap-4 transition-colors ${
                      notification.isRead ? 'bg-muted/50 opacity-70' : 'bg-card hover:bg-muted/30'
                    }`}
                  >
                    <div className="flex-shrink-0 pt-1">
                      {getNotificationIcon(notification.actionType)}
                    </div>
                    <div className="flex-grow">
                      <div className="flex justify-between items-center mb-1">
                        <p className={`font-medium ${notification.isRead ? 'text-muted-foreground' : 'text-foreground'}`}>
                          {notification.message}
                        </p>
                        {getActionTypeBadge(notification.actionType)}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(notification.timestamp), 'MMM d, yyyy, h:mm:ss a')}
                      </p>
                      {notification.relatedInfo && Object.keys(notification.relatedInfo).length > 0 && (
                        <div className="mt-2 text-xs bg-muted p-2 rounded-md">
                          <strong>Details:</strong>
                          <ul className="list-disc list-inside ml-2">
                            {Object.entries(notification.relatedInfo).map(([key, value]) => (
                              <li key={key}><span className="capitalize">{key.replace(/([A-Z])/g, ' $1')}:</span> {String(value)}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                    
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
       
      
    </div>
  );
}
