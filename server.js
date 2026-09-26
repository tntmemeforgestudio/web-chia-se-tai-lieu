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

// Schema bài viết hỗ trợ Like & Dislike
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
    createdAt: { type: Date, default: Date.now }
});
const Post = mongoose.model('Post', postSchema);

// Danh sách tác giả VIP mặc định có Tích Vàng
const VIP_AUTHORS = ['nhà phát triển', 'tnt memeforge studio'];

// API Giám sát Server Thông minh (Xanh / Vàng / Đỏ)
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
        res.json({ status: 'red', message: 'Nguy cấp: Lỗi hệ thống' });
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
                isVip: isVip,
                fileData: post.fileData || null,
                fileName: post.fileName || null,
                fileSize: post.fileSize || null,
                fileType: post.fileType || null,
                likes: post.likes || 0,
                dislikes: post.dislikes || 0,
                hasLiked: Array.isArray(post.likedBy) && post.likedBy.includes(clientToken),
                hasDisliked: Array.isArray(post.dislikedBy) && post.dislikedBy.includes(clientToken),
                isOwner: Boolean(post.authorToken && post.authorToken === clientToken),
                createdAt: post.createdAt
            };
        });

        res.json(safePosts);
    } catch (error) {
        res.status(500).json({ error: 'Lỗi tải dữ liệu' });
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
            dislikedBy: []
        });

        await newPost.save();
        res.status(201).json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Lỗi máy chủ' });
    }
});

// API Thích (Like)
app.post('/api/posts/:id/like', async (req, res) => {
    try {
        const postId = req.params.id;
        const clientToken = req.headers['x-author-token'];
        if (!clientToken) return res.status(400).json({ error: 'Thiếu định danh' });

        const post = await Post.findById(postId);
        if (!post) return res.status(404).json({ error: 'Không tìm thấy bài' });

        if (!Array.isArray(post.likedBy)) post.likedBy = [];
        if (!Array.isArray(post.dislikedBy)) post.dislikedBy = [];

        const likeIdx = post.likedBy.indexOf(clientToken);
        const dislikeIdx = post.dislikedBy.indexOf(clientToken);

        // Hủy Dislike nếu đang Dislike
        if (dislikeIdx !== -1) {
            post.dislikedBy.splice(dislikeIdx, 1);
            post.dislikes = Math.max(0, (post.dislikes || 1) - 1);
        }

        let hasLiked = false;
        if (likeIdx === -1) {
            post.likedBy.push(clientToken);
            post.likes = (post.likes || 0) + 1;
            hasLiked = true;
        } else {
            post.likedBy.splice(likeIdx, 1);
            post.likes = Math.max(0, (post.likes || 1) - 1);
            hasLiked = false;
        }

        await post.save();
        res.json({ likes: post.likes, dislikes: post.dislikes, hasLiked, hasDisliked: false });
    } catch (error) {
        res.status(500).json({ error: 'Lỗi xử lý' });
    }
});

// API Không thích (Dislike)
app.post('/api/posts/:id/dislike', async (req, res) => {
    try {
        const postId = req.params.id;
        const clientToken = req.headers['x-author-token'];
        if (!clientToken) return res.status(400).json({ error: 'Thiếu định danh' });

        const post = await Post.findById(postId);
        if (!post) return res.status(404).json({ error: 'Không tìm thấy bài' });

        if (!Array.isArray(post.likedBy)) post.likedBy = [];
        if (!Array.isArray(post.dislikedBy)) post.dislikedBy = [];

        const likeIdx = post.likedBy.indexOf(clientToken);
        const dislikeIdx = post.dislikedBy.indexOf(clientToken);

        // Hủy Like nếu đang Like
        if (likeIdx !== -1) {
            post.likedBy.splice(likeIdx, 1);
            post.likes = Math.max(0, (post.likes || 1) - 1);
        }

        let hasDisliked = false;
        if (dislikeIdx === -1) {
            post.dislikedBy.push(clientToken);
            post.dislikes = (post.dislikes || 0) + 1;
            hasDisliked = true;
        } else {
            post.dislikedBy.splice(dislikeIdx, 1);
            post.dislikes = Math.max(0, (post.dislikes || 1) - 1);
            hasDisliked = false;
        }

        await post.save();
        res.json({ likes: post.likes, dislikes: post.dislikes, hasLiked: false, hasDisliked });
    } catch (error) {
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
