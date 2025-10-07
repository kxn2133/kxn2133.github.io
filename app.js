// 应用程序主模块
import config from './config.js';
import * as utils from './utils.js';
import { initSupabase, ensureTableExists, ensureStorageBucketExists, uploadFile, deleteFile, subscribeToChanges, unsubscribeChanges } from './supabase.service.js';
import { getMessages, createMessage, updateMessage, deleteMessage, toggleLike, addReply, deleteReply, getPopularMessages } from './message.service.js';

// 全局状态
let currentPage = 1;
let searchTerm = '';
let filterType = 'all';
let sortBy = 'created_at';
let sortOrder = 'desc';
let activeMessageId = null;
let activeFile = null;
let realtimeChannels = [];
let isLoading = false;

// DOM 元素
const messageListContainer = document.getElementById('messageList');
const messageForm = document.getElementById('messageForm');
const usernameInput = document.getElementById('username');
const messageContentInput = document.getElementById('messageContent');
const charCountElement = document.getElementById('charCount');
const fileInput = document.getElementById('fileInput');
const dropArea = document.getElementById('dropArea');
const filePreviewContainer = document.getElementById('filePreviewContainer');
const previewFileName = document.getElementById('previewFileName');
const previewFileSize = document.getElementById('previewFileSize');
const previewFileIcon = document.getElementById('previewFileIcon');
const previewImage = document.getElementById('previewImage');
const removeFileBtn = document.getElementById('removeFileBtn');
const uploadProgressContainer = document.getElementById('uploadProgressContainer');
const uploadProgressBar = document.getElementById('uploadProgressBar');
const uploadStatus = document.getElementById('uploadStatus');
const prevPageBtn = document.getElementById('prevPage');
const nextPageBtn = document.getElementById('nextPage');
const currentPageElement = document.getElementById('currentPage');
const totalPagesElement = document.getElementById('totalPages');
const paginationContainer = document.getElementById('pagination');
const searchInput = document.getElementById('searchInput');
const filterSelect = document.getElementById('filterSelect');
const sortToggleBtn = document.getElementById('sortToggle');
const emojiBtn = document.getElementById('emojiBtn');
const emojiPicker = document.getElementById('emojiPicker');
const emojiGrid = document.getElementById('emojiGrid');
const fileViewerModal = document.getElementById('fileViewerModal');
const modalFileName = document.getElementById('modalFileName');
const modalImage = document.getElementById('modalImage');
const closeModalBtn = document.getElementById('closeModalBtn');
const nonImageFileMessage = document.getElementById('nonImageFileMessage');
const nonImageFileText = document.getElementById('nonImageFileText');
const downloadFileLink = document.getElementById('downloadFileLink');
const editModal = document.getElementById('editModal');
const editContentInput = document.getElementById('editContent');
const closeEditModalBtn = document.getElementById('closeEditModalBtn');
const saveEditBtn = document.getElementById('saveEditBtn');
const cancelEditBtn = document.getElementById('cancelEditBtn');

/**
 * 初始化应用程序
 */
async function initApp() {
    try {
        // 初始化Supabase
        const supabase = initSupabase();
        if (!supabase) {
            utils.showErrorToast('Supabase初始化失败，应用程序可能无法正常使用');
            return;
        }
        
        // 确保表和存储桶存在
        await Promise.all([
            ensureTableExists(),
            ensureStorageBucketExists()
        ]);
        
        // 设置事件监听器
        setupEventListeners();
        
        // 加载留言
        loadMessages();
        
        // 设置实时更新
        setupRealtimeUpdates();
        
        // 初始化表情选择器
        initEmojiPicker();
        
        // 尝试从localStorage恢复用户名
        const savedUsername = localStorage.getItem('username');
        if (savedUsername) {
            usernameInput.value = savedUsername;
        }
    } catch (error) {
        console.error('应用程序初始化失败:', error);
        utils.showErrorToast('应用程序初始化失败');
    }
}

/**
 * 设置事件监听器
 */
