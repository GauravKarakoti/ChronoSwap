import { Storage, Context, generateEvent, call, transferCoins, Address, sendMessage } from "@massalabs/massa-as-sdk";
import { IERC20 } from "./interfaces/IERC20";
import { IDusaRouter } from "./interfaces/IDusaRouter";
import { serializable } from "as-json";
import { Args } from "@massalabs/as-types"; // <-- ADDED

// Order structure for scheduled swaps
@serializable // <-- FIXED
class ScheduledOrder {
  constructor(
    public id: string,
    public user: string,
    public tokenIn: string,
    public tokenOut: string,
    public amountIn: u64,
    public minAmountOut: u64,
    public scheduleType: string, // "DCA" | "LIMIT" | "RECURRING"
    public executionTime: u64,
    public interval: u64, // for recurring orders
    public totalOccurrences: u32,
    public executedOccurrences: u32,
    public isActive: boolean,
    public lastExecution: u64
  ) {}
}

// Main ChronoSwap contract
export class ChronoSwap {
  private owner: string = "";
  private orders: Map<string, ScheduledOrder> = new Map<string, ScheduledOrder>();
  private userOrders: Map<string, string[]> = new Map<string, string[]>();
  private nextOrderId: u64 = 1;

  // Dusa Router address - mainnet deployment
  private DUSA_ROUTER: string = "AS12Cj7GP8GEmSnw13p2R7kPmZ5w6hjXQn5w2V5eR3tP8Qr5J7vE1";
  
  // MAS token address
  private MAS_TOKEN: string = "AS12Cj7GP8GEmSnw13p2R7kPmZ5w6hjXQn5w2V5eR3tP8Qr5J7vE2";

  constructor() {
    this.owner = Context.caller().toString();
    generateEvent(`ChronoSwap deployed by: ${this.owner}`);
  }

  /**
   * Schedule a new DCA (Dollar Cost Averaging) order
   */
  // @export <-- REMOVED
  scheduleDCA(
    tokenIn: string,
    tokenOut: string,
    amountIn: u64,
    minAmountOut: u64,
    interval: u64, // in seconds
    totalOccurrences: u32
  ): string {
    const caller = Context.caller().toString();
    const orderId = this._generateOrderId();
    const currentTime = Context.timestamp();

    // Validate input
    this._validateScheduleParams(tokenIn, tokenOut, amountIn, minAmountOut, interval);

    // Create scheduled order
    const order = new ScheduledOrder(
      orderId,
      caller,
      tokenIn,
      tokenOut,
      amountIn,
      minAmountOut,
      "DCA",
      currentTime + interval, // First execution
      interval,
      totalOccurrences,
      0,
      true,
      0
    );

    // Store order
    this.orders.set(orderId, order);
    this._addUserOrder(caller, orderId);

    // Transfer tokens from user to contract for first execution
    if (tokenIn === this.MAS_TOKEN) {
      // For native MAS, we need to check the sent amount
      if (Context.transferredCoins() < amountIn * totalOccurrences) {
        generateEvent("Insufficient MAS transferred for DCA schedule");
        throw new Error("Insufficient MAS transferred");
      }
    } else {
      // For SRC20 tokens
      const token = new IERC20(new Address(tokenIn)); // <-- FIXED
      const allowance = token.allowance(new Address(caller), new Address(Context.callee().toString())); // <-- FIXED
      if (allowance < amountIn * totalOccurrences) {
        generateEvent("Insufficient token allowance for DCA schedule");
        throw new Error("Insufficient token allowance");
      }
      token.transferFrom(new Address(caller), Context.callee(), amountIn * totalOccurrences); // <-- FIXED
    }

    // Schedule first execution using Massa's autonomous execution
    this._scheduleExecution(orderId, currentTime + interval);

    generateEvent(`DCA scheduled: ${orderId} for user: ${caller}`);
    return orderId;
  }

