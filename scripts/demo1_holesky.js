const { formatBytes32String } = require("ethers/lib/utils");
const { ethers } = require("ethers");
const hre = require("hardhat");

// 从 Holesky 发送到 Fantom
async function main() {
  const LayerZeroDemo1 = await hre.ethers.getContractFactory("LayerZeroDemo1");
  const layerZeroDemo1 = await LayerZeroDemo1.attach(
    "0x966300b7d24403E5C86d178eDc03Cc4610eAe588" // Holesky 的合约地址
  );
  const fees = await layerZeroDemo1.estimateFees(
    10112, // Fantom EndpointID: https://layerzero.gitbook.io/docs/technical-reference/testnet/testnet-addresses#fantom-testnet
    "0xc6F49b69315f88D9Ea2ea3B658dD457D68Ef64Bc", // Fantom 的合约地址
    formatBytes32String("Hello, I am LEVI_104"),
    false,
    []
  );
  console.log("estimateFees", ethers.utils.formatEther(fees[0].toString()));
  const tx = await layerZeroDemo1.sendMsg(
    10112, // Fantom EndpointID: https://layerzero.gitbook.io/docs/technical-reference/testnet/testnet-addresses#fantom-testnet
    // remoteAndLocalAddresses: [ Pantom contract address | Holesky contract address ]
    "0xc6F49b69315f88D9Ea2ea3B658dD457D68Ef64Bc966300b7d24403E5C86d178eDc03Cc4610eAe588",
    formatBytes32String("Hello, I am LEVI_104"),
    { value: ethers.utils.parseEther("1"), gasLimit: 500000 }
  );
  console.log("tx hash:", tx.hash)
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});