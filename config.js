// 配置文件
const config = {
    // Supabase配置
    supabase: {
        url: 'https://czjcvwsalxftsxomfiyf.supabase.co',
        anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN6amN2d3NhbHhmdHN4b21maXlmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk0NzYwMDMsImV4cCI6MjA3NTA1MjAwM30.KowEk4M6Ykl8q21DxsT9dKOgmwy0Hlg3cabD6tr3Q8k'
    },
    // 应用配置
    app: {
        pageSize: 10, // 每页显示的留言数量
        maxContentLength: 200, // 留言内容最大长度
        maxFileSize: 10 * 1024 * 1024, // 最大文件大小 (10MB)
        supportedFileTypes: ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf', 'text/plain', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet']
    }
};

// 导出配置
export default config;