import { NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import path from "path";

export async function POST(req: Request) {
    try {
        const formData = await req.formData();
        const file = formData.get("file") as File;
        if (!file) {
            return NextResponse.json({ error: "No file received." }, { status: 400 });
        }

        const buffer = Buffer.from(await file.arrayBuffer());
        const ext = file.name.split('.').pop() || "bin";
        // Node 19+ has crypto.randomUUID() globally
        const filename = `${crypto.randomUUID()}.${ext}`;

        const dir = path.join(process.cwd(), "public", "uploads");
        await mkdir(dir, { recursive: true });

        const filePath = path.join(dir, filename);
        await writeFile(filePath, buffer);

        return NextResponse.json({ url: `/uploads/${filename}`, type: file.type });
    } catch (e: any) {
        console.error("Upload error:", e);
        return NextResponse.json({ error: "Upload failed: " + e.message }, { status: 500 });
    }
}
