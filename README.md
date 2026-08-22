# BARY: Bohr AI-RWA Yield Fund

BARY is a non-custodial decentralized yield basket aggregating real-world asset (RWA) collateral on the Bohr Testnet. The fund optimizes stablecoin returns by distributing deposits across three distinct RWA yield sources:
1. **US Treasury Bills**: Low-risk, short-term government debt (Base 5.2% APR).
2. **DePIN GPU Compute Farm**: High-yield computing equipment leases for AI training (Base 18.5% APR).
3. **Fractionalized Real Estate Debt**: Property mortgage obligations providing consistent rental return cash flows (Base 8.1% APR).

The portfolio allocation weights can be rebalanced dynamically on-chain by the fund owner to adjust risk/reward exposure.

---

## Deployed Contracts (BOT Chain Mainnet)

- **MockUSDT**: `0x499230690F80E0D9F6b08AeB150A514755bbef4E`
- **AIBasketFund (BARY Shares)**: `0x98C2f01597618B6F519B28953D10589E8162773F`

---

## BOT Chain Mainnet Parameters

Add manually to MetaMask if needed:
- **Network Name**: BOT Chain
- **RPC URL**: `https://rpc.botchain.ai`
- **Chain ID**: `677` (Hex: `0x2a5`)
- **Currency Symbol**: `BOT`
- **Block Explorer**: [https://scan.botchain.ai/](https://scan.botchain.ai/)

---

## Project Structure

- `contracts/`: Solidity smart contracts (BARY fund & mock USDT token).
- `scripts/`: Development and utility scripts:
  - `deploy.js`: Main Bohr Testnet deployment script.
  - `generate_txs.js`: Automated script to run 12 sequential on-chain transactions to build contract activity.
  - `check_balance.js`: Wallet balance scanner.
- `frontend/`: React + Vite + TypeScript dApp codebase.

---

## How to Get Started

### 1. Hardhat Setup & Interaction
Configure your environmental variables. Rename `.env.example` to `.env` and fill in:
```env
PRIVATE_KEY=your_private_key_here
```

To run the automated transaction generator script (submits 12 sequential Bohr Testnet transactions: Faucets, Approvals, Deposits, and Redemptions):
```bash
npm install
node scripts/generate_txs.js
```

### 2. Run the Frontend Locally
Navigate into the `frontend` folder, install dependencies, and start the development server:
```bash
cd frontend
npm install
npm run dev
```
Or run directly from the repository root:
```bash
npm run dev --prefix frontend
```

### 3. Deploy to Vercel
To deploy the frontend to Vercel:
1. Make sure you have the [Vercel CLI](https://vercel.com/cli) installed or connect your repository on the Vercel dashboard.
2. If deploying via the Vercel dashboard:
   - Select the repository.
   - Set the **Root Directory** to `frontend`.
   - The Framework Preset will automatically detect **Vite**.
   - Set the Build Command to `npm run build` and output directory to `dist`.
3. If using Vercel CLI, run:
   ```bash
   vercel
   ```
   Select your project and point to the `frontend` directory as the build root.
