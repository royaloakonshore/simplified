"use client"

import { useState, useMemo, useEffect, useCallback } from "react"
import { CalendarIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { format } from "date-fns"
import { api } from '@/lib/trpc/react'
import { DateRange } from "react-day-picker"
import { cn } from "@/lib/utils"

interface SalesFunnelProps {
  /**
   * Optional externally-controlled start date. If provided together with `endDate`,
   * the component will bypass its own date-picker controls and use these dates
   * directly (reacting instantly to changes without the internal debounce logic).
   */
  startDate?: Date;
  /** See `startDate` */
  endDate?: Date;
  /**
   * When true, the component will omit its built-in date-picker UI. Use this
   * when the surrounding page already offers a global date selector (dashboard).
   */
  disableControls?: boolean;
}

export default function SalesFunnel({ startDate, endDate, disableControls = false }: SalesFunnelProps = {}) {
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: startDate,
    to: endDate,
  })

  // Separate state for the actual query dates (only updated when we have a complete range)
  const [queryDateRange, setQueryDateRange] = useState<DateRange | undefined>({
    from: startDate,
    to: endDate,
  })

  const [hoveredStage, setHoveredStage] = useState<{
    stage: string
    value: number
    count: number
    x: number
    y: number
  } | null>(null)

  // Debounce function to delay API calls
  const debounceQuery = useCallback(
    (range: DateRange | undefined) => {
      const timeoutId = setTimeout(() => {
        setQueryDateRange(range)
      }, 500) // 500ms delay

      return () => clearTimeout(timeoutId)
    },
    []
  )

  // When controls are enabled, debounce internal selection. When disabled,
  // rely entirely on external props which are assumed to be stable.
  useEffect(() => {
    if (disableControls) {
      // Keep query dates in sync with external props
      setQueryDateRange({ from: startDate, to: endDate })
      return
    }

    if (!dateRange?.from && !dateRange?.to) {
      setQueryDateRange({ from: undefined, to: undefined })
      return
    }

    if (dateRange?.from && dateRange?.to) {
      const cleanup = debounceQuery(dateRange)
      return cleanup
    }
  }, [disableControls, startDate, endDate, dateRange, debounceQuery])

  // Fetch real sales funnel data using queryDateRange
  const { data: funnelData, isLoading } = api.dashboard.getSalesFunnelData.useQuery({
    startDate: queryDateRange?.from,
    endDate: queryDateRange?.to,
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

  // Helper: format currency without decimals (for compact dashboard view)
  const formatCurrencyNoDecimals = (amount: number) =>
    `€${Math.round(amount).toLocaleString("fi-FI")}`

  const handleDateRangeChange = (range: DateRange | undefined) => {
    setDateRange(range)
  }

  const clearDateRange = () => {
    setDateRange({ from: undefined, to: undefined })
    setQueryDateRange({ from: undefined, to: undefined })
  }

  if (isLoading) {
    return (
      <Card className="w-full">
        <CardHeader>
          <CardTitle>Sales Pipeline</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-foreground"></div>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="relative">
      <Card className="w-full bg-gradient-to-br from-background to-muted/20">
        <CardHeader className="pb-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <CardTitle className="text-xl font-bold text-foreground">
              Sales Pipeline
            </CardTitle>
          
            {/* Date Range Controls (hidden when external controls used) */}
            {!disableControls && (
              <div className="flex items-center gap-2">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button 
                      variant="outline" 
                      size="sm"
                      className="hover:bg-muted/50"
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
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
                    className="text-muted-foreground hover:text-foreground"
                  >
                    Clear
                  </Button>
                )}
              </div>
            )}
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Key Metrics */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="text-center p-3 rounded-lg bg-background border">
              <div className={cn(disableControls ? "text-xl" : "text-2xl", "font-bold text-foreground")}> 
                {metrics.totalOrders}
              </div>
              <div className="text-sm text-muted-foreground font-medium">
                Total Orders
              </div>
            </div>
            
            <div className="text-center p-3 rounded-lg bg-background border">
              <div className={cn(disableControls ? "text-xl" : "text-2xl", "font-bold text-foreground")}> 
                {disableControls ? formatCurrencyNoDecimals(metrics.totalValue) : `€${metrics.totalValue.toLocaleString()}`}
              </div>
              <div className="text-sm text-muted-foreground font-medium">
                Total Value
              </div>
            </div>
            
            <div className="text-center p-3 rounded-lg bg-background border">
              <div className={cn(disableControls ? "text-xl" : "text-2xl", "font-bold text-foreground")}> 
                {metrics.conversionRate.toFixed(1)}%
              </div>
              <div className="text-sm text-muted-foreground font-medium">
                Conversion Rate
              </div>
            </div>
            
            <div className="text-center p-3 rounded-lg bg-background border">
              <div className={cn(disableControls ? "text-xl" : "text-2xl", "font-bold text-foreground")}> 
                {disableControls ? formatCurrencyNoDecimals(metrics.avgOrderValue) : `€${metrics.avgOrderValue.toLocaleString()}`}
              </div>
              <div className="text-sm text-muted-foreground font-medium">
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
                    <div className="w-32 text-sm font-medium text-foreground">
                      {stage.stage}
                    </div>
                    
                    {/* Funnel Bar */}
                    <div className="flex-1 relative">
                      <div className="h-12 bg-muted/30 dark:bg-muted/10 rounded-lg overflow-hidden relative">
                        <div
                          className="h-full rounded-lg transition-all duration-700 ease-out relative group-hover:brightness-110 cursor-pointer"
                          style={{
                            backgroundColor: stage.color,
                            width: `${displayWidth}%`,
                            background: `linear-gradient(135deg, ${stage.color}, ${stage.color}dd)`
                          }}
                          onMouseMove={(e) => {
                            setHoveredStage({
                              stage: stage.stage,
                              value: stage.value,
                              count: stage.count,
                              x: e.clientX,
                              y: e.clientY
                            })
                          }}
                          onMouseLeave={() => setHoveredStage(null)}
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
                          className="bg-background/90 text-foreground border font-semibold"
                        >
                          €{stage.value.toLocaleString()}
                        </Badge>
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Summary */}
          {funnelData && funnelData.length > 0 && (
            <div className="pt-4 border-t">
              <div className="text-center text-sm text-muted-foreground">
                Pipeline represents the flow from quotations through to invoiced orders
                {dateRange?.from && dateRange?.to && (
                  <span className="block mt-1 text-foreground font-medium">
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

      {/* Cursor-following Tooltip */}
      {hoveredStage && (
        <div 
          className="fixed bg-popover border border-border rounded-lg shadow-lg p-3 min-w-48 pointer-events-none z-50"
          style={{
            left: `${hoveredStage.x + 15}px`,
            top: `${hoveredStage.y - 60}px`,
          }}
        >
          <div className="text-sm font-medium text-popover-foreground mb-1">
            {hoveredStage.stage}
          </div>
          <div className="text-xs text-muted-foreground space-y-1">
            <div>Orders: {hoveredStage.count}</div>
            <div>Total Value: €{hoveredStage.value.toLocaleString()}</div>
            <div>Avg Value: €{hoveredStage.count > 0 ? (hoveredStage.value / hoveredStage.count).toLocaleString() : '0'}</div>
          </div>
        </div>
      )}
    </div>
  )
} 