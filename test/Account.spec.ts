import {
  time,
  loadFixture,
} from "@nomicfoundation/hardhat-toolbox-viem/network-helpers";
import { expect } from "chai";
import { viem } from "hardhat";
import { encodeAbiParameters, getAddress, parseAbiParameters } from "viem";

describe("Account", function () {
  async function fixture() {
    const [entryPoint, ...owners] = await viem.getWalletClients();

    const accountImplementation = await viem.deployContract("Account", [
      entryPoint.account.address,
    ]);
    const factory = await viem.deployContract("AccountFactory");

    async function createAccount(
      implementation: `0x${string}`,
      configuration: {
        threshold: bigint;
        owners: `0x${string}`[];
      },
    ) {
      const params = [
        implementation,
        encodeAbiParameters(
          parseAbiParameters(
            "(uint256 threshold, address[] owners) configuration",
          ),
          [configuration],
        ),
        `0x${"00".repeat(32)}`,
      ] as any;
      const { result: address } = await factory.simulate.create(params);
      await factory.write.create(params);
      return await viem.getContractAt("Account", address);
    }

    return {
      entryPoint,
      owners,
      accountImplementation,
      factory,
      createAccount,
    };
  }

  describe("configuration", function () {
    it("should return the configuration used for account creation", async function () {
      const { owners, accountImplementation, createAccount } =
        await loadFixture(fixture);

      const configuration = {
        threshold: 2n,
        owners: owners
          .slice(0, 3)
          .map(({ account }) => getAddress(account.address)),
      };
      const account = await createAccount(
        accountImplementation.address,
        configuration,
      );

      expect(await account.read.getConfiguration()).to.deep.equal(
        configuration,
      );
    });

    it("should revert when not proxied", async function () {
      const { accountImplementation } = await loadFixture(fixture);

      await expect(
        accountImplementation.read.getConfiguration(),
      ).to.be.rejectedWith("account must be proxied");
    });
  });

  describe("isValidSignature", function () {});

  describe("validateUserOp", function () {});

  describe("execute", function () {});

  describe("configure", function () {});
});
