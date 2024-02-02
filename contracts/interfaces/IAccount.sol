// SPDX-License-Identifier: GPL-3.0-only
pragma solidity ^0.8.23;

import {IAccount as IERC4337Account} from "@account-abstraction/contracts/interfaces/IAccount.sol";
import {UserOperation} from "@account-abstraction/contracts/interfaces/UserOperation.sol";

interface IAccount is IERC4337Account {
    struct Configuration {
        uint256 threshold;
        address[] owners;
    }
}
