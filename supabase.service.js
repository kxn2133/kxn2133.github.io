// Supabase服务模块
import config from './config.js';
import { showErrorToast } from './utils.js';

// 初始化Supabase客户端
let supabaseClient = null;

/**
 * 初始化Supabase客户端
 * @returns {Object} Supabase客户端实例
 */
export function initSupabase() {
    if (!config.supabase.url || !config.supabase.anonKey) {
        showErrorToast('Supabase配置不完整');
        return null;
    }
    
    try {
        supabaseClient = window.supabase.createClient(config.supabase.url, config.supabase.anonKey);
        return supabaseClient;
    } catch (error) {
        console.error('Supabase初始化失败:', error);
        showErrorToast('Supabase连接失败');
        return null;
    }
}

/**
 * 获取Supabase客户端实例
 * @returns {Object} Supabase客户端实例
 */
export function getSupabaseClient() {
    if (!supabaseClient) {
        return initSupabase();
    }
    return supabaseClient;
}

/**
 * 检查Supabase连接状态
 * @returns {Promise<boolean>} 连接状态
 */
export async function checkSupabaseConnection() {
    try {
        const supabase = getSupabaseClient();
        if (!supabase) return false;
        
        // 执行简单查询来测试连接
        const { data, error } = await supabase.from('messages').select('id').limit(1);
        return !error;
    } catch (error) {
        console.error('Supabase连接测试失败:', error);
        return false;
    }
}

/**
 * 确保表存在
 * @returns {Promise<void>}
 */
export async function ensureTableExists() {
    try {
        const supabase = getSupabaseClient();
        if (!supabase) return;
        
        // 尝试直接执行简单查询来验证表是否存在，不依赖RPC函数
        try {
            await supabase.from('messages').select('id').limit(1);
        } catch (error) {
            // 如果查询失败，表可能不存在，但由于我们已经通过SQL脚本创建了表
            // 这里主要是验证连接，不需要创建表
            console.warn('表验证查询失败:', error);
        }
        
        // 由于我们已经通过SQL脚本创建了表，这里不再尝试创建表
        // 简化逻辑，避免依赖不存在的RPC函数
    } catch (error) {
        console.error('确保表存在失败:', error);
    }
}

/**
 * 创建messages表 - 现在通过SQL脚本创建，这里仅保留函数定义
 * @param {Object} supabase - Supabase客户端实例
 * @returns {Promise<void>}
 */
async function createMessagesTable(supabase) {
    // 表创建现在通过SQL脚本完成，此处不执行任何操作
    console.log('表创建已通过SQL脚本完成');
}

/**
 * 创建replies表 - 现在通过SQL脚本创建，这里仅保留函数定义
 * @param {Object} supabase - Supabase客户端实例
 * @returns {Promise<void>}
 */
async function createRepliesTable(supabase) {
    // 表创建现在通过SQL脚本完成，此处不执行任何操作
    console.log('表创建已通过SQL脚本完成');
}

/**
 * 创建likes表 - 现在通过SQL脚本创建，这里仅保留函数定义
 * @param {Object} supabase - Supabase客户端实例
 * @returns {Promise<void>}
 */
async function createLikesTable(supabase) {
    // 表创建现在通过SQL脚本完成，此处不执行任何操作
    console.log('表创建已通过SQL脚本完成');
}

/**
 * 确保存储桶存在
 * @returns {Promise<void>}
 */
export async function ensureStorageBucketExists() {
    try {
        const supabase = getSupabaseClient();
        if (!supabase) return;
        
        const bucketName = 'message_files';
        
        // 检查存储桶是否存在
        const { data, error } = await supabase.storage.getBucket(bucketName);
        
        if (error && error.code === '404') {
            // 尝试创建存储桶
            try {
                await supabase.storage.createBucket(bucketName, {
                    public: true,
                    allowedMimeTypes: config.app.supportedFileTypes,
                    fileSizeLimit: config.app.maxFileSize
                });
                console.log('存储桶创建成功');
            } catch (createError) {
                console.warn('创建存储桶失败，可能是权限问题:', createError);
            }
        }
    } catch (error) {
        console.error('确保存储桶存在失败:', error);
    }
}

/**
 * 上传文件到Supabase存储
 * @param {File} file - 文件对象
 * @param {Function} onProgress - 上传进度回调函数
 * @returns {Promise<Object|null>} 文件信息对象
 */
export async function uploadFile(file, onProgress = null) {
    try {
        const supabase = getSupabaseClient();
        if (!supabase) return null;
        
        const bucketName = 'message_files';
        const fileId = `${Date.now()}_${file.name}`;
        
        // 上传文件
        const { data, error } = await supabase.storage
            .from(bucketName)
            .upload(fileId, file, {
                cacheControl: '3600',
                upsert: false,
                onProgress: (event) => {
                    if (onProgress) {
                        onProgress(event.loaded / event.total * 100);
                    }
                }
            });
        
        if (error) {
            throw error;
        }
        
        // 获取公共URL
        const { data: { publicUrl } } = supabase.storage
            .from(bucketName)
            .getPublicUrl(fileId);
        
        return {
            name: file.name,
            url: publicUrl,
            size: file.size,
            type: file.type,
            path: data.path
        };
    } catch (error) {
        console.error('文件上传失败:', error);
        showErrorToast('文件上传失败: ' + error.message);
        return null;
    }
}

/**
 * 删除存储中的文件
 * @param {string} filePath - 文件路径
 * @returns {Promise<boolean>} 删除是否成功
 */
export async function deleteFile(filePath) {
    try {
        const supabase = getSupabaseClient();
        if (!supabase || !filePath) return false;
        
        const bucketName = 'message_files';
        const { error } = await supabase.storage
            .from(bucketName)
            .remove([filePath]);
        
        if (error) {
            throw error;
        }
        
        return true;
    } catch (error) {
        console.error('文件删除失败:', error);
        return false;
    }
}

/**
 * 监听数据变化（实时更新）
 * @param {string} table - 表名
 * @param {string} event - 事件类型
 * @param {Function} callback - 回调函数
 * @returns {Object} 监听器对象
 */
export function subscribeToChanges(table, event, callback) {
    try {
        const supabase = getSupabaseClient();
        if (!supabase) return null;
        
        const channel = supabase.channel('public:messages');
        
        channel.on('postgres_changes', {
            event: event,
            schema: 'public',
            table: table
        }, (payload) => {
            callback(payload);
        }).subscribe();
        
        return channel;
    } catch (error) {
        console.error('创建数据监听器失败:', error);
        return null;
    }
}

/**
 * 取消监听
 * @param {Object} channel - 监听器对象
 */
export function unsubscribeChanges(channel) {
    if (channel) {
        try {
            channel.unsubscribe();
        } catch (error) {
            console.error('取消监听失败:', error);
        }
    }
}
