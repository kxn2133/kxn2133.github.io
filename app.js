// 初始化Supabase客户端
const supabaseUrl = 'https://czjcvwsalxftsxomfiyf.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN6amN2d3NhbHhmdHN4b21maXlmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk0NzYwMDMsImV4cCI6MjA3NTA1MjAwM30.KowEk4M6Ykl8q21DxsT9dKOgmwy0Hlg3cabD6tr3Q8k';
const supabase = supabase.createClient(supabaseUrl, supabaseKey);

// DOM元素
const messageForm = document.getElementById('messageForm');
const messagesList = document.getElementById('messagesList');
const loadMoreBtn = document.getElementById('loadMoreBtn');
const commentModal = document.getElementById('commentModal');
const closeModal = document.getElementById('closeModal');
const commentForm = document.getElementById('commentForm');
const commentsList = document.getElementById('commentsList');
const commentParentMessage = document.getElementById('commentParentMessage');
const totalMessagesEl = document.getElementById('totalMessages');
const todayMessagesEl = document.getElementById('todayMessages');
const totalCommentsEl = document.getElementById('totalComments');

// 状态变量
let currentPage = 0;
const pageSize = 10;
let selectedMessageId = null;
let activityChart = null;

// 初始化应用
async function initApp() {
    // 初始化数据库表（如果不存在）
    await initTables();
    
    // 加载留言
    await loadMessages();
    
    // 加载统计数据
    await loadStats();
    
    // 初始化图表
    initChart();
    
    // 添加事件监听器
    setupEventListeners();
}

// 初始化数据库表
async function initTables() {
    try {
        // 创建messages表
        await supabase.rpc('create_messages_table_if_not_exists');
        
        // 创建comments表
        await supabase.rpc('create_comments_table_if_not_exists');
        
        // 如果RPC函数不存在，尝试直接创建表（备用方案）
        try {
            // 尝试创建messages表
            await supabase
                .from('messages')
                .select('*')
                .limit(1);
        } catch (error) {
            // 如果表不存在，这里会抛出错误，但我们无法直接创建表（需要在Supabase控制台手动创建）
            console.log('表可能尚未创建，请在Supabase控制台手动创建所需的表');
        }
    } catch (error) {
        console.log('初始化表时出错:', error);
    }
}

// 设置事件监听器
function setupEventListeners() {
    // 提交留言表单
    messageForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        await submitMessage();
    });
    
    // 加载更多按钮
    loadMoreBtn.addEventListener('click', async () => {
        currentPage++;
        await loadMessages(true);
    });
    
    // 评论模态框
    closeModal.addEventListener('click', () => {
        commentModal.classList.add('hidden');
    });
    
    // 点击模态框外部关闭
    commentModal.addEventListener('click', (e) => {
        if (e.target === commentModal) {
            commentModal.classList.add('hidden');
        }
    });
    
    // 提交评论表单
    commentForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        await submitComment();
    });
}

// 提交留言
async function submitMessage() {
    const name = document.getElementById('name').value;
    const content = document.getElementById('content').value;
    
    if (!name || !content) {
        alert('请填写昵称和留言内容');
        return;
    }
    
    try {
        // 显示加载状态
        const submitButton = messageForm.querySelector('button[type="submit"]');
        const originalText = submitButton.innerHTML;
        submitButton.innerHTML = '<i class="fa fa-spinner fa-spin mr-2"></i>提交中...';
        submitButton.disabled = true;
        
        // 提交到数据库
        const { data, error } = await supabase
            .from('messages')
            .insert([
                {
                    name,
                    content,
                    created_at: new Date().toISOString()
                }
            ])
            .select();
        
        if (error) {
            throw error;
        }
        
        // 重置表单
        messageForm.reset();
        
        // 重新加载留言列表
        currentPage = 0;
        await loadMessages();
        
        // 重新加载统计数据
        await loadStats();
        
        // 更新图表
        await updateChart();
        
    } catch (error) {
        console.error('提交留言时出错:', error);
        alert('提交失败，请重试');
    } finally {
        // 恢复按钮状态
        const submitButton = messageForm.querySelector('button[type="submit"]');
        submitButton.innerHTML = originalText;
        submitButton.disabled = false;
    }
}

