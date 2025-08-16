import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { trpc } from '@/utils/trpc';
import type { Customer, CreateCustomerInput, UpdateCustomerInput, Transaction } from '../../../server/src/schema';

export function CustomerManagement() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [customerHistory, setCustomerHistory] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  
  const [formData, setFormData] = useState<CreateCustomerInput>({
    name: '',
    email: null,
    phone: null,
    address: null
  });

  const loadCustomers = useCallback(async () => {
    try {
      const result = await trpc.getCustomers.query();
      setCustomers(result);
    } catch (error) {
      console.error('Failed to load customers:', error);
    }
  }, []);

  useEffect(() => {
    loadCustomers();
  }, [loadCustomers]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      if (editingCustomer) {
        const updateData: UpdateCustomerInput = {
          id: editingCustomer.id,
          ...formData
        };
        await trpc.updateCustomer.mutate(updateData);
      } else {
        await trpc.createCustomer.mutate(formData);
      }
      
      await loadCustomers();
      resetForm();
      setIsDialogOpen(false);
    } catch (error) {
      console.error('Failed to save customer:', error);
      alert('Failed to save customer. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleEdit = (customer: Customer) => {
    setEditingCustomer(customer);
    setFormData({
      name: customer.name,
      email: customer.email,
      phone: customer.phone,
      address: customer.address
    });
    setIsDialogOpen(true);
  };

  const handleViewHistory = async (customer: Customer) => {
    setSelectedCustomer(customer);
    try {
      const history = await trpc.getCustomerPurchaseHistory.query(customer.id);
      setCustomerHistory(history);
      setIsHistoryOpen(true);
    } catch (error) {
      console.error('Failed to load customer history:', error);
      alert('Failed to load customer purchase history.');
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      email: null,
      phone: null,
      address: null
    });
    setEditingCustomer(null);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-3xl font-bold text-gray-900">👥 Customer Management</h2>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={resetForm} className="bg-green-600 hover:bg-green-700">
              ➕ Add Customer
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>
                {editingCustomer ? '✏️ Edit Customer' : '➕ Add New Customer'}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Customer Name *
                </label>
                <Input
                  value={formData.name}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    setFormData((prev: CreateCustomerInput) => ({ ...prev, name: e.target.value }))
                  }
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email
                </label>
                <Input
                  type="email"
                  value={formData.email || ''}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    setFormData((prev: CreateCustomerInput) => ({ ...prev, email: e.target.value || null }))
                  }
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Phone
                </label>
                <Input
                  value={formData.phone || ''}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    setFormData((prev: CreateCustomerInput) => ({ ...prev, phone: e.target.value || null }))
                  }
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Address
                </label>
                <Textarea
                  value={formData.address || ''}
                  onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                    setFormData((prev: CreateCustomerInput) => ({ ...prev, address: e.target.value || null }))
                  }
                  rows={3}
                />
              </div>

              <div className="flex justify-end space-x-2 pt-4">
                <Button 
                  type="button" 
                  variant="outline"
                  onClick={() => setIsDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={isLoading}>
                  {isLoading ? '⏳ Saving...' : (editingCustomer ? '💾 Update' : '➕ Create')}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {customers.length === 0 ? (
        <Card>
          <CardContent className="text-center py-12">
            <div className="text-6xl mb-4">👥</div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">No customers yet</h3>
            <p className="text-gray-600">Start building your customer base!</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {customers.map((customer: Customer) => (
            <Card key={customer.id} className="hover:shadow-md transition-shadow">
              <CardHeader>
                <CardTitle className="text-lg flex items-center">
                  👤 {customer.name}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {customer.email && (
                    <div className="flex items-center text-sm">
                      <span className="text-gray-500 mr-2">📧</span>
                      <span className="truncate">{customer.email}</span>
                    </div>
                  )}
                  {customer.phone && (
                    <div className="flex items-center text-sm">
                      <span className="text-gray-500 mr-2">📞</span>
                      <span>{customer.phone}</span>
                    </div>
                  )}
                  {customer.address && (
                    <div className="flex items-start text-sm">
                      <span className="text-gray-500 mr-2 mt-0.5">📍</span>
                      <span className="line-clamp-2">{customer.address}</span>
                    </div>
                  )}
                </div>

                <div className="flex space-x-2 mt-4">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleEdit(customer)}
                    className="flex-1"
                  >
                    ✏️ Edit
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => handleViewHistory(customer)}
                    className="flex-1"
                  >
                    📊 History
                  </Button>
                </div>

                <div className="text-xs text-gray-400 mt-3">
                  Added: {customer.created_at.toLocaleDateString()}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Purchase History Dialog */}
      <Dialog open={isHistoryOpen} onOpenChange={setIsHistoryOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl">
              📊 Purchase History - {selectedCustomer?.name}
            </DialogTitle>
          </DialogHeader>
          
          {selectedCustomer && (
            <div className="space-y-4">
              <Card className="bg-blue-50">
                <CardContent className="pt-4">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                      <div className="text-sm text-gray-600">Customer</div>
                      <div className="font-semibold">{selectedCustomer.name}</div>
                    </div>
                    {selectedCustomer.email && (
                      <div>
                        <div className="text-sm text-gray-600">Email</div>
                        <div className="font-semibold text-sm">{selectedCustomer.email}</div>
                      </div>
                    )}
                    {selectedCustomer.phone && (
                      <div>
                        <div className="text-sm text-gray-600">Phone</div>
                        <div className="font-semibold">{selectedCustomer.phone}</div>
                      </div>
                    )}
                    <div>
                      <div className="text-sm text-gray-600">Total Orders</div>
                      <div className="font-semibold text-blue-600">{customerHistory.length}</div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {customerHistory.length === 0 ? (
                <Card>
                  <CardContent className="text-center py-8">
                    <div className="text-4xl mb-2">📭</div>
                    <p className="text-gray-600">No purchase history found</p>
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-3">
                  {customerHistory.map((transaction: Transaction) => (
                    <Card key={transaction.id}>
                      <CardContent className="pt-4">
                        <div className="flex justify-between items-start mb-2">
                          <div>
                            <div className="font-semibold">
                              Transaction #{transaction.id}
                            </div>
                            <div className="text-sm text-gray-600">
                              {transaction.created_at.toLocaleDateString()} at{' '}
                              {transaction.created_at.toLocaleTimeString()}
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-lg font-bold text-green-600">
                              ${transaction.final_amount.toFixed(2)}
                            </div>
                            <Badge 
                              variant={
                                transaction.status === 'completed' ? 'default' :
                                transaction.status === 'pending' ? 'secondary' : 'destructive'
                              }
                            >
                              {transaction.status}
                            </Badge>
                          </div>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div>
                            <span className="text-gray-500">Total: </span>
                            <span className="font-medium">${transaction.total_amount.toFixed(2)}</span>
                          </div>
                          {transaction.discount_amount > 0 && (
                            <div>
                              <span className="text-gray-500">Discount: </span>
                              <span className="font-medium text-red-600">
                                -${transaction.discount_amount.toFixed(2)}
                              </span>
                            </div>
                          )}
                          {transaction.payment_method && (
                            <div>
                              <span className="text-gray-500">Payment: </span>
                              <span className="font-medium">{transaction.payment_method}</span>
                            </div>
                          )}
                        </div>
                        
                        {transaction.notes && (
                          <div className="mt-2 p-2 bg-gray-50 rounded text-sm">
                            <span className="text-gray-500">Notes: </span>
                            {transaction.notes}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}