"use client";

import { useCallback, useEffect, useState } from "react";
import Cropper, { type Area } from "react-easy-crop";
import { Loader2, X, ZoomIn } from "lucide-react";
import { ModalOverlay } from "@/components/shared/ModalOverlay";
import { croppedBlobToFile, getCroppedImageBlob } from "@/lib/cropImage";
import { cn } from "@/lib/utils";

interface Props {
    open: boolean;
    imageSrc: string;
    aspect: number;
    cropShape?: "rect" | "round";
    title: string;
    fileName: string;
    maxOutputWidth?: number;
    onClose: () => void;
    onConfirm: (file: File) => void | Promise<void>;
    confirming?: boolean;
}

export function ImageCropModal({
    open,
    imageSrc,
    aspect,
    cropShape = "rect",
    title,
    fileName,
    maxOutputWidth,
    onClose,
    onConfirm,
    confirming = false,
}: Props) {
    const [crop, setCrop] = useState({ x: 0, y: 0 });
    const [zoom, setZoom] = useState(1);
    const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
    const [processing, setProcessing] = useState(false);

    useEffect(() => {
        if (!open) return;
        setCrop({ x: 0, y: 0 });
        setZoom(1);
        setCroppedAreaPixels(null);
    }, [open, imageSrc]);

    const onCropComplete = useCallback((_area: Area, pixels: Area) => {
        setCroppedAreaPixels(pixels);
    }, []);

    const handleConfirm = async () => {
        if (!croppedAreaPixels || processing || confirming) return;
        setProcessing(true);
        try {
            const blob = await getCroppedImageBlob(imageSrc, croppedAreaPixels, maxOutputWidth);
            const file = croppedBlobToFile(blob, fileName);
            await onConfirm(file);
        } catch (error) {
            alert(error instanceof Error ? error.message : "Could not crop image");
        } finally {
            setProcessing(false);
        }
    };

    const busy = processing || confirming;

    return (
        <ModalOverlay onClose={busy ? undefined : onClose}>
            <div
                className="bg-surface-card w-full sm:max-w-lg max-h-[90vh] rounded-t-[2rem] sm:rounded-3xl border border-surface-border shadow-glow-brand-lg overflow-hidden animate-slide-up flex flex-col"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="px-5 py-4 border-b border-surface-border shrink-0 flex items-center justify-between gap-3">
                    <div>
                        <p className="text-[10px] font-black uppercase tracking-widest text-brand-400">Adjust image</p>
                        <h3 className="text-lg font-black text-fg">{title}</h3>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={busy}
                        className="btn-icon shrink-0 disabled:opacity-50"
                        aria-label="Close"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="relative h-[min(52vh,360px)] bg-black shrink-0">
                    <Cropper
                        image={imageSrc}
                        crop={crop}
                        zoom={zoom}
                        aspect={aspect}
                        cropShape={cropShape}
                        showGrid={cropShape === "rect"}
                        onCropChange={setCrop}
                        onZoomChange={setZoom}
                        onCropComplete={onCropComplete}
                    />
                </div>

                <div className="px-5 py-4 space-y-4 border-t border-surface-border shrink-0">
                    <div className="space-y-2">
                        <label className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-fg-subtle">
                            <ZoomIn className="w-3.5 h-3.5" />
                            Zoom
                        </label>
                        <input
                            type="range"
                            min={1}
                            max={3}
                            step={0.05}
                            value={zoom}
                            onChange={(e) => setZoom(Number(e.target.value))}
                            disabled={busy}
                            className="w-full accent-brand-500"
                        />
                    </div>

                    <div className="flex gap-3">
                        <button
                            type="button"
                            onClick={onClose}
                            disabled={busy}
                            className="btn-secondary flex-1 disabled:opacity-50"
                        >
                            Cancel
                        </button>
                        <button
                            type="button"
                            onClick={handleConfirm}
                            disabled={busy || !croppedAreaPixels}
                            className={cn("btn-primary flex-1 inline-flex items-center justify-center gap-2", busy && "opacity-70")}
                        >
                            {(processing || confirming) && <Loader2 className="w-4 h-4 animate-spin" />}
                            {confirming ? "Uploading…" : processing ? "Processing…" : "Save"}
                        </button>
                    </div>
                </div>
            </div>
        </ModalOverlay>
    );
}
