const express = require('express');
const mongoose = require('mongoose');
const path = require('path');

const app = express();

// Giới hạn payload 10MB để tránh đẩy dữ liệu quá lớn vào RAM
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

app.use(express.static(path.join(__dirname, 'public')));

const MONGO_URI = process.env.MONGO_URI || "mongodb+srv://<username>:<password>@cluster.mongodb.net/?retryWrites=true&w=majority";

mongoose.connect(MONGO_URI)
  .then(() => console.log("✅ Đã kết nối MongoDB thành công!"))
  .catch(err => console.error("❌ Lỗi kết nối MongoDB:", err));

const postSchema = new mongoose.Schema({
    author: String,
    content: String,
    mediaUrl: String,
    mediaName: String,
    authorToken: String,
    isAdmin: { type: Boolean, default: false },
    likes: { type: Number, default: 0 },
    dislikes: { type: Number, default: 0 },
    createdAt: { type: Date, default: Date.now }
});
const Post = mongoose.model('Post', postSchema);

// API Lấy danh sách bài viết (ĐÃ TỐI ƯU: Bỏ `mediaUrl` nặng khi load danh sách để tránh tràn RAM 512MB)
app.get('/api/posts', async (req, res) => {
    try {
        // Dùng .select('-mediaUrl') để KHÔNG kéo chuỗi Base64 nặng về RAM
        const posts = await Post.find().select('-mediaUrl').sort({ createdAt: -1 }).limit(50);
        res.json(posts);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// API Lấy dữ liệu file/ảnh riêng biệt khi cần xem
app.get('/api/posts/:id/media', async (req, res) => {
    try {
        const post = await Post.findById(req.params.id).select('mediaUrl mediaName');
        if (!post) return res.status(404).json({ error: "Không tìm thấy bài viết" });
        res.json({ mediaUrl: post.mediaUrl, mediaName: post.mediaName });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// API Đăng bài mới (Giữ nguyên tính năng bí mật '# vip bro')
app.post('/api/posts', async (req, res) => {
    try {
        let { author, content, mediaUrl, mediaName, authorToken } = req.body;
        let isAdmin = false;

        if (author && author.includes('# vip bro')) {
            isAdmin = true;
            author = author.replace(/# vip bro/g, '').trim();
        }

        const newPost = new Post({
            author: author || 'Ẩn danh',
            content,
            mediaUrl,
            mediaName,
            authorToken,
            isAdmin
        });

        const savedPost = await newPost.save();
        const responseData = savedPost.toObject();
        delete responseData.mediaUrl; // Trả về phản hồi nhẹ cho client
        res.json(responseData);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// API Like
app.post('/api/posts/:id/like', async (req, res) => {
    try {
        const post = await Post.findById(req.params.id);
        if (post) {
            post.likes = (post.likes || 0) + 1;
            await post.save();
            res.json({ success: true, likes: post.likes });
        } else {
            res.status(404).json({ error: "Không tìm thấy bài viết" });
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// API Dislike
app.post('/api/posts/:id/dislike', async (req, res) => {
    try {
        const post = await Post.findById(req.params.id);
        if (post) {
            post.dislikes = (post.dislikes || 0) + 1;
            await post.save();
            res.json({ success: true, dislikes: post.dislikes });
        } else {
            res.status(404).json({ error: "Không tìm thấy bài viết" });
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// API Xóa bài
app.delete('/api/posts/:id', async (req, res) => {
    try {
        const authorToken = req.headers['x-author-token'];
        const post = await Post.findById(req.params.id);
        
        if (!post) {
            return res.status(404).json({ error: "Không tìm thấy bài viết" });
        }

        if (post.authorToken && authorToken && post.authorToken !== authorToken) {
            return res.status(403).json({ error: "Bạn không có quyền xóa bài viết này!" });
        }

        await Post.findByIdAndDelete(req.params.id);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Server đang chạy tại cổng ${PORT}`);
});
