'use client';

import { api } from '@/lib/trpc/react';
import { useParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { QRCodeSVG } from 'qrcode.react';
import { Edit, Package, Download, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { formatCurrency } from '@/lib/utils';
import { ItemType } from '@prisma/client';
import { Skeleton } from '@/components/ui/skeleton';
import ClientOnly from '@/components/ClientOnly';

const formatItemType = (type: ItemType) => {
  switch (type) {
    case ItemType.RAW_MATERIAL:
      return "Raw Material";
    case ItemType.MANUFACTURED_GOOD:
      return "Manufactured Good";
    default:
      return type;
  }
};

export default function InventoryDetailPage() {
  const params = useParams();
  const itemId = params.id as string;

  const { data: item, isLoading, error } = api.inventory.getById.useQuery(
    { id: itemId },
    { enabled: !!itemId }
  );

  const generateQrPdfMutation = api.inventory.generateQrCodePdf.useMutation({
    onSuccess: (data) => {
      // Create download link
      const link = document.createElement('a');
      link.href = `data:application/pdf;base64,${data.pdfBase64}`;
      link.download = `qr-code-${item?.sku || itemId}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    },
  });

  const handleGenerateQrPdf = () => {
    if (item) {
      generateQrPdfMutation.mutate({ itemIds: [item.id] });
    }
  };

  if (isLoading) {
    return (
      <div className="container mx-auto py-6 space-y-6">
        <div className="flex items-center gap-4 mb-6">
          <Skeleton className="h-10 w-32" />
          <Skeleton className="h-8 w-8" />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <Card>
              <CardHeader>
                <Skeleton className="h-6 w-40" />
              </CardHeader>
              <CardContent className="space-y-4">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
              </CardContent>
            </Card>
          </div>
          <div>
            <Card>
              <CardHeader>
                <Skeleton className="h-6 w-32" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-32 w-32" />
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto py-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-red-600 mb-2">Item Not Found</h1>
          <p className="text-muted-foreground mb-4">
            The inventory item you're looking for doesn't exist or has been removed.
          </p>
          <Link href="/inventory">
            <Button>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Inventory
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  if (!item) {
    return null;
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/inventory">
            <Button variant="outline" size="sm">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Inventory
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold">{item.name}</h1>
            <p className="text-muted-foreground">SKU: {item.sku}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={handleGenerateQrPdf} disabled={generateQrPdfMutation.isPending}>
            <Download className="mr-2 h-4 w-4" />
            {generateQrPdfMutation.isPending ? 'Generating...' : 'Download QR PDF'}
          </Button>
          <Link href={`/inventory/${item.id}/edit`}>
            <Button>
              <Edit className="mr-2 h-4 w-4" />
              Edit Item
            </Button>
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Details */}
        <div className="lg:col-span-2 space-y-6">
          {/* Basic Information */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Package className="h-5 w-5" />
                Item Details
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Name</label>
                  <p className="font-medium">{item.name}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">SKU</label>
                  <p className="font-mono">{item.sku}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Type</label>
                  <Badge variant={item.itemType === ItemType.MANUFACTURED_GOOD ? "default" : "secondary"}>
                    {formatItemType(item.itemType)}
                  </Badge>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Unit of Measure</label>
                  <p>{item.unitOfMeasure}</p>
                </div>
              </div>

              {item.description && (
                <>
                  <Separator />
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Description</label>
                    <p className="mt-1">{item.description}</p>
                  </div>
                </>
              )}

              {item.inventoryCategory && (
                <>
                  <Separator />
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Category</label>
                    <Badge variant="outline" className="mt-1">
                      {item.inventoryCategory.name}
                    </Badge>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Financial Information */}
          <Card>
            <CardHeader>
              <CardTitle>Financial Details</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Cost Price</label>
                  <p className="font-semibold">{formatCurrency(Number(item.costPrice))}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Sales Price</label>
                  <p className="font-semibold">{formatCurrency(Number(item.salesPrice))}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Quantity on Hand</label>
                  <p className="font-semibold">{Number(item.quantityOnHand)} {item.unitOfMeasure}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Stock Value</label>
                  <p className="font-semibold">
                    {formatCurrency(Number(item.costPrice) * Number(item.quantityOnHand))}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Raw Material Specific Fields */}
          {item.itemType === ItemType.RAW_MATERIAL && (
            <Card>
              <CardHeader>
                <CardTitle>Procurement Details</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4">
                  {item.leadTimeDays && (
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Lead Time</label>
                      <p>{item.leadTimeDays} days</p>
                    </div>
                  )}
                  {item.vendorSku && (
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Vendor SKU</label>
                      <p className="font-mono">{item.vendorSku}</p>
                    </div>
                  )}
                  {item.vendorItemName && (
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Vendor Item Name</label>
                      <p>{item.vendorItemName}</p>
                    </div>
                  )}
                  {item.reorderLevel && (
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Reorder Level</label>
                      <p>{Number(item.reorderLevel)} {item.unitOfMeasure}</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* QR Code Section */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>QR Code</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col items-center space-y-4">
              <ClientOnly fallback={<div className="h-32 w-32 bg-muted animate-pulse rounded" />}>
                <QRCodeSVG 
                  value={item.qrIdentifier || `inventory-${item.id}`} 
                  size={128} 
                  bgColor="#ffffff" 
                  fgColor="#000000" 
                  level="Q" 
                />
              </ClientOnly>
              <div className="text-center">
                <p className="text-sm text-muted-foreground">QR Identifier</p>
                <p className="font-mono text-xs break-all">{item.qrIdentifier || `inventory-${item.id}`}</p>
              </div>
              <Button 
                onClick={handleGenerateQrPdf} 
                disabled={generateQrPdfMutation.isPending}
                size="sm"
                className="w-full"
              >
                <Download className="mr-2 h-4 w-4" />
                Download PDF
              </Button>
            </CardContent>
          </Card>

          {/* Quick Stats */}
          <Card>
            <CardHeader>
              <CardTitle>Quick Stats</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Show in Pricelist</span>
                <Badge variant={item.showInPricelist ? "default" : "secondary"}>
                  {item.showInPricelist ? "Yes" : "No"}
                </Badge>
              </div>
              {item.defaultVatRatePercent && (
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">VAT Rate</span>
                  <span className="font-medium">{Number(item.defaultVatRatePercent)}%</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Created</span>
                <span className="text-sm">{new Date(item.createdAt).toLocaleDateString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Last Updated</span>
                <span className="text-sm">{new Date(item.updatedAt).toLocaleDateString()}</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
} 