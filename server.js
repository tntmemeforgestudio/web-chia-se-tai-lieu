const express = require('express');
const mongoose = require('mongoose');
const app = express();

app.use(express.json({ limit: '100mb' }));
app.use(express.static('public'));

// Schema bài viết có lưu authorToken
const postSchema = new mongoose.Schema({
    author: String,
    content: String,
    mediaUrl: String,
    mediaName: String,
    likes: { type: Number, default: 0 },
    dislikes: { type: Number, default: 0 },
    isPublisher: { type: Boolean, default: false },
    authorToken: String, // Mã định danh thiết bị tạo bài viết
    createdAt: { type: Date, default: Date.now }
});

const Post = mongoose.model('Post', postSchema);

// API Lấy danh sách bài viết (Ẩn authorToken để người khác không nhìn thấy)
app.get('/api/posts', async (req, res) => {
    try {
        const posts = await Post.find().select('-authorToken').sort({ createdAt: -1 });
        res.json(posts);
    } catch (err) {
        res.status(500).json({ error: 'Lỗi máy chủ' });
    }
});

// API Đăng bài mới
app.post('/api/posts', async (req, res) => {
    try {
        const { author, content, mediaUrl, mediaName, authorToken } = req.body;
        
        // Kiểm tra cú pháp ẩn "👑 Nhà Xuất Bản"
        let isPublisher = false;
        let finalContent = content;
        if (content.includes('::publisher_verify::')) {
            isPublisher = true;
            finalContent = content.replace(/::publisher_verify::/g, '').trim();
        }

        const newPost = new Post({
            author,
            content: finalContent,
            mediaUrl,
            mediaName,
            isPublisher,
            authorToken // Lưu khóa bí mật thiết bị
        });

        await newPost.save();
        
        // Trả về dữ liệu bài viết (không kèm authorToken)
        const postResponse = newPost.toObject();
        delete postResponse.authorToken;
        res.status(201).json(postResponse);
    } catch (err) {
        res.status(500).json({ error: 'Không thể đăng bài' });
    }
});

// API Xóa bài viết - Kiểm tra quyền chính chủ ở Server
app.delete('/api/posts/:id', async (req, res) => {
    try {
        const postId = req.params.id;
        const clientToken = req.headers['x-author-token']; // Nhận token từ client gửi lên

        const post = await Post.findById(postId);
        if (!post) {
            return res.status(404).json({ error: 'Bài viết không tồn tại' });
        }

        // BẮT BỤC: Token phải trùng khớp mới cho xóa
        if (!post.authorToken || post.authorToken !== clientToken) {
            return res.status(403).json({ error: 'Bạn không có quyền xóa bài viết này!' });
        }

        await Post.findByIdAndDelete(postId);
        res.json({ success: true, message: 'Đã xóa bài viết thành công' });
    } catch (err) {
        res.status(500).json({ error: 'Lỗi hệ thống khi xóa bài' });
    }
});

// API Like & Dislike
app.post('/api/posts/:id/like', async (req, res) => {
    await Post.findByIdAndUpdate(req.params.id, { $inc: { likes: 1 } });
    res.json({ success: true });
});

app.post('/api/posts/:id/dislike', async (req, res) => {
    await Post.findByIdAndUpdate(req.params.id, { $inc: { dislikes: 1 } });
    res.json({ success: true });
});

app.listen(3000, () => console.log('Server running on port 3000'));
