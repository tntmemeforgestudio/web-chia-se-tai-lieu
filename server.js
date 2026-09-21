const express = require('express');
const multer = require('multer');
const path = path = require('path');
const fs = require('fs');
const mongoose = require('mongoose');

const app = express();
const PORT = process.env.PORT || 3000;

// Kết nối MongoDB Atlas
mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log('Đã kết nối Database MongoDB v2.0 thành công!'))
    .catch(err => console.log('Lỗi kết nối Database:', err));

// Schema bài đăng v2.0
const postSchema = new mongoose.Schema({
    content: String,
    mediaUrl: String,
    mediaType: String, // 'image', 'video', 'file'
    likes: { type: Number, default: 0 },
    dislikes: { type: Number, default: 0 },
    createdAt: { type: Date, default: Date.now } // UTC chuẩn quốc tế
});
const Post = mongoose.model('Post', postSchema);

const uploadDir = path.join(__dirname, 'public', 'uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadDir),
    filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname)
});

// Giới hạn file 50MB
const upload = multer({ 
    storage: storage,
    limits: { fileSize: 50 * 1024 * 1024 }
});

app.use(express.static('public'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Lấy danh sách bài đăng
app.get('/posts', async (req, res) => {
    try {
        const posts = await Post.find().sort({ createdAt: -1 });
        res.json(posts);
    } catch (err) {
        res.status(500).json({ error: 'Lỗi lấy dữ liệu' });
    }
});

// Đăng bài mới (Bất đồng bộ - AJAX)
app.post('/post', upload.single('media'), async (req, res) => {
    try {
        const { content } = req.body;
        let mediaUrl = null;
        let mediaType = null;

        if (req.file) {
            mediaUrl = `/uploads/${req.file.filename}`;
            const mime = req.file.mimetype;
            if (mime.startsWith('image/')) mediaType = 'image';
            else if (mime.startsWith('video/')) mediaType = 'video';
            else mediaType = 'file';
        }

        const newPost = new Post({ content, mediaUrl, mediaType });
        await newPost.save();
        
        res.json({ success: true, post: newPost });
    } catch (err) {
        res.status(500).json({ error: 'Lỗi khi lưu bài đăng (File có thể quá 50MB)' });
    }
});

// Xóa bài đăng
app.delete('/posts/:id', async (req, res) => {
    try {
        await Post.findByIdAndDelete(req.params.id);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: 'Không thể xóa bài đăng' });
    }
});

// Nút Like
app.post('/posts/:id/like', async (req, res) => {
    try {
        const post = await Post.findByIdAndUpdate(req.params.id, { $inc: { likes: 1 } }, { new: true });
        res.json({ likes: post.likes, dislikes: post.dislikes });
    } catch (err) {
        res.status(500).json({ error: 'Lỗi toggle like' });
    }
});

// Nút Dislike
app.post('/posts/:id/dislike', async (req, res) => {
    try {
        const post = await Post.findByIdAndUpdate(req.params.id, { $inc: { dislikes: 1 } }, { new: true });
        res.json({ likes: post.likes, dislikes: post.dislikes });
    } catch (err) {
        res.status(500).json({ error: 'Lỗi toggle dislike' });
    }
});

app.listen(PORT, () => {
    console.log(`Web v2.0 đang chạy tại port: ${PORT}`);
});