// 加载留言
async function loadMessages(append = false) {
    try {
        // 显示加载状态
        if (!append) {
            messagesList.innerHTML = '<div class="loading"><div class="loading-spinner"></div></div>';
        } else {
            loadMoreBtn.innerHTML = '<i class="fa fa-spinner fa-spin mr-2"></i>加载中...';
            loadMoreBtn.disabled = true;
        }
        
        // 从数据库获取留言，包括相关的评论数量
        const { data, error } = await supabase
            .from('messages')
            .select(`
                *, 
                comments:comments_count
            `)
            .order('created_at', { ascending: false })
            .range(currentPage * pageSize, (currentPage + 1) * pageSize - 1);
        
        if (error) {
            throw error;
        }
        
        // 如果没有数据
        if (data.length === 0) {
            if (!append) {
                messagesList.innerHTML = `
                    <div class="text-center py-12 text-gray-500">
                        <i class="fa fa-comments-o text-4xl mb-4 block"></i>
                        <p>暂无留言，快来发表第一条留言吧！</p>
                    </div>
                `;
            }
            loadMoreBtn.classList.add('hidden');
            return;
        }
        
        // 渲染留言列表
        const html = data.map(message => renderMessage(message)).join('');
        
        if (append) {
            messagesList.insertAdjacentHTML('beforeend', html);
        } else {
            messagesList.innerHTML = html;
        }
        
        // 如果有更多数据，显示加载更多按钮
        if (data.length === pageSize) {
            loadMoreBtn.classList.remove('hidden');
        } else {
            loadMoreBtn.classList.add('hidden');
        }
        
        // 为新添加的留言绑定事件
        bindMessageEvents();
        
    } catch (error) {
        console.error('加载留言时出错:', error);
        messagesList.innerHTML = `
            <div class="text-center py-12 text-red-500">
                <i class="fa fa-exclamation-circle text-4xl mb-4 block"></i>
                <p>加载留言失败，请刷新页面重试</p>
            </div>
        `;
    } finally {
        // 恢复按钮状态
        loadMoreBtn.innerHTML = '<i class="fa fa-refresh mr-2"></i>加载更多';
        loadMoreBtn.disabled = false;
    }
}

// 渲染单条留言
function renderMessage(message) {
    const commentsCount = message.comments || 0;
    const formattedDate = formatDate(message.created_at);
    
    return `
        <div class="message-card p-5 fade-in">
            <div class="message-header">
                <div class="message-author">${escapeHtml(message.name)}</div>
                <div class="message-time">${formattedDate}</div>
            </div>
            <div class="message-content">${escapeHtml(message.content).replace(/\n/g, '<br>')}</div>
            <div class="message-actions">
                <button class="action-btn comment-btn" data-id="${message.id}">
                    <i class="fa fa-comment-o"></i>
                    <span>评论 (${commentsCount})</span>
                </button>
                <button class="action-btn like-btn" data-id="${message.id}">
                    <i class="fa fa-thumbs-o-up"></i>
                    <span>点赞</span>
                </button>
            </div>
            <!-- 评论列表 -->
            <div class="message-comments hidden" data-id="${message.id}">
                <!-- 评论将动态加载到这里 -->
            </div>
        </div>
    `;
}

// 为留言绑定事件
function bindMessageEvents() {
    // 评论按钮事件
    document.querySelectorAll('.comment-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const messageId = e.currentTarget.dataset.id;
            openCommentModal(messageId);
        });
    });
    
    // 点赞按钮事件
    document.querySelectorAll('.like-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const messageId = e.currentTarget.dataset.id;
            likeMessage(messageId, e.currentTarget);
        });
    });
}