function setupEventListeners() {
    // 留言表单提交
    messageForm.addEventListener('submit', handleMessageSubmit);
    
    // 字符计数
    messageContentInput.addEventListener('input', updateCharCount);
    
    // 文件上传相关
    dropArea.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', handleFileSelect);
    removeFileBtn.addEventListener('click', removeSelectedFile);
    
    // 拖拽上传
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        dropArea.addEventListener(eventName, preventDefaults, false);
    });
    
    ['dragenter', 'dragover'].forEach(eventName => {
        dropArea.addEventListener(eventName, highlight, false);
    });
    
    ['dragleave', 'drop'].forEach(eventName => {
        dropArea.addEventListener(eventName, unhighlight, false);
    });
    
    dropArea.addEventListener('drop', handleDrop, false);
    
    // 分页控件
    prevPageBtn.addEventListener('click', goToPrevPage);
    nextPageBtn.addEventListener('click', goToNextPage);
    
    // 搜索和筛选
    searchInput.addEventListener('input', utils.debounce(handleSearch, 300));
    filterSelect.addEventListener('change', handleFilterChange);
    
    // 排序切换
    sortToggleBtn.addEventListener('click', toggleSortOrder);
    
    // 表情选择器
    emojiBtn.addEventListener('click', toggleEmojiPicker);
    document.addEventListener('click', (e) => {
        if (!emojiBtn.contains(e.target) && !emojiPicker.contains(e.target)) {
            emojiPicker.classList.add('hidden');
        }
    });
    
    // 文件查看器模态框
    closeModalBtn.addEventListener('click', closeFileViewer);
    fileViewerModal.addEventListener('click', (e) => {
        if (e.target === fileViewerModal) {
            closeFileViewer();
        }
    });
    
    // 编辑模态框
    closeEditModalBtn.addEventListener('click', closeEditModal);
    cancelEditBtn.addEventListener('click', closeEditModal);
    saveEditBtn.addEventListener('click', handleSaveEdit);
    editModal.addEventListener('click', (e) => {
        if (e.target === editModal) {
            closeEditModal();
        }
    });
    
    // 窗口滚动监听
    window.addEventListener('scroll', utils.throttle(handleScroll, 200));
    
    // 窗口关闭前保存用户名
    window.addEventListener('beforeunload', () => {
        if (usernameInput.value.trim()) {
            localStorage.setItem('temp_username', usernameInput.value.trim());
        }
    });
}

/**
 * 初始化表情选择器
 */
function initEmojiPicker() {
    const emojis = utils.generateEmojis();
    
    emojis.forEach(emoji => {
        const emojiSpan = document.createElement('span');
        emojiSpan.textContent = emoji;
        emojiSpan.className = 'cursor-pointer p-1 hover:bg-gray-100 rounded text-xl transition-colors';
        emojiSpan.addEventListener('click', () => {
            insertEmoji(emoji);
        });
        emojiGrid.appendChild(emojiSpan);
    });
}

/**
 * 插入表情到内容输入框
 * @param {string} emoji - 表情符号
 */
function insertEmoji(emoji) {
    const start = messageContentInput.selectionStart;
    const end = messageContentInput.selectionEnd;
    const text = messageContentInput.value;
    
    messageContentInput.value = text.substring(0, start) + emoji + text.substring(end);
    
    // 恢复光标位置并聚焦
    messageContentInput.selectionStart = messageContentInput.selectionEnd = start + emoji.length;
    messageContentInput.focus();
    
    // 更新字符计数
    updateCharCount();
}

/**
 * 处理留言提交
 * @param {Event} e - 事件对象
 */
async function handleMessageSubmit(e) {
    e.preventDefault();
    
    if (isLoading) return;
    
    const username = usernameInput.value.trim();
    const content = messageContentInput.value.trim();
    
    if (!username || !content) {
        utils.showErrorToast('请填写用户名和留言内容');
        return;
    }
    
    if (content.length > config.app.maxContentLength) {
        utils.showErrorToast(`内容不能超过${config.app.maxContentLength}个字符`);
        return;
    }
    
    isLoading = true;
    
    try {
        // 保存用户名到localStorage
        localStorage.setItem('username', username);
        
        let fileInfo = null;
        
        // 如果有选择文件，先上传文件
        if (activeFile) {
            // 显示上传进度
            uploadProgressContainer.classList.remove('hidden');
            uploadProgressBar.style.width = '0%';
            uploadStatus.textContent = '正在上传...';
            
            // 上传文件
            fileInfo = await uploadFile(activeFile, (progress) => {
                uploadProgressBar.style.width = `${progress}%`;
                uploadStatus.textContent = `正在上传... ${Math.round(progress)}%`;
            });
            
            if (!fileInfo) {
                return;
            }
            
            uploadStatus.textContent = '上传完成';
        }
        
        // 创建留言
        const message = await createMessage({
            username,
            content,
            file: fileInfo
        });
        
        if (message) {
            // 清空表单
            messageForm.reset();
            updateCharCount();
            removeSelectedFile();
            
            // 重置上传进度
            uploadProgressContainer.classList.add('hidden');
            
            // 显示成功提示
            utils.showSuccessToast('留言发布成功');
            
            // 如果是第一页，重新加载留言以显示新留言
            if (currentPage === 1) {
                loadMessages();
            } else {
                // 否则跳转到第一页
                currentPage = 1;
                loadMessages();
            }
        }
    } catch (error) {
        console.error('提交留言失败:', error);
        utils.showErrorToast('提交留言失败，请重试');
    } finally {
        isLoading = false;
    }
}

