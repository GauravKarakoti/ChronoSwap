// Import necessary types from the Massa AS-SDK
// Note: The exact import path might vary; check the official Massa documentation.
import { Address } from "@massalabs/massa-as-sdk";

export class IERC20 {
  // Gets the total token supply
  totalSupply(): u64 {
    return 0;
  }

  // Gets the account balance
  balanceOf(owner: Address): u64 {
    return 0;
  }

  // Transfers tokens to a specified address
  transfer(to: Address, value: u64): boolean {
    return false;
  }

  // Gets the amount of tokens a spender is allowed to withdraw
  allowance(owner: Address, spender: Address): u64 {
    return 0;
  }

  // Approves a spender to withdraw a set amount of tokens
  approve(spender: Address, value: u64): boolean {
    return false;
  }

  // Transfers tokens from one address to another using an allowance
  transferFrom(from: Address, to: Address, value: u64): boolean {
    return false;
  }
}