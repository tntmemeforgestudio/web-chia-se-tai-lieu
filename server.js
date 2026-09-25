const express = require('express');
const path = require('path');
const app = express();

// Cấu hình để đọc dữ liệu dạng JSON từ Front-end gửi lên
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Mảng lưu trữ tạm thời (Hoặc bạn giữ nguyên đoạn kết nối Database / Mongoose sẵn có của bạn ở đây)
let posts = [];

// API Lấy danh sách bài viết
app.get('/api/posts', (req, res) => {
    res.json(posts.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)));
});

// API Đăng bài viết mới (Đã khớp hoàn toàn với Front-end dạng JSON)
app.post('/api/posts', (req, res) => {
    try {
        const { author, content, authorToken } = req.body;

        // Xử lý kiểm tra mã VIP an toàn ở phía Server
        const rawAuthor = author || 'Ẩn danh';
        const isVip = rawAuthor.includes('# nhà xuất bản');
        const cleanAuthor = rawAuthor.replace('# nhà xuất bản', '').trim();

        const newPost = {
            _id: Date.now().toString(),
            author: cleanAuthor || 'Ẩn danh',
            content: content || '',
            authorToken: authorToken || '',
            isVip: isVip,
            likes: 0,
            dislikes: 0,
            createdAt: new Date()
        };

        posts.unshift(newPost); // Thêm bài mới lên đầu danh sách
        res.status(201).json(newPost);
    } catch (error) {
        console.error("Lỗi đăng bài:", error);
        res.status(500).json({ error: 'Lỗi máy chủ' });
    }
});

// API Xóa bài viết
app.delete('/api/posts/:id', (req, res) => {
    try {
        const postId = req.params.id;
        const authorToken = req.headers['x-author-token'];

        const postIndex = posts.findIndex(p => p._id === postId);
        if (postIndex === -1) {
            return res.status(404).json({ error: 'Không tìm thấy bài viết' });
        }

        // Kiểm tra quyền sở hữu bài viết
        if (posts[postIndex].authorToken && posts[postIndex].authorToken !== authorToken) {
            return res.status(403).json({ error: 'Không có quyền xóa bài viết này' });
        }

        posts.splice(postIndex, 1);
        res.status(200).json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Lỗi máy chủ' });
    }
});

// Khởi động Server (Port mặc định của Render/Glitch/Local)
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server đang chạy tại cổng ${PORT}`);
});
