// SPDX-License-Identifier: GPL-3.0-only
pragma solidity ^0.8.23;

import {_packValidationData} from "@account-abstraction/contracts/core/Helpers.sol";

import {AccountStorage} from "./base/AccountStorage.sol";
import {IAccount, UserOperation} from "./interfaces/IAccount.sol";
import {IAccountFactory} from "./interfaces/IAccountFactory.sol";
import {AccountData} from "./AccountData.sol";

contract Account is AccountStorage, IAccount {
    address public immutable SELF;
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

        uint256 index = 0;
        uint256 remaining = configuration.threshold;
        while (remaining > 0) {
            address owner;
            unchecked {
                if (signatures.length < 65) {
                    return bytes4(0);
                }

                bytes32 r = bytes32(signatures);
                bytes32 s = bytes32(signatures[32:]);
                uint8 v = uint8(signatures[64]);

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

            unchecked {
                index++;
                remaining--;
                signatures = signatures[65:];
            }
        }

        return this.isValidSignature.selector;
    }

    function getDomainSeparator()
        public
        view
        returns (bytes32 accountUserOpHash)
    {
        return
            keccak256(
                abi.encode(
                    keccak256(
                        "EIP712Domain(uint256 chainId,address verifyingContract)"
                    ),
                    block.chainid,
                    this
                )
            );
    }

    function getAccountUserOpHash(
        bytes32 userOpHash
    ) public view returns (bytes32 accountUserOpHash) {
        return
            keccak256(
                abi.encodePacked(
                    bytes2(0x1901),
                    getDomainSeparator(),
                    keccak256(
                        abi.encode(
                            keccak256("AccountUserOp(bytes32 userOpHash)"),
                            userOpHash
                        )
                    )
                )
            );
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

        bytes32 accountUserOpHash = getAccountUserOpHash(userOpHash);
        validationData = isValidSignature(
            accountUserOpHash,
            userOp.signature
        ) == this.isValidSignature.selector
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
        _factory.setAccountData(
            address(new AccountData(implementation, configuration))
        );
        selfdestruct(payable(address(this)));
    }
}
