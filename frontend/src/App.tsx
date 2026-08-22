import { useState, useEffect, useRef } from "react";
import { ethers } from "ethers";
import { 
  Shield, 
  TrendingUp, 
  Wallet, 
  Plus, 
  Minus, 
  AlertCircle, 
  Percent, 
  Activity, 
  Database, 
  Layers,
  ArrowRight,
  Info,
  DollarSign,
  Cpu,
  LineChart,
  Settings,
  HelpCircle,
  Clock,
  Sparkles
} from "lucide-react";
import { 
  MOCK_USDT_ABI, 
  AI_BASKET_FUND_ABI, 
  DEPLOYED_ADDRESSES, 
  BOTCHAIN_MAINNET_PARAMS 
} from "./contracts";
import "./App.css";

interface Transaction {
  type: "deposit" | "withdraw" | "rebalance" | "faucet";
  amount: string;
  asset: string;
  time: string;
  hash: string;
}

export default function App() {
  // Navigation State
  const [currentPage, setCurrentPage] = useState<"landing" | "dashboard" | "portfolio" | "agent" | "faucet">("landing");

  // Wallet state
  const [account, setAccount] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [contractOwner, setContractOwner] = useState<string | null>(null);

  // Contract instances (stored in refs to avoid re-renders)
  const providerRef = useRef<ethers.BrowserProvider | null>(null);
  const signerRef = useRef<ethers.JsonRpcSigner | null>(null);

  // Balances
  const [usdtBalance, setUsdtBalance] = useState("0.00");
  const [shareBalance, setShareBalance] = useState("0.00");
  const [usdtAllowance, setUsdtAllowance] = useState("0.00");
  const [accruedYield, setAccruedYield] = useState("0.000000");

  // Fund Metrics
  const [tvl, setTvl] = useState("0.00");
  const [exchangeRate, setExchangeRate] = useState("1.00");
  const [fundApr, setFundApr] = useState("0.00");

  // Assets weights & aprs
  const [assets, setAssets] = useState([
    { name: "US Treasury Bills (RWA)", weight: 40, apr: 5.2, color: "#6366f1" },
    { name: "DePIN GPU Farm (RWA/AI)", weight: 30, apr: 18.5, color: "#a855f7" },
    { name: "Real Estate Debt (RWA)", weight: 30, apr: 8.1, color: "#14b8a6" }
  ]);

  // Strategy Risk Profile Selector
  const [selectedRisk, setSelectedRisk] = useState<"conservative" | "balanced" | "aggressive">("balanced");
  const [pendingRebalance, setPendingRebalance] = useState<number[] | null>(null);

  // Forms
  const [depositAmount, setDepositAmount] = useState("");
  const [withdrawAmount, setWithdrawAmount] = useState("");

  // Interactive Yield Calculator States
  const [calcAmount, setCalcAmount] = useState("5000");
  const [calcRisk, setCalcRisk] = useState<"conservative" | "balanced" | "aggressive">("balanced");

  // Live transaction history state from event logs
  const [txHistory, setTxHistory] = useState<Transaction[]>([]);

  // Bohr Gas Overrides for Legacy Transactions
  const gasOverride = {
    type: 0,
    gasLimit: 3000000,
    gasPrice: ethers.parseUnits("20", "gwei")
  };

  // 1. Fetch Global Metrics on Mount & Periodically via Read-Only RPC Provider
  const loadGlobalMetrics = async () => {
    try {
      const provider = new ethers.JsonRpcProvider("https://rpc.botchain.ai");
      const fundContract = new ethers.Contract(DEPLOYED_ADDRESSES.AIBasketFund, AI_BASKET_FUND_ABI, provider);
      const usdtContract = new ethers.Contract(DEPLOYED_ADDRESSES.MockUSDT, MOCK_USDT_ABI, provider);

      // Read decimals
      const usdtDecimals = await usdtContract.decimals();

      // Read metrics
      const tvlRaw = await fundContract.totalDepositedUSDT();
      const rateRaw = await fundContract.getExchangeRate();
      const aprRaw = await fundContract.getAggregateApr();
      const ownerAddress = await fundContract.owner();

      const tvlFormatted = ethers.formatUnits(tvlRaw, usdtDecimals);
      const rateFormatted = ethers.formatUnits(rateRaw, 18);
      const aprFormatted = (Number(aprRaw) / 100).toFixed(2);

      setTvl(parseFloat(tvlFormatted).toLocaleString("en-US", { minimumFractionDigits: 2 }));
      setExchangeRate(rateFormatted);
      setFundApr(aprFormatted);
      setContractOwner(ownerAddress);

      // Read assets allocations
      const newAssets = [...assets];
      for (let i = 0; i < 3; i++) {
        const assetInfo = await fundContract.getAsset(i);
        newAssets[i] = {
          name: assetInfo[0],
          weight: Number(assetInfo[1]),
          apr: Number(assetInfo[2]) / 100,
          color: assets[i].color
        };
      }
      setAssets(newAssets);
    } catch (err) {
      console.error("Failed to load global on-chain metrics:", err);
    }
  };

  // 2. Fetch User Balances and allowances when MetaMask is connected
  const loadUserBalances = async (userAddress: string, provider: ethers.BrowserProvider) => {
    try {
      const usdtContract = new ethers.Contract(DEPLOYED_ADDRESSES.MockUSDT, MOCK_USDT_ABI, provider);
      const fundContract = new ethers.Contract(DEPLOYED_ADDRESSES.AIBasketFund, AI_BASKET_FUND_ABI, provider);

      const usdtDecimals = await usdtContract.decimals();
      const usdtBalRaw = await usdtContract.balanceOf(userAddress);
      const shareBalRaw = await fundContract.balanceOf(userAddress);
      const allowanceRaw = await usdtContract.allowance(userAddress, DEPLOYED_ADDRESSES.AIBasketFund);
      const pendingYieldRaw = await fundContract.getPendingYield();

      const usdtBalFormatted = ethers.formatUnits(usdtBalRaw, usdtDecimals);
      const shareBalFormatted = ethers.formatEther(shareBalRaw);
      const allowanceFormatted = ethers.formatUnits(allowanceRaw, usdtDecimals);
      const pendingYieldFormatted = ethers.formatUnits(pendingYieldRaw, usdtDecimals);

      setUsdtBalance(parseFloat(usdtBalFormatted).toFixed(2));
      setShareBalance(parseFloat(shareBalFormatted).toFixed(2));
      setUsdtAllowance(allowanceFormatted);
      setAccruedYield(parseFloat(pendingYieldFormatted).toFixed(6));

      // Load transactions from Event logs
      await fetchTxHistory(userAddress, provider);
    } catch (err) {
      console.error("Failed to load user balance data:", err);
    }
  };

  // 3. Query Deposited and Redeemed Event Logs from the blockchain
  const fetchTxHistory = async (userAddress: string, provider: ethers.BrowserProvider) => {
    try {
      const fundContract = new ethers.Contract(DEPLOYED_ADDRESSES.AIBasketFund, AI_BASKET_FUND_ABI, provider);
      
      const depositFilter = fundContract.filters.Deposited(userAddress);
      const depositEvents = (await fundContract.queryFilter(depositFilter, -100000)) as any[]; // query last 100,000 blocks

      const redeemFilter = fundContract.filters.Redeemed(userAddress);
      const redeemEvents = (await fundContract.queryFilter(redeemFilter, -100000)) as any[];

      const history: Transaction[] = [];

      for (const ev of depositEvents) {
        const amount = ethers.formatUnits(ev.args?.[1] || 0, 6);
        history.push({
          type: "deposit",
          amount: amount,
          asset: "USDT",
          time: `Block #${ev.blockNumber}`,
          hash: ev.transactionHash.substring(0, 6) + "..." + ev.transactionHash.substring(38)
        });
      }

      for (const ev of redeemEvents) {
        const amount = ethers.formatEther(ev.args?.[1] || 0);
        history.push({
          type: "withdraw",
          amount: amount,
          asset: "BARY",
          time: `Block #${ev.blockNumber}`,
          hash: ev.transactionHash.substring(0, 6) + "..." + ev.transactionHash.substring(38)
        });
      }

      // Sort by block number descending
      history.sort((a, b) => {
        const blockA = parseInt(a.time.replace("Block #", ""));
        const blockB = parseInt(b.time.replace("Block #", ""));
        return blockB - blockA;
      });

      setTxHistory(history);
    } catch (err) {
      console.error("Failed to fetch events:", err);
    }
  };

  // Global load & refresh loop
  useEffect(() => {
    loadGlobalMetrics();
    const interval = setInterval(() => {
      loadGlobalMetrics();
      if (isConnected && account && providerRef.current) {
        loadUserBalances(account, providerRef.current);
      }
    }, 4000);
    return () => clearInterval(interval);
  }, [isConnected, account]);

  // Listen for account/network changes
  useEffect(() => {
    const { ethereum } = window as any;
    if (ethereum && ethereum.on) {
      const handleChainChanged = () => {
        window.location.reload();
      };
      const handleAccountsChanged = (accounts: string[]) => {
        if (accounts.length === 0) {
          disconnectWallet();
        } else {
          setAccount(accounts[0]);
          if (providerRef.current) {
            providerRef.current.getSigner().then(s => {
              signerRef.current = s;
            }).catch(console.error);
          }
        }
      };

      ethereum.on("chainChanged", handleChainChanged);
      ethereum.on("accountsChanged", handleAccountsChanged);

      return () => {
        if (ethereum.removeListener) {
          ethereum.removeListener("chainChanged", handleChainChanged);
          ethereum.removeListener("accountsChanged", handleAccountsChanged);
        }
      };
    }
  }, []);

  // Connect Wallet logic
  const connectWallet = async () => {
    setErrorMsg(null);
    setLoading(true);
    try {
      const { ethereum } = window as any;
      if (!ethereum) {
        throw new Error("No crypto wallet found. Please install MetaMask.");
      }

      const accounts = await ethereum.request({ method: "eth_requestAccounts" });
      const currentAccount = accounts[0];
      setAccount(currentAccount);
      setIsConnected(true);
      
      const provider = new ethers.BrowserProvider(ethereum);
      providerRef.current = provider;
      const signer = await provider.getSigner();
      signerRef.current = signer;

      // Verify and switch network if necessary
      const network = await provider.getNetwork();
      const targetChainId = BigInt(BOTCHAIN_MAINNET_PARAMS.chainId);
      
      if (network.chainId !== targetChainId) {
        try {
          await ethereum.request({
            method: "wallet_switchEthereumChain",
            params: [{ chainId: BOTCHAIN_MAINNET_PARAMS.chainId }],
          });
        } catch (switchError: any) {
          if (switchError.code === 4902) {
            await ethereum.request({
              method: "wallet_addEthereumChain",
              params: [BOTCHAIN_MAINNET_PARAMS],
            });
          } else {
            throw switchError;
          }
        }
      }

      await loadUserBalances(currentAccount, provider);

    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || "Failed to connect wallet.");
      setIsConnected(false);
    } finally {
      setLoading(false);
    }
  };

  // Disconnect Wallet
  const disconnectWallet = () => {
    setAccount(null);
    setIsConnected(false);
    signerRef.current = null;
    providerRef.current = null;
    setUsdtBalance("0.00");
    setShareBalance("0.00");
    setUsdtAllowance("0.00");
    setAccruedYield("0.000000");
    setTxHistory([]);
  };

  // Faucet request on-chain
  const claimFaucet = async () => {
    try {
      setLoading(true);
      setErrorMsg(null);
      const signer = signerRef.current;
      if (!signer) return;

      const usdtContract = new ethers.Contract(DEPLOYED_ADDRESSES.MockUSDT, MOCK_USDT_ABI, signer);
      
      const tx = await usdtContract.faucet(account, ethers.parseUnits("1000", 6), gasOverride);
      await tx.wait();
      
      if (account && providerRef.current) {
        await loadUserBalances(account, providerRef.current);
      }
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.reason || err.message || "Faucet claim failed");
    } finally {
      setLoading(false);
    }
  };

  // Approve USDT on-chain
  const handleApprove = async () => {
    if (!depositAmount || parseFloat(depositAmount) <= 0) return;

    try {
      setLoading(true);
      setErrorMsg(null);
      const signer = signerRef.current;
      if (!signer) return;

      const usdtContract = new ethers.Contract(DEPLOYED_ADDRESSES.MockUSDT, MOCK_USDT_ABI, signer);
      const amtRaw = ethers.parseUnits(depositAmount, 6);

      const appTx = await usdtContract.approve(DEPLOYED_ADDRESSES.AIBasketFund, amtRaw, gasOverride);
      
      // Optimistically update allowance so the UI switches to "Deposit" button immediately
      setUsdtAllowance(depositAmount);

      await appTx.wait();

      if (account && providerRef.current) {
        await loadUserBalances(account, providerRef.current);
      }
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.reason || err.message || "Approval transaction failed");
      if (account && providerRef.current) {
        await loadUserBalances(account, providerRef.current);
      }
    } finally {
      setLoading(false);
    }
  };

  // Deposit USDT on-chain
  const handleDeposit = async () => {
    if (!depositAmount || parseFloat(depositAmount) <= 0) return;
    const amt = parseFloat(depositAmount);

    try {
      setLoading(true);
      setErrorMsg(null);
      const signer = signerRef.current;
      if (!signer) return;

      const fundContract = new ethers.Contract(DEPLOYED_ADDRESSES.AIBasketFund, AI_BASKET_FUND_ABI, signer);
      const amtRaw = ethers.parseUnits(depositAmount, 6);

      const tx = await fundContract.deposit(amtRaw, gasOverride);

      // OPTIMISTIC UPDATE: Deduct balance in real-time as soon as the user approves/signs in MetaMask
      const currentUsdt = parseFloat(usdtBalance) - amt;
      const rate = parseFloat(exchangeRate) || 1.0;
      const estimatedShares = amt / rate;
      const currentShares = parseFloat(shareBalance) + estimatedShares;

      setUsdtBalance(currentUsdt.toFixed(2));
      setShareBalance(currentShares.toFixed(2));
      setDepositAmount("");

      await tx.wait();

      if (account && providerRef.current) {
        await loadUserBalances(account, providerRef.current);
        await loadGlobalMetrics();
      }
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.reason || err.message || "Deposit transaction failed");
      if (account && providerRef.current) {
        await loadUserBalances(account, providerRef.current);
      }
    } finally {
      setLoading(false);
    }
  };

  // Withdraw / Redeem Shares on-chain
  const handleWithdraw = async () => {
    if (!withdrawAmount || parseFloat(withdrawAmount) <= 0) return;
    const amt = parseFloat(withdrawAmount);

    try {
      setLoading(true);
      setErrorMsg(null);
      const signer = signerRef.current;
      if (!signer) return;

      const fundContract = new ethers.Contract(DEPLOYED_ADDRESSES.AIBasketFund, AI_BASKET_FUND_ABI, signer);
      const amtRaw = ethers.parseEther(withdrawAmount);

      const tx = await fundContract.redeem(amtRaw, gasOverride);

      // OPTIMISTIC UPDATE: Deduct share balance in real-time as soon as user approves/signs in MetaMask
      const rate = parseFloat(exchangeRate) || 1.0;
      const returnedUsdt = amt * rate;
      const currentShares = parseFloat(shareBalance) - amt;
      const currentUsdt = parseFloat(usdtBalance) + returnedUsdt;

      setShareBalance(currentShares.toFixed(2));
      setUsdtBalance(currentUsdt.toFixed(2));
      setWithdrawAmount("");

      await tx.wait();

      if (account && providerRef.current) {
        await loadUserBalances(account, providerRef.current);
        await loadGlobalMetrics();
      }
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.reason || err.message || "Withdrawal failed");
      if (account && providerRef.current) {
        await loadUserBalances(account, providerRef.current);
      }
    } finally {
      setLoading(false);
    }
  };

  // Calculate targets when risk switches
  useEffect(() => {
    let targets = [40, 30, 30];
    if (selectedRisk === "conservative") targets = [70, 15, 15];
    if (selectedRisk === "balanced") targets = [40, 30, 30];
    if (selectedRisk === "aggressive") targets = [10, 70, 20];

    const currentWeights = assets.map(a => a.weight);
    const diff = currentWeights.some((w, idx) => w !== targets[idx]);
    if (diff) {
      setPendingRebalance(targets);
    } else {
      setPendingRebalance(null);
    }
  }, [selectedRisk, assets]);

  // Execute Rebalance on-chain (Owner only)
  const executeRebalance = async () => {
    if (!pendingRebalance) return;
    const [w0, w1, w2] = pendingRebalance;

    try {
      setLoading(true);
      setErrorMsg(null);
      const signer = signerRef.current;
      if (!signer) return;

      const fundContract = new ethers.Contract(DEPLOYED_ADDRESSES.AIBasketFund, AI_BASKET_FUND_ABI, signer);
      const tx = await fundContract.rebalance(w0, w1, w2, gasOverride);
      await tx.wait();

      setPendingRebalance(null);
      await loadGlobalMetrics();
      if (account && providerRef.current) {
        await loadUserBalances(account, providerRef.current);
      }
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.reason || err.message || "Rebalance transaction failed (Note: Only contract owner can execute rebalancing).");
    } finally {
      setLoading(false);
    }
  };

  // APR Yield Calculator Helper
  const getCalcResults = () => {
    const principal = parseFloat(calcAmount) || 0;
    let apr = 9.49;
    if (calcRisk === "conservative") apr = 6.61;
    if (calcRisk === "aggressive") apr = 15.09;
    
    const r = apr / 100;
    const year1 = principal * r;
    const year3 = principal * (Math.pow(1 + r, 3) - 1);
    
    return {
      apr,
      year1: year1.toFixed(2),
      year3: year3.toFixed(2),
      tbills: (principal * (calcRisk === "conservative" ? 0.70 : calcRisk === "balanced" ? 0.40 : 0.10)).toFixed(0),
      depin: (principal * (calcRisk === "conservative" ? 0.15 : calcRisk === "balanced" ? 0.30 : 0.70)).toFixed(0),
      estate: (principal * (calcRisk === "conservative" ? 0.15 : calcRisk === "balanced" ? 0.30 : 0.20)).toFixed(0),
    };
  };

  const calc = getCalcResults();

  // Check if current connected user is owner of the contract
  const isOwner = account && contractOwner && account.toLowerCase() === contractOwner.toLowerCase();

  return (
    <div className="app-container">
      {/* Header */}
      <header className="app-header">
        <div className="logo-section" onClick={() => setCurrentPage("landing")} style={{ cursor: "pointer" }}>
          <Shield className="logo-icon" size={32} />
          <h1>BARY</h1>
        </div>

        {currentPage !== "landing" && (
          <nav className="header-nav">
            <button className={`nav-tab ${currentPage === "dashboard" ? "active" : ""}`} onClick={() => setCurrentPage("dashboard")}>
              Dashboard
            </button>
            <button className={`nav-tab ${currentPage === "portfolio" ? "active" : ""}`} onClick={() => setCurrentPage("portfolio")}>
              Portfolio
            </button>
            <button className={`nav-tab ${currentPage === "agent" ? "active" : ""}`} onClick={() => setCurrentPage("agent")}>
              Fund Strategy
            </button>
            <button className={`nav-tab ${currentPage === "faucet" ? "active" : ""}`} onClick={() => setCurrentPage("faucet")}>
              Faucet & Docs
            </button>
          </nav>
        )}
        
        <div className="header-right">
          {currentPage !== "landing" && (
            <div className="network-badge">
              <span className="badge-dot"></span>
              <span>Bohr Testnet</span>
            </div>
          )}

          {isConnected && account ? (
            <div className="wallet-connected-container" style={{ display: "flex", gap: "8px", alignItems: "center" }}>
              <div className="connect-btn" style={{ cursor: "default" }}>
                <Wallet size={18} />
                {`${account.substring(0, 6)}...${account.substring(38)}`}
              </div>
              <button className="disconnect-btn" onClick={disconnectWallet} title="Disconnect Wallet">
                Disconnect
              </button>
            </div>
          ) : (
            <button className="connect-btn" onClick={connectWallet} disabled={loading}>
              <Wallet size={18} />
              {loading ? "Connecting..." : "Connect Wallet"}
            </button>
          )}

          {currentPage === "landing" && (
            <button className="app-launch-btn" onClick={() => setCurrentPage("dashboard")}>
              Launch App <ArrowRight size={16} />
            </button>
          )}
        </div>
      </header>

      {/* Error Message */}
      {errorMsg && (
        <div className="glass-panel" style={{ padding: "12px 20px", marginBottom: "20px", display: "flex", alignItems: "center", gap: "10px", borderColor: "rgba(239, 68, 68, 0.4)", background: "rgba(239, 68, 68, 0.05)" }}>
          <AlertCircle style={{ color: "#ef4444", flexShrink: 0 }} size={20} />
          <span style={{ fontSize: "0.9rem", color: "#f87171" }}>{errorMsg}</span>
        </div>
      )}

      {/* RENDER CURRENT PAGE */}

      {/* 1. LANDING PAGE */}
      {currentPage === "landing" && (
        <div className="landing-page">
          {/* Hero Section */}
          <section className="landing-hero">
            <div className="hero-badge">
              <Sparkles size={14} className="badge-icon" />
              <span>Decentralized On-Chain Real World Asset Management</span>
            </div>
            <h2 className="hero-title">
              Maximize Stablecoin Yields via <span className="highlight-text">Autonomous RWA</span> Pools
            </h2>
            <p className="hero-subtitle">
              BARY is a non-custodial decentralized yield basket that aggregates real-world asset collateral (US Treasury Bills, DePIN high-compute leasing, and Real Estate Debt) dynamically balanced on-chain on the Bohr network.
            </p>
            <div className="hero-ctas">
              <button className="cta-primary-btn" onClick={() => setCurrentPage("dashboard")}>
                Launch Yield Vault <ArrowRight size={18} />
              </button>
              <button className="cta-secondary-btn" onClick={() => setCurrentPage("faucet")}>
                Bohr Testnet Guide
              </button>
            </div>
          </section>

          {/* Quick Metrics Row */}
          <section className="landing-metrics">
            <div className="glass-panel metric-box">
              <span className="metric-num glow-text-primary">${tvl}</span>
              <span className="metric-lbl">Total Value Locked</span>
            </div>
            <div className="glass-panel metric-box">
              <span className="metric-num glow-text-secondary">{fundApr}%</span>
              <span className="metric-lbl">Aggregate APR</span>
            </div>
            <div className="glass-panel metric-box">
              <span className="metric-num glow-text-accent">100% Fully</span>
              <span className="metric-lbl">Collateralized RWAs</span>
            </div>
            <div className="glass-panel metric-box">
              <span className="metric-num glow-text-success">1s Blocks</span>
              <span className="metric-lbl">Bohr Chain Performance</span>
            </div>
          </section>

          {/* Core Asset Showcase */}
          <section className="landing-showcase">
            <h3 className="section-title">Diverse Real World Assets (RWA) Basket</h3>
            <p className="section-subtitle">BARY balances risk and return by packaging core yield sources on the blockchain.</p>
            
            <div className="showcase-grid">
              <div className="glass-panel asset-card-show">
                <div className="show-header">
                  <Database size={24} style={{ color: "#6366f1" }} />
                  <span className="show-badge" style={{ background: "rgba(99, 102, 241, 0.15)", color: "#6366f1" }}>Safe Haven</span>
                </div>
                <h4>US Treasury Bills</h4>
                <p>Backing the fund with low-risk short-term government debt obligations, yielding highly predictable returns.</p>
                <div className="show-stats">
                  <span>Current weight: <strong>{assets[0].weight}%</strong></span>
                  <span style={{ color: "#6366f1" }}>Base APR: <strong>5.2%</strong></span>
                </div>
              </div>

              <div className="glass-panel asset-card-show">
                <div className="show-header">
                  <Cpu size={24} style={{ color: "#a855f7" }} />
                  <span className="show-badge" style={{ background: "rgba(168, 85, 247, 0.15)", color: "#a855f7" }}>High Growth</span>
                </div>
                <h4>DePIN GPU Compute Farm</h4>
                <p>Yield derived from real compute equipment leased dynamically to machine learning teams and render hubs.</p>
                <div className="show-stats">
                  <span>Current weight: <strong>{assets[1].weight}%</strong></span>
                  <span style={{ color: "#a855f7" }}>Base APR: <strong>18.5%</strong></span>
                </div>
              </div>

              <div className="glass-panel asset-card-show">
                <div className="show-header">
                  <Layers size={24} style={{ color: "#14b8a6" }} />
                  <span className="show-badge" style={{ background: "rgba(20, 184, 166, 0.15)", color: "#14b8a6" }}>Income Focus</span>
                </div>
                <h4>Fractionalized Real Estate</h4>
                <p>Fractionalized mortgage assets. Backed by solid real estate debt obligations, compiling yields monthly.</p>
                <div className="show-stats">
                  <span>Current weight: <strong>{assets[2].weight}%</strong></span>
                  <span style={{ color: "#14b8a6" }}>Base APR: <strong>8.1%</strong></span>
                </div>
              </div>
            </div>
          </section>

          {/* Interactive Yield Calculator */}
          <section className="landing-calc glass-panel">
            <div className="calc-content">
              <h3>Estimate Your RWA Returns</h3>
              <p>Adjust the variables below to simulate expected yields with BARY's on-chain allocation modes.</p>
              
              <div className="calc-controls">
                <div className="input-group">
                  <label className="input-label">Deposit Amount (USDT)</label>
                  <div className="input-wrapper">
                    <span className="input-prefix">$</span>
                    <input 
                      type="number" 
                      className="input-field" 
                      value={calcAmount} 
                      onChange={e => setCalcAmount(e.target.value)} 
                    />
                  </div>
                  <input 
                    type="range" 
                    min="500" 
                    max="50000" 
                    step="500"
                    value={calcAmount} 
                    onChange={e => setCalcAmount(e.target.value)}
                    className="slider-input" 
                  />
                </div>

                <div className="input-group">
                  <label className="input-label">Fund Strategy Mode</label>
                  <div className="calc-risk-selector">
                    <button 
                      className={`risk-btn ${calcRisk === "conservative" ? "active" : ""}`} 
                      onClick={() => setCalcRisk("conservative")}
                    >
                      Conservative (6.61% APR)
                    </button>
                    <button 
                      className={`risk-btn ${calcRisk === "balanced" ? "active" : ""}`} 
                      onClick={() => setCalcRisk("balanced")}
                    >
                      Balanced (9.49% APR)
                    </button>
                    <button 
                      className={`risk-btn ${calcRisk === "aggressive" ? "active" : ""}`} 
                      onClick={() => setCalcRisk("aggressive")}
                    >
                      Aggressive (15.09% APR)
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div className="calc-display">
              <div className="calc-result-row">
                <div className="calc-res-item">
                  <span className="res-lbl">Expected 1-Year Return</span>
                  <span className="res-val glow-text-success">+${calc.year1} USDT</span>
                </div>
                <div className="calc-res-item">
                  <span className="res-lbl">Expected 3-Year Return</span>
                  <span className="res-val glow-text-accent">+${calc.year3} USDT</span>
                </div>
              </div>

              <div className="calc-composition-breakdown">
                <h5>Simulated Portfolio Split</h5>
                <div className="bar-stacked">
                  <div className="bar-segment" style={{ width: `${calcRisk === "conservative" ? 70 : calcRisk === "balanced" ? 40 : 10}%`, background: "#6366f1" }} title="US Treasury Bills"></div>
                  <div className="bar-segment" style={{ width: `${calcRisk === "conservative" ? 15 : calcRisk === "balanced" ? 30 : 70}%`, background: "#a855f7" }} title="GPU Compute Farm"></div>
                  <div className="bar-segment" style={{ width: `${calcRisk === "conservative" ? 15 : calcRisk === "balanced" ? 30 : 20}%`, background: "#14b8a6" }} title="Real Estate Debt"></div>
                </div>
                <div className="bar-labels">
                  <span className="bar-lbl-dot"><i style={{background:"#6366f1"}}></i> T-Bills: ${calc.tbills}</span>
                  <span className="bar-lbl-dot"><i style={{background:"#a855f7"}}></i> GPU Compute: ${calc.depin}</span>
                  <span className="bar-lbl-dot"><i style={{background:"#14b8a6"}}></i> Real Estate: ${calc.estate}</span>
                </div>
              </div>
            </div>
          </section>

          {/* Workflow Steps */}
          <section className="landing-workflow">
            <h3 className="section-title">Smart Yield Engine Loop</h3>
            <div className="workflow-steps">
              <div className="step-card">
                <div className="step-num">1</div>
                <h5>Deposit USDT</h5>
                <p>Deposit stablecoins on Bohr Testnet. Your capital is safe, locked in our yield-accruing vault smart contract.</p>
              </div>
              <div className="step-card">
                <div className="step-num">2</div>
                <h5>On-chain Weights Allocation</h5>
                <p>The fund aggregates USDT and allocates weights to US Treasury Bills, GPU Farm compute leases, and Property debt.</p>
              </div>
              <div className="step-card">
                <div className="step-num">3</div>
                <h5>Strategic Rebalancing</h5>
                <p>Owner rebalances weights periodically based on market yield indicators, adjusting allocations directly on-chain.</p>
              </div>
              <div className="step-card">
                <div className="step-num">4</div>
                <h5>Claim Earnings</h5>
                <p>Compounded yield accrues on-chain. Withdraw your USDT collateral + earned yield at any time.</p>
              </div>
            </div>
            <button className="cta-primary-btn" style={{ margin: "40px auto 0 auto" }} onClick={() => setCurrentPage("dashboard")}>
              Access Application Core
            </button>
          </section>
        </div>
      )}

      {/* 2. MAIN APP: DASHBOARD PAGE */}
      {currentPage === "dashboard" && (
        <div className="dashboard-page animate-fade-in">
          {/* Grid Stats */}
          <section className="stats-grid">
            <div className="glass-panel stat-card tvl">
              <div className="stat-header">
                <span>Total Value Locked</span>
                <Layers className="stat-icon" size={16} />
              </div>
              <div className="stat-value glow-text-primary">${tvl}</div>
              <div className="stat-subtext">USDT collateral in RWA vault</div>
            </div>

            <div className="glass-panel stat-card apr">
              <div className="stat-header">
                <span>Aggregate APR</span>
                <Percent className="stat-icon" size={16} />
              </div>
              <div className="stat-value glow-text-secondary">{fundApr}%</div>
              <div className="stat-subtext">Compounding asset returns</div>
            </div>

            <div className="glass-panel stat-card balance">
              <div className="stat-header">
                <span>Your Share Balance</span>
                <Database className="stat-icon" size={16} />
              </div>
              <div className="stat-value glow-text-accent">{shareBalance} BARY</div>
              <div className="stat-subtext">Worth: ${(parseFloat(shareBalance) * parseFloat(exchangeRate)).toFixed(2)} USDT</div>
            </div>

            <div className="glass-panel stat-card yield">
              <div className="stat-header">
                <span>Accrued Yield (Live)</span>
                <TrendingUp className="stat-icon" size={16} />
              </div>
              <div className="stat-value glow-text-success" style={{ fontFamily: "monospace" }}>{accruedYield}</div>
              <div className="stat-subtext">mUSDT yields generated</div>
            </div>
          </section>

          {!isConnected ? (
            <div className="glass-panel connect-wallet-prompt">
              <Wallet size={48} className="prompt-icon" />
              <h3>Connect Your Wallet</h3>
              <p>Please connect your MetaMask wallet on Bohr Testnet to mint shares, deposit USDT collateral, and view balances.</p>
              <button className="cta-primary-btn" onClick={connectWallet} disabled={loading}>
                {loading ? "Connecting..." : "Connect Wallet"}
              </button>
            </div>
          ) : (
            <div className="dashboard-grid">
              {/* Left Column - Composition Chart */}
              <div className="glass-panel dashboard-card">
                <h2 className="card-title">
                  <Layers size={20} className="glow-text-primary" />
                  Fund RWA Allocation
                </h2>
                
                <div className="composition-container">
                  <div className="chart-wrapper">
                    <div className="visual-chart">
                      <svg width="150" height="150" viewBox="0 0 42 42">
                        <circle className="svg-donut-hole" cx="21" cy="21" r="15.915"></circle>
                        <circle className="svg-donut-ring" cx="21" cy="21" r="15.915" strokeWidth="3"></circle>
                        
                        {/* Drawing overlapping segments */}
                        {(() => {
                          let accumulatedOffset = 0;
                          return assets.map((asset, index) => {
                            const strokeDash = `${asset.weight} ${100 - asset.weight}`;
                            const strokeOffset = 100 - accumulatedOffset;
                            accumulatedOffset += asset.weight;
                            return (
                              <circle
                                key={index}
                                className="svg-donut-segment"
                                cx="21"
                                cy="21"
                                r="15.915"
                                stroke={asset.color}
                                strokeWidth="3.5"
                                strokeDasharray={strokeDash}
                                strokeDashoffset={strokeOffset}
                              ></circle>
                            );
                          });
                        })()}
                      </svg>
                      <div className="chart-center-label">
                        <span className="chart-center-value">{fundApr}%</span>
                        <span className="chart-center-text">Est. APR</span>
                      </div>
                    </div>

                    <div className="asset-details-list">
                      {assets.map((asset, index) => (
                        <div className="asset-item" key={index}>
                          <div className="asset-meta">
                            <span className="asset-name-wrapper">
                              <span className="asset-color-dot" style={{ backgroundColor: asset.color }}></span>
                              {asset.name}
                            </span>
                            <div className="asset-values">
                              <span>Allocation: <strong>{asset.weight}%</strong></span>
                              <span className="asset-apr">APR: {asset.apr.toFixed(1)}%</span>
                            </div>
                          </div>
                          <div className="asset-progress-bar-bg">
                            <div 
                              className="asset-progress-bar-fill" 
                              style={{ width: `${asset.weight}%`, backgroundColor: asset.color }}
                            ></div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Right Column - Swap Forms */}
              <div className="vault-actions-hub">
                {/* Deposit Card */}
                <div className="glass-panel action-card" style={{ marginBottom: "20px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
                    <h2 className="card-title" style={{ border: "none", marginBottom: 0, paddingBottom: 0 }}>
                      <Plus size={20} className="glow-text-success" />
                      Deposit USDT
                    </h2>
                    <button className="faucet-btn" onClick={claimFaucet} disabled={loading}>
                      mUSDT Faucet
                    </button>
                  </div>
                  
                  <div className="input-group">
                    <div className="input-label">
                      <span>Amount to Deposit</span>
                      <span>Balance: {usdtBalance} mUSDT</span>
                    </div>
                    <div className="input-wrapper">
                      <input 
                        type="number" 
                        className="input-field" 
                        placeholder="0.00" 
                        value={depositAmount}
                        onChange={e => setDepositAmount(e.target.value)}
                        disabled={loading}
                      />
                      <span className="input-suffix">USDT</span>
                    </div>
                  </div>

                  {parseFloat(usdtAllowance) < (parseFloat(depositAmount) || 0) ? (
                    <button 
                      className="action-btn deposit-btn" 
                      onClick={handleApprove} 
                      disabled={loading || !depositAmount || parseFloat(depositAmount) <= 0}
                      style={{ background: "linear-gradient(135deg, #f59e0b 0%, #d97706 100%)", border: "none" }}
                    >
                      {loading ? "Approving..." : "Approve USDT"}
                    </button>
                  ) : (
                    <button 
                      className="action-btn deposit-btn" 
                      onClick={handleDeposit} 
                      disabled={loading || !depositAmount || parseFloat(depositAmount) <= 0}
                    >
                      {loading ? "Confirming..." : "Deposit & Mint Share"}
                    </button>
                  )}
                </div>

                {/* Withdrawal Card */}
                <div className="glass-panel action-card">
                  <h2 className="card-title">
                    <Minus size={20} className="glow-text-danger" />
                    Redeem Shares
                  </h2>

                  <div className="input-group">
                    <div className="input-label">
                      <span>Amount of Shares</span>
                      <span>Available: {shareBalance} BARY</span>
                    </div>
                    <div className="input-wrapper">
                      <input 
                        type="number" 
                        className="input-field" 
                        placeholder="0.00" 
                        value={withdrawAmount}
                        onChange={e => setWithdrawAmount(e.target.value)}
                        disabled={loading}
                      />
                      <span className="input-suffix">BARY</span>
                    </div>
                  </div>

                  <button 
                    className="action-btn withdraw-btn" 
                    onClick={handleWithdraw} 
                    disabled={loading || !withdrawAmount || parseFloat(withdrawAmount) <= 0}
                  >
                    {loading ? "Confirming..." : "Redeem BARY Shares"}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 3. PORTFOLIO ANALYTICS PAGE */}
      {currentPage === "portfolio" && (
        <div className="portfolio-page animate-fade-in">
          {/* Stats Bar */}
          <section className="stats-grid">
            <div className="glass-panel stat-card balance">
              <div className="stat-header">
                <span>Holdings Value</span>
                <DollarSign className="stat-icon" size={16} />
              </div>
              <div className="stat-value glow-text-accent">${(parseFloat(shareBalance) * parseFloat(exchangeRate)).toFixed(2)} USDT</div>
              <div className="stat-subtext">Current basket valuation</div>
            </div>

            <div className="glass-panel stat-card yield">
              <div className="stat-header">
                <span>Total Yield Earned</span>
                <TrendingUp className="stat-icon" size={16} />
              </div>
              <div className="stat-value glow-text-success">${accruedYield} USDT</div>
              <div className="stat-subtext">Accrued since deposit</div>
            </div>

            <div className="glass-panel stat-card apr">
              <div className="stat-header">
                <span>Weighted Yield Rate</span>
                <Percent className="stat-icon" size={16} />
              </div>
              <div className="stat-value glow-text-secondary">{fundApr}% APR</div>
              <div className="stat-subtext">Current strategy yield rate</div>
            </div>

            <div className="glass-panel stat-card tvl">
              <div className="stat-header">
                <span>Your Share Ratio</span>
                <Layers className="stat-icon" size={16} />
              </div>
              <div className="stat-value glow-text-primary">
                {parseFloat(shareBalance) > 0 ? ((parseFloat(shareBalance) / (parseFloat(tvl.replace(/,/g, "")) || 1)) * 100).toFixed(4) : "0.0000"}%
              </div>
              <div className="stat-subtext">Share of BARY pool capital</div>
            </div>
          </section>

          {!isConnected ? (
            <div className="glass-panel connect-wallet-prompt">
              <Wallet size={48} className="prompt-icon" />
              <h3>Connect Your Wallet</h3>
              <p>Please connect your MetaMask wallet on Bohr Testnet to query on-chain transactions and projected earnings.</p>
              <button className="cta-primary-btn" onClick={connectWallet} disabled={loading}>
                Connect Wallet
              </button>
            </div>
          ) : (
            <div>
              {/* Performance Chart & Yield Growth Projection */}
              <div className="dashboard-grid">
                <div className="glass-panel dashboard-card">
                  <h2 className="card-title">
                    <LineChart size={20} className="glow-text-accent" />
                    Yield Performance Tracker
                  </h2>
                  
                  <div className="chart-container" style={{ padding: "10px 0" }}>
                    <div style={{ position: "relative", width: "100%", height: "200px" }}>
                      <svg viewBox="0 0 500 180" width="100%" height="180" style={{ overflow: "visible" }}>
                        <defs>
                          <linearGradient id="gradient-area" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#14b8a6" stopOpacity="0.4" />
                            <stop offset="100%" stopColor="#14b8a6" stopOpacity="0.0" />
                          </linearGradient>
                        </defs>
                        <line x1="50" y1="10" x2="480" y2="10" stroke="rgba(255,255,255,0.05)" />
                        <line x1="50" y1="50" x2="480" y2="50" stroke="rgba(255,255,255,0.05)" />
                        <line x1="50" y1="90" x2="480" y2="90" stroke="rgba(255,255,255,0.05)" />
                        <line x1="50" y1="130" x2="480" y2="130" stroke="rgba(255,255,255,0.05)" />
                        <line x1="50" y1="150" x2="480" y2="150" stroke="rgba(255,255,255,0.2)" strokeWidth="1" />
                        
                        <path
                          d="M 50 150 Q 120 135 180 110 T 310 80 T 420 50 T 480 35 L 480 150 Z"
                          fill="url(#gradient-area)"
                        />
                        <path
                          d="M 50 150 Q 120 135 180 110 T 310 80 T 420 50 T 480 35"
                          fill="none"
                          stroke="#14b8a6"
                          strokeWidth="3.5"
                        />

                        <circle cx="180" cy="110" r="5" fill="#14b8a6" stroke="#030712" strokeWidth="2" />
                        <circle cx="310" cy="80" r="5" fill="#14b8a6" stroke="#030712" strokeWidth="2" />
                        <circle cx="420" cy="50" r="5" fill="#14b8a6" stroke="#030712" strokeWidth="2" />
                        <circle cx="480" cy="35" r="5.5" fill="#10b981" stroke="#030712" strokeWidth="2" />
                        
                        <text x="45" y="170" fill="#64748b" fontSize="9" textAnchor="middle">Aug 17</text>
                        <text x="180" y="170" fill="#64748b" fontSize="9" textAnchor="middle">Aug 18</text>
                        <text x="310" y="170" fill="#64748b" fontSize="9" textAnchor="middle">Aug 19</text>
                        <text x="420" y="170" fill="#64748b" fontSize="9" textAnchor="middle">Aug 20</text>
                        <text x="480" y="170" fill="#10b981" fontSize="9" fontWeight="bold" textAnchor="middle">Today</text>
                        
                        <text x="35" y="152" fill="#64748b" fontSize="9" textAnchor="end">$0.00</text>
                        <text x="35" y="94" fill="#64748b" fontSize="9" textAnchor="end">$500.00</text>
                        <text x="35" y="38" fill="#64748b" fontSize="9" textAnchor="end">$1,000.00</text>
                      </svg>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", marginTop: "15px", padding: "0 10px", fontSize: "0.85rem", color: "#94a3b8" }}>
                      <span>* Simulated performance tracks compounded yield growth of $10k base capital in Balanced strategy.</span>
                    </div>
                  </div>
                </div>

                {/* Projections Card */}
                <div className="glass-panel dashboard-card">
                  <h2 className="card-title">
                    <TrendingUp size={20} className="glow-text-success" />
                    Yield Projections
                  </h2>
                  
                  <div className="yield-projection-panel">
                    <div className="projection-row">
                      <div className="proj-item">
                        <span className="proj-lbl">1-Month Projected</span>
                        <span className="proj-val" style={{ color: "#ffffff" }}>
                          +${((parseFloat(shareBalance) * parseFloat(exchangeRate) * parseFloat(fundApr)) / 100 / 12).toFixed(2)} USDT
                        </span>
                      </div>
                      <div className="proj-item">
                        <span className="proj-lbl">1-Year Projected</span>
                        <span className="proj-val glow-text-success">
                          +${((parseFloat(shareBalance) * parseFloat(exchangeRate) * parseFloat(fundApr)) / 100).toFixed(2)} USDT
                        </span>
                      </div>
                    </div>

                    <div className="projection-details" style={{ marginTop: "24px", display: "flex", flexDirection: "column", gap: "12px" }}>
                      <h5>Asset Allocations Breakdown</h5>
                      {assets.map((asset, i) => {
                        const allocatedAmount = parseFloat(shareBalance) * parseFloat(exchangeRate) * (asset.weight / 100);
                        return (
                          <div key={i} style={{ display: "flex", justifyContent: "space-between", fontSize: "0.85rem", padding: "8px 0", borderBottom: "1px solid rgba(255,255,255,0.02)" }}>
                            <span style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                              <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: asset.color }}></span>
                              {asset.name}
                            </span>
                            <span>${allocatedAmount.toFixed(2)} USDT ({asset.weight}%)</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>

              {/* Transaction History Section */}
              <div className="glass-panel dashboard-card" style={{ marginTop: "24px" }}>
                <h2 className="card-title">
                  <Clock size={20} className="glow-text-primary" />
                  On-chain Vault Activity Logs
                </h2>
                <div className="table-responsive">
                  {txHistory.length === 0 ? (
                    <p style={{ textAlign: "center", color: "#94a3b8", padding: "20px 0" }}>No matching vault interactions found for this wallet on-chain.</p>
                  ) : (
                    <table className="history-table">
                      <thead>
                        <tr>
                          <th>Action</th>
                          <th>Asset</th>
                          <th>Value (USDT / Shares)</th>
                          <th>Confirm Block</th>
                          <th>TX Hash</th>
                          <th>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {txHistory.map((tx, idx) => (
                          <tr key={idx}>
                            <td>
                              <span className={`tx-type-tag ${tx.type}`}>
                                {tx.type.toUpperCase()}
                              </span>
                            </td>
                            <td style={{ fontWeight: 600 }}>{tx.asset}</td>
                            <td>{tx.amount}</td>
                            <td style={{ color: "#94a3b8" }}>{tx.time}</td>
                            <td>
                              <a 
                                href={`https://scan.botchain.ai/tx/0x${tx.hash.replace("...", "")}`} 
                                target="_blank" 
                                rel="noreferrer" 
                                style={{ fontFamily: "monospace", color: "#6366f1", textDecoration: "none" }}
                              >
                                {tx.hash}
                              </a>
                            </td>
                            <td>
                              <span className="tx-status-success">✓ Confirmed</span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 4. FUND STRATEGY PAGE */}
      {currentPage === "agent" && (
        <div className="agent-page animate-fade-in">
          <div className="dashboard-grid">
            {/* Strategy Controls */}
            <div className="glass-panel dashboard-card">
              <h2 className="card-title">
                <Settings size={20} className="glow-text-secondary" />
                Portfolio Allocation Strategy
              </h2>
              
              <div className="strategy-selectors" style={{ marginTop: "20px" }}>
                <div 
                  className={`strategy-option ${selectedRisk === "conservative" ? "selected" : ""}`}
                  onClick={() => !loading && setSelectedRisk("conservative")}
                >
                  <div className="strategy-info">
                    <span className="strategy-name">Conservative Mode</span>
                    <span className="strategy-desc">70% T-Bills (Low Risk RWA)</span>
                  </div>
                  <span className="strategy-apr-badge">~6.61% APR</span>
                </div>

                <div 
                  className={`strategy-option ${selectedRisk === "balanced" ? "selected" : ""}`}
                  onClick={() => !loading && setSelectedRisk("balanced")}
                >
                  <div className="strategy-info">
                    <span className="strategy-name">Balanced Portfolio</span>
                    <span className="strategy-desc">40% T-Bills, 30% GPU, 30% RE</span>
                  </div>
                  <span className="strategy-apr-badge">~9.49% APR</span>
                </div>

                <div 
                  className={`strategy-option ${selectedRisk === "aggressive" ? "selected" : ""}`}
                  onClick={() => !loading && setSelectedRisk("aggressive")}
                >
                  <div className="strategy-info">
                    <span className="strategy-name">Aggressive Yield</span>
                    <span className="strategy-desc">70% GPU DePIN RWA/AI Focus</span>
                  </div>
                  <span className="strategy-apr-badge">~15.09% APR</span>
                </div>
              </div>

              {pendingRebalance && (
                <div style={{ marginTop: "20px" }}>
                  {isOwner ? (
                    <div>
                      <button 
                        className="action-btn deposit-btn" 
                        style={{ background: "linear-gradient(135deg, var(--primary) 0%, var(--secondary) 100%)", border: "none" }}
                        onClick={executeRebalance}
                        disabled={loading}
                      >
                        {loading ? "Confirming on-chain..." : "Apply Rebalance Transaction"}
                      </button>
                      <p style={{ fontSize: "0.75rem", color: "#fcd34d", marginTop: "8px", textAlign: "center" }}>
                        * You are the Owner. Adjusting these weights triggers a real contract transaction.
                      </p>
                    </div>
                  ) : (
                    <div style={{ padding: "12px", background: "rgba(255,255,255,0.02)", borderRadius: "8px", border: "1px solid rgba(255,255,255,0.05)", textAlign: "center" }}>
                      <span style={{ fontSize: "0.8rem", color: "#94a3b8" }}>
                        Allocation weights are out of alignment. (Only the owner contract deployer wallet can rebalance on-chain).
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Target Weights Comparisons */}
            <div className="glass-panel dashboard-card">
              <h2 className="card-title">
                <Activity size={20} className="glow-text-primary" />
                Target Allocations vs Current
              </h2>
              
              <div className="composition-compare-panel" style={{ display: "flex", flexDirection: "column", gap: "20px", marginTop: "20px" }}>
                {assets.map((asset, i) => {
                  let targetWeight = asset.weight;
                  if (pendingRebalance) {
                    targetWeight = pendingRebalance[i];
                  } else {
                    if (selectedRisk === "conservative") targetWeight = i === 0 ? 70 : i === 1 ? 15 : 15;
                    if (selectedRisk === "balanced") targetWeight = i === 0 ? 40 : i === 1 ? 30 : 30;
                    if (selectedRisk === "aggressive") targetWeight = i === 0 ? 10 : i === 1 ? 70 : 20;
                  }
                  
                  return (
                    <div key={i} className="comparison-item">
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.9rem", marginBottom: "6px" }}>
                        <span style={{ fontWeight: 600 }}>{asset.name}</span>
                        <span>Current: {asset.weight}% → Target: {targetWeight}%</span>
                      </div>
                      
                      <div className="dual-progress-bar">
                        <div className="prog-bar-container">
                          <span className="lbl">Current</span>
                          <div className="bar-bg">
                            <div className="bar-fill" style={{ width: `${asset.weight}%`, background: asset.color }}></div>
                          </div>
                        </div>
                        <div className="prog-bar-container">
                          <span className="lbl">Target</span>
                          <div className="bar-bg dash-border">
                            <div className="bar-fill" style={{ width: `${targetWeight}%`, background: asset.color, opacity: 0.6 }}></div>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 5. FAUCET & DOCS PAGE */}
      {currentPage === "faucet" && (
        <div className="faucet-page animate-fade-in">
          <div className="dashboard-grid">
            {/* Faucet Box */}
            <div className="glass-panel dashboard-card">
              <h2 className="card-title">
                <Plus size={20} className="glow-text-success" />
                Bohr Testnet mUSDT Faucet
              </h2>
              
              <div style={{ marginTop: "20px" }}>
                <p style={{ fontSize: "0.95rem", color: "#cbd5e1", marginBottom: "20px" }}>
                  To test deposits and redemptions in our Yield Fund contract, claim mock USDT (mUSDT) tokens directly to your wallet.
                </p>

                <div className="faucet-display-info" style={{ background: "rgba(255,255,255,0.02)", padding: "16px", borderRadius: "12px", border: "1px solid rgba(255,255,255,0.05)", marginBottom: "20px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "10px" }}>
                    <span>Your mUSDT Balance:</span>
                    <strong style={{ color: "#ffffff" }}>{usdtBalance} mUSDT</strong>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span>Your BARY Share Balance:</span>
                    <strong style={{ color: "#14b8a6" }}>{shareBalance} BARY</strong>
                  </div>
                </div>

                {!isConnected ? (
                  <button className="action-btn deposit-btn" onClick={connectWallet} disabled={loading}>
                    Connect Wallet to Claim Faucet
                  </button>
                ) : (
                  <button 
                    className="action-btn deposit-btn" 
                    style={{ background: "linear-gradient(135deg, #10b981 0%, #059669 100%)", border: "none" }}
                    onClick={claimFaucet} 
                    disabled={loading}
                  >
                    {loading ? "Claiming..." : "Claim 1,000 mUSDT Faucet Tokens"}
                  </button>
                )}
              </div>
            </div>

            {/* Bohr connection parameters */}
            <div className="glass-panel dashboard-card">
              <h2 className="card-title">
                <Info size={20} className="glow-text-primary" />
                Bohr Network Parameters
              </h2>
              
              <div style={{ marginTop: "20px", display: "flex", flexDirection: "column", gap: "12px", fontSize: "0.85rem" }}>
                <p style={{ color: "#cbd5e1", marginBottom: "8px" }}>Configure MetaMask manually if the app is unable to switch automatically:</p>
                <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid rgba(255,255,255,0.02)" }}>
                  <span style={{ color: "#94a3b8" }}>Network Name</span>
                  <span style={{ fontWeight: 600, color: "#ffffff" }}>BOT Chain</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid rgba(255,255,255,0.02)" }}>
                  <span style={{ color: "#94a3b8" }}>New RPC URL</span>
                  <span style={{ fontFamily: "monospace", color: "#6366f1" }}>https://rpc.botchain.ai</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid rgba(255,255,255,0.02)" }}>
                  <span style={{ color: "#94a3b8" }}>Chain ID</span>
                  <span style={{ color: "#ffffff" }}>677</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid rgba(255,255,255,0.02)" }}>
                  <span style={{ color: "#94a3b8" }}>Currency Symbol</span>
                  <span style={{ color: "#ffffff" }}>BOT</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0" }}>
                  <span style={{ color: "#94a3b8" }}>Block Explorer</span>
                  <a href="https://scan.botchain.ai" target="_blank" rel="noreferrer" style={{ color: "#14b8a6", textDecoration: "none" }}>https://scan.botchain.ai</a>
                </div>
              </div>
            </div>
          </div>

          {/* Specifications Docs */}
          <div className="glass-panel dashboard-card" style={{ marginTop: "24px" }}>
            <h2 className="card-title">
              <HelpCircle size={20} className="glow-text-secondary" />
              Smart Contract Specifications
            </h2>
            
            <div style={{ marginTop: "20px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "24px" }} className="specifications-split">
              <div>
                <h4 style={{ color: "#ffffff", marginBottom: "10px", fontSize: "1.05rem" }}>AIBasketFund Contract</h4>
                <p style={{ fontSize: "0.85rem", color: "#94a3b8", lineHeight: "1.6" }}>
                  The yield basket smart contract. It handles USDT collateral deposits, mints BARY vault shares, and distributes fractional yields on-chain.
                </p>
                <div style={{ marginTop: "12px", background: "rgba(0,0,0,0.2)", padding: "10px", borderRadius: "8px", fontSize: "0.8rem", fontFamily: "monospace" }}>
                  Address: {DEPLOYED_ADDRESSES.AIBasketFund}
                </div>
              </div>

              <div>
                <h4 style={{ color: "#ffffff", marginBottom: "10px", fontSize: "1.05rem" }}>MockUSDT ERC20 Contract</h4>
                <p style={{ fontSize: "0.85rem", color: "#94a3b8", lineHeight: "1.6" }}>
                  A mock stablecoin contract simulating USDT properties with 6-decimals precision, which is used to interact with the fund and test faucet functionalities.
                </p>
                <div style={{ marginTop: "12px", background: "rgba(0,0,0,0.2)", padding: "10px", borderRadius: "8px", fontSize: "0.8rem", fontFamily: "monospace" }}>
                  Address: {DEPLOYED_ADDRESSES.MockUSDT}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="app-footer">
        <p>&copy; 2026 Bohr AI-RWA Yield Fund (BARY). Built for BOT Chain Builder Challenge #2.</p>
        <div className="footer-links">
          <a href="https://scan.botchain.ai" className="footer-link" target="_blank" rel="noreferrer">Block Explorer</a>
          <a href="https://faucet.botchain.ai" className="footer-link" target="_blank" rel="noreferrer">Faucet</a>
          <a href="https://dev-docs.botchain.ai" className="footer-link" target="_blank" rel="noreferrer">Developer Docs</a>
        </div>
      </footer>
    </div>
  );
}