/**
 * 加载留言列表
 */
async function loadMessages() {
    if (isLoading) return;
    
    isLoading = true;
    
    // 显示加载状态
    showLoadingState();
    
    try {
        // 准备查询选项
        const options = {
            page: currentPage,
            pageSize: config.app.pageSize,
            sortBy,
            sortOrder,
            searchTerm
        };
        
        // 根据筛选类型调整选项
        if (filterType === 'popular') {
            options.sortBy = 'likes';
            options.sortOrder = 'desc';
        } else if (filterType === 'latest') {
            options.sortBy = 'created_at';
            options.sortOrder = 'desc';
        }
        
        // 获取留言列表
        const result = await getMessages(options);
        
        // 渲染留言列表
        renderMessages(result.messages);
        
        // 更新分页控件
        updatePagination(result);
    } catch (error) {
        console.error('加载留言失败:', error);
        renderErrorState('加载留言失败，请刷新页面重试');
    } finally {
        isLoading = false;
    }
}

/**
 * 渲染留言列表
 * @param {Array} messages - 留言数组
 */
function renderMessages(messages) {
    if (!messageListContainer) return;
    
    // 清空容器
    messageListContainer.innerHTML = '';
    
    if (!messages || messages.length === 0) {
        renderEmptyState();
        return;
    }
    
    // 渲染每条留言
    messages.forEach(message => {
        const messageElement = createMessageElement(message);
        messageListContainer.appendChild(messageElement);
    });
    
    // 添加事件监听器
    setupMessageEventListeners();
}

/**
 * 创建单条留言元素
 * @param {Object} message - 留言对象
 * @returns {HTMLElement} 留言元素
 */
