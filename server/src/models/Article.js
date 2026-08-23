const mongoose = require('mongoose');

// บทความฐานความรู้ (Knowledge Base) ที่มาจาก Resolution Note
const articleSchema = new mongoose.Schema(
  {
    ref: { type: String, unique: true }, // KB-0142
    title: { type: String, required: true, trim: true },
    summary: { type: String, default: '' },
    body: { type: String, default: '' },
    category: { type: mongoose.Schema.Types.ObjectId, ref: 'Category' },
    author: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    authorName: { type: String, default: '' },
    sourceTicket: { type: mongoose.Schema.Types.ObjectId, ref: 'Ticket' },
    uses: { type: Number, default: 0 },
    published: { type: Boolean, default: true }
  },
  { timestamps: true }
);

articleSchema.index({ title: 'text', summary: 'text', body: 'text' });

module.exports = mongoose.model('Article', articleSchema);
