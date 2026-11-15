/**
 * Authenticated file download helper.
 * Fetches binary content via Axios with authorization headers,
 * parses filename from Content-Disposition if present, and triggers
 * a browser file download via temporary Object URL.
 */
import { apiClient } from '@/lib/api';

export async function downloadFile(
  url: string,
  fallbackFilename: string
): Promise<void> {
  const response = await apiClient.get(url, {
    responseType: 'blob',
  });

  // Check Content-Disposition header for filename
  let filename = fallbackFilename;
  const disposition = String(response.headers['content-disposition'] || '');
  if (disposition && disposition.includes('filename=')) {
    const filenameMatch = disposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
    if (filenameMatch && filenameMatch[1]) {
      filename = filenameMatch[1].replace(/['"]/g, '').trim();
    }
  }

  const contentType = String(response.headers['content-type'] || 'text/csv;charset=utf-8;');
  const blob = new Blob([response.data], {
    type: contentType,
  });

  const blobUrl = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = blobUrl;
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(blobUrl);
}
