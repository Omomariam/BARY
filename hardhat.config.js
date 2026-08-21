import { defineConfig } from "hardhat/config";
import "dotenv/config";

export default defineConfig({
  solidity: {
    version: "0.8.20",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200
      }
    }
  },
  networks: {
    bohrTestnet: {
      type: "http",
      url: "https://rpc.bohr.life",
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
      chainId: 968
    }
  }
});
