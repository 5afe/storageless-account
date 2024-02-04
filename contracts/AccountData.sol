// SPDX-License-Identifier: GPL-3.0-only
pragma solidity ^0.8.23;

contract AccountData {
    constructor(address implementation, bytes memory configuration) {
        bytes memory data = abi.encodePacked(implementation, configuration);
        bytes memory code = abi.encodePacked(
            // PUSH2
            bytes1(0x61),
            uint16(data.length),
            // DUP1
            // PUSH1 0x0a
            // PUSH0
            // CODECOPY
            // PUSH0
            // RETURN
            bytes7(0x80600a5f395ff3),
            data
        );

        assembly ("memory-safe") {
            return(add(code, 32), mload(code))
        }
    }

    fallback() external {}
}
