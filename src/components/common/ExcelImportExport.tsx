'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Download, Upload, FileSpreadsheet, AlertCircle, CheckCircle, AlertTriangle, Eye, Save, ChevronDown, ChevronUp } from 'lucide-react';
import { toast } from 'react-toastify';
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogHeader, 
  DialogTitle,
  DialogFooter 
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Checkbox } from '@/components/ui/checkbox';
import { api } from '@/lib/trpc/react';

interface ExcelImportExportProps {
  title: string;
  description?: string;
  exportEndpoint: string;
  exportFileName: string;
  onImportSuccess?: () => void;
  allowImport?: boolean;
  showPreview?: boolean; // New prop for enhanced import functionality
}

interface ImportPreview {
  newItems: any[];
  updateItems: Array<{
    sku: string;
    existingData: any;
    newData: any;
    changes: Record<string, { old: any; new: any }>;
  }>;
  errors: Array<{
    row: number;
    field: string;
    message: string;
    severity: 'error' | 'warning';
  }>;
  summary: {
    totalRows: number;
    newItemCount: number;
    updateItemCount: number;
    errorCount: number;
    warningCount: number;
  };
}

export function ExcelImportExport({
  title,
  description,
  exportEndpoint,
  exportFileName,
  onImportSuccess,
  allowImport = false,
  showPreview = false
}: ExcelImportExportProps) {
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [isCollapsed, setIsCollapsed] = useState(true);
  const [showPreviewDialog, setShowPreviewDialog] = useState(false);
  const [importPreview, setImportPreview] = useState<ImportPreview | null>(null);
  const [confirmImport, setConfirmImport] = useState(false);
  const [fileData, setFileData] = useState<string>('');

  // Enhanced tRPC mutations for preview and apply
  const previewImport = api.inventory.previewExcelImport.useMutation();
  const applyImport = api.inventory.applyExcelImport.useMutation();

  const handleExport = async () => {
    try {
      setIsExporting(true);
      
      const response = await fetch(exportEndpoint, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Export failed');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = exportFileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      toast.success('Export completed successfully!');
    } catch (error) {
      console.error('Export error:', error);
      toast.error('Export failed. Please try again.');
    } finally {
      setIsExporting(false);
    }
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setImportFile(file);
      setImportError(null);
    }
  };

  const handlePreviewImport = async () => {
    if (!importFile) {
      setImportError('Please select a file first');
      return;
    }

    if (!showPreview) {
      // Legacy import mode
      handleLegacyImport();
      return;
    }

    try {
      setIsImporting(true);
      setImportError(null);

      // Convert file to base64
      const base64Data = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const arrayBuffer = reader.result as ArrayBuffer;
          const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));
          resolve(base64);
        };
        reader.onerror = reject;
        reader.readAsArrayBuffer(importFile);
      });

      setFileData(base64Data);

      // Get preview from server
      const result = await previewImport.mutateAsync({
        fileData: base64Data,
      });

      if (result.success && result.preview) {
        setImportPreview(result.preview);
        setShowPreviewDialog(true);
      }
    } catch (error: any) {
      setImportError(error.message || 'Failed to process file');
      toast.error('Failed to preview import');
    } finally {
      setIsImporting(false);
    }
  };

  const handleApplyImport = async () => {
    if (!importPreview || !fileData) {
      toast.error('No import preview available');
      return;
    }

    if (!confirmImport) {
      toast.error('Please confirm that you want to apply these changes');
      return;
    }

    try {
      setIsImporting(true);

      const result = await applyImport.mutateAsync({
        fileData: fileData,
        preview: importPreview,
        confirmed: true,
      });

      if (result.success) {
        toast.success(result.message || 'Import completed successfully!');
        setShowPreviewDialog(false);
        setImportFile(null);
        setImportPreview(null);
        setConfirmImport(false);
        onImportSuccess?.();
        
        // Reset file input
        const fileInput = document.getElementById('excel-import') as HTMLInputElement;
        if (fileInput) fileInput.value = '';
      }
    } catch (error: any) {
      toast.error(error.message || 'Import failed');
    } finally {
      setIsImporting(false);
    }
  };

  const handleLegacyImport = async () => {
    // Legacy import implementation for backward compatibility
    if (!importFile) {
      setImportError('Please select a file first');
      return;
    }

    try {
      setIsImporting(true);
      setImportError(null);

      const formData = new FormData();
      formData.append('file', importFile);

      const response = await fetch('/api/excel/import/inventory', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Import failed');
      }

      const result = await response.json();
      toast.success('Import completed successfully!');
      onImportSuccess?.();
      
      // Reset form
      setImportFile(null);
      const fileInput = document.getElementById('excel-import') as HTMLInputElement;
      if (fileInput) fileInput.value = '';
    } catch (error: any) {
      setImportError(error.message || 'Import failed');
      toast.error('Import failed. Please check your file and try again.');
    } finally {
      setIsImporting(false);
    }
  };

  const getChangeLabel = (field: string): string => {
    const fieldLabels: Record<string, string> = {
      name: 'Name',
      description: 'Description',
      costPrice: 'Cost Price',
      salesPrice: 'Sales Price',
      quantityOnHand: 'Quantity',
      reorderLevel: 'Reorder Level',
      leadTimeDays: 'Lead Time (Days)',
      vendorSku: 'Vendor SKU',
      vendorItemName: 'Vendor Item Name',
      minimumStockLevel: 'Minimum Stock',
      itemType: 'Item Type',
      showInPricelist: 'Show in Pricelist',
      category: 'Category',
    };
    return fieldLabels[field] || field;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5" />
            {title}
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="h-8 w-8 p-0"
          >
            {isCollapsed ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronUp className="h-4 w-4" />
            )}
          </Button>
        </CardTitle>
        {description && !isCollapsed && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      {!isCollapsed && (
        <CardContent className="space-y-4">
        {/* Export Section */}
        <div className="space-y-2">
          <Label className="text-sm font-medium">Export Data</Label>
          <Button
            onClick={handleExport}
            disabled={isExporting}
            className="w-full"
            variant="outline"
          >
            <Download className="h-4 w-4 mr-2" />
            {isExporting ? 'Exporting...' : `Export ${exportFileName}`}
          </Button>
        </div>

        {allowImport && (
          <>
            <Separator />
            
            {/* Import Section */}
            <div className="space-y-4">
              <Label className="text-sm font-medium">Import Data</Label>
              
              {importError && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{importError}</AlertDescription>
                </Alert>
              )}

              <div className="space-y-2">
                <Label htmlFor="excel-import" className="text-sm font-medium">
                  Select Excel File
                </Label>
                <Input
                  id="excel-import"
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={handleFileSelect}
                  className="cursor-pointer"
                />
              </div>

              {importFile && (
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">
                    Selected: {importFile.name}
                  </p>
                  <Button
                    onClick={handlePreviewImport}
                    disabled={isImporting}
                    className="w-full"
                  >
                    {showPreview ? (
                      <>
                        <Eye className="h-4 w-4 mr-2" />
                        {isImporting ? 'Processing...' : 'Preview Import'}
                      </>
                    ) : (
                      <>
                        <Upload className="h-4 w-4 mr-2" />
                        {isImporting ? 'Importing...' : 'Import Data'}
                      </>
                    )}
                  </Button>
                </div>
              )}
            </div>
          </>
        )}
      </CardContent>
      )}

      {/* Enhanced Import Preview Dialog */}
      <Dialog open={showPreviewDialog} onOpenChange={setShowPreviewDialog}>
        <DialogContent className="max-w-6xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>Import Preview - Conservative Validation</DialogTitle>
            <DialogDescription>
              Review all changes before applying. Only confirmed items will be imported.
            </DialogDescription>
          </DialogHeader>

          {importPreview && (
            <ScrollArea className="max-h-[70vh]">
              <div className="space-y-6">
                {/* Summary */}
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-4 gap-4">
                  <Card>
                    <CardContent className="p-4">
                      <div className="text-2xl font-bold text-green-600">
                        {importPreview.summary.newItemCount}
                      </div>
                      <p className="text-xs text-muted-foreground">New Items</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-4">
                      <div className="text-2xl font-bold text-blue-600">
                        {importPreview.summary.updateItemCount}
                      </div>
                      <p className="text-xs text-muted-foreground">Updates</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-4">
                      <div className="text-2xl font-bold text-red-600">
                        {importPreview.summary.errorCount}
                      </div>
                      <p className="text-xs text-muted-foreground">Errors</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-4">
                      <div className="text-2xl font-bold text-yellow-600">
                        {importPreview.summary.warningCount}
                      </div>
                      <p className="text-xs text-muted-foreground">Warnings</p>
                    </CardContent>
                  </Card>
                </div>

                {/* Errors and Warnings */}
                {importPreview.errors.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="font-semibold">Issues Found</h4>
                    <div className="space-y-1 max-h-40 overflow-y-auto">
                      {importPreview.errors.map((error, index) => (
                        <Alert 
                          key={index} 
                          variant={error.severity === 'error' ? 'destructive' : 'default'}
                        >
                          {error.severity === 'error' ? (
                            <AlertCircle className="h-4 w-4" />
                          ) : (
                            <AlertTriangle className="h-4 w-4" />
                          )}
                          <AlertDescription>
                            <span className="font-medium">Row {error.row}:</span> {error.message}
                          </AlertDescription>
                        </Alert>
                      ))}
                    </div>
                  </div>
                )}

                {/* New Items */}
                {importPreview.newItems.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="font-semibold flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-green-600" />
                      New Items ({importPreview.newItems.length})
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                      {importPreview.newItems.slice(0, 15).map((item, index) => (
                        <Card key={index} className="p-3">
                          <div className="text-sm">
                            <p className="font-medium">{item.name}</p>
                            {item.sku && <p className="text-muted-foreground">SKU: {item.sku}</p>}
                            <p className="text-muted-foreground">
                              Price: €{item.salesPrice} | Qty: {item.quantityOnHand || 0}
                            </p>
                          </div>
                        </Card>
                      ))}
                      {importPreview.newItems.length > 15 && (
                        <p className="text-sm text-muted-foreground col-span-full">
                          ... and {importPreview.newItems.length - 15} more items
                        </p>
                      )}
                    </div>
                  </div>
                )}

                {/* Updates */}
                {importPreview.updateItems.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="font-semibold flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 text-blue-600" />
                      Updates ({importPreview.updateItems.length})
                    </h4>
                    <div className="space-y-3">
                      {importPreview.updateItems.slice(0, 8).map((item, index) => (
                        <Card key={index} className="p-3">
                          <div className="space-y-2">
                            <p className="font-medium">
                              {item.newData.name} {item.sku && `(${item.sku})`}
                            </p>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 text-sm">
                              {Object.entries(item.changes).map(([field, change]) => (
                                <div key={field} className="flex justify-between">
                                  <span className="text-muted-foreground">
                                    {getChangeLabel(field)}:
                                  </span>
                                  <span>
                                    <span className="line-through text-red-600">
                                      {String(change.old)}
                                    </span>
                                    {' → '}
                                    <span className="text-green-600">
                                      {String(change.new)}
                                    </span>
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        </Card>
                      ))}
                      {importPreview.updateItems.length > 8 && (
                        <p className="text-sm text-muted-foreground">
                          ... and {importPreview.updateItems.length - 8} more updates
                        </p>
                      )}
                    </div>
                  </div>
                )}

                {/* Confirmation */}
                {importPreview.summary.errorCount === 0 && (
                  <div className="space-y-4">
                    <Separator />
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="confirm-import"
                        checked={confirmImport}
                        onCheckedChange={(checked) => setConfirmImport(checked as boolean)}
                      />
                      <Label htmlFor="confirm-import" className="text-sm">
                        I confirm that I want to apply these changes to the inventory.
                        This action cannot be undone.
                      </Label>
                    </div>
                  </div>
                )}
              </div>
            </ScrollArea>
          )}

          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setShowPreviewDialog(false)}
            >
              Cancel
            </Button>
            {importPreview && importPreview.summary.errorCount === 0 && (
              <Button
                onClick={handleApplyImport}
                disabled={!confirmImport || isImporting}
              >
                <Save className="h-4 w-4 mr-2" />
                {isImporting ? 'Applying...' : 'Apply Import'}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
} 