import type { Types } from 'mongoose';

export type Done<Values extends unknown[] = []> = (
  error?: unknown,
  ...values: Values
) => void;
export type Result<T> = (error: unknown, value: T) => void;
export interface Query<T> extends PromiseLike<T> {
  exec(): Promise<T>;
  cursor(): Cursor<T extends Array<infer Item> ? Item : T>;
}
export interface Cursor<T> {
  next(): Promise<T | null>;
}
export interface Model<T> {
  countDocuments(query?: object): Promise<number>;
  find(query?: object): Query<T[]>;
  findByIdAndDelete(id: Types.ObjectId): Promise<unknown>;
  aggregate<Row>(pipeline: object[]): Promise<Row[]>;
}
export interface LegacyMongoose {
  Promise: PromiseConstructor;
  set(name: 'strictQuery', value: boolean): void;
  connect(uri: string): Promise<unknown>;
  disconnect(): Promise<void>;
  model<T>(name: string): Model<T>;
}
export interface ConnectionHelper {
  connect(callback: Done): void;
  disconnect(callback: Done): void;
}
export interface DayGroup {
  _id: { year: number; month: number; day: number; dayOfYear?: number };
  count: number;
}
export interface AggregatedDayGroup extends DayGroup {
  _id: DayGroup['_id'] & { dayOfYear: number };
}
export interface CountUsers {
  created: Date;
}
export interface HistoricalMessage {
  _id: Types.ObjectId;
  userFrom: Types.ObjectId;
  userTo: Types.ObjectId;
  created: Date;
  content: string;
}
