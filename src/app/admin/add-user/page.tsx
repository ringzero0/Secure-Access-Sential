
"use client";
import UserFormDialog from '@/components/admin/UserFormDialog';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useRouter } from 'next/navigation';


export default function AddUserPage() {
  const router = useRouter();

  return (
    <div className="container mx-auto py-8">
        <Card className="max-w-2xl mx-auto">
            <CardHeader>
                <CardTitle className="text-2xl">Add New User</CardTitle>
                <CardDescription>Create a new user account with appropriate permissions and security settings.</CardDescription>
            </CardHeader>
            <CardContent>
                 
                <UserFormDialog 
                    isOpen={true} 
                    setIsOpen={(isOpen) => {
                        if (!isOpen) router.push('/admin/users'); 
                    }}
                    user={null} 
                    onUserSaved={() => {
                        router.push('/admin/users'); 
                    }}
                />
            </CardContent>
        </Card>
    </div>
  );
}
