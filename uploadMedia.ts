import { File } from 'expo-file-system';

export async function uploadFileToConvex(
  uri: string,
  uploadUrl: string,
  contentType: string
): Promise<string> {
  const file = new File(uri);
  const result = await file.upload(uploadUrl, {
    httpMethod: 'POST',
    headers: { 'Content-Type': contentType },
  });

  if (result.status < 200 || result.status >= 300) {
    throw new Error(`Upload failed with status ${result.status}`);
  }

  const { storageId } = JSON.parse(result.body);
  if (!storageId) {
    throw new Error('Upload did not return a storage id.');
  }

  return storageId;
}
