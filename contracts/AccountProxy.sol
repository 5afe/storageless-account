// SPDX-License-Identifier: GPL-3.0-only
pragma solidity ^0.8.23;

import {AccountStorage} from "./base/AccountStorage.sol";
import {IAccountFactory} from "./interfaces/IAccountFactory.sol";

contract AccountProxy is AccountStorage {
    constructor(address implementation, bytes memory configuration) {
        IAccountFactory factory = IAccountFactory(msg.sender);
        address accountData = factory.getAccountData(address(this));
        if (accountData != address(0)) {
            assembly ("memory-safe") {
                mstore(0, 0)
                pop(call(gas(), accountData, 0, 0, 0, 12, 20))

                implementation := mload(0)
                configuration := mload(0x40)
                let configurationLength := sub(returndatasize(), 20)
                let configurationData := add(configuration, 32)
                mstore(configuration, configurationLength)
                returndatacopy(configurationData, 20, configurationLength)
                mstore(0x40, add(configurationData, configurationLength))
            }

            factory.setAccountData(address(0));
        }

        _factory = factory;
        bytes memory code = abi.encodePacked(
            // CALLDATASIZE
            // PUSH0
            // PUSH0
            // CALLDATACOPY
            // PUSH2
            bytes5(0x365f5f3761),
            uint16(configuration.length),
            // DUP1
            // PUSH1 0x3d
            // CALLDATASIZE
            // CODECOPY
            // DUP1
            // CALLDATASIZE
            // ADD
            // SWAP1
            // DUP2
            // MSTORE
            // PUSH 0x20
            // ADD
            // PUSH0
            // PUSH0
            // SWAP2
            // PUSH0
            // PUSH20
            bytes19(0x80603d36398036019081526020015f5f915f73),
            implementation,
            // GAS
            // DELEGATECALL
            // RETURNDATASIZE
            // PUSH0
            // PUSH0
            // RETURNDATACOPY
            // PUSH0
            // RETURNDATASIZE
            // SWAP2
            // PUSH1 0x3b
            // JUMPI
            // REVERT
            // JUMPDEST
            // RETURN
            bytes15(0x5af43d5f5f3e5f3d91603b57fd5bf3),
            configuration
        );

        assembly ("memory-safe") {
            return(add(code, 32), mload(code))
        }
    }

    receive() external payable {}
    fallback() external payable {}
}
