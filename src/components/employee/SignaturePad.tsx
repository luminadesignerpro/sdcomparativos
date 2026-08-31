import React, { useRef } from "react";
import SignatureCanvas from "react-signature-canvas";
import { Button } from "@/components/ui/button";
import { Trash2, CheckCircle } from "lucide-react";

interface SignaturePadProps {
  onSave: (data: string) => void;
  onClear?: () => void;
}

export default function SignaturePad({ onSave, onClear }: SignaturePadProps) {
  const sigCanvas = useRef<SignatureCanvas>(null);

  const clear = () => {
    sigCanvas.current?.clear();
    if (onClear) onClear();
  };

  const save = () => {
    if (sigCanvas.current?.isEmpty()) return;
    const data = sigCanvas.current?.getTrimmedCanvas().toDataURL("image/png");
    if (data) onSave(data);
  };

  return (
    <div className="space-y-4">
      <div className="border-2 border-dashed border-gray-200 rounded-2xl bg-white overflow-hidden touch-none h-48 sm:h-64">
        <SignatureCanvas
          ref={sigCanvas}
          canvasProps={{
            className: "w-full h-full cursor-crosshair",
          }}
          backgroundColor="rgba(255,255,255,0)"
        />
      </div>
      <div className="flex gap-2">
        <Button
          variant="outline"
          onClick={clear}
          className="flex-1 h-12 rounded-xl font-bold border-red-100 text-red-600 hover:bg-red-50"
        >
          <Trash2 className="w-4 h-4 mr-2" /> Limpar
        </Button>
        <Button
          onClick={save}
          className="flex-1 h-12 rounded-xl font-bold bg-green-500 hover:bg-green-600 text-white"
        >
          <CheckCircle className="w-4 h-4 mr-2" /> Confirmar Assinatura
        </Button>
      </div>
    </div>
  );
}

