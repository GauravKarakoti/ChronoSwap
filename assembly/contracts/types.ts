import { serializable } from "as-json";

@serializable // <-- ADD THIS
export class Order {
  id: string = "";
  user: string = "";
  fromToken: string = "";
  toToken: string = "";
  amount: u64 = 0;
  limitPrice: u64 = 0;
  expiry: u64 = 0;
  status: OrderStatus = OrderStatus.PENDING;
  createdAt: u64 = 0;
  updatedAt: u64 = 0;
}

export enum OrderStatus {
  PENDING = 0,
  EXECUTED = 1,
  CANCELLED = 2,
  EXPIRED = 3
}

@serializable // <-- ADD THIS
export class Strategy {
  id: string = "";
  user: string = "";
  type: StrategyType = StrategyType.DCA;
  orders: string[] = [];
  frequency: u64 = 0;
  nextExecution: u64 = 0;
  totalExecuted: u64 = 0;
  status: StrategyStatus = StrategyStatus.ACTIVE;
  config: string = ""; // JSON string of strategy config
  updatedAt: u64 = 0; // <-- ADD THIS LINE
}

export enum StrategyType {
  DCA = 0,
  LIMIT_ORDER = 1,
  RECURRING_PAYMENT = 2
}

export enum StrategyStatus {
  ACTIVE = 0,
  PAUSED = 1,
  COMPLETED = 2,
  CANCELLED = 3
}

export class Route {
  dex: string = "";
  amountOut: u64 = 0;
  path: string[] = [];
  gasEstimate: u64 = 0;
}