
"use client";

import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { getAdminTwoFactorStatus, generateTwoFactorSetupDetails, confirmAndEnableTwoFactor, disableTwoFactor } from '@/actions/authActions';
import Image from 'next/image'; 
import { Loader2, ShieldCheck, ShieldOff, KeyRound } from 'lucide-react';

export default function AdminSecurityPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isTwoFactorEnabled, setIsTwoFactorEnabled] = useState<boolean | null>(null);
  const [isLoadingStatus, setIsLoadingStatus] = useState(true);
  const [setupDetails, setSetupDetails] = useState<{ qrCodeDataUrl?: string; secret?: string } | null>(null);
  const [token, setToken] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  const fetchStatus = async () => {
    if (!user) return;
    setIsLoadingStatus(true);
    try {
      const status = await getAdminTwoFactorStatus(user.id);
      setIsTwoFactorEnabled(status.isEnabled);
    } catch (error) {
      toast({ variant: 'destructive', title: 'Error', description: 'Could not fetch 2FA status.' });
      setIsTwoFactorEnabled(false); 
    } finally {
      setIsLoadingStatus(false);
    }
  };

  useEffect(() => {
    if (user?.id) {
      fetchStatus();
    }
  
  }, [user?.id]);

  const handleGenerateSetup = async () => {
    if (!user) return;
    setIsProcessing(true);
    setSetupDetails(null); 
    try {
      const result = await generateTwoFactorSetupDetails(user.id);
      if (result.success && result.qrCodeDataUrl && result.secret) {
        setSetupDetails({ qrCodeDataUrl: result.qrCodeDataUrl, secret: result.secret });
        toast({ title: 'Setup Initiated', description: 'Scan the QR code with your authenticator app.' });
      } else {
        toast({ variant: 'destructive', title: 'Error', description: result.error || 'Failed to generate 2FA setup details.' });
      }
    } catch (error) {
      toast({ variant: 'destructive', title: 'Error', description: 'An unexpected error occurred during setup generation.' });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleConfirmEnable = async () => {
    if (!user || !token) return;
    if (!setupDetails?.secret) {
        toast({ variant: 'destructive', title: 'Error', description: 'Setup details are missing. Please try generating QR code again.' });
        return;
    }
    setIsProcessing(true);
    try {
      const result = await confirmAndEnableTwoFactor(user.id, token);
      if (result.success) {
        toast({ title: '2FA Enabled', description: 'Two-factor authentication has been successfully enabled.' });
        setIsTwoFactorEnabled(true);
        setSetupDetails(null);
        setToken('');
      } else {
        toast({ variant: 'destructive', title: 'Verification Failed', description: result.error || 'Invalid token or an error occurred.' });
      }
    } catch (error) {
      toast({ variant: 'destructive', title: 'Error', description: 'An unexpected error occurred during 2FA confirmation.' });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDisable = async () => {
    if (!user) return;
    setIsProcessing(true);
    try {
      const result = await disableTwoFactor(user.id);
      if (result.success) {
        toast({ title: '2FA Disabled', description: 'Two-factor authentication has been disabled.' });
        setIsTwoFactorEnabled(false);
        setSetupDetails(null); 
      } else {
        toast({ variant: 'destructive', title: 'Error', description: result.error || 'Failed to disable 2FA.' });
      }
    } catch (error) {
      toast({ variant: 'destructive', title: 'Error', description: 'An unexpected error occurred while disabling 2FA.' });
    } finally {
      setIsProcessing(false);
    }
  };

  if (isLoadingStatus || !user) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="ml-2 text-muted-foreground">Loading security settings...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl flex items-center">
            <KeyRound className="mr-2 h-6 w-6 text-primary" /> Two-Factor Authentication (2FA)
          </CardTitle>
          <CardDescription>
            Enhance your account security by enabling two-factor authentication.
            You will be required to enter a code from your authenticator app during login.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {isTwoFactorEnabled === true && (
            <div className="p-4 border rounded-md bg-green-50 border-green-200 text-green-700">
              <div className="flex items-center">
                <ShieldCheck className="h-5 w-5 mr-2" />
                <p className="font-semibold">2FA is currently ENABLED for your account.</p>
              </div>
              <Button onClick={handleDisable} variant="destructive" className="mt-4" disabled={isProcessing}>
                {isProcessing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ShieldOff className="mr-2 h-4 w-4" />}
                Disable 2FA
              </Button>
            </div>
          )}

          {isTwoFactorEnabled === false && (
            <div className="p-4 border rounded-md bg-yellow-50 border-yellow-200 text-yellow-700">
              <div className="flex items-center">
                 <ShieldOff className="h-5 w-5 mr-2" />
                <p className="font-semibold">2FA is currently DISABLED for your account.</p>
              </div>
               <Button onClick={handleGenerateSetup} className="mt-4" disabled={isProcessing || !!setupDetails}>
                {isProcessing && !setupDetails ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ShieldCheck className="mr-2 h-4 w-4" />}
                Setup & Enable 2FA
              </Button>
            </div>
          )}

          {setupDetails && isTwoFactorEnabled === false && (
            <Card className="mt-6 border-primary shadow-lg">
              <CardHeader>
                <CardTitle>Step 1: Scan QR Code & Step 2: Verify</CardTitle>
                <CardDescription>
                  Scan the QR code below with your authenticator app (e.g., Google Authenticator, Authy).
                  Then, enter the 6-digit code generated by the app to complete setup.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex flex-col items-center space-y-4 p-4 bg-muted rounded-md">
                  {setupDetails.qrCodeDataUrl && (
                    <Image src={setupDetails.qrCodeDataUrl} alt="QR Code for 2FA setup" width={250} height={250} className="border-4 border-background rounded-lg shadow-md" />
                  )}
                  {setupDetails.secret && (
                    <div className="text-center">
                      <p className="text-sm text-muted-foreground">Or manually enter this setup key:</p>
                      <p className="font-mono bg-background p-3 rounded-md text-foreground tracking-wider text-lg shadow-sm my-2">{setupDetails.secret}</p>
                    </div>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="token" className="text-base">Verification Code</Label>
                  <Input 
                    id="token" 
                    value={token} 
                    onChange={(e) => setToken(e.target.value.replace(/\s/g, '').slice(0, 6))} 
                    placeholder="Enter 6-digit code from app"
                    maxLength={6}
                    inputMode="numeric" 
                    autoComplete="one-time-code"
                    className="text-lg h-12 text-center tracking-[0.3em]"
                  />
                </div>
                <div className="flex flex-col sm:flex-row gap-2">
                    <Button onClick={handleConfirmEnable} disabled={isProcessing || token.length !== 6} className="flex-1 py-3 text-base">
                        {isProcessing ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <ShieldCheck className="mr-2 h-5 w-5" />}
                        Verify & Enable 2FA
                    </Button>
                     <Button variant="outline" onClick={() => { setSetupDetails(null); setToken(''); }} disabled={isProcessing} className="flex-1 py-3 text-base">
                        Cancel Setup
                    </Button>
                </div>
                 <p className="text-xs text-muted-foreground text-center pt-2">
                    Important: If you navigate away or the page reloads before verifying, you must restart the setup process.
                    The current QR code/secret will be valid for 10 minutes.
                  </p>
              </CardContent>
            </Card>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
