<template>
  <div id="app">
    <header class="app-header">
      <div class="container">
        <div class="logo">
          <h1>⏰ ChronoSwap</h1>
          <span class="tagline">Your DeFi, Scheduled</span>
        </div>
        <nav class="nav">
          <button v-if="!connected" @click="connectWallet" class="connect-btn">
            Connect Wallet
          </button>
          <div v-else class="wallet-info">
            <span class="address">{{ shortenAddress(walletAddress) }}</span>
            <span class="balance">{{ balance }} MAS</span>
          </div>
        </nav>
      </div>
    </header>

    <main class="main-content">
      <div class="container">
        <div class="hero-section">
          <h2>Automate Your DeFi Strategy</h2>
          <p>Schedule trades, DCA, and recurring payments that run autonomously on Massa blockchain</p>
          <button @click="showStrategyWizard = true" class="cta-button">
            Create Strategy
          </button>
        </div>

        <StrategyWizard 
          v-if="showStrategyWizard"
          @close="showStrategyWizard = false"
          @strategy-created="onStrategyCreated"
        />

        <PortfolioDashboard 
          v-if="connected"
          :strategies="userStrategies"
          @refresh="loadUserStrategies"
        />
      </div>
    </main>
  </div>
</template>

<script>
import StrategyWizard from './components/StrategyWizard.vue'
import PortfolioDashboard from './components/PortfolioDashboard.vue'
import { MassaWallet } from './utils/massa-wallet.js'

export default {
  name: 'App',
  components: {
    StrategyWizard,
    PortfolioDashboard
  },
  data() {
    return {
      connected: false,
      walletAddress: '',
      balance: '0',
      userStrategies: [],
      showStrategyWizard: false,
      massaWallet: null
    }
  },
  async mounted() {
    // FIX: Wrap initialization in try...catch
    try {
      this.massaWallet = new MassaWallet()
      console.log('MassaWallet initialized', this.massaWallet);
    
      // Try to auto-reconnect
      const reconnected = await this.massaWallet.init();
      if (reconnected) {
        console.log('Wallet re-initialized');
        await this.loadWalletData();
      }
    } catch (error) {
      console.error('Failed to initialize wallet or auto-reconnect:', error);
      // We can alert the user here if initialization itself fails
      // alert('Failed to initialize wallet: ' + error.message);
    }
  },
  methods: {
    async connectWallet() {
      // Add a check here in case initialization failed
      if (!this.massaWallet) {
        console.error('MassaWallet is not initialized. Trying to re-initialize.');
        try {
          this.massaWallet = new MassaWallet();
        } catch (error) {
          alert('Failed to initialize wallet. Please refresh the page. ' + error.message);
          return;
        }
      }

      try {
        await this.massaWallet.connect()
        console.log('Wallet connected:', this.massaWallet.getAddress())
        await this.loadWalletData()
      } catch (error) {
        console.error('Failed to connect wallet:', error)
        alert('Failed to connect wallet: ' + error.message)
      }
    },
    
    async loadWalletData() {
      this.connected = this.massaWallet.isConnected();
      if (!this.connected) return;

      this.walletAddress = this.massaWallet.getAddress()
      console.log('Wallet address:', this.walletAddress)
      
      this.balance = 'Loading...';
      this.balance = await this.massaWallet.getBalance()
      console.log('Wallet balance:', this.balance)
      
      await this.loadUserStrategies()
    },
    
    async loadUserStrategies() {
      if (!this.connected) return
      
      try {
        // This would call your smart contract to get user strategies
        this.userStrategies = await this.massaWallet.getUserStrategies(this.walletAddress)
      } catch (error) {
        console.error('Failed to load strategies:', error)
      }
    },
    
    onStrategyCreated(strategy) {
      this.userStrategies.push(strategy)
      this.showStrategyWizard = false
    },
    
    shortenAddress(address) {
      return address ? `${address.substring(0, 6)}...${address.substring(address.length - 4)}` : ''
    }
  }
}
</script>