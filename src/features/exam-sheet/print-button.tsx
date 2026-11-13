"use client";

import { PrintIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";

export function PrintButton() {
  return (
    <Button type="button" variant="outline" onClick={() => window.print()}>
      <PrintIcon />
      Print or save as PDF
    </Button>
  );
}
