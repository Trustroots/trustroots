import textService from '../../../core/server/services/text.server.service.mjs';
import config from '../../../../config/config.mts';
import mongoose, { type HydratedDocument, type Types } from 'mongoose';
import moment from 'moment';
import mongoosePaginate from '../../../../config/lib/mongoose-paginate.mjs';
import uniqueValidation from '../../../../config/lib/mongoose-unique-validation.mjs';
import urlslugs from '../../../../config/lib/mongoose-url-slugs.mjs';
import speakingurl from 'speakingurl';
import validator from 'validator';
import sanitizeHtml from 'sanitize-html';

export interface TribeRecord {
  _id: Types.ObjectId;
  label: string;
  labelHistory?: string[];
  slugHistory?: string[];
  synonyms?: string[];
  slug?: string;
  color?: string;
  count?: number;
  created?: Date;
  modified?: Date;
  public?: boolean;
  image?: boolean;
  attribution?: string;
  attribution_url?: string;
  description?: string;
}

interface TribeVirtuals {
  new: boolean;
}

type TribeDocument = HydratedDocument<TribeRecord, TribeVirtuals>;

const { Schema } = mongoose;
const { sanitizeOptions } = textService;

// White circle labels remain readable on every colour in this palette.
const circleColours = [
  '1e3a8a',
  '1e40af',
  '065f46',
  '166534',
  '854d0e',
  '92400e',
  '9a3412',
  '991b1b',
  '6b21a8',
  '86198f',
  '155e75',
  '334155',
];

/** Return a dark six-character hex colour without a leading `#`. */
function randomHex(): string {
  return circleColours[Math.floor(Math.random() * circleColours.length)];
}

function validateColour(color: string) {
  return /^[0-9a-fA-F]{6}$/.test(color);
}

/** Validate labels while preserving the existing validator's truthiness result. */
function validateLabel(
  label: string,
): boolean | string | RegExpMatchArray | null | undefined {
  return (
    label &&
    label.match(/[a-zA-Z]/) &&
    config.illegalStrings.indexOf(label.trim().toLowerCase()) < 0 &&
    label.charAt(0) !== '.' &&
    label.slice(-1) !== '.'
  );
}

/** Validate public attribution URLs. */
function validateURL(url: string | undefined): boolean {
  return (
    !url ||
    validator.isURL(url, {
      protocols: ['http', 'https'],
      require_tld: true,
      require_protocol: true,
      require_valid_protocol: true,
      allow_underscores: false,
      allow_trailing_dot: false,
      allow_protocol_relative_urls: false,
    })
  );
}

const TribeSchema = new Schema<TribeRecord>({
  label: {
    type: String,
    minlength: 2,
    maxlength: 255,
    trim: true,
    required: true,
    // Mongoose's runtime supports a custom duplicate message here, though its
    // current SchemaDefinition type only permits a boolean.
    unique: 'Tribe exists already.' as unknown as boolean,
    validate: [validateLabel, 'Please fill a valid name.'],
  },
  labelHistory: { type: [String] },
  slugHistory: { type: [String] },
  synonyms: { type: [String] },
  color: {
    type: String,
    minlength: 6,
    maxlength: 6,
    required: true,
    default: randomHex,
    validate: [validateColour, 'Please choose a valid colour.'],
  },
  count: {
    type: Number,
    validate: {
      validator: Number.isInteger,
      message: 'Error, expected `{PATH}` to be an integer. Value: `{VALUE}`',
    },
    min: 0,
    default: 0,
    required: true,
  },
  created: { type: Date, default: Date.now, required: true },
  modified: { type: Date, default: Date.now },
  public: { type: Boolean, default: true, required: true },
  image: { type: Boolean, default: false, required: true },
  attribution: { type: String, minlength: 3, maxlength: 255 },
  attribution_url: {
    type: String,
    minlength: 12,
    trim: true,
    validate: [validateURL, 'Please fill a valid URL.'],
  },
  description: {
    type: String,
    trim: true,
    get: (value: string | undefined) =>
      value && sanitizeHtml(value, sanitizeOptions),
  },
});

TribeSchema.set('toJSON', { getters: true });

TribeSchema.virtual('new').get(function (this: TribeDocument) {
  const newLimit = moment().subtract(60, 'day');
  return (
    typeof this.created !== 'undefined' &&
    moment(this.created).isAfter(newLimit)
  );
});

TribeSchema.plugin(
  urlslugs('label', {
    field: 'slug',
    generator(value: string) {
      return speakingurl(value, {
        separator: '-',
        maintainCase: false,
        truncate: 255,
      });
    },
  }),
);

// This JavaScript plugin has no declaration; its runtime contract is a schema plugin.
const uniqueValidationPlugin = uniqueValidation as unknown as (
  schema: typeof TribeSchema,
) => void;
TribeSchema.plugin(uniqueValidationPlugin);
TribeSchema.index({ slug: 1, label: 1 });
TribeSchema.plugin(mongoosePaginate);
mongoose.model<TribeRecord>('Tribe', TribeSchema);

const service = {};
export default service;
export { service as 'module.exports' };
