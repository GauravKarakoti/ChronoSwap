export class GasCalculator {
  static BASE_GAS = 0.01
  static DEX_SWAP_GAS = 0.02
  static SCHEDULING_GAS = 0.005

  static calculateStrategyGas(config) {
    let gas = this.BASE_GAS

    if (config.involvesSwap) {
      gas += this.DEX_SWAP_GAS
    }

    gas += this.SCHEDULING_GAS

    // Adjust for frequency
    if (config.frequency === '86400') { // daily
      gas *= 1.1
    }

    return {
      initial: Math.round(gas * 1000) / 1000,
      perExecution: Math.round((gas * 0.8) * 1000) / 1000
    }
  }
}