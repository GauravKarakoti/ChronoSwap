import { Address, call } from "@massalabs/massa-as-sdk";
import { Args } from "@massalabs/as-types"; // <-- No Result import needed

export class IDusaRouter {
  _origin: Address;
  constructor(at: Address) {
    this._origin = at;
  }

  // Swaps an exact amount of tokens for as many output tokens as possible
  swapExactTokensForTokens(
    amountIn: u64,
    amountOutMin: u64,
    path: Array<Address>, // Array of token addresses representing the swap path
    to: Address,
    deadline: u64
  ): Array<u64> {
    const args = new Args()
      .add(amountIn)
      .add(amountOutMin)
      .addSerializableObjectArray(path)
      .add(to)
      .add(deadline);
    
    const res = call(this._origin, "swapExactTokensForTokens", args, 0); 
    
    // Manually deserialize the result
    return new Args(res).nextFixedSizeArray<u64>().unwrap(); // <-- FIXED
  }

  // Swaps an exact amount of native MAS for tokens
  swapExactMASForTokens(
    amountIn: u64, // <-- This is the amount of MAS to send
    amountOutMin: u64,
    path: Array<Address>,
    to: Address,
    deadline: u64
  ): Array<u64> {
    const args = new Args()
      .add(amountOutMin)
      .addSerializableObjectArray(path)
      .add(to)
      .add(deadline);

    const res = call(this._origin, "swapExactMASForTokens", args, amountIn); // Pass amountIn as coins
    
    // Manually deserialize the result
    return new Args(res).nextFixedSizeArray<u64>().unwrap(); // <-- FIXED
  }

  // Swaps an exact amount of tokens for native MAS
  swapExactTokensForMAS(
    amountIn: u64,
    amountOutMin: u64,
    path: Array<Address>,
    to: Address,
    deadline: u64
  ): Array<u64> {
    const args = new Args()
      .add(amountIn)
      .add(amountOutMin)
      .addSerializableObjectArray(path)
      .add(to)
      .add(deadline);

    const res = call(this._origin, "swapExactTokensForMAS", args, 0);
    
    // Manually deserialize the result
    return new Args(res).nextFixedSizeArray<u64>().unwrap(); // <-- FIXED
  }
}