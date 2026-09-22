const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// URI kết nối MongoDB (Có chuỗi dự phòng chống crash Render)
const MONGO_URI = process.env.MONGO_URI || "mongodb+srv://tntmemeforgestudio_db_user:tnt123456@cluster0.dxos2d3.mongodb.net/test?retryWrites=true&w=majority";

// Kết nối Database an toàn
mongoose.connect(MONGO_URI)
  .then(() => console.log('✅ MongoDB v2.0 Stable kết nối thành công!'))
  .catch(err => console.error('❌ Lỗi kết nối DB:', err.message));

// Schema Bài viết
const PostSchema = new mongoose.Schema({
    author: String,
    content: String,
    mediaUrl: String,
    likes: { type: Number, default: 0 },
    dislikes: { type: Number, default: 0 },
    createdAt: { type: Date, default: Date.now }
});
const Post = mongoose.model('Post', PostSchema);

// --- CÁC ROUTE API ---

// 1. Lấy danh sách bài viết
app.get('/api/posts', async (req, res) => {
    try {
        const posts = await Post.find().sort({ createdAt: -1 });
        res.json(posts);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 2. Tạo bài viết mới
app.post('/api/posts', async (req, res) => {
    try {
        const { author, content, mediaUrl } = req.body;
        const newPost = new Post({ author, content, mediaUrl });
        await newPost.save();
        res.status(201).json(newPost);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 3. Xóa bài viết
app.delete('/api/posts/:id', async (req, res) => {
    try {
        await Post.findByIdAndDelete(req.params.id);
        res.json({ message: "Xóa bài viết thành công" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 4. Thích bài viết (Like)
app.post('/api/posts/:id/like', async (req, res) => {
    try {
        const post = await Post.findByIdAndUpdate(req.params.id, { $inc: { likes: 1 } }, { new: true });
        res.json(post);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 5. Bỏ thích bài viết (Dislike)
app.post('/api/posts/:id/dislike', async (req, res) => {
    try {
        const post = await Post.findByIdAndUpdate(req.params.id, { $inc: { dislikes: 1 } }, { new: true });
        res.json(post);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Phục vụ giao diện chính
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`🚀 Server v2.0 đang chạy tại port ${PORT}`));
