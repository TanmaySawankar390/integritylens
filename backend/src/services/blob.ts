import {
  BlobSASPermissions,
  BlobServiceClient,
  StorageSharedKeyCredential,
  generateBlobSASQueryParameters
} from "@azure/storage-blob";
import { env } from "../config/env";

const blobServiceClient = BlobServiceClient.fromConnectionString(
  env.blobConnectionString
);

function getSharedKeyCredential(): StorageSharedKeyCredential | null {
  const parts = Object.fromEntries(
    env.blobConnectionString.split(";").map((kv) => {
      const [k, ...rest] = kv.split("=");
      return [k, rest.join("=")];
    })
  ) as Record<string, string>;

  const accountName = parts["AccountName"];
  const accountKey = parts["AccountKey"];
  if (!accountName || !accountKey) return null;
  return new StorageSharedKeyCredential(accountName, accountKey);
}

function withSas(url: string, blobPath: string): string {
  const cred = getSharedKeyCredential();
  if (!cred) return url;
  const expiresOn = new Date(Date.now() + 24 * 60 * 60 * 1000);
  const sas = generateBlobSASQueryParameters(
    {
      containerName: env.blobContainer,
      blobName: blobPath,
      permissions: BlobSASPermissions.parse("r"),
      expiresOn
    },
    cred
  ).toString();
  return `${url}?${sas}`;
}

export async function ensureContainer(): Promise<void> {
  const containerClient = blobServiceClient.getContainerClient(env.blobContainer);
  await containerClient.createIfNotExists();
}

export async function uploadBuffer(
  blobPath: string,
  buffer: Buffer,
  contentType: string
): Promise<string> {
  const containerClient = blobServiceClient.getContainerClient(env.blobContainer);
  const blockBlobClient = containerClient.getBlockBlobClient(blobPath);
  await blockBlobClient.uploadData(buffer, {
    blobHTTPHeaders: { blobContentType: contentType }
  });
  return withSas(blockBlobClient.url, blobPath);
}
