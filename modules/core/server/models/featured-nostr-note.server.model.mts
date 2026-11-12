import mongoose from 'mongoose';

export interface FeaturedNostrNoteRecord {
  _id: string;
  npub: string;
  content: string;
  publishedAt: Date;
  featuredAt: Date | null;
  deletionId?: string;
}

const schema = new mongoose.Schema<FeaturedNostrNoteRecord>(
  {
    _id: { type: String, required: true },
    npub: { type: String, required: true },
    content: { type: String, default: '' },
    publishedAt: { type: Date, required: true },
    featuredAt: { type: Date, default: null },
    deletionId: String,
  },
  { versionKey: false },
);

schema.index({ featuredAt: -1, _id: 1 });

export default mongoose.model('FeaturedNostrNote', schema);
