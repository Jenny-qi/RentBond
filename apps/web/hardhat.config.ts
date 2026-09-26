import { defineConfig } from "hardhat/config";
export default defineConfig({
  networks: {
    default: {
      type: "edr-simulated",
      chainId: 31337,
      allowUnlimitedContractSize: false,
    },
  },
});
