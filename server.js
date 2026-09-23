const express = require('express');
const mongoose = require('mongoose');
const path = require('path');

const app = express();

// Tăng giới hạn dung lượng tải file lên 100MB
app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ limit: '100mb', extended: true }));

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
    isAdmin: { type: Boolean, default: false }, // Cờ nhận diện bài viết có lệnh ẩn (hiện tick vàng + khung vàng)
    likes: { type: Number, default: 0 },
    dislikes: { type: Number, default: 0 },
    createdAt: { type: Date, default: Date.now }
});
const Post = mongoose.model('Post', postSchema);

// API Lấy danh sách bài viết
app.get('/api/posts', async (req, res) => {
    try {
        const posts = await Post.find().sort({ createdAt: -1 });
        res.json(posts);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// API Đăng bài viết mới (Xử lý lệnh ẩn độc quyền '# vip bro' trên Server)
app.post('/api/posts', async (req, res) => {
    try {
        let { author, content, mediaUrl, mediaName, authorToken } = req.body;
        let isAdmin = false;

        // Xử lý lệnh ẩn bí mật tuyệt đối:
        // Nếu tên tác giả có chứa cú pháp '# vip bro'
        if (author && author.includes('# vip bro')) {
            isAdmin = true; // Bật cờ VIP để kích hoạt Tích vàng + Khung vàng
            author = author.replace(/# vip bro/g, '').trim(); // Lọc bỏ lệnh ẩn, giữ lại tên gốc hiển thị sạch
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
        res.json(savedPost);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// API Thả Like
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

// API Thả Dislike
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

// API Xóa bài viết (Chỉ người đăng bài trùng token mới được xóa)
app.delete('/api/posts/:id', async (req, res) => {
    try {
        const authorToken = req.headers['x-author-token'];
        const post = await Post.findById(req.params.id);
        
        if (!post) {
            return res.status(404).json({ error: "Không tìm thấy bài viết" });
        }

        // Cho phép xóa nếu trùng token thiết bị hoặc bài viết cũ không có token
        if (post.authorToken && authorToken && post.authorToken !== authorToken) {
            return res.status(403).json({ error: "Bạn không có quyền xóa bài viết này!" });
        }

        await Post.findByIdAndDelete(req.params.id);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ĐỔI DUY NHẤT ĐOẠN NÀY ĐỂ RENDER NHẬN CỔNG CỦA SERVER
const PORT = process.env.PORT || 10000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Server đang chạy tại cổng ${PORT}`);
});
