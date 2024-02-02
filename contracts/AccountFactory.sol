// SPDX-License-Identifier: GPL-3.0-only
pragma solidity ^0.8.23;

import {AccountProxy} from "./AccountProxy.sol";

contract AccountFactory {
    function create(
        address implementation,
        bytes memory configuration,
        bytes32 salt
    ) external returns (address account) {
        return
            address(
                new AccountProxy{salt: salt}(implementation, configuration)
            );
    }
}
