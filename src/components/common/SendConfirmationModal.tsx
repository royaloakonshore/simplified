"use client";

import React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { toast } from "react-toastify";

export type SendTarget = "invoice" | "order";
export type SendMethod = "email-pdf" | "download-pdf" | "download-xml";

interface SendConfirmationModalProps {
  target: SendTarget;
  open: boolean;
  onOpenChange: (val: boolean) => void;
  onConfirm?: (method: SendMethod) => Promise<void> | void;
}

const defaultOptions: Record<SendTarget, { value: SendMethod; label: string }[]> = {
  order: [
    { value: "email-pdf", label: "E-mail PDF to customer" },
    { value: "download-pdf", label: "Download PDF only" },
  ],
  invoice: [
    { value: "email-pdf", label: "E-mail PDF to customer" },
    { value: "download-pdf", label: "Download PDF only" },
    { value: "download-xml", label: "Download XML only" },
  ],
};

export function SendConfirmationModal({ target, open, onOpenChange, onConfirm }: SendConfirmationModalProps) {
  const [method, setMethod] = React.useState<SendMethod>(defaultOptions[target][0].value);
  const [isSending, setIsSending] = React.useState(false);

  const handleConfirm = async () => {
    try {
      setIsSending(true);
      if (onConfirm) {
        await onConfirm(method);
      } else {
        toast.success("Sent (placeholder)");
      }
      onOpenChange(false);
    } finally {
      setIsSending(false);
    }
  };

  React.useEffect(() => {
    if (!open) {
      // reset when closed
      setMethod(defaultOptions[target][0].value);
    }
  }, [open, target]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[450px]">
        <DialogHeader>
          <DialogTitle>{target === "invoice" ? "Send Invoice" : "Send Order"}</DialogTitle>
          <DialogDescription>
            Choose how you want to send this {target} to the customer.
          </DialogDescription>
        </DialogHeader>

        <RadioGroup value={method} onValueChange={(val: string) => setMethod(val as SendMethod)} className="space-y-3 py-4">
          {defaultOptions[target].map(opt => (
            <div key={opt.value} className="flex items-center space-x-2">
              <RadioGroupItem value={opt.value} id={opt.value} />
              <label htmlFor={opt.value} className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                {opt.label}
              </label>
            </div>
          ))}
        </RadioGroup>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSending}>
            Cancel
          </Button>
          <Button onClick={handleConfirm} disabled={isSending}>
            {isSending ? "Sending…" : "Send"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
} 