import path from "node:path";
import buildPikachu from "../models/pikachu-v1/subject";
import { renderSubject } from "./render-harness";

async function main(): Promise<void> {
  const pass = process.argv[2] ?? "test";
  const mode = (process.argv[3] ?? "neutral") as "neutral" | "authored";
  const withTurntable = process.argv.includes("--turntable");

  const outDir = path.resolve(`captures/pass-${pass}-${mode}`);
  console.log(`Building and capturing Pass: ${pass} (Material mode: ${mode})...`);

  const result = await renderSubject(buildPikachu, {
    materialMode: mode,
    captureViews: true,
    turntable: withTurntable,
    turntableStepDegrees: 5,
    outputDir: outDir,
  });

  console.log("Capture completed successfully!");
  console.log("Output directory:", result.outputDir);
  console.log("Views captured:", result.viewFiles.length);
  if (result.videoPath) {
    console.log("Turntable video generated:", result.videoPath);
  }
}

main().catch((err) => {
  console.error("Error executing pass capture:", err);
  process.exit(1);
});
