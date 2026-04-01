/**
 * @jest-environment jsdom
 */

const fs = require('fs');
const path = require('path');

describe('Chat XSS Vulnerability', () => {
  let appendChat;

  beforeAll(() => {
    // Read the www/index.html file to extract the appendChat function
    const htmlPath = path.resolve(__dirname, '../www/index.html');
    const htmlContent = fs.readFileSync(htmlPath, 'utf8');

    // Simple extraction of the appendChat function definition
    const functionRegex = /function appendChat\(type,text,time\)\{([\s\S]*?)msgs\.scrollTop=msgs\.scrollHeight;\n\}/;
    const match = htmlContent.match(functionRegex);

    if (match) {
      // Evaluate the function into the current scope
      eval(`appendChat = function(type,text,time){${match[1]}msgs.scrollTop=msgs.scrollHeight;}`);
    } else {
      throw new Error('Could not find appendChat function in www/index.html');
    }
  });

  beforeEach(() => {
    // Set up our document body
    document.body.innerHTML = `
      <div id="messages"></div>
    `;
  });

  it('should escape HTML tags in text using textContent', () => {
    const maliciousText = '<img src="x" onerror="alert(1)">Hello';
    const time = '10:00 AM';

    // Call the function
    appendChat('self', maliciousText, time);

    const msgs = document.getElementById('messages');

    // There should be one message div
    expect(msgs.children.length).toBe(1);

    const msgDiv = msgs.children[0];
    const bubbleDiv = msgDiv.querySelector('.msg-bubble');
    const metaDiv = msgDiv.querySelector('.msg-meta');

    // The innerHTML should contain the escaped text, not the actual HTML tags
    expect(bubbleDiv.innerHTML).toBe('&lt;img src="x" onerror="alert(1)"&gt;Hello');

    // The textContent should match exactly what we passed in
    expect(bubbleDiv.textContent).toBe(maliciousText);

    // Ensure no images were actually created by the browser
    expect(msgDiv.querySelector('img')).toBeNull();
  });
});
