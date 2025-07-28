'use client';

import React, { useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Calculator, TrendingUp, TrendingDown, Minus, AlertTriangle } from 'lucide-react';
import { 
  calculateMargin, 
  formatMarginPercentage, 
  formatMarginCurrency, 
  getMarginStatusColor,
  compareToCustomerAverage,
  type MarginCalculationItem 
} from '@/lib/utils/margin-calculation';
import { api } from '@/lib/trpc/react';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface MarginCalculationCardProps {
  /** Items to calculate margin for */
  items: MarginCalculationItem[];
  /** Customer ID for comparison data */
  customerId?: string;
  /** Show calculation button instead of auto-calculation */
  showCalculateButton?: boolean;
  /** Custom title for the card */
  title?: string;
  /** Additional className for the card */
  className?: string;
}

export function MarginCalculationCard({
  items,
  customerId,
  showCalculateButton = true,
  title = "Margin Analysis",
  className,
}: MarginCalculationCardProps) {
  const [isCalculated, setIsCalculated] = useState(false);
  const [marginResult, setMarginResult] = useState<ReturnType<typeof calculateMargin> | null>(null);

  // Get customer margin data for comparison (only if customerId provided)
  const { data: customerMarginData } = api.customer.getMarginData.useQuery(
    { customerId: customerId!, months: 12 },
    { enabled: !!customerId && isCalculated }
  );

  // Debounced calculation function (300ms)
  const calculateMarginDebounced = useCallback(
    React.useMemo(() => {
      let timeoutId: NodeJS.Timeout;
      return () => {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => {
          if (items && items.length > 0) {
            const result = calculateMargin(items);
            setMarginResult(result);
            setIsCalculated(true);
          }
        }, 300);
      };
    }, [items]),
    [items]
  );

  const handleCalculate = () => {
    calculateMarginDebounced();
  };

  const handleCalculateClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    handleCalculate();
  };

  // Auto-calculate if showCalculateButton is false
  React.useEffect(() => {
    if (!showCalculateButton && items && items.length > 0) {
      calculateMarginDebounced();
    }
  }, [items, showCalculateButton, calculateMarginDebounced]);

  // Check for cost data quality issues
  const costDataIssues = React.useMemo(() => {
    if (!items || items.length === 0) return [];
    
    const issues: string[] = [];
    
    items.forEach((item, index) => {
      const itemType = item.inventoryItem.itemType;
      const costPrice = item.inventoryItem.costPrice;
      
      // Check for missing cost price
      if (!costPrice || costPrice === 0) {
        issues.push(`Item ${index + 1}: Missing cost price`);
      }
      
      // Check for manufactured goods without BOM data
      if (itemType === 'MANUFACTURED_GOOD') {
        if (!item.inventoryItem.bom) {
          issues.push(`Item ${index + 1}: Manufactured good missing BOM data`);
        } else if (!item.inventoryItem.bom.items || item.inventoryItem.bom.items.length === 0) {
          issues.push(`Item ${index + 1}: BOM has no component items`);
        } else {
          // Check for missing component costs
          const missingComponentCosts = item.inventoryItem.bom.items.some(bomItem => 
            !bomItem.componentItem.costPrice || bomItem.componentItem.costPrice === 0
          );
          if (missingComponentCosts) {
            issues.push(`Item ${index + 1}: BOM components missing cost prices`);
          }
        }
      }
    });
    
    return issues;
  }, [items]);

  const hasDataIssues = costDataIssues.length > 0;

  // Calculate comparison data
  const comparisonData = React.useMemo(() => {
    if (!marginResult || !customerMarginData) return null;
    
    return compareToCustomerAverage(
      marginResult.marginPercentage,
      customerMarginData.marginPercentage
    );
  }, [marginResult, customerMarginData]);

  const hasValidItems = items && items.length > 0;

  if (!hasValidItems && !isCalculated) {
    return (
      <Card className={className}>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">{title}</CardTitle>
          <Calculator className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Add items to calculate margin
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <div className="flex items-center gap-2">
          {showCalculateButton && (
            <Button 
              size="sm" 
              variant="outline" 
              onClick={handleCalculateClick}
              disabled={!hasValidItems}
            >
              <Calculator className="h-3 w-3 mr-1" />
              Calculate
            </Button>
          )}
          <Calculator className="h-4 w-4 text-muted-foreground" />
        </div>
      </CardHeader>
      <CardContent>
        {!isCalculated || !marginResult ? (
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              {hasValidItems 
                ? `Ready to calculate margin for ${items.length} item${items.length > 1 ? 's' : ''}`
                : 'No items to calculate'
              }
            </p>
            {showCalculateButton && hasValidItems && (
              <p className="text-xs text-muted-foreground">
                Click "Calculate" to see margin analysis
              </p>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {/* Cost Data Quality Warning */}
            {hasDataIssues && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  <div className="space-y-1">
                    <p className="font-medium">Cost data incomplete - margin calculation may be inaccurate:</p>
                    <ul className="text-xs space-y-1 ml-2">
                      {costDataIssues.slice(0, 3).map((issue, index) => (
                        <li key={index}>• {issue}</li>
                      ))}
                      {costDataIssues.length > 3 && (
                        <li>• ... and {costDataIssues.length - 3} more issues</li>
                      )}
                    </ul>
                  </div>
                </AlertDescription>
              </Alert>
            )}
            
            {/* Main Margin Display */}
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-2xl font-bold">
                    {formatMarginPercentage(marginResult.marginPercentage)}
                  </span>
                  <Badge variant={getMarginStatusColor(marginResult.marginPercentage)}>
                    {marginResult.marginPercentage >= 30 ? 'Excellent' :
                     marginResult.marginPercentage >= 15 ? 'Good' :
                     marginResult.marginPercentage >= 0 ? 'Low' : 'Negative'}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  Profit margin on {marginResult.itemCount} item{marginResult.itemCount > 1 ? 's' : ''}
                </p>
              </div>
              {marginResult.marginPercentage >= 0 ? (
                <TrendingUp className="h-5 w-5 text-green-600" />
              ) : marginResult.marginPercentage < 0 ? (
                <TrendingDown className="h-5 w-5 text-red-600" />
              ) : (
                <Minus className="h-5 w-5 text-gray-400" />
              )}
            </div>

            {/* Financial Breakdown */}
            <div className="grid grid-cols-3 gap-2 text-xs">
              <div>
                <p className="text-muted-foreground">Revenue</p>
                <p className="font-medium">{formatMarginCurrency(marginResult.totalRevenue)}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Cost</p>
                <p className="font-medium">{formatMarginCurrency(marginResult.totalCost)}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Profit</p>
                <p className={`font-medium ${marginResult.totalMargin >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {formatMarginCurrency(marginResult.totalMargin)}
                </p>
              </div>
            </div>

            {/* Customer Comparison */}
            {comparisonData && (
              <div className="pt-2 border-t">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-medium">vs Customer Average</p>
                    <p className="text-xs text-muted-foreground">
                      {formatMarginPercentage(customerMarginData?.marginPercentage || 0)} 
                      {customerMarginData?.period && ` (${customerMarginData.period})`}
                    </p>
                  </div>
                  <Badge 
                    variant={comparisonData.isAboveAverage ? "default" : "secondary"}
                    className="text-xs"
                  >
                    {comparisonData.isAboveAverage ? '+' : ''}{comparisonData.difference.toFixed(1)}%
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {comparisonData.description}
                </p>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
} 