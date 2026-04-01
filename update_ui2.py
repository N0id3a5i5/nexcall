import os

filepath = "www/index.html"
with open(filepath, "r") as f:
    content = f.read()

# Remove the media query wrapping the chat panel absolute positioning
content = content.replace(
"""/* ─── Responsive ─────────────────────────────────────── */
@media(max-width:640px){
  #chat-panel{position:absolute;right:0;top:0;bottom:0;z-index:30;width:100%;height:100%;background:var(--bg)}""",
"""/* ─── Responsive ─────────────────────────────────────── */
#chat-panel{position:absolute;right:0;top:0;bottom:0;z-index:30;width:100%;height:100%;background:var(--bg)}
@media(max-width:640px){"""
)

# Fix JS for chat toggle logic
content = content.replace(
"""function toggleChat(){
  chatOpen = !chatOpen;
  document.getElementById('chat-panel').classList.toggle('hidden',!chatOpen);
  const btn = document.getElementById('chat-toggle-btn');
  if(chatOpen){
    btn.innerHTML='<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg> Chat';
  } else {
    btn.innerHTML='<svg viewBox="0 0 24 24"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg> Chat';
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
