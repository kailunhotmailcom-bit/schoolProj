// Supabase 配置 - ⚠️ 使用你的项目信息替换
const SUPABASE_URL = 'https://wqhxhqfwiosknpmkjafh.supabase.co';
const SUPABASE_ANON_KEY = '22515dc8-e08a-49be-8e94-5855062ef2b1';
// 初始化 Supabase 客户端
const supabase = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// 当前状态
let currentUser = null;
let currentPostId = null;

// ============ 页面加载 ============
document.addEventListener('DOMContentLoaded', () => {
    checkUser();
    loadPosts();
});

// ============ 认证功能 ============
async function checkUser() {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
        currentUser = user;
        document.getElementById('authButtons').style.display = 'none';
        document.getElementById('userInfo').style.display = 'flex';
        document.getElementById('userEmail').textContent = user.email;
        document.getElementById('heroSection').classList.add('hidden');
    }
}

async function register() {
    const email = document.getElementById('registerEmail').value;
    const password = document.getElementById('registerPassword').value;
    const messageEl = document.getElementById('registerMessage');

    if (!email || !password) {
        showMessage(messageEl, 'Please fill in all fields', 'error');
        return;
    }

    if (password.length < 6) {
        showMessage(messageEl, 'Password must be at least 6 characters', 'error');
        return;
    }

    const { data, error } = await supabase.auth.signUp({
        email,
        password,
    });

    if (error) {
        showMessage(messageEl, error.message, 'error');
    } else {
        showMessage(messageEl, 'Account created! You can now login.', 'success');
        setTimeout(() => {
            closeModal('registerModal');
            showLoginModal();
        }, 2000);
    }
}

async function login() {
    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;
    const messageEl = document.getElementById('loginMessage');

    if (!email || !password) {
        showMessage(messageEl, 'Please fill in all fields', 'error');
        return;
    }

    const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
    });

    if (error) {
        showMessage(messageEl, error.message, 'error');
    } else {
        closeModal('loginModal');
        checkUser();
        loadPosts();
        showHome();
    }
}

async function logout() {
    await supabase.auth.signOut();
    currentUser = null;
    document.getElementById('authButtons').style.display = 'flex';
    document.getElementById('userInfo').style.display = 'none';
    document.getElementById('heroSection').classList.remove('hidden');
    loadPosts();
    showHome();
}

// ============ 文章功能 ============
async function loadPosts() {
    const container = document.getElementById('postsContainer');
    container.innerHTML = '<div class="loading">Loading posts...</div>';

    const { data: posts, error } = await supabase
        .from('posts')
        .select('*')
        .order('created_at', { ascending: false });

    if (error) {
        container.innerHTML = '<p style="text-align:center;color:red;">Error loading posts</p>';
        console.error('Error:', error);
        return;
    }

    if (posts.length === 0) {
        container.innerHTML = '<p style="text-align:center;color:#999;">No posts yet. Be the first to write one!</p>';
        return;
    }

    container.innerHTML = posts.map(post => `
        <article class="blog-post" onclick="viewPost('${post.id}')">
            <div class="post-image">📝</div>
            <div class="post-content">
                <h3>${escapeHtml(post.title)}</h3>
                <div class="post-meta">
                    Posted on ${new Date(post.created_at).toLocaleDateString()}
                </div>
                <p class="post-excerpt">${escapeHtml(post.excerpt || post.content.substring(0, 150))}...</p>
            </div>
        </article>
    `).join('');
}

async function viewPost(postId) {
    const { data: post, error } = await supabase
        .from('posts')
        .select('*')
        .eq('id', postId)
        .single();

    if (error) {
        console.error('Error:', error);
        return;
    }

    currentPostId = postId;
    document.getElementById('postsSection').classList.add('hidden');
    document.getElementById('heroSection').classList.add('hidden');
    document.getElementById('postDetail').style.display = 'block';
    document.getElementById('detailTitle').textContent = post.title;
    document.getElementById('detailMeta').textContent = `Posted on ${new Date(post.created_at).toLocaleDateString()}`;
    document.getElementById('detailContent').innerHTML = post.content.replace(/\n/g, '<br>');

    loadComments(postId);

    // 显示评论表单（如果用户已登录）
    if (currentUser) {
        document.getElementById('commentForm').style.display = 'block';
    } else {
        document.getElementById('commentForm').style.display = 'none';
    }
}

async function submitPost() {
    const title = document.getElementById('postTitle').value;
    const content = document.getElementById('postContent').value;
    const messageEl = document.getElementById('postMessage');

    if (!title || !content) {
        showMessage(messageEl, 'Please fill in all fields', 'error');
        return;
    }

    const excerpt = content.substring(0, 150);

    const { data, error } = await supabase
        .from('posts')
        .insert([
            {
                title,
                content,
                excerpt,
                user_id: currentUser.id
            }
        ]);

    if (error) {
        showMessage(messageEl, 'Error: ' + error.message, 'error');
    } else {
        closeModal('postModal');
        document.getElementById('postTitle').value = '';
        document.getElementById('postContent').value = '';
        loadPosts();
        showHome();
    }
}

// ============ 评论功能 ============
async function loadComments(postId) {
    const container = document.getElementById('commentsContainer');
    container.innerHTML = '<div class="loading">Loading comments...</div>';

    const { data: comments, error } = await supabase
        .from('comments')
        .select('*')
        .eq('post_id', postId)
        .order('created_at', { ascending: true });

    if (error) {
        container.innerHTML = '<p class="no-comments">Error loading comments</p>';
        return;
    }

    if (comments.length === 0) {
        container.innerHTML = '<p class="no-comments">No comments yet. Be the first to comment!</p>';
        return;
    }

    container.innerHTML = comments.map(comment => `
        <div class="comment">
            <div class="comment-meta">
                ${new Date(comment.created_at).toLocaleDateString()}
            </div>
            <div class="comment-content">${escapeHtml(comment.content)}</div>
        </div>
    `).join('');
}

async function submitComment() {
    const content = document.getElementById('commentInput').value;

    if (!content) {
        alert('Please write a comment');
        return;
    }

    const { data, error } = await supabase
        .from('comments')
        .insert([
            {
                post_id: currentPostId,
                content,
                user_id: currentUser.id
            }
        ]);

    if (error) {
        alert('Error: ' + error.message);
    } else {
        document.getElementById('commentInput').value = '';
        loadComments(currentPostId);
    }
}

// ============ 导航功能 ============
function showHome() {
    document.getElementById('postsSection').classList.remove('hidden');
    document.getElementById('postDetail').style.display = 'none';
    if (!currentUser) {
        document.getElementById('heroSection').classList.remove('hidden');
    }
    currentPostId = null;
}

function showLoginModal() {
    document.getElementById('loginModal').style.display = 'block';
}

function showRegisterModal() {
    document.getElementById('registerModal').style.display = 'block';
}

function showCreatePostModal() {
    if (!currentUser) {
        alert('Please login first');
        return;
    }
    document.getElementById('postModalTitle').textContent = 'Create New Post';
    document.getElementById('postModal').style.display = 'block';
}

function closeModal(modalId) {
    document.getElementById(modalId).style.display = 'none';
}

// 点击模态框外部关闭
window.onclick = function(event) {
    if (event.target.classList.contains('modal')) {
        event.target.style.display = 'none';
    }
}

// ============ 工具函数 ============
function showMessage(element, message, type) {
    element.textContent = message;
    element.className = 'message message-' + type;
    element.style.display = 'block';
    setTimeout(() => {
        element.style.display = 'none';
    }, 5000);
}

function escapeHtml(unsafe) {
    return unsafe
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}