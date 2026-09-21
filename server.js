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
        .then(() => console.log('✅ Đã kết nối MongoDB Atlas thành công!'))
        .catch(err => console.error('❌ Lỗi kết nối MongoDB:', err));
}

// 2. Tự động nhận diện cấu hình từ biến CLOUDINARY_URL trên Render
cloudinary.config();

// 3. Cấu hình Multer Storage tự động phân loại tệp tin tải lên Cloudinary
const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: async (req, file) => {
    let resource_type = 'auto';
    const mime = file.mimetype || '';
    
    if (mime.startsWith('video/')) {
      resource_type = 'video';
    } else if (mime.startsWith('image/')) {
      resource_type = 'image';
    } else {
      resource_type = 'raw';
    }

    return {
      folder: 'web_uploads',
      resource_type: resource_type
    };
  },
});

const upload = multer({ 
  storage: storage,
  limits: { fileSize: 100 * 1024 * 1024 } // Giới hạn tệp tối đa 100MB
});

// 4. Định nghĩa Schema Bài viết
const postSchema = new mongoose.Schema({
    author: { type: String, default: 'Ẩn danh' },
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

// 5. API Lấy danh sách bài viết
app.get('/posts', async (req, res) => {
    try {
        const posts = await Post.find().sort({ createdAt: -1 });
        res.json(posts);
    } catch (err) {
        console.error('❌ Lỗi lấy danh sách bài viết:', err);
        res.status(500).json({ error: 'Lỗi lấy bài viết' });
    }
});

// 6. API Đăng bài mới (Tải tệp lên Cloudinary và lưu URL vào MongoDB)
app.post('/post', (req, res) => {
    upload.single('media')(req, res, async (err) => {
        if (err) {
            console.error('❌ LỖI TẢI TỆP LÊN CLOUDINARY CHI TIẾT:', err);
            return res.status(400).json({ 
                error: 'Lỗi tải tệp tin lên Cloudinary!', 
                details: err.message || err 
            });
        }

        try {
            const { author, content } = req.body;
            let mediaUrl = null;
            let mediaType = null;

            if (req.file) {
                mediaUrl = req.file.path; // Đường dẫn URL từ Cloudinary
                const mime = req.file.mimetype || '';
                if (mime.startsWith('image/')) mediaType = 'image';
                else if (mime.startsWith('video/')) mediaType = 'video';
                else mediaType = 'file';
            }

            if (!content && !mediaUrl) {
                return res.status(400).json({ error: 'Vui lòng nhập nội dung hoặc chọn tệp!' });
            }

            const newPost = new Post({ 
                author: author || 'Ẩn danh', 
                content, 
                mediaUrl, 
                mediaType 
            });
            
            await newPost.save();
            res.json({ success: true, post: newPost });
        } catch (dbErr) {
            console.error('❌ LỖI LƯU CSDL MONGODB CHI TIẾT:', dbErr);
            res.status(500).json({ error: 'Lỗi lưu dữ liệu bài viết!' });
        }
    });
});

// 7. API Xóa bài viết
app.delete('/posts/:id', async (req, res) => {
    try {
        await Post.findByIdAndDelete(req.params.id);
        res.json({ success: true });
    } catch (err) {
        console.error('❌ Lỗi xóa bài viết:', err);
        res.status(500).json({ error: 'Không thể xóa bài viết.' });
    }
});

// 8. API Tương tác Like & Dislike
app.post('/posts/:id/like', async (req, res) => {
    try {
        const post = await Post.findByIdAndUpdate(req.params.id, { $inc: { likes: 1 } }, { new: true });
        res.json({ likes: post.likes, dislikes: post.dislikes });
    } catch (err) {
        res.status(500).json({ error: 'Lỗi lượt thích' });
    }
});

app.post('/posts/:id/dislike', async (req, res) => {
    try {
        const post = await Post.findByIdAndUpdate(req.params.id, { $inc: { dislikes: 1 } }, { new: true });
        res.json({ likes: post.likes, dislikes: post.dislikes });
    } catch (err) {
        res.status(500).json({ error: 'Lỗi lượt không thích' });
    }
});

// Khởi động Máy chủ
app.listen(PORT, () => {
    console.log(`🚀 Máy chủ đang lắng nghe tại cổng: ${PORT}`);
});
