const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = 3000;

// Tạo thư mục lưu file nếu chưa có
const uploadDir = path.join(__dirname, 'public', 'uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadDir),
    filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname)
});
const upload = multer({ storage: storage });

app.use(express.static('public'));
app.use(express.urlencoded({ extended: true }));

const dbFile = path.join(__dirname, 'db.json');
if (!fs.existsSync(dbFile)) fs.writeFileSync(dbFile, JSON.stringify([]));

app.get('/posts', (req, res) => {
    const posts = JSON.parse(fs.readFileSync(dbFile));
    res.json(posts);
});

app.post('/post', upload.single('media'), (req, res) => {
    const { content } = req.body;
    const mediaUrl = req.file ? `/uploads/${req.file.filename}` : null;

    const posts = JSON.parse(fs.readFileSync(dbFile));
    posts.unshift({ content, mediaUrl, time: new Date().toLocaleString() });
    fs.writeFileSync(dbFile, JSON.stringify(posts, null, 2));

    res.redirect('/');
});

app.listen(PORT, () => {
    console.log(`Web đang chạy tại: http://localhost:${PORT}`);
});