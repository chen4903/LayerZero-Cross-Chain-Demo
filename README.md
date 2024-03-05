# Brief

LayerZero跨链Demo

# Usages

## 1.初始化项目

创建合约文件LayerZeroDemo1.sol：

```solidity
//SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;
pragma abicoder v2;
import "../interfaces/ILayerZeroEndpoint.sol";
import "../interfaces/ILayerZeroReceiver.sol";
import "hardhat/console.sol";
contract LayerZeroDemo1 is ILayerZeroReceiver {
    event ReceiveMsg(
        uint16 _srcChainId,
        address _from,
        uint16 _count,
        bytes _payload
    );
    ILayerZeroEndpoint public endpoint;
    uint16 public messageCount;
    bytes public message;
    constructor(address _endpoint) {
        endpoint = ILayerZeroEndpoint(_endpoint);
    }
    function sendMsg(
        uint16 _dstChainId,
        bytes calldata _destination,
        bytes calldata payload
    ) public payable {
        endpoint.send{value: msg.value}(
            _dstChainId,
            _destination,
            payload,
            payable(msg.sender),
            address(this),
            bytes("")
        );
    }
    function lzReceive(
        uint16 _srcChainId,
        bytes memory _from,
        uint64,
        bytes memory _payload
    ) external override {
        require(msg.sender == address(endpoint));
        address from;
        assembly {
            from := mload(add(_from, 20))
        }
        if (
            keccak256(abi.encodePacked((_payload))) ==
            keccak256(abi.encodePacked((bytes10("ff"))))
        ) {
            endpoint.receivePayload(
                1,
                bytes(""),
                address(0x0),
                1,
                1,
                bytes("")
            );
        }
        message = _payload;
        messageCount += 1;
        emit ReceiveMsg(_srcChainId, from, messageCount, message);
    }
    // Endpoint.sol estimateFees() returns the fees for the message
    function estimateFees(
        uint16 _dstChainId,
        address _userApplication,
        bytes calldata _payload,
        bool _payInZRO,
        bytes calldata _adapterParams
    ) external view returns (uint256 nativeFee, uint256 zroFee) {
        return
            endpoint.estimateFees(
                _dstChainId,
                _userApplication,
                _payload,
                _payInZRO,
                _adapterParams
            );
    }
}
```

分析：

- 合约从源链向目标链发送一条消息，我们需要用端点地址构造它，并且需要两个接口：`ILayerZeroEndpoint`和`ILayerZeroReceiver`。
- 自定义函数`sendMsg()`封装了`endpoint.send(…)`，这将在目标链上触发对`lzReceive()`的调用。
- 源链调用`endpoint.send(…)`后，接收链上会自动调用重载的`lzReceive()`。
- 自定义函数`estimateFees()`封装了`endpoint.estimateFees(…)`，该函数将返回跨链消息的费用。

## 2.在不同的链上部署合约

首先为 Fantom 测试链创建部署脚本：

```js
const hre = require("hardhat");
async function main() {
  const LayerZeroDemo1 = await hre.ethers.getContractFactory("LayerZeroDemo1");
  const layerZeroDemo1 = await LayerZeroDemo1.deploy(
    "0x7dcAD72640F835B0FA36EFD3D6d3ec902C7E5acf"
  );
  await layerZeroDemo1.deployed();
  console.log("layerZeroDemo1 deployed to:", layerZeroDemo1.address);
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
```

在 Fantom 测试网上部署合约：

```
npx hardhat run scripts/deploy_fantom.js --network fantom
# layerZeroDemo1 deployed to: 0xc6F49b69315f88D9Ea2ea3B658dD457D68Ef64Bc
```

然后为 holesky测试链创建部署脚本：

```js
const hre = require("hardhat");
async function main() {
  const LayerZeroDemo1 = await hre.ethers.getContractFactory("LayerZeroDemo1");
  const layerZeroDemo1 = await LayerZeroDemo1.deploy(
    "0xf69186dfBa60DdB133E91E9A4B5673624293d8F8"
  );
  await layerZeroDemo1.deployed();
  console.log("layerZeroDemo1 deployed to:", layerZeroDemo1.address);
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
```

在holesky测试链部署合约：

```
npx hardhat run scripts/deploy_holesky.js --network holesky
# layerZeroDemo1 deployed to: 0x966300b7d24403E5C86d178eDc03Cc4610eAe588
```

得到部署的两个合约

```
Fantom: 0xc6F49b69315f88D9Ea2ea3B658dD457D68Ef64Bc
holesky: 0x966300b7d24403E5C86d178eDc03Cc4610eAe588
```

## 3.测试跨链消息传递

为 fantom 创建一个 javascript 测试脚本：

```js
const hre = require("hardhat");
const { ethers } = require("ethers");
async function main() {
  const LayerZeroDemo1 = await hre.ethers.getContractFactory("LayerZeroDemo1");
  const layerZeroDemo1 = await LayerZeroDemo1.attach(
    "0xc6F49b69315f88D9Ea2ea3B658dD457D68Ef64Bc"
  );
  const count = await layerZeroDemo1.messageCount();
  const msg = await layerZeroDemo1.message();
  console.log(count);
  console.log(ethers.utils.toUtf8String(msg));
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
```

该脚本将合约实例附加到我们前面部署的合约地址：0xc6F49b69315f88D9Ea2ea3B658dD457D68Ef64Bc。

使用hardhat运行脚本：

```
npx hardhat run scripts/demo1_fantom.js --network fantom
```

 脚本将读取合约中的消息计数和最后一条消息，现在返回的是0和空字符串。

```
PS E:\code\web3\study\LayerZero-Demo> npx hardhat run scripts/demo1_fantom.js --network fantom
0

PS E:\code\web3\study\LayerZero-Demo>
```

接下来为 Holesky 测试网创建一个 javascript 测试脚本：

```js
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
```

它会从 Holesky测试网合约（地址：0x966300b7d24403E5C86d178eDc03Cc4610eAe588）向Fantom测试链上的合约（地址：0xc6F49b69315f88D9Ea2ea3B658dD457D68Ef64Bc） 发送一条消息“Hello, I am LEVI_104” ，并获得用于演示目的的估算费用。最后它会发送带有费用的消息， 为简单起见，发送值为 1ETH。如果源交易比传递的金额便宜，它将把额外的金额退还到我们传递的地址 `_refundAddress`。

使用Hardhat运行脚本：

```
npx hardhat run scripts/demo1_holesky.js --network holesky
```

得到结果：

```
PS E:\code\web3\study\LayerZero-Demo> npx hardhat run scripts/demo1_holesky.js --network holesky
estimateFees 0.000005964546853808
tx hash: 0x04cda433552d31fe5c40b94e1012a0374acb541460c0292b0055facd21ef912e
PS E:\code\web3\study\LayerZero-Demo> 
```

等待一下之后再次查看Pantom中的合约内容（因为Oracle在链A监听到Tx之后的15个块之后，才会发送`blk_hdr`到链B）：

> 我执行了两次

```
PS E:\code\web3\study\LayerZero-Demo> npx hardhat run scripts/demo1_fantom.js --network fantom
2
Hello, I am LEVI_104
PS E:\code\web3\study\LayerZero-Demo> 
```