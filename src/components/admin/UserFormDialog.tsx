
"use client";

import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import type { User } from "@/types";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { addUser, updateUser } from "@/actions/adminActions";
import { useToast } from "@/hooks/use-toast";
import React, { useEffect, useRef, useState } from "react";
import * as faceapi from 'face-api.js';
import { Loader2, Camera, CheckCircle } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";


function convertTo12HourFormat(time24: string | undefined): string {
  if (!time24 || !/^\d{2}:\d{2}$/.test(time24)) return ""; 
  const [hoursStr, minutes] = time24.split(':');
  let H = parseInt(hoursStr, 10);
  const ampm = H >= 12 ? 'PM' : 'AM';
  H = H % 12;
  H = H ? H : 12; 
  const hStr = H < 10 ? '0' + H : H.toString();
  return `${hStr}:${minutes} ${ampm}`;
}


function convertTo24HourFormat(time12: string | undefined): string {
  if (!time12) return ""; 
  const match = time12.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
  if (!match) return ""; 

  let [, hoursStr, minutes, ampmStr] = match;
  let H = parseInt(hoursStr, 10);
  const ampm = ampmStr.toUpperCase();

  if (ampm === 'PM' && H < 12) {
    H += 12;
  }
  if (ampm === 'AM' && H === 12) { 
    H = 0;
  }
  const hStr = H < 10 ? '0' + H : H.toString();
  return `${hStr}:${minutes}`;
}


const userFormSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(2, "Name must be at least 2 characters."),
  email: z.string().email("Invalid email address."),
  passwordInput: z.string().min(6, "Password must be at least 6 characters.").optional().or(z.literal("")), 
  role: z.enum(["user", "admin"]),
  allowedLoginStartTime: z.string().regex(/^(0?[1-9]|1[0-2]):[0-5][0-9]\s(AM|PM)$/, "Invalid time format (e.g., 09:00 AM)").optional().or(z.literal("")),
  allowedLoginEndTime: z.string().regex(/^(0?[1-9]|1[0-2]):[0-5][0-9]\s(AM|PM)$/, "Invalid time format (e.g., 05:00 PM)").optional().or(z.literal("")),
  maxLoginAttemptsPerDay: z.coerce.number().int().min(1).max(100).optional(),
  faceDescriptor: z.array(z.number()).optional(),
}).refine(data => {
  if (!data.id && !data.passwordInput) return false; 
  return true;
}, {
  message: "Password is required for new users.",
  path: ["passwordInput"],
}).refine(data => {
  
  const startSet = !!data.allowedLoginStartTime;
  const endSet = !!data.allowedLoginEndTime;
  return (startSet === endSet);
}, {
  message: "Both login start and end times must be provided, or neither.",
  path: ["allowedLoginEndTime"], 
});

type UserFormValues = z.infer<typeof userFormSchema>;

interface UserFormDialogProps {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  user: User | null;
  onUserSaved: () => void;
}

