import { Address } from "@massalabs/massa-as-sdk";

export class IDusaRouter {
  // Swaps an exact amount of tokens for as many output tokens as possible
  swapExactTokensForTokens(
    amountIn: u64,
    amountOutMin: u64,
    path: Array<Address>, // Array of token addresses representing the swap path
    to: Address,
    deadline: u64
  ): Array<u64> {
    return [];
  }

  // Swaps an exact amount of native MAS for tokens
  swapExactMASForTokens(
    amountOutMin: u64,
    path: Array<Address>,
    to: Address,
    deadline: u64
  ): Array<u64> {
    return [];
  }

  // Swaps an exact amount of tokens for native MAS
  swapExactTokensForMAS(
    amountIn: u64,
    amountOutMin: u64,
    path: Array<Address>,
    to: Address,
    deadline: u64
  ): Array<u64> {
    return [];
  }
}