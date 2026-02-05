 import { useState } from 'react';
 import { Navigate } from 'react-router-dom';
 import { useAuth } from '@/hooks/useAuth';
 import { Button } from '@/components/ui/button';
 import { Input } from '@/components/ui/input';
 import { Label } from '@/components/ui/label';
 import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
 import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
 import { useToast } from '@/hooks/use-toast';
 import { Building2, TrendingUp } from 'lucide-react';
 
 export default function Auth() {
   const { user, loading, signIn, signUp } = useAuth();
   const { toast } = useToast();
   const [isSubmitting, setIsSubmitting] = useState(false);
 
   if (loading) {
     return (
       <div className="flex min-h-screen items-center justify-center">
         <div className="animate-pulse text-muted-foreground">Loading...</div>
       </div>
     );
   }
 
   if (user) {
     return <Navigate to="/dashboard" replace />;
   }
 
   const handleSignIn = async (e: React.FormEvent<HTMLFormElement>) => {
     e.preventDefault();
     setIsSubmitting(true);
     const formData = new FormData(e.currentTarget);
     const email = formData.get('email') as string;
     const password = formData.get('password') as string;
 
     const { error } = await signIn(email, password);
     setIsSubmitting(false);
 
     if (error) {
       toast({
         variant: 'destructive',
         title: 'Sign in failed',
         description: error.message,
       });
     }
   };
 
   const handleSignUp = async (e: React.FormEvent<HTMLFormElement>) => {
     e.preventDefault();
     setIsSubmitting(true);
     const formData = new FormData(e.currentTarget);
     const email = formData.get('email') as string;
     const password = formData.get('password') as string;
 
     const { error } = await signUp(email, password);
     setIsSubmitting(false);
 
     if (error) {
       toast({
         variant: 'destructive',
         title: 'Sign up failed',
         description: error.message,
       });
     } else {
       toast({
         title: 'Check your email',
         description: 'We sent you a confirmation link to verify your account.',
       });
     }
   };
 
   return (
     <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4">
       <div className="mb-8 flex items-center gap-3">
         <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary">
           <Building2 className="h-6 w-6 text-primary-foreground" />
         </div>
         <div>
           <h1 className="text-2xl font-semibold tracking-tight">Reputation Dashboard</h1>
           <p className="text-sm text-muted-foreground">Track & analyze property reviews</p>
         </div>
       </div>
 
       <Card className="w-full max-w-md">
         <CardHeader className="text-center">
           <CardTitle>Welcome</CardTitle>
           <CardDescription>Sign in to your account or create a new one</CardDescription>
         </CardHeader>
         <CardContent>
           <Tabs defaultValue="signin" className="w-full">
             <TabsList className="grid w-full grid-cols-2">
               <TabsTrigger value="signin">Sign In</TabsTrigger>
               <TabsTrigger value="signup">Sign Up</TabsTrigger>
             </TabsList>
             <TabsContent value="signin">
               <form onSubmit={handleSignIn} className="space-y-4">
                 <div className="space-y-2">
                   <Label htmlFor="signin-email">Email</Label>
                   <Input
                     id="signin-email"
                     name="email"
                     type="email"
                     placeholder="you@example.com"
                     required
                   />
                 </div>
                 <div className="space-y-2">
                   <Label htmlFor="signin-password">Password</Label>
                   <Input
                     id="signin-password"
                     name="password"
                     type="password"
                     placeholder="••••••••"
                     required
                   />
                 </div>
                 <Button type="submit" className="w-full" disabled={isSubmitting}>
                   {isSubmitting ? 'Signing in...' : 'Sign In'}
                 </Button>
               </form>
             </TabsContent>
             <TabsContent value="signup">
               <form onSubmit={handleSignUp} className="space-y-4">
                 <div className="space-y-2">
                   <Label htmlFor="signup-email">Email</Label>
                   <Input
                     id="signup-email"
                     name="email"
                     type="email"
                     placeholder="you@example.com"
                     required
                   />
                 </div>
                 <div className="space-y-2">
                   <Label htmlFor="signup-password">Password</Label>
                   <Input
                     id="signup-password"
                     name="password"
                     type="password"
                     placeholder="••••••••"
                     minLength={6}
                     required
                   />
                 </div>
                 <Button type="submit" className="w-full" disabled={isSubmitting}>
                   {isSubmitting ? 'Creating account...' : 'Create Account'}
                 </Button>
               </form>
             </TabsContent>
           </Tabs>
         </CardContent>
       </Card>
 
       <div className="mt-8 flex items-center gap-2 text-sm text-muted-foreground">
         <TrendingUp className="h-4 w-4" />
         <span>Aggregate scores from Google, TripAdvisor, Expedia & Booking</span>
       </div>
     </div>
   );
 }