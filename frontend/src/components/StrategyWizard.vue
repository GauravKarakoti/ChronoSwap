<template>
  <div class="strategy-wizard-overlay" @click.self="$emit('close')">
    <div class="strategy-wizard">
      <div class="wizard-header">
        <h3>Create Automated Strategy</h3>
        <button class="close-btn" @click="$emit('close')">×</button>
      </div>

      <div class="wizard-steps">
        <div v-for="(step, index) in steps" 
             :key="index"
             :class="['step-indicator', { active: currentStep === index, completed: currentStep > index }]">
          {{ step.title }}
        </div>
      </div>

      <div class="step-content">
        <!-- Step 1: Strategy Type -->
        <div v-if="currentStep === 0" class="step step-1">
          <h4>Choose Strategy Type</h4>
          <div class="strategy-cards">
            <div v-for="strategy in strategyTypes" 
                 :key="strategy.id"
                 class="strategy-card"
                 :class="{ selected: selectedStrategy === strategy.id }"
                 @click="selectStrategy(strategy.id)">
              <div class="card-icon">{{ strategy.icon }}</div>
              <h5>{{ strategy.title }}</h5>
              <p>{{ strategy.description }}</p>
            </div>
          </div>
        </div>

        <!-- Step 2: Configuration -->
        <div v-if="currentStep === 1" class="step step-2">
          <h4>Configure Your {{ getStrategyTitle(selectedStrategy) }}</h4>
          
          <div class="config-form">
            <div class="form-group">
              <label>From Token</label>
              <select v-model="config.fromToken">
                <option value="MAS">MAS</option>
                <option value="USDT">USDT</option>
                <option value="USDC">USDC</option>
              </select>
            </div>

            <div class="form-group">
              <label>To Token</label>
              <select v-model="config.toToken">
                <option value="USDT">USDT</option>
                <option value="USDC">USDC</option>
                <option value="MAS">MAS</option>
              </select>
            </div>

            <div class="form-group">
              <label>Amount per Execution</label>
              <input type="number" v-model="config.amount" placeholder="0.0" />
            </div>

            <div v-if="selectedStrategy === 'dca'" class="form-group">
              <label>Frequency</label>
              <select v-model="config.frequency">
                <option value="86400">Daily</option>
                <option value="604800">Weekly</option>
                <option value="2592000">Monthly</option>
              </select>
            </div>

            <div v-if="selectedStrategy === 'limit-order'" class="form-group">
              <label>Limit Price</label>
              <input type="number" v-model="config.limitPrice" placeholder="0.0" />
            </div>

            <div class="form-group">
              <label>Gas Reservation</label>
              <input type="number" v-model="config.gasReservation" placeholder="0.1" />
              <span class="help-text">MAS reserved for automatic executions</span>
            </div>
          </div>
        </div>

        <!-- Step 3: Review & Deploy -->
        <div v-if="currentStep === 2" class="step step-3">
          <h4>Review Your Strategy</h4>
          
          <div class="strategy-summary">
            <div class="summary-item">
              <span>Type:</span>
              <span>{{ getStrategyTitle(selectedStrategy) }}</span>
            </div>
            <div class="summary-item">
              <span>Pair:</span>
              <span>{{ config.fromToken }} → {{ config.toToken }}</span>
            </div>
            <div class="summary-item">
              <span>Amount:</span>
              <span>{{ config.amount }} {{ config.fromToken }}</span>
            </div>
            <div v-if="selectedStrategy === 'dca'" class="summary-item">
              <span>Frequency:</span>
              <span>{{ getFrequencyText(config.frequency) }}</span>
            </div>
            <div class="summary-item">
              <span>Gas Reserved:</span>
              <span>{{ config.gasReservation }} MAS</span>
            </div>
          </div>

          <div class="gas-estimate">
            <h5>Gas Estimate</h5>
            <p>Initial deployment: {{ gasEstimate.initial }} MAS</p>
            <p>Per execution: {{ gasEstimate.perExecution }} MAS</p>
          </div>
        </div>
      </div>

      <div class="wizard-actions">
        <button v-if="currentStep > 0" @click="previousStep" class="btn btn-secondary">
          Back
        </button>
        <button v-if="currentStep < 2" @click="nextStep" class="btn btn-primary" :disabled="!canProceed">
          Continue
        </button>
        <button v-if="currentStep === 2" @click="deployStrategy" class="btn btn-primary" :disabled="deploying">
          {{ deploying ? 'Deploying...' : 'Deploy Strategy' }}
        </button>
      </div>
    </div>
  </div>
</template>

<script>
import { GasCalculator } from '../utils/GasCalculator.js'

export default {
  name: 'StrategyWizard',
  data() {
    return {
      currentStep: 0,
      selectedStrategy: null,
      config: {
        fromToken: 'MAS',
        toToken: 'USDT',
        amount: 0,
        frequency: '86400',
        limitPrice: 0,
        gasReservation: 0.1
      },
      deploying: false,
      strategyTypes: [
        {
          id: 'dca',
          title: 'Dollar Cost Averaging',
          description: 'Automatically invest fixed amounts at regular intervals',
          icon: '📈'
        },
        {
          id: 'limit-order',
          title: 'Limit Order',
          description: 'Set buy/sell orders at specific price points',
          icon: '🎯'
        },
        {
          id: 'recurring',
          title: 'Recurring Payment',
          description: 'Automate regular payments or transfers',
          icon: '🔄'
        }
      ],
      steps: [
        { title: 'Strategy' },
        { title: 'Configure' },
        { title: 'Deploy' }
      ]
    }
  },
  computed: {
    steps() {
      return [
        { title: 'Strategy' },
        { title: 'Configure' },
        { title: 'Deploy' }
      ]
    },
    canProceed() {
      switch (this.currentStep) {
        case 0: return this.selectedStrategy !== null
        case 1: return this.validateConfiguration()
        default: return true
      }
    },
    gasEstimate() {
      return GasCalculator.calculateStrategyGas(this.config)
    }
  },
  methods: {
    selectStrategy(strategyId) {
      this.selectedStrategy = strategyId
    },
    
    nextStep() {
      if (this.canProceed) {
        this.currentStep++
      }
    },
    
    previousStep() {
      this.currentStep--
    },
    
    validateConfiguration() {
      if (!this.config.amount || this.config.amount <= 0) return false
      if (!this.config.gasReservation || this.config.gasReservation <= 0) return false
      if (this.selectedStrategy === 'limit-order' && (!this.config.limitPrice || this.config.limitPrice <= 0)) return false
      return true
    },
    
    getStrategyTitle(strategyId) {
      const strategy = this.strategyTypes.find(s => s.id === strategyId)
      return strategy ? strategy.title : ''
    },
    
    getFrequencyText(frequency) {
      const frequencies = {
        '86400': 'Daily',
        '604800': 'Weekly', 
        '2592000': 'Monthly'
      }
      return frequencies[frequency] || 'Custom'
    },
    
    async deployStrategy() {
      this.deploying = true
      
      try {
        // This would call your smart contract
        const strategyId = await this.$massaWallet.createStrategy({
          type: this.selectedStrategy,
          config: this.config
        })
        
        this.$emit('strategy-created', {
          id: strategyId,
          type: this.selectedStrategy,
          config: this.config,
          status: 'active'
        })
        
        this.$emit('close')
      } catch (error) {
        console.error('Failed to deploy strategy:', error)
        alert('Failed to deploy strategy: ' + error.message)
      } finally {
        this.deploying = false
      }
    }
  }
}
</script>