function createMessageElement(message) {
    const messageDiv = document.createElement('div');
    messageDiv.className = 'bg-white rounded-xl border border-gray-200 p-5 card-hover';
    messageDiv.setAttribute('data-message-id', message.id);
    
    // 格式化时间
    const formattedTime = utils.formatTimestamp(message.created_at);
    
    // 构建留言HTML
    messageDiv.innerHTML = `
        <div class="flex justify-between items-start mb-3">
            <div class="flex items-center space-x-3">
                <div class="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold">
                    ${message.username.charAt(0).toUpperCase()}
                </div>
                <div>
                    <h3 class="font-semibold text-gray-800">${escapeHTML(message.username)}</h3>
                    <p class="text-xs text-gray-500">${formattedTime}</p>
                </div>
            </div>
            <button class="text-gray-400 hover:text-gray-600 p-1 rounded hover:bg-gray-100 transition-colors edit-message-btn">
                <i class="fa fa-pencil"></i>
            </button>
        </div>
        
        <div class="mb-4">
            <p class="text-gray-700 leading-relaxed">${formatContent(escapeHTML(message.content))}</p>
        </div>
        
        ${message.file_name ? `
        <div class="mb-4">
            <div class="flex items-center p-3 bg-gray-50 rounded-lg border border-gray-100 file-preview-item" data-file-url="${message.file_url}" data-file-name="${message.file_name}" data-file-size="${message.file_size}" data-file-type="${message.file_type}">
                ${utils.isImageFile(message.file_type) ? 
                    `<img src="${message.file_url}" alt="${message.file_name}" class="w-12 h-12 object-cover rounded mr-3">` : 
                    `<i class="fa fa-file-${getFileIcon(message.file_type)} text-2xl text-primary mr-3"></i>`
                }
                <div class="flex-grow min-w-0">
                    <p class="text-sm font-medium text-gray-800 truncate">${message.file_name}</p>
                    <p class="text-xs text-gray-500">${utils.formatFileSize(message.file_size)}</p>
                </div>
                <a href="${message.file_url}" target="_blank" class="text-primary hover:text-primary/80 transition-colors ml-2">
                    <i class="fa fa-download"></i>
                </a>
            </div>
        </div>
        ` : ''}
        
        <div class="flex justify-between items-center">
            <button class="flex items-center space-x-1 text-sm text-gray-500 hover:text-primary transition-colors like-btn" ${message.has_liked ? 'data-liked="true"' : ''}>
                <i class="fa fa-thumbs-up ${message.has_liked ? 'text-primary' : ''}"></i>
                <span>${message.likes || 0}</span>
            </button>
            
            <div class="flex space-x-3">
                <button class="flex items-center space-x-1 text-sm text-gray-500 hover:text-primary transition-colors reply-btn">
                    <i class="fa fa-reply"></i>
                    <span>回复</span>
                </button>
                
                <button class="flex items-center space-x-1 text-sm text-gray-500 hover:text-red-500 transition-colors delete-message-btn">
                    <i class="fa fa-trash"></i>
                    <span>删除</span>
                </button>
            </div>
        </div>
        
        <div class="reply-form-container mt-4 hidden">
            <div class="flex space-x-2">
                <textarea class="input-field h-24 resize-none mr-2" placeholder="写下你的回复..."></textarea>
                <div class="flex flex-col justify-end space-y-2">
                    <button class="btn-secondary px-3 py-2 text-sm cancel-reply-btn">取消</button>
                    <button class="btn-primary px-3 py-2 text-sm submit-reply-btn">发送</button>
                </div>
            </div>
        </div>
        
        <div class="replies-container mt-4 pt-4 border-t border-gray-100">
            ${message.replies && message.replies.length > 0 ? 
                message.replies.map(reply => `
                    <div class="flex space-x-3 mb-3">
                        <div class="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-gray-600 font-medium text-sm">
                            ${reply.username.charAt(0).toUpperCase()}
                        </div>
                        <div class="flex-grow">
                            <div class="bg-gray-50 p-3 rounded-lg border border-gray-100">
                                <div class="flex justify-between items-start">
                                    <h4 class="font-medium text-gray-700 text-sm">${escapeHTML(reply.username)}</h4>
                                    <button class="text-gray-400 hover:text-red-500 p-1 text-xs delete-reply-btn" data-reply-id="${reply.id}">
                                        <i class="fa fa-times"></i>
                                    </button>
                                </div>
                                <p class="text-gray-600 text-sm mt-1">${formatContent(escapeHTML(reply.content))}</p>
                                <p class="text-xs text-gray-400 mt-1">${utils.formatTimestamp(reply.created_at)}</p>
                            </div>
                        </div>
                    </div>
                `).join('') : 
                '<p class="text-sm text-gray-400">暂无回复，来发表第一条回复吧！</p>'
            }
        </div>
    `;
    
    return messageDiv;
}

/**
 * 设置留言事件监听器
 */
function setupMessageEventListeners() {
    // 点赞按钮
    document.querySelectorAll('.like-btn').forEach(btn => {
        btn.addEventListener('click', handleLike);
    });
    
    // 回复按钮
    document.querySelectorAll('.reply-btn').forEach(btn => {
        btn.addEventListener('click', toggleReplyForm);
    });
    
    // 取消回复
    document.querySelectorAll('.cancel-reply-btn').forEach(btn => {
        btn.addEventListener('click', toggleReplyForm);
    });
    
    // 提交回复
    document.querySelectorAll('.submit-reply-btn').forEach(btn => {
        btn.addEventListener('click', handleReplySubmit);
    });
    
    // 删除留言
    document.querySelectorAll('.delete-message-btn').forEach(btn => {
        btn.addEventListener('click', handleDeleteMessage);
    });
    
    // 删除回复
    document.querySelectorAll('.delete-reply-btn').forEach(btn => {
        btn.addEventListener('click', handleDeleteReply);
    });
    
    // 文件预览
    document.querySelectorAll('.file-preview-item').forEach(item => {
        item.addEventListener('click', (e) => {
            if (!e.target.closest('a')) {
                handleFilePreview(item);
            }
        });
    });
    
    // 编辑留言
    document.querySelectorAll('.edit-message-btn').forEach(btn => {
        btn.addEventListener('click', handleEditMessage);
    });
}

