"use client";

import { useState } from 'react';
import { api } from '@/lib/trpc/react';
import { Button } from '@/components/ui/button';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from '@/components/ui/dropdown-menu';
import { Download, Upload, MoreHorizontal, FileText, RefreshCw } from 'lucide-react';
import { toast } from 'react-toastify';

export function ReplenishmentActions() {
  const [isExporting, setIsExporting] = useState(false);
  const utils = api.useUtils();

  const handleExport = async () => {
    try {
      setIsExporting(true);
      
      // Use utils to fetch the export data
      const result = await utils.replenishment.exportToExcel.fetch();
      
      if (result && result.data) {
        // Convert data to CSV for simple export (we'll enhance this with xlsx-import later)
        const csvContent = convertToCSV(result.data, result.headers);
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        
        // Create download link
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', result.filename.replace('.xlsx', '.csv'));
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        toast.success('Replenishment data exported successfully');
      }
    } catch (error) {
      console.error('Export failed:', error);
      toast.error('Failed to export replenishment data');
    } finally {
      setIsExporting(false);
    }
  };

  const handleRefresh = () => {
    utils.replenishment.getCriticalAlerts.invalidate();
    utils.replenishment.getRawMaterials.invalidate();
    toast.success('Replenishment data refreshed');
  };

  const handleImport = () => {
    // Placeholder for future implementation with xlsx-import
    toast.info('Excel import functionality coming soon');
  };

  return (
    <div className="flex items-center gap-2">
      <Button
        variant="outline"
        size="sm"
        onClick={handleRefresh}
        className="flex items-center gap-2"
      >
        <RefreshCw className="h-4 w-4" />
        Refresh
      </Button>

      <Button
        variant="outline"
        size="sm"
        onClick={handleExport}
        disabled={isExporting}
        className="flex items-center gap-2"
      >
        <Download className="h-4 w-4" />
        {isExporting ? 'Exporting...' : 'Export'}
      </Button>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm">
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={handleImport}>
            <Upload className="h-4 w-4 mr-2" />
            Import from Excel
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => window.open('/api/replenishment/template', '_blank')}>
            <FileText className="h-4 w-4 mr-2" />
            Download Template
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

// Helper function to convert data to CSV
function convertToCSV(data: any[], headers: string[]): string {
  const csvHeaders = headers.join(',');
  const csvRows = data.map(row => 
    headers.map(header => {
      const value = row[header];
      // Escape commas and quotes in CSV
      if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
        return `"${value.replace(/"/g, '""')}"`;
      }
      return value;
    }).join(',')
  );
  
  return [csvHeaders, ...csvRows].join('\n');
} 