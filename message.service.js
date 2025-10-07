// 留言服务模块
import { getSupabaseClient } from './supabase.service.js';
import { showErrorToast } from './utils.js';
import config from './config.js';

/**
 * 获取留言列表
 * @param {Object} options - 配置选项
 * @param {number} options.page - 页码
 * @param {number} options.pageSize - 每页数量
 * @param {string} options.sortBy - 排序字段
 * @param {string} options.sortOrder - 排序顺序
 * @param {string} options.searchTerm - 搜索关键词
 * @returns {Promise<Object>} 留言列表和分页信息
 */
export async function getMessages(options = {}) {
    try {
        const supabase = getSupabaseClient();
        if (!supabase) {
            return { messages: [], total: 0 };
        }
        
        const {
            page = 1,
            pageSize = config.app.pageSize,
            sortBy = 'created_at',
            sortOrder = 'desc',
            searchTerm = ''
        } = options;
        
        let query = supabase.from('messages');
        
        // 添加搜索条件
        if (searchTerm.trim()) {
            query = query.or(
                `username.ilike.%${searchTerm}%,content.ilike.%${searchTerm}%`
            );
        }
        
        // 添加排序
        query = query.order(sortBy, { ascending: sortOrder === 'asc' });
        
        // 添加分页
        const from = (page - 1) * pageSize;
        const to = from + pageSize - 1;
        query = query.range(from, to);
        
        // 获取数据
        const { data, count, error } = await query.select('*', { count: 'exact' });
        
        if (error) {
            throw error;
        }
        
        // 同时获取每条留言的回复
        const messagesWithReplies = await Promise.all(data.map(async message => {
            const replies = await getRepliesByMessageId(message.id);
            return {
                ...message,
                replies,
                has_liked: await hasUserLikedMessage(message.id)
            };
        }));
        
        return {
            messages: messagesWithReplies,
            total: count || 0,
            page,
            pageSize,
            totalPages: Math.ceil((count || 0) / pageSize)
        };
    } catch (error) {
        console.error('获取留言列表失败:', error);
        showErrorToast('获取留言列表失败');
        return { messages: [], total: 0 };
    }
}

/**
 * 获取单条留言
 * @param {string} messageId - 留言ID
 * @returns {Promise<Object|null>} 留言对象
 */
export async function getMessageById(messageId) {
    try {
        const supabase = getSupabaseClient();
        if (!supabase || !messageId) {
            return null;
        }
        
        const { data, error } = await supabase
            .from('messages')
            .select('*')
            .eq('id', messageId)
            .single();
        
        if (error) {
            throw error;
        }
        
        // 获取回复
        const replies = await getRepliesByMessageId(messageId);
        const hasLiked = await hasUserLikedMessage(messageId);
        
        return {
            ...data,
            replies,
            has_liked
        };
    } catch (error) {
        console.error('获取留言失败:', error);
        return null;
    }
}

/**
 * 发布新留言
 * @param {Object} messageData - 留言数据
 * @param {string} messageData.username - 用户名
 * @param {string} messageData.content - 留言内容
 * @param {Object|null} messageData.file - 文件信息
 * @returns {Promise<Object|null>} 创建的留言对象
 */
export async function createMessage(messageData) {
    try {
        const supabase = getSupabaseClient();
        if (!supabase) {
            return null;
        }
        
        const { username, content, file } = messageData;
        
        // 验证数据
        if (!username || !content) {
            showErrorToast('用户名和内容不能为空');
            return null;
        }
        
        if (content.length > config.app.maxContentLength) {
            showErrorToast(`内容不能超过${config.app.maxContentLength}个字符`);
            return null;
        }
        
        // 准备插入数据
        const insertData = {
            username,
            content,
            created_at: new Date().toISOString(),
            likes: 0
        };
        
        // 添加文件信息
        if (file) {
            insertData.file_name = file.name;
            insertData.file_url = file.url;
            insertData.file_size = file.size;
            insertData.file_type = file.type;
        }
        
        const { data, error } = await supabase
            .from('messages')
            .insert([insertData])
            .select('*')
            .single();
        
        if (error) {
            throw error;
        }
        
        // 添加回复列表
        return {
            ...data,
            replies: [],
            has_liked: false
        };
    } catch (error) {
        console.error('发布留言失败:', error);
        showErrorToast('发布留言失败');
        return null;
    }
}

/**
 * 更新留言
 * @param {string} messageId - 留言ID
 * @param {string} content - 新内容
 * @returns {Promise<boolean>} 更新是否成功
 */
export async function updateMessage(messageId, content) {
    try {
        const supabase = getSupabaseClient();
        if (!supabase || !messageId || !content) {
            return false;
        }
        
        if (content.length > config.app.maxContentLength) {
            showErrorToast(`内容不能超过${config.app.maxContentLength}个字符`);
            return false;
        }
        
        const { error } = await supabase
            .from('messages')
            .update({ content })
            .eq('id', messageId);
        
        if (error) {
            throw error;
        }
        
        return true;
    } catch (error) {
        console.error('更新留言失败:', error);
        showErrorToast('更新留言失败');
        return false;
    }
}

/**
 * 删除留言
 * @param {string} messageId - 留言ID
 * @returns {Promise<boolean>} 删除是否成功
 */