/**
 * 处理点赞
 * @param {Event} e - 事件对象
 */
async function handleLike(e) {
    const likeBtn = e.currentTarget;
    const messageElement = likeBtn.closest('[data-message-id]');
    const messageId = messageElement.getAttribute('data-message-id');
    
    if (!messageId) return;
    
    const username = usernameInput.value.trim();
    
    if (!username) {
        utils.showErrorToast('请先输入用户名以点赞');
        return;
    }

    try {
        const result = await toggleLike(messageId, username);
        
        if (result) {
            // 更新点赞数和状态
            const likeCountElement = likeBtn.querySelector('span');
            const likeIconElement = likeBtn.querySelector('i');
            
            likeCountElement.textContent = result.likes || 0;
            
            if (result.has_liked) {
                likeBtn.setAttribute('data-liked', 'true');
                likeIconElement.classList.add('text-primary');
            } else {
                likeBtn.removeAttribute('data-liked');
                likeIconElement.classList.remove('text-primary');
            }
        }
    } catch (error) {
        console.error('点赞操作失败:', error);
    }
}

/**
 * 切换回复表单显示状态
 * @param {Event} e - 事件对象
 */
function toggleReplyForm(e) {
    const btn = e.currentTarget;
    const messageElement = btn.closest('[data-message-id]');
    const replyFormContainer = messageElement.querySelector('.reply-form-container');
    
    if (replyFormContainer.classList.contains('hidden')) {
        // 先隐藏所有其他回复表单
        document.querySelectorAll('.reply-form-container').forEach(container => {
            container.classList.add('hidden');
        });
        
        // 显示当前回复表单
        replyFormContainer.classList.remove('hidden');
        
        // 聚焦到输入框
        const textarea = replyFormContainer.querySelector('textarea');
        if (textarea) {
            textarea.focus();
        }
    } else {
        // 隐藏回复表单
        replyFormContainer.classList.add('hidden');
    }
}

/**
 * 处理回复提交
 * @param {Event} e - 事件对象
 */
async function handleReplySubmit(e) {
    const btn = e.currentTarget;
    const messageElement = btn.closest('[data-message-id]');
    const messageId = messageElement.getAttribute('data-message-id');
    const replyFormContainer = messageElement.querySelector('.reply-form-container');
    const textarea = replyFormContainer.querySelector('textarea');
    const content = textarea.value.trim();
    
    if (!messageId || !content) {
        utils.showErrorToast('请输入回复内容');
        return;
    }
    
    const username = usernameInput.value.trim() || '访客';

    
    try {
        const reply = await addReply(messageId, username, content);
        
        if (reply) {
            // 清空输入框并隐藏表单
            textarea.value = '';
            replyFormContainer.classList.add('hidden');
            
            // 显示成功提示
            utils.showSuccessToast('回复成功');
            
            // 重新加载该留言以显示新回复
            loadMessages();
        }
    } catch (error) {
        console.error('提交回复失败:', error);
    }
}

/**
 * 处理删除留言
 * @param {Event} e - 事件对象
 */
async function handleDeleteMessage(e) {
    const btn = e.currentTarget;
    const messageElement = btn.closest('[data-message-id]');
    const messageId = messageElement.getAttribute('data-message-id');
    
    if (!messageId) return;
    
    if (!confirm('确定要删除这条留言吗？')) {
        return;
    }
    
    try {
        const success = await deleteMessage(messageId);
        
        if (success) {
            // 显示成功提示
            utils.showSuccessToast('留言删除成功');
            
            // 重新加载留言列表
            loadMessages();
        }
    } catch (error) {
        console.error('删除留言失败:', error);
    }
}

/**
 * 处理删除回复
 * @param {Event} e - 事件对象
 */
