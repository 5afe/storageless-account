import { expect } from "chai";
import { viem } from "hardhat";
import {
  concat,
  decodeAbiParameters,
  encodeAbiParameters,
  getAddress,
  parseAbiParameters,
  slice,
} from "viem";

describe("AccountData", function () {
  it("should echo implementation and configuration bytes", async function () {
    const accountData = await viem.deployContract("AccountData", [
      `0x${"ee".repeat(20)}`,
      "0x01020304",
    ]);

    const client = await viem.getPublicClient();
    const { data } = await client.call({ to: accountData.address });
    if (!data) {
      throw new Error("missing data");
    }

    expect(data).to.equal(concat([`0x${"ee".repeat(20)}`, "0x01020304"]));
  });

  it("should deploy storage contract with configuration", async function () {
    const addr = (byte: string) => getAddress(`0x${byte.repeat(20)}`);

    const implementation = addr("f0");
    const configuration = {
      threshold: 2n,
      owners: [addr("01"), addr("02"), addr("03")],
    };

    const accountData = await viem.deployContract("AccountData", [
      implementation,
      encodeAbiParameters(
        parseAbiParameters(
          "(uint256 threshold, address[] owners) configuration",
        ),
        [configuration],
      ),
    ]);

    const client = await viem.getPublicClient();
    const { data } = await client.call({ to: accountData.address });
    if (!data) {
      throw new Error("missing data");
    }

    const decodedImplementation = getAddress(slice(data, 0, 20));
    const [decodedConfiguration] = decodeAbiParameters(
      parseAbiParameters("(uint256 threshold, address[] owners) configuration"),
      slice(data, 20),
    );

    expect(decodedImplementation).to.equal(implementation);
    expect(decodedConfiguration).to.deep.equal(configuration);
  });
});
