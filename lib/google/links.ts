/** Link that opens a folder in the Google Drive website. */
export function driveFolderUrl(folderId: string): string {
  return `https://drive.google.com/drive/folders/${encodeURIComponent(folderId)}`;
}
