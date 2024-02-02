// SPDX-License-Identifier: GPL-3.0-only
pragma solidity ^0.8.23;

contract AccountData {
    constructor(address implementation, bytes memory configuration) {
        bytes memory data = abi.encode(implementation, configuration);
        bytes memory code = abi.encodePacked(
            // CODESIZE
            // PUSH1 0x08
            // PUSH0
            // CODECOPY
            // CODESIZE
            // PUSH0
            // RETURN
            bytes8(0x3860085f39385ff3),
            data
        );

        assembly ("memory-safe") {
            return(add(code, 32), mload(code))
        }
    }

    fallback() external {}
}
