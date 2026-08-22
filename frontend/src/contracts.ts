export const MOCK_USDT_ABI = [
  "function decimals() view returns (uint8)",
  "function balanceOf(address account) view returns (uint256)",
  "function approve(address spender, uint256 amount) returns (bool)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function faucet(address to, uint256 amount) returns (bool)"
];

export const AI_BASKET_FUND_ABI = [
  "function deposit(uint256 usdtAmount)",
  "function redeem(uint256 shareAmount)",
  "function balanceOf(address account) view returns (uint256)",
  "function totalSupply() view returns (uint256)",
  "function totalDepositedUSDT() view returns (uint256)",
  "function getAggregateApr() view returns (uint256)",
  "function getExchangeRate() view returns (uint256)",
  "function getPendingYield() view returns (uint256)",
  "function rebalance(uint256 w0, uint256 w1, uint256 w2)",
  "function getAsset(uint256 index) view returns (string name, uint256 weight, uint256 apr)",
  "event Deposited(address indexed user, uint256 usdtAmount, uint256 sharesMinted)",
  "event Redeemed(address indexed user, uint256 sharesRedeemed, uint256 usdtReturned)",
  "event Rebalanced(uint256 w0, uint256 w1, uint256 w2, uint256 newApr)",
  "event YieldAccrued(uint256 amount)"
];

// BOT Chain Mainnet deployed addresses (deployed via deploy_mainnet.js)
export const DEPLOYED_ADDRESSES = {
  MockUSDT: "0x499230690F80E0D9F6b08AeB150A514755bbef4E",
  AIBasketFund: "0x98C2f01597618B6F519B28953D10589E8162773F"
};

export const BOTCHAIN_MAINNET_PARAMS = {
  chainId: "0x2a5", // 677 in hex
  chainName: "BOT Chain",
  nativeCurrency: {
    name: "BOT Token",
    symbol: "BOT",
    decimals: 18
  },
  rpcUrls: ["https://rpc.botchain.ai"],
  blockExplorerUrls: ["https://scan.botchain.ai/"]
};
