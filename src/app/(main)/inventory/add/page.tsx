'use client';

import * as React from "react";
import { InventoryItemForm } from "@/components/inventory/InventoryItemForm";

export default function AddInventoryItemPage() {
  return (
    <div className="container mx-auto py-10">
      <h1 className="text-2xl font-bold mb-4">Add New Inventory Item</h1>
      <InventoryItemForm />
    </div>
  );
} 