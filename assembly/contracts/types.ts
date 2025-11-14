import { serializable } from "as-json";

@serializable // <-- ADD THIS
export class Order {
  id: string;
  user: string;
  fromToken: string;
  toToken: string;
  amount: u64;
  limitPrice: u64;
  expiry: u64;
  status: OrderStatus;
  createdAt: u64;
  updatedAt: u64;
}

export enum OrderStatus {
  PENDING = 0,
  EXECUTED = 1,
  CANCELLED = 2,
  EXPIRED = 3
}

@serializable // <-- ADD THIS
export class Strategy {
  id: string;
  user: string;
  type: StrategyType;
  orders: string[];
  frequency: u64;
  nextExecution: u64;
  totalExecuted: u64;
  status: StrategyStatus;
  config: string; // JSON string of strategy config
  updatedAt: u64; // <-- ADD THIS LINE
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
  dex: string;
  amountOut: u64;
  path: string[];
  gasEstimate: u64;
}