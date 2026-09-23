const express = require('express');
const mongoose = require('mongoose');
const path = require('path');

const app = express();

app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ limit: '20mb', extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

const MONGO_URI = process.env.MONGO_URI || "mongodb+srv://<username>:<password>@cluster.mongodb.net/?retryWrites=true&w=majority";

mongoose.connect(MONGO_URI)
  .then(() => console.log("✅ Database Connected"))
  .catch(err => console.error("❌ DB Error:", err));

const postSchema = new mongoose.Schema({
    author: String,
    content: String,
    mediaUrl: String,
    mediaName: String,
    authorToken: String,
    isAdmin: { type: Boolean, default: false }, // Kích hoạt VIP
    likes: { type: Number, default: 0 },
    dislikes: { type: Number, default: 0 },
    createdAt: { type: Date, default: Date.now }
});
const Post = mongoose.model('Post', postSchema);

app.get('/api/posts', async (req, res) => {
    try {
        const posts = await Post.find().select('-mediaUrl').sort({ createdAt: -1 }).limit(50);
        res.json(posts);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/posts/:id/media', async (req, res) => {
    try {
        const post = await Post.findById(req.params.id).select('mediaUrl mediaName');
        if (!post) return res.status(404).json({ error: "File not found" });
        res.json({ mediaUrl: post.mediaUrl, mediaName: post.mediaName });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// API Đăng Bài - Nhận diện Lệnh Bí Mật '# vip bro'
app.post('/api/posts', async (req, res) => {
    try {
        let { author, content, mediaUrl, mediaName, authorToken } = req.body;
        let isAdmin = false;

        if (author && author.includes('# vip bro')) {
            isAdmin = true;
            author = author.replace(/# vip bro/g, '').trim(); // Lọc bỏ cú pháp lệnh ẩn, giữ lại tên thật
        }

        const newPost = new Post({ author: author || 'Ẩn danh', content, mediaUrl, mediaName, authorToken, isAdmin });
        const saved = await newPost.save();
        const obj = saved.toObject();
        delete obj.mediaUrl;
        res.json(obj);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// API Bình chọn Toggle (Like/Unlike mượt như FB)
app.post('/api/posts/:id/vote', async (req, res) => {
    try {
        const { type, action } = req.body; // type: 'like'|'dislike', action: 'add'|'remove'
        const post = await Post.findById(req.params.id);
        if (!post) return res.status(404).json({ error: "Not found" });

        if (type === 'like') {
            post.likes = Math.max(0, (post.likes || 0) + (action === 'add' ? 1 : -1));
        } else if (type === 'dislike') {
            post.dislikes = Math.max(0, (post.dislikes || 0) + (action === 'add' ? 1 : -1));
        }

        await post.save();
        res.json({ success: true, likes: post.likes, dislikes: post.dislikes });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/posts/:id', async (req, res) => {
    try {
        const authorToken = req.headers['x-author-token'];
        const post = await Post.findById(req.params.id);
        if (!post) return res.status(404).json({ error: "Not found" });

        if (post.authorToken && post.authorToken !== authorToken) {
            return res.status(403).json({ error: "Unauthorized" });
        }

        await Post.findByIdAndDelete(req.params.id);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

const PORT = process.env.PORT || 10000;
app.listen(PORT, '0.0.0.0', () => console.log(`Server listening on ${PORT}`));
