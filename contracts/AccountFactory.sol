// SPDX-License-Identifier: GPL-3.0-only
pragma solidity ^0.8.23;

import {IAccountFactory} from "./interfaces/IAccountFactory.sol";
import {AccountProxy} from "./AccountProxy.sol";

contract AccountFactory is IAccountFactory {
    mapping(address => address) private _accountData;

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

    function getAccountData(
        address account
    ) external view override returns (address data) {
        return _accountData[account];
    }

    function setAccountData(address data) external override {
        _accountData[msg.sender] = data;
    }
}
