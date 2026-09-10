import re

path = 'src/components/AdminDashboard/AdminDashboard.tsx'
with open(path, 'r', encoding='utf-8') as f:
    code = f.read()

# Fix types
code = re.sub(
    r'useState<\{\s*email:\s*string;\s*connectedAt:\s*string\s*\}>\[\]',
    r'useState<{ email: string; connectedAt: string; avatar?: string }>[]',
    code
)

code = re.sub(
    r'socket\.on\(\'admin:online-users\',\s*\(users:\s*\{\s*email:\s*string;\s*connectedAt:\s*string\s*\}(\[\])?\)\s*=>\s*\{',
    r'socket.on(\'admin:online-users\', (users: { email: string; connectedAt: string; avatar?: string }[]) => {',
    code
)

# Fix Live Users
old_live_regex = r'\{onlineUsers\.map\(\(u,\s*i\)\s*=>\s*\([\s\S]*?</div>\s*\)\)}'
new_live = '''{onlineUsers.map((u, i) => (
              <div key={i} className=\"flex items-center gap-2.5 px-3 py-1.5 rounded-lg bg-green-400/10 border border-green-400/20 text-sm text-green-400 shadow-[0_0_15px_rgba(74,222,128,0.05)] transition-all hover:bg-green-400/20\">
                {u.avatar ? (
                  <img src={u.avatar} alt=\"Avatar\" className=\"w-5 h-5 rounded-full ring-1 ring-green-400/50 object-cover\" />
                ) : (
                  <div className=\"w-5 h-5 rounded-full bg-green-400/20 flex items-center justify-center text-[10px] font-bold text-green-400 ring-1 ring-green-400/50\">
                    {u.email.substring(0, 2).toUpperCase()}
                  </div>
                )}
                <span className=\"text-gray-200 font-medium\">{u.email}</span>
                <span className=\"text-xs text-green-400/70\">since {new Date(u.connectedAt).toLocaleTimeString()}</span>
              </div>
            ))}'''

code = re.sub(old_live_regex, new_live, code)

# Fix TD
old_td_regex = r'<td className=\"py-3 px-4\">\s*<div className=\"font-medium text-gray-200\">\{item\.email\}</div>\s*<div className=\"text-xs text-gray-500\">\{item\.id\.substring\(0,8\)\}\.\.\.</div>\s*</td>'
new_td = '''<td className=\"py-3 px-4\">
                        <div className=\"flex items-center gap-3\">
                          {(() => {
                            const onlineData = onlineUsers.find(u => u.email === item.email);
                            const avatarUrl = onlineData?.avatar || https://api.dicebear.com/7.x/avataaars/svg?seed=;
                            const isOnline = !!onlineData;
                            return (
                              <div className=\"relative shrink-0\">
                                <img src={avatarUrl} alt=\"Avatar\" className=\"w-9 h-9 rounded-full bg-white/5 object-cover ring-1 ring-white/10 shadow-sm\" />
                                {isOnline && <div className=\"absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-400 rounded-full ring-2 ring-[#0b0b0d]\"></div>}
                              </div>
                            );
                          })()}
                          <div>
                            <div className=\"font-medium text-gray-200\">{item.email}</div>
                            <div className=\"text-xs text-gray-500\">{item.id.substring(0,8)}...</div>
                          </div>
                        </div>
                      </td>'''

code = re.sub(old_td_regex, new_td, code)

with open(path, 'w', encoding='utf-8') as f:
    f.write(code)
