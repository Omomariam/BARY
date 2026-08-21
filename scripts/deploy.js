import { ethers } from "ethers";
import fs from "fs";
import path from "path";
import "dotenv/config";

async function main() {
  console.log("Starting deployment on Bohr Testnet...");

  const privateKey = process.env.PRIVATE_KEY;
  if (!privateKey) {
    throw new Error("No PRIVATE_KEY found in .env");
  }

  const provider = new ethers.JsonRpcProvider("https://rpc.bohr.life");
  const wallet = new ethers.Wallet(privateKey, provider);
  console.log("Deploying contracts with the account:", wallet.address);

  const balance = await provider.getBalance(wallet.address);
  console.log("Account balance:", ethers.formatEther(balance), "BOT");

  // Fetch nonce explicitly
  const nonce = await provider.getTransactionCount(wallet.address);
  console.log("Using Nonce:", nonce);

  // Read compiled artifacts
  const mockUSDTArtifact = JSON.parse(
    fs.readFileSync(
      path.resolve("./artifacts/contracts/MockUSDT.sol/MockUSDT.json"),
      "utf8"
    )
  );

  const aiBasketFundArtifact = JSON.parse(
    fs.readFileSync(
      path.resolve("./artifacts/contracts/AIBasketFund.sol/AIBasketFund.json"),
      "utf8"
    )
  );

  // Force Legacy Transaction type: 0 with explicit nonce
  const gasOverride = {
    type: 0,
    nonce: nonce,
    gasLimit: 3000000,
    gasPrice: ethers.parseUnits("20", "gwei")
  };

  // Deploy MockUSDT
  console.log("Deploying MockUSDT...");
  const MockUSDTFactory = new ethers.ContractFactory(
    mockUSDTArtifact.abi,
    mockUSDTArtifact.bytecode,
    wallet
  );
  const mockUSDT = await MockUSDTFactory.deploy(gasOverride);
  console.log("Waiting for MockUSDT deployment confirmation...");
  await mockUSDT.waitForDeployment();
  const mockUSDTAddress = await mockUSDT.getAddress();
  console.log("MockUSDT deployed to:", mockUSDTAddress);

  // Deploy AIBasketFund with explicit nonce incremented
  const fundOverride = {
    type: 0,
    nonce: nonce + 1,
    gasLimit: 3000000,
    gasPrice: ethers.parseUnits("20", "gwei")
  };
  
  console.log("Deploying AIBasketFund...");
  const AIBasketFundFactory = new ethers.ContractFactory(
    aiBasketFundArtifact.abi,
    aiBasketFundArtifact.bytecode,
    wallet
  );
  const aiBasketFund = await AIBasketFundFactory.deploy(mockUSDTAddress, fundOverride);
  console.log("Waiting for AIBasketFund deployment confirmation...");
  await aiBasketFund.waitForDeployment();
  const aiBasketFundAddress = await aiBasketFund.getAddress();
  console.log("AIBasketFund deployed to:", aiBasketFundAddress);

  console.log("Deployment finished successfully!");
  console.log("---");
  console.log("MockUSDT:", mockUSDTAddress);
  console.log("AIBasketFund:", aiBasketFundAddress);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
