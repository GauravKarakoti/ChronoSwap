import { Address, call } from "@massalabs/massa-as-sdk";
import { Args } from "@massalabs/as-types"; // <-- No Result import needed

export class IERC20 {
  _origin: Address;
  constructor(at: Address) {
    this._origin = at;
  }

  // Gets the total token supply
  totalSupply(): u64 {
    const res = call(this._origin, "totalSupply", new Args(), 0); 
    return new Args(res).nextU64().unwrap(); // <-- FIXED
  }

  // Gets the account balance
  balanceOf(owner: Address): u64 {
    const args = new Args().add(owner); 
    const res = call(this._origin, "balanceOf", args, 0); 
    return new Args(res).nextU64().unwrap(); // <-- FIXED
  }

  // Transfers tokens to a specified address
  transfer(to: Address, value: u64): boolean {
    const args = new Args().add(to).add(value); 
    call(this._origin, "transfer", args, 0); 
    return true; // Assuming success, no return value to decode
  }

  // Gets the amount of tokens a spender is allowed to withdraw
  allowance(owner: Address, spender: Address): u64 {
    const args = new Args().add(owner).add(spender); 
    const res = call(this._origin, "allowance", args, 0); 
    return new Args(res).nextU64().unwrap(); // <-- FIXED
  }

  // Approves a spender to withdraw a set amount of tokens
  approve(spender: Address, value: u64): boolean {
    const args = new Args().add(spender).add(value); 
    call(this._origin, "approve", args, 0); 
    return true; // Assuming success, no return value to decode
  }

  // Transfers tokens from one address to another using an allowance
  transferFrom(from: Address, to: Address, value: u64): boolean {
    const args = new Args().add(from).add(to).add(value); 
    call(this._origin, "transferFrom", args, 0); 
    return true; // Assuming success, no return value to decode
  }
}