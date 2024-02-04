// SPDX-License-Identifier: GPL-3.0-only
pragma solidity ^0.8.23;

interface IAccountFactory {
    function create(
        address implementation,
        bytes memory configuration,
        bytes32 salt
    ) external returns (address account);

    function getAccountData(
        address account
    ) external view returns (address data);

    function setAccountData(address data) external;
}
