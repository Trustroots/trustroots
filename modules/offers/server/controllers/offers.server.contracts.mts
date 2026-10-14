import type { NextFunction, Response } from 'express';
import type { Types } from 'mongoose';
import type {
  CreateOfferRequest,
  OfferMutationResponse,
  OfferMember,
  OfferPayload,
  OfferSearchFeatureCollection,
  OfferStatus,
  OfferType,
  UpdateOfferRequest,
} from '../../shared/offer.js';
import type { OfferServerRecord } from '../models/offer.server.types.mts';

export interface AuthenticatedOfferUser {
  _id: Types.ObjectId;
  roles?: string[];
  member?: Array<{ tribe: Types.ObjectId }>;
}

export type PopulatedOfferUser = OfferMember<Types.ObjectId, Date>;

/** Schema defaults populate type/status; neither they nor owner are required
 * fields in the persisted schema contract. */
export type OfferEndpointRecord = Omit<
  OfferServerRecord,
  'user' | 'type' | 'status' | 'location'
> & {
  type?: OfferServerRecord['type'];
  status?: OfferServerRecord['status'];
  location: number[];
  user?: Types.ObjectId | PopulatedOfferUser;
};

export type OfferSanitiseRecord = Omit<
  OfferPayload<Types.ObjectId, Date>,
  'user' | 'location'
> & {
  user?:
    Types.ObjectId | string | OfferMember<Types.ObjectId | string, Date> | null;
  location: OfferServerRecord['location'];
  locationFuzzy?: OfferServerRecord['locationFuzzy'];
};

export type OfferSanitisedPayload = Omit<
  OfferPayload<Types.ObjectId | string, Date>,
  'user' | 'location' | 'status'
> & {
  user?:
    Types.ObjectId | string | OfferMember<Types.ObjectId | string, Date> | null;
  location?: OfferServerRecord['location'];
  status?: OfferPayload<Types.ObjectId | string, Date>['status'];
};

export interface OfferSanitiseDocument {
  toObject(): OfferSanitiseRecord;
}

export interface OfferEndpointDocument {
  _id: Types.ObjectId;
  type?: OfferType;
  status?: OfferStatus;
  user?: Types.ObjectId | PopulatedOfferUser | string | null;
  location: number[];
  locationFuzzy?: number[];
  description?: string;
  noOfferDescription?: string;
  maxGuests?: number;
  updated?: Date;
  validUntil?: Date;
  showOnlyInMyCircles?: boolean;
  set(path: string, value: unknown): void;
  save(callback: (error?: Error | null) => void): void;
  toObject(): OfferSanitiseRecord;
}

export interface OfferReadDocument {
  _id: Types.ObjectId;
  type: OfferType;
  status: OfferStatus;
  user: Types.ObjectId | PopulatedOfferUser | string;
  location: number[];
  locationFuzzy: number[];
  description?: string;
  noOfferDescription?: string;
  maxGuests?: number;
  updated?: Date;
  validUntil?: Date;
  showOnlyInMyCircles?: boolean;
  toObject(): OfferSanitiseRecord;
}

export type ValidOfferEndpointDocument = OfferEndpointDocument &
  OfferReadDocument;

/** Middleware-attached values are checked at the handler boundary. This shape
 * intentionally describes only request data, not a persisted model record. */
export interface OfferRequestDocument {
  _id?: unknown;
  type?: unknown;
  status?: unknown;
  user?: unknown;
  location?: unknown;
  locationFuzzy?: unknown;
  description?: unknown;
  noOfferDescription?: unknown;
  maxGuests?: unknown;
  updated?: unknown;
  validUntil?: unknown;
  showOnlyInMyCircles?: unknown;
  set?: OfferEndpointDocument['set'];
  save?: OfferEndpointDocument['save'];
  toObject?: () => unknown;
}

export type OfferQuery = Record<string, unknown>;
export type OfferErrorResponse = { message: string };
export type OfferResponseBody =
  | OfferErrorResponse
  | OfferMutationResponse
  | OfferSanitisedPayload
  | OfferSearchFeatureCollection
  | Array<OfferSanitisedPayload>;

export type OfferResponse = Pick<
  Response<OfferResponseBody>,
  'status' | 'send' | 'json'
>;
/** The controller methods only consume this subset of Express' request object.
 * Keeping the protocol structural also lets unit tests model malformed input. */
export interface OfferRequest<Body = Record<string, unknown>> {
  body?: Body;
  query?: OfferQuery;
  user?: AuthenticatedOfferUser | null;
  offer?: OfferRequestDocument | null;
  offers?: Array<OfferSanitisedPayload>;
}

export type OfferNext = NextFunction;
export type CreateRequest = OfferRequest<CreateOfferRequest>;
export type UpdateRequest = OfferRequest<
  UpdateOfferRequest & { type?: string }
>;
export type OfferCallback = (error: Error | null) => void;
