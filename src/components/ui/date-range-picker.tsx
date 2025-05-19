"use client";

import * as React from "react";
import { CalendarIcon } from "lucide-react";
import { type DateRange } from "react-day-picker";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar"; // From originui
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface DateRangePickerProps extends React.HTMLAttributes<HTMLDivElement> {
  range?: DateRange;
  onRangeChange?: (range: DateRange | undefined) => void;
  // Add other props like presets, alignment etc. as needed
}

export function DateRangePicker({
  className,
  range,
  onRangeChange,
}: DateRangePickerProps) {
  const [currentRange, setCurrentRange] = React.useState<DateRange | undefined>(range);

  React.useEffect(() => {
    setCurrentRange(range);
  }, [range]);

  const handleSelect = (selectedRange: DateRange | undefined) => {
    setCurrentRange(selectedRange);
    if (onRangeChange) {
      onRangeChange(selectedRange);
    }
  };

  return (
    <div className={cn("grid gap-2", className)}>
      <Popover>
        <PopoverTrigger asChild>
          <Button
            id="date"
            variant={"outline"}
            className={cn(
              "w-[300px] justify-start text-left font-normal",
              !currentRange && "text-muted-foreground"
            )}
          >
            <CalendarIcon className="mr-2 h-4 w-4" />
            {currentRange?.from ? (
              currentRange.to ? (
                <>
                  {currentRange.from.toLocaleDateString("default", { month: 'short', day: 'numeric' })} - {" "}
                  {currentRange.to.toLocaleDateString("default", { month: 'short', day: 'numeric' })}
                </>
              ) : (
                currentRange.from.toLocaleDateString("default", { month: 'short', day: 'numeric' })
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
            defaultMonth={currentRange?.from}
            selected={currentRange}
            onSelect={handleSelect}
            numberOfMonths={2}
            // Add presets here if needed from shadcn/originui example
          />
        </PopoverContent>
      </Popover>
    </div>
  );
} 