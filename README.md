# ChronoSwap

> Your DeFi, Scheduled. Autonomous, On-Chain, Unstoppable.

ChronoSwap is a decentralized application on the Massa Network that enables users to schedule DeFi actions (like DCA, limit orders, payments) for guaranteed future execution using Massa's Autonomous Smart Contracts.

## Features

- **Schedule Automated DCA**: Set recurring purchases of any token on a custom schedule.
- **Future-Dated Limit Orders**: Place buy or sell orders to execute at a specific time.
- **Recurring Payments**: Automate streaming payments or subscriptions.
- **100% On-Chain**: Both logic (smart contracts) and frontend are deployed on Massa, making it censorship-resistant.
- **No Keepers Needed**: Leverages Massa's Autonomous Smart Contracts—no Gelato or Chainlink required.

## Tech Stack

- **Blockchain**: Massa Network
- **Smart Contracts**: TypeScript (Massa environment)
- **Frontend**: Vanilla JS (Hosted on-chain via Massa DeWeb)
- **Domain**: Massa Name Service (MNS)
- **DEX**: Dusa Protocol

## Installation & Deployment

### Prerequisites
- Massa Station wallet with testnet MAS tokens.
- Git.

### Smart Contract Deployment
1. Clone the repository:
   ```bash
   git clone https://github.com/your-username/chronoswap.git
   ```
2. Navigate to the contract directory:
   ```bash
   cd chronoswap/contract
   ```
3. Deploy using Massa's `sc-deployer`:
   ```bash
   sc-deployer deploy chronoswap_contract.wasm
   ```

### Frontend Deployment
1. Navigate to the `frontend` directory.
2. Use the `massa-web-deployer` tool to upload the `index.html`, `style.css`, and `app.js` files to the Massa blockchain.
3. Register your `.massa` domain using the [MNS Portal](https://mns.massa.net/) and point it to your deployed frontend.

## Usage
1. Visit your deployed `.massa` domain via Massa Station's browser.
2. Connect your wallet.
3. Navigate to the "Create Schedule" tab.
4. Select your tokens, amount, and execution time/interval.
5. Sign the transaction. Your strategy is now active and will run autonomously!

## Documentation
For a comprehensive guide on the technical implementation and architecture, please see our [docs](./docs/WHITEPAPER.md).