import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import { trpc } from '@/utils/trpc';
import type { 
  Transaction, 
  CreateTransactionInput, 
  Product, 
  Customer, 
  User,
  TransactionStatus 
} from '../../../server/src/schema';

interface TransactionItem {
  product_id: number;
  quantity: number;
  unit_price: number;
}

interface TransactionManagementProps {
  user: User;
}

export function TransactionManagement({ user }: TransactionManagementProps) {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  
  const [transactionItems, setTransactionItems] = useState<TransactionItem[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<number | null>(null);
  const [paymentMethod, setPaymentMethod] = useState('');
  const [discountAmount, setDiscountAmount] = useState(0);
  const [notes, setNotes] = useState('');

  const loadData = useCallback(async () => {
    try {
      const [transactionsData, productsData, customersData] = await Promise.all([
        trpc.getTransactions.query(),
        trpc.getProducts.query(),
        trpc.getCustomers.query()
      ]);
      setTransactions(transactionsData);
      setProducts(productsData);
      setCustomers(customersData);
    } catch (error) {
      console.error('Failed to load data:', error);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const addTransactionItem = () => {
    setTransactionItems([...transactionItems, {
      product_id: 0,
      quantity: 1,
      unit_price: 0
    }]);
  };

  const updateTransactionItem = (index: number, field: keyof TransactionItem, value: number) => {
    const updated = [...transactionItems];
    updated[index] = { ...updated[index], [field]: value };
    
    // Auto-fill unit price when product is selected
    if (field === 'product_id') {
      const selectedProduct = products.find(p => p.id === value);
      if (selectedProduct) {
        updated[index].unit_price = selectedProduct.price;
      }
    }
    
    setTransactionItems(updated);
  };

  const removeTransactionItem = (index: number) => {
    setTransactionItems(transactionItems.filter((_, i) => i !== index));
  };

  const calculateTotal = () => {
    const itemsTotal = transactionItems.reduce((sum, item) => 
      sum + (item.quantity * item.unit_price), 0);
    return Math.max(0, itemsTotal - discountAmount);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (transactionItems.length === 0) {
      alert('Please add at least one item to the transaction.');
      return;
    }

    if (transactionItems.some(item => item.product_id === 0 || item.quantity <= 0)) {
      alert('Please fill in all item details correctly.');
      return;
    }

    setIsLoading(true);
    try {
      const totalAmount = transactionItems.reduce((sum, item) => 
        sum + (item.quantity * item.unit_price), 0);
      
      const transactionData: CreateTransactionInput = {
        customer_id: selectedCustomer,
        user_id: user.id,
        total_amount: totalAmount,
        discount_amount: discountAmount,
        payment_method: paymentMethod || null,
        notes: notes || null,
        items: transactionItems
      };

      await trpc.createTransaction.mutate(transactionData);
      await loadData();
      resetForm();
      setIsDialogOpen(false);
    } catch (error) {
      console.error('Failed to create transaction:', error);
      alert('Failed to create transaction. Please check stock availability.');
    } finally {
      setIsLoading(false);
    }
  };

  const resetForm = () => {
    setTransactionItems([]);
    setSelectedCustomer(null);
    setPaymentMethod('');
    setDiscountAmount(0);
    setNotes('');
  };

  const getProductName = (productId: number) => {
    const product = products.find(p => p.id === productId);
    return product?.name || 'Unknown Product';
  };

  const getCustomerName = (customerId: number | null) => {
    if (!customerId) return 'Walk-in Customer';
    const customer = customers.find(c => c.id === customerId);
    return customer?.name || 'Unknown Customer';
  };

  const getStatusColor = (status: TransactionStatus) => {
    switch (status) {
      case 'completed': return 'default';
      case 'pending': return 'secondary';
      case 'cancelled': return 'destructive';
      default: return 'secondary';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-3xl font-bold text-gray-900">💰 Sales & Transactions</h2>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={resetForm} className="bg-green-600 hover:bg-green-700">
              ➕ New Sale
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-xl">🛒 New Transaction</DialogTitle>
            </DialogHeader>
            
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Customer Selection */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">👤 Customer Information</CardTitle>
                </CardHeader>
                <CardContent>
                  <Select value={selectedCustomer?.toString() || ''} onValueChange={(value) => setSelectedCustomer(value ? parseInt(value) : null)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select customer (optional for walk-in)" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="0">Walk-in Customer</SelectItem>
                      {customers.map((customer: Customer) => (
                        <SelectItem key={customer.id} value={customer.id.toString()}>
                          {customer.name}
                          {customer.email && ` (${customer.email})`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </CardContent>
              </Card>

              {/* Items */}
              <Card>
                <CardHeader>
                  <div className="flex justify-between items-center">
                    <CardTitle className="text-lg">🛍️ Items</CardTitle>
                    <Button type="button" onClick={addTransactionItem} size="sm">
                      ➕ Add Item
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  {transactionItems.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                      <div className="text-4xl mb-2">🛒</div>
                      <p>No items added yet</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {transactionItems.map((item, index) => (
                        <div key={index} className="border rounded-lg p-4">
                          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">
                                Product
                              </label>
                              <Select 
                                value={item.product_id.toString()} 
                                onValueChange={(value) => updateTransactionItem(index, 'product_id', parseInt(value))}
                              >
                                <SelectTrigger>
                                  <SelectValue placeholder="Select product" />
                                </SelectTrigger>
                                <SelectContent>
                                  {products.filter(p => p.is_active && p.stock_quantity > 0).map((product: Product) => (
                                    <SelectItem key={product.id} value={product.id.toString()}>
                                      {product.name} (Stock: {product.stock_quantity})
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">
                                Quantity
                              </label>
                              <Input
                                type="number"
                                min="1"
                                value={item.quantity}
                                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                                  updateTransactionItem(index, 'quantity', parseInt(e.target.value) || 1)
                                }
                              />
                            </div>
                            
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">
                                Unit Price
                              </label>
                              <Input
                                type="number"
                                step="0.01"
                                min="0"
                                value={item.unit_price}
                                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                                  updateTransactionItem(index, 'unit_price', parseFloat(e.target.value) || 0)
                                }
                              />
                            </div>
                            
                            <div className="flex items-end">
                              <div className="flex-1">
                                <div className="text-sm font-medium text-gray-700 mb-1">
                                  Total
                                </div>
                                <div className="text-lg font-bold text-green-600">
                                  ${(item.quantity * item.unit_price).toFixed(2)}
                                </div>
                              </div>
                              <Button
                                type="button"
                                variant="destructive"
                                size="sm"
                                onClick={() => removeTransactionItem(index)}
                                className="ml-2"
                              >
                                🗑️
                              </Button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Payment Details */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">💳 Payment Details</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Payment Method
                      </label>
                      <Input
                        value={paymentMethod}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPaymentMethod(e.target.value)}
                        placeholder="Cash, Card, Transfer, etc."
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Discount Amount
                      </label>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        value={discountAmount}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => 
                          setDiscountAmount(parseFloat(e.target.value) || 0)
                        }
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Notes
                    </label>
                    <Textarea
                      value={notes}
                      onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setNotes(e.target.value)}
                      placeholder="Additional notes..."
                      rows={2}
                    />
                  </div>

                  <Separator />
                  
                  <div className="flex justify-between items-center text-lg">
                    <span className="font-medium">Total Amount:</span>
                    <span className="text-2xl font-bold text-green-600">
                      ${calculateTotal().toFixed(2)}
                    </span>
                  </div>
                </CardContent>
              </Card>

              <div className="flex justify-end space-x-2">
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={isLoading || transactionItems.length === 0}>
                  {isLoading ? '⏳ Processing...' : '💰 Complete Sale'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Recent Transactions */}
      {transactions.length === 0 ? (
        <Card>
          <CardContent className="text-center py-12">
            <div className="text-6xl mb-4">💰</div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">No transactions yet</h3>
            <p className="text-gray-600">Create your first sale to get started!</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {transactions.map((transaction: Transaction) => (
            <Card key={transaction.id} className="hover:shadow-md transition-shadow">
              <CardContent className="pt-6">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="text-lg font-semibold">
                      Transaction #{transaction.id}
                    </h3>
                    <p className="text-sm text-gray-600">
                      {getCustomerName(transaction.customer_id)}
                    </p>
                    <p className="text-xs text-gray-400">
                      {transaction.created_at.toLocaleDateString()} at{' '}
                      {transaction.created_at.toLocaleTimeString()}
                    </p>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-bold text-green-600">
                      ${transaction.final_amount.toFixed(2)}
                    </div>
                    <Badge variant={getStatusColor(transaction.status)}>
                      {transaction.status}
                    </Badge>
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div>
                    <span className="text-gray-500">Subtotal:</span>
                    <div className="font-medium">${transaction.total_amount.toFixed(2)}</div>
                  </div>
                  {transaction.discount_amount > 0 && (
                    <div>
                      <span className="text-gray-500">Discount:</span>
                      <div className="font-medium text-red-600">
                        -${transaction.discount_amount.toFixed(2)}
                      </div>
                    </div>
                  )}
                  {transaction.payment_method && (
                    <div>
                      <span className="text-gray-500">Payment:</span>
                      <div className="font-medium">{transaction.payment_method}</div>
                    </div>
                  )}
                  <div>
                    <span className="text-gray-500">Staff:</span>
                    <div className="font-medium">#{transaction.user_id}</div>
                  </div>
                </div>

                {transaction.notes && (
                  <div className="mt-3 p-3 bg-gray-50 rounded text-sm">
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
  );
}