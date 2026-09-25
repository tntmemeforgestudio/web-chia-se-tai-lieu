const express = require('express');
const path = require('path');
const mongoose = require('mongoose');
const app = express();

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Kết nối MongoDB từ biến môi trường trên Render (như cấu hình bạn đã cài)
mongoose.connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true
})
.then(() => console.log("Đã kết nối MongoDB thành công!"))
.catch(err => console.error("Lỗi kết nối MongoDB:", err));

// Cấu trúc dữ liệu bài viết trong Database
const postSchema = new mongoose.Schema({
    author: String,
    content: String,
    authorToken: String,
    isVip: Boolean,
    createdAt: { type: Date, default: Date.now }
});
const Post = mongoose.model('Post', postSchema);

// API Lấy danh sách bài viết
app.get('/api/posts', async (req, res) => {
    try {
        const posts = await Post.find().sort({ createdAt: -1 });
        res.json(posts);
    } catch (error) {
        res.status(500).json({ error: 'Lỗi tải dữ liệu' });
    }
});

// API Đăng bài viết mới
app.post('/api/posts', async (req, res) => {
    try {
        const { author, content, authorToken } = req.body;
        const rawAuthor = author || 'Ẩn danh';

        // 🔒 BẢO MẬT TÍCH VÀNG ĐỘC QUYỀN:
        // Hãy thay chữ "TênCủaBạn" bằng tên chính xác mà bạn dùng để đăng bài.
        // Ngoài tên này ra, không ai có thể có tích vàng.
        const SECRET_AUTHOR_NAME = "nhà phát triển"; 
        const isVip = (rawAuthor.trim() === SECRET_AUTHOR_NAME);

        const newPost = new Post({
            author: rawAuthor,
            content: content || '',
            authorToken: authorToken || '',
            isVip: isVip
        });

        await newPost.save();
        res.status(201).json(newPost);
    } catch (error) {
        console.error("Lỗi đăng bài:", error);
        res.status(500).json({ error: 'Lỗi máy chủ' });
    }
});

// API Xóa bài viết
app.delete('/api/posts/:id', async (req, res) => {
    try {
        const postId = req.params.id;
        const authorToken = req.headers['x-author-token'];

        const post = await Post.findById(postId);
        if (!post) {
            return res.status(404).json({ error: 'Không tìm thấy bài viết' });
        }

        if (post.authorToken && post.authorToken !== authorToken) {
            return res.status(403).json({ error: 'Không có quyền xóa bài viết này' });
        }

        await Post.findByIdAndDelete(postId);
        res.status(200).json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Lỗi máy chủ' });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server đang chạy tại cổng ${PORT}`);
});
