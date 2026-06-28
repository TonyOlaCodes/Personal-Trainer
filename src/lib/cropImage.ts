import type { Area } from "react-easy-crop";

function createImage(url: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
        const image = new Image();
        image.addEventListener("load", () => resolve(image));
        image.addEventListener("error", () => reject(new Error("Failed to load image")));
        image.crossOrigin = "anonymous";
        image.src = url;
    });
}

/** Render cropped region to a JPEG blob, optionally downscaling to maxWidth. */
export async function getCroppedImageBlob(
    imageSrc: string,
    pixelCrop: Area,
    maxWidth?: number
): Promise<Blob> {
    const image = await createImage(imageSrc);
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (!ctx) {
        throw new Error("Could not get canvas context");
    }

    let outputWidth = pixelCrop.width;
    let outputHeight = pixelCrop.height;
    if (maxWidth && outputWidth > maxWidth) {
        const scale = maxWidth / outputWidth;
        outputWidth = maxWidth;
        outputHeight = Math.round(outputHeight * scale);
    }

    canvas.width = outputWidth;
    canvas.height = outputHeight;

    ctx.drawImage(
        image,
        pixelCrop.x,
        pixelCrop.y,
        pixelCrop.width,
        pixelCrop.height,
        0,
        0,
        outputWidth,
        outputHeight
    );

    const blob = await new Promise<Blob | null>((resolve) => {
        canvas.toBlob(resolve, "image/jpeg", 0.9);
    });

    if (!blob) {
        throw new Error("Failed to export cropped image");
    }

    return blob;
}

export function croppedBlobToFile(blob: Blob, fileName: string): File {
    const baseName = fileName.replace(/\.[^.]+$/, "") || "photo";
    return new File([blob], `${baseName}.jpg`, { type: "image/jpeg" });
}
