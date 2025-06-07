
"use client";

import { useState, useEffect } from 'react';
import type { User } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { MoreHorizontal, Edit2, Trash2, UserCheck, UserX, Search, Filter, ShieldCheck, ShieldOff, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { getUsers, updateUser, deleteUser } from '@/actions/adminActions';
import { format } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import UserFormDialog from './UserFormDialog'; 
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'; 

export default function UserManagementClient() {
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterRole, setFilterRole] = useState<'all' | 'admin' | 'user'>('all');
  const [isUserFormOpen, setIsUserFormOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { toast } = useToast();

  const fetchUsers = async () => {
    setIsLoading(true);
    try {
      const fetchedUsers = await getUsers();
      setUsers(fetchedUsers);
    } catch (error) {
      toast({ variant: 'destructive', title: 'Error fetching users', description: String(error) });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleEditUser = (user: User) => {
    setEditingUser(user);
    setIsUserFormOpen(true);
  };
  
  const handleAddUser = () => {
    setEditingUser(null); 
    setIsUserFormOpen(true);
  };


  const handleToggleBlockUser = async (userToToggle: User) => {
    setIsSubmitting(true);
    const newBlockedState = !userToToggle.isBlocked;
    const updates: Partial<User> = {
      isBlocked: newBlockedState,
    };

    if (newBlockedState === true) { 
      updates.blockedUntil = Date.now() + 365 * 24 * 60 * 60 * 1000; 
    } else { 
      updates.blockedUntil = undefined; 
      updates.loginAttemptsToday = 0; 
    }

    try {
      
      if (userToToggle.email === "lateshshetty945@gmail.com" && newBlockedState === true) {
          toast({ variant: "destructive", title: "Action Denied", description: "Cannot block the primary admin account."});
          setIsSubmitting(false);
          return;
      }
      await updateUser(userToToggle.id, updates);
      toast({ title: `User ${newBlockedState ? 'Blocked' : 'Unblocked'}`, description: `${userToToggle.name} has been ${newBlockedState ? 'blocked' : 'unblocked'}.` });
      fetchUsers(); 
    } catch (error) {
      toast({ variant: 'destructive', title: 'Error updating user', description: String(error) });
    } finally {
        setIsSubmitting(false);
    }
  };

  const handleDeleteUser = async (userId: string, userName: string) => {
    setIsSubmitting(true);
    const userToDelete = users.find(u => u.id === userId);
    if (userToDelete?.email === "lateshshetty945@gmail.com") {
        toast({ variant: "destructive", title: "Action Denied", description: "Cannot delete the primary admin account."});
        setIsSubmitting(false);
        return;
    }

    try {
      await deleteUser(userId);
      toast({ title: 'User Deleted', description: `${userName} has been deleted.` });
      fetchUsers(); 
    } catch (error) {
      toast({ variant: 'destructive', title: 'Error deleting user', description: String(error) });
    } finally {
        setIsSubmitting(false);
    }
  };

  const filteredUsers = users
    .filter(user => user.name.toLowerCase().includes(searchTerm.toLowerCase()) || user.email.toLowerCase().includes(searchTerm.toLowerCase()))
    .filter(user => filterRole === 'all' || user.role === filterRole);

  return (
    <div className="space-y-6">
       <UserFormDialog
        isOpen={isUserFormOpen}
        setIsOpen={setIsUserFormOpen}
        user={editingUser}
        onUserSaved={() => {
          fetchUsers(); 
          setIsUserFormOpen(false);
          setEditingUser(null);
        }}
      />
      <Card>
        <CardHeader>
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <CardTitle className="text-2xl">User Management</CardTitle>
                    <CardDescription>View, edit, and manage user accounts and permissions.</CardDescription>
                </div>
                 
                 
            </div>
            <div className="pt-4 flex flex-col sm:flex-row items-center gap-2">
                <div className="relative flex-grow w-full sm:w-auto">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                    type="search"
                    placeholder="Search users by name or email..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-8 w-full"
                />
                </div>
                <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button variant="outline" className="w-full sm:w-auto">
                    <Filter className="mr-2 h-4 w-4" />
                    Filter by Role ({filterRole === 'all' ? 'All' : filterRole.charAt(0).toUpperCase() + filterRole.slice(1)})
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => setFilterRole('all')}>All Roles</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setFilterRole('admin')}>Admin</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setFilterRole('user')}>User</DropdownMenuItem>
                </DropdownMenuContent>
                </DropdownMenu>
            </div>
        </CardHeader>
        <CardContent>
            {isLoading ? (
                 <div className="flex justify-center items-center h-64">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    <p className="ml-2">Loading users...</p>
                </div>
            ) : (
            <Table>
            <TableHeader>
                <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Last Login</TableHead>
                <TableHead className="text-right">Actions</TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                {filteredUsers.length > 0 ? filteredUsers.map((user) => (
                <TableRow key={user.id}>
                    <TableCell className="font-medium">{user.name}</TableCell>
                    <TableCell>{user.email}</TableCell>
                    <TableCell>
                    <Badge variant={user.role === 'admin' ? 'default' : 'secondary'} className={user.role === 'admin' ? 'bg-primary/80 hover:bg-primary' : ''}>
                        {user.role.charAt(0).toUpperCase() + user.role.slice(1)}
                    </Badge>
                    </TableCell>
                    <TableCell>
                    {user.isBlocked ? (
                        <Badge variant="destructive">Blocked</Badge>
                    ) : (
                        <Badge variant="outline" className="border-green-500 text-green-700">Active</Badge>
                    )}
                    {user.isBlocked && user.blockedUntil && user.blockedUntil > Date.now() && (
                        <p className="text-xs text-muted-foreground">Until {format(new Date(user.blockedUntil), 'PPp')}</p>
                    )}
                    </TableCell>
                    <TableCell>{user.lastLoginDate ? format(new Date(user.lastLoginDate), 'PP') : 'Never'}</TableCell>
                    <TableCell className="text-right">
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                        <Button variant="ghost" className="h-8 w-8 p-0" disabled={isSubmitting}>
                            <span className="sr-only">Open menu</span>
                            <MoreHorizontal className="h-4 w-4" />
                        </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handleEditUser(user)} disabled={isSubmitting}>
                            <Edit2 className="mr-2 h-4 w-4" /> Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem 
                            onClick={() => handleToggleBlockUser(user)} 
                            disabled={isSubmitting || (user.email === "lateshshetty945@gmail.com" && user.isBlocked === false) }
                            className={user.isBlocked ? "text-green-600 focus:text-green-700" : "text-red-600 focus:text-red-700"}
                        >
                            {user.isBlocked ? <UserCheck className="mr-2 h-4 w-4" /> : <UserX className="mr-2 h-4 w-4" />}
                            {user.isBlocked ? 'Unblock' : 'Block'}
                        </DropdownMenuItem>
                        {user.email !== "lateshshetty945@gmail.com" && (
                            <AlertDialog>
                                <AlertDialogTrigger asChild>
                                    <DropdownMenuItem 
                                        onSelect={(e) => e.preventDefault()} 
                                        className="text-red-600 focus:text-red-700"
                                        disabled={isSubmitting}
                                    >
                                        <Trash2 className="mr-2 h-4 w-4" /> Delete
                                    </DropdownMenuItem>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                    <AlertDialogHeader>
                                    <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                        This action cannot be undone. This will permanently delete the user account for {user.name}.
                                    </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                    <AlertDialogAction onClick={() => handleDeleteUser(user.id, user.name)} className="bg-destructive hover:bg-destructive/90">
                                        Delete
                                    </AlertDialogAction>
                                    </AlertDialogFooter>
                                </AlertDialogContent>
                            </AlertDialog>
                        )}
                        </DropdownMenuContent>
                    </DropdownMenu>
                    </TableCell>
                </TableRow>
                )) : (
                <TableRow>
                    <TableCell colSpan={6} className="text-center h-24">
                    No users found matching your criteria.
                    </TableCell>
                </TableRow>
                )}
            </TableBody>
            </Table>
        )}
        </CardContent>
      </Card>
    </div>
  );
}
