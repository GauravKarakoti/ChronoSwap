import { getWallets } from '@massalabs/wallet-provider';
import { JsonRPCClient } from '@massalabs/massa-web3';
import { toMAS, Args } from '@massalabs/web3-utils';

export class MassaWallet {
  constructor() {
    /** @type {WalletProvider | null} */
    this.provider = null;
    this.address = null;
    
    this.client = JsonRPCClient.buildnet();
  }

  /**
   * Tries to initialize the provider if a wallet was saved in localStorage.
   * Call this on page load.
   */
  async init() {
    const storedAddress = localStorage.getItem('massa_wallet_address');
    const storedProviderName = localStorage.getItem('massa_wallet_provider');

    if (storedAddress && storedProviderName) {
      try {
        const wallets = await getWallets();
        const wallet = wallets.find(w => w.walletName === storedProviderName);
        
        if (wallet) {
          // Check if we still have permission
          const accounts = await wallet.accounts();
          if (accounts.some(a => a.address === storedAddress)) {
            this.provider = wallet;
            this.address = storedAddress;
            console.log('Re-initialized wallet from localStorage');
            return true;
          }
        }
      } catch (error) {
        console.warn('Could not auto-reconnect wallet:', error);
        this.disconnect(); // Clear invalid localStorage
        return false;
      }
    }
    return false;
  }

  async connect() {
    console.log('Attempting to connect to Massa Wallet...');
    try {
      const wallets = await getWallets();
      
      if (wallets.length === 0) {
        throw new Error('No Massa wallets detected. Install Massa Station or compatible wallet');
      }

      // Find wallet whose name is "Massa Wallet" (from Massa Station)
      const wallet = wallets.find(w => w.walletName?.toLowerCase().includes("massa wallet"));

      if (!wallet) {
        throw new Error("Massa Station wallet not found. Please open Massa Station.");
      }

      // Set the provider
      this.provider = wallet;

      const accounts = await this.provider.accounts();

      if (!accounts || accounts.length === 0) {
        throw new Error("No accounts found in wallet. Please create an account.");
      }

      this.address = accounts[0].address; // Use the first account
      console.log('Connected to wallet with address:', this.address);

      // Save connection
      localStorage.setItem('massa_wallet_address', this.address);
      localStorage.setItem('massa_wallet_provider', this.provider.walletName);

      return this.address;
    } catch (error) {
      console.error('Wallet connection failed:', error);
      throw error; // Re-throw for App.vue to catch
    }
  }

  disconnect() {
    this.provider = null;
    this.address = null;
    localStorage.removeItem('massa_wallet_address');
    localStorage.removeItem('massa_wallet_provider');
    console.log('Wallet disconnected');
  }

  isConnected() {
    return this.address !== null && this.provider !== null;
  }

  getAddress() {
    return this.address;
  }

  async getBalance() {
    if (!this.address) throw new Error('Wallet not connected');
    
    try {
      // Use the public client to get balance
      const balanceDetails = await this.client.wallet().getBalance(this.address);
      // balanceDetails contains { final: string, candidate: string }
      // We'll return final balance in MAS
      // FIX: Use `toMAS` function instead of `Mas.fromNano`
      return toMAS(balanceDetails.final).toDisplayString();
    } catch (error) {
      console.error('Failed to get balance:', error);
      return '0';
    }
  }

  async createStrategy(strategyConfig) {
    if (!this.provider) throw new Error('Wallet not connected');

    // FIX: Properly encode data for the contract
    // The 'strategyConfig' object from StrategyWizard.vue is { type: '...', config: { ... } }
    // We only need to encode the 'config' part.
    const encodedData = this.encodeStrategyCreation(strategyConfig.config);

    try {
      const txHash = await this.provider.sendTransaction({
        fee: "10000000", // 0.01 MAS in nanoMAS
        maxGas: "100000000", // 0.1 MAS in nanoMAS
        amount: "0", // Amount of MAS to send with the call
        targetAddress: 'AS12ChronoSwapContract...', // Your contract address
        targetFunction: 'createDCAStrategy', // The function to call
        parameter: encodedData.serialize() // FIX: Call .serialize() on Args
      });
      
      return txHash;
    } catch (error) {
      console.error('Failed to send transaction:', error);
      throw error;
    }
  }

  encodeStrategyCreation(config) {
    // This needs to match your contract's expected serialization
    // This assumes your createDCAStrategy function in AssemblyScript
    // expects: fromToken (string), toToken (string), amount (u64), frequency (u64), duration (u64)
    
    // NOTE: This is an example based on your 'chronoswap.ts' file.
    // You will need to create a similar 'encode' function for 'createLimitOrder'
    
    console.log('Encoding strategy with config:', config);
    
    // FIX: Use Args to serialize data correctly for the smart contract
    const args = new Args();
    args.addString(config.fromToken);
    args.addString(config.toToken);
    
    // Note: Contract expects u64. JS numbers might not be precise.
    // We must use BigInt for all u64 values.
    
    // Convert amount to nanoMAS or smallest unit if needed. Assuming 'amount' is in whole tokens.
    // For this example, I'll assume the contract expects the amount as is.
    // If your contract expects nano-units, you'd multiply here.
    args.addU64(BigInt(config.amount)); 
    
    args.addU64(BigInt(config.frequency)); // frequency is already in seconds (as string)

    // Convert duration from days to seconds
    const durationInSeconds = BigInt(config.durationDays || 30) * BigInt(86400); 
    args.addU64(durationInSeconds);

    return args;
  }

  async getUserStrategies(address) {
    if (!this.client) throw new Error('Client not initialized');
    
    try {
      // This is a read-only call to the contract
      // You need the contract address
      const contractAddress = 'AS12ChronoSwapContract...'; // Your contract address
      const key = `user_strategies_${address}`;
      
      const rawData = await this.client.publicApi().getDatastoreEntries([{
        address: contractAddress,
        key: new TextEncoder().encode(key)
      }]);

      if (rawData.length > 0 && rawData[0].final_value) {
        // Data is stored as bytes, convert it back to string
        const jsonString = new TextDecoder().decode(new Uint8Array(rawData[0].final_value));
        const strategyIds = JSON.parse(jsonString);

        // Now you'd fetch each strategy by its ID...
        // This is complex and just a demo
        console.log('Found strategy IDs:', strategyIds);
        
        // For now, returning mock data as the full implementation is complex
        // In a real app, you would loop through strategyIds and fetch each one
        return [
          // { id: 'strategy_1', type: 'dca', config: { fromToken: 'MAS', toToken: 'USDT', amount: 100 }, status: 'active', nextExecution: Date.now() + 86400000 }
        ];
      }
      return [];
    } catch (error) {
      console.error('Failed to get user strategies:', error);
      return [];
    }
  }
}