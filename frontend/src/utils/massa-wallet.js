export class MassaWallet {
  constructor() {
    this.provider = null
    this.address = null
  }

  async connect() {
    if (typeof window.massa !== 'undefined') {
      this.provider = window.massa
      try {
        const accounts = await this.provider.request({ method: 'massa_requestAccounts' })
        this.address = accounts[0]
        return this.address
      } catch (error) {
        throw new Error('User rejected connection')
      }
    } else {
      throw new Error('Massa Wallet not found. Please install Massa Station.')
    }
  }

  async isConnected() {
    return this.address !== null
  }

  getAddress() {
    return this.address
  }

  async getBalance() {
    if (!this.provider) throw new Error('Wallet not connected')
    
    const balance = await this.provider.request({
      method: 'massa_getBalance',
      params: [this.address]
    })
    
    return balance
  }

  async createStrategy(strategyConfig) {
    // This would call your smart contract
    const result = await this.provider.request({
      method: 'massa_sendTransaction',
      params: [{
        to: 'AS12ChronoSwapContract...', // Your contract address
        value: '0',
        data: this.encodeStrategyCreation(strategyConfig)
      }]
    })
    
    return result.txHash
  }

  encodeStrategyCreation(config) {
    // Encode strategy creation parameters for contract call
    // This is a simplified version
    return JSON.stringify({
      method: 'createStrategy',
      params: config
    })
  }
}