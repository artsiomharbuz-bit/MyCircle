export async function uploadFileToSupabase(file: Blob, uploadUrl: string, contentType: string): Promise<string> {
  if (uploadUrl.startsWith('supabase-upload://')) {
    const info = JSON.parse(decodeURIComponent(uploadUrl.slice('supabase-upload://'.length))) as {
      url: string;
      storageId: string;
    };
    const response = await fetch(info.url, {
      method: 'PUT',
      headers: { 'Content-Type': contentType },
      body: file,
    });
    if (!response.ok) throw new Error(`Upload failed with status ${response.status}.`);
    return info.storageId;
  }

  const response = await fetch(uploadUrl, { method: 'POST', headers: { 'Content-Type': contentType }, body: file });
  if (!response.ok) throw new Error(`Upload failed with status ${response.status}.`);
  const result = await response.json();
  if (!result.storageId) throw new Error('Upload did not return a storage id.');
  return result.storageId;
}
