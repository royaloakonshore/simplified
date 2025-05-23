'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Html5Qrcode, Html5QrcodeSupportedFormats, type Html5QrcodeResult } from 'html5-qrcode';
import { toast } from 'react-toastify';
import { useRouter } from 'next/navigation';
import OrderStatusUpdateModal from '@/components/orders/OrderStatusUpdateModal'; // Import the new modal

const SCAN_MODE_NONE = 'none';
const SCAN_MODE_ORDER = 'order';
const SCAN_MODE_INVENTORY = 'inventory';

const qrReaderRegionId = "qr-reader-region";

export default function ScanPage() {
  const router = useRouter();
  const [scanMode, setScanMode] = useState<string>(SCAN_MODE_NONE);
  const html5QrCodeRef = useRef<Html5Qrcode | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);

  // State for OrderStatusUpdateModal
  const [isOrderStatusModalOpen, setIsOrderStatusModalOpen] = useState(false);
  const [selectedOrderIdForModal, setSelectedOrderIdForModal] = useState<string | null>(null);

  useEffect(() => {
    if (scanMode !== SCAN_MODE_NONE) {
      setCameraError(null); // Reset camera error when starting a new scan mode
      if (!html5QrCodeRef.current) {
        html5QrCodeRef.current = new Html5Qrcode(qrReaderRegionId, { verbose: false });
      }
      const qrScannerInstance = html5QrCodeRef.current;

      const config = {
        fps: 10,
        qrbox: { width: 250, height: 250 },
        rememberLastUsedCamera: true,
        supportedScanTypes: [Html5QrcodeSupportedFormats.QR_CODE],
        aspectRatio: 1.0, // Added for better camera view consistency
      };

      const qrCodeSuccessCallback = (decodedText: string, result: Html5QrcodeResult) => {
        console.log(`QR Code Decoded: ${decodedText}`, result);
        stopScanner();
        handleScanResult(decodedText, scanMode);
      };

      const qrCodeErrorCallback = (errorMessage: string) => {
        // console.warn(`QR error: ${errorMessage}`);
        // Don't toast every error, can be spammy if camera is struggling
      };

      qrScannerInstance.start(
        { facingMode: "environment" },
        config,
        qrCodeSuccessCallback,
        qrCodeErrorCallback
      )
      .then(() => {
        setIsScanning(true);
      })
      .catch((err: any) => {
        console.error("Error starting QR Scanner:", err);
        const errorMessage = err.message || 'Unknown error starting scanner.';
        toast.error(errorMessage);
        setCameraError(errorMessage);
        setScanMode(SCAN_MODE_NONE);
        // Do not nullify html5QrCodeRef.current here, let stopScanner handle it
      });
    } else {
      stopScanner(); // Ensure scanner stops if scanMode is set to NONE
    }

    return () => {
      stopScanner();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scanMode]);

  const stopScanner = () => {
    if (html5QrCodeRef.current && html5QrCodeRef.current.isScanning) {
      html5QrCodeRef.current.stop()
        .then(() => {
          setIsScanning(false);
          console.log("QR Scanner stopped.");
        })
        .catch((err) => {
          console.error("Error stopping QR Scanner:", err);
          // Consider if UI should reflect this error
        });
    }
  };

  const handleScanResult = (decodedText: string, currentScanMode: string) => {
    toast.info(`Scanned: ${decodedText}`);
    setScanMode(SCAN_MODE_NONE); // Reset scan mode immediately after a scan attempt

    if (currentScanMode === SCAN_MODE_ORDER) {
      if (decodedText.startsWith('ORDER:')) {
        const orderId = decodedText.substring(6);
        if (orderId) {
          toast.success(`Order ID: ${orderId} scanned.`);
          setSelectedOrderIdForModal(orderId);
          setIsOrderStatusModalOpen(true);
        } else {
          toast.error('Invalid Order QR: Empty ID after prefix.');
        }
      } else {
        toast.error('Scanned QR is not a valid Order QR code.');
      }
    } else if (currentScanMode === SCAN_MODE_INVENTORY) {
      if (decodedText.startsWith('ITEM:')) {
        const itemId = decodedText.substring(5);
        if (itemId) {
          toast.success(`Item ID: ${itemId} scanned.`);
          router.push(`/inventory/${itemId}/edit?mode=scan-edit`); // Navigate to edit page in scan-edit mode
        } else {
          toast.error('Invalid Item QR: Empty ID after prefix.');
        }
      } else {
        toast.error('Scanned QR is not a valid Inventory QR code.');
      }
    }
  };

  const startScan = (mode: string) => {
    setScanMode(mode);
  };

  return (
    <div className="container mx-auto py-6 px-4 md:px-6">
      <h1 className="text-2xl font-bold mb-6">Scan QR Code</h1>

      {scanMode === SCAN_MODE_NONE && (
        <div className="flex flex-col md:flex-row gap-4 items-center justify-center">
          <Button onClick={() => startScan(SCAN_MODE_ORDER)} size="lg" className="w-full md:w-auto" disabled={isScanning}>
            Scan Order QR
          </Button>
          <Button onClick={() => startScan(SCAN_MODE_INVENTORY)} size="lg" className="w-full md:w-auto" disabled={isScanning}>
            Scan Inventory QR
          </Button>
        </div>
      )}

      {scanMode !== SCAN_MODE_NONE && (
        <div className="flex flex-col items-center mt-4">
          <div id={qrReaderRegionId} style={{ width: '100%', maxWidth: '500px' }}></div>
          {isScanning && <p className="mt-2 text-green-600">Scanning active... Point camera at QR code.</p>}
          {cameraError && <p className="mt-2 text-red-600">Camera Error: {cameraError}</p>}
          <Button onClick={() => { setScanMode(SCAN_MODE_NONE); /* stopScanner will be called by useEffect */ }} variant="outline" className="mt-4">
            Cancel Scan
          </Button>
        </div>
      )}

      <OrderStatusUpdateModal
        orderId={selectedOrderIdForModal}
        isOpen={isOrderStatusModalOpen}
        onOpenChange={setIsOrderStatusModalOpen}
        onStatusUpdated={() => {
          toast.info('Order status process completed via scan.');
        }}
      />
    </div>
  );
} 