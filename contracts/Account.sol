// SPDX-License-Identifier: GPL-3.0-only
pragma solidity ^0.8.23;

import {_packValidationData} from "@account-abstraction/contracts/core/Helpers.sol";

import {AccountUpgradeStorage} from "./base/AccountUpgradeStorage.sol";
import {IAccount, UserOperation} from "./interfaces/IAccount.sol";
import {AccountData} from "./AccountData.sol";

contract Account is AccountUpgradeStorage, IAccount {
    address private immutable SELF;
    address public immutable ENTRY_POINT;

    constructor(address entryPoint) {
        SELF = address(this);
        ENTRY_POINT = entryPoint;
    }

    receive() external payable {}

    modifier onlyProxied() {
        require(address(this) != SELF, "account must be proxied");
        _;
    }

    modifier onlyEntryPoint() {
        require(msg.sender == ENTRY_POINT, "unsupported entry point");
        _;
    }

    function getConfiguration()
        public
        view
        onlyProxied
        returns (Configuration memory configuration)
    {
        bytes calldata configurationData;
        assembly ("memory-safe") {
            let end := sub(calldatasize(), 32)
            configurationData.length := calldataload(end)
            configurationData.offset := sub(end, configurationData.length)
        }

        configuration = abi.decode(configurationData, (Configuration));
    }

    function isValidSignature(
        bytes32 message,
        bytes calldata signatures
    ) public view returns (bytes4 magicValue) {
        Configuration memory configuration = getConfiguration();

        uint256 offset = 0;
        uint256 index = 0;
        uint256 remaining = configuration.threshold;
        while (remaining > 0) {
            bytes calldata slice = signatures[offset:65];

            address owner;
            unchecked {
                bytes32 r = bytes32(slice);
                bytes32 s = bytes32(slice[32:]);
                uint8 v = uint8(bytes1(slice[64:]));

                owner = ecrecover(message, v, r, s);
            }

            unchecked {
                for (; index < configuration.owners.length; index++) {
                    if (configuration.owners[index] == owner) {
                        break;
                    }
                }
            }

            if (index >= configuration.owners.length) {
                return bytes4(0);
            }
            index++;
        }

        return this.isValidSignature.selector;
    }

    function validateUserOp(
        UserOperation calldata userOp,
        bytes32 userOpHash,
        uint256 missingAccountFunds
    ) external override onlyEntryPoint returns (uint256 validationData) {
        bytes4 selector = bytes4(userOp.callData);
        require(
            selector == this.execute.selector ||
                selector == this.configure.selector,
            "unsupported execution function"
        );

        validationData = isValidSignature(userOpHash, userOp.signature) ==
            this.isValidSignature.selector
            ? 0
            : 1;
        if (missingAccountFunds != 0) {
            assembly ("memory-safe") {
                pop(call(gas(), caller(), missingAccountFunds, 0, 0, 0, 0))
            }
        }
    }

    function execute(
        address to,
        uint256 value,
        bytes memory data
    ) external onlyEntryPoint {
        (bool success, ) = to.call{value: value}(data);
        require(success);
    }

    function configure(
        address implementation,
        bytes memory configuration
    ) external onlyEntryPoint {
        _configurationData = address(
            new AccountData(implementation, configuration)
        );
        selfdestruct(payable(address(this)));
    }
}
