import {
  JsonRpcProvider,
  Wallet,
  Contract,
  TransactionReceipt,
  ContractTransactionResponse,
} from 'ethers';
import config from '../config';
import {
  STAKING_VAULT_ABI,
  TRADE_ESCROW_ABI,
  CHARACTER_NFT_ABI,
  tradeEscrowInterface,
} from './contracts';

export class TransactionSigner {
  private provider: JsonRpcProvider;
  private agentWallets: Map<number, Wallet> = new Map();
  private nonces: Map<string, number> = new Map();

  constructor(provider?: JsonRpcProvider) {
    this.provider = provider || new JsonRpcProvider(config.httpRpcUrl);
    this.initializeWallets();
  }

  private initializeWallets(): void {
    for (const [tokenIdStr, privateKey] of Object.entries(config.agentSessionKeys)) {
      const tokenId = parseInt(tokenIdStr, 10);
      if (privateKey && privateKey.startsWith('0x') && privateKey.length === 66) {
        const wallet = new Wallet(privateKey, this.provider);
        this.agentWallets.set(tokenId, wallet);
      }
    }
  }

  public registerWallet(tokenId: number, privateKey: string): Wallet {
    const wallet = new Wallet(privateKey, this.provider);
    this.agentWallets.set(tokenId, wallet);
    return wallet;
  }

  public getWallet(tokenId: number): Wallet {
    const wallet = this.agentWallets.get(tokenId);
    if (!wallet) {
      throw new Error(`No session key wallet configured for token ID ${tokenId}`);
    }
    return wallet;
  }

  public getWalletAddress(tokenId: number): string | null {
    return this.agentWallets.get(tokenId)?.address || null;
  }

  private async getNextNonce(wallet: Wallet): Promise<number> {
    const address = wallet.address;
    let nonce = this.nonces.get(address);
    if (nonce === undefined) {
      nonce = await this.provider.getTransactionCount(address, 'latest');
    }
    this.nonces.set(address, nonce + 1);
    return nonce;
  }

  private resetNonce(address: string): void {
    this.nonces.delete(address);
  }

  public async executeStake(tokenId: number): Promise<{ txHash: string; receipt: TransactionReceipt }> {
    const wallet = this.getWallet(tokenId);
    const vaultContract = new Contract(config.contracts.stakingVault, STAKING_VAULT_ABI, wallet);

    try {
      const nonce = await this.getNextNonce(wallet);
      const feeData = await this.provider.getFeeData();

      const tx = (await vaultContract.stake(tokenId, {
        nonce,
        maxFeePerGas: feeData.maxFeePerGas ? (feeData.maxFeePerGas * 120n) / 100n : undefined,
        maxPriorityFeePerGas: feeData.maxPriorityFeePerGas,
      })) as ContractTransactionResponse;

      const receipt = await tx.wait(1);
      if (!receipt) throw new Error('Transaction execution failed: no receipt');
      return { txHash: tx.hash, receipt };
    } catch (err) {
      this.resetNonce(wallet.address);
      throw err;
    }
  }

  public async executeUnstake(tokenId: number): Promise<{ txHash: string; receipt: TransactionReceipt }> {
    const wallet = this.getWallet(tokenId);
    const vaultContract = new Contract(config.contracts.stakingVault, STAKING_VAULT_ABI, wallet);

    try {
      const nonce = await this.getNextNonce(wallet);
      const feeData = await this.provider.getFeeData();

      const tx = (await vaultContract.unstake(tokenId, {
        nonce,
        maxFeePerGas: feeData.maxFeePerGas ? (feeData.maxFeePerGas * 120n) / 100n : undefined,
        maxPriorityFeePerGas: feeData.maxPriorityFeePerGas,
      })) as ContractTransactionResponse;

      const receipt = await tx.wait(1);
      if (!receipt) throw new Error('Transaction execution failed: no receipt');
      return { txHash: tx.hash, receipt };
    } catch (err) {
      this.resetNonce(wallet.address);
      throw err;
    }
  }

  public async executeProposeTrade(
    offeredTokenId: number,
    requestedTokenId: number,
    targetWalletAddress: string
  ): Promise<{ txHash: string; tradeId: string; receipt: TransactionReceipt }> {
    const wallet = this.getWallet(offeredTokenId);
    const escrowContract = new Contract(config.contracts.tradeEscrow, TRADE_ESCROW_ABI, wallet);

    try {
      const nonce = await this.getNextNonce(wallet);
      const feeData = await this.provider.getFeeData();

      const tx = (await escrowContract.proposeTrade(offeredTokenId, requestedTokenId, targetWalletAddress, {
        nonce,
        maxFeePerGas: feeData.maxFeePerGas ? (feeData.maxFeePerGas * 120n) / 100n : undefined,
        maxPriorityFeePerGas: feeData.maxPriorityFeePerGas,
      })) as ContractTransactionResponse;

      const receipt = await tx.wait(1);
      if (!receipt) throw new Error('Transaction execution failed: no receipt');

      // Parse TradeProposed event to extract tradeId
      let tradeId = '';
      for (const log of receipt.logs) {
        try {
          const parsed = tradeEscrowInterface.parseLog({
            topics: log.topics as string[],
            data: log.data,
          });
          if (parsed && parsed.name === 'TradeProposed') {
            tradeId = parsed.args[0];
            break;
          }
        } catch {
          // ignore non-matching log
        }
      }

      return { txHash: tx.hash, tradeId, receipt };
    } catch (err) {
      this.resetNonce(wallet.address);
      throw err;
    }
  }

  public async executeAcceptTrade(
    targetTokenId: number,
    tradeId: string
  ): Promise<{ txHash: string; receipt: TransactionReceipt }> {
    const wallet = this.getWallet(targetTokenId);
    const escrowContract = new Contract(config.contracts.tradeEscrow, TRADE_ESCROW_ABI, wallet);

    try {
      const nonce = await this.getNextNonce(wallet);
      const feeData = await this.provider.getFeeData();

      const tx = (await escrowContract.acceptTrade(tradeId, {
        nonce,
        maxFeePerGas: feeData.maxFeePerGas ? (feeData.maxFeePerGas * 120n) / 100n : undefined,
        maxPriorityFeePerGas: feeData.maxPriorityFeePerGas,
      })) as ContractTransactionResponse;

      const receipt = await tx.wait(1);
      if (!receipt) throw new Error('Transaction execution failed: no receipt');
      return { txHash: tx.hash, receipt };
    } catch (err) {
      this.resetNonce(wallet.address);
      throw err;
    }
  }

  public async executeCancelTrade(
    callerTokenId: number,
    tradeId: string
  ): Promise<{ txHash: string; receipt: TransactionReceipt }> {
    const wallet = this.getWallet(callerTokenId);
    const escrowContract = new Contract(config.contracts.tradeEscrow, TRADE_ESCROW_ABI, wallet);

    try {
      const nonce = await this.getNextNonce(wallet);
      const feeData = await this.provider.getFeeData();

      const tx = (await escrowContract.cancelTrade(tradeId, {
        nonce,
        maxFeePerGas: feeData.maxFeePerGas ? (feeData.maxFeePerGas * 120n) / 100n : undefined,
        maxPriorityFeePerGas: feeData.maxPriorityFeePerGas,
      })) as ContractTransactionResponse;

      const receipt = await tx.wait(1);
      if (!receipt) throw new Error('Transaction execution failed: no receipt');
      return { txHash: tx.hash, receipt };
    } catch (err) {
      this.resetNonce(wallet.address);
      throw err;
    }
  }
}
