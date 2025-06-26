"use client"

import { useState, useMemo } from "react"
import { CalendarIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { format } from "date-fns"
import { api } from '@/lib/trpc/react'
import { DateRange } from "react-day-picker"

export default function SalesFunnel() {
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: undefined,
    to: undefined,
  })

  // Fetch real sales funnel data
  const { data: funnelData, isLoading } = api.dashboard.getSalesFunnelData.useQuery({
    startDate: dateRange?.from,
    endDate: dateRange?.to,
  })

  // Calculate metrics from real data
  const metrics = useMemo(() => {
    if (!funnelData) {
      return {
        totalOrders: 0,
        totalValue: 0,
        conversionRate: 0,
        avgOrderValue: 0
      }
    }

    const totalOrders = funnelData.reduce((sum, stage) => sum + stage.count, 0)
    const totalValue = funnelData.reduce((sum, stage) => sum + stage.value, 0)
    const quotationsCount = funnelData.find(stage => stage.stage === "Quotations")?.count || 0
    const invoicedCount = funnelData.find(stage => stage.stage === "Invoiced")?.count || 0
    const conversionRate = quotationsCount > 0 ? (invoicedCount / quotationsCount) * 100 : 0
    const avgOrderValue = totalOrders > 0 ? totalValue / totalOrders : 0

    return {
      totalOrders,
      totalValue,
      conversionRate,
      avgOrderValue
    }
  }, [funnelData])

  const handleDateRangeChange = (range: DateRange | undefined) => {
    setDateRange(range)
  }

  const clearDateRange = () => {
    setDateRange({ from: undefined, to: undefined })
  }

  if (isLoading) {
    return (
      <Card className="w-full">
        <CardHeader>
          <CardTitle>Sales Pipeline</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500"></div>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="w-full bg-gradient-to-br from-background to-muted/20 border-emerald-200/50 dark:border-emerald-800/50">
      <CardHeader className="pb-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <CardTitle className="text-xl font-bold bg-gradient-to-r from-emerald-600 to-emerald-500 bg-clip-text text-transparent">
            Sales Pipeline
          </CardTitle>
          
          {/* Date Range Controls */}
          <div className="flex items-center gap-2">
            <Popover>
              <PopoverTrigger asChild>
                <Button 
                  variant="outline" 
                  size="sm"
                  className="border-emerald-200 dark:border-emerald-800 hover:bg-emerald-50 dark:hover:bg-emerald-950/30"
                >
                  <CalendarIcon className="mr-2 h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                  {dateRange?.from ? (
                    dateRange.to ? (
                      <>
                        {format(dateRange.from, "LLL dd, y")} -{" "}
                        {format(dateRange.to, "LLL dd, y")}
                      </>
                    ) : (
                      format(dateRange.from, "LLL dd, y")
                    )
                  ) : (
                    <span className="text-muted-foreground">Select date range</span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="end">
                <Calendar
                  initialFocus
                  mode="range"
                  defaultMonth={dateRange?.from}
                  selected={dateRange}
                  onSelect={handleDateRangeChange}
                  numberOfMonths={2}
                />
              </PopoverContent>
            </Popover>
            
            {(dateRange?.from || dateRange?.to) && (
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={clearDateRange}
                className="text-muted-foreground hover:text-emerald-600 dark:hover:text-emerald-400"
              >
                Clear
              </Button>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Key Metrics */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="text-center p-3 rounded-lg bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200/50 dark:border-emerald-800/50">
            <div className="text-2xl font-bold text-emerald-700 dark:text-emerald-300">
              {metrics.totalOrders}
            </div>
            <div className="text-sm text-emerald-600/80 dark:text-emerald-400/80 font-medium">
              Total Orders
            </div>
          </div>
          
          <div className="text-center p-3 rounded-lg bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200/50 dark:border-emerald-800/50">
            <div className="text-2xl font-bold text-emerald-700 dark:text-emerald-300">
              €{metrics.totalValue.toLocaleString()}
            </div>
            <div className="text-sm text-emerald-600/80 dark:text-emerald-400/80 font-medium">
              Total Value
            </div>
          </div>
          
          <div className="text-center p-3 rounded-lg bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200/50 dark:border-emerald-800/50">
            <div className="text-2xl font-bold text-emerald-700 dark:text-emerald-300">
              {metrics.conversionRate.toFixed(1)}%
            </div>
            <div className="text-sm text-emerald-600/80 dark:text-emerald-400/80 font-medium">
              Conversion Rate
            </div>
          </div>
          
          <div className="text-center p-3 rounded-lg bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200/50 dark:border-emerald-800/50">
            <div className="text-2xl font-bold text-emerald-700 dark:text-emerald-300">
              €{metrics.avgOrderValue.toLocaleString()}
            </div>
            <div className="text-sm text-emerald-600/80 dark:text-emerald-400/80 font-medium">
              Avg Order Value
            </div>
          </div>
        </div>

        {/* Sales Funnel Visualization */}
        <div className="space-y-3">
          {funnelData?.map((stage) => {
            const width = funnelData.length > 0 ? (stage.value / Math.max(...funnelData.map(s => s.value))) * 100 : 0
            const minWidth = 20 // Minimum width for visibility
            const displayWidth = Math.max(width, minWidth)
            
            return (
              <div
                key={stage.stage}
                className="group relative"
              >
                <div className="flex items-center gap-4">
                  {/* Stage Label */}
                  <div className="w-32 text-sm font-medium text-foreground dark:text-foreground">
                    {stage.stage}
                  </div>
                  
                  {/* Funnel Bar */}
                  <div className="flex-1 relative">
                    <div className="h-12 bg-muted/30 dark:bg-muted/10 rounded-lg overflow-hidden relative">
                      <div
                        className="h-full rounded-lg transition-all duration-700 ease-out relative group-hover:brightness-110"
                        style={{
                          backgroundColor: stage.color,
                          width: `${displayWidth}%`,
                          background: `linear-gradient(135deg, ${stage.color}, ${stage.color}dd)`
                        }}
                      >
                        {/* Hover tooltip content */}
                        <div className="absolute inset-0 flex items-center justify-center">
                          <div className="text-white text-sm font-semibold drop-shadow-sm">
                            {stage.count} orders
                          </div>
                        </div>
                        
                        {/* Shimmer effect */}
                        <div className="absolute inset-0 opacity-0 group-hover:opacity-30 transition-opacity duration-300">
                          <div className="h-full w-full bg-gradient-to-r from-transparent via-white to-transparent transform -skew-x-12 animate-shimmer"></div>
                        </div>
                      </div>
                    </div>
                    
                    {/* Value Label */}
                    <div className="absolute right-2 top-1/2 -translate-y-1/2">
                      <Badge 
                        variant="secondary" 
                        className="bg-background/90 dark:bg-background/80 text-foreground dark:text-foreground border-emerald-200 dark:border-emerald-800 font-semibold"
                      >
                        €{stage.value.toLocaleString()}
                      </Badge>
                    </div>
                  </div>
                </div>
                
                {/* Hover Tooltip */}
                <div className="absolute left-full ml-4 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none z-10">
                  <div className="bg-popover dark:bg-popover border border-border rounded-lg shadow-lg p-3 min-w-48">
                    <div className="text-sm font-medium text-popover-foreground dark:text-popover-foreground mb-1">
                      {stage.stage}
                    </div>
                    <div className="text-xs text-muted-foreground space-y-1">
                      <div>Orders: {stage.count}</div>
                      <div>Total Value: €{stage.value.toLocaleString()}</div>
                      <div>Avg Value: €{stage.count > 0 ? (stage.value / stage.count).toLocaleString() : '0'}</div>
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        {/* Summary */}
        {funnelData && funnelData.length > 0 && (
          <div className="pt-4 border-t border-emerald-200/50 dark:border-emerald-800/50">
            <div className="text-center text-sm text-muted-foreground">
              Pipeline represents the flow from quotations through to invoiced orders
              {dateRange?.from && dateRange?.to && (
                <span className="block mt-1 text-emerald-600 dark:text-emerald-400 font-medium">
                  Filtered: {format(dateRange.from, "MMM dd")} - {format(dateRange.to, "MMM dd, yyyy")}
                </span>
              )}
            </div>
          </div>
        )}
      </CardContent>

      <style jsx>{`
        @keyframes shimmer {
          0% { transform: translateX(-100%) skewX(-12deg); }
          100% { transform: translateX(200%) skewX(-12deg); }
        }
        .animate-shimmer {
          animation: shimmer 2s infinite;
        }
      `}</style>
    </Card>
  )
} 