async function handleDeleteReply(e) {
    e.stopPropagation();
    
    const btn = e.currentTarget;
    const replyId = btn.getAttribute('data-reply-id');
    
    if (!replyId) return;
    
    if (!confirm('确定要删除这条回复吗？')) {
        return;
    }
    
    try {
        const success = await deleteReply(replyId);
        
        if (success) {
            // 显示成功提示
            utils.showSuccessToast('回复删除成功');
            
            // 重新加载留言列表
            loadMessages();
        }
    } catch (error) {
        console.error('删除回复失败:', error);
    }
}

/**
 * 处理文件预览
 * @param {HTMLElement} fileItem - 文件项元素
 */
function handleFilePreview(fileItem) {
    const fileUrl = fileItem.getAttribute('data-file-url');
    const fileName = fileItem.getAttribute('data-file-name');
    const fileType = fileItem.getAttribute('data-file-type');
    
    if (!fileUrl) return;
    
    // 设置模态框标题
    modalFileName.textContent = fileName;
    
    // 根据文件类型显示不同内容
    if (utils.isImageFile(fileType)) {
        modalImage.src = fileUrl;
        modalImage.classList.remove('hidden');
        nonImageFileMessage.classList.add('hidden');
    } else {
        modalImage.classList.add('hidden');
        nonImageFileMessage.classList.remove('hidden');
        nonImageFileText.textContent = `这是一个${getFileTypeName(fileType)}文件，点击下载查看`;
        downloadFileLink.href = fileUrl;
    }
    
    // 显示模态框
    fileViewerModal.classList.remove('hidden');
}

/**
 * 处理编辑留言
 * @param {Event} e - 事件对象
 */
function handleEditMessage(e) {
    const btn = e.currentTarget;
    const messageElement = btn.closest('[data-message-id]');
    const messageId = messageElement.getAttribute('data-message-id');
    const contentElement = messageElement.querySelector('.mb-4 p');
    
    if (!messageId || !contentElement) return;
    
    // 存储当前编辑的留言ID
    activeMessageId = messageId;
    
    // 获取当前内容（移除HTML格式）
    const currentContent = contentElement.textContent;
    
    // 设置编辑框内容
    editContentInput.value = currentContent;
    
    // 显示编辑模态框
    editModal.classList.remove('hidden');
    
    // 聚焦到编辑框
    setTimeout(() => {
        editContentInput.focus();
    }, 100);
}

/**
 * 处理保存编辑
 */
async function handleSaveEdit() {
    const content = editContentInput.value.trim();
    
    if (!activeMessageId || !content) {
        utils.showErrorToast('请输入内容');
        return;
    }
    
    try {
        const success = await updateMessage(activeMessageId, content);
        
        if (success) {
            // 显示成功提示
            utils.showSuccessToast('留言更新成功');
            
            // 关闭模态框
            closeEditModal();
            
            // 重新加载留言列表
            loadMessages();
        }
    } catch (error) {
        console.error('保存编辑失败:', error);
    }
}

/**
 * 关闭文件查看器模态框
 */
function closeFileViewer() {
    fileViewerModal.classList.add('hidden');
}

/**
 * 关闭编辑模态框
 */
function closeEditModal() {
    editModal.classList.add('hidden');
    activeMessageId = null;
}

/**
 * 处理文件选择
 * @param {Event} e - 事件对象
 */
function handleFileSelect(e) {
    const file = e.target.files[0];
    if (file) {
        handleFile(file);
    }
}

/**
 * 处理拖放文件
 * @param {Event} e - 事件对象
 */
function handleDrop(e) {
    const dt = e.dataTransfer;
    const file = dt.files[0];
    if (file) {
        handleFile(file);
    }
}

/**
 * 处理文件
 * @param {File} file - 文件对象
 */
function handleFile(file) {
    // 验证文件类型
    if (!utils.isValidFileType(file, config.app.supportedFileTypes)) {
        utils.showErrorToast('不支持的文件类型');
        return;
    }
    
    // 验证文件大小
    if (!utils.isValidFileSize(file, config.app.maxFileSize)) {
        utils.showErrorToast(`文件大小不能超过${utils.formatFileSize(config.app.maxFileSize)}`);
        return;
    }
    
    // 存储活动文件
    activeFile = file;
    
    // 显示文件预览
    previewFileName.textContent = file.name;
    previewFileSize.textContent = utils.formatFileSize(file.size);
    
    // 设置文件图标
    if (utils.isImageFile(file.type)) {
        const reader = new FileReader();
        reader.onload = function(e) {
            previewImage.src = e.target.result;
            previewImage.classList.remove('hidden');
        };
        reader.readAsDataURL(file);
        previewFileIcon.className = 'fa fa-file-image-o text-primary mr-3';
    } else {
        previewImage.classList.add('hidden');
        previewFileIcon.className = `fa fa-file-${getFileIcon(file.type)} text-primary mr-3`;
    }
    
    // 显示预览容器
    filePreviewContainer.classList.remove('hidden');
}

