import { useWallet } from "@aptos-labs/wallet-adapter-react";
import type { BlobMetadata } from "@shelby-protocol/sdk/browser";
import Image from "next/image";
import { useEffect, useState } from "react";
import { getShelbyClient } from "@/utils/client";

interface AccountBlobsProps {
  refreshTrigger?: number;
}

export const AccountBlobs = ({ refreshTrigger }: AccountBlobsProps) => {
  const { account } = useWallet();
  const [blobs, setBlobs] = useState<BlobMetadata[]>([]);

  useEffect(() => {
    if (!account) {
      setBlobs([]);
      return;
    }
    const getBlobs = async (): Promise<BlobMetadata[]> => {
      const blobs = await getShelbyClient().coordination.getAccountBlobs({
        account: account.address,
      });
      return blobs;
    };


    getBlobs().then((blobs) => {
      console.log("blobs", blobs);
      setBlobs(blobs);
      refreshTrigger;
    });
  }, [account, refreshTrigger]);

  const extractFileName = (blobName: string): string => {
    return blobName.split("/").pop() || blobName;
  };

  const isImageFile = (filename: string): boolean => {
    const imageExtensions = ["jpg", "jpeg", "png", "gif", "webp"];
    const extension = filename.split(".").pop()?.toLowerCase();
    return extension ? imageExtensions.includes(extension) : false;
  };

  const isExpired = (expirationMicros: number): boolean => {
    const currentTimeMicros = Date.now() * 1000;
    return currentTimeMicros > expirationMicros;
  };

  // Separate blobs into current and expired, then reverse order (oldest first)
  const currentBlobs = blobs.filter((blob) => !isExpired(blob.expirationMicros)).reverse();
  const expiredBlobs = blobs.filter((blob) => isExpired(blob.expirationMicros)).reverse();

  return (
    <div className="border border-gray-200 dark:border-gray-700 rounded-xl p-6 bg-background">
      {!account && (
        <div className="text-center py-8">
          <p className="text-gray-500 dark:text-gray-400">
            Please connect your wallet to view blobs
          </p>
        </div>
      )}
      {account && blobs.length === 0 && (
        <div className="text-center py-8">
          <p className="text-gray-500 dark:text-gray-400">
            No blobs found for this account. Upload a file to get started!
          </p>
        </div>
      )}
      <h2 className="text-xl font-semibold text-foreground mb-3">
        Account Blobs
      </h2>
      {/* Current Blobs Section */}
      {currentBlobs.length > 0 && (
        <div className="mb-8">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Current ({currentBlobs.length})
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {currentBlobs.map((blob) => (
              <BlobCard key={blob.name} blob={blob} />
            ))}
          </div>
        </div>
      )}

      {/* Expired Blobs Section */}
      {expiredBlobs.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Expired ({expiredBlobs.length})
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {expiredBlobs.map((blob) => (
              <BlobCard key={blob.name} blob={blob} />
            ))}
          </div>
        </div>
      )}
    </div>
  );

  // Extract BlobCard as a separate component for reuse
  function BlobCard({ blob }: { blob: BlobMetadata }) {
    return (
      <div
        className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden"
      >
        {/* Image Section */}
        <div className="w-full h-48 bg-gray-100 dark:bg-gray-700 p-2">
          <div className="h-full relative">
            {isImageFile(extractFileName(blob.name)) ? (
              <Image
                src={`${
                  process.env.NEXT_PUBLIC_SHELBY_API_URL
                }/v1/blobs/${blob.owner.toString()}/${extractFileName(
                  blob.name,
                )}`}
                alt={blob.name}
                style={{
                  width: "100%",
                  height: "100%",
                  objectFit: "cover",
                  display: "block",
                  borderRadius: "4px",
                }}
                width={100}
                height={100}
                onError={(e) => {
                  console.error("Image failed to load:", e);
                }}
              />
            ) : (
              <div
                className="w-full h-full flex items-center justify-center bg-gray-200 dark:bg-gray-600 rounded"
                style={{
                  borderRadius: "4px",
                }}
              >
                <div className="text-center p-4">
                  <div className="text-gray-400 dark:text-gray-500 mb-2" />
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-300 break-words">
                    {extractFileName(blob.name)}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Content Section */}
        <div className="p-4 space-y-3">
          <div className="space-y-2 text-sm">
            <div>
            <a
            href={`https://explorer.shelby.xyz/shelbynet/account/${blob.owner.toString()}/blobs?name=${extractFileName(
              blob.name,
            )}`}
            target="_blank"
            rel="noopener noreferrer"
            className="block"
            >
              <span className="text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400">
              View in Shelby Explorer
              </span>
              </a>
              <span className="text-gray-500 dark:text-gray-400"> Expiring on {new Date(blob.expirationMicros / 1000).toLocaleString()} </span>
              <p className="font-mono text-xs bg-gray-50 dark:bg-gray-700 p-1 rounded mt-1 break-all">
                {blob.name.toString()}
              </p>
            </div>

            <div>
              <a
                href={`${
                  process.env.NEXT_PUBLIC_SHELBY_API_URL
                }/v1/blobs/${blob.owner.toString()}/${extractFileName(
                  blob.name,
                )}`}
                className="block text-blue-600 dark:text-blue-400 hover:underline text-xs mt-1 break-all"
                target="_blank"
                rel="noopener noreferrer"
              >
                Download Image
              </a>
            </div>
          </div>
        </div>
      </div>
    );
  }
};