// 打开评论模态框
async function openCommentModal(messageId) {
    selectedMessageId = messageId;
    
    try {
        // 获取留言详情
        const { data: messageData, error: messageError } = await supabase
            .from('messages')
            .select('*')
            .eq('id', messageId)
            .single();
        
        if (messageError) {
            throw messageError;
        }
        
        // 显示父留言内容
        commentParentMessage.innerHTML = `
            <div class="font-medium text-gray-800 mb-1">${escapeHtml(messageData.name)}</div>
            <div class="text-gray-600 text-sm">${formatDate(messageData.created_at)}</div>
            <div class="text-gray-700 mt-2">${escapeHtml(messageData.content).replace(/\n/g, '<br>')}</div>
        `;
        
        // 设置父留言ID
        document.getElementById('parentId').value = messageId;
        
        // 加载评论
        await loadComments(messageId);
        
        // 显示模态框
        commentModal.classList.remove('hidden');
        
    } catch (error) {
        console.error('打开评论模态框时出错:', error);
        alert('加载留言详情失败');
    }
}

// 加载评论
async function loadComments(messageId) {
    try {
        // 显示加载状态
        commentsList.innerHTML = '<div class="loading"><div class="loading-spinner"></div></div>';
        
        // 从数据库获取评论
        const { data, error } = await supabase
            .from('comments')
            .select('*')
            .eq('message_id', messageId)
            .order('created_at', { ascending: true });
        
        if (error) {
            throw error;
        }
        
        // 渲染评论列表
        if (data.length === 0) {
            commentsList.innerHTML = `
                <div class="text-center py-6 text-gray-500 text-sm">
                    <i class="fa fa-comment-o mr-1"></i>暂无评论，快来抢沙发吧！
                </div>
            `;
        } else {
            const html = data.map(comment => renderComment(comment)).join('');
            commentsList.innerHTML = html;
        }
        
    } catch (error) {
        console.error('加载评论时出错:', error);
        commentsList.innerHTML = `
            <div class="text-center py-6 text-red-500 text-sm">
                <i class="fa fa-exclamation-circle mr-1"></i>加载评论失败
            </div>
        `;
    }
}

// 渲染单条评论
function renderComment(comment) {
    const formattedDate = formatDate(comment.created_at);
    
    return `
        <div class="comment-item fade-in">
            <div class="comment-header">
                <div class="comment-author">${escapeHtml(comment.name)}</div>
                <div class="comment-time">${formattedDate}</div>
            </div>
            <div class="comment-content">${escapeHtml(comment.content).replace(/\n/g, '<br>')}</div>
        </div>
    `;
}

// 提交评论
async function submitComment() {
    const name = document.getElementById('commentName').value;
    const content = document.getElementById('commentContent').value;
    const parentId = document.getElementById('parentId').value;
    
    if (!name || !content) {
        alert('请填写昵称和评论内容');
        return;
    }
    
    try {
        // 显示加载状态
        const submitButton = commentForm.querySelector('button[type="submit"]');
        const originalText = submitButton.innerHTML;
        submitButton.innerHTML = '<i class="fa fa-spinner fa-spin mr-2"></i>提交中...';
        submitButton.disabled = true;
        
        // 提交到数据库
        const { data, error } = await supabase
            .from('comments')
            .insert([
                {
                    message_id: parentId,
                    name,
                    content,
                    created_at: new Date().toISOString()
                }
            ])
            .select();
        
        if (error) {
            throw error;
        }
        
        // 重置表单
        document.getElementById('commentContent').value = '';
        
        // 重新加载评论
        await loadComments(parentId);
        
        // 重新加载统计数据
        await loadStats();
        
        // 更新图表
        await updateChart();
        
    } catch (error) {
        console.error('提交评论时出错:', error);
        alert('提交失败，请重试');
    } finally {
        // 恢复按钮状态
        const submitButton = commentForm.querySelector('button[type="submit"]');
        submitButton.innerHTML = originalText;
        submitButton.disabled = false;
    }
}

// 点赞留言
async function likeMessage(messageId, button) {
    try {
        // 这里简化处理，实际项目中应该记录用户的点赞状态
        button.innerHTML = '<i class="fa fa-thumbs-up"></i><span>已点赞</span>';
        button.classList.add('text-blue-500');
        button.disabled = true;
        
        // 在实际项目中，这里应该调用API更新点赞数
        // await supabase.rpc('increment_message_likes', { message_id: messageId });
        
    } catch (error) {
        console.error('点赞时出错:', error);
        alert('点赞失败，请重试');
        button.innerHTML = '<i class="fa fa-thumbs-o-up"></i><span>点赞</span>';
        button.classList.remove('text-blue-500');
        button.disabled = false;
    }
}

