const AUTH_URL = '/api/auth.php';

async function authRequest(action, payload = {}) {
    const response = await fetch(`${AUTH_URL}?action=${action}`, {
        method: action === 'me' ? 'GET' : 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: action === 'me' ? undefined : JSON.stringify(payload),
    });
    const data = await response.json().catch(() => null);
    if (!response.ok) throw new Error(data?.error || 'Authentication request failed.');
    return data;
}

export const getCurrentUser = () => authRequest('me');
export const login = (payload) => authRequest('login', payload);
export const register = (payload) => authRequest('register', payload);
export const logout = () => authRequest('logout');
export const requestPasswordReset = (payload) => authRequest('request-reset', payload);
export const resetPassword = (payload) => authRequest('reset-password', payload);
