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
            console.error('Supabase客户端未初始化');
            return { messages: [], total: 0 };
        }
        
        const {
            page = 1,
            pageSize = config.app.pageSize,
            sortBy = 'created_at',
            sortOrder = 'desc',
            searchTerm = ''
        } = options;
        
        const from = (page - 1) * pageSize;
        const to = from + pageSize - 1;
        
        console.log('正在获取留言列表，参数:', { page, pageSize, from, to, sortBy, sortOrder, searchTerm });
        
        let query = supabase.from('messages');
        
        // 添加搜索条件
        if (searchTerm.trim()) {
            console.log('应用搜索条件:', searchTerm);
            // 为了安全，转义特殊字符
            const escapedSearchTerm = searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            query = query.or(
                `username.ilike.%${escapedSearchTerm}%,content.ilike.%${escapedSearchTerm}%`
            );
        }
        
        // 添加排序
        query = query.order(sortBy, { ascending: sortOrder === 'asc' });
        
        // 添加分页
        query = query.range(from, to);
        
        // 获取数据
        const { data, count, error } = await query.select('*', { count: 'exact' });
        
        if (error) {
            console.error('Supabase查询错误:', error.message, '代码:', error.code);
            // 检查是否是权限问题或表不存在的问题
            if (error.code === '42P01') {
                console.error('可能是表不存在，请确保已运行初始化脚本');
            } else if (error.code === '42501') {
                console.error('可能是权限不足，请检查RLS策略');
            }
            throw error;
        }
        
        console.log('获取到留言数量:', data?.length, '总数量:', count);
        
        // 如果没有数据，直接返回空数组
        if (!data || data.length === 0) {
            return {
                messages: [],
                total: 0,
                page,
                pageSize,
                totalPages: 0
            };
        }
        
        // 同时获取每条留言的回复和点赞状态
        // 使用更安全的方式处理，避免一个失败导致全部失败
        const messagesWithReplies = [];
        
        // 首先尝试获取用户名，如果获取失败则跳过点赞状态检查
        let username = null;
        try {
            const storedUsername = localStorage.getItem('username');
            if (storedUsername && storedUsername.trim()) {
                username = storedUsername.trim();
                console.log('用户已登录，用户名:', username);
            } else {
                console.log('用户未登录，跳过点赞状态检查');
            }
        } catch (storageError) {
            console.warn('获取用户名失败:', storageError);
            // 即使获取用户名失败，也继续处理留言
        }
        
        for (const message of data) {
            try {
                const messageStartTime = performance.now();
                console.log(`处理留言ID: ${message.id}`);
                
                // 获取回复
                const replies = await getRepliesByMessageId(message.id);
                console.log(`留言ID: ${message.id} 回复数量: ${replies.length}`);
                
                // 只有当用户已登录时才检查点赞状态
                let hasLiked = false;
                if (username) {
                    try {
                        console.log(`检查用户 ${username} 是否点赞了留言 ${message.id}`);
                        const likeStartTime = performance.now();
                        hasLiked = await hasUserLikedMessage(message.id, username);
                        const likeEndTime = performance.now();
                        console.log(`检查点赞状态完成，耗时: ${Math.round(likeEndTime - likeStartTime)}ms, 结果: ${hasLiked}`);
                    } catch (likeError) {
                        console.warn(`检查留言 ${message.id} 点赞状态失败:`, likeError);
                        // 记录具体的错误类型
                        if (likeError.code === 'PGRST116') {
                            console.warn('错误代码 PGRST116: likes表可能不存在');
                        } else if (likeError.code === '42501') {
                            console.warn('错误代码 42501: 访问likes表权限不足');
                        }
                        // 出错时默认设为未点赞
                        hasLiked = false;
                    }
                } else {
                    console.log(`用户未登录，跳过留言 ${message.id} 的点赞状态检查`);
                }
                
                messagesWithReplies.push({
                    ...message,
                    replies,
                    has_liked: hasLiked
                });
                
                const messageEndTime = performance.now();
                console.log(`处理留言 ${message.id} 完成，耗时: ${Math.round(messageEndTime - messageStartTime)}ms`);
                
            } catch (messageError) {
                console.warn('处理留言数据失败，继续处理其他留言:', messageError);
                // 记录具体的错误信息
                if (messageError.code) {
                    console.warn('错误代码:', messageError.code);
                }
                // 即使处理失败，也保留原始留言数据
                messagesWithReplies.push({
                    ...message,
                    replies: [],
                    has_liked: false
                });
            }
        }
        
        return {
            messages: messagesWithReplies,
            total: count || 0,
            page,
            pageSize,
            totalPages: Math.ceil((count || 0) / pageSize)
        };
    } catch (error) {
        console.error('获取留言列表失败:', error);
        // 提供更具体的错误信息
        let errorMessage = '获取留言列表失败';
        if (error.code === '42P01') {
            errorMessage = '数据表可能不存在，请先运行初始化脚本';
        } else if (error.code === '42501') {
            errorMessage = '权限不足，请检查数据库权限设置';
        } else if (error.code === 'PGRST001') {
            errorMessage = '数据库连接失败，请检查配置';
        }
        showErrorToast(errorMessage);
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
        let username = localStorage.getItem('temp_username');
        
        // 如果没有保存的用户名，返回false而不使用默认值
        // 避免匿名用户的点赞状态干扰
        if (!username) {
            return false;
        }
        
        const supabase = getSupabaseClient();
        if (!supabase || !messageId) {
            return false;
        }
        
        const { data, error } = await supabase
            .from('likes')
            .select('id')
            .eq('message_id', messageId)
            .eq('username', username)
            .single();
        
        // 正确的逻辑：如果没有错误并且有数据，则表示已点赞
        // 如果返回404错误（没有找到记录），则表示未点赞
        // 其他错误则返回false
        if (error) {
            if (error.code === 'PGRST116') { // 未找到记录的错误代码
                return false;
            }
            console.warn('检查点赞状态时发生错误:', error);
            return false;
        }
        
        return data !== null;
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
