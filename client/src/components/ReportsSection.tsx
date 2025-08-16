import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { trpc } from '@/utils/trpc';
import type { SalesReport, InventoryReport, ReportPeriod } from '../../../server/src/schema';

export function ReportsSection() {
  const [salesReport, setSalesReport] = useState<SalesReport | null>(null);
  const [inventoryReport, setInventoryReport] = useState<InventoryReport | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [reportPeriod, setReportPeriod] = useState<ReportPeriod>({
    start_date: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
    end_date: new Date().toISOString().split('T')[0]
  });

  const loadReports = useCallback(async () => {
    setIsLoading(true);
    try {
      const [salesData, inventoryData] = await Promise.all([
        trpc.generateSalesReport.query(reportPeriod),
        trpc.generateInventoryReport.query()
      ]);
      
      setSalesReport(salesData);
      setInventoryReport(inventoryData);
    } catch (error) {
      console.error('Failed to load reports:', error);
      alert('Failed to load reports. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, [reportPeriod]);

  useEffect(() => {
    loadReports();
  }, []);

  const handleGenerateReport = () => {
    loadReports();
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-3xl font-bold text-gray-900">📈 Business Reports</h2>
        <div className="flex space-x-4 items-center">
          <div className="flex space-x-2">
            <Input
              type="date"
              value={reportPeriod.start_date}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                setReportPeriod(prev => ({ ...prev, start_date: e.target.value }))
              }
              className="w-auto"
            />
            <span className="self-center text-gray-500">to</span>
            <Input
              type="date"
              value={reportPeriod.end_date}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                setReportPeriod(prev => ({ ...prev, end_date: e.target.value }))
              }
              className="w-auto"
            />
          </div>
          <Button onClick={handleGenerateReport} disabled={isLoading}>
            {isLoading ? '⏳ Generating...' : '📊 Generate Reports'}
          </Button>
        </div>
      </div>

      <Tabs defaultValue="sales" className="space-y-4">
        <TabsList>
          <TabsTrigger value="sales">💰 Sales Report</TabsTrigger>
          <TabsTrigger value="inventory">📦 Inventory Report</TabsTrigger>
          <TabsTrigger value="summary">📋 Business Summary</TabsTrigger>
        </TabsList>

        <TabsContent value="sales">
          {!salesReport ? (
            <Card>
              <CardContent className="text-center py-12">
                <div className="text-6xl mb-4">📊</div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">Generate Sales Report</h3>
                <p className="text-gray-600">Click "Generate Reports" to view sales data for the selected period.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-6">
              {/* Sales Overview */}
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center">
                      <div className="p-2 bg-blue-100 rounded-lg mr-3">
                        <span className="text-2xl">🛒</span>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-600">Total Transactions</p>
                        <p className="text-2xl font-bold text-blue-600">{salesReport.total_transactions}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center">
                      <div className="p-2 bg-green-100 rounded-lg mr-3">
                        <span className="text-2xl">💰</span>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-600">Total Revenue</p>
                        <p className="text-2xl font-bold text-green-600">
                          {formatCurrency(salesReport.total_revenue)}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center">
                      <div className="p-2 bg-orange-100 rounded-lg mr-3">
                        <span className="text-2xl">🏷️</span>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-600">Total Discounts</p>
                        <p className="text-2xl font-bold text-orange-600">
                          {formatCurrency(salesReport.total_discount)}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center">
                      <div className="p-2 bg-purple-100 rounded-lg mr-3">
                        <span className="text-2xl">📊</span>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-600">Avg Transaction</p>
                        <p className="text-2xl font-bold text-purple-600">
                          {salesReport.total_transactions > 0 
                            ? formatCurrency(salesReport.total_revenue / salesReport.total_transactions)
                            : '$0.00'
                          }
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Top Products */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-xl">🏆 Top Selling Products</CardTitle>
                </CardHeader>
                <CardContent>
                  {salesReport.top_products.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                      <div className="text-4xl mb-2">📭</div>
                      <p>No products sold in this period</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {salesReport.top_products.map((product, index) => (
                        <div key={product.product_id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                          <div className="flex items-center space-x-3">
                            <Badge variant="outline" className="text-xs">
                              #{index + 1}
                            </Badge>
                            <div>
                              <div className="font-semibold">{product.product_name}</div>
                              <div className="text-sm text-gray-600">
                                {product.quantity_sold} units sold
                              </div>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="font-bold text-green-600">
                              {formatCurrency(product.revenue)}
                            </div>
                            <div className="text-xs text-gray-500">
                              {formatCurrency(product.revenue / product.quantity_sold)} per unit
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              <Alert className="border-blue-200 bg-blue-50">
                <AlertDescription className="flex items-center">
                  <span className="mr-2">📅</span>
                  <span>
                    Report Period: {formatDate(reportPeriod.start_date)} - {formatDate(reportPeriod.end_date)}
                  </span>
                </AlertDescription>
              </Alert>
            </div>
          )}
        </TabsContent>

        <TabsContent value="inventory">
          {!inventoryReport ? (
            <Card>
              <CardContent className="text-center py-12">
                <div className="text-6xl mb-4">📦</div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">Generate Inventory Report</h3>
                <p className="text-gray-600">Click "Generate Reports" to view current inventory status.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-6">
              {/* Inventory Overview */}
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center">
                      <div className="p-2 bg-blue-100 rounded-lg mr-3">
                        <span className="text-2xl">📦</span>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-600">Total Products</p>
                        <p className="text-2xl font-bold text-blue-600">{inventoryReport.total_products}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center">
                      <div className="p-2 bg-green-100 rounded-lg mr-3">
                        <span className="text-2xl">💎</span>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-600">Inventory Value</p>
                        <p className="text-2xl font-bold text-green-600">
                          {formatCurrency(inventoryReport.total_inventory_value)}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center">
                      <div className="p-2 bg-orange-100 rounded-lg mr-3">
                        <span className="text-2xl">⚠️</span>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-600">Low Stock Items</p>
                        <p className="text-2xl font-bold text-orange-600">
                          {inventoryReport.low_stock_products.length}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center">
                      <div className="p-2 bg-red-100 rounded-lg mr-3">
                        <span className="text-2xl">❌</span>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-600">Out of Stock</p>
                        <p className="text-2xl font-bold text-red-600">
                          {inventoryReport.out_of_stock_products.length}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Low Stock Alert */}
              {inventoryReport.low_stock_products.length > 0 && (
                <Card className="border-orange-200">
                  <CardHeader>
                    <CardTitle className="text-xl text-orange-700">⚠️ Low Stock Alert</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {inventoryReport.low_stock_products.map((product) => (
                        <div key={product.product_id} className="flex justify-between items-center p-2 bg-orange-50 rounded">
                          <div>
                            <div className="font-semibold">{product.product_name}</div>
                            <div className="text-sm text-gray-600">
                              Min level: {product.min_stock_level} units
                            </div>
                          </div>
                          <Badge variant="secondary">
                            {product.current_stock} left
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Out of Stock */}
              {inventoryReport.out_of_stock_products.length > 0 && (
                <Card className="border-red-200">
                  <CardHeader>
                    <CardTitle className="text-xl text-red-700">❌ Out of Stock</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {inventoryReport.out_of_stock_products.map((product) => (
                        <div key={product.product_id} className="flex justify-between items-center p-2 bg-red-50 rounded">
                          <div className="font-semibold">{product.product_name}</div>
                          <Badge variant="destructive">
                            Out of Stock
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </TabsContent>

        <TabsContent value="summary">
          <Card>
            <CardHeader>
              <CardTitle className="text-xl">📋 Business Summary</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-6 md:grid-cols-2">
                <div>
                  <h3 className="text-lg font-semibold mb-3">💰 Sales Performance</h3>
                  {salesReport ? (
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span>Total Revenue:</span>
                        <span className="font-semibold text-green-600">
                          {formatCurrency(salesReport.total_revenue)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>Total Transactions:</span>
                        <span className="font-semibold">{salesReport.total_transactions}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Average Order Value:</span>
                        <span className="font-semibold">
                          {salesReport.total_transactions > 0
                            ? formatCurrency(salesReport.total_revenue / salesReport.total_transactions)
                            : '$0.00'
                          }
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>Total Discounts Given:</span>
                        <span className="font-semibold text-orange-600">
                          {formatCurrency(salesReport.total_discount)}
                        </span>
                      </div>
                    </div>
                  ) : (
                    <p className="text-gray-500">Generate reports to view sales data</p>
                  )}
                </div>

                <div>
                  <h3 className="text-lg font-semibold mb-3">📦 Inventory Status</h3>
                  {inventoryReport ? (
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span>Total Products:</span>
                        <span className="font-semibold">{inventoryReport.total_products}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Inventory Value:</span>
                        <span className="font-semibold text-green-600">
                          {formatCurrency(inventoryReport.total_inventory_value)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>Low Stock Items:</span>
                        <span className={`font-semibold ${
                          inventoryReport.low_stock_products.length > 0 ? 'text-orange-600' : 'text-green-600'
                        }`}>
                          {inventoryReport.low_stock_products.length}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>Out of Stock Items:</span>
                        <span className={`font-semibold ${
                          inventoryReport.out_of_stock_products.length > 0 ? 'text-red-600' : 'text-green-600'
                        }`}>
                          {inventoryReport.out_of_stock_products.length}
                        </span>
                      </div>
                    </div>
                  ) : (
                    <p className="text-gray-500">Generate reports to view inventory data</p>
                  )}
                </div>
              </div>

              <div className="mt-6 p-4 bg-blue-50 rounded-lg">
                <h3 className="text-lg font-semibold mb-2">💡 Quick Insights</h3>
                <div className="space-y-1 text-sm">
                  {salesReport && inventoryReport ? (
                    <>
                      <p>• You have {inventoryReport.total_products} products in your catalog</p>
                      <p>• Your inventory is worth {formatCurrency(inventoryReport.total_inventory_value)}</p>
                      <p>• You've made {salesReport.total_transactions} sales generating {formatCurrency(salesReport.total_revenue)} in revenue</p>
                      {inventoryReport.low_stock_products.length > 0 && (
                        <p className="text-orange-700">• ⚠️ {inventoryReport.low_stock_products.length} products need restocking</p>
                      )}
                      {inventoryReport.out_of_stock_products.length > 0 && (
                        <p className="text-red-700">• ❌ {inventoryReport.out_of_stock_products.length} products are out of stock</p>
                      )}
                    </>
                  ) : (
                    <p className="text-gray-600">Generate reports to see insights about your business</p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}