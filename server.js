const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '25mb' }));
app.use(express.urlencoded({ limit: '25mb', extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Kết nối MongoDB qua biến môi trường MONGODB_URI
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/chiasetailieu';

mongoose.connect(MONGODB_URI)
    .then(() => console.log('✅ Đã kết nối thành công MongoDB Atlas'))
    .catch(err => console.error('❌ Lỗi kết nối MongoDB:', err.message));

// Schema Bình luận
const commentSchema = new mongoose.Schema({
    author: { type: String, default: 'Ẩn danh' },
    content: { type: String, required: true },
    parentId: { type: String, default: null },
    likes: { type: Number, default: 0 },
    dislikes: { type: Number, default: 0 },
    authorToken: { type: String },
    createdAt: { type: Date, default: Date.now }
});

// Schema Bài viết
const postSchema = new mongoose.Schema({
    author: { type: String, default: 'Ẩn danh' },
    content: { type: String, default: '' },
    mediaUrl: { type: String, default: '' },
    mediaName: { type: String, default: '' },
    likes: { type: Number, default: 0 },
    dislikes: { type: Number, default: 0 },
    authorToken: { type: String },
    isAdmin: { type: Boolean, default: false },
    comments: [commentSchema],
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
});

const Post = mongoose.model('Post', postSchema);

// 1. Lấy danh sách bài viết
app.get('/api/posts', async (req, res) => {
    try {
        const posts = await Post.find({}, '-mediaUrl').sort({ createdAt: -1 }).lean();
        res.json(posts);
    } catch (err) {
        console.error('Lỗi lấy bài viết:', err);
        res.status(500).json({ error: 'Không thể tải danh sách bài viết' });
    }
});

// 2. Lấy tệp đính kèm
app.get('/api/posts/:id/media', async (req, res) => {
    try {
        const post = await Post.findById(req.params.id, 'mediaUrl mediaName');
        if (!post) return res.status(404).json({ error: 'Không tìm thấy bài viết' });
        res.json({ mediaUrl: post.mediaUrl, mediaName: post.mediaName });
    } catch (err) {
        res.status(500).json({ error: 'Lỗi tải tệp' });
    }
});

// 3. Đăng bài mới
app.post('/api/posts', async (req, res) => {
    try {
        const { author, content, mediaUrl, mediaName, authorToken } = req.body;
        const authorName = (author || '').trim();
        const isAdmin = (authorName.toUpperCase() === 'TNT MEMEFORG STUDIO');

        const newPost = new Post({
            author: authorName || 'Ẩn danh',
            content,
            mediaUrl,
            mediaName,
            authorToken,
            isAdmin
        });

        await newPost.save();
        res.status(201).json(newPost);
    } catch (err) {
        res.status(500).json({ error: 'Lỗi đăng bài' });
    }
});

// 4. Bình chọn Like / Dislike bài viết
app.post('/api/posts/:id/vote', async (req, res) => {
    try {
        const { type, action } = req.body;
        const update = {};
        const amount = action === 'add' ? 1 : -1;

        if (type === 'like') update.$inc = { likes: amount };
        if (type === 'dislike') update.$inc = { dislikes: amount };
        update.updatedAt = new Date();

        const post = await Post.findByIdAndUpdate(req.params.id, update, { new: true });
        res.json(post);
    } catch (err) {
        res.status(500).json({ error: 'Lỗi bình chọn' });
    }
});

// 5. Thêm Bình luận
app.post('/api/posts/:id/comments', async (req, res) => {
    try {
        const { author, content, parentId, authorToken } = req.body;
        if (!content || !content.trim()) {
            return res.status(400).json({ error: 'Nội dung không được để trống' });
        }

        const post = await Post.findById(req.params.id);
        if (!post) return res.status(404).json({ error: 'Không tìm thấy bài viết' });

        post.comments.push({
            author: (author || '').trim() || 'Ẩn danh',
            content: content.trim(),
            parentId: parentId || null,
            authorToken
        });

        post.updatedAt = new Date();
        await post.save();
        res.status(201).json(post.comments);
    } catch (err) {
        res.status(500).json({ error: 'Lỗi thêm bình luận' });
    }
});

// 6. Bình chọn Like / Dislike Bình luận
app.post('/api/posts/:postId/comments/:commentId/vote', async (req, res) => {
    try {
        const { type, action } = req.body;
        const post = await Post.findById(req.params.postId);
        if (!post) return res.status(404).json({ error: 'Không tìm thấy bài viết' });

        const comment = post.comments.id(req.params.commentId);
        if (!comment) return res.status(404).json({ error: 'Không tìm thấy bình luận' });

        const amount = action === 'add' ? 1 : -1;
        if (type === 'like') comment.likes = Math.max(0, (comment.likes || 0) + amount);
        if (type === 'dislike') comment.dislikes = Math.max(0, (comment.dislikes || 0) + amount);

        post.updatedAt = new Date();
        await post.save();
        res.json(comment);
    } catch (err) {
        res.status(500).json({ error: 'Lỗi bình chọn' });
    }
});

// 7. Xóa bài viết
app.delete('/api/posts/:id', async (req, res) => {
    try {
        const authorToken = req.headers['x-author-token'];
        const post = await Post.findById(req.params.id);

        if (!post) return res.status(404).json({ error: 'Không tìm thấy bài viết' });
        if (post.authorToken !== authorToken) {
            return res.status(403).json({ error: 'Không có quyền xóa' });
        }

        await Post.findByIdAndDelete(req.params.id);
        res.json({ message: 'Xóa bài viết thành công' });
    } catch (err) {
        res.status(500).json({ error: 'Lỗi xóa bài viết' });
    }
});

app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
    console.log(`🚀 Server đang chạy tại cổng ${PORT}`);
});
