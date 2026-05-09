const SUPABASE_URL = 'https://wqhxhqfwiosknpmkjafh.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndxaHhocWZ3aW9za25wbWtqYWZoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgxNDY5OTQsImV4cCI6MjA5MzcyMjk5NH0.OvHhdKzWQyw0LaBd8u3XedRRPQMwdysu0tkdy69jVfQ';

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// 当前状态
let currentUser = null;
let currentPostId = null;
let currentPostData = null;
let isEditing = false;

// ============ 页面加载 ============
document.addEventListener('DOMContentLoaded', () => {
    checkUser();
    loadPosts();
});

// ============ 认证功能 ============
async function checkUser() {
    const { data: { user } } = await supabaseClient.auth.getUser();
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

    const { data, error } = await supabaseClient.auth.signUp({
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

    const { data, error } = await supabaseClient.auth.signInWithPassword({
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
    await supabaseClient.auth.signOut();
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

    const { data: posts, error } = await supabaseClient
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
    const { data: post, error } = await supabaseClient
        .from('posts')
        .select('*')
        .eq('id', postId)
        .single();

    if (error) {
        console.error('Error:', error);
        return;
    }

    currentPostId = postId;
    currentPostData = post;
    document.getElementById('postsSection').classList.add('hidden');
    document.getElementById('heroSection').classList.add('hidden');
    document.getElementById('postDetail').style.display = 'block';
    document.getElementById('detailTitle').textContent = post.title;
    document.getElementById('detailMeta').textContent = `Posted on ${new Date(post.created_at).toLocaleDateString()}`;
    document.getElementById('detailContent').innerHTML = post.content.replace(/\n/g, '<br>');

    const actionsDiv = document.getElementById('postActions');
    if (currentUser && currentUser.id === post.user_id) {
        actionsDiv.style.display = 'flex';
    } else {
        actionsDiv.style.display = 'none';
    }

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

    const { data, error } = await supabaseClient
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

    const { data: comments, error } = await supabaseClient
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

    const { data, error } = await supabaseClient
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
    isEditing = false;
    document.getElementById('postModalTitle').textContent = 'Create New Post';
    document.getElementById('postTitle').value = '';
    document.getElementById('postContent').value = '';
    document.getElementById('postModal').style.display = 'block';
}

function prepareEditPost() {
    isEditing = true;
    document.getElementById('postModalTitle').textContent = 'Edit Post';
    document.getElementById('postTitle').value = currentPostData.title;
    document.getElementById('postContent').value = currentPostData.content;
    document.getElementById('postModal').style.display = 'block';
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
    let error;

    if (isEditing) {
        // 如果是编辑模式，执行更新 (Update)
        const { error: updateError } = await supabaseClient
            .from('posts')
            .update({ title, content, excerpt })
            .eq('id', currentPostId);
        error = updateError;
    } else {
        // 否则执行插入 (Insert)
        const { error: insertError } = await supabaseClient
            .from('posts')
            .insert([{ title, content, excerpt, user_id: currentUser.id }]);
        error = insertError;
    }

    if (error) {
        showMessage(messageEl, 'Error: ' + error.message, 'error');
    } else {
        closeModal('postModal');
        // 如果是编辑后保存，则重新加载当前文章以显示最新内容；如果是新建，则回首页
        if (isEditing) {
            viewPost(currentPostId); 
        } else {
            showHome();
        }
        loadPosts(); // 刷新列表
    }
}

// 删除文章
async function deletePost() {
    // 增加一个浏览器的二次确认弹窗，防止误删
    if (!confirm('Are you sure you want to delete this post? This action cannot be undone.')) {
        return;
    }

    const { error } = await supabaseClient
        .from('posts')
        .delete()
        .eq('id', currentPostId);

    if (error) {
        alert('Error deleting post: ' + error.message);
    } else {
        alert('Post deleted successfully!');
        loadPosts(); // 刷新文章列表
        showHome();  // 返回首页
    }
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
