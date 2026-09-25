const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.static(path.join(__dirname, 'public')));

let posts = [];

// API: Lấy danh sách bài viết
app.get('/api/posts', (req, res) => {
    res.json(posts);
});

// API: Tạo bài viết mới
app.post('/api/posts', (req, res) => {
    const { author, content, mediaUrl, mediaName, authorToken } = req.body;
    
    const newPost = {
        _id: Date.now().toString(),
        author: author || 'Ẩn danh',
        content: content || '',
        mediaUrl: mediaUrl || '',
        mediaName: mediaName || '',
        authorToken: authorToken || '',
        likes: 0,
        dislikes: 0,
        comments: [],
        createdAt: new Date()
    };

    posts.unshift(newPost);
    res.status(201).json(newPost);
});

// API: Xóa bài viết
app.delete('/api/posts/:id', (req, res) => {
    const { id } = req.params;
    const authorToken = req.headers['x-author-token'];

    const postIndex = posts.findIndex(p => p._id === id);
    if (postIndex === -1) return res.status(404).json({ error: 'Không tìm thấy bài viết' });

    if (posts[postIndex].authorToken !== authorToken) {
        return res.status(403).json({ error: 'Bạn không có quyền xóa bài viết này' });
    }

    posts.splice(postIndex, 1);
    res.json({ message: 'Đã xóa bài viết thành công' });
});

// API: Vote Bài Viết (Like / Dislike)
app.post('/api/posts/:id/vote', (req, res) => {
    const { id } = req.params;
    const { type, action } = req.body;

    const post = posts.find(p => p._id === id);
    if (!post) return res.status(404).json({ error: 'Không tìm thấy bài viết' });

    if (type === 'like') {
        if (action === 'add') post.likes++;
        else if (action === 'remove') post.likes = Math.max(0, post.likes - 1);
    } else if (type === 'dislike') {
        if (action === 'add') post.dislikes++;
        else if (action === 'remove') post.dislikes = Math.max(0, post.dislikes - 1);
    }

    res.json(post);
});

// API: Thêm bình luận
app.post('/api/posts/:id/comments', (req, res) => {
    const { id } = req.params;
    const { author, content, authorToken } = req.body;

    const post = posts.find(p => p._id === id);
    if (!post) return res.status(404).json({ error: 'Không tìm thấy bài viết' });

    const newComment = {
        _id: Date.now().toString(),
        author: author || 'Ẩn danh',
        content: content,
        authorToken: authorToken,
        likes: 0,
        dislikes: 0,
        createdAt: new Date()
    };

    post.comments.push(newComment);
    res.status(201).json(newComment);
});

// API: Xóa bình luận
app.delete('/api/posts/:postId/comments/:commentId', (req, res) => {
    const { postId, commentId } = req.params;
    const authorToken = req.headers['x-author-token'];

    const post = posts.find(p => p._id === postId);
    if (!post) return res.status(404).json({ error: 'Không tìm thấy bài viết' });

    const commentIndex = post.comments.findIndex(c => c._id === commentId);
    if (commentIndex === -1) return res.status(404).json({ error: 'Không tìm thấy bình luận' });

    if (post.comments[commentIndex].authorToken !== authorToken) {
        return res.status(403).json({ error: 'Bạn không có quyền xóa bình luận này' });
    }

    post.comments.splice(commentIndex, 1);
    res.json({ message: 'Đã xóa bình luận' });
});

// API: Vote Bình Luận
app.post('/api/posts/:postId/comments/:commentId/vote', (req, res) => {
    const { postId, commentId } = req.params;
    const { type, action } = req.body;

    const post = posts.find(p => p._id === postId);
    if (!post) return res.status(404).json({ error: 'Không tìm thấy bài viết' });

    const comment = post.comments.find(c => c._id === commentId);
    if (!comment) return res.status(404).json({ error: 'Không tìm thấy bình luận' });

    if (type === 'like') {
        if (action === 'add') comment.likes++;
        else if (action === 'remove') comment.likes = Math.max(0, comment.likes - 1);
    } else if (type === 'dislike') {
        if (action === 'add') comment.dislikes++;
        else if (action === 'remove') comment.dislikes = Math.max(0, comment.dislikes - 1);
    }

    res.json(comment);
});

// API: Tải Media
app.get('/api/posts/:id/media', (req, res) => {
    const post = posts.find(p => p._id === req.params.id);
    if (!post || !post.mediaUrl) return res.status(404).json({ error: 'Không có file' });
    res.json({ mediaUrl: post.mediaUrl, mediaName: post.mediaName });
});

app.listen(PORT, () => {
    console.log(`Server v2.3.0 running on http://localhost:${PORT}`);
});
