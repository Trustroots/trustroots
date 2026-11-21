import { createNativeThumbnails } from './avatar-processing.server.image.mts';

const [sourcePath, stageDir] = process.argv.slice(2);
try {
  await createNativeThumbnails(sourcePath, stageDir);
  process.disconnect();
} catch (error) {
  process.exitCode = 1;
  const message =
    error instanceof Error ? error.message : 'Avatar processing failed.';
  process.send(message, () => process.disconnect());
}
