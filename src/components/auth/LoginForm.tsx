
"use client";

import { useState, useEffect, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { loginAction, verifyTwoFactorAndLogin, getUsersWithFaceDescriptors, finalizeFaceLogin } from '@/actions/authActions';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { Loader2, ShieldCheck, Camera, UserCheck as UserCheckIcon } from 'lucide-react';
import * as faceapi from 'face-api.js';
import type { User } from '@/types';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

const loginSchema = z.object({
  email: z.string().email({ message: 'Invalid email address.' }),
  password: z.string().min(1, { message: 'Password is required.' }),
});
type LoginFormValues = z.infer<typeof loginSchema>;

const twoFactorSchema = z.object({
  token: z.string().length(6, { message: "Token must be 6 digits." }).regex(/^\d{6}$/, "Token must be 6 digits."),
});
type TwoFactorFormValues = z.infer<typeof twoFactorSchema>;

export default function LoginForm() {
  const { login: authContextLogin } = useAuth();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [detectedOs, setDetectedOs] = useState<string | null>(null);

  const [loginStep, setLoginStep] = useState<'credentials' | '2fa'>('credentials');
  const [userIdFor2FA, setUserIdFor2FA] = useState<string | null>(null);
  const [emailFor2FA, setEmailFor2FA] = useState<string | null>(null);

  const [showFaceLogin, setShowFaceLogin] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isModelsLoaded, setIsModelsLoaded] = useState(false);
  const [hasCameraPermission, setHasCameraPermission] = useState(false);
  const [isScanningFace, setIsScanningFace] = useState(false);
  const [faceScanError, setFaceScanError] = useState<string | null>(null);
  const [faceScanMessage, setFaceScanMessage] = useState<string | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);

  const formCredentials = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  const form2FA = useForm<TwoFactorFormValues>({
    resolver: zodResolver(twoFactorSchema),
    defaultValues: { token: '' },
  });

  useEffect(() => {
    if (typeof window !== 'undefined' && navigator.userAgentData) {
      setDetectedOs(navigator.userAgentData.platform);
    } else if (typeof window !== 'undefined' && navigator.platform) {
      setDetectedOs(navigator.platform);
    } else {
      setDetectedOs("Unknown");
    }
  }, []);

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
        setFaceScanError("Could not load face recognition models. Face login unavailable.");
        toast({ variant: "destructive", title: "Model Load Error", description: "Face login models failed to load." });
      }
    };
    if (showFaceLogin) {
        loadModels();
    }
  }, [showFaceLogin, toast]);

  useEffect(() => {
    const startCamera = async () => {
      if (showFaceLogin && videoRef.current && !videoRef.current.srcObject && isModelsLoaded) {
        try {
          const mediaStream = await navigator.mediaDevices.getUserMedia({ video: true });
          setStream(mediaStream);
          setHasCameraPermission(true);
          if (videoRef.current) {
            videoRef.current.srcObject = mediaStream;
          }
          setFaceScanError(null);
        } catch (error) {
          console.error('Error accessing camera:', error);
          setHasCameraPermission(false);
          setFaceScanError('Camera access denied. Please enable camera permissions in your browser settings.');
          toast({ variant: 'destructive', title: 'Camera Access Denied', description: 'Enable camera permissions for face login.' });
        }
      }
    };

    startCamera();

    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
        setStream(null);
        if (videoRef.current) videoRef.current.srcObject = null;
      }
    };
  }, [showFaceLogin, isModelsLoaded, stream, toast]);


  const onSubmitCredentials = async (data: LoginFormValues) => {
    setIsLoading(true);
    if (!detectedOs) {
      toast({ variant: "destructive", title: "OS Error", description: "Could not detect OS." });
      setIsLoading(false); return;
    }
    try {
      const result = await loginAction(data.email, data.password, detectedOs);
      if (result.success && result.user && !result.needsTwoFactor) {
        authContextLogin(result.user);
        toast({ title: 'Login Successful', description: `Welcome, ${result.user.name}!` });
      } else if (result.success && result.needsTwoFactor && result.userIdFor2FA) {
        setLoginStep('2fa'); setUserIdFor2FA(result.userIdFor2FA); setEmailFor2FA(data.email);
        formCredentials.reset();
        toast({ title: '2FA Required', description: 'Enter code from authenticator app.' });
      } else {
        toast({ variant: 'destructive', title: 'Login Failed', description: result.error });
      }
    } catch (error) {
      toast({ variant: 'destructive', title: 'Login Error', description: 'Unexpected error.' });
    } finally { setIsLoading(false); }
  };

  const onSubmit2FA = async (data2FA: TwoFactorFormValues) => {
    setIsLoading(true);
    if (!userIdFor2FA || !detectedOs) {
      toast({ variant: 'destructive', title: 'Error', description: '2FA session/OS details missing.' });
      setLoginStep('credentials'); setIsLoading(false); return;
    }
    try {
      const result = await verifyTwoFactorAndLogin(userIdFor2FA, data2FA.token, detectedOs);
      if (result.success && result.user) {
        authContextLogin(result.user);
        toast({ title: 'Login Successful', description: `Welcome, ${result.user.name}!` });
      } else {
        toast({ variant: 'destructive', title: '2FA Failed', description: result.error });
        form2FA.reset();
      }
    } catch (error) {
      toast({ variant: 'destructive', title: '2FA Error', description: 'Unexpected error.' });
    } finally { setIsLoading(false); }
  };

  const handleFaceLoginScan = async () => {
    if (!videoRef.current || !isModelsLoaded || !hasCameraPermission || !detectedOs) {
      setFaceScanError("Face login requirements not met (models, camera, or OS detection).");
      toast({ variant: "destructive", title: "Cannot Scan", description: "Face login not ready. Check permissions and model status." });
      return;
    }
    setIsScanningFace(true);
    setFaceScanError(null);
    setFaceScanMessage("Scanning... look at the camera.");

    try {
      const capturedDetection = await faceapi.detectSingleFace(videoRef.current, new faceapi.TinyFaceDetectorOptions()).withFaceLandmarks().withFaceDescriptor();
      if (!capturedDetection) {
        setFaceScanError("No face detected. Please ensure your face is clearly visible.");
        toast({ variant: "destructive", title: "No Face Detected" });
        setIsScanningFace(false);
        return;
      }
      const capturedDescriptor = capturedDetection.descriptor;

      setFaceScanMessage("Comparing face data...");
      const usersWithFaceData = await getUsersWithFaceDescriptors();
      
      let matchedUser: User | null = null;
      const FACE_MATCH_THRESHOLD = 0.5; 

      for (const user of usersWithFaceData) {
        if (user.faceDescriptor && user.faceDescriptor.length > 0) {
          const storedDescriptor = new Float32Array(user.faceDescriptor);
          const distance = faceapi.euclideanDistance(capturedDescriptor, storedDescriptor);
          if (distance < FACE_MATCH_THRESHOLD) {
            matchedUser = user;
            break;
          }
        }
      }

      if (matchedUser && matchedUser.id) {
        setFaceScanMessage(`Face recognized for ${matchedUser.email}. Finalizing login...`);
        const loginResult = await finalizeFaceLogin(matchedUser.id, detectedOs);
        if (loginResult.success && loginResult.user) {
          authContextLogin(loginResult.user);
          toast({ title: 'Face Login Successful', description: `Welcome back, ${loginResult.user.name}!` });
          setShowFaceLogin(false); 
        } else {
          setFaceScanError(loginResult.error || "Face login failed due to server validation.");
          toast({ variant: 'destructive', title: 'Face Login Denied', description: loginResult.error });
        }
      } else {
        setFaceScanError("Face not recognized or no matching user found.");
        toast({ variant: 'destructive', title: 'Face Not Recognized' });
      }
    } catch (error: any) {
      console.error("Error during face login scan:", error);
      setFaceScanError(`An error occurred: ${error.message || "Unknown error"}`);
      toast({ variant: "destructive", title: "Face Scan Error", description: "An unexpected error occurred." });
    } finally {
      setIsScanningFace(false);
      if (!faceScanError && !isScanningFace) setFaceScanMessage(null); 
    }
  };


  return (
    <Card className="w-full max-w-md shadow-xl">
      <CardHeader className="text-center">
        <div className="flex justify-center mb-4">
          <ShieldCheck className="h-12 w-12 text-primary" />
        </div>
        <CardTitle className="text-3xl font-headline">Secure Access Sentinel</CardTitle>
        <CardDescription>
          {loginStep === 'credentials' && !showFaceLogin && 'Please login to continue or use face recognition'}
          {loginStep === 'credentials' && showFaceLogin && 'Scan your face to log in'}
          {loginStep === '2fa' && `Enter 2FA code for ${emailFor2FA}`}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {!showFaceLogin && loginStep === 'credentials' && (
          <>
            <Form {...formCredentials}>
              <form onSubmit={formCredentials.handleSubmit(onSubmitCredentials)} className="space-y-6">
                <FormField control={formCredentials.control} name="email" render={({ field }) => (
                  <FormItem><FormLabel>Email</FormLabel><FormControl><Input type="email" placeholder="your.email@example.com" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={formCredentials.control} name="password" render={({ field }) => (
                  <FormItem><FormLabel>Password</FormLabel><FormControl><Input type="password" placeholder="••••••••" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                {detectedOs && (<p className="text-xs text-muted-foreground">OS: {detectedOs}</p>)}
                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null} Login
                </Button>
              </form>
            </Form>
            <div className="my-4 flex items-center">
              <div className="flex-grow border-t border-muted"></div>
              <span className="mx-2 text-xs uppercase text-muted-foreground">Or</span>
              <div className="flex-grow border-t border-muted"></div>
            </div>
            <Button variant="outline" className="w-full" onClick={() => setShowFaceLogin(true)} disabled={isLoading}>
              <Camera className="mr-2 h-4 w-4" /> Login with Face Recognition
            </Button>
          </>
        )}

        {showFaceLogin && loginStep === 'credentials' && (
          <div className="space-y-4">
            {!isModelsLoaded && (
              <Alert variant="destructive">
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                <AlertTitle>Loading Models</AlertTitle>
                <AlertDescription>Face recognition models are loading. Please wait...</AlertDescription>
              </Alert>
            )}
            {isModelsLoaded && (
              <>
                <video ref={videoRef} className="w-full aspect-video rounded-md bg-muted border" autoPlay muted playsInline />
                {(!hasCameraPermission && !faceScanError && isModelsLoaded) && ( 
                  <Alert>
                    <Camera className="h-4 w-4" />
                    <AlertTitle>Camera Access</AlertTitle>
                    <AlertDescription>Waiting for camera permission. If prompted, please allow access.</AlertDescription>
                  </Alert>
                )}
                 {(faceScanError || faceScanMessage) && (
                    <Alert variant={faceScanError ? "destructive" : "default"} className="mt-2">
                         {faceScanError ? <AlertTitle>Error</AlertTitle> : <AlertTitle>Status</AlertTitle>}
                        <AlertDescription>{faceScanError || faceScanMessage}</AlertDescription>
                    </Alert>
                )}
                <Button onClick={handleFaceLoginScan} className="w-full" disabled={isScanningFace || !hasCameraPermission || !isModelsLoaded}>
                  {isScanningFace ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UserCheckIcon className="mr-2 h-4 w-4" />}
                  Scan My Face
                </Button>
              </>
            )}
            <Button variant="link" onClick={() => { setShowFaceLogin(false); setFaceScanError(null); setFaceScanMessage(null); }} className="w-full" disabled={isScanningFace}>
              Back to Email/Password Login
            </Button>
          </div>
        )}

        {loginStep === '2fa' && (
          <Form {...form2FA}>
            <form onSubmit={form2FA.handleSubmit(onSubmit2FA)} className="space-y-6">
              <p className="text-sm text-muted-foreground">Enter 6-digit code from authenticator app.</p>
              <FormField control={form2FA.control} name="token" render={({ field }) => (
                <FormItem><FormLabel>6-Digit Code</FormLabel><FormControl>
                  <Input placeholder="123456" {...field} type="text" inputMode="numeric" autoComplete="one-time-code" maxLength={6}/>
                </FormControl><FormMessage /></FormItem>
              )} />
              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null} Verify Code & Login
              </Button>
              <Button variant="link" onClick={() => { setLoginStep('credentials'); form2FA.reset();}} className="w-full" disabled={isLoading}>
                Back to password login
              </Button>
            </form>
          </Form>
        )}
      </CardContent>
    </Card>
  );
}
