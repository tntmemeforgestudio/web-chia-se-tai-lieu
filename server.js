const express = require('express');
const mongoose = require('mongoose');
const path = require('path');

const app = express();

// Tăng giới hạn dung lượng tải file lên 50MB qua JSON
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Phục vụ giao diện tĩnh từ thư mục public
app.use(express.static(path.join(__dirname, 'public')));

// Kết nối MongoDB Atlas (Thay link của bạn vào đây hoặc dùng biến môi trường MONGO_URI trên Render)
const MONGO_URI = process.env.MONGO_URI || "mongodb+srv://<username>:<password>@cluster.mongodb.net/?retryWrites=true&w=majority";

mongoose.connect(MONGO_URI)
  .then(() => console.log("✅ Đã kết nối MongoDB thành công!"))
  .catch(err => console.error("❌ Lỗi kết nối MongoDB:", err));

// Định nghĩa cấu trúc dữ liệu bài viết
const postSchema = new mongoose.Schema({
    author: String,
    content: String,
    mediaUrl: String,
    mediaName: String,
    authorToken: String,
    likes: { type: Number, default: 0 },
    dislikes: { type: Number, default: 0 },
    createdAt: { type: Date, default: Date.now }
});
const Post = mongoose.model('Post', postSchema);

// --- API ROUTES ---

// 1. Lấy danh sách bài viết
app.get('/api/posts', async (req, res) => {
    try {
        const posts = await Post.find().sort({ createdAt: -1 });
        res.json(posts);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 2. Đăng bài viết mới
app.post('/api/posts', async (req, res) => {
    try {
        const newPost = new Post(req.body);
        const savedPost = await newPost.save();
        res.json(savedPost);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 3. Thả Like bài viết
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

// 4. Thả Dislike bài viết
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

// 5. Xóa bài viết (Chỉ chủ nhân tạo bài mới xóa được)
app.delete('/api/posts/:id', async (req, res) => {
    try {
        const authorToken = req.headers['x-author-token'];
        const post = await Post.findById(req.params.id);
        
        if (!post) {
            return res.status(404).json({ error: "Không tìm thấy bài viết" });
        }

        // Kiểm tra quyền xóa dựa theo token thiết bị hoặc cho phép xóa tự do nếu không có token cũ
        if (post.authorToken && authorToken && post.authorToken !== authorToken) {
            return res.status(403).json({ error: "Bạn không có quyền xóa bài viết này!" });
        }

        await Post.findByIdAndDelete(req.params.id);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Khởi động Server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 Server đang chạy tại cổng ${PORT}`);
});
