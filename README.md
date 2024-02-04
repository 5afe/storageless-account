# Storageless Account

This repository includes a proof-of-concept of a smart account that does not use
any storage during regular operation. That is, the account itself does not read
storage when checking signatures, potentially allowing for nested smart accounts
to be used.

It works by using `CREATE2` magic to ensure that an account always appears at a
particular address, and includes the configuration directly in the proxy code.
This configuration gets appended to calls that are proxied to the account
implementation, so that it can be read from calldata instead of requiring
storage reads (in fact, it is very gas efficient). Changing configuration works
by registering a new account data with the proxy factory, and then
`SELFDESTRUCT`-ing. The next time the account is created, it will use the
registered configuration instead of the configuration that was passed to the
proxy creation. This means that:

- An initial configuration uniquely identifies the address of the account
- Configuration changes keep the account on the same address
- **Unfortunately**, it requires a staked factory for deploying accounts with
  `initCode` because of ERC-4337 storage restrictions (reading the registered
  new configuration on the factory contract)

## Is This Useful?

**No.** In particular, this makes use of the `SELFDESTRUCT` op-code which is not
only deprecated, but will stop working as of the upcoming Devcun hardfork.

That being said, there is _some_ merit to `AccountData` contract introduced in
this repo. In particular, full account configurations can be backed by code
instead of storage slots, which gives you two benefits:

- For large configurations, it can be more gas efficient
- The entire configuration of an account can be checked (for example, you can
  check that after a `DELEGATECALL` the configuration stays the same).

## Why All The Assembly?

There is hand-rolled assembly bytecode (not just Solidity `assembly` blocks) in
the code. The reason for this, is that both the `AccountProxy` and `AccountData`
require `immutable` dynamic type support which is **not** supported by the
Solidity compiler. Essentially, this works by just appending the dynamic types
to the contract bytecode, and representing the data as a pair of start offset
and byte length, roughly equivalent to the following Solidity:

```solidity
uint256 immutable private dataStart;
uint256 immutable private dataLength;

function data() private view returns (bytes memory blob) {
    blob = new bytes(dataLength);
    assembly ("memory-safe") {
        codecopy(add(blob, 32), dataStart, dataLength)
    }
}
```

Hopefully Solidity will support `immutable`s with dynamic types someday! With
this support, both contracts can be implemented in Solidity and not require
hand-rolled assembly (even if it is fun to write).
