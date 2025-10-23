import {
  Account,
  Ed25519PrivateKey,
  PrivateKey,
  PrivateKeyVariants,
} from "@aptos-labs/ts-sdk";
import {
  type InputTransactionData,
  useWallet,
} from "@aptos-labs/wallet-adapter-react";
import {
  type BlobCommitments,
  expectedTotalChunksets,
  ShelbyBlobClient,
} from "@shelby-protocol/sdk/browser";
import { useCallback, useState } from "react";
import { getAptosClient, getShelbyClient } from "@/utils/client";

interface UseSubmitFileToChainReturn {
  submitFileToChain: (
    commitment: BlobCommitments,
    file: File,
    expirationMicros: number,
    erasure_n?: number,
    erasure_k?: number,
    erasure_d?: number
  ) => Promise<string>;
  isSubmitting: boolean;
  error: string | null;
}

export const useSubmitFileToChain = (): UseSubmitFileToChainReturn => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { account, wallet, signAndSubmitTransaction, signTransaction } =
    useWallet();

  const submitFileToChain = useCallback(
    async (
      commitment: BlobCommitments, 
      file: File, 
      expirationMicros: number,
      erasure_n?: number,
      erasure_k?: number,
      erasure_d?: number
    ) => {
      if (!account || !wallet) {
        throw new Error("Account and wallet are required");
      }

      setIsSubmitting(true);
      setError(null);

      try {
        // Note: Erasure coding parameters (erasure_n, erasure_k, erasure_d) are 
        // configured during the encoding phase and are part of the commitment.
        // They are stored in the blob metadata but not directly in the registration payload.
        const payload = ShelbyBlobClient.createRegisterBlobPayload({
          account: account.address,
          blobName: file.name,
          blobMerkleRoot: commitment.blob_merkle_root,
          numChunksets: expectedTotalChunksets(commitment.raw_data_size),
          expirationMicros: expirationMicros,
          blobSize: commitment.raw_data_size,
        });

        let transactionHash: string;

        if (wallet.isAptosNativeWallet) {
          const transaction: InputTransactionData = {
            data: payload,
          };
          const transactionSubmitted =
            await signAndSubmitTransaction(transaction);

          await getAptosClient().waitForTransaction({
            transactionHash: transactionSubmitted.hash,
          });
          
          transactionHash = transactionSubmitted.hash;
        } else {
          // Create the sponsor account
          const privateKey = new Ed25519PrivateKey(
            PrivateKey.formatPrivateKey(
              process.env.NEXT_PUBLIC_SPONSOR_PRIVATE_KEY as string,
              PrivateKeyVariants.Ed25519,
            ),
          );
          const sponsorAccount = Account.fromPrivateKey({ privateKey });

          const rawTransaction =
            await getShelbyClient().aptos.transaction.build.simple({
              sender: account.address,
              data: payload,
              withFeePayer: true,
            });

          const walletSignedTransaction = await signTransaction({
            transactionOrPayload: rawTransaction,
          });

          const sponsorAuthenticator =
            getShelbyClient().aptos.transaction.signAsFeePayer({
              signer: sponsorAccount,
              transaction: rawTransaction,
            });

          const transactionSubmitted =
            await getShelbyClient().aptos.transaction.submit.simple({
              transaction: rawTransaction,
              senderAuthenticator: walletSignedTransaction.authenticator,
              feePayerAuthenticator: sponsorAuthenticator,
            });

          await getShelbyClient().aptos.waitForTransaction({
            transactionHash: transactionSubmitted.hash,
          });
          
          transactionHash = transactionSubmitted.hash;
        }
        
        return transactionHash;
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : "An unknown error occurred";
        setError(errorMessage);
        throw err;
      } finally {
        setIsSubmitting(false);
      }
    },
    [account, wallet, signAndSubmitTransaction, signTransaction],
  );

  return {
    submitFileToChain,
    isSubmitting,
    error,
  };
};
