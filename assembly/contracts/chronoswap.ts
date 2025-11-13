import { Storage, Context, generateEvent, call } from '@massalabs/massa-as-sdk';
import { Order, OrderStatus, Strategy, StrategyType, StrategyStatus } from './types';

export class ChronoSwap {
  // Contract constants
  private static MAX_BATCH_SIZE: u32 = 50;
  private static OWNERS: string[] = [
    "AU12...owner1", // Replace with actual addresses
    "AU12...owner2",
    "AU12...owner3",
    "AU12...owner4",
    "AU12...owner5"
  ];
  private static REQUIRED_CONFIRMATIONS: u32 = 3;

  /**
   * Initialize the contract
   */
  constructor() {
    if (!Storage.has("initialized")) {
      Storage.set("initialized", "true");
      Storage.set("total_strategies", "0");
      Storage.set("total_volume", "0");
      generateEvent("ChronoSwap initialized successfully");
    }
  }

  /**
   * Create a new DCA strategy
   */
  createDCAStrategy(
    fromToken: string,
    toToken: string,
    amount: u64,
    frequency: u64, // in seconds
    duration: u64 // in seconds
  ): string {
    const caller = Context.caller().toString();
    const strategyId = this._generateStrategyId();
    
    const strategy: Strategy = {
      id: strategyId,
      user: caller,
      type: StrategyType.DCA,
      orders: [],
      frequency: frequency,
      nextExecution: Context.timestamp() + frequency,
      totalExecuted: 0,
      status: StrategyStatus.ACTIVE,
      config: `{"fromToken":"${fromToken}","toToken":"${toToken}","amount":${amount},"duration":${duration}}`
    };

    // Store strategy
    Storage.set(`strategy_${strategyId}`, strategy);
    
    // Update user's strategies
    const userStrategies = Storage.get(`user_strategies_${caller}`) || "[]";
    const strategies = JSON.parse(userStrategies);
    strategies.push(strategyId);
    Storage.set(`user_strategies_${caller}`, JSON.stringify(strategies));

    // Schedule first execution
    this._scheduleExecution(strategyId, strategy.nextExecution);

    generateEvent(`DCA Strategy created: ${strategyId} by ${caller}`);
    return strategyId;
  }

  /**
   * Create a limit order
   */
  createLimitOrder(
    fromToken: string,
    toToken: string,
    amount: u64,
    limitPrice: u64,
    expiry: u64
  ): string {
    const caller = Context.caller().toString();
    const orderId = this._generateOrderId();

    const order: Order = {
      id: orderId,
      user: caller,
      fromToken: fromToken,
      toToken: toToken,
      amount: amount,
      limitPrice: limitPrice,
      expiry: expiry,
      status: OrderStatus.PENDING,
      createdAt: Context.timestamp(),
      updatedAt: Context.timestamp()
    };

    // Store order
    Storage.set(`order_${orderId}`, order);

    // Update user's orders
    const userOrders = Storage.get(`user_orders_${caller}`) || "[]";
    const orders = JSON.parse(userOrders);
    orders.push(orderId);
    Storage.set(`user_orders_${caller}`, JSON.stringify(orders));

    // Schedule expiry check
    this._scheduleExpiryCheck(orderId, expiry);

    generateEvent(`Limit Order created: ${orderId} by ${caller}`);
    return orderId;
  }

  /**
   * Execute a scheduled strategy
   */
  executeStrategy(strategyId: string): void {
    const strategy = Storage.get<Strategy>(`strategy_${strategyId}`);
    if (!strategy || strategy.status !== StrategyStatus.ACTIVE) {
      generateEvent(`Strategy ${strategyId} not found or inactive`);
      return;
    }

    if (Context.timestamp() < strategy.nextExecution) {
      generateEvent(`Strategy ${strategyId} not ready for execution`);
      return;
    }

    // Execute the strategy based on type
    switch (strategy.type) {
      case StrategyType.DCA:
        this._executeDCAStrategy(strategy);
        break;
      case StrategyType.LIMIT_ORDER:
        // Limit orders are handled separately
        break;
      default:
        generateEvent(`Unknown strategy type: ${strategy.type}`);
    }

    // Schedule next execution if strategy is still active
    if (strategy.status === StrategyStatus.ACTIVE) {
      strategy.nextExecution = Context.timestamp() + strategy.frequency;
      Storage.set(`strategy_${strategyId}`, strategy);
      this._scheduleExecution(strategyId, strategy.nextExecution);
    }
  }

  /**
   * Cancel a strategy
   */
  cancelStrategy(strategyId: string): void {
    const caller = Context.caller().toString();
    const strategy = Storage.get<Strategy>(`strategy_${strategyId}`);
    
    if (!strategy) {
      throw new Error("Strategy not found");
    }

    if (strategy.user !== caller) {
      throw new Error("Not strategy owner");
    }

    strategy.status = StrategyStatus.CANCELLED;
    strategy.updatedAt = Context.timestamp();
    Storage.set(`strategy_${strategyId}`, strategy);

    generateEvent(`Strategy cancelled: ${strategyId} by ${caller}`);
  }

  // Private helper methods
  private _generateStrategyId(): string {
    const count = Storage.get("total_strategies") || "0";
    const newCount = I64.parseInt(count) + 1;
    Storage.set("total_strategies", newCount.toString());
    return `strategy_${newCount}`;
  }

  private _generateOrderId(): string {
    const count = Storage.get("total_orders") || "0";
    const newCount = I64.parseInt(count) + 1;
    Storage.set("total_orders", newCount.toString());
    return `order_${newCount}`;
  }

  private _scheduleExecution(strategyId: string, timestamp: u64): void {
    // Use Massa's deferred execution
    call(
      Context.callee(),
      "executeStrategy",
      [strategyId],
      timestamp
    );
  }

  private _scheduleExpiryCheck(orderId: string, expiry: u64): void {
    call(
      Context.callee(),
      "checkOrderExpiry",
      [orderId],
      expiry
    );
  }

  private _executeDCAStrategy(strategy: Strategy): void {
    const config = JSON.parse(strategy.config);
    
    // Execute swap through DEX router
    // This would call the multi-dex router
    generateEvent(`Executing DCA strategy: ${strategy.id}`);
    
    // Update strategy stats
    strategy.totalExecuted += 1;
    Storage.set(`strategy_${strategy.id}`, strategy);
  }
}