export async function deleteMessage(messageId) {
    try {
        const supabase = getSupabaseClient();
        if (!supabase || !messageId) {
            return false;
        }
        
        const { error } = await supabase
            .from('messages')
            .delete()
            .eq('id', messageId);
        
        if (error) {
            throw error;
        }
        
        return true;
    } catch (error) {
        console.error('删除留言失败:', error);
        showErrorToast('删除留言失败');
        return false;
    }
}

/**
 * 点赞/取消点赞留言
 * @param {string} messageId - 留言ID
 * @param {string} username - 用户名
 * @returns {Promise<Object|null>} 点赞后的留言对象
 */
export async function toggleLike(messageId, username) {
    try {
        const supabase = getSupabaseClient();
        if (!supabase || !messageId || !username) {
            return null;
        }
        
        // 检查是否已经点赞
        const { data: existingLike, error: likeError } = await supabase
            .from('likes')
            .select('*')
            .eq('message_id', messageId)
            .eq('username', username)
            .single();
        
        if (likeError && likeError.code !== 'PGRST116') {
            throw likeError;
        }
        
        let isLiked = false;
        let newLikeCount = 0;
        
        if (existingLike) {
            // 取消点赞
            await supabase
                .from('likes')
                .delete()
                .eq('id', existingLike.id);
            
            // 减少点赞数
            const { data: updatedMessage } = await supabase
                .from('messages')
                .update({ likes: supabase.raw('likes - 1') })
                .eq('id', messageId)
                .select('likes')
                .single();
            
            newLikeCount = updatedMessage.likes;
        } else {
            // 点赞
            await supabase
                .from('likes')
                .insert([{
                    message_id: messageId,
                    username,
                    created_at: new Date().toISOString()
                }]);
            
            // 增加点赞数
            const { data: updatedMessage } = await supabase
                .from('messages')
                .update({ likes: supabase.raw('likes + 1') })
                .eq('id', messageId)
                .select('likes')
                .single();
            
            newLikeCount = updatedMessage.likes;
            isLiked = true;
        }
        
        return { likes: newLikeCount, has_liked: isLiked };
    } catch (error) {
        console.error('点赞操作失败:', error);
        showErrorToast('点赞操作失败');
        return null;
    }
}

/**
 * 检查用户是否已点赞留言
 * @param {string} messageId - 留言ID
 * @returns {Promise<boolean>} 是否已点赞
 */
async function hasUserLikedMessage(messageId) {
    try {
        // 注意：这是一个简化版本，实际应该使用用户认证信息
        // 这里使用localStorage中的临时用户名进行模拟
        const username = localStorage.getItem('temp_username') || 'anonymous';
        
        if (!username) {
            return false;
        }
        
        const supabase = getSupabaseClient();
        if (!supabase) {
            return false;
        }
        
        const { data, error } = await supabase
            .from('likes')
            .select('id')
            .eq('message_id', messageId)
            .eq('username', username)
            .single();
        
        return !error;
    } catch (error) {
        console.error('检查点赞状态失败:', error);
        return false;
    }
}

/**
 * 获取留言的回复
 * @param {string} messageId - 留言ID
 * @returns {Promise<Array>} 回复列表
 */
export async function getRepliesByMessageId(messageId) {
    try {
        const supabase = getSupabaseClient();
        if (!supabase || !messageId) {
            return [];
        }
        
        const { data, error } = await supabase
            .from('replies')
            .select('*')
            .eq('message_id', messageId)
            .order('created_at', { ascending: true });
        
        if (error) {
            throw error;
        }
        
        return data || [];
    } catch (error) {
        console.error('获取回复失败:', error);
        return [];
    }
}

/**
 * 添加回复
 * @param {string} messageId - 留言ID
 * @param {string} username - 用户名
 * @param {string} content - 回复内容
 * @returns {Promise<Object|null>} 创建的回复对象
 */
export async function addReply(messageId, username, content) {
    try {
        const supabase = getSupabaseClient();
        if (!supabase || !messageId || !username || !content) {
            return null;
        }
        
        const { data, error } = await supabase
            .from('replies')
            .insert([{
                message_id: messageId,
                username,
                content,
                created_at: new Date().toISOString()
            }])
            .select('*')
            .single();
        
        if (error) {
            throw error;
        }
        
        return data;
    } catch (error) {
        console.error('添加回复失败:', error);
        showErrorToast('添加回复失败');
        return null;
    }
}

/**
 * 删除回复
 * @param {string} replyId - 回复ID
 * @returns {Promise<boolean>} 删除是否成功
 */
export async function deleteReply(replyId) {
    try {
        const supabase = getSupabaseClient();
        if (!supabase || !replyId) {
            return false;
        }
        
        const { error } = await supabase
            .from('replies')
            .delete()
            .eq('id', replyId);
        
        if (error) {
            throw error;
        }
        
        return true;
    } catch (error) {
        console.error('删除回复失败:', error);
        showErrorToast('删除回复失败');
        return false;
    }
}

/**
 * 获取热门留言
 * @param {number} limit - 获取数量
 * @returns {Promise<Array>} 热门留言列表
 */
export async function getPopularMessages(limit = 5) {
    try {
        const supabase = getSupabaseClient();
        if (!supabase) {
            return [];
        }
        
        const { data, error } = await supabase
            .from('messages')
            .select('*')
            .order('likes', { ascending: false })
            .limit(limit);
        
        if (error) {
            throw error;
        }
        
        return data || [];
    } catch (error) {
        console.error('获取热门留言失败:', error);
        return [];
    }
}