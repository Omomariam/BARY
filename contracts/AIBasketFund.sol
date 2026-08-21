// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract AIBasketFund is ERC20, Ownable {
    IERC20 public immutable usdt;

    struct Asset {
        string name;
        uint256 weight; // in percentage (e.g., 40 for 40%)
        uint256 apr;    // in basis points (e.g., 520 for 5.2%)
    }

    Asset[3] public assets;
    
    // Track the total USDT deposited by users
    uint256 public totalDepositedUSDT;
    
    // Track the last time we updated the yield
    uint256 public lastYieldUpdateTime;
    
    // Track yield distribution speedup factor (for demo purposes)
    uint256 public constant YIELD_SPEEDUP = 100; // 100x faster yield for hackathon demo!

    event Deposited(address indexed user, uint256 usdtAmount, uint256 sharesMinted);
    event Redeemed(address indexed user, uint256 sharesRedeemed, uint256 usdtReturned);
    event Rebalanced(uint256 w0, uint256 w1, uint256 w2, uint256 newApr);
    event YieldAccrued(uint256 amount);

    constructor(address _usdtAddress) 
        ERC20("Bohr AI-RWA Yield Share", "BARY") 
        Ownable(msg.sender) 
    {
        usdt = IERC20(_usdtAddress);
        
        // Initialize assets
        assets[0] = Asset("US Treasury Bills", 40, 520); // 40% weight, 5.2% APR
        assets[1] = Asset("DePIN GPU Farm", 30, 1850);    // 30% weight, 18.5% APR
        assets[2] = Asset("Real Estate Debt", 30, 810);   // 30% weight, 8.1% APR
        
        lastYieldUpdateTime = block.timestamp;
    }

    // Get the aggregate APR in basis points
    function getAggregateApr() public view returns (uint256) {
        return (assets[0].weight * assets[0].apr + 
                assets[1].weight * assets[1].apr + 
                assets[2].weight * assets[2].apr) / 100;
    }

    // Calculate total yield accrued since last update
    function getPendingYield() public view returns (uint256) {
        if (totalDepositedUSDT == 0) return 0;
        uint256 timeElapsed = block.timestamp - lastYieldUpdateTime;
        uint256 aggregateApr = getAggregateApr(); // in bps (e.g. 950 for 9.5%)
        
        // Yield = Principal * APR * Time / (365 days)
        // With 100x speedup for demo, we multiply timeElapsed by YIELD_SPEEDUP
        uint256 yield = (totalDepositedUSDT * aggregateApr * timeElapsed * YIELD_SPEEDUP) / (365 days * 10000);
        return yield;
    }

    // Update the fund value by compounding pending yield
    function updateYield() public {
        uint256 pending = getPendingYield();
        if (pending > 0) {
            // In a real fund, the contract would receive this yield in USDT from RWA cashflows.
            // For this testnet demo, we simulate yield by increasing the fund value.
            emit YieldAccrued(pending);
        }
        lastYieldUpdateTime = block.timestamp;
    }

    // Get the current exchange rate: USDT per BARY share (scaled by 1e18 for precision)
    // 1 BARY share = (Total USDT Value * 1e18) / Total BARY Supply
    function getExchangeRate() public view returns (uint256) {
        uint256 supply = totalSupply();
        if (supply == 0) {
            return 10**6; // 1 BARY (18 dec) = 1 USDT (6 dec). Rate = 10**6
        }
        
        uint256 totalFundValue = totalDepositedUSDT + getPendingYield();
        // Return rate: (totalFundValue in USDT units * 1e18) / supply
        return (totalFundValue * 1e18) / supply;
    }

    // Deposit USDT to mint BARY shares
    function deposit(uint256 usdtAmount) public {
        require(usdtAmount > 0, "Amount must be > 0");
        
        updateYield();
        
        uint256 rate = getExchangeRate(); // USDT units per BARY (scaled by 1e18)
        
        // Transfer USDT to this contract
        require(usdt.transferFrom(msg.sender, address(this), usdtAmount), "USDT transfer failed");
        
        // Calculate BARY shares to mint
        // shares = usdtAmount * 1e18 / rate
        uint256 sharesToMint = (usdtAmount * 1e18) / rate;
        
        totalDepositedUSDT += usdtAmount;
        _mint(msg.sender, sharesToMint);
        
        emit Deposited(msg.sender, usdtAmount, sharesToMint);
    }

    // Redeem BARY shares for USDT (Principal + Yield)
    function redeem(uint256 shareAmount) public {
        require(shareAmount > 0, "Amount must be > 0");
        require(balanceOf(msg.sender) >= shareAmount, "Insufficient share balance");
        
        updateYield();
        
        uint256 rate = getExchangeRate();
        
        // Calculate USDT to return
        // usdtAmount = shareAmount * rate / 1e18
        uint256 usdtToReturn = (shareAmount * rate) / 1e18;
        
        // Burn the user's shares
        _burn(msg.sender, shareAmount);
        
        // Update total deposited USDT (making sure we don't underflow)
        if (totalDepositedUSDT >= usdtToReturn) {
            totalDepositedUSDT -= usdtToReturn;
        } else {
            totalDepositedUSDT = 0;
        }
        
        // Transfer USDT to user
        uint256 contractUsdtBalance = usdt.balanceOf(address(this));
        if (usdtToReturn > contractUsdtBalance) {
            usdtToReturn = contractUsdtBalance;
        }
        
        require(usdt.transfer(msg.sender, usdtToReturn), "USDT transfer failed");
        
        emit Redeemed(msg.sender, shareAmount, usdtToReturn);
    }

    // Rebalance asset weights (Callable by Owner or designated AI Agent role)
    function rebalance(uint256 w0, uint256 w1, uint256 w2) public onlyOwner {
        require(w0 + w1 + w2 == 100, "Weights must sum to 100");
        
        updateYield();
        
        assets[0].weight = w0;
        assets[1].weight = w1;
        assets[2].weight = w2;
        
        emit Rebalanced(w0, w1, w2, getAggregateApr());
    }

    // Get asset details
    function getAsset(uint256 index) public view returns (string memory name, uint256 weight, uint256 apr) {
        require(index < 3, "Invalid asset index");
        return (assets[index].name, assets[index].weight, assets[index].apr);
    }
}
