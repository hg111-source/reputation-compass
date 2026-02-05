 import { ReactNode } from 'react';
 import { Link, useLocation, useNavigate } from 'react-router-dom';
 import { useAuth } from '@/hooks/useAuth';
 import { Button } from '@/components/ui/button';
 import { Building2, LayoutDashboard, Upload, FolderOpen, LogOut } from 'lucide-react';
 import { cn } from '@/lib/utils';
 
 const navItems = [
   { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
   { href: '/properties', label: 'Properties', icon: Building2 },
   { href: '/groups', label: 'Groups', icon: FolderOpen },
   { href: '/upload', label: 'Upload', icon: Upload },
 ];
 
 export function DashboardLayout({ children }: { children: ReactNode }) {
   const { user, signOut } = useAuth();
   const location = useLocation();
   const navigate = useNavigate();
 
   const handleSignOut = async () => {
     await signOut();
     navigate('/auth');
   };
 
   return (
     <div className="flex min-h-screen bg-background">
       {/* Sidebar */}
       <aside className="fixed left-0 top-0 z-40 h-screen w-64 border-r border-border bg-card">
         <div className="flex h-full flex-col">
           {/* Logo */}
           <div className="flex h-16 items-center gap-3 border-b border-border px-6">
             <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary">
               <Building2 className="h-5 w-5 text-primary-foreground" />
             </div>
             <span className="font-semibold">Reputation</span>
           </div>
 
           {/* Navigation */}
           <nav className="flex-1 space-y-1 px-3 py-4">
             {navItems.map(item => (
               <Link
                 key={item.href}
                 to={item.href}
                 className={cn(
                   'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                   location.pathname === item.href
                     ? 'bg-primary text-primary-foreground'
                     : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                 )}
               >
                 <item.icon className="h-4 w-4" />
                 {item.label}
               </Link>
             ))}
           </nav>
 
           {/* User section */}
           <div className="border-t border-border p-4">
             <div className="mb-3 truncate text-sm text-muted-foreground">
               {user?.email}
             </div>
             <Button
               variant="outline"
               size="sm"
               className="w-full justify-start gap-2"
               onClick={handleSignOut}
             >
               <LogOut className="h-4 w-4" />
               Sign Out
             </Button>
           </div>
         </div>
       </aside>
 
       {/* Main content */}
       <main className="ml-64 flex-1 p-8">
         {children}
       </main>
     </div>
   );
 }