export default function UserFormDialog({ isOpen, setIsOpen, user, onUserSaved }: UserFormDialogProps) {
  const { toast } = useToast();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isModelsLoaded, setIsModelsLoaded] = useState(false);
  const [hasCameraPermission, setHasCameraPermission] = useState(false);
  const [isCapturingFace, setIsCapturingFace] = useState(false);
  const [faceCaptureError, setFaceCaptureError] = useState<string | null>(null);
  const [showCamera, setShowCamera] = useState(false);
  const [stream, setStream] = useState<MediaStream | null>(null);

  const form = useForm<UserFormValues>({
    resolver: zodResolver(userFormSchema),
    defaultValues: {
      id: undefined,
      name: "",
      email: "",
      passwordInput: "",
      role: "user",
      allowedLoginStartTime: "09:00 AM", 
      allowedLoginEndTime: "05:00 PM",   
      maxLoginAttemptsPerDay: 5,
      faceDescriptor: undefined,
    },
  });

  useEffect(() => {
    const loadModels = async () => {
      const MODEL_URL = '/models';
      try {
        await faceapi.tf.setBackend('cpu'); 
        await faceapi.tf.enableProdMode();
        
        await Promise.all([
          faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
          faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
          faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
        ]);
        setIsModelsLoaded(true);
      } catch (error) {
        console.error("Error loading face-api models:", error);
        toast({ variant: "destructive", title: "Model Load Error", description: "Could not load face recognition models. Face capture will be unavailable." });
      }
    };
    loadModels();
  }, [toast]);

  useEffect(() => {
    if (showCamera && videoRef.current && !videoRef.current.srcObject && isModelsLoaded) {
      const getCameraPermission = async () => {
        try {
          const mediaStream = await navigator.mediaDevices.getUserMedia({ video: true });
          setStream(mediaStream);
          setHasCameraPermission(true);
          if (videoRef.current) {
            videoRef.current.srcObject = mediaStream;
          }
          setFaceCaptureError(null);
        } catch (error) {
          console.error('Error accessing camera:', error);
          setHasCameraPermission(false);
          setFaceCaptureError('Camera access denied. Please enable camera permissions in your browser settings.');
          toast({ variant: 'destructive', title: 'Camera Access Denied', description: 'Enable camera permissions to capture face.' });
          setShowCamera(false);
        }
      };
      getCameraPermission();
    }

    return () => { 
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
        setStream(null);
         if (videoRef.current) videoRef.current.srcObject = null;
      }
    };
  }, [showCamera, isModelsLoaded, toast, stream]);


  useEffect(() => {
    if (isOpen) { 
        if (user) {
        form.reset({
            id: user.id,
            name: user.name,
            email: user.email,
            passwordInput: "", 
            role: user.role,
            allowedLoginStartTime: convertTo12HourFormat(user.allowedLoginStartTime) || "", 
            allowedLoginEndTime: convertTo12HourFormat(user.allowedLoginEndTime) || "",     
            maxLoginAttemptsPerDay: user.maxLoginAttemptsPerDay || 5,
            faceDescriptor: user.faceDescriptor || undefined,
        });
        } else {
        form.reset({ 
            id: undefined, name: "", email: "", passwordInput: "", role: "user",
            allowedLoginStartTime: "09:00 AM", allowedLoginEndTime: "05:00 PM",
            maxLoginAttemptsPerDay: 5, faceDescriptor: undefined,
        });
        }
        setShowCamera(false); 
        setFaceCaptureError(null);
    }
  
  }, [user, isOpen, form]); 

  const handleCaptureFace = async () => {
    if (!videoRef.current || !isModelsLoaded || !hasCameraPermission) {
      toast({ variant: "destructive", title: "Cannot Capture", description: "Face models not loaded, camera not ready, or permission denied." });
      return;
    }
    setIsCapturingFace(true);
    setFaceCaptureError(null);
    try {
      const detections = await faceapi.detectSingleFace(videoRef.current, new faceapi.TinyFaceDetectorOptions()).withFaceLandmarks().withFaceDescriptor();
      if (detections) {
        form.setValue("faceDescriptor", Array.from(detections.descriptor));
        toast({ title: "Face Captured", description: "Face descriptor has been successfully generated." });
        setShowCamera(false); 
      } else {
        setFaceCaptureError("No face detected. Please ensure your face is clearly visible in the camera.");
        toast({ variant: "destructive", title: "No Face Detected", description: "Could not detect a face. Try again." });
      }
    } catch (error) {
      console.error("Error capturing face:", error);
      setFaceCaptureError("An error occurred during face capture. Please try again.");
      toast({ variant: "destructive", title: "Capture Error", description: "Failed to capture face." });
    } finally {
      setIsCapturingFace(false);
    }
  };

  const onSubmit = async (values: UserFormValues) => {
    const submissionValues = { ...values };
    
    try {
      if (user && submissionValues.id) { 
        const updatePayload: Partial<User> & { password?: string, faceDescriptor?: number[] | undefined | null } = {};
        
        
        if (submissionValues.name !== user.name) updatePayload.name = submissionValues.name;
        if (submissionValues.email !== user.email) updatePayload.email = submissionValues.email;
        if (submissionValues.role !== user.role) updatePayload.role = submissionValues.role;

        
        if (submissionValues.passwordInput) {
          updatePayload.password = submissionValues.passwordInput;
        }
       
        
        
        const originalStartTime24 = user.allowedLoginStartTime;
        const newStartTime24 = submissionValues.allowedLoginStartTime ? convertTo24HourFormat(submissionValues.allowedLoginStartTime) : "";
        if (newStartTime24 !== originalStartTime24) {
             updatePayload.allowedLoginStartTime = newStartTime24;
        }

        const originalEndTime24 = user.allowedLoginEndTime;
        const newEndTime24 = submissionValues.allowedLoginEndTime ? convertTo24HourFormat(submissionValues.allowedLoginEndTime) : "";
        if (newEndTime24 !== originalEndTime24) {
            updatePayload.allowedLoginEndTime = newEndTime24;
        }
        
        
        if (submissionValues.maxLoginAttemptsPerDay !== (user.maxLoginAttemptsPerDay || 5)) { 
            updatePayload.maxLoginAttemptsPerDay = submissionValues.maxLoginAttemptsPerDay;
        }
       
        
        if (form.formState.dirtyFields.faceDescriptor || JSON.stringify(submissionValues.faceDescriptor) !== JSON.stringify(user.faceDescriptor)) {
             updatePayload.faceDescriptor = submissionValues.faceDescriptor; 
        }
        
        if (Object.keys(updatePayload).length > 0) {
            await updateUser(submissionValues.id, updatePayload);
            toast({ title: "User Updated", description: `${submissionValues.name}'s details have been updated.` });
        } else {
            toast({ title: "No Changes", description: "No changes were made to the user." });
        }

      } else { 
        if (!submissionValues.passwordInput) { 
             form.setError("passwordInput", { type: "manual", message: "Password is required for new users." });
             return;
        }
        const addUserPayload = {
            name: submissionValues.name,
            email: submissionValues.email,
            passwordInput: submissionValues.passwordInput, 
            role: submissionValues.role,
            
            allowedLoginStartTime: submissionValues.allowedLoginStartTime ? convertTo24HourFormat(submissionValues.allowedLoginStartTime) : undefined, 
            allowedLoginEndTime: submissionValues.allowedLoginEndTime ? convertTo24HourFormat(submissionValues.allowedLoginEndTime) : undefined,    
            maxLoginAttemptsPerDay: submissionValues.maxLoginAttemptsPerDay,
            faceDescriptor: submissionValues.faceDescriptor,
        };
        await addUser(addUserPayload as Omit<User, 'id' | 'createdAt' | 'isTwoFactorEnabled' | 'twoFactorSecret'> & { passwordInput: string; faceDescriptor?: number[]; allowedLoginStartTime?: string; allowedLoginEndTime?: string });
        toast({ title: "User Added", description: `${submissionValues.name} has been added to the system.` });
      }
      onUserSaved();
      setShowCamera(false); 
      setIsOpen(false); 
    } catch (error: any) {
      toast({ variant: "destructive", title: "Operation Failed", description: error.message || String(error) });
    }
  };

  const roleIsUser = form.watch("role") === "user";
  const currentFaceDescriptor = form.watch("faceDescriptor");

  const handleRemoveFaceData = () => {
    form.setValue("faceDescriptor", undefined, { shouldValidate: true, shouldDirty: true });
    setShowCamera(false);
    setFaceCaptureError(null);
    toast({ title: "Face Data Marked for Removal", description: "Existing face data will be removed when you save the changes." });
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { setIsOpen(open); if (!open) setShowCamera(false); }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{user ? "Edit User" : "Add New User"}</DialogTitle>
          <DialogDescription>
            {user ? "Update the user's details, security settings, and face recognition data." : "Fill in the details to create a new user account, optionally including face recognition data."}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4 max-h-[70vh] overflow-y-auto pr-2">
            <FormField control={form.control} name="name" render={({ field }) => (
              <FormItem><FormLabel>Full Name</FormLabel><FormControl><Input placeholder="John Doe" {...field} /></FormControl><FormMessage /></FormItem>
            )} />
            <FormField control={form.control} name="email" render={({ field }) => (
              <FormItem><FormLabel>Email Address</FormLabel><FormControl><Input type="email" placeholder="user@example.com" {...field} /></FormControl><FormMessage /></FormItem>
            )} />
            <FormField control={form.control} name="passwordInput" render={({ field }) => (
              <FormItem><FormLabel>Password {user ? "(Leave blank to keep current)" : ""}</FormLabel><FormControl><Input type="password" {...field} value={field.value ?? ""} /></FormControl><FormMessage /></FormItem>
            )} />
            <FormField control={form.control} name="role" render={({ field }) => (
              <FormItem>
                <FormLabel>Role</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value} value={field.value}>
                  <FormControl><SelectTrigger><SelectValue placeholder="Select a role" /></SelectTrigger></FormControl>
                  <SelectContent>
                    <SelectItem value="user">User</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )} />
            <div className="grid grid-cols-2 gap-4">
              <FormField control={form.control} name="allowedLoginStartTime" render={({ field }) => (
                <FormItem><FormLabel>Login Start (hh:mm AM/PM)</FormLabel><FormControl><Input type="text" placeholder="e.g., 09:00 AM" {...field} value={field.value ?? ""} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="allowedLoginEndTime" render={({ field }) => (
                <FormItem><FormLabel>Login End (hh:mm AM/PM)</FormLabel><FormControl><Input type="text" placeholder="e.g., 05:00 PM" {...field} value={field.value ?? ""} /></FormControl><FormMessage /></FormItem>
              )} />
            </div>
            <FormField control={form.control} name="maxLoginAttemptsPerDay" render={({ field }) => (
              <FormItem><FormLabel>Max Logins/Day</FormLabel><FormControl><Input type="number" min="1" max="100" {...field} onChange={e => field.onChange(parseInt(e.target.value,10))} value={field.value ?? 5} /></FormControl><FormMessage /></FormItem>
            )} />

            {roleIsUser && (
              <div className="space-y-3 pt-2">
                <Label className="text-base font-medium">Face Recognition (Optional for Users)</Label>
                {!isModelsLoaded && <Alert variant="destructive"><Loader2 className="h-4 w-4 animate-spin mr-2" /><AlertDescription>Face recognition models are loading or failed to load. Face capture is unavailable.</AlertDescription></Alert>}

                {isModelsLoaded && !currentFaceDescriptor && !showCamera && (
                  <Button type="button" variant="outline" onClick={() => { setShowCamera(true); setFaceCaptureError(null); }} disabled={!isModelsLoaded}>
                    <Camera className="mr-2 h-4 w-4" /> Add Face Data
                  </Button>
                )}

                {currentFaceDescriptor && (
                   <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between text-green-600 p-3 border border-green-300 bg-green-50 rounded-md">
                     <div className="flex items-center">
                        <CheckCircle className="h-5 w-5 mr-2" />
                        <span>Face data captured.</span>
                     </div>
                     <div className="flex gap-2 mt-2 sm:mt-0">
                        <Button type="button" variant="link" size="sm" className="text-green-600 hover:text-green-700 p-0 h-auto" onClick={() => { setShowCamera(true); setFaceCaptureError(null); }}>
                        Re-capture
                        </Button>
                        <Button type="button" variant="link" size="sm" className="text-red-600 hover:text-red-700 p-0 h-auto" onClick={handleRemoveFaceData}>
                        Remove
                        </Button>
                     </div>
                   </div>
                )}
                 {isModelsLoaded && !currentFaceDescriptor && showCamera && (
                    <p className="text-xs text-muted-foreground">
                        Face data is not yet captured. Use the camera options below.
                    </p>
                )}


                {showCamera && isModelsLoaded && (
                  <div className="space-y-2 p-3 border rounded-md">
                    <video ref={videoRef} className="w-full aspect-video rounded-md bg-muted" autoPlay muted playsInline />
                    {!hasCameraPermission && !faceCaptureError && (
                        <Alert>
                            <Camera className="h-4 w-4" />
                            <AlertTitle>Camera Access</AlertTitle>
                            <AlertDescription>Waiting for camera permission. If prompted, please allow access.</AlertDescription>
                        </Alert>
                    )}
                    {faceCaptureError && <Alert variant="destructive"><AlertTitle>Capture Error</AlertTitle><AlertDescription>{faceCaptureError}</AlertDescription></Alert>}
                    <div className="flex gap-2 flex-wrap">
                      <Button type="button" onClick={handleCaptureFace} disabled={isCapturingFace || !hasCameraPermission || !isModelsLoaded}>
                        {isCapturingFace ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Camera className="mr-2 h-4 w-4" />}
                        Capture Face
                      </Button>
                      <Button type="button" variant="outline" onClick={() => { setShowCamera(false); setFaceCaptureError(null); }}>
                        Cancel Camera
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}

            <DialogFooter className="pt-4">
              <Button type="button" variant="outline" onClick={() => { setIsOpen(false); setShowCamera(false); }}>Cancel</Button>
              <Button type="submit" disabled={form.formState.isSubmitting || isCapturingFace}>
                {form.formState.isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : (user ? "Save Changes" : "Add User")}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
