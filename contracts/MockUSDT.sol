// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract MockUSDT is ERC20 {
    constructor() ERC20("Mock Tether USD", "mUSDT") {
        _mint(msg.sender, 1000000 * 10**6); // Mint 1,000,000 mUSDT to deployer
    }

    function decimals() public view virtual override returns (uint8) {
        return 6;
    }

    // Faucet function for testing
    function faucet(address to, uint256 amount) public {
        _mint(to, amount);
    }
}
