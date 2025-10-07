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
        
        // 检查表是否存在
        const { data: tables, error: tablesError } = await supabase.rpc('list_tables');
        
        if (tablesError) {
            // 如果RPC函数不可用，尝试直接创建表
            await createMessagesTable(supabase);
            return;
        }
        
        const tableExists = tables.some(table => table.name === 'messages');
        if (!tableExists) {
            await createMessagesTable(supabase);
        }
        
        // 检查回复表是否存在
        const replyTableExists = tables.some(table => table.name === 'replies');
        if (!replyTableExists) {
            await createRepliesTable(supabase);
        }
        
        // 检查点赞表是否存在
        const likesTableExists = tables.some(table => table.name === 'likes');
        if (!likesTableExists) {
            await createLikesTable(supabase);
        }
    } catch (error) {
        console.error('确保表存在失败:', error);
    }
}

/**
 * 创建messages表
 * @param {Object} supabase - Supabase客户端实例
 * @returns {Promise<void>}
 */
async function createMessagesTable(supabase) {
    try {
        const { error } = await supabase
            .from('messages')
            .insert([{ id: 'temp', username: 'system', content: '初始化', created_at: new Date().toISOString() }])
            .select();
            
        if (error && error.code === '42P01') { // 表不存在错误代码
            // 尝试使用SQL创建表
            const { error: createError } = await supabase.rpc('execute_sql', {
                sql: `
                CREATE TABLE IF NOT EXISTS messages (
                    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                    username VARCHAR(255) NOT NULL,
                    content TEXT NOT NULL,
                    created_at TIMESTAMP DEFAULT NOW(),
                    likes INTEGER DEFAULT 0,
                    file_name TEXT,
                    file_url TEXT,
                    file_size BIGINT,
                    file_type TEXT
                );
                CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at);
                CREATE INDEX IF NOT EXISTS idx_messages_username ON messages(username);
                `
            });
            
            if (createError) {
                console.warn('创建表失败，可能是权限问题:', createError);
            }
        } else if (!error) {
            // 删除临时记录
            await supabase.from('messages').delete().eq('id', 'temp');
        }
    } catch (error) {
        console.warn('创建表失败，可能是权限问题:', error);
    }
}

/**
 * 创建replies表
 * @param {Object} supabase - Supabase客户端实例
 * @returns {Promise<void>}
 */
async function createRepliesTable(supabase) {
    try {
        // 尝试使用SQL创建表
        const { error } = await supabase.rpc('execute_sql', {
            sql: `
            CREATE TABLE IF NOT EXISTS replies (
                id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                message_id UUID REFERENCES messages(id) ON DELETE CASCADE,
                username VARCHAR(255) NOT NULL,
                content TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT NOW()
            );
            CREATE INDEX IF NOT EXISTS idx_replies_message_id ON replies(message_id);
            `
        });
        
        if (error) {
            console.warn('创建回复表失败，可能是权限问题:', error);
        }
    } catch (error) {
        console.warn('创建回复表失败，可能是权限问题:', error);
    }
}

/**
 * 创建likes表
 * @param {Object} supabase - Supabase客户端实例
 * @returns {Promise<void>}
 */
async function createLikesTable(supabase) {
    try {
        // 尝试使用SQL创建表
        const { error } = await supabase.rpc('execute_sql', {
            sql: `
            CREATE TABLE IF NOT EXISTS likes (
                id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                message_id UUID REFERENCES messages(id) ON DELETE CASCADE,
                username VARCHAR(255) NOT NULL,
                created_at TIMESTAMP DEFAULT NOW(),
                UNIQUE(message_id, username)
            );
            CREATE INDEX IF NOT EXISTS idx_likes_message_id ON likes(message_id);
            CREATE INDEX IF NOT EXISTS idx_likes_username ON likes(username);
            `
        });
        
        if (error) {
            console.warn('创建点赞表失败，可能是权限问题:', error);
        }
    } catch (error) {
        console.warn('创建点赞表失败，可能是权限问题:', error);
    }
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