const express = require('express');
const path = require('path');
const mongoose = require('mongoose');
const os = require('os');
const app = express();

app.use(express.json({ limit: '25mb' }));
app.use(express.urlencoded({ limit: '25mb', extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Kết nối MongoDB Cloud
mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/sharedb')
.then(() => console.log("Đã kết nối MongoDB thành công!"))
.catch(err => console.error("Lỗi kết nối MongoDB:", err));

// Schema Bình luận (Hỗ trợ phản hồi thụt lề & Like/Dislike)
const commentSchema = new mongoose.Schema({
    author: String,
    content: String,
    authorToken: String,
    isVip: Boolean,
    parentId: { type: String, default: null }, // Nếu là trả lời bình luận khác
    likes: { type: Number, default: 0 },
    likedBy: [String],
    dislikes: { type: Number, default: 0 },
    dislikedBy: [String],
    createdAt: { type: Date, default: Date.now }
});

// Schema Bài viết
const postSchema = new mongoose.Schema({
    author: String,
    content: String,
    authorToken: String,
    isVip: Boolean,
    fileData: String,
    fileName: String,
    fileSize: String,
    fileType: String,
    likes: { type: Number, default: 0 },
    likedBy: [String],
    dislikes: { type: Number, default: 0 },
    dislikedBy: [String],
    comments: [commentSchema],
    createdAt: { type: Date, default: Date.now }
});

const Post = mongoose.model('Post', postSchema);

// Tác giả chính chủ có Tích Vàng
const VIP_AUTHORS = ['nhà phát triển', 'tnt memeforge studio'];

// API Giám sát Server (Xanh / Vàng / Đỏ)
app.get('/api/health', (req, res) => {
    try {
        const isDbConnected = mongoose.connection.readyState === 1;
        const freeMem = os.freemem();
        const totalMem = os.totalmem();
        const usedMemPercent = Math.round(((totalMem - freeMem) / totalMem) * 100);

        let status = 'green';
        let message = 'Hoạt động mượt mà';

        if (!isDbConnected) {
            status = 'red';
            message = 'Nguy cấp: Mất kết nối CSDL';
        } else if (usedMemPercent > 85) {
            status = 'red';
            message = 'Nguy cấp: Bộ nhớ RAM quá tải (' + usedMemPercent + '%)';
        } else if (usedMemPercent > 70) {
            status = 'yellow';
            message = 'Cảnh báo: Bộ nhớ RAM cao (' + usedMemPercent + '%)';
        }

        res.json({ status, message, ramUsage: usedMemPercent + '%' });
    } catch (err) {
        res.json({ status: 'red', message: 'Lỗi hệ thống' });
    }
});

// API Lấy danh sách bài viết
app.get('/api/posts', async (req, res) => {
    try {
        const clientToken = req.headers['x-author-token'] || '';
        const posts = await Post.find().sort({ createdAt: -1 }).limit(100).lean();

        const safePosts = posts.map(post => {
            const authorLower = (post.author || '').trim().toLowerCase();
            const isVip = Boolean(post.isVip) || VIP_AUTHORS.includes(authorLower);

            return {
                _id: post._id,
                author: post.author,
                content: post.content,
                isVip,
                fileData: post.fileData || null,
                fileName: post.fileName || null,
                fileSize: post.fileSize || null,
                fileType: post.fileType || null,
                likes: post.likes || 0,
                dislikes: post.dislikes || 0,
                commentCount: Array.isArray(post.comments) ? post.comments.length : 0,
                hasLiked: Array.isArray(post.likedBy) && post.likedBy.includes(clientToken),
                hasDisliked: Array.isArray(post.dislikedBy) && post.dislikedBy.includes(clientToken),
                isOwner: Boolean(post.authorToken && post.authorToken === clientToken),
                createdAt: post.createdAt
            };
        });

        res.json(safePosts);
    } catch (error) {
        res.status(500).json({ error: 'Lỗi tải bài viết' });
    }
});

// API Đăng bài
app.post('/api/posts', async (req, res) => {
    try {
        const { author, content, authorToken, fileData, fileName, fileSize, fileType } = req.body;
        const rawAuthor = (author || 'Ẩn danh').trim();
        const isVip = VIP_AUTHORS.includes(rawAuthor.toLowerCase());

        const newPost = new Post({
            author: rawAuthor,
            content: content || '',
            authorToken: authorToken || '',
            isVip,
            fileData: fileData || '',
            fileName: fileName || '',
            fileSize: fileSize || '',
            fileType: fileType || '',
            likes: 0,
            likedBy: [],
            dislikes: 0,
            dislikedBy: [],
            comments: []
        });

        await newPost.save();
        res.status(201).json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Lỗi máy chủ' });
    }
});

// API Like Bài viết
app.post('/api/posts/:id/like', async (req, res) => {
    try {
        const postId = req.params.id;
        const clientToken = req.headers['x-author-token'];
        const post = await Post.findById(postId);
        if (!post) return res.status(404).json({ error: 'Không tìm thấy bài' });

        if (!Array.isArray(post.likedBy)) post.likedBy = [];
        if (!Array.isArray(post.dislikedBy)) post.dislikedBy = [];

        const likeIdx = post.likedBy.indexOf(clientToken);
        const dislikeIdx = post.dislikedBy.indexOf(clientToken);

        if (dislikeIdx !== -1) {
            post.dislikedBy.splice(dislikeIdx, 1);
            post.dislikes = Math.max(0, (post.dislikes || 1) - 1);
        }

        if (likeIdx === -1) {
            post.likedBy.push(clientToken);
            post.likes = (post.likes || 0) + 1;
        } else {
            post.likedBy.splice(likeIdx, 1);
            post.likes = Math.max(0, (post.likes || 1) - 1);
        }

        await post.save();
        res.json({ likes: post.likes, dislikes: post.dislikes });
    } catch (error) {
        res.status(500).json({ error: 'Lỗi xử lý' });
    }
});

// API Dislike Bài viết
app.post('/api/posts/:id/dislike', async (req, res) => {
    try {
        const postId = req.params.id;
        const clientToken = req.headers['x-author-token'];
        const post = await Post.findById(postId);
        if (!post) return res.status(404).json({ error: 'Không tìm thấy bài' });

        if (!Array.isArray(post.likedBy)) post.likedBy = [];
        if (!Array.isArray(post.dislikedBy)) post.dislikedBy = [];

        const likeIdx = post.likedBy.indexOf(clientToken);
        const dislikeIdx = post.dislikedBy.indexOf(clientToken);

        if (likeIdx !== -1) {
            post.likedBy.splice(likeIdx, 1);
            post.likes = Math.max(0, (post.likes || 1) - 1);
        }

        if (dislikeIdx === -1) {
            post.dislikedBy.push(clientToken);
            post.dislikes = (post.dislikes || 0) + 1;
        } else {
            post.dislikedBy.splice(dislikeIdx, 1);
            post.dislikes = Math.max(0, (post.dislikes || 1) - 1);
        }

        await post.save();
        res.json({ likes: post.likes, dislikes: post.dislikes });
    } catch (error) {
        res.status(500).json({ error: 'Lỗi xử lý' });
    }
});

// API Lấy danh sách bình luận của 1 bài viết
app.get('/api/posts/:id/comments', async (req, res) => {
    try {
        const clientToken = req.headers['x-author-token'] || '';
        const post = await Post.findById(req.params.id).lean();
        if (!post) return res.status(404).json({ error: 'Không tìm thấy bài viết' });

        const comments = (post.comments || []).map(cmt => {
            const authorLower = (cmt.author || '').trim().toLowerCase();
            const isVip = Boolean(cmt.isVip) || VIP_AUTHORS.includes(authorLower);

            return {
                _id: cmt._id,
                author: cmt.author,
                content: cmt.content,
                parentId: cmt.parentId || null,
                isVip,
                likes: cmt.likes || 0,
                dislikes: cmt.dislikes || 0,
                hasLiked: Array.isArray(cmt.likedBy) && cmt.likedBy.includes(clientToken),
                hasDisliked: Array.isArray(cmt.dislikedBy) && cmt.dislikedBy.includes(clientToken),
                createdAt: cmt.createdAt
            };
        });

        res.json({ post, comments });
    } catch (err) {
        res.status(500).json({ error: 'Lỗi tải bình luận' });
    }
});

// API Thêm Bình luận / Trả lời
app.post('/api/posts/:id/comments', async (req, res) => {
    try {
        const { author, content, parentId, authorToken } = req.body;
        if (!content || !content.trim()) return res.status(400).json({ error: 'Nội dung rỗng' });

        const post = await Post.findById(req.params.id);
        if (!post) return res.status(404).json({ error: 'Không tìm thấy bài viết' });

        const rawAuthor = (author || 'Ẩn danh').trim();
        const isVip = VIP_AUTHORS.includes(rawAuthor.toLowerCase());

        post.comments.push({
            author: rawAuthor,
            content: content.trim(),
            authorToken: authorToken || '',
            isVip,
            parentId: parentId || null,
            likes: 0,
            dislikes: 0,
            likedBy: [],
            dislikedBy: []
        });

        await post.save();
        res.status(201).json({ success: true });
    } catch (err) {
        res.status(500).json({ error: 'Lỗi gửi bình luận' });
    }
});

// API Like Bình luận
app.post('/api/posts/:postId/comments/:commentId/like', async (req, res) => {
    try {
        const { postId, commentId } = req.params;
        const clientToken = req.headers['x-author-token'];
        const post = await Post.findById(postId);
        if (!post) return res.status(404).json({ error: 'Không tìm thấy' });

        const cmt = post.comments.id(commentId);
        if (!cmt) return res.status(404).json({ error: 'Không tìm thấy bình luận' });

        if (!Array.isArray(cmt.likedBy)) cmt.likedBy = [];
        if (!Array.isArray(cmt.dislikedBy)) cmt.dislikedBy = [];

        const likeIdx = cmt.likedBy.indexOf(clientToken);
        const dislikeIdx = cmt.dislikedBy.indexOf(clientToken);

        if (dislikeIdx !== -1) {
            cmt.dislikedBy.splice(dislikeIdx, 1);
            cmt.dislikes = Math.max(0, (cmt.dislikes || 1) - 1);
        }

        if (likeIdx === -1) {
            cmt.likedBy.push(clientToken);
            cmt.likes = (cmt.likes || 0) + 1;
        } else {
            cmt.likedBy.splice(likeIdx, 1);
            cmt.likes = Math.max(0, (cmt.likes || 1) - 1);
        }

        await post.save();
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: 'Lỗi xử lý' });
    }
});

// API Dislike Bình luận
app.post('/api/posts/:postId/comments/:commentId/dislike', async (req, res) => {
    try {
        const { postId, commentId } = req.params;
        const clientToken = req.headers['x-author-token'];
        const post = await Post.findById(postId);
        if (!post) return res.status(404).json({ error: 'Không tìm thấy' });

        const cmt = post.comments.id(commentId);
        if (!cmt) return res.status(404).json({ error: 'Không tìm thấy bình luận' });

        if (!Array.isArray(cmt.likedBy)) cmt.likedBy = [];
        if (!Array.isArray(cmt.dislikedBy)) cmt.dislikedBy = [];

        const likeIdx = cmt.likedBy.indexOf(clientToken);
        const dislikeIdx = cmt.dislikedBy.indexOf(clientToken);

        if (likeIdx !== -1) {
            cmt.likedBy.splice(likeIdx, 1);
            cmt.likes = Math.max(0, (cmt.likes || 1) - 1);
        }

        if (dislikeIdx === -1) {
            cmt.dislikedBy.push(clientToken);
            cmt.dislikes = (cmt.dislikes || 0) + 1;
        } else {
            cmt.dislikedBy.splice(dislikeIdx, 1);
            cmt.dislikes = Math.max(0, (cmt.dislikes || 1) - 1);
        }

        await post.save();
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: 'Lỗi xử lý' });
    }
});

// API Xóa bài
app.delete('/api/posts/:id', async (req, res) => {
    try {
        const postId = req.params.id;
        const authorToken = req.headers['x-author-token'];
        const post = await Post.findById(postId);
        if (!post) return res.status(404).json({ error: 'Không tìm thấy' });
        if (post.authorToken && post.authorToken !== authorToken) {
            return res.status(403).json({ error: 'Không có quyền xóa' });
        }
        await Post.findByIdAndDelete(postId);
        res.status(200).json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Lỗi máy chủ' });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server chạy tại cổng ${PORT}`));
