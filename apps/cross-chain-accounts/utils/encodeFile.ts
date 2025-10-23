import {
  type BlobCommitments,
  ClayErasureCodingProvider,
  generateCommitments,
} from "@shelby-protocol/sdk/browser";

export const encodeFile = async (
  file: File,
  erasure_n?: number,
  erasure_k?: number,
  erasure_d?: number
): Promise<BlobCommitments> => {
  const data = Buffer.isBuffer(file)
    ? file
    : Buffer.from(await file.arrayBuffer());
  
  // Create provider with custom erasure coding parameters if provided
  // Note: Parameters may be passed to generateCommitments or set on the provider
  const providerConfig: any = {};
  if (erasure_n) providerConfig.erasureN = erasure_n;
  if (erasure_k) providerConfig.erasureK = erasure_k;
  if (erasure_d) providerConfig.erasureD = erasure_d;
  
  const provider = await ClayErasureCodingProvider.create(
    Object.keys(providerConfig).length > 0 ? providerConfig : undefined
  );
  
  const commitments = await generateCommitments(provider, data);

  return commitments;
};
