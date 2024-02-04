import { loadFixture } from "@nomicfoundation/hardhat-toolbox-viem/network-helpers";
import { expect } from "chai";
import { viem } from "hardhat";
import {
  concat,
  encodeAbiParameters,
  getAddress,
  hashMessage,
  parseAbiParameters,
} from "viem";

describe("Account", function () {
  function accountDataParams(
    implementation: `0x${string}`,
    configuration: {
      threshold: bigint;
      owners: `0x${string}`[];
    },
  ): [`0x${string}`, `0x${string}`] {
    return [
      implementation,
      encodeAbiParameters(
        parseAbiParameters(
          "(uint256 threshold, address[] owners) configuration",
        ),
        [configuration],
      ),
    ];
  }

  async function fixture() {
    const client = await viem.getPublicClient();
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
      salt: `0x${string}` = `0x${"00".repeat(32)}`,
    ) {
      const params = accountDataParams(implementation, configuration);
      const { result: address } = await factory.simulate.create([
        ...params,
        salt,
      ]);
      await factory.write.create([...params, salt]);
      return await viem.getContractAt("Account", address);
    }

    return {
      client,
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

  describe("isValidSignature", function () {
    it("should return a magic value when the signature is valid", async function () {
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

      const signatures = concat(
        await Promise.all(
          [owners[0], owners[2]].map((owner) =>
            owner.signMessage({ message: "hello" }),
          ),
        ),
      );

      expect(
        await account.read.isValidSignature([hashMessage("hello"), signatures]),
      ).to.equal("0x1626ba7e");
    });

    it("should return an error if there are insufficient signatures", async function () {
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

      expect(
        await account.read.isValidSignature([
          hashMessage("hello"),
          await owners[1].signMessage({ message: "hello" }),
        ]),
      ).to.equal("0x00000000");
    });

    it("should return an error if signatures are out of order", async function () {
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

      const signatures = concat(
        await Promise.all(
          [owners[1], owners[0]].map((owner) =>
            owner.signMessage({ message: "hello" }),
          ),
        ),
      );

      expect(
        await account.read.isValidSignature([hashMessage("hello"), signatures]),
      ).to.equal("0x00000000");
    });

    it("should return an error if a signature doesn't match an owner", async function () {
      const { owners, accountImplementation, createAccount } =
        await loadFixture(fixture);

      const configuration = {
        threshold: 1n,
        owners: [getAddress(owners[0].account.address)],
      };
      const account = await createAccount(
        accountImplementation.address,
        configuration,
      );

      expect(
        await account.read.isValidSignature([
          hashMessage("hello"),
          await owners[1].signMessage({ message: "hello" }),
        ]),
      ).to.equal("0x00000000");
    });
  });

  describe("validateUserOp", function () {});

  describe("execute", function () {});

  describe("configure", function () {
    it("should recreate proxy with new configuration", async function () {
      const {
        client,
        entryPoint,
        owners,
        accountImplementation,
        createAccount,
      } = await loadFixture(fixture);

      const accountData = [
        [
          accountImplementation,
          {
            threshold: 1n,
            owners: [owners[0]],
          },
        ] as const,
        [
          await viem.deployContract("Account", [`0x${"ee".repeat(20)}`]),
          {
            threshold: 2n,
            owners: owners.slice(1, 3),
          },
        ] as const,
      ].map(
        ([{ address }, { threshold, owners }]) =>
          [
            getAddress(address),
            {
              threshold,
              owners: owners.map(({ account }) => getAddress(account.address)),
            },
          ] as const,
      );

      const creationParams = accountData[0];
      const account = await createAccount(...creationParams);

      expect([
        await account.read.SELF(),
        await account.read.getConfiguration(),
      ]).to.deep.equal(accountData[0]);
      expect(await account.read.ENTRY_POINT()).to.equal(
        getAddress(entryPoint.account.address),
      );

      await account.write.configure(accountDataParams(...accountData[1]));

      expect(await client.getBytecode(account)).to.be.undefined;

      await createAccount(...creationParams);

      expect(await client.getBytecode(account)).to.not.equal("0x");
      expect([
        await account.read.SELF(),
        await account.read.getConfiguration(),
      ]).to.deep.equal(accountData[1]);
      expect(await account.read.ENTRY_POINT()).to.equal(
        getAddress(`0x${"ee".repeat(20)}`),
      );
    });
  });
});
