const { getServerURL, STORAGE_KEY } = require('../js/utils');

describe('getServerURL', () => {
  beforeEach(() => {
    // Clear DOM
    document.body.innerHTML = '';
    // Clear localStorage
    localStorage.clear();
    // Clear mocks
    jest.clearAllMocks();
  });

  it('should return empty string if no input exists and localStorage is empty', () => {
    expect(getServerURL()).toBe('');
  });

  it('should return input value, save to localStorage, and strip trailing slashes', () => {
    document.body.innerHTML = `
      <input id="server-url" value="https://example.com/api//  " />
    `;

    // Spy on setItem
    const setItemSpy = jest.spyOn(Storage.prototype, 'setItem');

    const url = getServerURL();

    expect(url).toBe('https://example.com/api');
    expect(setItemSpy).toHaveBeenCalledWith(STORAGE_KEY, 'https://example.com/api//');
  });

  it('should fallback to localStorage if input does not exist, and strip trailing slashes', () => {
    localStorage.setItem(STORAGE_KEY, 'https://saved-server.com///');

    const url = getServerURL();

    expect(url).toBe('https://saved-server.com');
  });

  it('should fallback to localStorage if input exists but is empty', () => {
    document.body.innerHTML = `
      <input id="server-url" value="   " />
    `;
    localStorage.setItem(STORAGE_KEY, 'https://saved-server.com');

    const url = getServerURL();

    expect(url).toBe('https://saved-server.com');
  });

  it('should ignore localStorage if input has a value', () => {
    document.body.innerHTML = `
      <input id="server-url" value="https://new-server.com" />
    `;
    localStorage.setItem(STORAGE_KEY, 'https://old-server.com');

    const setItemSpy = jest.spyOn(Storage.prototype, 'setItem');

    const url = getServerURL();

    expect(url).toBe('https://new-server.com');
    expect(setItemSpy).toHaveBeenCalledWith(STORAGE_KEY, 'https://new-server.com');
  });
});
