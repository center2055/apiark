import type { ExportFormat } from "@apiark/types";
import { exportCollection } from "@/lib/tauri-api";

const FORMAT_EXTENSIONS: Record<ExportFormat, string> = {
  postman: "postman_collection.json",
  openapi: "openapi.json",
};

/**
 * Export a collection to the specified format and prompt the user to save.
 */
export async function exportCollectionToFile(
  collectionPath: string,
  collectionName: string,
  format: ExportFormat,
): Promise<void> {
  const content = await exportCollection(collectionPath, format);

  const { save } = await import("@tauri-apps/plugin-dialog");
  const { writeTextFile } = await import("@tauri-apps/plugin-fs");

  const defaultName = `${collectionName.toLowerCase().replace(/\s+/g, "-")}.${FORMAT_EXTENSIONS[format]}`;

  const filePath = await save({
    defaultPath: defaultName,
    filters: [{ name: "JSON", extensions: ["json"] }],
  });

  if (filePath) {
    await writeTextFile(filePath, content);
  }
}
