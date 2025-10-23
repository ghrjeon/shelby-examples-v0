import { useWallet } from "@aptos-labs/wallet-adapter-react";
import { Button } from "@shelby-protocol/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@shelby-protocol/ui/components/dialog";
import Image from "next/image";
import { useState } from "react";
import { CityPicker } from "@/components/CityPicker";
import { useSubmitFileToChain } from "@/hooks/useSubmitFileToChain";
import { useUploadFile } from "@/hooks/useUploadFile";
import { encodeFile } from "@/utils/encodeFile";

interface FileUploadProps {
  onUploadSuccess?: () => void;
}

export const FileUpload = ({ onUploadSuccess }: FileUploadProps) => {
  // Hooks
  const { account, wallet } = useWallet();
  const { uploadFileToRcp } = useUploadFile();
  const { submitFileToChain } = useSubmitFileToChain();

  // Internal State
  const [isUploading, setIsUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [filePreviewUrl, setFilePreviewUrl] = useState<string | null>(null);
  const [imageDimensions, setImageDimensions] = useState<{ width: number; height: number } | null>(null);
  const [location, setLocation] = useState<string>("");
  const [date, setDate] = useState<string>("");
  const [id, setId] = useState<string>("");
  const [duration, setDuration] = useState<number>(24 * 60 * 60 * 1_000_000); // Default: 1 day
  const [redundancyLevel, setRedundancyLevel] = useState<string>("standard"); // Default: Standard
  const [showSuccessDialog, setShowSuccessDialog] = useState(false);
  const [transactionHash, setTransactionHash] = useState<string>("");
  const [uploadedFileName, setUploadedFileName] = useState<string>("");

  // Duration options in microseconds
  const durationOptions = [
    { name: "1 minute", value: 60 * 1_000_000 },
    { name: "1 hour", value: 60 * 60 * 1_000_000 },
    { name: "1 day", value: 24 * 60 * 60 * 1_000_000 },
    { name: "1 week", value: 7 * 24 * 60 * 60 * 1_000_000 },
    { name: "1 month", value: 30 * 24 * 60 * 60 * 1_000_000 },
    { name: "1 year", value: 365 * 24 * 60 * 60 * 1_000_000 },
  ];

  // Redundancy level options for erasure coding
  const redundancyOptions = [
    { 
      name: "Economic", 
      value: "economic",
      description: "Temporary files, less critical data",
      details: "n=12, k=10, d=11",
      erasure_n: 12, 
      erasure_k: 10,
      erasure_d: 11
    },
    { 
      name: "Standard", 
      value: "standard",
      description: "Balanced cost and reliability (recommended)",
      details: "n=16, k=10, d=13",
      erasure_n: 16, 
      erasure_k: 10,
      erasure_d: 13
    },
    { 
      name: "High", 
      value: "high",
      description: "Critical documents, long-term archives",
      details: "n=20, k=10, d=15",
      erasure_n: 20, 
      erasure_k: 10,
      erasure_d: 15
    },
  ];

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      
      // Create preview URL for image files
      if (file.type.startsWith('image/')) {
        const previewUrl = URL.createObjectURL(file);
        setFilePreviewUrl(previewUrl);
        
        // Get image dimensions
        const img = document.createElement('img');
        img.onload = () => {
          setImageDimensions({ width: img.naturalWidth, height: img.naturalHeight });
        };
        img.src = previewUrl;
      } else {
        setFilePreviewUrl(null);
        setImageDimensions(null);
      }
    }
  };

  const resetForm = () => {
    // Clean up preview URL to prevent memory leaks
    if (filePreviewUrl) {
      URL.revokeObjectURL(filePreviewUrl);
      setFilePreviewUrl(null);
    }
    
    setSelectedFile(null);
    setImageDimensions(null);
    setLocation("");
    setDate("");
    setId("");
    setDuration(24 * 60 * 60 * 1_000_000); // Reset to 1 day
    setShowSuccessDialog(false);
    // Reset the file input
    const fileInput = document.getElementById("file-upload") as HTMLInputElement;
    if (fileInput) {
      fileInput.value = "";
    }
  };

  // Sanitize input to remove invalid filename characters
  const sanitizeInput = (input: string): string => {
    // First replace spaces with hyphens
    let sanitized = input.replace(/\s+/g, "-");
    // Then replace any remaining invalid characters with hyphens
    sanitized = sanitized.replace(/[^a-zA-Z0-9-_]/g, "-");
    // Remove consecutive hyphens
    sanitized = sanitized.replace(/-+/g, "-");
    // Remove leading/trailing hyphens
    sanitized = sanitized.replace(/^-+|-+$/g, "");
    return sanitized;
  };

  // Get file extension from original file
  const getFileExtension = (): string => {
    if (!selectedFile) return "";
    const parts = selectedFile.name.split(".");
    return parts.length > 1 ? `.${parts[parts.length - 1]}` : "";
  };

  // Generate filename from fields
  const generateFileName = (): string => {
    const sanitizedLocation = sanitizeInput(location);
    const sanitizedDate = sanitizeInput(date);
    const sanitizedId = sanitizeInput(id);
    const extension = getFileExtension();
    return `${sanitizedLocation}_${sanitizedDate}_${sanitizedId}${extension}`;
  };

  // Check if all required fields are filled
  const isFormValid = (): boolean => {
    return (
      location.trim() !== "" && date.trim() !== "" && id.trim() !== ""
    );
  };

  const uploadFile = async () => {
    if (!selectedFile || !account || !wallet || !isFormValid()) return;

    setIsUploading(true);
    try {
      // Generate the filename from the fields
      const newFileName = generateFileName();

      // Create a new File object with the generated name
      const fileWithNewName = new File([selectedFile], newFileName, {
        type: selectedFile.type,
      });

      // Get selected redundancy configuration
      const redundancyConfig = redundancyOptions.find(
        (opt) => opt.value === redundancyLevel
      ) || redundancyOptions[1]; // Default to Standard if not found

      // Encode the file with selected redundancy parameters
      const commitments = await encodeFile(
        fileWithNewName,
        redundancyConfig.erasure_n,
        redundancyConfig.erasure_k,
        redundancyConfig.erasure_d
      );

      // Calculate expiration time (current time + duration)
      const expirationMicros = Date.now() * 1000 + duration;

      // Submit the file to the chain and get transaction hash
      const txHash = await submitFileToChain(
        commitments, 
        fileWithNewName, 
        expirationMicros,
        redundancyConfig.erasure_n,
        redundancyConfig.erasure_k,
        redundancyConfig.erasure_d
      );

      // Upload the file to the RCP
      await uploadFileToRcp(fileWithNewName);

      // Store success information and show dialog
      setTransactionHash(txHash);
      setUploadedFileName(newFileName);
      setShowSuccessDialog(true);

      // Trigger refresh of AccountBlobs component
      onUploadSuccess?.();
    } catch (error) {
      console.error("Upload failed:", error);
      alert(`Upload failed: ${error instanceof Error ? error.message : "Unknown error"}`);
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <>
      <div className="border border-gray-200 dark:border-gray-700 rounded-xl p-6 bg-background">
        <h2 className="text-xl font-semibold text-foreground mb-3">
          Upload File to Shelby Devnet
        </h2>
          {/* File Upload */}
          <div className="space-y-4 mt-4">
          <div className="flex flex-col space-y-2">
            <input
              id="file-upload"
              accept="image/*"
              type="file"
              onChange={handleFileChange}
              className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-gray-100 file:text-gray-700 hover:file:bg-gray-200 dark:file:bg-gray-800 dark:file:text-gray-300 dark:hover:file:bg-gray-700"
            />
          </div>

          {selectedFile && (
            <div className="grid grid-cols-[30%_70%] gap-3">
              {/* File Info */}
              <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-x-auto">
                <div className="flex flex-col gap-2 text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">
                  <span>Type: {selectedFile.type || 'Unknown'}</span>
                  <span>Size: {(selectedFile.size / 1024).toFixed(1)} KB</span>
                  {imageDimensions && (
                    <span>Dimensions: {imageDimensions.width}px × {imageDimensions.height}px</span>
                  )}
                  <span> <a href={URL.createObjectURL(selectedFile)} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:text-blue-600 dark:text-blue-400 hover:underline">Open</a></span>
                </div>
              </div>

              {/* Image Preview */}
              {filePreviewUrl && (
                <div className="relative h-80 bg-gray-100 dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
                  <Image
                    src={filePreviewUrl}
                    alt="File preview"
                    fill
                    unoptimized
                    style={{
                      objectFit: "cover",
                      display: "block",
                      borderRadius: "8px",
                    }}
                    onError={(e) => {
                      console.error("Image failed to load:", e);
                    }}
                  />
                </div>
              )}
            </div>
          )}
        </div>

        {/* File Naming Fields */}
        <div className="space-y-4 mt-10">
          <div>
            <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
              File Name <br/>
              <span className="text-gray-500 dark:text-gray-500">{generateFileName()}</span>
            </h3> 
            <div className="space-y-3">
              {/* Location and Date Row */}
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col space-y-2">
                  <label
                    htmlFor="location"
                    className="text-sm font-medium text-gray-600 dark:text-gray-400"
                  >
                    Location
                  </label>
                  <CityPicker
                    value={location}
                    onChange={setLocation}
                    placeholder="Search cities worldwide..."
                  />
                </div>

                <div className="flex flex-col space-y-2">
                  <label
                    htmlFor="date"
                    className="text-sm font-medium text-gray-600 dark:text-gray-400"
                  >
                    Date
                  </label>
                  <input
                    id="date"
                    type="text"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="block w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="e.g. 2025-10-22"
                  />
                </div>
              </div>

              {/* ID and Duration Row */}
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col space-y-2">
                  <label
                    htmlFor="id"
                    className="text-sm font-medium text-gray-600 dark:text-gray-400"
                  >
                    File ID
                  </label>
                  <input
                    id="id"
                    type="text"
                    value={id}
                    onChange={(e) => setId(e.target.value)}
                    className="block w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="e.g. webbs first deep field"
                  />
                </div>

                <div className="flex flex-col space-y-2">
                  <div className="flex items-center gap-2">
                    <label
                      htmlFor="duration"
                      className="text-sm font-medium text-gray-600 dark:text-gray-400"
                    >
                      Storage Duration
                    </label>
                    <div className="group relative inline-block">
                      <span className="cursor-help text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          className="h-4 w-4"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                          />
                        </svg>
                      </span>
                      <div className="invisible group-hover:visible absolute left-0 top-6 z-10 w-80 p-3 bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-400 text-xs rounded-lg shadow-md border border-gray-200 dark:border-gray-700">
                        <p className="font-medium mb-2 text-sm text-gray-700 dark:text-gray-300">Blob Expiration Time</p>
                        
                        <div className="space-y-2">
                          <p>
                            Sets the <strong className="text-gray-700 dark:text-gray-300">expirationMicros</strong> field in the blob metadata, determining how long the blob will be stored on the Shelby network.
                          </p>
                          <p className="text-gray-600 dark:text-gray-400">
                            After expiration, the blob becomes unavailable and storage providers can reclaim the space.
                          </p>
                        </div>

                        <div className="border-t border-gray-200 dark:border-gray-700 pt-2 mt-2">
                          <p className="text-gray-500 dark:text-gray-500">
                            <strong className="text-gray-700 dark:text-gray-300">Tip:</strong> Choose longer durations for important files you need to access long-term.
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                  <select
                    id="duration"
                    value={duration}
                    onChange={(e) => setDuration(Number(e.target.value))}
                    className="block w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent cursor-pointer"
                  >
                    {durationOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex flex-col space-y-2">
                <div className="flex items-center gap-2">
                  <label
                    htmlFor="redundancy"
                    className="text-sm font-medium text-gray-600 dark:text-gray-400"
                  >
                    Redundancy Level
                  </label>
                  <div className="group relative inline-block">
                    <span className="cursor-help text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-4 w-4"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                        />
                      </svg>
                    </span>
                    <div className="invisible group-hover:visible absolute left-0 top-6 z-10 w-80 p-3 bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-400 text-xs rounded-lg shadow-md border border-gray-200 dark:border-gray-700">
                      <p className="font-medium mb-2 text-sm text-gray-700 dark:text-gray-300">Erasure Coding Parameters</p>
                      
                      <div className="space-y-1.5 mb-2">
                        <p>
                          <strong className="text-gray-700 dark:text-gray-300">n (erasure_n)</strong> <span className="text-gray-500 dark:text-gray-500">- Total number of data shards</span>
                        </p>
                        <p>
                          <strong className="text-gray-700 dark:text-gray-300">k (erasure_k)</strong> <span className="text-gray-500 dark:text-gray-500">- Minimum shards needed for recovery</span>
                        </p>
                        <p>
                          <strong className="text-gray-700 dark:text-gray-300">d (erasure_d)</strong> <span className="text-gray-500 dark:text-gray-500">- Distance parameter</span>
                        </p>
                      </div>

                      <div className="border-t border-gray-200 dark:border-gray-700 pt-2 space-y-1.5">
                        <p className="font-medium text-gray-700 dark:text-gray-300">Why this matters:</p>
                        <p className="text-gray-600 dark:text-gray-400">
                          <strong className="text-gray-700 dark:text-gray-300">Higher (n-k)</strong> = More redundancy = Higher reliability but more storage cost
                        </p>
                        <p className="text-gray-500 dark:text-gray-500">
                          Like RAID levels for distributed storage. Your file can survive (n-k) node failures.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
                <select
                  id="redundancy"
                  value={redundancyLevel}
                  onChange={(e) => setRedundancyLevel(e.target.value)}
                  className="block w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent cursor-pointer"
                >
                  {redundancyOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.name}
                    </option>
                  ))}
                </select>
                <div className="p-2 bg-gray-50 dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-700 space-y-1">
                  <p className="text-xs text-gray-600 dark:text-gray-400">
                    <strong className="text-gray-700 dark:text-gray-300">Use case:</strong> {redundancyOptions.find((opt) => opt.value === redundancyLevel)?.description}
                  </p>
                  <p className="text-xs font-mono text-gray-700 dark:text-gray-300">
                    {redundancyOptions.find((opt) => opt.value === redundancyLevel)?.details}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {selectedFile && isFormValid() && (
            <div className="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
              <span className="text-xs text-gray-600 dark:text-gray-400">
                File will be saved as:
              </span>
              <p className="text-sm font-mono font-medium text-blue-600 dark:text-blue-400 break-all mt-1">
                {generateFileName()}
              </p>
            </div>
          )}
        </div>

        {/* Upload Button */}
        <div className="mt-6">
          <Button
            onClick={uploadFile}
            disabled={isUploading || !selectedFile || !isFormValid()}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isUploading ? "Uploading..." : "Upload"}
          </Button>
        </div>
      </div>

      {/* Success Dialog */}
      <Dialog 
        open={showSuccessDialog} 
        onOpenChange={(open) => {
          if (!open) {
            resetForm();
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Upload Successful! 🎉</DialogTitle>
            <DialogDescription>
              Your file has been uploaded to the Shelby network.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Transaction Hash:
              </p>
              <a
                href={`https://explorer.aptoslabs.com/txn/${transactionHash}?network=shelbynet`}
                target="_blank"
                rel="noopener noreferrer"
                className="block text-xs font-mono bg-gray-100 dark:bg-gray-800 p-2 rounded border border-gray-300 dark:border-gray-600 break-all hover:bg-gray-200 dark:hover:bg-gray-700 text-blue-600 dark:text-blue-400 hover:underline"
              >
                {transactionHash}
              </a>
            </div>

            <div className="space-y-2">
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                View in Shelby Explorer:
              </p>
              <a
                href={`https://explorer.shelby.xyz/shelbynet/account/${account?.address}/blobs?name=${uploadedFileName}`}
                target="_blank"
                rel="noopener noreferrer"
                className="block text-xs bg-blue-50 dark:bg-blue-900/20 p-2 rounded border border-blue-200 dark:border-blue-800 break-all hover:bg-blue-100 dark:hover:bg-blue-900/30 text-blue-600 dark:text-blue-400 hover:underline"
              >
                {`https://explorer.shelby.xyz/shelbynet/account/${account?.address}/blobs?name=${uploadedFileName}`}
              </a>
            </div>

            <Button
              onClick={resetForm}
              className="w-full"
            >
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};
