<template>
  <div class="portfolio-dashboard">
    <div class="dashboard-header">
      <h3>Your Automated Strategies</h3>
      <button @click="$emit('refresh')" class="refresh-btn">🔄 Refresh</button>
    </div>

    <div class="portfolio-stats">
      <div class="stat-card">
        <div class="stat-value">{{ strategies.length }}</div>
        <div class="stat-label">Total Strategies</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">{{ activeStrategies }}</div>
        <div class="stat-label">Active</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">{{ totalValue }} MAS</div>
        <div class="stat-label">Total Value</div>
      </div>
    </div>

    <div class="strategies-list">
      <div v-for="strategy in strategies" :key="strategy.id" class="strategy-item">
        <div class="strategy-header">
          <div class="strategy-type">{{ getStrategyTypeText(strategy.type) }}</div>
          <div :class="['status-badge', strategy.status]">{{ strategy.status }}</div>
        </div>
        
        <div class="strategy-details">
          <div class="detail-row">
            <span>Pair:</span>
            <span>{{ strategy.config.fromToken }} → {{ strategy.config.toToken }}</span>
          </div>
          <div class="detail-row">
            <span>Amount:</span>
            <span>{{ strategy.config.amount }} {{ strategy.config.fromToken }}</span>
          </div>
          <div v-if="strategy.nextExecution" class="detail-row">
            <span>Next Execution:</span>
            <span>{{ formatDate(strategy.nextExecution) }}</span>
          </div>
        </div>

        <div class="strategy-actions">
          <button @click="viewDetails(strategy)" class="btn btn-outline">Details</button>
          <button @click="cancelStrategy(strategy)" class="btn btn-danger">Cancel</button>
        </div>
      </div>

      <div v-if="strategies.length === 0" class="empty-state">
        <p>No strategies yet. Create your first automated strategy!</p>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  name: 'PortfolioDashboard',
  props: {
    strategies: {
      type: Array,
      default: () => []
    }
  },
  computed: {
    activeStrategies() {
      return this.strategies.filter(s => s.status === 'active').length
    },
    totalValue() {
      return this.strategies.reduce((total, strategy) => {
        return total + (parseFloat(strategy.config.amount) || 0)
      }, 0).toFixed(2)
    }
  },
  methods: {
    getStrategyTypeText(type) {
      const types = {
        'dca': 'DCA',
        'limit-order': 'Limit Order',
        'recurring': 'Recurring Payment'
      }
      return types[type] || type
    },
    
    formatDate(timestamp) {
      return new Date(timestamp).toLocaleString()
    },
    
    viewDetails(strategy) {
      // Show strategy details modal
      console.log('View details:', strategy)
    },
    
    async cancelStrategy(strategy) {
      if (confirm('Are you sure you want to cancel this strategy?')) {
        try {
          await this.$massaWallet.cancelStrategy(strategy.id)
          this.$emit('refresh')
        } catch (error) {
          console.error('Failed to cancel strategy:', error)
          alert('Failed to cancel strategy: ' + error.message)
        }
      }
    }
  }
}
</script>