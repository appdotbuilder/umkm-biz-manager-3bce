import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { trpc } from '@/utils/trpc';
import type { User, LoginInput } from '../../server/src/schema';

// Component imports
import { ProductManagement } from '@/components/ProductManagement';
import { CustomerManagement } from '@/components/CustomerManagement';
import { TransactionManagement } from '@/components/TransactionManagement';
import { InventoryManagement } from '@/components/InventoryManagement';
import { ReportsSection } from '@/components/ReportsSection';
import { UserManagement } from '@/components/UserManagement';

function App() {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [loginData, setLoginData] = useState<LoginInput>({
    email: '',
    password: ''
  });
  const [activeTab, setActiveTab] = useState('products');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const result = await trpc.login.mutate(loginData);
      // The login returns { user: {...}, token: string }, we need to extract the user
      const userData: User = {
        id: result.user.id,
        username: result.user.username,
        email: result.user.email,
        role: result.user.role as 'admin' | 'employee',
        password_hash: '', // Not returned from login
        is_active: true, // Assume active if login successful
        created_at: new Date(), // Placeholder date
        updated_at: new Date() // Placeholder date
      };
      setUser(userData);
      setLoginData({ email: '', password: '' });
    } catch (error) {
      console.error('Login failed:', error);
      alert('Login failed. Please check your credentials.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = () => {
    setUser(null);
    setActiveTab('products');
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <Card className="shadow-lg">
            <CardHeader className="text-center">
              <CardTitle className="text-2xl font-bold text-gray-800">
                🏢 UMKM Business Manager
              </CardTitle>
              <p className="text-gray-600 mt-2">
                Complete business management solution for small enterprises
              </p>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleLogin} className="space-y-4">
                <div>
                  <Input
                    type="email"
                    placeholder="Email address"
                    value={loginData.email}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                      setLoginData((prev: LoginInput) => ({ ...prev, email: e.target.value }))
                    }
                    required
                    className="w-full"
                  />
                </div>
                <div>
                  <Input
                    type="password"
                    placeholder="Password"
                    value={loginData.password}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                      setLoginData((prev: LoginInput) => ({ ...prev, password: e.target.value }))
                    }
                    required
                    className="w-full"
                  />
                </div>
                <Button 
                  type="submit" 
                  disabled={isLoading} 
                  className="w-full bg-blue-600 hover:bg-blue-700"
                >
                  {isLoading ? '🔄 Signing in...' : '🚀 Sign In'}
                </Button>
              </form>
              <div className="mt-4 text-xs text-gray-500 text-center">
                Demo: admin@test.com / password
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center space-x-4">
              <h1 className="text-2xl font-bold text-gray-900">
                🏢 UMKM Manager
              </h1>
              <Badge variant="secondary" className="text-xs">
                v1.0
              </Badge>
            </div>
            <div className="flex items-center space-x-4">
              <div className="text-sm text-gray-600">
                Welcome, <span className="font-medium">{user.username}</span>
                <Badge 
                  variant={user.role === 'admin' ? 'default' : 'secondary'}
                  className="ml-2 text-xs"
                >
                  {user.role}
                </Badge>
              </div>
              <Button 
                variant="outline" 
                size="sm"
                onClick={handleLogout}
              >
                🚪 Logout
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-6 lg:w-max">
            <TabsTrigger value="products" className="text-xs sm:text-sm">
              📦 Products
            </TabsTrigger>
            <TabsTrigger value="customers" className="text-xs sm:text-sm">
              👥 Customers
            </TabsTrigger>
            <TabsTrigger value="transactions" className="text-xs sm:text-sm">
              💰 Sales
            </TabsTrigger>
            <TabsTrigger value="inventory" className="text-xs sm:text-sm">
              📊 Inventory
            </TabsTrigger>
            <TabsTrigger value="reports" className="text-xs sm:text-sm">
              📈 Reports
            </TabsTrigger>
            {user.role === 'admin' && (
              <TabsTrigger value="users" className="text-xs sm:text-sm">
                👤 Users
              </TabsTrigger>
            )}
          </TabsList>

          <TabsContent value="products">
            <ProductManagement />
          </TabsContent>

          <TabsContent value="customers">
            <CustomerManagement />
          </TabsContent>

          <TabsContent value="transactions">
            <TransactionManagement user={user} />
          </TabsContent>

          <TabsContent value="inventory">
            <InventoryManagement />
          </TabsContent>

          <TabsContent value="reports">
            <ReportsSection />
          </TabsContent>

          {user.role === 'admin' && (
            <TabsContent value="users">
              <UserManagement />
            </TabsContent>
          )}
        </Tabs>
      </main>
    </div>
  );
}

export default App;