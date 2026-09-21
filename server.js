const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const mongoose = require('mongoose');

const app = express();
const PORT = process.env.PORT || 3000;

// 1. Kết nối Database MongoDB Atlas
const MONGO_URI = process.env.MONGO_URI;

if (!MONGO_URI) {
    console.error('❌ CHƯA CÀI ĐẶT BIẾN MONGO_URI TRÊN RENDER!');
} else {
    mongoose.connect(MONGO_URI)
        .then(() => console.log('✅ Đã kết nối MongoDB Atlas v2.0 thành công!'))
        .catch(err => console.error('❌ Lỗi kết nối MongoDB:', err));
}

// 2. Mongoose Schema & Model
const postSchema = new mongoose.Schema({
    content: String,
    mediaUrl: String,
    mediaType: String,
    likes: { type: Number, default: 0 },
    dislikes: { type: Number, default: 0 },
    createdAt: { type: Date, default: Date.now }
});
const Post = mongoose.model('Post', postSchema);

// 3. Cấu hình Multer Uploads (Hỗ trợ file lên tới 100MB)
const uploadDir = path.join(__dirname, 'public', 'uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadDir),
    filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname)
});

const upload = multer({ 
    storage: storage,
    limits: { fileSize: 100 * 1024 * 1024 } // 100MB
});

// 4. Middlewares
app.use(express.static('public'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 5. Routes API
// Lấy danh sách bài viết
app.get('/posts', async (req, res) => {
    try {
        const posts = await Post.find().sort({ createdAt: -1 });
        res.json(posts);
    } catch (err) {
        res.status(500).json({ error: 'Không thể kết nối CSDL để lấy danh sách bài viết.' });
    }
});

// Đăng bài mới (Tự động phân loại Text, Ảnh, Video, File)
app.post('/post', (req, res) => {
    upload.single('media')(req, res, async (err) => {
        if (err) {
            if (err.code === 'LIMIT_FILE_SIZE') {
                return res.status(400).json({ error: 'Tệp tin vượt quá giới hạn 100MB!' });
            }
            return res.status(500).json({ error: 'Lỗi tải tệp tin lên máy chủ.' });
        }

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

            if (!content && !mediaUrl) {
                return res.status(400).json({ error: 'Vui lòng nhập nội dung hoặc chọn tệp tin!' });
            }

            if (mongoose.connection.readyState !== 1) {
                return res.status(500).json({ error: 'Chưa kết nối CSDL! Hãy kiểm tra lại MONGO_URI trên Render.' });
            }

            const newPost = new Post({ content, mediaUrl, mediaType });
            await newPost.save();
            
            res.json({ success: true, post: newPost });
        } catch (dbErr) {
            console.error('Lỗi khi lưu bài viết:', dbErr);
            res.status(500).json({ error: 'Lỗi lưu dữ liệu vào CSDL MongoDB Atlas!' });
        }
    });
});

// Xóa bài viết
app.delete('/posts/:id', async (req, res) => {
    try {
        await Post.findByIdAndDelete(req.params.id);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: 'Không thể xóa bài viết này.' });
    }
});

// Nút Like
app.post('/posts/:id/like', async (req, res) => {
    try {
        const post = await Post.findByIdAndUpdate(req.params.id, { $inc: { likes: 1 } }, { new: true });
        res.json({ likes: post.likes, dislikes: post.dislikes });
    } catch (err) {
        res.status(500).json({ error: 'Lỗi khi cập nhật lượt Like.' });
    }
});

// Nút Dislike
app.post('/posts/:id/dislike', async (req, res) => {
    try {
        const post = await Post.findByIdAndUpdate(req.params.id, { $inc: { dislikes: 1 } }, { new: true });
        res.json({ likes: post.likes, dislikes: post.dislikes });
    } catch (err) {
        res.status(500).json({ error: 'Lỗi khi cập nhật lượt Dislike.' });
    }
});

// 6. Khởi chạy Server
app.listen(PORT, () => {
    console.log(`🚀 Máy chủ v2.0 đang chạy tại port: ${PORT}`);
});
