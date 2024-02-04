import EntryPoint from "@account-abstraction/contracts/artifacts/EntryPoint.json";
import { loadFixture } from "@nomicfoundation/hardhat-toolbox-viem/network-helpers";
import { expect } from "chai";
import { viem } from "hardhat";
import {
  encodeAbiParameters,
  encodeFunctionData,
  encodePacked,
  parseAbiParameters,
  parseEther,
  parseGwei,
} from "viem";

describe("ERC-4337", function () {
  async function fixture() {
    const client = await viem.getPublicClient();
    const [deployer, relayer, ...wallets] = await viem.getWalletClients();
    const owners = wallets.slice(0, 2);

    const { contractAddress: entryPointAddress } =
      await client.getTransactionReceipt({
        hash: await deployer.deployContract({
          abi: EntryPoint.abi,
          bytecode: EntryPoint.bytecode as `0x${string}`,
        }),
      });
    const entryPoint = await viem.getContractAt(
      "IEntryPoint",
      entryPointAddress!,
      { walletClient: relayer },
    );

    const accountImplementation = await viem.deployContract("Account", [
      entryPoint.address,
    ]);
    const factory = await viem.deployContract("AccountFactory");

    const accountParams = [
      accountImplementation.address,
      encodeAbiParameters(
        parseAbiParameters(
          "(uint256 threshold, address[] owners) configuration",
        ),
        [
          {
            threshold: 1n,
            owners: owners.map(({ account }) => account.address),
          },
        ],
      ),
      `0x${"00".repeat(32)}`,
    ] as any;
    const init = {
      deploy: () => factory.write.create(accountParams),
      code: encodePacked(
        ["address", "bytes"],
        [
          factory.address,
          encodeFunctionData({
            abi: factory.abi,
            functionName: "create",
            args: accountParams,
          }),
        ],
      ),
    };
    const account = await viem.getContractAt(
      "Account",
      await factory.simulate
        .create(accountParams)
        .then((simulation) => simulation.result),
    );

    await deployer.sendTransaction({ to: account.address, value: parseEther("1.0") });

    return {
      client,
      entryPoint,
      relayer,
      owners,
      account,
      init,
    };
  }

  it("should deploy an account and execute a user operation", async function () {
    const { client, entryPoint, relayer, account, init, owners } =
      await loadFixture(fixture);

    expect(await client.getBytecode({ address: account.address })).to.be
      .undefined;
    expect(await client.getBalance({ address: account.address })).to.equal(
      parseEther("1.0"),
    );

    const userOp = {
      sender: account.address,
      nonce: 0n,
      initCode: init.code,
      callData: encodeFunctionData({
        abi: account.abi,
        functionName: "execute",
        args: [owners[1].account.address, parseEther("0.1"), "0x"],
      }),
      callGasLimit: 100000n,
      verificationGasLimit: 1000000n,
      preVerificationGas: 100000n,
      maxFeePerGas: parseGwei("10.0"),
      maxPriorityFeePerGas: parseGwei("1.0"),
      paymasterAndData: "0x",
      signature: "0x",
    } as const;
    const signature = await owners[0].signTypedData({
      domain: {
        verifyingContract: account.address,
        chainId: await client.getChainId(),
      },
      types: {
        AccountUserOp: [{ name: "userOpHash", type: "bytes32" }],
      },
      primaryType: "AccountUserOp",
      message: {
        userOpHash: await entryPoint.read.getUserOpHash([userOp]),
      },
    });

    await entryPoint.write.handleOps([
      [{ ...userOp, signature }],
      relayer.account.address,
    ]);

    expect(await client.getBytecode({ address: account.address })).to.not.be
      .undefined;
    const num = (x: bigint) => Number(x.toString());
    expect(
      num(await client.getBalance({ address: account.address })),
    ).to.be.lessThan(num(parseEther("0.9")));
  });

  it("should execute a user operation for an existing account", async function () {
    const { client, entryPoint, relayer, account, init, owners } =
      await loadFixture(fixture);

    await init.deploy();
    expect(await client.getBytecode({ address: account.address })).to.not.be
      .undefined;
    expect(await client.getBalance({ address: account.address })).to.equal(
      parseEther("1.0"),
    );

    const userOp = {
      sender: account.address,
      nonce: 0n,
      initCode: "0x",
      callData: encodeFunctionData({
        abi: account.abi,
        functionName: "execute",
        args: [owners[1].account.address, parseEther("0.1"), "0x"],
      }),
      callGasLimit: 100000n,
      verificationGasLimit: 1000000n,
      preVerificationGas: 100000n,
      maxFeePerGas: parseGwei("10.0"),
      maxPriorityFeePerGas: parseGwei("1.0"),
      paymasterAndData: "0x",
      signature: "0x",
    } as const;
    const signature = await owners[0].signTypedData({
      domain: {
        verifyingContract: account.address,
        chainId: await client.getChainId(),
      },
      types: {
        AccountUserOp: [{ name: "userOpHash", type: "bytes32" }],
      },
      primaryType: "AccountUserOp",
      message: {
        userOpHash: await entryPoint.read.getUserOpHash([userOp]),
      },
    });

    await entryPoint.write.handleOps([
      [{ ...userOp, signature }],
      relayer.account.address,
    ]);

    const num = (x: bigint) => Number(x.toString());
    expect(
      num(await client.getBalance({ address: account.address })),
    ).to.be.lessThan(num(parseEther("0.9")));
  });
});
