const express = require('express');
const mongoose = require('mongoose');
const multer = require('multer');
const path = require('path');
const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');

const app = express();
const PORT = process.env.PORT || 3000;

// 1. Kết nối MongoDB Atlas
const MONGO_URI = process.env.MONGO_URI;

if (!MONGO_URI) {
    console.error('❌ CHƯA CÀI ĐẶT BIẾN MONGO_URI TRÊN RENDER!');
} else {
    mongoose.connect(MONGO_URI)
        .then(() => console.log('✅ Đã kết nối MongoDB Atlas v2.0 thành công!'))
        .catch(err => console.error('❌ Lỗi kết nối MongoDB:', err));
}

// 2. Cấu hình Cloudinary từ biến môi trường Render
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

// 3. Tự động lưu Ảnh/Video trực tiếp lên Đám mây Cloudinary
const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'web_uploads',
    resource_type: 'auto',
  },
});

const upload = multer({ 
  storage: storage,
  limits: { fileSize: 100 * 1024 * 1024 } // 100MB
});

// 4. Schema bài viết
const postSchema = new mongoose.Schema({
    content: String,
    mediaUrl: String,
    mediaType: String,
    likes: { type: Number, default: 0 },
    dislikes: { type: Number, default: 0 },
    createdAt: { type: Date, default: Date.now }
});
const Post = mongoose.model('Post', postSchema);

// Middlewares
app.use(express.static('public'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 5. API Lấy bài viết
app.get('/posts', async (req, res) => {
    try {
        const posts = await Post.find().sort({ createdAt: -1 });
        res.json(posts);
    } catch (err) {
        res.status(500).json({ error: 'Lỗi lấy bài viết' });
    }
});

// 6. API Đăng bài (Lưu media lên Cloudinary, lưu URL vào MongoDB)
app.post('/post', (req, res) => {
    upload.single('media')(req, res, async (err) => {
        if (err) {
            return res.status(400).json({ error: 'Lỗi tải tệp tin lên Cloudinary!' });
        }

        try {
            const { content } = req.body;
            let mediaUrl = null;
            let mediaType = null;

            if (req.file) {
                mediaUrl = req.file.path; // Link xem trực tiếp từ Cloudinary
                const mime = req.file.mimetype;
                if (mime && mime.startsWith('image/')) mediaType = 'image';
                else if (mime && mime.startsWith('video/')) mediaType = 'video';
                else mediaType = 'file';
            }

            if (!content && !mediaUrl) {
                return res.status(400).json({ error: 'Vui lòng nhập nội dung hoặc chọn tệp!' });
            }

            const newPost = new Post({ content, mediaUrl, mediaType });
            await newPost.save();
            
            res.json({ success: true, post: newPost });
        } catch (dbErr) {
            console.error('Lỗi lưu CSDL:', dbErr);
            res.status(500).json({ error: 'Lỗi lưu CSDL!' });
        }
    });
});

// 7. API Xóa bài viết
app.delete('/posts/:id', async (req, res) => {
    try {
        await Post.findByIdAndDelete(req.params.id);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: 'Không thể xóa bài viết.' });
    }
});

// 8. API Like & Dislike
app.post('/posts/:id/like', async (req, res) => {
    try {
        const post = await Post.findByIdAndUpdate(req.params.id, { $inc: { likes: 1 } }, { new: true });
        res.json({ likes: post.likes, dislikes: post.dislikes });
    } catch (err) {
        res.status(500).json({ error: 'Lỗi Like' });
    }
});

app.post('/posts/:id/dislike', async (req, res) => {
    try {
        const post = await Post.findByIdAndUpdate(req.params.id, { $inc: { dislikes: 1 } }, { new: true });
        res.json({ likes: post.likes, dislikes: post.dislikes });
    } catch (err) {
        res.status(500).json({ error: 'Lỗi Dislike' });
    }
});

app.listen(PORT, () => {
    console.log(`🚀 Server đang chạy tại port: ${PORT}`);
});
