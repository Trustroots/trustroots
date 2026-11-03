import mongoose from 'mongoose';

export interface SignupReviewRule {
  kind: 'keyword' | 'email' | 'domain';
  value: string;
}
export interface SignupReviewRules {
  _id: string;
  revision: number;
  rules: SignupReviewRule[];
}
const schema = new mongoose.Schema<SignupReviewRules>({
  _id: String,
  revision: { type: Number, required: true },
  rules: [
    {
      _id: false,
      kind: {
        type: String,
        enum: ['keyword', 'email', 'domain'],
        required: true,
      },
      value: { type: String, required: true },
    },
  ],
});
mongoose.model<SignupReviewRules>('SignupReviewRules', schema);