/**
 * 移除选中的文件
 */
function removeSelectedFile() {
    activeFile = null;
    fileInput.value = '';
    filePreviewContainer.classList.add('hidden');
    previewImage.src = '';
    previewImage.classList.add('hidden');
    uploadProgressContainer.classList.add('hidden');
}

/**
 * 获取文件图标
 * @param {string} mimeType - 文件MIME类型
 * @returns {string} 图标名称
 */
function getFileIcon(mimeType) {
    if (mimeType === 'application/pdf') return 'pdf-o';
    if (mimeType === 'text/plain') return 'text-o';
    if (mimeType.includes('word')) return 'word-o';
    if (mimeType.includes('excel')) return 'excel-o';
    return 'o';
}

/**
 * 获取文件类型名称
 * @param {string} mimeType - 文件MIME类型
 * @returns {string} 文件类型名称
 */
function getFileTypeName(mimeType) {
    if (mimeType.startsWith('image/')) return '图片';
    if (mimeType === 'application/pdf') return 'PDF';
    if (mimeType === 'text/plain') return '文本';
    if (mimeType.includes('word')) return 'Word文档';
    if (mimeType.includes('excel')) return 'Excel表格';
    return '文档';
}

/**
 * 更新字符计数
 */
function updateCharCount() {
    const length = messageContentInput.value.length;
    charCountElement.textContent = `${length}/${config.app.maxContentLength}`;
    
    // 如果超过最大长度，改变颜色
    if (length > config.app.maxContentLength) {
        charCountElement.classList.add('text-red-500');
    } else {
        charCountElement.classList.remove('text-red-500');
    }
}

/**
 * 处理搜索
 */
function handleSearch() {
    searchTerm = searchInput.value.trim();
    currentPage = 1;
    loadMessages();
}

/**
 * 处理筛选变化
 */
function handleFilterChange() {
    filterType = filterSelect.value;
    currentPage = 1;
    loadMessages();
}

/**
 * 切换排序顺序
 */
function toggleSortOrder() {
    sortOrder = sortOrder === 'desc' ? 'asc' : 'desc';
    
    // 更新排序图标
    const sortIcon = sortToggleBtn.querySelector('i');
    if (sortOrder === 'desc') {
        sortIcon.className = 'fa fa-sort-amount-desc';
    } else {
        sortIcon.className = 'fa fa-sort-amount-asc';
    }
    
    loadMessages();
}

/**
 * 前往上一页
 */
function goToPrevPage() {
    if (currentPage > 1) {
        currentPage--;
        loadMessages();
    }
}

/**
 * 前往下一页
 */
function goToNextPage() {
    const totalPages = parseInt(totalPagesElement.textContent) || 1;
    if (currentPage < totalPages) {
        currentPage++;
        loadMessages();
    }
}

/**
 * 更新分页控件
 * @param {Object} paginationInfo - 分页信息
 */
function updatePagination(paginationInfo) {
    const { totalPages } = paginationInfo;
    
    // 更新页码信息
    currentPageElement.textContent = currentPage;
    totalPagesElement.textContent = totalPages || 1;
    
    // 更新按钮状态
    prevPageBtn.disabled = currentPage <= 1;
    nextPageBtn.disabled = currentPage >= (totalPages || 1);
    
    // 显示或隐藏分页控件
    if (totalPages > 1) {
        paginationContainer.classList.remove('hidden');
    } else {
        paginationContainer.classList.add('hidden');
    }
}

/**
 * 显示加载状态
 */
function showLoadingState() {
    messageListContainer.innerHTML = `
        <div class="text-center py-16 bg-white rounded-xl border border-gray-200">
            <div class="inline-block w-12 h-12 border-4 border-primary/30 border-t-primary rounded-full animate-spin mb-4"></div>
            <p class="text-gray-500">正在加载留言...</p>
        </div>
    `;
}

