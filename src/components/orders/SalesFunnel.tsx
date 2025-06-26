"use client"

import { useState } from "react"
import { CalendarIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { format } from "date-fns"

// Sample funnel data with dates
const rawFunnelData = [
  { stage: "Quotations", value: 45000, count: 3, date: "2024-01-15", color: "#6b7280" },
  { stage: "Quotations", value: 78000, count: 5, date: "2024-01-14", color: "#6b7280" },
  { stage: "Quotations", value: 67000, count: 4, date: "2024-01-10", color: "#6b7280" },
  { stage: "Quotations", value: 89000, count: 6, date: "2024-01-08", color: "#6b7280" },
  { stage: "Quotations", value: 123000, count: 8, date: "2024-01-05", color: "#6b7280" },
  { stage: "Work Orders", value: 56000, count: 2, date: "2024-01-12", color: "#9ca3af" },
  { stage: "Work Orders", value: 89000, count: 4, date: "2024-01-09", color: "#9ca3af" },
  { stage: "Work Orders", value: 67000, count: 3, date: "2024-01-07", color: "#9ca3af" },
  { stage: "Work Orders", value: 78000, count: 3, date: "2024-01-04", color: "#9ca3af" },
  { stage: "In Production", value: 34000, count: 2, date: "2024-01-11", color: "#d1d5db" },
  { stage: "In Production", value: 45000, count: 2, date: "2024-01-06", color: "#d1d5db" },
  { stage: "In Production", value: 56000, count: 3, date: "2024-01-03", color: "#d1d5db" },
  { stage: "Invoiced", value: 23000, count: 1, date: "2024-01-13", color: "#374151" },
  { stage: "Invoiced", value: 34000, count: 1, date: "2024-01-08", color: "#374151" },
  { stage: "Invoiced", value: 45000, count: 2, date: "2024-01-02", color: "#374151" },
]

export function SalesFunnel() {
  const [hoveredStage, setHoveredStage] = useState<string | null>(null)
  const [dateRange, setDateRange] = useState<{
    from: Date | undefined
    to?: Date | undefined
  }>({
    from: undefined,
    to: undefined,
  })

  // Filter and aggregate data based on date range
  const filteredData = rawFunnelData.filter((item) => {
    const itemDate = new Date(item.date)
    if (!dateRange.from || !dateRange.to) return true
    return itemDate >= dateRange.from && itemDate <= dateRange.to
  })

  // Aggregate filtered data by stage
  const funnelData = ["Quotations", "Work Orders", "In Production", "Invoiced"].map((stage) => {
    const stageData = filteredData.filter((item) => item.stage === stage)
    const totalValue = stageData.reduce((sum, item) => sum + item.value, 0)
    const totalCount = stageData.reduce((sum, item) => sum + item.count, 0)
    const color = stageData[0]?.color || "#6b7280"

    return {
      stage,
      value: totalValue,
      count: totalCount,
      color,
    }
  })

  const maxValue = Math.max(...funnelData.map((d) => d.value))

  return (
    <Card>
      <CardHeader className="pb-4">
        <CardTitle className="text-lg font-semibold text-gray-900">Sales Pipeline Overview</CardTitle>
      </CardHeader>
      <CardContent>
        {/* Date Range Filter */}
        <div className="flex items-center gap-4 mb-6 pb-4 border-b border-gray-100">
          <div className="text-sm font-medium text-gray-700">Filter by date range:</div>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="w-[280px] justify-start text-left font-normal">
                <CalendarIcon className="mr-2 h-4 w-4" />
                {dateRange?.from ? (
                  dateRange.to ? (
                    <>
                      {format(dateRange.from, "LLL dd, y")} - {format(dateRange.to, "LLL dd, y")}
                    </>
                  ) : (
                    format(dateRange.from, "LLL dd, y")
                  )
                ) : (
                  <span>Pick a date range</span>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                initialFocus
                mode="range"
                defaultMonth={dateRange?.from}
                selected={dateRange}
                onSelect={(range) => setDateRange(range || { from: undefined, to: undefined })}
                numberOfMonths={2}
              />
            </PopoverContent>
          </Popover>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setDateRange({ from: undefined, to: undefined })}
            className="text-gray-500 hover:text-gray-700"
          >
            Clear
          </Button>
        </div>

        <div className="relative">
          {/* Funnel visualization */}
          <div className="flex flex-col gap-2 mb-6">
            {funnelData.map((stage, index) => {
              const widthPercentage = maxValue > 0 ? (stage.value / maxValue) * 100 : 0
              const isHovered = hoveredStage === stage.stage

              return (
                <div
                  key={stage.stage}
                  className="relative group cursor-pointer"
                  onMouseEnter={() => setHoveredStage(stage.stage)}
                  onMouseLeave={() => setHoveredStage(null)}
                >
                  {/* Funnel segment */}
                  <div
                    className={`h-14 rounded-sm transition-all duration-200 flex items-center justify-between px-6 ${
                      isHovered ? "shadow-md" : ""
                    }`}
                    style={{
                      backgroundColor: stage.color,
                      width: `${widthPercentage}%`,
                      minWidth: "240px",
                    }}
                  >
                    <div className="text-white font-medium text-sm tracking-wide">{stage.stage}</div>
                    <div className="text-white/90 text-xs font-normal">{stage.count} orders</div>
                  </div>

                  {/* Value label */}
                  <div className="ml-6 text-sm font-medium text-gray-600">${(stage.value / 1000).toFixed(0)}K</div>

                  {/* Hover tooltip */}
                  {isHovered && (
                    <div className="absolute top-full left-6 mt-3 bg-gray-900 text-white px-4 py-3 rounded-md text-xs z-10 shadow-lg border border-gray-800">
                      <div className="font-medium text-sm mb-1">{stage.stage}</div>
                      <div className="text-gray-300">Value: ${stage.value.toLocaleString()}</div>
                      <div className="text-gray-300">Orders: {stage.count}</div>
                      <div className="text-gray-300">
                        Avg: ${stage.value > 0 && stage.count > 0 ? Math.round(stage.value / stage.count).toLocaleString() : '0'}
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {/* Summary metrics */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 pt-6 border-t border-gray-100">
            <div className="text-center">
              <div className="text-2xl font-semibold text-gray-900 mb-1">
                {funnelData.reduce((sum, stage) => sum + stage.count, 0)}
              </div>
              <div className="text-xs font-medium text-gray-500 uppercase tracking-wide">Total Orders</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-semibold text-gray-900 mb-1">
                ${(funnelData.reduce((sum, stage) => sum + stage.value, 0) / 1000000).toFixed(1)}M
              </div>
              <div className="text-xs font-medium text-gray-500 uppercase tracking-wide">Total Value</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-semibold text-gray-900 mb-1">
                {funnelData[0]?.count > 0 ? Math.round((funnelData[3]?.count / funnelData[0]?.count) * 100) : 0}%
              </div>
              <div className="text-xs font-medium text-gray-500 uppercase tracking-wide">Conversion Rate</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-semibold text-gray-900 mb-1">
                $
                {funnelData.reduce((sum, stage) => sum + stage.count, 0) > 0 
                  ? Math.round(
                      funnelData.reduce((sum, stage) => sum + stage.value, 0) /
                        funnelData.reduce((sum, stage) => sum + stage.count, 0) /
                        1000,
                    )
                  : 0
                }
                K
              </div>
              <div className="text-xs font-medium text-gray-500 uppercase tracking-wide">Avg Order Value</div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
} 