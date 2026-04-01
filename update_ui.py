import os

filepath = "www/index.html"
with open(filepath, "r") as f:
    content = f.read()

# 1. Update CSS
# Adjust chat panel position
content = content.replace(
    "#chat-panel{position:absolute;right:0;top:0;bottom:0;z-index:30;width:280px}",
    "#chat-panel{position:absolute;right:0;top:0;bottom:0;z-index:30;width:100%;height:100%;background:var(--bg)}"
)

# Adjust video area PiP when chat is open
content = content.replace(
    "#video-area.has-peer #local-video-wrap{width:130px;height:90px;bottom:.75rem;right:.75rem}",
    "#video-area.has-peer #local-video-wrap{width:100px;height:140px;bottom:5.5rem;right:.75rem}\n\nbody.pip-over-chat #video-area.has-peer {\n  position:absolute;\n  width:120px;\n  height:160px;\n  bottom:5rem;\n  right:1rem;\n  z-index:40;\n  border-radius:12px;\n  overflow:hidden;\n}\nbody.pip-over-chat #video-area.has-peer #remote-video {\n  border-radius: 12px;\n}\nbody.pip-over-chat #video-area.has-peer #local-video-wrap {\n  width:40px;\n  height:60px;\n  bottom:.5rem;\n  right:.5rem;\n}\nbody.pip-over-chat #video-area.has-peer #controls {\n  display:none;\n}"
)

# Update top-btn svg size and add Dropdown Menu CSS
content = content.replace(
    ".top-btn svg{width:14px;height:14px;stroke:currentColor;fill:none;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}",
    ".top-btn svg{width:16px;height:16px;stroke:currentColor;fill:none;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}\n\n/* Dropdown Menu */\n#menu-dropdown{\n  position:absolute;top:100%;right:0;margin-top:.5rem;\n  background:var(--surface);\n  border:1px solid var(--border);\n  border-radius:12px;\n  display:flex;flex-direction:column;\n  min-width:160px;\n  overflow:hidden;\n  box-shadow:0 8px 32px rgba(0,0,0,.5);\n  backdrop-filter:blur(30px) saturate(1.4);\n  -webkit-backdrop-filter:blur(30px) saturate(1.4);\n  opacity:0;pointer-events:none;transform:translateY(-10px);\n  transition:all .2s cubic-bezier(.23,1,.32,1);\n  z-index:100;\n}\n#menu-dropdown.show{\n  opacity:1;pointer-events:auto;transform:translateY(0);\n}\n.menu-item{\n  background:none;border:none;color:var(--text);\n  padding:.75rem 1rem;font-size:.8rem;cursor:pointer;\n  font-family:var(--sans);font-weight:500;\n  display:flex;align-items:center;gap:.5rem;\n  text-align:left;width:100%;\n  transition:background .2s;\n  border-bottom:1px solid var(--border-hi);\n}\n.menu-item:last-child{border-bottom:none}\n.menu-item:hover{background:rgba(255,255,255,.05);color:var(--accent)}\n.menu-item svg{width:16px;height:16px;stroke:currentColor;fill:none;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}"
)

# Update control buttons to be circular
content = content.replace(
    ".ctrl-btn{\n  width:44px;height:44px;border-radius:12px;",
    ".ctrl-btn{\n  width:48px;height:48px;border-radius:50%;"
)

content = content.replace(
    ".ctrl-btn.end{background:var(--danger);color:#fff}",
    ".ctrl-btn.end{background:var(--danger);color:#fff;box-shadow:0 0 15px rgba(248,113,113,.4)}"
)

# Fix #topbar-actions CSS
content = content.replace(
    "#topbar-actions{display:flex;gap:.5rem;align-items:center}",
    "#topbar-actions{display:flex;gap:.5rem;align-items:center;position:relative}"
)


# 2. Update HTML
# Replace Topbar actions with 3-dot menu
content = content.replace(
"""      <div id="topbar-actions">
        <button class="top-btn" id="copy-btn" onclick="copyRoomLink()">
          <svg viewBox="0 0 24 24"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>
          Copy link
        </button>
        <button class="top-btn" id="chat-toggle-btn" onclick="toggleChat()">
          <svg viewBox="0 0 24 24"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>
          Chat
        </button>
      </div>""",
"""      <div id="topbar-actions">
        <button class="top-btn" id="menu-btn" onclick="toggleMenu(event)" title="More options">
          <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="1"/><circle cx="12" cy="5" r="1"/><circle cx="12" cy="19" r="1"/></svg>
        </button>
        <div id="menu-dropdown">
          <button class="menu-item" id="chat-toggle-btn" onclick="toggleChat()">
            <svg viewBox="0 0 24 24"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>
            Chat
          </button>
          <button class="menu-item" id="copy-btn" onclick="copyRoomLink()">
            <svg viewBox="0 0 24 24"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>
            Copy link
          </button>
        </div>
      </div>"""
)

