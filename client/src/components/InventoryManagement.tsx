import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { trpc } from '@/utils/trpc';
import type { 
  Product, 
  InventoryMovement, 
  InventoryMovementType,
  CreateInventoryMovementInput 
} from '../../../server/src/schema';

export function InventoryManagement() {
  const [products, setProducts] = useState<Product[]>([]);
  const [lowStockProducts, setLowStockProducts] = useState<Product[]>([]);
  const [movements, setMovements] = useState<InventoryMovement[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isAdjustmentOpen, setIsAdjustmentOpen] = useState(false);
  
  const [adjustmentForm, setAdjustmentForm] = useState({
    productId: 0,
    quantity: 0,
    notes: ''
  });

  const loadData = useCallback(async () => {
    try {
      const [productsData, lowStockData, movementsData] = await Promise.all([
        trpc.getProducts.query(),
        trpc.getLowStockProducts.query(),
        trpc.getInventoryMovements.query()
      ]);
      
      setProducts(productsData);
      setLowStockProducts(lowStockData);
      setMovements(movementsData.slice(0, 20)); // Show recent 20 movements
    } catch (error) {
      console.error('Failed to load inventory data:', error);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleStockAdjustment = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (adjustmentForm.productId === 0 || adjustmentForm.quantity === 0) {
      alert('Please select a product and enter a valid quantity adjustment.');
      return;
    }

    setIsLoading(true);
    try {
      await trpc.adjustInventory.mutate({
        productId: adjustmentForm.productId,
        quantity: adjustmentForm.quantity,
        notes: adjustmentForm.notes || undefined
      });
      
      await loadData();
      setAdjustmentForm({ productId: 0, quantity: 0, notes: '' });
      setIsAdjustmentOpen(false);
    } catch (error) {
      console.error('Failed to adjust inventory:', error);
      alert('Failed to adjust inventory. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const getStockStatus = (product: Product) => {
    if (product.stock_quantity === 0) {
      return { label: 'Out of Stock', variant: 'destructive' as const, icon: '❌' };
    }
    if (product.stock_quantity <= product.min_stock_level) {
      return { label: 'Low Stock', variant: 'secondary' as const, icon: '⚠️' };
    }
    return { label: 'In Stock', variant: 'default' as const, icon: '✅' };
  };

  const getMovementIcon = (type: InventoryMovementType) => {
    switch (type) {
      case 'in': return '📈';
      case 'out': return '📉';
      case 'adjustment': return '🔄';
      default: return '📊';
    }
  };

  const getMovementColor = (type: InventoryMovementType) => {
    switch (type) {
      case 'in': return 'text-green-600';
      case 'out': return 'text-red-600';
      case 'adjustment': return 'text-blue-600';
      default: return 'text-gray-600';
    }
  };

  const getProductName = (productId: number) => {
    const product = products.find(p => p.id === productId);
    return product?.name || 'Unknown Product';
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-3xl font-bold text-gray-900">📊 Inventory Management</h2>
        <Dialog open={isAdjustmentOpen} onOpenChange={setIsAdjustmentOpen}>
          <DialogTrigger asChild>
            <Button className="bg-orange-600 hover:bg-orange-700">
              🔄 Adjust Stock
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>🔄 Stock Adjustment</DialogTitle>
            </DialogHeader>
            
            <form onSubmit={handleStockAdjustment} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Product *
                </label>
                <Select 
                  value={adjustmentForm.productId.toString()} 
                  onValueChange={(value) => setAdjustmentForm(prev => ({ ...prev, productId: parseInt(value) }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select product" />
                  </SelectTrigger>
                  <SelectContent>
                    {products.map((product: Product) => (
                      <SelectItem key={product.id} value={product.id.toString()}>
                        {product.name} (Current: {product.stock_quantity})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Adjustment Quantity *
                </label>
                <Input
                  type="number"
                  value={adjustmentForm.quantity}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    setAdjustmentForm(prev => ({ ...prev, quantity: parseInt(e.target.value) || 0 }))
                  }
                  placeholder="Positive to increase, negative to decrease"
                  required
                />
                <div className="text-xs text-gray-500 mt-1">
                  Use positive numbers to add stock, negative to reduce stock
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Notes
                </label>
                <Textarea
                  value={adjustmentForm.notes}
                  onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                    setAdjustmentForm(prev => ({ ...prev, notes: e.target.value }))
                  }
                  placeholder="Reason for adjustment..."
                  rows={3}
                />
              </div>

              <div className="flex justify-end space-x-2">
                <Button type="button" variant="outline" onClick={() => setIsAdjustmentOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={isLoading}>
                  {isLoading ? '⏳ Processing...' : '🔄 Adjust Stock'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Low Stock Alert */}
      {lowStockProducts.length > 0 && (
        <Alert className="border-orange-200 bg-orange-50">
          <AlertDescription className="flex items-center">
            <span className="mr-2">⚠️</span>
            <span className="font-medium">Low Stock Alert:</span>
            <span className="ml-1">
              {lowStockProducts.length} product{lowStockProducts.length > 1 ? 's' : ''} running low on stock
            </span>
          </AlertDescription>
        </Alert>
      )}

      <Tabs defaultValue="current-stock" className="space-y-4">
        <TabsList>
          <TabsTrigger value="current-stock">📦 Current Stock</TabsTrigger>
          <TabsTrigger value="low-stock">⚠️ Low Stock</TabsTrigger>
          <TabsTrigger value="movements">📋 Stock Movements</TabsTrigger>
        </TabsList>

        <TabsContent value="current-stock">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {products.map((product: Product) => {
              const status = getStockStatus(product);
              return (
                <Card key={product.id} className="hover:shadow-md transition-shadow">
                  <CardHeader>
                    <div className="flex justify-between items-start">
                      <CardTitle className="text-lg">{product.name}</CardTitle>
                      <Badge variant={status.variant}>
                        {status.icon} {status.label}
                      </Badge>
                    </div>
                    {product.sku && (
                      <div className="text-xs text-gray-500">SKU: {product.sku}</div>
                    )}
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-500">Current Stock:</span>
                        <span className={`font-bold ${
                          product.stock_quantity === 0 ? 'text-red-600' :
                          product.stock_quantity <= product.min_stock_level ? 'text-orange-600' : 'text-green-600'
                        }`}>
                          {product.stock_quantity} units
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-500">Min Level:</span>
                        <span className="font-medium">{product.min_stock_level} units</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-500">Unit Value:</span>
                        <span className="font-medium">${product.price.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between border-t pt-2">
                        <span className="text-sm text-gray-500">Total Value:</span>
                        <span className="font-bold text-blue-600">
                          ${(product.stock_quantity * product.price).toFixed(2)}
                        </span>
                      </div>
                    </div>
                    {product.category && (
                      <Badge variant="outline" className="mt-3 text-xs">
                        {product.category}
                      </Badge>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>

        <TabsContent value="low-stock">
          {lowStockProducts.length === 0 ? (
            <Card>
              <CardContent className="text-center py-12">
                <div className="text-6xl mb-4">✅</div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">All products well-stocked!</h3>
                <p className="text-gray-600">No products are currently running low on stock.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {lowStockProducts.map((product: Product) => (
                <Card key={product.id} className="border-orange-200 hover:shadow-md transition-shadow">
                  <CardHeader>
                    <div className="flex justify-between items-start">
                      <CardTitle className="text-lg">{product.name}</CardTitle>
                      <Badge variant="secondary">
                        ⚠️ Low Stock
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-500">Current:</span>
                        <span className="font-bold text-orange-600">
                          {product.stock_quantity} units
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-500">Min Level:</span>
                        <span className="font-medium">{product.min_stock_level} units</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-500">Shortage:</span>
                        <span className="font-bold text-red-600">
                          -{Math.max(0, product.min_stock_level - product.stock_quantity + 1)} units
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="movements">
          {movements.length === 0 ? (
            <Card>
              <CardContent className="text-center py-12">
                <div className="text-6xl mb-4">📋</div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">No stock movements yet</h3>
                <p className="text-gray-600">Stock movements will appear here as transactions occur.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {movements.map((movement: InventoryMovement) => (
                <Card key={movement.id}>
                  <CardContent className="pt-4">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="flex items-center space-x-2 mb-1">
                          <span className="text-lg">{getMovementIcon(movement.movement_type)}</span>
                          <span className="font-semibold">{getProductName(movement.product_id)}</span>
                          <Badge variant="outline" className="text-xs">
                            {movement.movement_type}
                          </Badge>
                        </div>
                        <div className="text-sm text-gray-600">
                          {movement.created_at.toLocaleDateString()} at{' '}
                          {movement.created_at.toLocaleTimeString()}
                        </div>
                        {movement.notes && (
                          <div className="text-sm text-gray-700 mt-1 italic">
                            "{movement.notes}"
                          </div>
                        )}
                        {movement.reference_type && (
                          <div className="text-xs text-gray-500 mt-1">
                            Ref: {movement.reference_type}#{movement.reference_id}
                          </div>
                        )}
                      </div>
                      <div className="text-right">
                        <div className={`text-lg font-bold ${getMovementColor(movement.movement_type)}`}>
                          {movement.movement_type === 'out' ? '-' : '+'}
                          {Math.abs(movement.quantity)}
                        </div>
                        <div className="text-xs text-gray-500">units</div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}