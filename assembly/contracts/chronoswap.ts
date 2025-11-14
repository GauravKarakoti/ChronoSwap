import { Storage, Context, generateEvent, call } from '@massalabs/massa-as-sdk';
import { Order, OrderStatus, Strategy, StrategyType, StrategyStatus } from './types';
import { Args } from '@massalabs/as-types'; // <-- ADD THIS
import { JSON } from "as-json";

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

  createDCAStrategy(
    fromToken: string,
    toToken: string,
    amount: u64,
    frequency: u64, // in seconds
    duration: u64 // in seconds
  ): string {
    const caller = Context.caller().toString();
    const strategyId = this._generateStrategyId();
    
    // FIX: Change object literal to class instance
    const strategy = new Strategy();
    strategy.id = strategyId;
    strategy.user = caller;
    strategy.type = StrategyType.DCA;
    strategy.orders = [];
    strategy.frequency = frequency;
    strategy.nextExecution = Context.timestamp() + frequency;
    strategy.totalExecuted = 0;
    strategy.status = StrategyStatus.ACTIVE;
    strategy.config = `{"fromToken":"${fromToken}","toToken":"${toToken}","amount":${amount},"duration":${duration}}`;

    // Store strategy
    // FIX: Stringify the strategy object before storing
    Storage.set(`strategy_${strategyId}`, JSON.stringify(strategy));
    
    // Update user's strategies
    const userStrategies = Storage.get(`user_strategies_${caller}`) || "[]";
    const strategies = JSON.parse<string[]>(userStrategies); // <-- FIX: Add type assertion
    strategies.push(strategyId);
    Storage.set(`user_strategies_${caller}`, JSON.stringify(strategies));

    // Schedule first execution
    this._scheduleExecution(strategyId, strategy.nextExecution);

    generateEvent(`DCA Strategy created: ${strategyId} by ${caller}`);
    return strategyId;
  }

  createLimitOrder(
    fromToken: string,
    toToken: string,
    amount: u64,
    limitPrice: u64,
    expiry: u64
  ): string {
    const caller = Context.caller().toString();
    const orderId = this._generateOrderId();

    // FIX: Change object literal to class instance
    const order = new Order();
    order.id = orderId;
    order.user = caller;
    order.fromToken = fromToken;
    order.toToken = toToken;
    order.amount = amount;
    order.limitPrice = limitPrice;
    order.expiry = expiry;
    order.status = OrderStatus.PENDING;
    order.createdAt = Context.timestamp();
    order.updatedAt = Context.timestamp();

    // Store order
    // FIX: Stringify the order object before storing
    Storage.set(`order_${orderId}`, JSON.stringify(order));

    // Update user's orders
    const userOrders = Storage.get(`user_orders_${caller}`) || "[]";
    const orders = JSON.parse<string[]>(userOrders); // <-- FIX: Add type assertion
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
    const strategy = JSON.parse<Strategy>(Storage.get(`strategy_${strategyId}`));
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

    if (strategy.status === StrategyStatus.ACTIVE) {
      strategy.nextExecution = Context.timestamp() + strategy.frequency;
      // FIX: Stringify the strategy object before storing
      Storage.set(`strategy_${strategyId}`, JSON.stringify(strategy));
      this._scheduleExecution(strategyId, strategy.nextExecution);
    }
  }

  /**
   * Cancel a strategy
   */
  cancelStrategy(strategyId: string): void {
    const caller = Context.caller().toString();
    // FIX: Get the string and parse it
    const strategy = JSON.parse<Strategy>(Storage.get(`strategy_${strategyId}`));
    
    if (!strategy) {
      throw new Error("Strategy not found");
    }

    if (strategy.user !== caller) {
      throw new Error("Not strategy owner");
    }

    strategy.status = StrategyStatus.CANCELLED;
    strategy.updatedAt = Context.timestamp(); // This line is now valid
    // FIX: Stringify the strategy object before storing
    Storage.set(`strategy_${strategyId}`, JSON.stringify(strategy));

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
      new Args().add(strategyId), // <-- CORRECTED
      timestamp
    );
  }

  private _scheduleExpiryCheck(orderId: string, expiry: u64): void {
    call(
      Context.callee(),
      "checkOrderExpiry",
      new Args().add(orderId), // <-- CORRECTED
      expiry
    );
  }

  private _executeDCAStrategy(strategy: Strategy): void {
    const config = JSON.parse(strategy.config);
    
    // Execute swap through DEX router
    // This would call the multi-dex router
    generateEvent(`Executing DCA strategy: ${strategy.id}`);
    
    strategy.totalExecuted += 1;
    // FIX: Stringify the strategy object before storing
    Storage.set(`strategy_${strategy.id}`, JSON.stringify(strategy));
  }
}