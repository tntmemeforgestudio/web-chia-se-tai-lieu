const express = require('express');
const cors = require('cors');
const path = require('path');
const mongoose = require('mongoose');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// 🟢 KẾT NỐI MONDODB ATLAS THÔNG QUA BIẾN MÔI TRƯỜNG MONGO_URI TRÊN RENDER
const mongoUri = process.env.MONGO_URI;

if (!mongoUri) {
    console.error("LỖI NGHIÊM TRỌNG: Chưa cấu hình MONGO_URI trong Environment của Render!");
} else {
    mongoose.connect(mongoUri)
        .then(() => console.log("Kết nối MongoDB Atlas thành công! Dữ liệu được lưu vĩnh viễn."))
        .catch(err => console.error("Lỗi kết nối MongoDB Atlas:", err));
}

// Định nghĩa Schema Bài viết & Bình luận
const commentSchema = new mongoose.Schema({
    author: String,
    content: String,
    authorToken: String,
    likes: { type: Number, default: 0 },
    dislikes: { type: Number, default: 0 },
    createdAt: { type: Date, default: Date.now }
});

const postSchema = new mongoose.Schema({
    author: { type: String, default: 'Ẩn danh' },
    content: { type: String, default: '' },
    mediaUrl: { type: String, default: '' },
    mediaName: { type: String, default: '' },
    authorToken: { type: String, default: '' },
    likes: { type: Number, default: 0 },
    dislikes: { type: Number, default: 0 },
    comments: [commentSchema],
    createdAt: { type: Date, default: Date.now }
});

const Post = mongoose.model('Post', postSchema);

// API: Lấy danh sách bài viết (Mới nhất lên đầu)
app.get('/api/posts', async (req, res) => {
    try {
        const posts = await Post.find().sort({ createdAt: -1 });
        res.json(posts);
    } catch (err) {
        res.status(500).json({ error: 'Lỗi máy chủ khi lấy bài viết' });
    }
});

// API: Tạo bài viết mới
app.post('/api/posts', async (req, res) => {
    try {
        const { author, content, mediaUrl, mediaName, authorToken } = req.body;
        
        const newPost = new Post({
            author: author || 'Ẩn danh',
            content: content || '',
            mediaUrl: mediaUrl || '',
            mediaName: mediaName || '',
            authorToken: authorToken || ''
        });

        const savedPost = await newPost.save();
        res.status(201).json(savedPost);
    } catch (err) {
        res.status(500).json({ error: 'Lỗi máy chủ khi tạo bài viết' });
    }
});

// API: Xóa bài viết
app.delete('/api/posts/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const authorToken = req.headers['x-author-token'];

        const post = await Post.findById(id);
        if (!post) return res.status(404).json({ error: 'Không tìm thấy bài viết' });

        if (post.authorToken !== authorToken) {
            return res.status(403).json({ error: 'Bạn không có quyền xóa bài viết này' });
        }

        await Post.findByIdAndDelete(id);
        res.json({ message: 'Đã xóa bài viết thành công' });
    } catch (err) {
        res.status(500).json({ error: 'Lỗi máy chủ khi xóa bài viết' });
    }
});

// API: Vote Bài Viết (Like / Dislike)
app.post('/api/posts/:id/vote', async (req, res) => {
    try {
        const { id } = req.params;
        const { type, action } = req.body;

        const post = await Post.findById(id);
        if (!post) return res.status(404).json({ error: 'Không tìm thấy bài viết' });

        if (type === 'like') {
            if (action === 'add') post.likes += 1;
            else if (action === 'remove') post.likes = Math.max(0, post.likes - 1);
        } else if (type === 'dislike') {
            if (action === 'add') post.dislikes += 1;
            else if (action === 'remove') post.dislikes = Math.max(0, post.dislikes - 1);
        }

        await post.save();
        res.json(post);
    } catch (err) {
        res.status(500).json({ error: 'Lỗi vote bài viết' });
    }
});

// API: Thêm bình luận
app.post('/api/posts/:id/comments', async (req, res) => {
    try {
        const { id } = req.params;
        const { author, content, authorToken } = req.body;

        const post = await Post.findById(id);
        if (!post) return res.status(404).json({ error: 'Không tìm thấy bài viết' });

        const newComment = {
            author: author || 'Ẩn danh',
            content: content,
            authorToken: authorToken,
            likes: 0,
            dislikes: 0
        };

        post.comments.push(newComment);
        await post.save();
        res.status(201).json(post.comments[post.comments.length - 1]);
    } catch (err) {
        res.status(500).json({ error: 'Lỗi thêm bình luận' });
    }
});

// API: Xóa bình luận
app.delete('/api/posts/:postId/comments/:commentId', async (req, res) => {
    try {
        const { postId, commentId } = req.params;
        const authorToken = req.headers['x-author-token'];

        const post = await Post.findById(postId);
        if (!post) return res.status(404).json({ error: 'Không tìm thấy bài viết' });

        const comment = post.comments.id(commentId);
        if (!comment) return res.status(404).json({ error: 'Không tìm thấy bình luận' });

        if (comment.authorToken !== authorToken) {
            return res.status(403).json({ error: 'Bạn không có quyền xóa bình luận này' });
        }

        comment.deleteOne();
        await post.save();
        res.json({ message: 'Đã xóa bình luận' });
    } catch (err) {
        res.status(500).json({ error: 'Lỗi xóa bình luận' });
    }
});

// API: Vote Bình Luận
app.post('/api/posts/:postId/comments/:commentId/vote', async (req, res) => {
    try {
        const { postId, commentId } = req.params;
        const { type, action } = req.body;

        const post = await Post.findById(postId);
        if (!post) return res.status(404).json({ error: 'Không tìm thấy bài viết' });

        const comment = post.comments.id(commentId);
        if (!comment) return res.status(404).json({ error: 'Không tìm thấy bình luận' });

        if (type === 'like') {
            if (action === 'add') comment.likes += 1;
            else if (action === 'remove') comment.likes = Math.max(0, comment.likes - 1);
        } else if (type === 'dislike') {
            if (action === 'add') comment.dislikes += 1;
            else if (action === 'remove') comment.dislikes = Math.max(0, comment.dislikes - 1);
        }

        await post.save();
        res.json(comment);
    } catch (err) {
        res.status(500).json({ error: 'Lỗi vote bình luận' });
    }
});

// API: Tải Media
app.get('/api/posts/:id/media', async (req, res) => {
    try {
        const post = await Post.findById(req.params.id);
        if (!post || !post.mediaUrl) return res.status(404).json({ error: 'Không có file' });
        res.json({ mediaUrl: post.mediaUrl, mediaName: post.mediaName });
    } catch (err) {
        res.status(500).json({ error: 'Lỗi tải media' });
    }
});

app.listen(PORT, () => {
    console.log(`Server v2.3.0 running on http://localhost:${PORT}`);
});