/**
 * 显示空状态
 */
function renderEmptyState() {
    messageListContainer.innerHTML = `
        <div class="text-center py-16 bg-white rounded-xl border border-gray-200">
            <i class="fa fa-comments-o text-4xl text-gray-300 mb-4"></i>
            <p class="text-gray-500">暂无留言</p>
            <p class="text-gray-400 text-sm mt-2">成为第一个发表留言的人吧！</p>
        </div>
    `;
}

/**
 * 显示错误状态
 * @param {string} errorMessage - 错误消息
 */
function renderErrorState(errorMessage) {
    messageListContainer.innerHTML = `
        <div class="text-center py-16 bg-white rounded-xl border border-gray-200">
            <i class="fa fa-exclamation-circle text-4xl text-red-400 mb-4"></i>
            <p class="text-gray-500">${errorMessage}</p>
            <button class="btn-primary mt-4" onclick="location.reload()">刷新页面</button>
        </div>
    `;
}

/**
 * 设置实时更新
 */
function setupRealtimeUpdates() {
    try {
        // 监听留言创建
        const messageInsertChannel = subscribeToChanges('messages', 'INSERT', (payload) => {
            loadMessages();
        });
        
        // 监听留言更新
        const messageUpdateChannel = subscribeToChanges('messages', 'UPDATE', (payload) => {
            loadMessages();
        });
        
        // 监听留言删除
        const messageDeleteChannel = subscribeToChanges('messages', 'DELETE', (payload) => {
            loadMessages();
        });
        
        // 监听回复创建
        const replyInsertChannel = subscribeToChanges('replies', 'INSERT', (payload) => {
            loadMessages();
        });
        
        // 监听回复删除
        const replyDeleteChannel = subscribeToChanges('replies', 'DELETE', (payload) => {
            loadMessages();
        });
        
        // 存储频道以便在需要时取消订阅
        realtimeChannels = [
            messageInsertChannel,
            messageUpdateChannel,
            messageDeleteChannel,
            replyInsertChannel,
            replyDeleteChannel
        ];
    } catch (error) {
        console.error('设置实时更新失败:', error);
    }
}

/**
 * 处理窗口滚动
 */
function handleScroll() {
    const header = document.querySelector('header');
    if (window.scrollY > 50) {
        header.classList.add('py-2', 'shadow');
        header.classList.remove('py-4');
    } else {
        header.classList.add('py-4');
        header.classList.remove('py-2', 'shadow');
    }
}

/**
 * 切换表情选择器显示状态
 */
function toggleEmojiPicker() {
    emojiPicker.classList.toggle('hidden');
    
    if (!emojiPicker.classList.contains('hidden')) {
        // 定位表情选择器
        const rect = emojiBtn.getBoundingClientRect();
        emojiPicker.style.left = `${rect.left}px`;
        emojiPicker.style.top = `${rect.bottom + window.scrollY}px`;
    }
}

/**
 * 阻止默认事件（用于拖拽上传）
 */
function preventDefaults(e) {
    e.preventDefault();
    e.stopPropagation();
}

/**
 * 高亮拖拽区域
 */
function highlight() {
    dropArea.classList.add('bg-primary/5', 'border-primary');
}

/**
 * 取消高亮拖拽区域
 */
function unhighlight() {
    dropArea.classList.remove('bg-primary/5', 'border-primary');
}

/**
 * 转义HTML特殊字符
 * @param {string} text - 要转义的文本
 * @returns {string} 转义后的文本
 */
function escapeHTML(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

/**
 * 格式化内容（添加换行等）
 * @param {string} text - 要格式化的文本
 * @returns {string} 格式化后的HTML
 */
function formatContent(text) {
    // 将换行符转换为<br>
    return text.replace(/\n/g, '<br>');
}

/**
 * 清理资源
 */
function cleanup() {
    // 取消所有实时更新订阅
    realtimeChannels.forEach(channel => {
        unsubscribeChanges(channel);
    });
}

// 页面加载完成后初始化应用
window.addEventListener('load', initApp);

// 窗口关闭前清理资源
window.addEventListener('beforeunload', cleanup);

// 导出一些公共函数以便调试
window.app = {
    loadMessages,
    currentPage,
    searchTerm
};
