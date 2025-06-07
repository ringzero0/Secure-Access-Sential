
"use client";

import { useState, useEffect } from 'react';
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import type { CompanyFile } from '@/types';
import { getCompanyFiles, addCompanyFile } from '@/actions/adminActions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { format } from 'date-fns';
import { PlusCircle, FolderKanban, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const fileFormSchema = z.object({
  name: z.string().min(3, "File name must be at least 3 characters.").max(100, "File name is too long."),
  description: z.string().min(5, "Description must be at least 5 characters.").max(500, "Description is too long."),
});

type FileFormValues = z.infer<typeof fileFormSchema>;

export default function AdminFilesPage() {
  const [files, setFiles] = useState<CompanyFile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAddFileDialogOpen, setIsAddFileDialogOpen] = useState(false);
  const { toast } = useToast();

  const form = useForm<FileFormValues>({
    resolver: zodResolver(fileFormSchema),
    defaultValues: {
      name: "",
      description: "",
    },
  });

  const fetchFiles = async () => {
    setIsLoading(true);
    try {
      const fetchedFiles = await getCompanyFiles();
      setFiles(fetchedFiles);
    } catch (error) {
      console.error("Error fetching files:", error);
      toast({ variant: 'destructive', title: 'Error fetching files', description: String(error) });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchFiles();
  }, []);

  const handleAddFile = async (values: FileFormValues) => {
    try {
      await addCompanyFile(values);
      toast({ title: "File Added", description: `Metadata for "${values.name}" has been added.` });
      fetchFiles(); 
      form.reset();
      setIsAddFileDialogOpen(false);
    } catch (error) {
      console.error("Error adding file:", error);
      toast({ variant: 'destructive', title: 'Error adding file', description: String(error) });
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-2xl flex items-center">
              <FolderKanban className="mr-2 h-6 w-6 text-primary" />
              Company Files
            </CardTitle>
            <CardDescription>Manage metadata for company files stored in the system. Actual file content should be managed via a dedicated storage solution like Firebase Cloud Storage.</CardDescription>
          </div>
          <Dialog open={isAddFileDialogOpen} onOpenChange={setIsAddFileDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => { form.reset(); setIsAddFileDialogOpen(true); }}>
                <PlusCircle className="mr-2 h-4 w-4" /> Add File Metadata
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-lg">
              <DialogHeader>
                <DialogTitle>Add New File Metadata</DialogTitle>
                <DialogDescription>
                  Enter the details for the new file. This stores information about the file, not the file itself.
                </DialogDescription>
              </DialogHeader>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(handleAddFile)} className="space-y-4 py-4">
                  <FormField control={form.control} name="name" render={({ field }) => (
                    <FormItem>
                      <FormLabel>File Name</FormLabel>
                      <FormControl><Input placeholder="e.g., Annual Report 2023.pdf" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="description" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Description</FormLabel>
                      <FormControl><Textarea placeholder="A brief description of the file content and purpose." {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <DialogFooter>
                    <Button type="button" variant="outline" onClick={() => setIsAddFileDialogOpen(false)}>Cancel</Button>
                    <Button type="submit" disabled={form.formState.isSubmitting}>
                      {form.formState.isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                      Add Metadata
                    </Button>
                  </DialogFooter>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center items-center h-64">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="ml-2">Loading file metadata...</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Created At</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {files.length > 0 ? files.map((file) => (
                  <TableRow key={file.id}>
                    <TableCell className="font-medium">{file.name}</TableCell>
                    <TableCell className="text-sm text-muted-foreground max-w-md truncate">{file.description}</TableCell>
                    <TableCell>{format(new Date(file.createdAt), 'PPpp')}</TableCell>
                  </TableRow>
                )) : (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center h-24">
                      No file metadata found. Click "Add File Metadata" to get started.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
       <p className="text-xs text-muted-foreground text-center">
        Note: This section manages file metadata only. For actual file storage and uploads, integrate with a service like Firebase Cloud Storage.
      </p>
    </div>
  );
}
