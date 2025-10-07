// 工具函数模块

/**
 * 格式化时间戳
 * @param {number|string} timestamp - 时间戳
 * @returns {string} 格式化后的时间字符串
 */
export function formatTimestamp(timestamp) {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now - date;
    const minutes = Math.floor(diff / (1000 * 60));
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    
    if (minutes < 1) {
        return '刚刚';
    } else if (minutes < 60) {
        return `${minutes}分钟前`;
    } else if (hours < 24) {
        return `${hours}小时前`;
    } else if (days < 7) {
        return `${days}天前`;
    } else {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const hour = String(date.getHours()).padStart(2, '0');
        const minute = String(date.getMinutes()).padStart(2, '0');
        
        if (year === now.getFullYear()) {
            return `${month}-${day} ${hour}:${minute}`;
        } else {
            return `${year}-${month}-${day} ${hour}:${minute}`;
        }
    }
}

/**
 * 格式化文件大小
 * @param {number} bytes - 字节数
 * @returns {string} 格式化后的文件大小字符串
 */
export function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * 显示成功提示
 * @param {string} message - 提示消息
 * @param {number} duration - 显示时长（毫秒）
 */
export function showSuccessToast(message, duration = 3000) {
    const toast = document.getElementById('successToast');
    const toastMessage = document.getElementById('toastMessage');
    
    if (!toast || !toastMessage) return;
    
    toastMessage.textContent = message;
    toast.classList.remove('hidden', 'translate-x-full');
    
    setTimeout(() => {
        toast.classList.add('translate-x-full');
        setTimeout(() => {
            toast.classList.add('hidden');
        }, 300);
    }, duration);
}

/**
 * 显示错误提示
 * @param {string} message - 错误消息
 * @param {number} duration - 显示时长（毫秒）
 */
export function showErrorToast(message, duration = 3000) {
    const toast = document.getElementById('errorToast');
    const toastMessage = document.getElementById('errorToastMessage');
    
    if (!toast || !toastMessage) return;
    
    toastMessage.textContent = message;
    toast.classList.remove('hidden', 'translate-x-full');
    
    setTimeout(() => {
        toast.classList.add('translate-x-full');
        setTimeout(() => {
            toast.classList.add('hidden');
        }, 300);
    }, duration);
}

/**
 * 防抖函数
 * @param {Function} func - 要防抖的函数
 * @param {number} wait - 等待时间（毫秒）
 * @returns {Function} 防抖后的函数
 */
export function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

/**
 * 节流函数
 * @param {Function} func - 要节流的函数
 * @param {number} limit - 时间限制（毫秒）
 * @returns {Function} 节流后的函数
 */
export function throttle(func, limit) {
    let inThrottle;
    return function(...args) {
        if (!inThrottle) {
            func.apply(this, args);
            inThrottle = true;
            setTimeout(() => inThrottle = false, limit);
        }
    };
}

/**
 * 验证文件类型
 * @param {File} file - 文件对象
 * @param {string[]} supportedTypes - 支持的文件类型数组
 * @returns {boolean} 是否支持该文件类型
 */
export function isValidFileType(file, supportedTypes) {
    return supportedTypes.includes(file.type);
}

/**
 * 验证文件大小
 * @param {File} file - 文件对象
 * @param {number} maxSize - 最大文件大小（字节）
 * @returns {boolean} 文件大小是否在限制范围内
 */
export function isValidFileSize(file, maxSize) {
    return file.size <= maxSize;
}

/**
 * 生成唯一ID
 * @returns {string} 唯一ID字符串
 */
export function generateUniqueId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

/**
 * 复制文本到剪贴板
 * @param {string} text - 要复制的文本
 * @returns {Promise<void>}
 */
export async function copyToClipboard(text) {
    try {
        if (navigator.clipboard && window.isSecureContext) {
            await navigator.clipboard.writeText(text);
        } else {
            // 回退方法
            const textArea = document.createElement('textarea');
            textArea.value = text;
            textArea.style.position = 'fixed';
            textArea.style.left = '-999999px';
            textArea.style.top = '-999999px';
            document.body.appendChild(textArea);
            textArea.focus();
            textArea.select();
            
            try {
                document.execCommand('copy');
            } catch (error) {
                throw new Error('复制失败');
            } finally {
                document.body.removeChild(textArea);
            }
        }
    } catch (error) {
        throw error;
    }
}

/**
 * 生成表情列表
 * @returns {string[]} 表情符号数组
 */
export function generateEmojis() {
    const emojis = [
        '😊', '😀', '😁', '😂', '🤣', '😃', '😄', '😅',
        '😆', '😉', '😋', '😎', '😍', '😘', '🥰', '😗',
        '😙', '😚', '☺️', '🙂', '🤗', '🤔', '🤭', '🤫',
        '🤥', '😐', '😑', '😶', '😏', '😒', '🙄', '😬',
        '😔', '😪', '🤤', '😴', '😷', '🤒', '🤕', '🤢',
        '🤮', '🤧', '🥵', '🥶', '😵', '🤯', '🤠', '🥳',
        '😎', '🤓', '🧐', '😕', '😟', '🙁', '😮', '😯',
        '😲', '😳', '🥺', '😦', '😧', '😨', '😰', '😥'
    ];
    return emojis;
}

/**
 * 检查是否为图像文件
 * @param {string} mimeType - 文件MIME类型
 * @returns {boolean} 是否为图像文件
 */
export function isImageFile(mimeType) {
    return mimeType.startsWith('image/');
}

/**
 * 检查是否为文本文件
 * @param {string} mimeType - 文件MIME类型
 * @returns {boolean} 是否为文本文件
 */
export function isTextFile(mimeType) {
    return mimeType === 'text/plain' || mimeType === 'application/pdf';
}