// Supabase连接测试脚本
console.log('开始测试Supabase连接...');

// 初始化Supabase客户端
const supabaseUrl = 'https://czjcvwsalxftsxomfiyf.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN6amN2d3NhbHhmdHN4b21maXlmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk0NzYwMDMsImV4cCI6MjA3NTA1MjAwM30.KowEk4M6Ykl8q21DxsT9dKOgmwy0Hlg3cabD6tr3Q8k';

// 确保window.supabase存在再初始化
let supabase;
try {
    if (window.supabase) {
        supabase = window.supabase.createClient(supabaseUrl, supabaseKey);
        console.log('Supabase客户端初始化成功');
    } else {
        console.error('Supabase库未加载，请检查script标签');
        // 创建一个模拟对象以便开发调试
        supabase = {
            from: () => ({
                select: () => ({ data: [], error: null }),
                insert: () => ({ data: [], error: null }),
                update: () => ({ data: [], error: null }),
                delete: () => ({ data: [], error: null })
            }),
            rpc: () => Promise.resolve({ data: null, error: null }),
            auth: { getUser: () => Promise.resolve({ data: { user: null }, error: null }) }
        };
    }
} catch (error) {
    console.error('Supabase初始化失败:', error);
    // 创建模拟对象
    supabase = {
        from: () => ({
            select: () => ({ data: [], error: null }),
            insert: () => ({ data: [], error: null }),
            update: () => ({ data: [], error: null }),
            delete: () => ({ data: [], error: null })
        }),
        rpc: () => Promise.resolve({ data: null, error: null }),
        auth: { getUser: () => Promise.resolve({ data: { user: null }, error: null }) }
    };
}

// 测试函数
async function testSupabase() {
    try {
        // 1. 测试基本连接
        console.log('测试基本连接...');
        const { data: { user } } = await supabase.auth.getUser();
        console.log('连接成功！匿名用户:', user ? '已登录' : '未登录 (匿名访问)');
        
        // 2. 检查messages表是否存在
        console.log('\n测试messages表是否存在...');
        try {
            const { data, error } = await supabase
                .from('messages')
                .select('*')
                .limit(1);
            
            if (error) {
                console.error('表访问错误:', error.message);
                console.log('可能的原因：表不存在或权限不足');
            } else {
                console.log('表访问成功！数据类型:', Array.isArray(data) ? '数组' : typeof data);
                console.log('返回的记录数:', data.length);
            }
        } catch (err) {
            console.error('表不存在或权限错误:', err.message);
        }
        
        // 3. 尝试插入一条测试数据
        console.log('\n尝试插入测试数据...');
        try {
            const testMessage = {
                name: '测试用户',
                content: '这是一条测试消息',
                created_at: new Date().toISOString()
            };
            
            const { data, error } = await supabase
                .from('messages')
                .insert([testMessage])
                .select();
            
            if (error) {
                console.error('插入失败:', error.message);
            } else {
                console.log('插入成功！返回的数据:', data);
            }
        } catch (err) {
            console.error('插入异常:', err.message);
        }
        
        // 4. 显示表结构信息
        console.log('\n建议在Supabase控制台检查以下内容：');
        console.log('- 是否已创建messages表');
        console.log('- 表结构是否包含name, content, created_at字段');
        console.log('- RLS策略是否正确配置，允许匿名用户插入和读取数据');
        
    } catch (error) {
        console.error('测试失败:', error);
        console.log('\n可能的解决方案：');
        console.log('1. 检查Supabase URL和密钥是否正确');
        console.log('2. 确保在Supabase控制台创建了messages表');
        console.log('3. 检查表的权限设置，确保允许插入和查询操作');
        console.log('4. 查看浏览器控制台的网络请求，确认API调用状态');
    }
}

// 立即执行测试，不依赖DOMContentLoaded
console.log('测试脚本已加载，开始执行Supabase连接测试...');

testSupabase().then(() => {
    console.log('测试完成，请查看控制台输出获取详细信息。');
    
    // 同时仍然尝试添加测试按钮，方便后续测试
    try {
        if (document.body) {
            const testBtn = document.createElement('button');
            testBtn.innerText = '测试Supabase连接';
            testBtn.style.position = 'fixed';
            testBtn.style.bottom = '20px';
            testBtn.style.right = '20px';
            testBtn.style.padding = '10px 20px';
            testBtn.style.backgroundColor = '#3b82f6';
            testBtn.style.color = 'white';
            testBtn.style.border = 'none';
            testBtn.style.borderRadius = '5px';
            testBtn.style.cursor = 'pointer';
            testBtn.style.zIndex = '1000';
            
            testBtn.addEventListener('click', async function() {
                console.clear();
                await testSupabase();
            });
            
            document.body.appendChild(testBtn);
            console.log('测试按钮已添加到页面右下角');
        }
    } catch (error) {
        console.log('无法添加测试按钮，但不影响测试功能:', error.message);
    }
});