# Remove old screen button, make End Call button rightmost, and restore screen-btn inside controls
content = content.replace(
"""        <div id="controls">
          <button class="ctrl-btn" id="mic-btn" onclick="toggleMic()" title="Mute">
            <svg viewBox="0 0 24 24"><path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z"/><path d="M19 10v2a7 7 0 01-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>
          </button>
          <button class="ctrl-btn" id="cam-btn" onclick="toggleCam()" title="Camera off">
            <svg viewBox="0 0 24 24"><path d="M23 7l-7 5 7 5V7z"/><rect x="1" y="5" width="15" height="14" rx="2"/></svg>
          </button>
          <button class="ctrl-btn" id="screen-btn" onclick="toggleScreen()" title="Share screen">
            <svg viewBox="0 0 24 24"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>
          </button>
          <button class="ctrl-btn end" id="end-btn" onclick="endCall()" title="End call">
            <svg viewBox="0 0 24 24"><path d="M10.68 13.31a16 16 0 003.41 2.6l1.27-1.27a2 2 0 012.11-.45 12.84 12.84 0 004 .64 2 2 0 012 2v3.28a2 2 0 01-1.82 2A19.79 19.79 0 013.07 4.82 2 2 0 015.07 3h3.28a2 2 0 012 1.72 12.84 12.84 0 00.64 4 2 2 0 01-.45 2.11z" transform="rotate(135 12 12)"/></svg>
          </button>
        </div>""",
"""        <div id="controls">
          <button class="ctrl-btn" id="screen-btn" onclick="toggleScreen()" title="Share screen">
            <svg viewBox="0 0 24 24"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>
          </button>
          <button class="ctrl-btn" id="cam-btn" onclick="toggleCam()" title="Camera off">
            <svg viewBox="0 0 24 24"><path d="M23 7l-7 5 7 5V7z"/><rect x="1" y="5" width="15" height="14" rx="2"/></svg>
          </button>
          <button class="ctrl-btn" id="mic-btn" onclick="toggleMic()" title="Mute">
            <svg viewBox="0 0 24 24"><path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z"/><path d="M19 10v2a7 7 0 01-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>
          </button>
          <button class="ctrl-btn end" id="end-btn" onclick="endCall()" title="End call">
            <svg viewBox="0 0 24 24"><path d="M10.68 13.31a16 16 0 003.41 2.6l1.27-1.27a2 2 0 012.11-.45 12.84 12.84 0 004 .64 2 2 0 012 2v3.28a2 2 0 01-1.82 2A19.79 19.79 0 013.07 4.82 2 2 0 015.07 3h3.28a2 2 0 012 1.72 12.84 12.84 0 00.64 4 2 2 0 01-.45 2.11z"/></svg>
          </button>
        </div>"""
)


# 3. Update JavaScript

# Add toggleMenu and body click listener
content = content.replace(
"""// ─── Room link copy ───────────────────────────────────────────────""",
"""// ─── Topbar Menu ──────────────────────────────────────────────────
function toggleMenu(e) {
  if (e) e.stopPropagation();
  const menu = document.getElementById('menu-dropdown');
  menu.classList.toggle('show');
}
window.addEventListener('click', (e) => {
  const menu = document.getElementById('menu-dropdown');
  const btn = document.getElementById('menu-btn');
  if (menu && menu.classList.contains('show') && !menu.contains(e.target) && !btn.contains(e.target)) {
    menu.classList.remove('show');
  }
});

// ─── Room link copy ───────────────────────────────────────────────"""
)

# Update copy button svg logic
content = content.replace(
"""    btn.innerHTML='<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="20 6 9 17 4 12"/></svg> Copied!';
    btn.classList.add('copied');
    setTimeout(()=>{
      btn.innerHTML='<svg viewBox="0 0 24 24"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg> Copy link';
      btn.classList.remove('copied');
    },2000);""",
"""    btn.innerHTML='<svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg> Copied!';
    btn.classList.add('copied');
    setTimeout(()=>{
      btn.innerHTML='<svg viewBox="0 0 24 24"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg> Copy link';
      btn.classList.remove('copied');
    },2000);
    const menu = document.getElementById('menu-dropdown');
    if(menu) menu.classList.remove('show');
    toast('Link copied to clipboard');"""
)


# Update toggleChat logic for PiP
content = content.replace(
"""function toggleChat(){
  chatOpen = !chatOpen;
  document.getElementById('chat-panel').classList.toggle('hidden',!chatOpen);
  const btn = document.getElementById('chat-toggle-btn');
  if(chatOpen){
    btn.innerHTML='<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg> Chat';
    btn.classList.add('copied');
  }else{
    btn.innerHTML='<svg viewBox="0 0 24 24"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg> Chat';
    btn.classList.remove('copied');
  }
}""",
"""function toggleChat(){
  chatOpen = !chatOpen;
  document.getElementById('chat-panel').classList.toggle('hidden',!chatOpen);

  // Toggle PiP over Chat
  if(chatOpen && peerId){
    document.body.classList.add('pip-over-chat');
  }else{
    document.body.classList.remove('pip-over-chat');
  }

  const menu = document.getElementById('menu-dropdown');
  if(menu) menu.classList.remove('show');
}"""
)


with open(filepath, "w") as f:
    f.write(content)
