import { expect } from "chai";
import { viem } from "hardhat";
import {
  decodeAbiParameters,
  encodeAbiParameters,
  getAddress,
  parseAbiParameters,
} from "viem";

describe("AccountData", function () {
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

    const [decodedImplementation, configurationData] = decodeAbiParameters(
      parseAbiParameters("address implementation, bytes configuration"),
      data,
    );
    const [decodedConfiguration] = decodeAbiParameters(
      parseAbiParameters("(uint256 threshold, address[] owners) configuration"),
      configurationData,
    );

    expect(decodedImplementation).to.equal(implementation);
    expect(decodedConfiguration).to.deep.equal(configuration);
  });
});