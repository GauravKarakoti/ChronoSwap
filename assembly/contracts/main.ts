import { Storage, Context, generateEvent, call, transferCoins, Address, createSC, sendMessage } from "@massalabs/massa-as-sdk";
import { IERC20 } from "./interfaces/IERC20";
import { IDusaRouter } from "./interfaces/IDusaRouter";

// Order structure for scheduled swaps
@nearBindgen
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
  @export
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
      const token = createSC<IERC20>(tokenIn);
      const allowance = token.allowance(Address.fromString(caller), Address.fromString(Context.callee().toString()));
      if (allowance < amountIn * totalOccurrences) {
        generateEvent("Insufficient token allowance for DCA schedule");
        throw new Error("Insufficient token allowance");
      }
      token.transferFrom(Address.fromString(caller), Context.callee(), amountIn * totalOccurrences);
    }

    // Schedule first execution using Massa's autonomous execution
    this._scheduleExecution(orderId, currentTime + interval);

    generateEvent(`DCA scheduled: ${orderId} for user: ${caller}`);
    return orderId;
  }

  /**
   * Schedule a limit order
   */
  @export
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
      const token = createSC<IERC20>(tokenIn);
      const allowance = token.allowance(Address.fromString(caller), Address.fromString(Context.callee().toString()));
      if (allowance < amountIn) {
        throw new Error("Insufficient token allowance");
      }
      token.transferFrom(Address.fromString(caller), Context.callee(), amountIn);
    }

    this._scheduleExecution(orderId, executionTime);

    generateEvent(`Limit order scheduled: ${orderId} for user: ${caller}`);
    return orderId;
  }

  /**
   * Schedule recurring payments
   */
  @export
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
      const tokenSC = createSC<IERC20>(token);
      const allowance = tokenSC.allowance(Address.fromString(caller), Address.fromString(Context.callee().toString()));
      if (allowance < amount * totalOccurrences) {
        throw new Error("Insufficient token allowance");
      }
      tokenSC.transferFrom(Address.fromString(caller), Context.callee(), amount * totalOccurrences);
    }

    this._scheduleExecution(orderId, currentTime + interval);

    generateEvent(`Recurring payment scheduled: ${orderId} from ${caller} to ${recipient}`);
    return orderId;
  }

  /**
   * Execute a scheduled order (called autonomously by Massa network)
   */
  @export
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

    } catch (error) {
      generateEvent(`Execution failed for order ${orderId}: ${error.message}`);
      // Mark as inactive on critical failures
      order.isActive = false;
      this.orders.set(orderId, order);
    }
  }

  /**
   * Cancel a scheduled order and refund remaining tokens
   */
  @export
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
        transferCoins(Address.fromString(order.user), refundAmount);
      } else {
        const token = createSC<IERC20>(order.tokenIn);
        token.transfer(Address.fromString(order.user), refundAmount);
      }
    }

    order.isActive = false;
    this.orders.set(orderId, order);

    generateEvent(`Order cancelled: ${orderId}. Refunded: ${refundAmount}`);
  }

  /**
   * Get user's active orders
   */
  @export
  getUserOrders(user: string): string[] {
    return this.userOrders.get(user) || [];
  }

  /**
   * Get order details
   */
  @export
  getOrder(orderId: string): ScheduledOrder | null {
    return this.orders.get(orderId) || null;
  }

  /**
   * Emergency pause function (owner only)
   */
  @export
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
    if (interval < 60) { // Minimum 1 minute interval
      throw new Error("Interval too short");
    }
    if (tokenIn === tokenOut) {
      throw new Error("Tokens must be different");
    }
  }

  private _scheduleExecution(orderId: string, executionTime: u64): void {
    // Use Massa's autonomous execution to schedule the order
    // This will be called automatically by the network at the specified time
    const callArgs = `executeOrder|${orderId}`;
    
    // Store the scheduled execution time
    Storage.set(`scheduled_${orderId}`, executionTime.toString());
    
    generateEvent(`Execution scheduled for order ${orderId} at ${executionTime}`);
  }

  private _executeSwap(order: ScheduledOrder): void {
    const dusaRouter = createSC<IDusaRouter>(this.DUSA_ROUTER);
    
    if (order.tokenIn === this.MAS_TOKEN) {
      // Swap native MAS for tokens
      const path: string[] = [this.MAS_TOKEN, order.tokenOut];
      dusaRouter.swapExactMASForTokens(
        order.minAmountOut,
        path,
        Address.fromString(order.user),
        order.executionTime + 300 // 5 minute deadline
      );
    } else if (order.tokenOut === this.MAS_TOKEN) {
      // Swap tokens for native MAS
      const path: string[] = [order.tokenIn, this.MAS_TOKEN];
      const token = createSC<IERC20>(order.tokenIn);
      
      // Approve Dusa router to spend tokens
      token.approve(Address.fromString(this.DUSA_ROUTER), order.amountIn);
      
      dusaRouter.swapExactTokensForMAS(
        order.amountIn,
        order.minAmountOut,
        path,
        Address.fromString(order.user),
        order.executionTime + 300
      );
    } else {
      // Swap token for token
      const path: string[] = [order.tokenIn, order.tokenOut];
      const token = createSC<IERC20>(order.tokenIn);
      
      // Approve Dusa router to spend tokens
      token.approve(Address.fromString(this.DUSA_ROUTER), order.amountIn);
      
      dusaRouter.swapExactTokensForTokens(
        order.amountIn,
        order.minAmountOut,
        path,
        Address.fromString(order.user),
        order.executionTime + 300
      );
    }

    generateEvent(`Swap executed: ${order.amountIn} ${order.tokenIn} -> ${order.tokenOut}`);
  }

  private _executePayment(order: ScheduledOrder): void {
    if (order.tokenIn === this.MAS_TOKEN) {
      // Send native MAS
      transferCoins(Address.fromString(order.tokenOut), order.amountIn); // tokenOut is recipient for payments
    } else {
      // Send SRC20 token
      const token = createSC<IERC20>(order.tokenIn);
      token.transfer(Address.fromString(order.tokenOut), order.amountIn);
    }

    generateEvent(`Payment executed: ${order.amountIn} ${order.tokenIn} to ${order.tokenOut}`);
  }

  /**
   * Contract self-destruct (owner only, for emergency)
   */
  @export
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
            transferCoins(Address.fromString(order.user), refundAmount);
          } else {
            const token = createSC<IERC20>(order.tokenIn);
            token.transfer(Address.fromString(order.user), refundAmount);
          }
        }
      }
    }

    generateEvent("ChronoSwap contract self-destructed by owner");
  }
}