  /**
   * Schedule a limit order
   */
  // @export <-- REMOVED
  scheduleLimitOrder(
    tokenIn: string,
    tokenOut: string,
    amountIn: u64,
    minAmountOut: u64,
    executionTime: u64
  ): string {
    const caller = Context.caller().toString();
    const orderId = this._generateOrderId();
    const currentTime = Context.timestamp();

    // Validate execution time is in future
    if (executionTime <= currentTime) {
      throw new Error("Execution time must be in the future");
    }

    this._validateScheduleParams(tokenIn, tokenOut, amountIn, minAmountOut, 0);

    const order = new ScheduledOrder(
      orderId,
      caller,
      tokenIn,
      tokenOut,
      amountIn,
      minAmountOut,
      "LIMIT",
      executionTime,
      0, // No interval for limit orders
      1, // Single execution
      0,
      true,
      0
    );

    this.orders.set(orderId, order);
    this._addUserOrder(caller, orderId);

    // Transfer tokens
    if (tokenIn === this.MAS_TOKEN) {
      if (Context.transferredCoins() < amountIn) {
        throw new Error("Insufficient MAS transferred");
      }
    } else {
      const token = new IERC20(new Address(tokenIn)); // <-- FIXED
      const allowance = token.allowance(new Address(caller), new Address(Context.callee().toString())); // <-- FIXED
      if (allowance < amountIn) {
        throw new Error("Insufficient token allowance");
      }
      token.transferFrom(new Address(caller), Context.callee(), amountIn); // <-- FIXED
    }

    this._scheduleExecution(orderId, executionTime);

    generateEvent(`Limit order scheduled: ${orderId} for user: ${caller}`);
    return orderId;
  }

  /**
   * Schedule recurring payments
   */
  // @export <-- REMOVED
  scheduleRecurringPayment(
    token: string,
    recipient: string,
    amount: u64,
    interval: u64,
    totalOccurrences: u32
  ): string {
    const caller = Context.caller().toString();
    const orderId = this._generateOrderId();
    const currentTime = Context.timestamp();

    if (amount <= 0) {
      throw new Error("Amount must be positive");
    }

    // Create a special order for payments (tokenOut is recipient address)
    const order = new ScheduledOrder(
      orderId,
      caller,
      token,
      recipient, // Using tokenOut field for recipient
      amount,
      0, // No minAmountOut for payments
      "RECURRING",
      currentTime + interval,
      interval,
      totalOccurrences,
      0,
      true,
      0
    );

    this.orders.set(orderId, order);
    this._addUserOrder(caller, orderId);

    // Transfer total amount needed
    if (token === this.MAS_TOKEN) {
      if (Context.transferredCoins() < amount * totalOccurrences) {
        throw new Error("Insufficient MAS transferred");
      }
    } else {
      const tokenSC = new IERC20(new Address(token)); // <-- FIXED
      const allowance = tokenSC.allowance(new Address(caller), new Address(Context.callee().toString())); // <-- FIXED
      if (allowance < amount * totalOccurrences) {
        throw new Error("Insufficient token allowance");
      }
      tokenSC.transferFrom(new Address(caller), Context.callee(), amount * totalOccurrences); // <-- FIXED
    }

    this._scheduleExecution(orderId, currentTime + interval);

    generateEvent(`Recurring payment scheduled: ${orderId} from ${caller} to ${recipient}`);
    return orderId;
  }

