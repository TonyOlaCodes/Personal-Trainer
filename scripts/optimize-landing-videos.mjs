/**
 * Transcode landing MOV clips to web-optimized MP4 (H.264 + faststart).
 * Run: node scripts/optimize-landing-videos.mjs
 */
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { existsSync, mkdirSync, readdirSync } from "node:fs";
import path from "node:path";

const require = createRequire(import.meta.url);
const ffmpegPath = require("ffmpeg-static");

if (!ffmpegPath) {
    console.error("ffmpeg-static binary not found. Run: npm install --save-dev ffmpeg-static");
    process.exit(1);
}

const inputDir = path.join(process.cwd(), "public/landing/videos");
const outputDir = path.join(inputDir, "web");

if (!existsSync(outputDir)) {
    mkdirSync(outputDir, { recursive: true });
}

const inputs = readdirSync(inputDir).filter((name) => /\.(mov|mp4)$/i.test(name));

if (inputs.length === 0) {
    console.log("No landing videos found to optimize.");
    process.exit(0);
}

for (const input of inputs) {
    const base = path.parse(input).name.toLowerCase();
    const output = path.join(outputDir, `${base}.mp4`);

    if (existsSync(output)) {
        console.log(`skip ${base}.mp4 (already exists)`);
        continue;
    }

    console.log(`transcoding ${input} -> web/${base}.mp4`);

    execFileSync(
        ffmpegPath,
        [
            "-y",
            "-i",
            path.join(inputDir, input),
            "-an",
            "-c:v",
            "libx264",
            "-preset",
            "fast",
            "-crf",
            "28",
            "-vf",
            "scale='min(720,iw)':-2",
            "-movflags",
            "+faststart",
            "-pix_fmt",
            "yuv420p",
            output,
        ],
        { stdio: "inherit" }
    );
}

console.log("Done. Update LANDING_MEDIA_FILES to use web/*.mp4 paths.");
