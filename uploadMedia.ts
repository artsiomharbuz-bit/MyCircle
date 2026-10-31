import { File } from 'expo-file-system';

export async function uploadFileToSupabase(
  uri: string,
  uploadUrl: string,
  contentType: string
): Promise<string> {
  const file = new File(uri);
  const supabaseUpload = uploadUrl.startsWith('supabase-upload://');
  const uploadInfo = supabaseUpload
    ? JSON.parse(decodeURIComponent(uploadUrl.slice('supabase-upload://'.length))) as { url: string; storageId: string }
    : null;
  const result = await file.upload(uploadInfo?.url ?? uploadUrl, {
    httpMethod: supabaseUpload ? 'PUT' : 'POST',
    headers: { 'Content-Type': contentType },
  });

  if (result.status < 200 || result.status >= 300) {
    throw new Error(`Upload failed with status ${result.status}`);
  }

  const storageId = uploadInfo?.storageId ?? JSON.parse(result.body).storageId;
  if (!storageId) {
    throw new Error('Upload did not return a storage id.');
  }

  return storageId;
}