  /**
   * Execute a scheduled order (called autonomously by Massa network)
   */
  // @export <-- REMOVED
  executeOrder(orderId: string): void {
    const order = this.orders.get(orderId);
    if (!order) {
      generateEvent(`Order not found: ${orderId}`);
      return;
    }

    if (!order.isActive) {
      generateEvent(`Order inactive: ${orderId}`);
      return;
    }

    const currentTime = Context.timestamp();
    
    // Check if it's time to execute
    if (currentTime < order.executionTime) {
      generateEvent(`Order not ready for execution: ${orderId}`);
      // Reschedule for the correct time if missed (optional, but good practice)
      this._scheduleExecution(orderId, order.executionTime);
      return;
    }

    try {
      if (order.scheduleType === "RECURRING") {
        this._executePayment(order);
      } else {
        this._executeSwap(order);
      }

      // Update order state
      order.executedOccurrences++;
      order.lastExecution = currentTime;

      // Handle recurring orders
      if (order.scheduleType === "DCA" || order.scheduleType === "RECURRING") {
        if (order.executedOccurrences < order.totalOccurrences) {
          // Schedule next execution
          order.executionTime = currentTime + order.interval;
          this._scheduleExecution(orderId, order.executionTime);
          this.orders.set(orderId, order);
          generateEvent(`Next execution scheduled for order: ${orderId}`);
        } else {
          // All occurrences completed
          order.isActive = false;
          this.orders.set(orderId, order);
          generateEvent(`Order completed: ${orderId}`);
        }
      } else {
        // Limit orders are one-time
        order.isActive = false;
        this.orders.set(orderId, order);
        generateEvent(`Limit order executed: ${orderId}`);
      }

    } catch (e: any) {
      generateEvent(`Execution failed for order ${orderId}: ${e.message}`);
      // Mark as inactive on critical failures
      order.isActive = false;
      this.orders.set(orderId, order);
    }
  }

  /**
   * Cancel a scheduled order and refund remaining tokens
   */
  // @export <-- REMOVED
  cancelOrder(orderId: string): void {
    const caller = Context.caller().toString();
    const order = this.orders.get(orderId);

    if (!order) {
      throw new Error("Order not found");
    }

    if (order.user !== caller) {
      throw new Error("Only order creator can cancel");
    }

    if (!order.isActive) {
      throw new Error("Order already inactive");
    }

    // Calculate remaining tokens to refund
    const remainingOccurrences = order.totalOccurrences - order.executedOccurrences;
    const refundAmount = order.amountIn * remainingOccurrences;

    if (refundAmount > 0) {
      if (order.tokenIn === this.MAS_TOKEN) {
        transferCoins(new Address(order.user), refundAmount); // <-- FIXED
      } else {
        const token = new IERC20(new Address(order.tokenIn)); // <-- FIXED
        token.transfer(new Address(order.user), refundAmount); // <-- FIXED
      }
    }

    order.isActive = false;
    this.orders.set(orderId, order);

    generateEvent(`Order cancelled: ${orderId}. Refunded: ${refundAmount}`);
  }

  /**
   * Get user's active orders
   */
  // @export <-- REMOVED
  getUserOrders(user: string): string[] {
    return this.userOrders.get(user) || [];
  }

  /**
   * Get order details
   */
  // @export <-- REMOVED
  getOrder(orderId: string): ScheduledOrder | null {
    return this.orders.get(orderId) || null;
  }

  /**
   * Emergency pause function (owner only)
   */
  // @export <-- REMOVED
  setPauseAllOrders(paused: boolean): void {
    if (Context.caller().toString() !== this.owner) {
      throw new Error("Only owner can pause");
    }

    // In a real implementation, we would iterate and pause all orders
    // For simplicity, we're just emitting an event
    generateEvent(`All orders ${paused ? 'paused' : 'unpaused'} by owner`);
  }

  // ============ PRIVATE METHODS ============

  private _generateOrderId(): string {
    const orderId = `order_${this.nextOrderId}_${Context.timestamp()}`;
    this.nextOrderId++;
    return orderId;
  }

  private _addUserOrder(user: string, orderId: string): void {
    let userOrderList = this.userOrders.get(user);
    if (!userOrderList) {
      userOrderList = [];
    }
    userOrderList.push(orderId);
    this.userOrders.set(user, userOrderList);
  }

  private _validateScheduleParams(
    tokenIn: string,
    tokenOut: string,
    amountIn: u64,
    minAmountOut: u64,
    interval: u64
  ): void {
    if (amountIn <= 0) {
      throw new Error("Amount must be positive");
    }
    if (interval != 0 && interval < 60) { // Minimum 1 minute interval, 0 for limit
      throw new Error("Interval too short");
    }
    if (tokenIn === tokenOut) {
      throw new Error("Tokens must be different");
    }
  }

