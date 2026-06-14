import { X } from "lucide-react";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

interface MediaLightboxProps {
    src: string;
    type: "IMAGE" | "VIDEO";
    onClose: () => void;
}

export function MediaLightbox({ src, type, onClose }: MediaLightboxProps) {
    const [isVisible, setIsVisible] = useState(false);

    useEffect(() => {
        setIsVisible(true);
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === "Escape") handleClose();
        };
        document.addEventListener("keydown", handleKeyDown);
        document.body.style.overflow = "hidden"; // Prevent background scrolling
        return () => {
            document.removeEventListener("keydown", handleKeyDown);
            document.body.style.overflow = "auto";
        };
    }, []);

    const handleClose = () => {
        setIsVisible(false);
        setTimeout(onClose, 200); // Wait for transition
    };

    return (
        <div 
            className={cn(
                "fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-sm transition-opacity duration-200",
                isVisible ? "opacity-100" : "opacity-0"
            )}
            onClick={handleClose}
        >
            <button 
                className="absolute top-6 right-6 p-3 bg-white/10 hover:bg-white/20 rounded-full transition-colors text-white z-50 backdrop-blur-md"
                onClick={(e) => { e.stopPropagation(); handleClose(); }}
            >
                <X className="w-6 h-6" />
            </button>

            <div 
                className={cn(
                    "relative max-w-[95vw] max-h-[90vh] transition-all duration-300 transform",
                    isVisible ? "scale-100 translate-y-0" : "scale-95 translate-y-4"
                )}
                onClick={(e) => e.stopPropagation()} // Prevent click from closing when clicking media
            >
                {type === "IMAGE" ? (
                    <img 
                        src={src} 
                        alt="Fullscreen media" 
                        className="max-w-full max-h-[90vh] object-contain rounded-xl shadow-2xl" 
                    />
                ) : (
                    <video 
                        src={src} 
                        controls 
                        autoPlay 
                        className="max-w-full max-h-[90vh] rounded-xl shadow-2xl"
                        playsInline
                    />
                )}
            </div>
        </div>
    );
}
