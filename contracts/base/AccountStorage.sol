// SPDX-License-Identifier: GPL-3.0-only
pragma solidity ^0.8.23;

import {IAccountFactory} from "../interfaces/IAccountFactory.sol";

abstract contract AccountStorage {
    IAccountFactory internal _factory;
}