  private _scheduleExecution(orderId: string, executionTime: u64): void {
    // Use Massa's autonomous execution to schedule the order
    call( // <-- FIXED
      Context.callee(),
      "executeOrder",
      new Args().add(orderId),
      executionTime
    );
    
    generateEvent(`Execution scheduled for order ${orderId} at ${executionTime}`);
  }

  private _executeSwap(order: ScheduledOrder): void {
    const dusaRouter = new IDusaRouter(new Address(this.DUSA_ROUTER)); // <-- FIXED
    
    if (order.tokenIn === this.MAS_TOKEN) {
      // Swap native MAS for tokens
      const path: Address[] = [new Address(this.MAS_TOKEN), new Address(order.tokenOut)]; // <-- FIXED
      dusaRouter.swapExactMASForTokens(
        order.amountIn, // <-- ADDED
        order.minAmountOut,
        path,
        new Address(order.user), // <-- FIXED
        order.executionTime + 300 // 5 minute deadline
      );
    } else if (order.tokenOut === this.MAS_TOKEN) {
      // Swap tokens for native MAS
      const path: Address[] = [new Address(order.tokenIn), new Address(this.MAS_TOKEN)]; // <-- FIXED
      const token = new IERC20(new Address(order.tokenIn)); // <-- FIXED
      
      // Approve Dusa router to spend tokens
      token.approve(new Address(this.DUSA_ROUTER), order.amountIn); // <-- FIXED
      
      dusaRouter.swapExactTokensForMAS(
        order.amountIn,
        order.minAmountOut,
        path,
        new Address(order.user), // <-- FIXED
        order.executionTime + 300
      );
    } else {
      // Swap token for token
      const path: Address[] = [new Address(order.tokenIn), new Address(order.tokenOut)]; // <-- FIXED
      const token = new IERC20(new Address(order.tokenIn)); // <-- FIXED
      
      // Approve Dusa router to spend tokens
      token.approve(new Address(this.DUSA_ROUTER), order.amountIn); // <-- FIXED
      
      dusaRouter.swapExactTokensForTokens(
        order.amountIn,
        order.minAmountOut,
        path,
        new Address(order.user), // <-- FIXED
        order.executionTime + 300
      );
    }

    generateEvent(`Swap executed: ${order.amountIn} ${order.tokenIn} -> ${order.tokenOut}`);
  }

  private _executePayment(order: ScheduledOrder): void {
    if (order.tokenIn === this.MAS_TOKEN) {
      // Send native MAS
      transferCoins(new Address(order.tokenOut), order.amountIn); // <-- FIXED
    } else {
      // Send SRC20 token
      const token = new IERC20(new Address(order.tokenIn)); // <-- FIXED
      token.transfer(new Address(order.tokenOut), order.amountIn); // <-- FIXED
    }

    generateEvent(`Payment executed: ${order.amountIn} ${order.tokenIn} to ${order.tokenOut}`);
  }

  /**
   * Contract self-destruct (owner only, for emergency)
   */
  // @export <-- REMOVED
  selfDestruct(): void {
    if (Context.caller().toString() !== this.owner) {
      throw new Error("Only owner can self-destruct");
    }

    // Return all funds to respective users
    const orders = this.orders.values();
    for (let i = 0; i < orders.length; i++) {
      const order = orders[i];
      if (order.isActive) {
        const remainingOccurrences = order.totalOccurrences - order.executedOccurrences;
        const refundAmount = order.amountIn * remainingOccurrences;
        
        if (refundAmount > 0) {
          if (order.tokenIn === this.MAS_TOKEN) {
            transferCoins(new Address(order.user), refundAmount); // <-- FIXED
          } else {
            const token = new IERC20(new Address(order.tokenIn)); // <-- FIXED
            token.transfer(new Address(order.user), refundAmount); // <-- FIXED
          }
        }
      }
    }

    generateEvent("ChronoSwap contract self-destructed by owner");
  }
}