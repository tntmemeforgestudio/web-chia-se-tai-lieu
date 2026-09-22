const express = require('express');
const mongoose = require('mongoose');
const path = require('path');

const app = express();

// Giới hạn nhận dữ liệu đính kèm tối đa 100MB
app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ extended: true, limit: '100mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// Hàm làm sạch dữ liệu đầu vào chống tấn công XSS & chèn Script độc hại
const sanitize = (text) => {
    if (typeof text !== 'string') return '';
    return text.replace(/</g, "&lt;").replace(/>/g, "&gt;");
};

// Kết nối MongoDB Atlas an toàn
const MONGO_URI = process.env.MONGO_URI || "mongodb+srv://tntmemeforgestudio_db_user:tnt123456@cluster0.dxos2d3.mongodb.net/?appName=Cluster0";

mongoose.connect(MONGO_URI)
  .then(() => console.log('✅ DB v2.0.1 kết nối an toàn!'))
  .catch(err => console.error('❌ Lỗi kết nối DB:', err.message));

// Schema Bài viết
const PostSchema = new mongoose.Schema({
    author: { type: String, default: 'Ẩn danh' },
    content: { type: String, required: true },
    mediaUrl: { type: String, default: '' },
    mediaName: { type: String, default: '' },
    likes: { type: Number, default: 0 },
    dislikes: { type: Number, default: 0 },
    createdAt: { type: Date, default: Date.now }
});

const Post = mongoose.model('Post', PostSchema);

// API Lấy danh sách bài viết
app.get('/api/posts', async (req, res) => {
    try {
        const posts = await Post.find().sort({ createdAt: -1 });
        res.json(posts);
    } catch (err) {
        res.status(500).json({ error: "Lỗi hệ thống khi lấy dữ liệu" });
    }
});

// API Đăng bài viết mới
app.post('/api/posts', async (req, res) => {
    try {
        const { author, content, mediaUrl, mediaName } = req.body;
        if (!content || !content.trim()) {
            return res.status(400).json({ error: "Nội dung bài viết không được để trống!" });
        }

        const newPost = new Post({
            author: sanitize(author) || 'Ẩn danh',
            content: sanitize(content),
            mediaUrl: mediaUrl || '',
            mediaName: sanitize(mediaName) || ''
        });

        await newPost.save();
        res.status(201).json(newPost);
    } catch (err) {
        res.status(500).json({ error: "Không thể lưu bài viết" });
    }
});

// API Xóa bài viết
app.delete('/api/posts/:id', async (req, res) => {
    try {
        await Post.findByIdAndDelete(req.params.id);
        res.json({ message: "Đã xóa bài viết thành công" });
    } catch (err) {
        res.status(500).json({ error: "Lỗi khi xóa bài viết" });
    }
});

// API Thả Like / Dislike
app.post('/api/posts/:id/like', async (req, res) => {
    try {
        const post = await Post.findByIdAndUpdate(req.params.id, { $inc: { likes: 1 } }, { new: true });
        res.json(post);
    } catch (err) {
        res.status(500).json({ error: "Lỗi tương tác" });
    }
});

app.post('/api/posts/:id/dislike', async (req, res) => {
    try {
        const post = await Post.findByIdAndUpdate(req.params.id, { $inc: { dislikes: 1 } }, { new: true });
        res.json(post);
    } catch (err) {
        res.status(500).json({ error: "Lỗi tương tác" });
    }
});

app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`🚀 Server v2.0.1 đang chạy tại port ${PORT}`));
