import { ethers } from "ethers";
import "dotenv/config";

async function main() {
  const privateKey = process.env.PRIVATE_KEY;
  if (!privateKey) {
    console.error("No PRIVATE_KEY found in .env");
    return;
  }
  const provider = new ethers.JsonRpcProvider("https://rpc.bohr.life");
  const wallet = new ethers.Wallet(privateKey, provider);
  console.log("Wallet address:", wallet.address);
  const balance = await provider.getBalance(wallet.address);
  console.log("Wallet balance:", ethers.formatEther(balance), "BOT");
}

main().catch(console.error);
