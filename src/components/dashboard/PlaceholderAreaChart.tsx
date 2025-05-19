"use client";

import * as React from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export function PlaceholderAreaChart() {
  return (
    <div className="aspect-[16/5] w-full rounded-lg border border-dashed border-muted-foreground/30 bg-muted/20 p-6 flex items-center justify-center">
      <p className="text-sm text-muted-foreground">Area Chart Placeholder (Revenue Trend)</p>
    </div>
  );
} 