// 加载统计数据
async function loadStats() {
    try {
        // 获取总留言数
        const { count: totalMessagesCount } = await supabase
            .from('messages')
            .select('id', { count: 'exact' });
        
        // 获取今日新增留言数
        const today = new Date().toISOString().split('T')[0];
        const { count: todayMessagesCount } = await supabase
            .from('messages')
            .select('id', { count: 'exact' })
            .gte('created_at', today);
        
        // 获取总评论数
        const { count: totalCommentsCount } = await supabase
            .from('comments')
            .select('id', { count: 'exact' });
        
        // 更新统计显示
        totalMessagesEl.textContent = totalMessagesCount || 0;
        todayMessagesEl.textContent = todayMessagesCount || 0;
        totalCommentsEl.textContent = totalCommentsCount || 0;
        
    } catch (error) {
        console.error('加载统计数据时出错:', error);
    }
}

// 初始化图表
function initChart() {
    const ctx = document.getElementById('activityChart').getContext('2d');
    
    activityChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: [],
            datasets: [
                {
                    label: '留言数',
                    data: [],
                    borderColor: 'rgb(59, 130, 246)',
                    backgroundColor: 'rgba(59, 130, 246, 0.1)',
                    tension: 0.4,
                    fill: true
                },
                {
                    label: '评论数',
                    data: [],
                    borderColor: 'rgb(124, 58, 237)',
                    backgroundColor: 'rgba(124, 58, 237, 0.1)',
                    tension: 0.4,
                    fill: true
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'top',
                },
                tooltip: {
                    mode: 'index',
                    intersect: false,
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        stepSize: 1
                    }
                }
            }
        }
    });
    
    // 加载图表数据
    updateChart();
}

// 更新图表数据
async function updateChart() {
    try {
        // 获取最近7天的数据
        const labels = [];
        const messagesData = [];
        const commentsData = [];
        
        for (let i = 6; i >= 0; i--) {
            const date = new Date();
            date.setDate(date.getDate() - i);
            const dateStr = date.toISOString().split('T')[0];
            const displayDate = dateStr.split('-').slice(1).join('/'); // MM/DD
            
            labels.push(displayDate);
            
            // 获取当天的留言数
            const { count: messagesCount } = await supabase
                .from('messages')
                .select('id', { count: 'exact' })
                .gte('created_at', dateStr)
                .lt('created_at', new Date(date.getTime() + 86400000).toISOString().split('T')[0]);
            
            messagesData.push(messagesCount || 0);
            
            // 获取当天的评论数
            const { count: commentsCount } = await supabase
                .from('comments')
                .select('id', { count: 'exact' })
                .gte('created_at', dateStr)
                .lt('created_at', new Date(date.getTime() + 86400000).toISOString().split('T')[0]);
            
            commentsData.push(commentsCount || 0);
        }
        
        // 更新图表
        activityChart.data.labels = labels;
        activityChart.data.datasets[0].data = messagesData;
        activityChart.data.datasets[1].data = commentsData;
        activityChart.update();
        
    } catch (error) {
        console.error('更新图表数据时出错:', error);
    }
}

// 工具函数：格式化日期
function formatDate(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now - date);
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    
    // 如果是今天，显示时间
    if (diffDays === 0) {
        return date.toLocaleTimeString('zh-CN', {
            hour: '2-digit',
            minute: '2-digit'
        });
    }
    // 如果是昨天，显示"昨天 HH:MM"
    else if (diffDays === 1) {
        return '昨天 ' + date.toLocaleTimeString('zh-CN', {
            hour: '2-digit',
            minute: '2-digit'
        });
    }
    // 如果是一周内，显示星期几和时间
    else if (diffDays < 7) {
        const weekdays = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];
        return weekdays[date.getDay()] + ' ' + date.toLocaleTimeString('zh-CN', {
            hour: '2-digit',
            minute: '2-digit'
        });
    }
    // 其他情况显示完整日期时间
    else {
        return date.toLocaleString('zh-CN', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
        });
    }
}

// 工具函数：转义HTML
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// 页面加载完成后初始化应用
document.addEventListener('DOMContentLoaded', initApp);