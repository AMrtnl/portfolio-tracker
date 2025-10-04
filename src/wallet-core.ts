import { ethers } from 'ethers';
import * as bip39 from 'bip39';
import { Address } from './types/common';

export class WalletCore {
  private mnemonic: string | null = null;
  private privateKeys: Map<number, string> = new Map();

  /**
   * Generate a new mnemonic (24 words)
   */
  public generateMnemonic(): string {
    this.mnemonic = bip39.generateMnemonic(256);
    return this.mnemonic;
  }

  /**
   * Set mnemonic from existing phrase
   */
  public setMnemonic(mnemonic: string): void {
    if (!bip39.validateMnemonic(mnemonic)) {
      throw new Error('Invalid mnemonic phrase');
    }
    this.mnemonic = mnemonic;
  }

  /**
   * Get private key for a specific derivation path
   */
  public getPrivateKey(accountIndex: number = 0, chainId: number = 1): string {
    if (!this.mnemonic) {
      throw new Error('Mnemonic not set');
    }

    const cacheKey = accountIndex * 1000 + chainId;
    if (this.privateKeys.has(cacheKey)) {
      return this.privateKeys.get(cacheKey)!;
    }

    const path = `m/44'/${chainId}'/0'/0/${accountIndex}`;
    const wallet = ethers.HDNodeWallet.fromPhrase(
      this.mnemonic,
      undefined,
      path
    );
    
    this.privateKeys.set(cacheKey, wallet.privateKey);
    return wallet.privateKey;
  }

  /**
   * Get address for a specific account and chain
   */
  public getAddress(accountIndex: number = 0, chainId: number = 1): Address {
    const privateKey = this.getPrivateKey(accountIndex, chainId);
    const wallet = new ethers.Wallet(privateKey);
    return wallet.address as Address;
  }

  /**
   * Sign a message with the specified account
   */
  public async signMessage(
    message: string,
    accountIndex: number = 0,
    chainId: number = 1
  ): Promise<string> {
    const privateKey = this.getPrivateKey(accountIndex, chainId);
    const wallet = new ethers.Wallet(privateKey);
    return await wallet.signMessage(message);
  }
}
