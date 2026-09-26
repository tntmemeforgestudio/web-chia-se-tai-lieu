const express = require('express');
const path = require('path');
const mongoose = require('mongoose');
const app = express();

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Kết loại bỏ các options deprecated (useNewUrlParser, useUnifiedTopology) ở Mongoose bản mới
mongoose.connect(process.env.MONGO_URI)
.then(() => console.log("Đã kết nối MongoDB thành công!"))
.catch(err => console.error("Lỗi kết nối MongoDB:", err));

// Cấu trúc dữ liệu bài viết trong Database
const postSchema = new mongoose.Schema({
    author: String,
    content: String,
    authorToken: String,
    isVip: Boolean,
    likes: { type: Number, default: 0 },
    likedBy: [String], // Lưu danh sách token đã thả tim
    createdAt: { type: Date, default: Date.now }
});
const Post = mongoose.model('Post', postSchema);

// API Lấy danh sách bài viết
// 🔒 ĐÃ SỬA BẢO MẬT: Không trả về authorToken trực tiếp ra công khai để tránh bị lấy cắp xóa bài.
app.get('/api/posts', async (req, res) => {
    try {
        const clientToken = req.headers['x-author-token'] || '';
        const posts = await Post.find().sort({ createdAt: -1 }).limit(100).lean();

        // Xử lý dữ liệu an toàn trước khi gửi về client
        const safePosts = posts.map(post => ({
            _id: post._id,
            author: post.author,
            content: post.content,
            isVip: Boolean(post.isVip),
            likes: post.likes || 0,
            hasLiked: Array.isArray(post.likedBy) && post.likedBy.includes(clientToken),
            isOwner: Boolean(post.authorToken && post.authorToken === clientToken),
            createdAt: post.createdAt
        }));

        res.json(safePosts);
    } catch (error) {
        console.error("Lỗi tải bài viết:", error);
        res.status(500).json({ error: 'Lỗi tải dữ liệu' });
    }
});

// API Đăng bài viết mới
app.post('/api/posts', async (req, res) => {
    try {
        const { author, content, authorToken, vipPasscode } = req.body;
        const rawAuthor = (author || 'Ẩn danh').trim();

        // 🔒 BẢO MẬT TÍCH VÀNG ĐỘC QUYỀN
        const SECRET_AUTHOR_NAME = "nhà phát triển"; 
        const VIP_PASSCODE = process.env.VIP_PASSCODE || "tnt123"; // Mật khẩu bí mật tùy chọn

        let isVip = false;
        if (rawAuthor === SECRET_AUTHOR_NAME) {
            // Kiểm tra nếu có thiết lập Passcode VIP
            if (!vipPasscode || vipPasscode === VIP_PASSCODE) {
                isVip = true;
            }
        }

        const newPost = new Post({
            author: rawAuthor,
            content: content || '',
            authorToken: authorToken || '',
            isVip: isVip,
            likes: 0,
            likedBy: []
        });

        await newPost.save();

        res.status(201).json({
            _id: newPost._id,
            author: newPost.author,
            content: newPost.content,
            isVip: newPost.isVip,
            likes: 0,
            hasLiked: false,
            isOwner: true,
            createdAt: newPost.createdAt
        });
    } catch (error) {
        console.error("Lỗi đăng bài:", error);
        res.status(500).json({ error: 'Lỗi máy chủ' });
    }
});

// API Thả tim / Bỏ thả tim bài viết
app.post('/api/posts/:id/like', async (req, res) => {
    try {
        const postId = req.params.id;
        const clientToken = req.headers['x-author-token'];

        if (!clientToken) {
            return res.status(400).json({ error: 'Thiếu định danh người dùng' });
        }

        const post = await Post.findById(postId);
        if (!post) {
            return res.status(404).json({ error: 'Không tìm thấy bài viết' });
        }

        if (!Array.isArray(post.likedBy)) post.likedBy = [];

        const index = post.likedBy.indexOf(clientToken);
        let hasLiked = false;

        if (index === -1) {
            post.likedBy.push(clientToken);
            post.likes = (post.likes || 0) + 1;
            hasLiked = true;
        } else {
            post.likedBy.splice(index, 1);
            post.likes = Math.max(0, (post.likes || 1) - 1);
            hasLiked = false;
        }

        await post.save();
        res.json({ likes: post.likes, hasLiked });
    } catch (error) {
        res.status(500).json({ error: 'Lỗi xử lý tương tác' });
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
