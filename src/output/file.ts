import { writeFile, mkdir } from "node:fs/promises";
import { dirname } from "node:path";

/**
 * Write content to a file, creating parent directories if needed
 */
export async function writeToFile(
    filePath: string,
    content: string
): Promise<void> {
    await mkdir(dirname(filePath), { recursive: true });
    await writeFile(filePath, content, "utf-8");
}
