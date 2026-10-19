const express = require('express');
const path = require('path');
const mongoose = require('mongoose');
const os = require('os');
const { Readable } = require('stream');

const app = express();

// Tăng giới hạn payload để xử lý dữ liệu đính kèm Base64
app.use(express.json({ limit: '25mb' }));
app.use(express.urlencoded({ limit: '25mb', extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Kết nối MongoDB Cloud
mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/sharedb')
  .then(() => {
      console.log("Đã kết nối MongoDB thành công!");
      cleanupOldFiles();
  })
  .catch(err => console.error("Lỗi kết nối MongoDB:", err));

// Schema Bình luận
const commentSchema = new mongoose.Schema({
    author: String,
    content: String,
    authorToken: String,
    isVip: Boolean,
    parentId: { type: String, default: null },
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

// Tác giả có Tích Vàng ( bạn có thể sử dụng nó ở bất cứ bài đăng nào nếu bạn tôn trọng đúng lời nói của mình và chừng mực )
const VIP_AUTHORS = ['nhà phát triển', 'tnt memeforge studio'];

// --- HỆ THỐNG KIỂM DUYỆT (CHỈ CHẶN ĐÚNG CÁC TỪ CẤM NGUYÊN VĂN TRONG DANH SÁCH) ---
const BANNED_KEYWORDS = [
    // Không hỗ trợ đối với tiếng việt có ngôn từ không lành mạnh ( đây là ngôn ngữ được ưu tiên, nên bạn cần đọc trước khi lấy toàn bộ hoặc thay đổi )
    "cặc", "cac", "cu", "đụ", "du", "đĩ", "di", "lồn", "lon", "loz", "l`", "cc", "c.c",
    "dcm", "dm", "đcm", "đm", "vcl", "vl", "clm", "cl", "cml", "vcc",
    "ngu", "óc chó", "oc cho", "súc vật", "suc vat", "chó", "vô học", "bố láo",
    "mả mẹ", "mẹ kiếp", "đồ khốn", "thằng chó", "con đĩ", "chết tiệt", "đầu bò", "thần kinh", "địt mẹ", "bú lồn", 
    "mả cha", "óc cặc", "óc lồn", "dâm tặc", "đéo", "cứt", "ngáo", "bú", "mẹ mày", "buồi", "đồ ăn hại",
    "bao cao su", "đít", "bao quy đầu", "não tật", "óc bò", "não toàn cứt", "cút mẹ đi", "cút", "địt", 
    "lắm mồm", "vú", "tao", "ngáo buồi", "óc", "wed đen", "xem phim sex", "sex", "giết", "mày", "chết",
    
   // Từ tiếng anh không lành mạnh ( Có hộ trợ AI kiểu duyệt ngôn từ nên bạn có thể thay đổi hoặc bỏ qua ở phần này )
    "fuck", "fuk", "shit", "sh1t", "bitch", "cunt", "ass", "asshole", 
    "bastard", "dick", "pussy", "whore", "slut", "nigger", "nigga", "stfu", "kys", "wtf",
    "blowjob", "fuck you", "dumbass", "pervert", "condom", "suck dick", "pussy hook", 
    
  // Spam, Lừa đảo, Phá hoại mã độc ( Đây là nhóm ngôn từ thuộc dạng bổ sung không nhất thiết phải thêm vào nếu bạn có sửa mã nguồn hoặc xoá mã nguồn )
    "scam", "hack", "crack", "phishing", "malware", "virus", "lừa đảo", "lua dao", "free robux", "network intrusion", "take down the server"
];

// Hàm kiểm tra từ khóa cục bộ (Chỉ quét đúng từ cấm độc lập hoặc cụm từ chính xác)
function checkLocalKeywords(text) {
    if (!text) return false;
    
    const lowerText = text.toLowerCase();
    // Tách văn bản thành mảng các từ riêng biệt bằng khoảng trắng và dấu câu
    const words = lowerText.split(/[\s,.-_!?;:()]+/);

    for (let keyword of BANNED_KEYWORDS) {
        const kw = keyword.toLowerCase().trim();
        if (!kw) continue;

        // Nếu từ cấm là cụm từ (có chứa khoảng trắng, ví dụ: "oc cho")
        if (kw.includes(" ")) {
            if (lowerText.includes(kw)) return true;
        } 
        // Nếu từ cấm là từ đơn: Phải khớp tuyệt đối với một từ trong câu
        else {
            if (words.includes(kw)) return true;
        }
    }
    return false;
}

// Kiểm tra nâng cao bằng OpenAI AI Moderation (Tùy chọn nếu cấu hình trên Render, lưu ý khỉ sử dụng AI)
async function checkAIModeration(text) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!text || !apiKey) return false; 
    
    try {
        const response = await fetch('https://api.openai.com/v1/moderations', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({ input: text })
        });

        if (!response.ok) return false;
        const data = await response.json();
        
        if (data.results && data.results[0] && data.results[0].flagged) {
            return true;
        }
    } catch (err) {
        console.error("Lỗi AI Moderation:", err);
    }
    return false;
}

// Hàm kiểm duyệt tổng hợp
async function isToxicContent(text) {
    if (checkLocalKeywords(text)) return true;
    if (await checkAIModeration(text)) return true;
    return false;
}
// ------------------------------------------------------------------

// API Giám sát Server
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
        } else if (usedMemPercent > 90) {
            status = 'red';
            message = 'Nguy cấp: Bộ nhớ RAM quá tải (' + usedMemPercent + '%)';
        } else if (usedMemPercent > 85) {
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
        const posts = await Post.find().select('-fileData').sort({ createdAt: -1 }).limit(100).lean();

        const safePosts = posts.map(post => {
            const authorLower = (post.author || '').trim().toLowerCase();
            const isVip = Boolean(post.isVip) || VIP_AUTHORS.includes(authorLower);

            return {
                _id: post._id,
                author: post.author,
                content: post.content,
                isVip,
                hasFile: Boolean(post.fileName),
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

// API Download Tệp đính kèm
app.get('/api/posts/:id/download', async (req, res) => {
    try {
        const post = await Post.findById(req.params.id).select('fileData fileName fileType');
        if (!post || !post.fileData) {
            return res.status(404).send('Không tìm thấy tệp đính kèm hoặc tệp đã bị dọn dẹp sau 90 ngày');
        }

        const base64Data = post.fileData.replace(/^data:.*;base64,/, "");
        const fileBuffer = Buffer.from(base64Data, 'base64');

        const encodedFileName = encodeURIComponent(post.fileName || 'tai-lieu');
        res.setHeader('Content-Disposition', `attachment; filename="${encodedFileName}"`);
        res.setHeader('Content-Type', post.fileType || 'application/octet-stream');

        const readStream = Readable.from(fileBuffer);
        readStream.pipe(res);
    } catch (err) {
        res.status(500).send('Lỗi khi tải file');
    }
});

// API Đăng bài mới
app.post('/api/posts', async (req, res) => {
    try {
        const { author, content, authorToken, fileData, fileName, fileSize, fileType } = req.body;
        
        if (await isToxicContent(author) || await isToxicContent(content)) {
            return res.status(400).json({ 
                error: "⚠️ Bài viết chứa ngôn từ không lành mạnh hoặc vi phạm Tiêu chuẩn cộng đồng!" 
            });
        }

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
        res.status(201).json({ success: true, postId: newPost._id });
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

// API Lấy danh sách bình luận
app.get('/api/posts/:id/comments', async (req, res) => {
    try {
        const clientToken = req.headers['x-author-token'] || '';
        const post = await Post.findById(req.params.id).select('-fileData').lean();
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
        
        if (await isToxicContent(author) || await isToxicContent(content)) {
            return res.status(400).json({ 
                error: "⚠️ Bình luận chứa từ ngữ không phù hợp với Tiêu chuẩn cộng đồng!" 
            });
        }

        if (!content || !content.trim()) return res.status(400).json({ error: 'Nội dung rỗng' });

        const post = await Post.findById(req.params.id);
        if (!post) return res.status(404).json({ error: 'Không tìm thấy bài viết' });

        const rawAuthor = (author || 'Ẩn danh').trim();
        const isVip = VIP_AUTHORS.includes(rawAuthor.toLowerCase());

        const newComment = {
            author: rawAuthor,
            content: content.trim(),
            authorToken: authorToken || '',
            isVip,
            parentId: parentId || null,
            likes: 0,
            dislikes: 0,
            likedBy: [],
            dislikedBy: []
        };

        post.comments.push(newComment);
        await post.save();

        const addedComment = post.comments[post.comments.length - 1];
        res.status(201).json({ success: true, comment: addedComment });
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
        res.json({ success: true, likes: cmt.likes, dislikes: cmt.dislikes });
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
        res.json({ success: true, likes: cmt.likes, dislikes: cmt.dislikes });
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

// Tự động dọn dẹp tệp đính kèm cũ hơn 90 ngày
async function cleanupOldFiles() {
    try {
        const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);

        const result = await Post.updateMany(
            { 
                createdAt: { $lt: ninetyDaysAgo },
                fileData: { $ne: '' } 
            },
            { 
                $set: { 
                    fileData: '', 
                    fileName: '[Tệp đã tự động dọn dẹp sau 90 ngày]',
                    fileSize: '',
                    fileType: ''
                } 
            }
        );

        if (result.modifiedCount > 0) {
            console.log(`🧹 Đã dọn dẹp tệp đính kèm của ${result.modifiedCount} bài viết cũ hơn 90 ngày.`);
        }
    } catch (err) {
        console.error("Lỗi khi dọn dẹp tệp cũ:", err);
    }
}

setInterval(cleanupOldFiles, 24 * 60 * 60 * 1000);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server chạy tại cổng ${PORT}`));
