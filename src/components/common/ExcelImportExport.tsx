'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Download, Upload, FileSpreadsheet, AlertCircle } from 'lucide-react';
import { toast } from 'react-toastify';

interface ExcelImportExportProps {
  title: string;
  description?: string;
  exportEndpoint: string;
  importEndpoint?: string;
  exportFileName: string;
  onImportSuccess?: () => void;
  allowImport?: boolean;
}

export function ExcelImportExport({
  title,
  description,
  exportEndpoint,
  importEndpoint,
  exportFileName,
  onImportSuccess,
  allowImport = false
}: ExcelImportExportProps) {
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importError, setImportError] = useState<string | null>(null);

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

      // Get the blob data
      const blob = await response.blob();
      
      // Create download link
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${exportFileName}_${new Date().toISOString().split('T')[0]}.xlsx`;
      document.body.appendChild(link);
      link.click();
      
      // Cleanup
      window.URL.revokeObjectURL(url);
      document.body.removeChild(link);
      
      toast.success('Tiedosto ladattu onnistuneesti');
    } catch (error) {
      console.error('Export error:', error);
      toast.error('Virhe tiedoston latauksessa');
    } finally {
      setIsExporting(false);
    }
  };

  const handleImport = async () => {
    if (!importFile || !importEndpoint) return;

    try {
      setIsImporting(true);
      setImportError(null);

      const formData = new FormData();
      formData.append('file', importFile);

      const response = await fetch(importEndpoint, {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Import failed');
      }

      toast.success(`Tuonti onnistui: ${result.imported || 0} riviä käsitelty`);
      setImportFile(null);
      
      // Reset file input
      const fileInput = document.getElementById('excel-import') as HTMLInputElement;
      if (fileInput) fileInput.value = '';
      
      onImportSuccess?.();
    } catch (error) {
      console.error('Import error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Tuntematon virhe';
      setImportError(errorMessage);
      toast.error(`Virhe tuonnissa: ${errorMessage}`);
    } finally {
      setIsImporting(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImportFile(file);
      setImportError(null);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileSpreadsheet className="h-5 w-5" />
          {title}
        </CardTitle>
        {description && (
          <CardDescription>{description}</CardDescription>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Export Section */}
        <div className="space-y-2">
          <Label className="text-sm font-medium">Vie Excel-tiedostoon</Label>
          <Button 
            onClick={handleExport} 
            disabled={isExporting}
            className="w-full"
            variant="outline"
          >
            <Download className="h-4 w-4 mr-2" />
            {isExporting ? 'Ladataan...' : 'Lataa Excel-tiedosto'}
          </Button>
        </div>

        {/* Import Section */}
        {allowImport && importEndpoint && (
          <>
            <div className="border-t pt-4 space-y-4">
              <div className="space-y-2">
                <Label htmlFor="excel-import" className="text-sm font-medium">
                  Tuo Excel-tiedostosta
                </Label>
                <Input
                  id="excel-import"
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={handleFileChange}
                  className="cursor-pointer"
                />
              </div>

              {importFile && (
                <div className="text-sm text-muted-foreground">
                  Valittu tiedosto: {importFile.name}
                </div>
              )}

              {importError && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{importError}</AlertDescription>
                </Alert>
              )}

              <Button 
                onClick={handleImport} 
                disabled={!importFile || isImporting}
                className="w-full"
              >
                <Upload className="h-4 w-4 mr-2" />
                {isImporting ? 'Tuodaan...' : 'Tuo tiedosto'}
              </Button>
            </div>

            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription className="text-xs">
                Varmista, että Excel-tiedostosi sarakkeet vastaavat oikeaa muotoa. 
                Lataa ensin mallitiedosto viemällä nykyiset tiedot.
              </AlertDescription>
            </Alert>
          </>
        )}
      </CardContent>
    </Card>
  );
} 